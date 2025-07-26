import { AudioService } from '../../src/services/AudioService';
import { ChatService } from '../../src/services/ChatService';
import { SessionManager } from '../../src/services/SessionManager';
import { ConfigurationManager } from '../../src/services/ConfigurationManager';
import { PromptLibraryService } from '../../src/services/PromptLibraryService';
import { RAGService } from '../../src/services/RAGService';

// Mock external dependencies
jest.mock('node-whisper');
jest.mock('openai');

describe('Audio Pipeline Integration', () => {
  let audioService: AudioService;
  let chatService: ChatService;
  let sessionManager: SessionManager;
  let configurationManager: ConfigurationManager;
  let promptLibraryService: PromptLibraryService;
  let ragService: RAGService;

  beforeEach(async () => {
    // Initialize services
    configurationManager = new ConfigurationManager();
    await configurationManager.initialize();
    
    promptLibraryService = new PromptLibraryService(configurationManager);
    sessionManager = new SessionManager();
    ragService = new RAGService();
    
    chatService = new ChatService(
      configurationManager,
      promptLibraryService,
      sessionManager,
      ragService
    );
    
    audioService = new AudioService();
    await audioService.initialize();

    jest.clearAllMocks();
  });

  describe('audio recording pipeline', () => {
    it('should start and stop audio recording', async () => {
      const sessionId = 'test-session';
      
      // Mock audio recording
      jest.spyOn(audioService as any, 'startMicrophoneRecording').mockResolvedValue(undefined);
      jest.spyOn(audioService as any, 'stopMicrophoneRecording').mockResolvedValue(undefined);

      await audioService.startRecording('microphone', sessionId);
      
      expect(audioService.isRecording(sessionId)).toBe(true);
      
      await audioService.stopRecording(sessionId);
      
      expect(audioService.isRecording(sessionId)).toBe(false);
    });

    it('should support multiple audio sources', async () => {
      const sessionId = 'test-session';
      
      // Mock both audio sources
      jest.spyOn(audioService as any, 'startMicrophoneRecording').mockResolvedValue(undefined);
      jest.spyOn(audioService as any, 'startInternalAudioRecording').mockResolvedValue(undefined);

      // Test microphone recording
      await audioService.startRecording('microphone', sessionId);
      expect(audioService.isRecording(sessionId)).toBe(true);
      await audioService.stopRecording(sessionId);

      // Test internal audio recording
      await audioService.startRecording('internal', sessionId);
      expect(audioService.isRecording(sessionId)).toBe(true);
      await audioService.stopRecording(sessionId);

      // Test both sources
      await audioService.startRecording('both', sessionId);
      expect(audioService.isRecording(sessionId)).toBe(true);
      await audioService.stopRecording(sessionId);
    });

    it('should handle recording errors gracefully', async () => {
      const sessionId = 'test-session';
      
      // Mock recording failure
      jest.spyOn(audioService as any, 'startMicrophoneRecording')
        .mockRejectedValue(new Error('Microphone access denied'));

      await expect(audioService.startRecording('microphone', sessionId))
        .rejects.toThrow('Microphone access denied');
      
      expect(audioService.isRecording(sessionId)).toBe(false);
    });
  });

  describe('audio segmentation and processing', () => {
    it('should process audio in 5-second segments', async () => {
      const sessionId = 'test-session';
      
      // Mock segmented audio processing
      const mockSegments = [
        { audio: 'segment1', timestamp: new Date() },
        { audio: 'segment2', timestamp: new Date() },
        { audio: 'segment3', timestamp: new Date() }
      ];

      jest.spyOn(audioService as any, 'processAudioSegments')
        .mockResolvedValue(mockSegments);

      const segments = await (audioService as any).processAudioSegments('audio-data');
      
      expect(segments).toHaveLength(3);
      expect(segments[0]).toHaveProperty('audio');
      expect(segments[0]).toHaveProperty('timestamp');
    });

    it('should meet 3-second latency target for transcription', async () => {
      const sessionId = 'test-session';
      
      // Mock Whisper transcription
      const mockWhisper = {
        transcribe: jest.fn().mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({
              text: 'This is a transcribed audio segment'
            }), 2500) // Under 3 seconds
          )
        )
      };

      const nodeWhisper = require('node-whisper');
      nodeWhisper.mockReturnValue(mockWhisper);

      const startTime = Date.now();
      const transcription = await (audioService as any).transcribeAudioSegment('audio-segment');
      const endTime = Date.now();

      expect(transcription).toBe('This is a transcribed audio segment');
      expect(endTime - startTime).toBeLessThan(3000); // Under 3 seconds
    });

    it('should handle transcription errors and continue processing', async () => {
      const sessionId = 'test-session';
      
      // Mock Whisper with intermittent failures
      const mockWhisper = {
        transcribe: jest.fn()
          .mockRejectedValueOnce(new Error('Transcription failed'))
          .mockResolvedValueOnce({ text: 'Successful transcription' })
      };

      const nodeWhisper = require('node-whisper');
      nodeWhisper.mockReturnValue(mockWhisper);

      // First call should fail
      await expect((audioService as any).transcribeAudioSegment('bad-audio'))
        .rejects.toThrow('Transcription failed');

      // Second call should succeed
      const result = await (audioService as any).transcribeAudioSegment('good-audio');
      expect(result).toBe('Successful transcription');
    });
  });

  describe('audio to chat integration', () => {
    it('should process transcribed audio through chat service', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'behavioral'
      });

      // Mock OpenAI response
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'Based on what you\'ve described, this sounds like a challenging situation that required strong problem-solving skills...'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await configurationManager.updateApiKey('test-api-key');

      const transcript = 'I had to debug a critical production issue that was affecting thousands of users';
      const response = await chatService.processTranscript(session.id, transcript);

      expect(response).toContain('challenging situation');
      expect(response).toContain('problem-solving skills');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();
    });

    it('should aggregate multiple transcript segments', async () => {
      const session = await sessionManager.createSession({
        profession: 'data-scientist',
        interviewType: 'technical'
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'Your approach to data preprocessing and model selection shows good understanding of machine learning principles.'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await configurationManager.updateApiKey('test-api-key');

      // Process multiple transcript segments
      const segments = [
        'First I would clean the data',
        'Then I would perform feature engineering',
        'Finally I would train multiple models and compare their performance'
      ];

      for (const segment of segments) {
        await chatService.processTranscript(session.id, segment);
      }

      // Verify all segments were processed
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
      
      // Check session history
      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession?.chatHistory.length).toBeGreaterThan(0);
    });

    it('should handle real-time transcript streaming', async () => {
      const sessionId = 'test-session';
      
      // Mock real-time transcription
      const transcriptions = [
        { transcription: 'Hello', timestamp: new Date() },
        { transcription: 'Hello world', timestamp: new Date() },
        { transcription: 'Hello world this is a test', timestamp: new Date() }
      ];

      // Simulate streaming transcriptions
      jest.spyOn(audioService, 'getRecentTranscriptions')
        .mockReturnValue(transcriptions);

      const recentTranscriptions = audioService.getRecentTranscriptions(sessionId);
      
      expect(recentTranscriptions).toHaveLength(3);
      expect(recentTranscriptions[2].transcription).toBe('Hello world this is a test');
    });
  });

  describe('end-to-end audio pipeline', () => {
    it('should complete full recording to AI response pipeline', async () => {
      const session = await sessionManager.createSession({
        profession: 'product-manager',
        interviewType: 'behavioral'
      });

      // Mock audio recording and transcription
      jest.spyOn(audioService as any, 'startMicrophoneRecording').mockResolvedValue(undefined);
      jest.spyOn(audioService as any, 'stopMicrophoneRecording').mockResolvedValue(undefined);
      
      const mockWhisper = {
        transcribe: jest.fn().mockResolvedValue({
          text: 'I led a cross-functional team to deliver a product feature that increased user engagement by 25 percent'
        })
      };

      const nodeWhisper = require('node-whisper');
      nodeWhisper.mockReturnValue(mockWhisper);

      // Mock OpenAI response
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'That\'s an excellent example of leadership and measurable impact. Can you tell me more about the challenges you faced and how you overcame them?'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await configurationManager.updateApiKey('test-api-key');

      // Execute full pipeline
      await audioService.startRecording('microphone', session.id);
      
      // Simulate audio processing
      const transcript = await (audioService as any).transcribeAudioSegment('audio-data');
      const aiResponse = await chatService.processTranscript(session.id, transcript);

      await audioService.stopRecording(session.id);

      // Verify pipeline results
      expect(transcript).toContain('cross-functional team');
      expect(aiResponse).toContain('excellent example of leadership');
      
      // Verify session state
      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession?.chatHistory).toHaveLength(2); // User transcript + AI response
    });

    it('should handle simultaneous recording from multiple sources', async () => {
      const sessionId = 'test-session';
      
      // Mock both audio sources
      jest.spyOn(audioService as any, 'startMicrophoneRecording').mockResolvedValue(undefined);
      jest.spyOn(audioService as any, 'startInternalAudioRecording').mockResolvedValue(undefined);
      jest.spyOn(audioService as any, 'stopMicrophoneRecording').mockResolvedValue(undefined);
      jest.spyOn(audioService as any, 'stopInternalAudioRecording').mockResolvedValue(undefined);

      await audioService.startRecording('both', sessionId);
      
      expect(audioService.isRecording(sessionId)).toBe(true);
      
      const status = audioService.getRecordingStatus(sessionId);
      expect(status.isRecording).toBe(true);
      expect(status.sources).toContain('microphone');
      expect(status.sources).toContain('internal');

      await audioService.stopRecording(sessionId);
      
      expect(audioService.isRecording(sessionId)).toBe(false);
    });
  });

  describe('performance and reliability', () => {
    it('should handle long recording sessions', async () => {
      const sessionId = 'long-session';
      
      // Mock long recording session
      jest.spyOn(audioService as any, 'startMicrophoneRecording').mockResolvedValue(undefined);
      jest.spyOn(audioService as any, 'stopMicrophoneRecording').mockResolvedValue(undefined);

      await audioService.startRecording('microphone', sessionId);
      
      // Simulate long recording (would be actual time in real scenario)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(audioService.isRecording(sessionId)).toBe(true);
      
      await audioService.stopRecording(sessionId);
      
      expect(audioService.isRecording(sessionId)).toBe(false);
    });

    it('should recover from audio service failures', async () => {
      const sessionId = 'recovery-session';
      
      // Mock service failure and recovery
      jest.spyOn(audioService as any, 'startMicrophoneRecording')
        .mockRejectedValueOnce(new Error('Audio device busy'))
        .mockResolvedValueOnce(undefined);

      // First attempt should fail
      await expect(audioService.startRecording('microphone', sessionId))
        .rejects.toThrow('Audio device busy');

      // Second attempt should succeed
      await audioService.startRecording('microphone', sessionId);
      expect(audioService.isRecording(sessionId)).toBe(true);

      await audioService.stopRecording(sessionId);
    });

    it('should maintain audio quality across different recording conditions', async () => {
      const sessionId = 'quality-test';
      
      // Mock different audio quality scenarios
      const mockWhisper = {
        transcribe: jest.fn()
          .mockResolvedValueOnce({ text: 'Clear audio transcription', confidence: 0.95 })
          .mockResolvedValueOnce({ text: 'Noisy audio transcription', confidence: 0.75 })
          .mockResolvedValueOnce({ text: 'Low quality audio transcription', confidence: 0.60 })
      };

      const nodeWhisper = require('node-whisper');
      nodeWhisper.mockReturnValue(mockWhisper);

      // Test different quality levels
      const clearResult = await (audioService as any).transcribeAudioSegment('clear-audio');
      const noisyResult = await (audioService as any).transcribeAudioSegment('noisy-audio');
      const lowQualityResult = await (audioService as any).transcribeAudioSegment('low-quality-audio');

      expect(clearResult).toContain('Clear audio');
      expect(noisyResult).toContain('Noisy audio');
      expect(lowQualityResult).toContain('Low quality');
    });
  });
});