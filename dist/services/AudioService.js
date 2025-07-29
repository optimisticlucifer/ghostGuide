"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioService = exports.TranscriptionError = exports.AudioDeviceError = exports.AudioServiceError = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
const types_1 = require("../types");
// Whisper transcription will be handled via whisper.cpp CLI invocation
// Custom error types for better error handling
class AudioServiceError extends Error {
    constructor(message, code, cause) {
        super(message);
        this.code = code;
        this.cause = cause;
        this.name = 'AudioServiceError';
    }
}
exports.AudioServiceError = AudioServiceError;
class AudioDeviceError extends AudioServiceError {
    constructor(message, cause) {
        super(message, 'AUDIO_DEVICE_ERROR', cause);
    }
}
exports.AudioDeviceError = AudioDeviceError;
class TranscriptionError extends AudioServiceError {
    constructor(message, cause) {
        super(message, 'TRANSCRIPTION_ERROR', cause);
    }
}
exports.TranscriptionError = TranscriptionError;
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
    MODEL_PATH: '/Users/rohanbharti/tools/ggml-large-v3-turbo.bin' // default model path
};
class AudioService {
    constructor() {
        this.recordings = new Map();
        this.segmentDuration = 5000; // 5 seconds in milliseconds
        this.isInitialized = false;
        this.tempDir = path.join(os.tmpdir(), 'interview-assistant-audio');
        this.ensureTempDirectory();
    }
    ensureTempDirectory() {
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }
    /**
     * Initialize audio service and check dependencies
     */
    async initialize() {
        try {
            await this.checkDependencies();
            await this.checkAudioDevices();
            this.isInitialized = true;
            console.log('Audio Service initialized successfully');
        }
        catch (error) {
            console.error('Failed to initialize Audio Service:', error);
            throw new Error('Audio Service initialization failed');
        }
    }
    /**
     * Check if required dependencies are available
     */
    async checkDependencies() {
        return new Promise((resolve, reject) => {
            // Check if FFmpeg is available
            const ffmpeg = (0, child_process_1.spawn)('ffmpeg', ['-version']);
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    console.log('FFmpeg is available');
                    // Check whisper executable
                    const whisperProc = (0, child_process_1.spawn)(AUDIO_CONFIG.WHISPER_EXECUTABLE, ['--help']);
                    whisperProc.on('close', (wCode) => {
                        if (wCode === 0) {
                            console.log('whisper-cli binary available');
                            // Check model path
                            if (!fs.existsSync(AUDIO_CONFIG.MODEL_PATH)) {
                                reject(new Error(`Whisper model not found at ${AUDIO_CONFIG.MODEL_PATH}`));
                            }
                            else {
                                resolve();
                            }
                        }
                        else {
                            reject(new Error('whisper-cli binary not found or not executable'));
                        }
                    });
                    whisperProc.on('error', (err) => {
                        reject(new Error(`whisper-cli check failed: ${err.message}`));
                    });
                }
                else {
                    reject(new Error('FFmpeg is not installed or not in PATH'));
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
    async checkAudioDevices() {
        return new Promise((resolve, reject) => {
            // List audio devices using FFmpeg
            const ffmpeg = (0, child_process_1.spawn)('ffmpeg', ['-f', 'avfoundation', '-list_devices', 'true', '-i', '']);
            let output = '';
            ffmpeg.stderr.on('data', (data) => {
                output += data.toString();
            });
            ffmpeg.on('close', () => {
                console.log('Available audio devices:', output);
                // Check if Blackhole is available for internal audio capture
                if (output.includes('BlackHole')) {
                    console.log('BlackHole audio driver detected');
                }
                else {
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
    async startRecording(source, sessionId) {
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
            const recording = {
                sessionId,
                source,
                process: null,
                outputFile,
                isActive: false,
                startTime: new Date(),
                segments: []
            };
            // Configure FFmpeg command based on source
            const ffmpegArgs = this.buildFFmpegArgs(source, outputFile);
            console.log(`🎤 [AUDIO] Starting audio recording for session ${sessionId} from ${source}`);
            console.log('🎤 [AUDIO] FFmpeg command:', 'ffmpeg', ffmpegArgs.join(' '));
            console.log(`🎤 [AUDIO] Output file: ${outputFile}`);
            console.log(`🎤 [AUDIO] Temp directory: ${this.tempDir}`);
            const ffmpegProcess = (0, child_process_1.spawn)('ffmpeg', ffmpegArgs);
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
                }
                else if (output.includes('error') || output.includes('Error')) {
                    console.error(`🎤 [AUDIO] FFmpeg error: ${output}`);
                    // Handle specific error types
                    if (output.includes('Device or resource busy')) {
                        console.error('🎤 [AUDIO] Audio device is busy, attempting recovery...');
                        this.handleDeviceBusyError(sessionId);
                    }
                    else if (output.includes('No such device')) {
                        console.error('🎤 [AUDIO] Audio device not found, checking available devices...');
                        this.handleDeviceNotFoundError(sessionId);
                    }
                    else if (output.includes('Invalid data found')) {
                        console.error('🎤 [AUDIO] Invalid audio data - check audio device configuration');
                    }
                }
                else {
                    console.log(`🎤 [AUDIO] FFmpeg info: ${output.trim()}`);
                }
            });
            ffmpegProcess.stderr.on('data', (data) => {
                const output = data.toString();
                if (output.includes('size=') || output.includes('time=')) {
                    // This is normal FFmpeg progress output
                }
                else if (output.includes('error') || output.includes('Error')) {
                    console.error('FFmpeg error:', output);
                    // Handle specific error types
                    if (output.includes('Device or resource busy')) {
                        console.error('Audio device is busy, attempting recovery...');
                        this.handleDeviceBusyError(sessionId);
                    }
                    else if (output.includes('No such device')) {
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
        }
        catch (error) {
            console.error('Failed to start recording:', error);
            throw new Error(`Failed to start audio recording: ${error.message}`);
        }
    }
    /**
     * Stop recording for a session
     */
    async stopRecording(sessionId) {
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
            console.log(`Audio recording stopped for session: ${sessionId}`);
            if (recording.outputFile && fs.existsSync(recording.outputFile)) {
                console.log(`🎤 [AUDIO] Processing recorded audio for transcription: ${recording.outputFile}`);
                const transcription = await this.processRecordedAudio(sessionId, recording.outputFile);
                return transcription;
            }
            else {
                console.warn(`🎤 [AUDIO] No audio file found for transcription: ${recording.outputFile}`);
                return null;
            }
        }
        catch (error) {
            console.error('Error stopping recording:', error);
            return null;
        }
        finally {
            this.recordings.delete(sessionId);
        }
    }
    /**
     * Process recorded audio file for transcription
     */
    async processRecordedAudio(sessionId, audioFile) {
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
            }
            else {
                console.warn(`🎤 [AUDIO] No transcription result or empty transcription`);
                return null;
            }
        }
        catch (error) {
            console.error(`🎤 [AUDIO] Error processing recorded audio:`, error);
            return null;
        }
        finally {
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
    buildFFmpegArgs(source, outputFile) {
        const baseArgs = ['-y']; // Overwrite output file
        switch (source) {
            case types_1.AudioSource.SYSTEM:
                // System audio capture via BlackHole
                return [
                    ...baseArgs,
                    '-f', 'avfoundation',
                    '-i', ':0', // BlackHole 2ch
                    '-ac', '1', // Mono
                    '-ar', '16000', // 16kHz sample rate
                    '-acodec', 'pcm_s16le',
                    outputFile
                ];
            case types_1.AudioSource.INTERVIEWEE:
                // Microphone audio capture
                return [
                    ...baseArgs,
                    '-f', 'avfoundation',
                    '-i', ':2', // MacBook Pro Microphone
                    '-ac', '1', // Mono
                    '-ar', '16000', // 16kHz sample rate
                    '-acodec', 'pcm_s16le',
                    outputFile
                ];
            case types_1.AudioSource.BOTH:
                // Both internal and microphone audio (DEBUG: Forcing microphone only to isolate issues)
                console.warn('🎤 [AUDIO] DEBUG: Capturing from MacBook Pro microphone only for debugging');
                return [
                    ...baseArgs,
                    '-f', 'avfoundation',
                    '-i', ':2', // MacBook Pro Microphone
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
    startSegmentProcessing(sessionId) {
        const recording = this.recordings.get(sessionId);
        if (!recording)
            return;
        const processSegments = () => {
            if (!recording.isActive)
                return;
            // Create a new segment
            const segmentId = `${sessionId}-${Date.now()}`;
            const segmentFile = path.join(this.tempDir, `segment-${segmentId}.wav`);
            // Extract last 5 seconds of audio for processing
            this.extractAudioSegment(recording.outputFile, segmentFile, this.segmentDuration)
                .then(() => {
                const segment = {
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
    async extractAudioSegment(inputFile, outputFile, duration) {
        const MILLISECONDS_TO_SECONDS = 1000;
        const durationSeconds = duration / MILLISECONDS_TO_SECONDS;
        try {
            // Get the total duration of the input file
            const totalDuration = await this.getAudioDuration(inputFile);
            // Calculate start time for last N seconds
            const startTime = Math.max(0, totalDuration - durationSeconds);
            // Extract the audio segment
            await this.runFfmpegExtraction(inputFile, outputFile, startTime, durationSeconds);
        }
        catch (error) {
            throw new Error(`Audio segment extraction failed: ${error.message}`);
        }
    }
    /**
     * Get the duration of an audio file using ffprobe
     */
    async getAudioDuration(inputFile) {
        return new Promise((resolve, reject) => {
            const probeFfmpeg = (0, child_process_1.spawn)('ffprobe', [
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
    async runFfmpegExtraction(inputFile, outputFile, startTime, duration) {
        return new Promise((resolve, reject) => {
            const ffmpegArgs = [
                '-y', // Overwrite output file
                '-i', inputFile,
                '-ss', startTime.toString(),
                '-t', duration.toString(),
                '-acodec', 'copy', // Copy audio codec without re-encoding
                outputFile
            ];
            const ffmpeg = (0, child_process_1.spawn)('ffmpeg', ffmpegArgs);
            ffmpeg.stderr.on('data', (data) => {
                // FFmpeg outputs progress info to stderr, which is normal
                console.debug(`FFmpeg: ${data.toString()}`);
            });
            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                }
                else {
                    reject(new Error(`FFmpeg extraction failed with exit code ${code}`));
                }
            });
            ffmpeg.on('error', (error) => {
                reject(new Error(`FFmpeg process error: ${error.message}`));
            });
        });
    }
    /**
     * Process audio segment with Whisper transcription
     */
    async processAudioSegment(segment, sessionId) {
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
                // 1. IMMEDIATELY print full transcription to console
                console.log(`🎤 [SEGMENT TRANSCRIPTION COMPLETED] Session ${sessionId}, Segment ${segment.id}: "${transcription}"`);
                // 2. Emit transcription event to main process for UI update and LLM processing
                this.emitTranscriptionEvent(sessionId, transcription, segment);
                console.log(`✅ Transcription completed for segment ${segment.id}: ${transcription.substring(0, 50)}...`);
            }
            else {
                console.log(`No transcription result for segment ${segment.id}`);
            }
            // Clean up segment file after processing
            setTimeout(() => {
                if (fs.existsSync(segment.filePath)) {
                    fs.unlinkSync(segment.filePath);
                }
            }, 60000); // Keep for 1 minute
        }
        catch (error) {
            console.error('Failed to process audio segment:', error);
        }
    }
    /**
     * Transcribe audio segment using whisper.cpp CLI
     */
    async transcribeAudioSegment(audioFilePath) {
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
                '--model', AUDIO_CONFIG.MODEL_PATH,
                '--output-txt',
                '--no-prints',
                '--language', 'auto',
                '--print-colors', 'false',
                audioFilePath // Input file comes last
            ];
            console.log(`🎤 [WHISPER] Running whisper-cli with args:`, whisperArgs.join(' '));
            const transcriptText = await new Promise((resolve, reject) => {
                const proc = (0, child_process_1.spawn)(AUDIO_CONFIG.WHISPER_EXECUTABLE, whisperArgs);
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
                        }
                        catch (err) {
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
            }
            else {
                console.log('🎤 [WHISPER] ❌ No transcription result');
                return '';
            }
        }
        catch (error) {
            console.error(`🎤 [WHISPER] Transcription failed:`, error);
            return '';
        }
    }
    /**
     * Emit transcription event to main process
     */
    emitTranscriptionEvent(sessionId, transcription, segment) {
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
    getRecentTranscriptions(sessionId) {
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
    getRecordingStatus(sessionId) {
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
     * Get transcript for a session
     */
    getTranscript(sessionId) {
        const recording = this.recordings.get(sessionId);
        if (!recording)
            return '';
        return recording.segments
            .filter(segment => segment.transcription)
            .map(segment => segment.transcription)
            .join(' ');
    }
    /**
     * Check if service is ready
     */
    isReady() {
        return this.isInitialized;
    }
    /**
     * Cleanup all recordings and resources
     */
    async cleanup() {
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
        }
        catch (error) {
            console.error('Audio Service cleanup failed:', error);
        }
    }
    /**
     * Handle device busy error with recovery attempt
     */
    async handleDeviceBusyError(sessionId) {
        console.log(`Attempting to recover from device busy error for session: ${sessionId}`);
        const recording = this.recordings.get(sessionId);
        if (!recording)
            return;
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
        }
        catch (error) {
            console.error(`Failed to recover from device busy error for session ${sessionId}:`, error);
        }
    }
    /**
     * Handle device not found error
     */
    async handleDeviceNotFoundError(sessionId) {
        console.log(`Handling device not found error for session: ${sessionId}`);
        try {
            // Re-check available devices
            await this.checkAudioDevices();
            const recording = this.recordings.get(sessionId);
            if (!recording)
                return;
            // If it was trying to use BlackHole, suggest fallback to microphone
            if (recording.source === types_1.AudioSource.INTERVIEWER || recording.source === types_1.AudioSource.BOTH) {
                console.warn('BlackHole device not available, consider installing BlackHole audio driver');
            }
        }
        catch (error) {
            console.error(`Failed to handle device not found error for session ${sessionId}:`, error);
        }
    }
    /**
     * Handle unexpected process exit
     */
    async handleUnexpectedExit(sessionId, exitCode) {
        console.log(`Handling unexpected exit (code: ${exitCode}) for session: ${sessionId}`);
        const recording = this.recordings.get(sessionId);
        if (!recording)
            return;
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
            }
            else {
                console.warn(`Non-recoverable exit code ${exitCode}, manual restart required`);
            }
        }
        catch (error) {
            console.error(`Failed to handle unexpected exit for session ${sessionId}:`, error);
        }
    }
    /**
     * Handle general process errors
     */
    async handleProcessError(sessionId, error) {
        console.log(`Handling process error for session: ${sessionId}`, error.message);
        const recording = this.recordings.get(sessionId);
        if (!recording)
            return;
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
            }
            else {
                console.error(`Non-recoverable error for session ${sessionId}, manual intervention required`);
            }
        }
        catch (recoveryError) {
            console.error(`Failed to recover from process error for session ${sessionId}:`, recoveryError);
        }
    }
    /**
     * Determine if an error is recoverable
     */
    isRecoverableError(error) {
        const recoverableErrors = [
            'ENOENT', // File not found (temporary)
            'EACCES', // Permission denied (might be temporary)
            'EAGAIN', // Resource temporarily unavailable
            'EBUSY', // Device busy
            'EINTR' // Interrupted system call
        ];
        return recoverableErrors.some(errorCode => error.message.includes(errorCode) || error.name === errorCode);
    }
    /**
     * Clean transcription text by removing timestamps and formatting
     */
    cleanTranscriptionText(text) {
        // Remove timestamp patterns like [00:00:00.000 --> 00:00:02.000]
        let cleaned = text.replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]/g, '');
        // Remove extra whitespace and trim
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        // Remove leading/trailing quotes if present
        cleaned = cleaned.replace(/^["']|["']$/g, '');
        return cleaned;
    }
    /**
     * Get service status with error information
     */
    getStatus() {
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
}
exports.AudioService = AudioService;
