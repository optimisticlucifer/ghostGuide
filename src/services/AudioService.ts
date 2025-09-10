import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import { AudioSource } from '../types';

// Whisper transcription will be handled via whisper.cpp CLI invocation

// Custom error types for better error handling
export class AudioServiceError extends Error {
  constructor(message: string, public code: string, public cause?: Error) {
    super(message);
    this.name = 'AudioServiceError';
  }
}

export class AudioDeviceError extends AudioServiceError {
  constructor(message: string, cause?: Error) {
    super(message, 'AUDIO_DEVICE_ERROR', cause);
  }
}

export class TranscriptionError extends AudioServiceError {
  constructor(message: string, cause?: Error) {
    super(message, 'TRANSCRIPTION_ERROR', cause);
  }
}

interface AudioRecording {
  sessionId: string;
  source: AudioSource;
  process: ChildProcess | null;
  outputFile: string;
  isActive: boolean;
  startTime: Date;
  segments: AudioSegment[];
  recentTranscriptions?: Array<{transcription: string; timestamp: Date; segmentId: string}>;
  accumulatedTranscription: string; // Store accumulated transcription
}

interface AudioSegment {
  id: string;
  filePath: string;
  startTime: Date;
  duration: number;
  transcription?: string;
}

// Configuration constants
const AUDIO_CONFIG = {
  SEGMENT_DURATION: 5000, // 5 seconds in milliseconds
  SAMPLE_RATE: 16000,
  CHANNELS: 1, // Mono
  CODEC: 'pcm_s16le',
  TRANSCRIPTION_TIMEOUT: 30000, // 30 seconds
  MAX_RECENT_TRANSCRIPTIONS: 10,
  SEGMENT_CLEANUP_DELAY: 60000, // 1 minute
  MIN_SEGMENT_SIZE: 1000, // 1KB minimum
  RECOVERY_DELAY: 2000, // 2 seconds
  RESTART_DELAY: 3000, // 3 seconds
  WHISPER_EXECUTABLE: 'whisper-cli', // name of whisper-cli binary in PATH
  MODEL_PATH: path.join(os.homedir(), "tools", "ggml-base.en.bin")
} as const;

export class AudioService {
  private recordings: Map<string, AudioRecording> = new Map();
  private tempDir: string;
  private segmentDuration = 5000; // 5 seconds in milliseconds
  private isInitialized = false;

  // Resolved binary paths (prod-safe)
  private ffmpegPath: string = 'ffmpeg';
  private ffprobePath: string = 'ffprobe';
  private whisperExecutablePath: string = AUDIO_CONFIG.WHISPER_EXECUTABLE;
  private whisperModelPath: string = AUDIO_CONFIG.MODEL_PATH;
  
  // Auto Recorder Mode state
  private autoRecorderActive = false;
  private autoRecorderSessionId: string | null = null;
  private autoRecorderSource: AudioSource = AudioSource.SYSTEM;
  private autoRecorderTranscription = '';

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'interview-assistant-audio');
    this.ensureTempDirectory();
  }

  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Initialize audio service and check dependencies
   */
  async initialize(): Promise<void> {
    try {
      // Resolve binary/model paths in production-safe way
      this.resolvePaths();

      await this.checkDependencies();
      await this.checkAudioDevices();
      this.isInitialized = true;
      console.log('Audio Service initialized successfully');
      console.log(`🎤 [AUDIO] Using ffmpeg at: ${this.ffmpegPath}`);
      console.log(`🎤 [AUDIO] Using ffprobe at: ${this.ffprobePath}`);
      console.log(`🎤 [AUDIO] Using whisper at: ${this.whisperExecutablePath}`);
      console.log(`🎤 [AUDIO] Using whisper model: ${this.whisperModelPath}`);
    } catch (error) {
      console.error('Failed to initialize Audio Service:', error);
      throw new Error('Audio Service initialization failed');
    }
  }

  /**
   * Resolve executable and model paths considering packaged app context
   */
  private resolvePaths(): void {
    // Allow environment variable overrides first
    if (process.env.FFMPEG_PATH) this.ffmpegPath = process.env.FFMPEG_PATH;
    if (process.env.FFPROBE_PATH) this.ffprobePath = process.env.FFPROBE_PATH;
    if (process.env.WHISPER_CLI_PATH) this.whisperExecutablePath = process.env.WHISPER_CLI_PATH;
    if (process.env.WHISPER_MODEL_PATH) this.whisperModelPath = process.env.WHISPER_MODEL_PATH;

    const resourcesPath = (process as any).resourcesPath || process.cwd();

    // Fallback candidates for ffmpeg/ffprobe on macOS
    const ffmpegCandidates = [
      this.ffmpegPath,
      '/opt/homebrew/bin/ffmpeg',
      '/usr/local/bin/ffmpeg',
      '/usr/bin/ffmpeg',
      path.join(resourcesPath, 'ffmpeg'),
      path.join(resourcesPath, 'bin', 'ffmpeg')
    ];
    const ffprobeCandidates = [
      this.ffprobePath,
      '/opt/homebrew/bin/ffprobe',
      '/usr/local/bin/ffprobe',
      '/usr/bin/ffprobe',
      path.join(resourcesPath, 'ffprobe'),
      path.join(resourcesPath, 'bin', 'ffprobe')
    ];

    this.ffmpegPath = this.pickFirstExisting(ffmpegCandidates, 'ffmpeg');
    this.ffprobePath = this.pickFirstExisting(ffprobeCandidates, 'ffprobe');

    // Whisper CLI candidates
    const whisperCandidates = [
      this.whisperExecutablePath,
      path.join(resourcesPath, 'whisper-cli'),
      path.join(resourcesPath, 'bin', 'whisper-cli'),
      'whisper-cli',
      'whisper'
    ];
    this.whisperExecutablePath = this.pickFirstExisting(whisperCandidates, 'whisper-cli', false);

    // Whisper model path candidates (bundle under assets/models if provided)
    const modelCandidates = [
      this.whisperModelPath,
      path.join(resourcesPath, 'assets', 'models', 'ggml-base.en.bin'),
      path.join(app.getPath('userData'), 'models', 'ggml-base.en.bin')
    ];
    this.whisperModelPath = this.pickFirstExisting(modelCandidates, 'whisper model', false);
  }

  private pickFirstExisting(candidates: string[], label: string, mustExist: boolean = true): string {
    for (const candidate of candidates) {
      try {
        if (!candidate) continue;
        // If path contains a slash, check existence; otherwise trust PATH resolution at spawn time
        if (candidate.includes(path.sep)) {
          if (fs.existsSync(candidate)) return candidate;
        } else {
          // Simple heuristic: allow bare command name; spawn will resolve via PATH
          return candidate;
        }
      } catch {}
    }
    if (mustExist) {
      console.warn(`⚠️ [AUDIO] No ${label} found in candidates: ${candidates.join(', ')}`);
    }
    // Return first as fallback (may be bare command)
    return candidates[0];
  }

  /**
   * Check if required dependencies are available
   */
  private async checkDependencies(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if FFmpeg is available
      const ffmpeg = spawn(this.ffmpegPath, ['-version']);
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          console.log('FFmpeg is available');
          // Check whisper executable
          const whisperProc = spawn(this.whisperExecutablePath, ['--help']);
          whisperProc.on('close', (wCode) => {
            if (wCode === 0) {
              console.log('whisper-cli binary available');
              // Check model path
              if (!this.whisperModelPath || !fs.existsSync(this.whisperModelPath)) {
                reject(new Error(`Whisper model not found at ${this.whisperModelPath}. Configure WHISPER_MODEL_PATH or place model under assets/models`));
              } else {
                resolve();
              }
            } else {
              reject(new Error('whisper-cli binary not found or not executable'));
            }
          });
          whisperProc.on('error', (err) => {
            reject(new Error(`whisper-cli check failed: ${err.message}`));
          });
        } else {
          reject(new Error(`FFmpeg is not installed or not accessible at ${this.ffmpegPath}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg check failed: ${error.message}`));
      });
    });
  }

  /**
   * Check available audio devices
   */
  private async checkAudioDevices(): Promise<void> {
    return new Promise((resolve, reject) => {
      // List audio devices using FFmpeg
      const ffmpeg = spawn(this.ffmpegPath, ['-f', 'avfoundation', '-list_devices', 'true', '-i', '']);
      
      let output = '';
      ffmpeg.stderr.on('data', (data) => {
        output += data.toString();
      });
      
      ffmpeg.on('close', () => {
        console.log('Available audio devices:', output);
        
        // Check if Blackhole is available for internal audio capture
        if (output.includes('BlackHole')) {
          console.log('BlackHole audio driver detected');
        } else {
          console.warn('BlackHole audio driver not detected. Internal audio capture may not work.');
        }
        
        resolve();
      });
      
      ffmpeg.on('error', (error) => {
        console.warn('Could not list audio devices:', error.message);
        resolve(); // Don't fail initialization for this
      });
    });
  }

  /**
   * Start recording audio from specified source
   */
  async startRecording(source: AudioSource, sessionId: string): Promise<void> {
    console.log(`🎤 [AUDIO] Starting recording for session ${sessionId} with source ${source}`);
    
    if (!this.isInitialized) {
      console.error('🎤 [AUDIO] Audio service not initialized');
      throw new Error('Audio service not initialized');
    }

    // Stop existing recording for this session if any
    if (this.recordings.has(sessionId)) {
      console.log(`🎤 [AUDIO] Stopping existing recording for session ${sessionId}`);
      await this.stopRecording(sessionId);
    }

    try {
      const outputFile = path.join(this.tempDir, `${sessionId}-${Date.now()}.wav`);
      const recording: AudioRecording = {
        sessionId,
        source,
        process: null,
        outputFile,
        isActive: false,
        startTime: new Date(),
        segments: [],
        accumulatedTranscription: '' // Initialize empty accumulated transcription
      };

      // Configure FFmpeg command based on source
      const ffmpegArgs = this.buildFFmpegArgs(source, outputFile);
      
      console.log(`🎤 [AUDIO] Starting audio recording for session ${sessionId} from ${source}`);
      console.log('🎤 [AUDIO] FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));
      console.log(`🎤 [AUDIO] Output file: ${outputFile}`);
      console.log(`🎤 [AUDIO] Temp directory: ${this.tempDir}`);
      
      const ffmpegProcess = spawn(this.ffmpegPath, ffmpegArgs);
      recording.process = ffmpegProcess;
      recording.isActive = true;

      // Handle process events with enhanced error handling
      ffmpegProcess.stdout.on('data', (data) => {
        console.log(`🎤 [AUDIO] FFmpeg stdout: ${data.toString()}`);
      });
      
      ffmpegProcess.stderr.on('data', (data) => {
        const output = data.toString();
        console.log(`🎤 [AUDIO] FFmpeg stderr: ${output}`);
        
        if (output.includes('size=') || output.includes('time=')) {
          // This is normal FFmpeg progress output
          console.log(`🎤 [AUDIO] Recording progress: ${output.trim()}`);
        } else if (output.includes('error') || output.includes('Error')) {
          console.error(`🎤 [AUDIO] FFmpeg error: ${output}`);
          
          // Handle specific error types
          if (output.includes('Device or resource busy')) {
            console.error('🎤 [AUDIO] Audio device is busy, attempting recovery...');
            this.handleDeviceBusyError(sessionId);
          } else if (output.includes('No such device')) {
            console.error('🎤 [AUDIO] Audio device not found, checking available devices...');
            this.handleDeviceNotFoundError(sessionId);
          } else if (output.includes('Invalid data found')) {
            console.error('🎤 [AUDIO] Invalid audio data - check audio device configuration');
          }
        } else {
          console.log(`🎤 [AUDIO] FFmpeg info: ${output.trim()}`);
        }
      });
      ffmpegProcess.stderr.on('data', (data) => {
        const output = data.toString();
        if (output.includes('size=') || output.includes('time=')) {
          // This is normal FFmpeg progress output
        } else if (output.includes('error') || output.includes('Error')) {
          console.error('FFmpeg error:', output);
          
          // Handle specific error types
          if (output.includes('Device or resource busy')) {
            console.error('Audio device is busy, attempting recovery...');
            this.handleDeviceBusyError(sessionId);
          } else if (output.includes('No such device')) {
            console.error('Audio device not found, checking available devices...');
            this.handleDeviceNotFoundError(sessionId);
          }
        }
      });
      
      ffmpegProcess.on('close', (code) => {
        console.log(`🎤 [AUDIO] Recording process closed with code ${code} for session ${sessionId}`);
        recording.isActive = false;
        
        // Handle unexpected closures
        if (code !== 0 && recording.isActive) {
          console.warn(`🎤 [AUDIO] Recording process exited unexpectedly with code ${code}`);
          this.handleUnexpectedExit(sessionId, code);
        }
      });
      
      ffmpegProcess.on('error', (error) => {
        console.error(`🎤 [AUDIO] Recording process error for session ${sessionId}:`, error);
        recording.isActive = false;
        
        // Attempt recovery based on error type
        this.handleProcessError(sessionId, error);
      });

      this.recordings.set(sessionId, recording);
      
      // Start segment processing
      this.startSegmentProcessing(sessionId);
      
      console.log(`Audio recording started for session: ${sessionId}`);
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error(`Failed to start audio recording: ${error.message}`);
    }
  }

  /**
   * Stop recording for a session and return accumulated transcription
   */
  async stopRecording(sessionId: string): Promise<string | null> {
    const recording = this.recordings.get(sessionId);
    if (!recording) {
      console.warn(`No active recording found for session: ${sessionId}`);
      return null;
    }

    try {
      if (recording.process && recording.isActive) {
        recording.process.kill('SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if (!recording.process.killed) {
          recording.process.kill('SIGKILL');
        }
      }
      
      recording.isActive = false;
      console.log(`🎤 [AUDIO] Recording stopped for session: ${sessionId}`);
      
      // 🚨 CRITICAL FIX: Process any remaining audio from the final segment before returning
      console.log(`🎤 [FINAL] Processing final audio segment for session: ${sessionId}`);
      
      if (recording.outputFile && fs.existsSync(recording.outputFile)) {
        try {
          // Extract and transcribe the final audio segment to capture the last 5-7 seconds
          const finalSegmentFile = path.join(this.tempDir, `final-${sessionId}-${Date.now()}.wav`);
          
          // Extract the last 10 seconds of audio to ensure we capture everything
          await this.extractFinalAudioSegment(recording.outputFile, finalSegmentFile, 10000);
          
          // Transcribe the final segment
          const finalTranscription = await this.transcribeAudioSegment(finalSegmentFile);
          
          if (finalTranscription && finalTranscription.trim().length > 0) {
            // Add final transcription to accumulated transcription
            if (recording.accumulatedTranscription.length > 0) {
              recording.accumulatedTranscription += ' ';
            }
            recording.accumulatedTranscription += finalTranscription;
            
            console.log(`🎤 [FINAL] Added final transcription: "${finalTranscription}"`);
            console.log(`🎤 [FINAL] Complete accumulated transcription: "${recording.accumulatedTranscription}"`);
          }
          
          // Clean up the final segment file
          try {
            fs.unlinkSync(finalSegmentFile);
          } catch (cleanupError) {
            console.warn(`🎤 [FINAL] Failed to clean up final segment file: ${cleanupError}`);
          }
        } catch (error) {
          console.error(`🎤 [FINAL] Error processing final audio segment: ${error}`);
          // Continue with existing accumulated transcription even if final processing fails
        }
      }
      
      // 🎯 RETURN COMPLETE ACCUMULATED TRANSCRIPTION (now includes final segment)
      if (recording.accumulatedTranscription && recording.accumulatedTranscription.trim()) {
        console.log(`🎤 [COMPLETE TRANSCRIPTION] Session ${sessionId}: "${recording.accumulatedTranscription}"`);
        
        // Save the complete transcription before returning
        const completeTranscription = recording.accumulatedTranscription.trim();
        
        // Clean up audio file after successful transcription
        if (recording.outputFile && fs.existsSync(recording.outputFile)) {
          console.log(`🎤 [AUDIO] DEBUG: Preserving audio file for inspection: ${recording.outputFile}`);
          // Could optionally clean up here: fs.unlinkSync(recording.outputFile);
        }
        
        return completeTranscription;
      } else {
        console.warn(`🎤 [AUDIO] No accumulated transcription found for session ${sessionId}`);
        return null;
      }
      
    } catch (error) {
      console.error('Error stopping recording:', error);
      return null;
    } finally {
      this.recordings.delete(sessionId);
    }
  }

  /**
   * Process recorded audio file for transcription
   */
  private async processRecordedAudio(sessionId: string, audioFile: string): Promise<string | null> {
    try {
      console.log(`🎤 [AUDIO] Starting transcription for session ${sessionId}`);
      
      const stats = fs.statSync(audioFile);
      if (stats.size === 0) {
        console.warn(`🎤 [AUDIO] Audio file is empty, skipping transcription`);
        return null;
      }
      
      console.log(`🎤 [AUDIO] Audio file size: ${stats.size} bytes`);
      
      const transcription = await this.transcribeAudioSegment(audioFile);
      
      if (transcription && transcription.trim()) {
        console.log(`🎤 [AUDIO] ✅ Transcription result: \"${transcription}\"`);
        return transcription;
      } else {
        console.warn(`🎤 [AUDIO] No transcription result or empty transcription`);
        return null;
      }
    } catch (error) {
      console.error(`🎤 [AUDIO] Error processing recorded audio:`, error);
      return null;
    } finally {
      // Keep audio file for debugging purposes
      // try {
      //   fs.unlinkSync(audioFile);
      //   console.log(`🎤 [AUDIO] Cleaned up audio file: ${audioFile}`);
      // } catch (cleanupError) {
      //   console.warn(`🎤 [AUDIO] Failed to clean up audio file: ${cleanupError}`);
      // }
      console.log(`🎤 [AUDIO] DEBUG: Preserving audio file for inspection: ${audioFile}`);
    }
  }

  /**
   * Build FFmpeg arguments based on audio source
   */
  private buildFFmpegArgs(source: AudioSource, outputFile: string): string[] {
    const baseArgs = ['-y']; // Overwrite output file
    
    switch (source) {
      case AudioSource.SYSTEM:
        // System audio capture via BlackHole
        return [
          ...baseArgs,
          '-f', 'avfoundation',
          '-i', ':0', // Assumes BlackHole is the first audio device, may need adjustment
          '-ac', '1',
          '-ar', '16000',
          '-acodec', 'pcm_s16le',
          outputFile
        ];
        
      case AudioSource.INTERVIEWEE:
        // Microphone audio capture
        return [
          ...baseArgs,
          '-f', 'avfoundation',
          '-i', ':6', // MacBook Pro Microphone
          '-ac', '1', // Mono
          '-ar', '16000', // 16kHz sample rate
          '-acodec', 'pcm_s16le',
          outputFile
        ];
        
      case AudioSource.BOTH:
        // Both internal and microphone audio (DEBUG: Forcing microphone only to isolate issues)
        console.warn('🎤 [AUDIO] DEBUG: Capturing from MacBook Pro microphone only for debugging');
        return [
          ...baseArgs,
          '-f', 'avfoundation',
          '-i', ':6', // MacBook Pro Microphone
          '-ac', '1', // Mono
          '-ar', '16000', // 16kHz sample rate
          '-acodec', 'pcm_s16le',
          outputFile
        ];
        
      default:
        throw new Error(`Unsupported audio source: ${source}`);
    }
  }

  /**
   * Start processing audio segments for transcription
   */
  private startSegmentProcessing(sessionId: string): void {
    const recording = this.recordings.get(sessionId);
    if (!recording) return;

    const processSegments = () => {
      if (!recording.isActive) return;
      
      // Create a new segment
      const segmentId = `${sessionId}-${Date.now()}`;
      const segmentFile = path.join(this.tempDir, `segment-${segmentId}.wav`);
      
      // Extract last 5 seconds of audio for processing
      this.extractAudioSegment(recording.outputFile, segmentFile, this.segmentDuration)
        .then(() => {
          const segment: AudioSegment = {
            id: segmentId,
            filePath: segmentFile,
            startTime: new Date(),
            duration: this.segmentDuration
          };
          
          recording.segments.push(segment);
          
          // Process segment for transcription (placeholder for now)
          this.processAudioSegment(segment, sessionId);
        })
        .catch(error => {
          console.error('Failed to extract audio segment:', error);
        });
      
      // Schedule next segment processing
      if (recording.isActive) {
        setTimeout(processSegments, this.segmentDuration);
      }
    };

    // Start segment processing after initial delay
    setTimeout(processSegments, this.segmentDuration);
  }

  /**
   * Extract audio segment from main recording
   */
  private async extractAudioSegment(inputFile: string, outputFile: string, duration: number): Promise<void> {
    const MILLISECONDS_TO_SECONDS = 1000;
    const durationSeconds = duration / MILLISECONDS_TO_SECONDS;
    
    try {
      // Get the total duration of the input file
      const totalDuration = await this.getAudioDuration(inputFile);
      
      // Calculate start time for last N seconds
      const startTime = Math.max(0, totalDuration - durationSeconds);
      
      // Extract the audio segment
      await this.runFfmpegExtraction(inputFile, outputFile, startTime, durationSeconds);
    } catch (error) {
      throw new Error(`Audio segment extraction failed: ${(error as Error).message}`);
    }
  }

  /**
   * Extract final audio segment when stopping recording to capture remaining audio
   */
  private async extractFinalAudioSegment(inputFile: string, outputFile: string, durationMs: number): Promise<void> {
    const MILLISECONDS_TO_SECONDS = 1000;
    const durationSeconds = durationMs / MILLISECONDS_TO_SECONDS;
    
    try {
      console.log(`🎤 [FINAL] Extracting final ${durationSeconds} seconds from: ${inputFile}`);
      
      // Get the total duration of the input file
      const totalDuration = await this.getAudioDuration(inputFile);
      
      if (totalDuration <= 0) {
        throw new Error('Audio file has no duration');
      }
      
      // Calculate start time for last N seconds, but don't go negative
      const startTime = Math.max(0, totalDuration - durationSeconds);
      
      // If the file is shorter than the requested duration, extract the whole file
      const actualDuration = Math.min(durationSeconds, totalDuration);
      
      console.log(`🎤 [FINAL] Total duration: ${totalDuration}s, extracting from ${startTime}s for ${actualDuration}s`);
      
      // Extract the final audio segment
      await this.runFfmpegExtraction(inputFile, outputFile, startTime, actualDuration);
      
      // Verify the extracted file exists and has content
      if (!fs.existsSync(outputFile)) {
        throw new Error('Final segment file was not created');
      }
      
      const stats = fs.statSync(outputFile);
      if (stats.size === 0) {
        throw new Error('Final segment file is empty');
      }
      
      console.log(`🎤 [FINAL] Final segment extracted successfully: ${stats.size} bytes`);
    } catch (error) {
      throw new Error(`Final audio segment extraction failed: ${(error as Error).message}`);
    }
  }

  /**
   * Get the duration of an audio file using ffprobe
   */
  private async getAudioDuration(inputFile: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const probeFfmpeg = spawn(this.ffprobePath, [
        '-v', 'quiet',
        '-show_entries', 'format=duration',
        '-of', 'csv=p=0',
        inputFile
      ]);
      
      let durationOutput = '';
      
      probeFfmpeg.stdout.on('data', (data) => {
        durationOutput += data.toString();
      });
      
      probeFfmpeg.stderr.on('data', (data) => {
        console.warn(`FFprobe stderr: ${data.toString()}`);
      });
      
      probeFfmpeg.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFprobe failed with exit code ${code}`));
          return;
        }
        
        const duration = parseFloat(durationOutput.trim());
        if (isNaN(duration) || duration <= 0) {
          reject(new Error(`Invalid audio duration: ${durationOutput.trim()}`));
          return;
        }
        
        resolve(duration);
      });
      
      probeFfmpeg.on('error', (error) => {
        reject(new Error(`FFprobe process error: ${error.message}`));
      });
    });
  }

  /**
   * Run ffmpeg to extract audio segment
   */
  private async runFfmpegExtraction(
    inputFile: string, 
    outputFile: string, 
    startTime: number, 
    duration: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-y', // Overwrite output file
        '-i', inputFile,
        '-ss', startTime.toString(),
        '-t', duration.toString(),
        '-acodec', 'copy', // Copy audio codec without re-encoding
        outputFile
      ];
      
      const ffmpeg = spawn(this.ffmpegPath, ffmpegArgs);
      
      ffmpeg.stderr.on('data', (data) => {
        // FFmpeg outputs progress info to stderr, which is normal
        console.debug(`FFmpeg: ${data.toString()}`);
      });
      
      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`FFmpeg extraction failed with exit code ${code}`));
        }
      });
      
      ffmpeg.on('error', (error) => {
        reject(new Error(`FFmpeg process error: ${error.message}`));
      });
    });
  }

  /**
   * Process audio segment with Whisper transcription - ACCUMULATE, DON'T SEND
   */
  private async processAudioSegment(segment: AudioSegment, sessionId: string): Promise<void> {
    try {
      console.log(`Processing audio segment ${segment.id} for session ${sessionId}`);
      
      // Check if segment file exists and has content
      if (!fs.existsSync(segment.filePath)) {
        console.warn(`Segment file not found: ${segment.filePath}`);
        return;
      }
      
      const stats = fs.statSync(segment.filePath);
      if (stats.size < 1000) { // Less than 1KB, likely empty or too short
        console.log(`Segment too short, skipping transcription: ${segment.filePath}`);
        return;
      }
      
      // Transcribe audio segment using Whisper
      const transcription = await this.transcribeAudioSegment(segment.filePath);
      
      if (transcription && transcription.trim().length > 0) {
        segment.transcription = transcription;
        
        // 🔄 ACCUMULATE TRANSCRIPTION instead of sending immediately
        const recording = this.recordings.get(sessionId);
        if (recording) {
          // Add a space if there's existing transcription
          if (recording.accumulatedTranscription.length > 0) {
            recording.accumulatedTranscription += ' ';
          }
          recording.accumulatedTranscription += transcription;
          
          console.log(`🎤 [ACCUMULATING] Session ${sessionId}: Added "${transcription}"`);
          console.log(`🎤 [ACCUMULATED SO FAR] Session ${sessionId}: "${recording.accumulatedTranscription}"`);
        }
        
        console.log(`✅ Transcription accumulated for segment ${segment.id}: ${transcription.substring(0, 50)}...`);
      } else {
        console.log(`No transcription result for segment ${segment.id}`);
      }
      
      // Clean up segment file after processing
      setTimeout(() => {
        if (fs.existsSync(segment.filePath)) {
          fs.unlinkSync(segment.filePath);
        }
      }, 60000); // Keep for 1 minute
      
    } catch (error) {
      console.error('Failed to process audio segment:', error);
    }
  }

  /**
   * Transcribe audio segment using whisper.cpp CLI
   */
  private async transcribeAudioSegment(audioFilePath: string): Promise<string> {
    try {
      console.log(`🎤 [WHISPER] Starting transcription for: ${audioFilePath}`);
      
      // Check if file exists and has content
      if (!fs.existsSync(audioFilePath)) {
        console.warn(`🎤 [WHISPER] Audio file not found: ${audioFilePath}`);
        return '';
      }
      
      const stats = fs.statSync(audioFilePath);
      console.log(`🎤 [WHISPER] Audio file size: ${stats.size} bytes`);
      
      if (stats.size < 1000) { // Less than 1KB
        console.log(`🎤 [WHISPER] Audio file too small, skipping transcription`);
        return '';
      }
      
      // Invoke whisper-cli for transcription
      const whisperArgs = [
        '--model', this.whisperModelPath,
        '--output-txt',
        '--no-prints',
        '--language', 'auto',
        '--print-colors', 'false',
        audioFilePath  // Input file comes last
      ];

      console.log(`🎤 [WHISPER] Running whisper-cli with args:`, whisperArgs.join(' '));

      const transcriptText: string = await new Promise((resolve, reject) => {
        const proc = spawn(this.whisperExecutablePath, whisperArgs);

        let stdout = '';
        let stderr = '';

        proc.stdout.on('data', (data) => {
          stdout += data.toString();
        });

        proc.stderr.on('data', (data) => {
          stderr += data.toString();
        });

        proc.on('error', (err) => {
          reject(new Error(`Failed to start whisper-cli: ${err.message}`));
        });

        proc.on('close', (code) => {
          if (code !== 0) {
            console.error(`🎤 [WHISPER] whisper-cli exited with code ${code}: ${stderr}`);
            return reject(new Error(`whisper-cli exited with code ${code}`));
          }

          let textOut = stdout.trim();
          // whisper-cli with --output-txt creates a .txt file with the same name as input
          const txtPath = audioFilePath.replace(/\.[^/.]+$/, '.txt'); // Replace extension with .txt
          
          if (!textOut && fs.existsSync(txtPath)) {
            try {
              textOut = fs.readFileSync(txtPath, 'utf8').trim();
              console.log(`🎤 [WHISPER] Read transcription from file: ${txtPath}`);
              
              // Clean up the generated .txt file
              fs.unlinkSync(txtPath);
            } catch (err) {
              console.warn(`🎤 [WHISPER] Failed to read transcription file: ${err}`);
            }
          }
          
          resolve(textOut);
        });
      });

      if (transcriptText && transcriptText.length > 0) {
        // Clean up transcription by removing timestamps and extra formatting
        const cleanedText = this.cleanTranscriptionText(transcriptText);
        
        // IMMEDIATELY print transcription result to console
        console.log(`🎤 [WHISPER] ✅ TRANSCRIPTION SUCCESSFUL: "${cleanedText}"`);
        console.log(`🎤 [WHISPER] Full transcription result: "${cleanedText}"`);
        return cleanedText;
      } else {
        console.log('🎤 [WHISPER] ❌ No transcription result');
        return '';
      }
      
    } catch (error) {
      console.error(`🎤 [WHISPER] Transcription failed:`, error);
      
      return '';
    }
  }

  /**
   * Emit transcription event to main process
   */
  private emitTranscriptionEvent(sessionId: string, transcription: string, segment: AudioSegment): void {
    // Store transcription for retrieval by main process
    const recording = this.recordings.get(sessionId);
    if (recording) {
      // Add to recent transcriptions queue for this session
      if (!recording.recentTranscriptions) {
        recording.recentTranscriptions = [];
      }
      
      recording.recentTranscriptions.push({
        transcription,
        timestamp: segment.startTime,
        segmentId: segment.id
      });
      
      // Keep only last 10 transcriptions to prevent memory buildup
      if (recording.recentTranscriptions.length > 10) {
        recording.recentTranscriptions = recording.recentTranscriptions.slice(-10);
      }
    }
    
    console.log(`Transcription ready for session ${sessionId}: ${transcription}`);
  }

  /**
   * Get recent transcriptions for a session
   */
  getRecentTranscriptions(sessionId: string): Array<{transcription: string; timestamp: Date; segmentId: string}> {
    const recording = this.recordings.get(sessionId);
    if (!recording || !recording.recentTranscriptions) {
      return [];
    }
    
    // Return and clear the transcriptions
    const transcriptions = [...recording.recentTranscriptions];
    recording.recentTranscriptions = [];
    return transcriptions;
  }

  /**
   * Get recording status for a session
   */
  getRecordingStatus(sessionId: string): { isRecording: boolean; source?: AudioSource; startTime?: Date } {
    const recording = this.recordings.get(sessionId);
    if (!recording) {
      return { isRecording: false };
    }
    
    return {
      isRecording: recording.isActive,
      source: recording.source,
      startTime: recording.startTime
    };
  }

  /**
   * Get transcript for a session (legacy method)
   */
  getTranscript(sessionId: string): string {
    const recording = this.recordings.get(sessionId);
    if (!recording) return '';
    
    return recording.segments
      .filter(segment => segment.transcription)
      .map(segment => segment.transcription)
      .join(' ');
  }

  /**
   * Get accumulated transcription for a session (current recording)
   */
  getAccumulatedTranscription(sessionId: string): string {
    const recording = this.recordings.get(sessionId);
    if (!recording) return '';
    
    return recording.accumulatedTranscription || '';
  }

  /**
   * Check if service is ready
   */
  isReady(): boolean {
    return this.isInitialized;
  }

  /**
   * Cleanup all recordings and resources
   */
  async cleanup(): Promise<void> {
    try {
      // Stop all active recordings
      const sessionIds = Array.from(this.recordings.keys());
      for (const sessionId of sessionIds) {
        await this.stopRecording(sessionId);
      }
      
      // Clean up temp directory
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        for (const file of files) {
          const filePath = path.join(this.tempDir, file);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
      }
      
      console.log('Audio Service cleaned up');
    } catch (error) {
      console.error('Audio Service cleanup failed:', error);
    }
  }

  /**
   * Handle device busy error with recovery attempt
   */
  private async handleDeviceBusyError(sessionId: string): Promise<void> {
    console.log(`Attempting to recover from device busy error for session: ${sessionId}`);
    
    const recording = this.recordings.get(sessionId);
    if (!recording) return;
    
    try {
      // Wait a moment and try to restart recording
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Stop current recording attempt
      await this.stopRecording(sessionId);
      
      // Wait another moment before retry
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Attempt to restart with same source
      await this.startRecording(recording.source, sessionId);
      
      console.log(`Successfully recovered from device busy error for session: ${sessionId}`);
    } catch (error) {
      console.error(`Failed to recover from device busy error for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle device not found error
   */
  private async handleDeviceNotFoundError(sessionId: string): Promise<void> {
    console.log(`Handling device not found error for session: ${sessionId}`);
    
    try {
      // Re-check available devices
      await this.checkAudioDevices();
      
      const recording = this.recordings.get(sessionId);
      if (!recording) return;
      
      // If it was trying to use BlackHole, suggest fallback to microphone
      if (recording.source === AudioSource.INTERVIEWER || recording.source === AudioSource.BOTH) {
        console.warn('BlackHole device not available, consider installing BlackHole audio driver');
      }
      
    } catch (error) {
      console.error(`Failed to handle device not found error for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle unexpected process exit
   */
  private async handleUnexpectedExit(sessionId: string, exitCode: number): Promise<void> {
    console.log(`Handling unexpected exit (code: ${exitCode}) for session: ${sessionId}`);
    
    const recording = this.recordings.get(sessionId);
    if (!recording) return;
    
    try {
      // Clean up the failed recording
      recording.isActive = false;
      
      // Attempt automatic restart if exit code suggests recoverable error
      if (exitCode === 1 || exitCode === 255) { // Common recoverable FFmpeg errors
        console.log(`Attempting automatic restart for session: ${sessionId}`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Try to restart recording
        await this.startRecording(recording.source, sessionId);
        
        console.log(`Successfully restarted recording for session: ${sessionId}`);
      } else {
        console.warn(`Non-recoverable exit code ${exitCode}, manual restart required`);
      }
      
    } catch (error) {
      console.error(`Failed to handle unexpected exit for session ${sessionId}:`, error);
    }
  }

  /**
   * Handle general process errors
   */
  private async handleProcessError(sessionId: string, error: Error): Promise<void> {
    console.log(`Handling process error for session: ${sessionId}`, error.message);
    
    const recording = this.recordings.get(sessionId);
    if (!recording) return;
    
    try {
      // Clean up the failed recording
      recording.isActive = false;
      
      // Determine if error is recoverable
      const isRecoverable = this.isRecoverableError(error);
      
      if (isRecoverable) {
        console.log(`Attempting recovery for recoverable error in session: ${sessionId}`);
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Try to restart recording
        await this.startRecording(recording.source, sessionId);
        
        console.log(`Successfully recovered from process error for session: ${sessionId}`);
      } else {
        console.error(`Non-recoverable error for session ${sessionId}, manual intervention required`);
      }
      
    } catch (recoveryError) {
      console.error(`Failed to recover from process error for session ${sessionId}:`, recoveryError);
    }
  }

  /**
   * Determine if an error is recoverable
   */
  private isRecoverableError(error: Error): boolean {
    const recoverableErrors = [
      'ENOENT', // File not found (temporary)
      'EACCES', // Permission denied (might be temporary)
      'EAGAIN', // Resource temporarily unavailable
      'EBUSY',  // Device busy
      'EINTR'   // Interrupted system call
    ];
    
    return recoverableErrors.some(errorCode => 
      error.message.includes(errorCode) || error.name === errorCode
    );
  }

  /**
   * Clean transcription text by removing timestamps, ANSI color codes, and formatting
   */
  private cleanTranscriptionText(text: string): string {
    let cleaned = text;
    
    // Remove ANSI color codes (like [38;5;160m, [0m, etc.)
    cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, ''); // Standard ANSI codes
    cleaned = cleaned.replace(/\[\d+;\d+;\d+m/g, ''); // 256-color codes like [38;5;160m
    cleaned = cleaned.replace(/\[\d+m/g, ''); // Simple codes like [0m
    cleaned = cleaned.replace(/\[0m/g, ''); // Reset codes
    
    // Remove timestamp patterns like [00:00:00.000 --> 00:00:02.000]
    cleaned = cleaned.replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]/g, '');
    
    // Remove WebVTT style timestamps like 00:00:00.000 --> 00:00:02.000
    cleaned = cleaned.replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, '');
    
    // Remove whisper-style timestamps like [00:00.000 --> 00:02.000]
    cleaned = cleaned.replace(/\[\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}\.\d{3}\]/g, '');
    
    // Remove simple timestamps like [0.00s -> 2.00s]
    cleaned = cleaned.replace(/\[\d+\.\d+s\s*->\s*\d+\.\d+s\]/g, '');
    
    // Remove WEBVTT header if present
    cleaned = cleaned.replace(/^WEBVTT\s*/gi, '');
    
    // Remove speaker labels like "Speaker 1:" or "[Speaker 1]"
    cleaned = cleaned.replace(/\[?Speaker\s+\d+\]?\s*:?\s*/gi, '');
    
    // Remove confidence scores like (confidence: 0.95) or [95.5%]
    cleaned = cleaned.replace(/\(confidence:\s*\d+\.\d+\)/gi, '');
    cleaned = cleaned.replace(/\[\d+\.\d+%\]/g, '');
    
    // Remove multiple consecutive spaces
    cleaned = cleaned.replace(/\s+/g, ' ');
    
    // Remove leading/trailing quotes if present
    cleaned = cleaned.replace(/^["']+|["']+$/g, '');
    
    // Remove leading/trailing whitespace
    cleaned = cleaned.trim();
    
    // Remove empty lines and normalize
    cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();
    
    return cleaned;
  }

  /**
   * Get service status with error information
   */
  getStatus(): any {
    return {
      initialized: this.isInitialized,
      activeRecordings: this.recordings.size,
      tempDir: this.tempDir,
      recordings: Array.from(this.recordings.entries()).map(([sessionId, recording]) => ({
        sessionId,
        source: recording.source,
        isActive: recording.isActive,
        startTime: recording.startTime,
        segmentCount: recording.segments.length,
        hasRecentTranscriptions: (recording.recentTranscriptions?.length || 0) > 0
      }))
    };
  }

  // ========================================
  // AUTO RECORDER MODE METHODS
  // ========================================

  /**
   * Start auto recorder mode - continuous recording until explicitly stopped
   */
  async startAutoRecorder(sessionId: string, source: AudioSource = AudioSource.SYSTEM): Promise<void> {
    console.log(`🔄 [AUTO RECORDER] Starting auto recorder mode for session ${sessionId} with source ${source}`);
    
    if (this.autoRecorderActive) {
      console.warn('🔄 [AUTO RECORDER] Auto recorder already active, stopping previous session');
      await this.stopAutoRecorder();
    }
    
    this.autoRecorderActive = true;
    this.autoRecorderSessionId = sessionId;
    this.autoRecorderSource = source;
    this.autoRecorderTranscription = '';
    
    // Start continuous recording using existing startRecording method
    await this.startRecording(source, sessionId);
    
    console.log(`✅ [AUTO RECORDER] Auto recorder mode started for session ${sessionId}`);
  }

  /**
   * Stop auto recorder mode
   */
  async stopAutoRecorder(): Promise<string | null> {
    console.log('🔄 [AUTO RECORDER] Stopping auto recorder mode');
    
    if (!this.autoRecorderActive || !this.autoRecorderSessionId) {
      console.warn('🔄 [AUTO RECORDER] No active auto recorder session');
      return null;
    }
    
    const sessionId = this.autoRecorderSessionId;
    
    // Stop the continuous recording
    const finalTranscription = await this.stopRecording(sessionId);
    
    // Get complete accumulated transcription
    const completeTranscription = this.autoRecorderTranscription + (finalTranscription ? ' ' + finalTranscription : '');
    
    // Reset auto recorder state
    this.autoRecorderActive = false;
    this.autoRecorderSessionId = null;
    this.autoRecorderTranscription = '';
    
    console.log(`✅ [AUTO RECORDER] Auto recorder mode stopped, final transcription: "${completeTranscription}"`);
    return completeTranscription?.trim() || null;
  }

  /**
   * Send current accumulated transcription (triggered by Cmd+S)
   */
  getCurrentAutoRecorderTranscription(): string {
    if (!this.autoRecorderActive || !this.autoRecorderSessionId) {
      console.warn('🔄 [AUTO RECORDER] No active auto recorder session');
      return '';
    }
    
    // Get accumulated transcription from the active recording
    const recording = this.recordings.get(this.autoRecorderSessionId);
    if (!recording) {
      console.warn('🔄 [AUTO RECORDER] No active recording found');
      return this.autoRecorderTranscription;
    }
    
    const currentTranscription = recording.accumulatedTranscription || '';
    console.log(`🔄 [AUTO RECORDER] Current transcription: "${currentTranscription}"`);
    
    return currentTranscription;
  }

  /**
   * Reset accumulated transcription context (after sending to LLM)
   */
  resetAutoRecorderTranscription(): void {
    if (!this.autoRecorderActive || !this.autoRecorderSessionId) {
      console.warn('🔄 [AUTO RECORDER] No active auto recorder session');
      return;
    }
    
    // Reset the accumulated transcription in the active recording
    const recording = this.recordings.get(this.autoRecorderSessionId);
    if (recording) {
      recording.accumulatedTranscription = '';
    }
    
    this.autoRecorderTranscription = '';
    
    console.log('🔄 [AUTO RECORDER] Transcription context reset');
  }

  /**
   * Check if auto recorder is currently active
   */
  isAutoRecorderActive(): boolean {
    return this.autoRecorderActive;
  }

  /**
   * Get auto recorder status
   */
  getAutoRecorderStatus(): {
    active: boolean;
    sessionId: string | null;
    source: AudioSource;
    currentTranscription: string;
  } {
    return {
      active: this.autoRecorderActive,
      sessionId: this.autoRecorderSessionId,
      source: this.autoRecorderSource,
      currentTranscription: this.getCurrentAutoRecorderTranscription()
    };
  }

  /**
   * Wait for any pending transcription segment to complete before processing Cmd+S
   * This ensures we capture the last 5-second segment that might still be processing
   * 
   * IMPROVED: Always processes current audio regardless of duration, even if < 5 seconds
   */
  async waitForPendingTranscription(): Promise<void> {
    if (!this.autoRecorderActive || !this.autoRecorderSessionId) {
      console.log('🔄 [AUTO RECORDER] No active auto recorder, no pending transcription to wait for');
      return;
    }

    const recording = this.recordings.get(this.autoRecorderSessionId);
    if (!recording || !recording.isActive) {
      console.log('🔄 [AUTO RECORDER] No active recording, no pending transcription to wait for');
      return;
    }

    console.log('🔄 [AUTO RECORDER] Processing current audio for immediate transcription...');

    // Strategy 1: Extract and process ALL current audio immediately, regardless of duration
    // This ensures we capture ANY speech that's currently in the buffer, even if < 5 seconds
    try {
      const now = new Date();
      const segmentId = `cmd-s-${this.autoRecorderSessionId}-${now.getTime()}`;
      const segmentFile = path.join(this.tempDir, `segment-${segmentId}.wav`);
      
      // Calculate duration since recording started
      const recordingDuration = now.getTime() - recording.startTime.getTime();
      console.log(`🔄 [AUTO RECORDER] Total recording duration so far: ${recordingDuration}ms`);
      
      if (recordingDuration < 1000) {
        console.log('🔄 [AUTO RECORDER] Recording just started (< 1 second), may not have enough audio data yet');
        // Continue anyway - we'll try to process whatever is available
      }

      // Extract ALL audio recorded so far
      // This is different from the segment processing which only does 5-second chunks
      if (fs.existsSync(recording.outputFile)) {
        const stats = fs.statSync(recording.outputFile);
        console.log(`🔄 [AUTO RECORDER] Current recording file size: ${stats.size} bytes`);
        
        if (stats.size < 1000) {
          console.log('🔄 [AUTO RECORDER] Recording file too small, trying to wait briefly for more data...');
          // Wait a moment to let some audio accumulate
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        // Copy the entire current recording file to process it
        try {
          fs.copyFileSync(recording.outputFile, segmentFile);
          console.log(`🔄 [AUTO RECORDER] Copied current recording for processing: ${segmentFile}`);
        } catch (copyError) {
          console.error(`🔄 [AUTO RECORDER] Error copying recording file: ${copyError}`);
          // Try the traditional segment extraction as fallback
          await this.extractAudioSegment(recording.outputFile, segmentFile, Math.max(1000, recordingDuration));
          console.log('🔄 [AUTO RECORDER] Used fallback extraction method');
        }
      } else {
        console.log(`🔄 [AUTO RECORDER] Recording file doesn't exist yet: ${recording.outputFile}`);
        return; // Can't process non-existent file
      }
      
      // Check if the extracted file has meaningful content
      if (fs.existsSync(segmentFile)) {
        const stats = fs.statSync(segmentFile);
        console.log(`🔄 [AUTO RECORDER] Extracted file size: ${stats.size} bytes`);
        
        if (stats.size >= 1000) { // At least 1KB, indicating some audio content
          console.log('🔄 [AUTO RECORDER] Processing current audio for Cmd+S...');
          
          // Transcribe the current audio immediately
          const pendingTranscription = await this.transcribeAudioSegment(segmentFile);
          
          if (pendingTranscription && pendingTranscription.trim().length > 0) {
            // Add to accumulated transcription immediately
            if (recording.accumulatedTranscription.length > 0) {
              recording.accumulatedTranscription += ' ';
            }
            recording.accumulatedTranscription += pendingTranscription;
            
            console.log(`🔄 [AUTO RECORDER] Added current transcription: "${pendingTranscription}"`);
            console.log(`🔄 [AUTO RECORDER] Complete transcription now: "${recording.accumulatedTranscription}"`);
          } else {
            console.log('🔄 [AUTO RECORDER] No transcription content in current audio');
          }
        } else {
          console.log('🔄 [AUTO RECORDER] Current audio file too small, likely no speech yet');
        }
        
        // Clean up the temporary file
        try {
          fs.unlinkSync(segmentFile);
        } catch (cleanupError) {
          console.warn(`🔄 [AUTO RECORDER] Failed to clean up audio file: ${cleanupError}`);
        }
      } else {
        console.log('🔄 [AUTO RECORDER] No audio file created for processing');
      }
      
      console.log('🔄 [AUTO RECORDER] Current audio processing complete');
    } catch (error) {
      console.error(`🔄 [AUTO RECORDER] Error processing current audio: ${error}`);
      // Continue anyway - we'll use whatever transcription is already available
    }
  }
}
