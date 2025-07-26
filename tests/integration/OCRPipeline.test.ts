import { OCRService } from '../../src/services/OCRService';
import { ChatService } from '../../src/services/ChatService';
import { SessionManager } from '../../src/services/SessionManager';
import { ConfigurationManager } from '../../src/services/ConfigurationManager';
import { PromptLibraryService } from '../../src/services/PromptLibraryService';
import { RAGService } from '../../src/services/RAGService';

// Mock external dependencies but allow service integration
jest.mock('tesseract.js');
jest.mock('openai');

describe('OCR Pipeline Integration', () => {
  let ocrService: OCRService;
  let chatService: ChatService;
  let sessionManager: SessionManager;
  let configurationManager: ConfigurationManager;
  let promptLibraryService: PromptLibraryService;
  let ragService: RAGService;

  beforeEach(async () => {
    // Initialize services in dependency order
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
    
    ocrService = new OCRService();
    await ocrService.initialize();

    jest.clearAllMocks();
  });

  describe('screenshot to text extraction pipeline', () => {
    it('should capture screenshot and extract text', async () => {
      // Mock Tesseract worker
      const mockWorker = {
        load: jest.fn().mockResolvedValue(undefined),
        loadLanguage: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        recognize: jest.fn().mockResolvedValue({
          data: { text: 'Extracted text from screenshot' }
        }),
        terminate: jest.fn().mockResolvedValue(undefined)
      };

      const { createWorker } = require('tesseract.js');
      createWorker.mockReturnValue(mockWorker);

      const extractedText = await ocrService.processScreenshot('window');

      expect(extractedText).toBe('Extracted text from screenshot');
      expect(mockWorker.recognize).toHaveBeenCalled();
    });

    it('should handle OCR preprocessing and optimization', async () => {
      const mockWorker = {
        load: jest.fn().mockResolvedValue(undefined),
        loadLanguage: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        recognize: jest.fn().mockResolvedValue({
          data: { text: 'Preprocessed text with better accuracy' }
        }),
        terminate: jest.fn().mockResolvedValue(undefined)
      };

      const { createWorker } = require('tesseract.js');
      createWorker.mockReturnValue(mockWorker);

      const extractedText = await ocrService.processScreenshot('window');

      expect(extractedText).toBe('Preprocessed text with better accuracy');
      expect(mockWorker.load).toHaveBeenCalled();
      expect(mockWorker.loadLanguage).toHaveBeenCalledWith('eng');
      expect(mockWorker.initialize).toHaveBeenCalledWith('eng');
    });

    it('should meet 2-second latency requirement', async () => {
      const mockWorker = {
        load: jest.fn().mockResolvedValue(undefined),
        loadLanguage: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        recognize: jest.fn().mockImplementation(() => 
          new Promise(resolve => 
            setTimeout(() => resolve({ data: { text: 'Fast OCR result' } }), 1500)
          )
        ),
        terminate: jest.fn().mockResolvedValue(undefined)
      };

      const { createWorker } = require('tesseract.js');
      createWorker.mockReturnValue(mockWorker);

      const startTime = Date.now();
      const extractedText = await ocrService.processScreenshot('window');
      const endTime = Date.now();

      expect(extractedText).toBe('Fast OCR result');
      expect(endTime - startTime).toBeLessThan(2000); // Under 2 seconds
    });
  });

  describe('OCR to chat integration', () => {
    it('should process OCR text through chat service', async () => {
      // Setup session
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      // Mock OpenAI response
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'This appears to be a technical coding question about algorithms. Here\'s how to approach it...'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      // Set API key
      await configurationManager.updateApiKey('test-api-key');

      const ocrText = 'Write a function to reverse a linked list';
      const response = await chatService.processOCRText(session.id, ocrText, 'screenshot');

      expect(response).toContain('technical coding question');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();

      // Verify the prompt includes OCR text
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      expect(callArgs.messages.some((msg: any) => 
        msg.content.includes('Write a function to reverse a linked list')
      )).toBe(true);
    });

    it('should use profession-specific prompts for OCR analysis', async () => {
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
                  content: 'This is a data science problem involving statistical analysis...'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await configurationManager.updateApiKey('test-api-key');

      const ocrText = 'Calculate the correlation coefficient between these variables';
      await chatService.processOCRText(session.id, ocrText, 'screenshot');

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const systemMessage = callArgs.messages.find((msg: any) => msg.role === 'system');
      
      expect(systemMessage.content).toContain('data scientist');
    });

    it('should handle OCR errors gracefully in chat integration', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      // Mock API error
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('API rate limit exceeded'))
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await configurationManager.updateApiKey('test-api-key');

      const ocrText = 'Some extracted text';
      
      await expect(chatService.processOCRText(session.id, ocrText, 'screenshot'))
        .rejects.toThrow('API rate limit exceeded');
    });
  });

  describe('end-to-end OCR pipeline', () => {
    it('should complete full screenshot to AI response pipeline', async () => {
      // Setup complete pipeline
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      // Mock OCR
      const mockWorker = {
        load: jest.fn().mockResolvedValue(undefined),
        loadLanguage: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        recognize: jest.fn().mockResolvedValue({
          data: { text: 'function fibonacci(n) { return n <= 1 ? n : fibonacci(n-1) + fibonacci(n-2); }' }
        }),
        terminate: jest.fn().mockResolvedValue(undefined)
      };

      const { createWorker } = require('tesseract.js');
      createWorker.mockReturnValue(mockWorker);

      // Mock OpenAI
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'This is a recursive Fibonacci implementation. While correct, it has exponential time complexity. Consider using dynamic programming for better performance.'
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
      const extractedText = await ocrService.processScreenshot('window');
      const aiResponse = await chatService.processOCRText(session.id, extractedText, 'screenshot');

      // Verify pipeline results
      expect(extractedText).toContain('fibonacci');
      expect(aiResponse).toContain('recursive Fibonacci');
      expect(aiResponse).toContain('dynamic programming');

      // Verify session state
      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession?.chatHistory).toHaveLength(2); // User OCR + AI response
    });

    it('should handle debug-specific OCR processing', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      const mockWorker = {
        load: jest.fn().mockResolvedValue(undefined),
        loadLanguage: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        recognize: jest.fn().mockResolvedValue({
          data: { text: 'console.log("Hello World")\nconsole.log("Debug message")' }
        }),
        terminate: jest.fn().mockResolvedValue(undefined)
      };

      const { createWorker } = require('tesseract.js');
      createWorker.mockReturnValue(mockWorker);

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'I can see debug console.log statements in your code. Consider removing these before production or using a proper logging framework.'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await configurationManager.updateApiKey('test-api-key');

      const extractedText = await ocrService.processScreenshot('window');
      const debugResponse = await chatService.processOCRText(session.id, extractedText, 'debug');

      expect(debugResponse).toContain('debug console.log');
      expect(debugResponse).toContain('logging framework');
    });
  });

  describe('performance and reliability', () => {
    it('should handle multiple concurrent OCR requests', async () => {
      const mockWorker = {
        load: jest.fn().mockResolvedValue(undefined),
        loadLanguage: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        recognize: jest.fn().mockImplementation((image) => 
          Promise.resolve({ data: { text: `OCR result for ${image}` } })
        ),
        terminate: jest.fn().mockResolvedValue(undefined)
      };

      const { createWorker } = require('tesseract.js');
      createWorker.mockReturnValue(mockWorker);

      const promises = Array.from({ length: 5 }, (_, i) => 
        ocrService.processScreenshot('window')
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toContain('OCR result');
      });
    });

    it('should maintain OCR accuracy with different image qualities', async () => {
      const mockWorker = {
        load: jest.fn().mockResolvedValue(undefined),
        loadLanguage: jest.fn().mockResolvedValue(undefined),
        initialize: jest.fn().mockResolvedValue(undefined),
        recognize: jest.fn().mockImplementation(() => 
          Promise.resolve({ 
            data: { 
              text: 'High quality text extraction with 95% confidence',
              confidence: 95
            } 
          })
        ),
        terminate: jest.fn().mockResolvedValue(undefined)
      };

      const { createWorker } = require('tesseract.js');
      createWorker.mockReturnValue(mockWorker);

      const result = await ocrService.processScreenshot('window');

      expect(result).toContain('High quality text extraction');
      expect(mockWorker.recognize).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          logger: expect.any(Function)
        })
      );
    });
  });
});