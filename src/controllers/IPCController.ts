import { ipcMain, dialog, BrowserWindow } from 'electron';
import OpenAI from 'openai';
import { GlobalRAGService } from '../services/GlobalRAGService';
import { LocalRAGService } from '../services/LocalRAGService';
import { ChatService } from '../services/ChatService';
import { AudioService } from '../services/AudioService';
import { RAGService } from '../services/RAGService';
import { OCRService } from '../services/OCRService';
import { CaptureService } from '../services/CaptureService';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { SessionManager } from '../services/SessionManager';
import { WindowManager } from '../services/WindowManager';
import { PromptLibraryService } from '../services/PromptLibraryService';
import { AudioSource, ActionType } from '../types';
import { CaptureType } from '../services/CaptureService';
import * as fs from 'fs';
import * as path from 'path';

export interface IPCServices {
  globalRagService: GlobalRAGService;
  localRagService?: LocalRAGService;
  chatService: ChatService;
  audioService: AudioService;
  ragService: RAGService;
  ocrService: OCRService;
  captureService: CaptureService;
  configurationManager: ConfigurationManager;
  sessionManager: SessionManager;
  windowManager: WindowManager;
  promptLibraryService: PromptLibraryService;
  openai: OpenAI | null;
}

export class IPCController {
  private services: IPCServices;
  private sessionWindows: Map<string, BrowserWindow>;
  private sessions: Map<string, any>;
  private createSessionWindowCallback?: (sessionId: string, config: any) => BrowserWindow;
  
  // Mouse capture state
  private mouseCaptureSessions: Map<string, {
    event: Electron.IpcMainEvent;
    clickCount: number;
    coordinates: { x: number, y: number }[];
  }> = new Map();

  constructor(
    services: IPCServices,
    sessionWindows: Map<string, BrowserWindow>,
    sessions: Map<string, any>,
    createSessionWindowCallback?: (sessionId: string, config: any) => BrowserWindow
  ) {
    this.services = services;
    this.sessionWindows = sessionWindows;
    this.sessions = sessions;
    this.createSessionWindowCallback = createSessionWindowCallback;
  }

  /**
   * Initialize all IPC handlers
   */
  initialize(): void {
    console.log('🔧 [IPC] Setting up IPC handlers...');

    this.setupSessionHandlers();
    this.setupChatHandlers();
    this.setupScreenshotHandlers();
    this.setupAudioHandlers();
    this.setupRAGHandlers();
    this.setupGlobalRAGHandlers();
    this.setupSettingsHandlers();
    this.setupAPIKeyHandlers();

    console.log('🔧 [IPC] IPC handlers setup complete');
  }

  private setupSessionHandlers(): void {
    ipcMain.on('create-session', async (event, config) => {
      try {
        console.log(`🚀 [IPC] Creating session with config:`, config);

        const session = await this.services.sessionManager.createSession({
          profession: config.profession,
          interviewType: config.interviewType,
          context: config.context || null
        });

        // Create session window if callback is provided
        if (this.createSessionWindowCallback) {
          const sessionWindow = this.createSessionWindowCallback(session.id, {
            id: session.id,
            profession: session.profession,
            interviewType: session.interviewType,
            context: session.context,
            createdAt: new Date(),
            isActive: true
          });

          console.log(`🪟 [IPC] Session window created for: ${session.id}`);

          // Initialize chat session with context if available
          await this.initializeChatSessionWithContext(session.id, session.profession, session.interviewType, session.context);
        } else {
          console.warn(`⚠️ [IPC] No createSessionWindow callback provided`);
        }

        event.reply('session-created', { sessionId: session.id, session });

        console.log(`🚀 [IPC] Session created successfully: ${session.profession} - ${session.interviewType} (ID: ${session.id})`);
      } catch (error) {
        console.error(`🚀 [IPC] Failed to create session:`, error);
        event.reply('session-creation-failed', { error: (error as Error).message });
      }
    });

    ipcMain.on('close-session', async (event, sessionId) => {
      console.log(`🔴 [IPC] Closing session: ${sessionId}`);

      try {
        // Stop any active recording
        if (this.services.audioService.getRecordingStatus(sessionId).isRecording) {
          await this.services.audioService.stopRecording(sessionId);
        }

        // Close session in SessionManager
        await this.services.sessionManager.closeSession(sessionId);

        event.reply('session-closed', { sessionId });
        console.log(`🔴 [IPC] Session closed: ${sessionId}`);
      } catch (error) {
        console.error(`🔴 [IPC] Error closing session ${sessionId}:`, error);
        event.reply('session-close-failed', { sessionId, error: (error as Error).message });
      }
    });
  }

  private setupChatHandlers(): void {
    ipcMain.on('chat-message', async (event, data) => {
      const { sessionId, message, source } = data;
      const session = this.sessions.get(sessionId);

      if (source === 'audio-transcription') {
        console.log(`🎤 [IPC] Audio transcription in session ${sessionId}:`, message);
      } else {
        console.log(`💬 [IPC] Chat message in session ${sessionId}:`, message);
      }

      try {
        let aiResponse = '';

        if (this.services.openai && session) {
          console.log(`🤖 [OPENAI] Using ChatService with conversation context for ${session.profession} ${session.interviewType}`);

          let contextualMessage = message;
          if (source === 'audio-transcription') {
            contextualMessage = `[Audio Transcription] The user said: "${message}". Please provide interview coaching advice or answer their question based on this audio input.`;
          }

          const chatResult = await this.services.chatService.sendMessage(sessionId, contextualMessage);
          aiResponse = chatResult.response;
          
          // If RAG context was used, show the enhanced message to the user
          if (chatResult.ragContextUsed) {
            const sessionWindow = this.sessionWindows.get(sessionId);
            if (sessionWindow && !sessionWindow.isDestroyed()) {
              sessionWindow.webContents.send('chat-response', {
                sessionId,
                content: `📝 **Enhanced Message Sent to LLM:**\n\n${chatResult.enhancedMessage}`,
                timestamp: new Date().toISOString(),
                metadata: {
                  source: 'rag-enhanced-message',
                  action: 'rag'
                }
              });
            }
          }
          
          console.log(`🤖 [OPENAI] Generated contextual response for session ${sessionId}`);
        } else {
          console.log(`⚠️ [OPENAI] No API key or session found, using fallback response`);
          
          const fallbackResponses = [
            'Great question! For technical interviews, I recommend breaking down the problem step by step. (Configure your OpenAI API key in Settings for personalized responses)',
            'This is a common interview pattern. Let me help you think through the approach. (Add your API key in Settings for AI-powered assistance)',
            'I can see this relates to algorithms and data structures. Here are some key points to consider... (Enable AI responses by adding your OpenAI API key)',
            'For system design questions like this, start with understanding the requirements and scale. (Get personalized help by configuring your API key)',
            'This behavioral question is perfect for the STAR method. Let me guide you through it. (Add OpenAI API key for tailored coaching)'
          ];

          aiResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
        }

        console.log(`💬 [IPC] Sending chat response for session ${sessionId}`);

        event.reply('chat-response', {
          sessionId,
          content: aiResponse,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error(`💬 [IPC] Chat error for session ${sessionId}:`, error);

        event.reply('chat-response', {
          sessionId,
          content: 'I encountered an error processing your message. Please check your API key configuration in Settings and try again.',
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  private setupScreenshotHandlers(): void {
    ipcMain.on('capture-screenshot', async (event, data) => {
      const { sessionId } = data;
      const session = this.sessions.get(sessionId);
      console.log(`📷 [IPC] Screenshot capture requested for session: ${sessionId}`);

      try {
        // Step 1: Capture screenshot
        console.log(`📷 [OCR] Starting screen capture...`);
        const screenshot = await this.services.captureService.captureScreen();
        console.log(`📷 [OCR] Screen capture completed, size: ${screenshot.length} bytes`);

        // Step 2: Extract text using OCR
        console.log(`📷 [OCR] Starting OCR text extraction...`);
        const ocrText = await this.services.ocrService.extractText(screenshot);
        console.log(`📷 [OCR] OCR extraction completed: "${ocrText.substring(0, 100)}..."`);

        // 🎯 NEW: Use multi-step flow - send captured text with action buttons
        console.log(`📷 [IPC] Sending screenshot capture result with multi-step options for session ${sessionId}`);

        // Initialize session OCR accumulation if not exists
        if (!session) {
          console.error(`❌ [IPC] Session not found: ${sessionId}`);
          event.reply('screenshot-captured', {
            sessionId,
            text: 'Session not found',
            accumulatedText: '',
            error: 'Session not found',
            timestamp: new Date().toISOString()
          });
          return;
        }

        if (!session.accumulatedOCR) {
          session.accumulatedOCR = {};
        }
        
        // Store initial capture text
        session.accumulatedOCR['screenshot'] = ocrText;

        // Send to the correct session window
        console.log(`🔍 [IPC] Looking up session window for: ${sessionId}`);
        console.log(`🔍 [IPC] Available session windows:`, Array.from(this.sessionWindows.keys()));
        
        const sessionWindow = this.sessionWindows.get(sessionId);
        console.log(`🔍 [IPC] Session window found:`, !!sessionWindow);
        console.log(`🔍 [IPC] Session window destroyed:`, sessionWindow ? sessionWindow.isDestroyed() : 'N/A');
        
        if (sessionWindow && !sessionWindow.isDestroyed()) {
          console.log(`✅ [IPC] Sending screenshot-captured to session window`);
          sessionWindow.webContents.send('screenshot-captured', {
            sessionId,
            text: ocrText,
            accumulatedText: ocrText, // Initial capture is the accumulated text
            timestamp: new Date().toISOString()
          });
        } else {
          console.error(`❌ [IPC] Session window not found or destroyed for session: ${sessionId}`);
          console.log(`🔄 [IPC] Falling back to event.reply`);
          // Fallback to event.reply
          event.reply('screenshot-captured', {
            sessionId,
            text: ocrText,
            accumulatedText: ocrText,
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        console.log(`❌ [OCR] Screenshot processing failed: ${(error as Error).message}`);

        event.reply('screenshot-captured', {
          sessionId,
          text: 'Screenshot capture failed',
          accumulatedText: '',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    });

    ipcMain.on('debug-code', async (event, data) => {
      const { sessionId } = data;
      const session = this.sessions.get(sessionId);
      console.log(`🐛 [IPC] Code debug requested for session: ${sessionId}`);

      try {
        // Step 1: Capture screenshot
        console.log(`🐛 [OCR] Starting screen capture for debug...`);
        const screenshot = await this.services.captureService.captureScreen();
        console.log(`🐛 [OCR] Debug screen capture completed, size: ${screenshot.length} bytes`);

        // Step 2: Extract text using OCR
        console.log(`🐛 [OCR] Starting OCR text extraction for debug...`);
        const ocrText = await this.services.ocrService.extractText(screenshot);
        console.log(`🐛 [OCR] Debug OCR extraction completed: "${ocrText.substring(0, 100)}..."`);

        // 🎯 NEW: Use multi-step flow - send captured text with action buttons
        console.log(`🐛 [IPC] Sending debug capture result with multi-step options for session ${sessionId}`);

        // Initialize session OCR accumulation if not exists
        if (!session) {
          console.error(`❌ [IPC] Debug session not found: ${sessionId}`);
          event.reply('debug-captured', {
            sessionId,
            text: 'Session not found',
            accumulatedText: '',
            error: 'Session not found',
            timestamp: new Date().toISOString()
          });
          return;
        }

        if (!session.accumulatedOCR) {
          session.accumulatedOCR = {};
        }
        
        // Store initial capture text
        session.accumulatedOCR['debug'] = ocrText;

        // Send to the correct session window
        console.log(`🔍 [IPC] Looking up debug session window for: ${sessionId}`);
        console.log(`🔍 [IPC] Available debug session windows:`, Array.from(this.sessionWindows.keys()));
        
        const sessionWindow = this.sessionWindows.get(sessionId);
        console.log(`🔍 [IPC] Debug session window found:`, !!sessionWindow);
        console.log(`🔍 [IPC] Debug session window destroyed:`, sessionWindow ? sessionWindow.isDestroyed() : 'N/A');
        
        if (sessionWindow && !sessionWindow.isDestroyed()) {
          console.log(`✅ [IPC] Sending debug-captured to session window`);
          sessionWindow.webContents.send('debug-captured', {
            sessionId,
            text: ocrText,
            accumulatedText: ocrText, // Initial capture is the accumulated text
            timestamp: new Date().toISOString()
          });
        } else {
          console.error(`❌ [IPC] Debug session window not found or destroyed for session: ${sessionId}`);
          console.log(`🔄 [IPC] Falling back to event.reply for debug`);
          // Fallback to event.reply
          event.reply('debug-captured', {
            sessionId,
            text: ocrText,
            accumulatedText: ocrText,
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        console.log(`❌ [DEBUG] Debug processing failed: ${(error as Error).message}`);

        event.reply('debug-captured', {
          sessionId,
          text: 'Debug capture failed',
          accumulatedText: '',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 🎯 NEW: Multi-step capture handler
    ipcMain.on('multi-capture', async (event, data) => {
      const { sessionId, actionType, captureType, accumulatedText } = data;
      const session = this.sessions.get(sessionId);
      console.log(`📷 [MULTI-CAPTURE] Multi-step ${actionType} capture requested: ${captureType} for session ${sessionId}`);

      try {
        // Map captureType string to CaptureType enum
        let captureTypeEnum: CaptureType;
        switch (captureType) {
          case 'full':
            captureTypeEnum = CaptureType.FULL;
            break;
          case 'left_half':
            captureTypeEnum = CaptureType.LEFT_HALF;
            break;
          case 'right_half':
            captureTypeEnum = CaptureType.RIGHT_HALF;
            break;
          default:
            throw new Error(`Unknown capture type: ${captureType}`);
        }

        console.log(`📷 [MULTI-CAPTURE] Capturing ${captureTypeEnum} screen...`);
        const screenshot = await this.services.captureService.captureScreenWithType(captureTypeEnum);
        console.log(`📷 [MULTI-CAPTURE] Screen capture completed, size: ${screenshot.length} bytes`);

        // Extract text using OCR
        console.log(`📷 [MULTI-CAPTURE] Starting OCR text extraction...`);
        const newOcrText = await this.services.ocrService.extractText(screenshot);
        console.log(`📷 [MULTI-CAPTURE] New OCR extraction completed: "${newOcrText.substring(0, 100)}..."`);

        // Accumulate OCR text - combine with previous accumulated text
        const combinedText = accumulatedText 
          ? `${accumulatedText}\n\n--- Additional Capture ---\n\n${newOcrText}` 
          : newOcrText;
        
        console.log(`📷 [MULTI-CAPTURE] Accumulated text length: ${combinedText.length} characters`);

        // Initialize session OCR accumulation if not exists
        if (!session.accumulatedOCR) {
          session.accumulatedOCR = {};
        }
        
        // Store accumulated text in session for this action type
        session.accumulatedOCR[actionType] = combinedText;

        console.log(`📷 [MULTI-CAPTURE] Sending ${actionType} capture result for session ${sessionId}`);

        // Send the new capture result with accumulated text to UI
        const eventName = actionType === 'screenshot' ? 'screenshot-captured' : 'debug-captured';
        event.reply(eventName, {
          sessionId,
          text: newOcrText, // Current capture's text
          accumulatedText: combinedText, // All accumulated text
          captureType: captureTypeEnum,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.error(`❌ [MULTI-CAPTURE] ${actionType} multi-capture failed: ${(error as Error).message}`);
        
        const eventName = actionType === 'screenshot' ? 'screenshot-captured' : 'debug-captured';
        event.reply(eventName, {
          sessionId,
          text: 'Multi-capture failed',
          accumulatedText: accumulatedText || '',
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // 🔲 NEW: Area capture handler
    ipcMain.on('capture-area', async (event, data) => {
      const { sessionId, coordinates } = data;
      console.log(`🔲 [AREA-CAPTURE] Area capture requested for session ${sessionId}:`, coordinates);

      try {
        // Validate coordinates
        if (!coordinates || !coordinates.x1 || !coordinates.y1 || !coordinates.x2 || !coordinates.y2) {
          throw new Error('Invalid coordinates provided for area capture');
        }

        console.log(`🔲 [AREA-CAPTURE] Capturing area: (${coordinates.x1}, ${coordinates.y1}) to (${coordinates.x2}, ${coordinates.y2})`);
        
        // Use CaptureService to capture the defined area
        const areaScreenshot = await this.services.captureService.captureArea(coordinates);
        console.log(`🔲 [AREA-CAPTURE] Area capture completed, size: ${areaScreenshot.length} bytes`);

        // Extract text from the captured area using OCR
        console.log(`🔲 [AREA-CAPTURE] Starting OCR text extraction...`);
        const ocrText = await this.services.ocrService.extractText(areaScreenshot);
        console.log(`🔲 [AREA-CAPTURE] OCR extraction completed: "${ocrText.substring(0, 100)}..."`);

        // Don't send OCR text to chat automatically - let the UI handle it
        // Don't do automatic AI analysis - user will choose when to analyze
        const sessionWindow = this.sessionWindows.get(sessionId);

        // Send successful result to session window (reuse existing sessionWindow reference)
        if (sessionWindow && !sessionWindow.isDestroyed()) {
          console.log(`✅ [AREA-CAPTURE] Sending successful area capture result to session window`);
          sessionWindow.webContents.send('area-captured', {
            sessionId,
            coordinates,
            text: ocrText,
            timestamp: new Date().toISOString()
          });
        } else {
          console.error(`❌ [AREA-CAPTURE] Session window not found for session: ${sessionId}`);
          event.reply('area-captured', {
            sessionId,
            coordinates,
            text: ocrText,
            timestamp: new Date().toISOString()
          });
        }

      } catch (error) {
        console.error(`❌ [AREA-CAPTURE] Area capture failed:`, error);
        
        // Send error to session window
        const sessionWindow = this.sessionWindows.get(sessionId);
        if (sessionWindow && !sessionWindow.isDestroyed()) {
          sessionWindow.webContents.send('area-capture-error', {
            sessionId,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
          });
        } else {
          event.reply('area-capture-error', {
            sessionId,
            error: (error as Error).message,
            timestamp: new Date().toISOString()
          });
        }
      }
    });

    // 🔲 NEW: Coordinate capture handler (for area selection)
    ipcMain.on('start-coordinate-capture', async (event, data) => {
      const { sessionId } = data;
      console.log(`🔲 [COORDINATE] *** IPC MESSAGE RECEIVED *** Starting coordinate capture for session: ${sessionId}`);
      console.log(`🔲 [COORDINATE] Event object:`, typeof event);
      console.log(`🔲 [COORDINATE] Data object:`, data);
      
      try {
        // Start listening for global mouse clicks
        console.log(`🔲 [COORDINATE] Calling startGlobalMouseCapture...`);
        this.startGlobalMouseCapture(sessionId, event);
        
        console.log(`🔲 [COORDINATE] Global mouse capture setup completed for session: ${sessionId}`);
        event.reply('coordinate-capture-ready', { sessionId });
        console.log(`🔲 [COORDINATE] Sent coordinate-capture-ready reply`);
        
      } catch (error) {
        console.error(`❌ [COORDINATE] Coordinate capture setup failed:`, error);
        event.reply('coordinate-capture-error', {
          sessionId,
          error: error.message
        });
      }
    });
    
    // 🔲 NEW: Stop coordinate capture handler
    ipcMain.on('stop-coordinate-capture', async (event, data) => {
      const { sessionId } = data;
      console.log(`🔲 [COORDINATE] Stopping coordinate capture for session: ${sessionId}`);
      this.stopGlobalMouseCapture(sessionId);
    });
    
    // 🔲 NEW: Overlay click handler (from injected JavaScript in overlay window)
    ipcMain.on('overlay-click', async (event, data) => {
      const { sessionId, x, y, clickCount } = data;
      console.log(`🖱️ [OVERLAY-IPC] Received overlay click: (${x}, ${y}) for session: ${sessionId}`);
      
      // Handle the mouse click through our existing handler
      this.handleMouseClick(sessionId, x, y);
    });

    // 🎯 NEW: Analyze accumulated text handler
    ipcMain.on('analyze-accumulated-text', async (event, data) => {
      const { sessionId, actionType, accumulatedText } = data;
      const session = this.sessions.get(sessionId);
      console.log(`🤖 [ANALYZE-ACCUMULATED] Analyzing accumulated ${actionType} text for session ${sessionId}`);
      console.log(`🤖 [ANALYZE-ACCUMULATED] Text length: ${accumulatedText.length} characters`);

      try {
        let aiAnalysis = '';
        if (this.services.chatService.isConfigured() && session) {
          console.log(`🤖 [ANALYZE-ACCUMULATED] Using persistent ChatService for accumulated ${actionType} analysis`);
          try {
            // Use appropriate action type for processing
            // let action = actionType === 'screenshot' ? ActionType.SCREENSHOT : ActionType.DEBUG;
            // action = actionType === 'area-capture' ? ActionType.SCREENSHOT : action;
            let action = ActionType.SCREENSHOT;
            if (actionType == 'area-capture') {
              console.log(`🤖 [ANALYZE-ACCUMULATED] Area capture analysis`);
              action = ActionType.SCREENSHOT;
            }else if (actionType == 'debug') {
              console.log(`🤖 [ANALYZE-ACCUMULATED] Debug analysis`);
              action = ActionType.DEBUG;
            }else{
              console.log(`🤖 [ANALYZE-ACCUMULATED] Screenshot analysis`);
              action = ActionType.SCREENSHOT;
            }
            aiAnalysis = await this.services.chatService.processOCRText(sessionId, accumulatedText, action);
            console.log(`🤖 [ANALYZE-ACCUMULATED] Generated analysis for session ${sessionId}`);
          } catch (error) {
            console.error(`🤖 [ANALYZE-ACCUMULATED] ChatService processing failed:`, error);
            
            // Try direct OpenAI analysis if ChatService fails but OpenAI is available
            if (this.services.openai && actionType === 'screenshot') {
              console.log(`🤖 [ANALYZE-ACCUMULATED] Falling back to direct OpenAI screenshot analysis`);
              try {
                aiAnalysis = await this.generateOpenAIScreenshotAnalysis(
                  accumulatedText, 
                  session.profession, 
                  session.interviewType
                );
                console.log(`🤖 [ANALYZE-ACCUMULATED] Direct OpenAI analysis successful`);
              } catch (openaiError) {
                console.error(`🤖 [ANALYZE-ACCUMULATED] Direct OpenAI analysis also failed:`, openaiError);
                aiAnalysis = this.generateFallbackAnalysis(accumulatedText, session.profession, session.interviewType);
              }
            } else {
              // Use fallback for debug or when OpenAI not available
              aiAnalysis = actionType === 'screenshot' 
                ? this.generateFallbackAnalysis(accumulatedText, session.profession, session.interviewType)
                : this.generateFallbackDebugAnalysis(accumulatedText, session.profession);
              console.log(`🤖 [ANALYZE-ACCUMULATED] Using fallback analysis for ${actionType}`);
              // if (actionType === 'debug') { 
              //   aiAnalysis = this.generateFallbackDebugAnalysis(accumulatedText, session.profession);
              // } else{
              //   aiAnalysis = this.generateFallbackAnalysis(accumulatedText, session.profession, session.interviewType);
              // }
             
            }
          }
        } else {
          console.log(`⚠️ [ANALYZE-ACCUMULATED] No ChatService configured, checking for direct OpenAI analysis`);
          
          // If ChatService not configured but OpenAI is available, use direct analysis
          if (this.services.openai && session && actionType === 'screenshot') {
            console.log(`🤖 [ANALYZE-ACCUMULATED] Using direct OpenAI screenshot analysis`);
            try {
              aiAnalysis = await this.generateOpenAIScreenshotAnalysis(
                accumulatedText, 
                session.profession, 
                session.interviewType
              );
              console.log(`🤖 [ANALYZE-ACCUMULATED] Direct OpenAI analysis successful`);
            } catch (error) {
              console.error(`🤖 [ANALYZE-ACCUMULATED] Direct OpenAI analysis failed:`, error);
              aiAnalysis = this.generateFallbackAnalysis(accumulatedText, session.profession, session.interviewType);
            }
          } else {
            // Use fallback analysis
            console.log(`⚠️ [ANALYZE-ACCUMULATED] Using fallback analysis`);
            aiAnalysis = actionType === 'screenshot'
              ? this.generateFallbackAnalysis(accumulatedText, session?.profession || 'software-engineer', session?.interviewType || 'technical')
              : this.generateFallbackDebugAnalysis(accumulatedText, session?.profession || 'software-engineer');
          }
        }

        console.log(`🤖 [ANALYZE-ACCUMULATED] Sending analysis result for session ${sessionId}`);

        // Send the final analysis to UI as a regular chat response
        let content="Screenshot";
        if(actionType === 'area-capture' || actionType === 'screenshot'){
          content="Screenshot";
        }else{
          content="Debug";
        }
        event.reply('chat-response', {
          sessionId,
          content: `📝 **Complete ${content} Analysis:**\n\n${aiAnalysis}`,
          metadata: {
            action: actionType,
            accumulatedTextLength: accumulatedText.length,
            analysisType: 'accumulated'
          },
          timestamp: new Date().toISOString()
        });

        // Clean up accumulated text for this action type
        if (session.accumulatedOCR) {
          delete session.accumulatedOCR[actionType];
        }

      } catch (error) {
        console.error(`❌ [ANALYZE-ACCUMULATED] Analysis failed: ${(error as Error).message}`);
        
        event.reply('chat-response', {
          sessionId,
          content: `❌ **Analysis Error:** I encountered an error while analyzing the accumulated ${actionType} text. Please try again or check your system permissions.`,
          metadata: {
            action: actionType,
            error: true
          },
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  private setupAudioHandlers(): void {
    ipcMain.on('toggle-recording', async (event, data) => {
      const { sessionId } = data;
      const session = this.sessions.get(sessionId);

      console.log(`🎤 [IPC] Recording toggle requested for session: ${sessionId}`);

      if (session) {
        try {
          if (!session.isRecording) {
            // Start recording
            console.log(`🎤 [IPC] Starting audio recording for session: ${sessionId}`);
            
            if (!this.services.audioService.isReady()) {
              console.log(`🎤 [IPC] Initializing audio service...`);
              await this.services.audioService.initialize();
              console.log(`🎤 [IPC] Audio service initialized`);
            }
            
            const audioStatus = this.services.audioService.getStatus();
            console.log(`🎤 [IPC] Audio service status: ${JSON.stringify(audioStatus)}`);
            
            console.log(`🎤 [IPC] Calling audioService.startRecording with AudioSource.BOTH`);
            await this.services.audioService.startRecording(AudioSource.BOTH, sessionId);
            session.isRecording = true;
            
            console.log(`🎤 [IPC] Recording started successfully for session: ${sessionId}`);
          } else {
            // Stop recording and get transcription
            console.log(`🎤 [IPC] Stopping audio recording for session: ${sessionId}`);
            const transcription = await this.services.audioService.stopRecording(sessionId);
            session.isRecording = false;
            console.log(`🎤 [IPC] Recording stopped for session: ${sessionId}`);

            if (transcription) {
              console.log(`🎤 [TRANSCRIPTION] Received transcription: "${transcription}"`);
              
              const sessionWindow = this.sessionWindows.get(sessionId);
              if (sessionWindow && !sessionWindow.isDestroyed()) {
                sessionWindow.webContents.send('chat-response', {
                  sessionId,
                  content: `🎤 **Transcription:** ${transcription}`,
                  timestamp: new Date().toISOString(),
                  source: 'audio-transcription'
                });
              }

              // Process with PERSISTENT ChatService if available
              if (this.services.chatService.isConfigured() && session) {
                try {
                  console.log(`🎤 [PERSISTENT] Using persistent ChatService for microphone transcription analysis`);
                  const aiResponse = await this.services.chatService.processTranscript(sessionId, transcription, AudioSource.INTERVIEWEE);
                  
                  if (sessionWindow && !sessionWindow.isDestroyed()) {
                    sessionWindow.webContents.send('chat-response', {
                      sessionId,
                      content: `🤖 **AI Feedback:** ${aiResponse}`,
                      timestamp: new Date().toISOString(),
                      source: 'audio-transcription'
                    });
                  }
                } catch (error) {
                  console.error(`Failed to process mic audio transcription with persistent ChatService: ${error}`);
                }
              }
            }
          }

          event.reply('recording-status', {
            sessionId,
            isRecording: session.isRecording
          });
        } catch (error) {
          console.log(`❌ [IPC] Recording toggle failed for session ${sessionId}: ${(error as Error).message}`);
          session.isRecording = false;
          
          event.reply('recording-status', {
            sessionId,
            isRecording: false,
            error: (error as Error).message
          });
        }
      } else {
        console.log(`⚠️ [IPC] Session not found for recording toggle: ${sessionId}`);
      }
    });

    // System audio recording handler
    ipcMain.on('toggle-system-recording', async (event, data) => {
      const { sessionId } = data;
      const session = this.sessions.get(sessionId);

      console.log(`🔊 [IPC] System recording toggle requested for session: ${sessionId}`);

      if (session) {
        try {
          if (!session.isSystemRecording) {
            console.log(`🔊 [IPC] Starting system audio recording for session: ${sessionId}`);
            
            if (!this.services.audioService.isReady()) {
              console.log(`🔊 [IPC] Initializing audio service...`);
              await this.services.audioService.initialize();
              console.log(`🔊 [IPC] Audio service initialized`);
            }
            
            console.log(`🔊 [IPC] Calling audioService.startRecording with AudioSource.SYSTEM`);
            await this.services.audioService.startRecording(AudioSource.SYSTEM, sessionId);
            session.isSystemRecording = true;
            
            console.log(`🔊 [IPC] System recording started successfully for session: ${sessionId}`);
          } else {
            console.log(`🔊 [IPC] Stopping system audio recording for session: ${sessionId}`);
            const transcription = await this.services.audioService.stopRecording(sessionId);
            session.isSystemRecording = false;
            console.log(`🔊 [IPC] System recording stopped for session: ${sessionId}`);

            if (transcription) {
              console.log(`🔊 [TRANSCRIPTION] Received system audio transcription: "${transcription}"`);
              
              const sessionWindow = this.sessionWindows.get(sessionId);
              if (sessionWindow && !sessionWindow.isDestroyed()) {
                sessionWindow.webContents.send('chat-response', {
                  sessionId,
                  content: `🔊 **System Audio Transcription:** ${transcription}`,
                  timestamp: new Date().toISOString(),
                  source: 'system-audio-transcription'
                });
              }

              // Process with PERSISTENT ChatService for system audio (interviewer questions)
              if (this.services.chatService.isConfigured() && session) {
                try {
                  console.log(`🔊 [PERSISTENT] Using persistent ChatService for system audio transcription analysis`);
                  const aiResponse = await this.services.chatService.processTranscript(sessionId, transcription, AudioSource.SYSTEM);
                  
                  if (sessionWindow && !sessionWindow.isDestroyed()) {
                    sessionWindow.webContents.send('chat-response', {
                      sessionId,
                      content: `🤖 **AI Interview Coach:** ${aiResponse}`,
                      timestamp: new Date().toISOString(),
                      source: 'system-audio-transcription'
                    });
                  }
                } catch (error) {
                  console.error(`Failed to process system audio transcription with persistent ChatService: ${error}`);
                }
              }
            }
          }

          event.reply('recording-status', {
            sessionId,
            isRecording: session.isSystemRecording || false,
            recordingType: 'system'
          });
        } catch (error) {
          console.log(`❌ [IPC] System recording toggle failed for session ${sessionId}: ${(error as Error).message}`);
          session.isSystemRecording = false;
          
          event.reply('recording-status', {
            sessionId,
            isRecording: false,
            recordingType: 'system',
            error: (error as Error).message
          });
        }
      } else {
        console.log(`⚠️ [IPC] Session not found for system recording toggle: ${sessionId}`);
      }
    });

    // Individual recording source handlers (Task 5.1 - 5.4)
    ipcMain.on('start-recording', async (event, data) => {
      const { sessionId, source } = data;
      const session = this.sessions.get(sessionId);
      
      console.log(`🎤 [IPC] Start recording requested for session: ${sessionId}, source: ${source}`);
      
      if (!session) {
        console.log(`⚠️ [IPC] Session not found for recording start: ${sessionId}`);
        event.reply('recording-error', {
          sessionId,
          error: 'Session not found'
        });
        return;
      }
      
      try {
        if (!this.services.audioService.isReady()) {
          console.log(`🎤 [IPC] Initializing audio service...`);
          await this.services.audioService.initialize();
          console.log(`🎤 [IPC] Audio service initialized`);
        }
        
        // Map source string to AudioSource enum
        let audioSource: AudioSource;
        switch (source) {
          case 'interviewer':
            audioSource = AudioSource.INTERVIEWER;
            break;
          case 'interviewee':
            audioSource = AudioSource.INTERVIEWEE;
            break;
          case 'both':
            audioSource = AudioSource.BOTH;
            break;
          case 'system':
            audioSource = AudioSource.SYSTEM;
            break;
          default:
            throw new Error(`Unknown audio source: ${source}`);
        }
        
        console.log(`🎤 [IPC] Starting recording with AudioSource.${audioSource}`);
        await this.services.audioService.startRecording(audioSource, sessionId);
        
        // Update session state
        session.isRecording = true;
        session.recordingSource = audioSource;
        
        event.reply('recording-status', {
          sessionId,
          isRecording: true,
          source: source
        });
        
        console.log(`🎤 [IPC] Recording started successfully for session: ${sessionId}`);
      } catch (error) {
        console.log(`❌ [IPC] Start recording failed for session ${sessionId}: ${(error as Error).message}`);
        
        event.reply('recording-error', {
          sessionId,
          error: (error as Error).message
        });
      }
    });
    
    ipcMain.on('stop-recording', async (event, data) => {
      const { sessionId } = data;
      const session = this.sessions.get(sessionId);
      
      console.log(`🎤 [IPC] Stop recording requested for session: ${sessionId}`);
      
      if (!session) {
        console.log(`⚠️ [IPC] Session not found for recording stop: ${sessionId}`);
        event.reply('recording-error', {
          sessionId,
          error: 'Session not found'
        });
        return;
      }
      
      try {
        // 🎯 Get complete accumulated transcription when stopping recording
        console.log(`🎤 [IPC] Stopping audio recording for session: ${sessionId}`);
        const completeTranscription = await this.services.audioService.stopRecording(sessionId);
        
        // Update session state
        session.isRecording = false;
        const recordingSource = session.recordingSource || AudioSource.INTERVIEWEE;
        session.recordingSource = null;
        
        console.log(`🎤 [IPC] Recording stopped for session: ${sessionId}`);
        
        event.reply('recording-status', {
          sessionId,
          isRecording: false
        });
        
        if (completeTranscription && completeTranscription.trim()) {
          console.log(`🎤 [COMPLETE] Received complete transcription: "${completeTranscription}"`);
          
          const sessionWindow = this.sessionWindows.get(sessionId);
          if (sessionWindow && !sessionWindow.isDestroyed()) {
            // Show the complete transcription
            sessionWindow.webContents.send('chat-response', {
              sessionId,
              content: `🎤 **Complete Transcription:** ${completeTranscription}`,
              timestamp: new Date().toISOString(),
              source: 'complete-audio-transcription'
            });
          }
          
          // 🎯 NOW send complete transcription to LLM for analysis
          if (this.services.chatService.isConfigured() && session) {
            try {
              console.log(`🎤 [LLM] Sending complete transcription to ChatService for analysis`);
              const aiResponse = await this.services.chatService.processTranscript(sessionId, completeTranscription, recordingSource);
              
              if (sessionWindow && !sessionWindow.isDestroyed()) {
                sessionWindow.webContents.send('chat-response', {
                  sessionId,
                  content: `🤖 **AI Analysis:** ${aiResponse}`,
                  timestamp: new Date().toISOString(),
                  source: 'complete-audio-analysis'
                });
              }
            } catch (error) {
              console.error(`Failed to process complete transcription with ChatService: ${error}`);
            }
          }
        } else {
          console.log(`🎤 [IPC] No transcription available for session: ${sessionId}`);
        }
        
        console.log(`🎤 [IPC] Recording stop completed for session: ${sessionId}`);
      } catch (error) {
        console.log(`❌ [IPC] Stop recording failed for session ${sessionId}: ${(error as Error).message}`);
        
        session.isRecording = false;
        
        event.reply('recording-error', {
          sessionId,
          error: (error as Error).message
        });
      }
    });
    
    // ========================================
    // AUTO RECORDER MODE IPC HANDLERS
    // ========================================
    
    ipcMain.on('toggle-auto-recorder', async (event, data) => {
      const { sessionId, active } = data;
      const session = this.sessions.get(sessionId);
      
      console.log(`🔄 [AUTO-RECORDER] Toggle auto recorder requested for session: ${sessionId}, active: ${active}`);
      
      if (!session) {
        console.log(`⚠️ [AUTO-RECORDER] Session not found: ${sessionId}`);
        event.reply('auto-recorder-status', {
          sessionId,
          active: false,
          error: 'Session not found'
        });
        return;
      }
      
      try {
        if (!this.services.audioService.isReady()) {
          console.log(`🔄 [AUTO-RECORDER] Initializing audio service...`);
          await this.services.audioService.initialize();
          console.log(`🔄 [AUTO-RECORDER] Audio service initialized`);
        }
        
        if (active) {
          // Start auto recorder mode
          console.log(`🔄 [AUTO-RECORDER] Starting auto recorder mode for session: ${sessionId}`);
          await this.services.audioService.startAutoRecorder(sessionId, AudioSource.SYSTEM);
          session.autoRecorderActive = true;
          
          console.log(`🔄 [AUTO-RECORDER] Auto recorder mode started for session: ${sessionId}`);
        } else {
          // Stop auto recorder mode
          console.log(`🔄 [AUTO-RECORDER] Stopping auto recorder mode for session: ${sessionId}`);
          const finalTranscription = await this.services.audioService.stopAutoRecorder();
          session.autoRecorderActive = false;
          
          console.log(`🔄 [AUTO-RECORDER] Auto recorder mode stopped for session: ${sessionId}`);
          
          // If there's a final transcription, send it to the session
          if (finalTranscription && finalTranscription.trim()) {
            const sessionWindow = this.sessionWindows.get(sessionId);
            if (sessionWindow && !sessionWindow.isDestroyed()) {
              sessionWindow.webContents.send('chat-response', {
                sessionId,
                content: `🔄 **Final Auto Recorder Transcription:** ${finalTranscription}`,
                timestamp: new Date().toISOString(),
                source: 'auto-recorder-final'
              });
            }
          }
        }
        
        // Send status update to UI
        event.reply('auto-recorder-status', {
          sessionId,
          active: session.autoRecorderActive
        });
        
        // Also send to session window
        const sessionWindow = this.sessionWindows.get(sessionId);
        if (sessionWindow && !sessionWindow.isDestroyed()) {
          sessionWindow.webContents.send('auto-recorder-status', {
            sessionId,
            active: session.autoRecorderActive
          });
        }
        
      } catch (error) {
        console.log(`❌ [AUTO-RECORDER] Toggle failed for session ${sessionId}: ${(error as Error).message}`);
        session.autoRecorderActive = false;
        
        event.reply('auto-recorder-status', {
          sessionId,
          active: false,
          error: (error as Error).message
        });
      }
    });
    
    // NOTE: send-current-transcription is now handled by ApplicationController's global Cmd+S shortcut
    // This ensures only one handler processes Cmd+S to avoid conflicts and duplicate processing
  }

  private setupRAGHandlers(): void {
    ipcMain.on('add-rag-material', async (event, data) => {
      const { sessionId } = data;
      console.log(`📚 [IPC] RAG material addition requested for session: ${sessionId}`);

      try {
        const result = await dialog.showOpenDialog({
          title: 'Select Study Materials Folder',
          properties: ['openDirectory'],
          message: 'Choose a folder containing your study materials (.txt, .md files)'
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          console.log(`📚 [IPC] RAG folder selection cancelled for session: ${sessionId}`);
          return;
        }

        const folderPath = result.filePaths[0];
        console.log(`📚 [IPC] Processing RAG materials from: ${folderPath}`);

        // Process documents using RAG service
        console.log(`📚 [RAG] Starting document ingestion...`);
        await this.services.ragService.ingestDocuments(folderPath, sessionId);
        
        const knowledgeBase = this.services.ragService.getKnowledgeBase(sessionId);
        const documentCount = knowledgeBase ? knowledgeBase.documents.length : 0;

        console.log(`📚 [IPC] RAG processing complete for session: ${sessionId}, processed ${documentCount} documents`);

        const session = this.sessions.get(sessionId);
        if (session) {
          session.hasRAG = true;
        }

        event.reply('rag-success', {
          sessionId,
          documentsProcessed: documentCount,
          folderPath: folderPath,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.log(`❌ [RAG] RAG processing failed for session ${sessionId}: ${(error as Error).message}`);

        event.reply('rag-error', {
          sessionId,
          error: (error as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Local RAG handlers
    ipcMain.on('select-folder-for-rag', async (event, data) => {
      const { sessionId } = data;
      console.log(`📁 [LOCAL-RAG] Folder selection requested for session: ${sessionId}`);
      
      try {
        const dialogResult = await dialog.showOpenDialog({
          title: 'Select Local RAG Materials Folder',
          properties: ['openDirectory'],
          message: 'Choose a folder containing documents for this session (.txt, .md, .pdf files)'
        });
        
        if (dialogResult.canceled || !dialogResult.filePaths || dialogResult.filePaths.length === 0) {
          console.log(`📁 [LOCAL-RAG] Folder selection cancelled for session: ${sessionId}`);
          event.reply('folder-selected', { success: false });
          return;
        }
        
        const folderPath = dialogResult.filePaths[0];
        console.log(`📁 [LOCAL-RAG] Processing folder: ${folderPath}`);
        
        // Count files in the folder for feedback
        const files = await this.countSupportedFiles(folderPath);
        
        event.reply('folder-selected', {
          success: true,
          path: folderPath,
          fileCount: files
        });
        
        // Start processing the documents in background
        if (!this.services.localRagService) {
          throw new Error('Local RAG service not available');
        }
        
        const ingestResult = await this.services.localRagService.ingestDocuments(sessionId, folderPath);
        
        event.reply('rag-processed', {
          success: ingestResult.success,
          documentCount: ingestResult.documentsProcessed,
          embeddingCount: ingestResult.chunksAdded,
          error: ingestResult.errors.length > 0 ? ingestResult.errors.join(', ') : null
        });
        
      } catch (error) {
        console.error(`📁 [LOCAL-RAG] Folder selection/processing error:`, error);
        event.reply('folder-selected', { success: false });
        event.reply('rag-processed', {
          success: false,
          error: (error as Error).message
        });
      }
    });
    
    ipcMain.on('refresh-local-rag', async (event, data) => {
      const { sessionId } = data;
      console.log(`🔄 [LOCAL-RAG] Refresh requested for session: ${sessionId}`);
      
      try {
        if (!this.services.localRagService) {
          throw new Error('Local RAG service not available');
        }
        
        const result = await this.services.localRagService.refreshLocalDatabase(sessionId);
        
        event.reply('local-rag-refreshed', {
          success: result.success,
          documentCount: result.documentsProcessed,
          error: result.errors.length > 0 ? result.errors.join(', ') : null
        });
        
      } catch (error) {
        console.error(`🔄 [LOCAL-RAG] Refresh error:`, error);
        event.reply('local-rag-refreshed', {
          success: false,
          error: (error as Error).message
        });
      }
    });
    
    ipcMain.on('toggle-global-rag', async (event, data) => {
      const { sessionId, enabled } = data;
      console.log(`🌍 [RAG-TOGGLE] Global RAG ${enabled ? 'enabled' : 'disabled'} for session: ${sessionId}`);
      
      try {
        // Update session's global RAG state in ChatService
        this.services.chatService.setGlobalRAGEnabled(sessionId, enabled);
        
        event.reply('global-rag-toggled', {
          sessionId,
          enabled
        });
        
      } catch (error) {
        console.error(`🌍 [RAG-TOGGLE] Global RAG toggle error:`, error);
      }
    });
    
    ipcMain.on('toggle-local-rag', async (event, data) => {
      const { sessionId, enabled } = data;
      console.log(`📁 [RAG-TOGGLE] Local RAG ${enabled ? 'enabled' : 'disabled'} for session: ${sessionId}`);
      
      try {
        // Update local RAG state in LocalRAGService
        if (this.services.localRagService) {
          this.services.localRagService.setLocalRAGEnabled(sessionId, enabled);
        }
        
        // Update session's local RAG state in ChatService
        this.services.chatService.setLocalRAGEnabled(sessionId, enabled);
        
        event.reply('local-rag-toggled', {
          sessionId,
          enabled
        });
        
      } catch (error) {
        console.error(`📁 [RAG-TOGGLE] Local RAG toggle error:`, error);
      }
    });
  }

  private setupGlobalRAGHandlers(): void {
    ipcMain.handle('global-rag-select-folder', async () => {
      console.log('📚 [GLOBAL-RAG] Folder selection requested');
      try {
        const result = await dialog.showOpenDialog({
          title: 'Select Global Knowledge Base Folder',
          properties: ['openDirectory'],
          message: 'Choose a folder containing your global knowledge base materials (.txt, .md, .pdf files)'
        });

        if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
          console.log('📚 [GLOBAL-RAG] Folder selection cancelled');
          return { success: false, message: 'Folder selection cancelled' };
        }

        const folderPath = result.filePaths[0];
        console.log(`📚 [GLOBAL-RAG] Selected folder: ${folderPath}`);
        
        return { success: true, folderPath };
      } catch (error) {
        console.error('📚 [GLOBAL-RAG] Folder selection error:', error);
        return { success: false, message: (error as Error).message };
      }
    });

    ipcMain.handle('global-rag-add-folder', async (event, folderPath: string) => {
      console.log(`📚 [GLOBAL-RAG] Adding folder to knowledge base: ${folderPath}`);
      try {
        const result = await this.services.globalRagService.indexFolder(folderPath);
        console.log(`📚 [GLOBAL-RAG] Folder added successfully: processed ${result.documentsProcessed} documents`);
        return { 
          success: result.success, 
          processedCount: result.documentsProcessed,
          folderPath: folderPath
        };
      } catch (error) {
        console.error(`📚 [GLOBAL-RAG] Error adding folder: ${(error as Error).message}`);
        return { 
          success: false, 
          message: (error as Error).message 
        };
      }
    });

    ipcMain.handle('global-rag-refresh', async () => {
      console.log('🔄 [GLOBAL-RAG] Refresh requested');
      try {
        const result = await this.services.globalRagService.refreshGlobalKnowledgeBase();
        console.log(`🔄 [GLOBAL-RAG] Refresh completed: processed ${result.documentsProcessed} documents`);
        return { 
          success: result.success, 
          processedCount: result.documentsProcessed
        };
      } catch (error) {
        console.error(`🔄 [GLOBAL-RAG] Refresh error: ${(error as Error).message}`);
        return { 
          success: false, 
          message: (error as Error).message 
        };
      }
    });

    ipcMain.handle('global-rag-clear', async () => {
      console.log('🗑️ [GLOBAL-RAG] Clear requested');
      try {
        await this.services.globalRagService.clearGlobalKnowledgeBase();
        console.log('🗑️ [GLOBAL-RAG] Knowledge base cleared successfully');
        return { success: true };
      } catch (error) {
        console.error(`🗑️ [GLOBAL-RAG] Clear error: ${(error as Error).message}`);
        return { 
          success: false, 
          message: (error as Error).message 
        };
      }
    });

    ipcMain.handle('global-rag-get-status', async () => {
      console.log('📊 [GLOBAL-RAG] Status requested');
      try {
        const stats = await this.services.globalRagService.getStats();
        const status = {
          totalDocuments: stats.totalDocuments,
          folders: [],
          lastUpdated: stats.lastUpdate,
          isReady: this.services.globalRagService.isReady(),
          totalChunks: stats.totalChunks,
          databaseSize: stats.databaseSize,
          supportedFormats: stats.supportedFormats
        };
        console.log(`📊 [GLOBAL-RAG] Current status: ${status.totalDocuments} documents`);
        return status;
      } catch (error) {
        console.error(`📊 [GLOBAL-RAG] Status error: ${(error as Error).message}`);
        return {
          totalDocuments: 0,
          folders: [],
          lastUpdated: null,
          isReady: false,
          error: (error as Error).message
        };
      }
    });
  }

  private setupSettingsHandlers(): void {
    ipcMain.on('open-settings', () => {
      console.log('⚙️ [IPC] Settings window requested');
      this.services.windowManager.createSettingsWindow();
    });
  }

  private setupAPIKeyHandlers(): void {
    // Settings window handlers
    ipcMain.on('get-config', async (event) => {
      console.log('⚙️ [IPC] Config requested');
      try {
        const config = this.services.configurationManager.getConfiguration();
        event.reply('config-data', config);
      } catch (error) {
        console.error('⚙️ [IPC] Failed to get config:', error);
        event.reply('config-error', (error as Error).message);
      }
    });

    ipcMain.on('update-api-key', async (event, apiKey) => {
      console.log('🔑 [IPC] Updating API key...');
      try {
        await this.services.configurationManager.updateApiKey(apiKey);
        
        // Re-initialize OpenAI in ApplicationController
        if (this.services.openai) {
          this.services.openai = new OpenAI({ apiKey });
        } else {
          this.services.openai = new OpenAI({ apiKey });
        }
        
        console.log('🔑 [IPC] API key updated successfully');
        event.reply('api-key-updated');
      } catch (error) {
        console.error('🔑 [IPC] Failed to update API key:', error);
        event.reply('api-key-invalid', 'Failed to save API key: ' + (error as Error).message);
      }
    });

    ipcMain.on('save-api-key', async (event, apiKey) => {
      console.log('🔑 [IPC] Saving API key...');
      try {
        await this.services.configurationManager.updateApiKey(apiKey);
        
        // Re-initialize OpenAI in ApplicationController
        if (this.services.openai) {
          this.services.openai = new OpenAI({ apiKey });
        } else {
          this.services.openai = new OpenAI({ apiKey });
        }
        
        console.log('🔑 [IPC] API key saved successfully');
        event.reply('api-key-saved');
      } catch (error) {
        console.error('🔑 [IPC] Failed to save API key:', error);
        event.reply('api-key-invalid', 'Failed to save API key: ' + (error as Error).message);
      }
    });

    ipcMain.on('test-api-key', async (event, apiKey) => {
      console.log('🔑 [IPC] Testing API key...');
      try {
        const testOpenAI = new OpenAI({ apiKey });
        const response = await testOpenAI.models.list();
        console.log('🔑 [IPC] API key test successful');
        event.reply('api-key-valid', 'API key is valid and working!');
      } catch (error) {
        console.error('🔑 [IPC] API key test failed:', error);
        event.reply('api-key-invalid', (error as Error).message);
      }
    });

    // User preferences handlers
    ipcMain.on('update-preferences', async (event, preferences) => {
      console.log('⚙️ [IPC] Updating user preferences:', preferences);
      try {
        await this.services.configurationManager.updateUserPreferences(preferences);
        console.log('⚙️ [IPC] User preferences updated successfully');
        event.reply('preferences-updated');
      } catch (error) {
        console.error('⚙️ [IPC] Failed to update preferences:', error);
        event.reply('config-error', (error as Error).message);
      }
    });

    // Prompt template handlers
    ipcMain.on('get-prompt-template', async (event, data) => {
      console.log('📝 [IPC] Prompt template requested:', data);
      try {
        const { profession, interviewType, action } = data;
        // Get prompt template from configuration
        const config = this.services.configurationManager.getConfiguration();
        let template = '';
        
        if (config.promptLibrary && config.promptLibrary[profession] && config.promptLibrary[profession][interviewType]) {
          const prompts = config.promptLibrary[profession][interviewType];
          if (action === 'system') {
            template = prompts.system || '';
          } else if (prompts.actions && prompts.actions[action]) {
            template = prompts.actions[action] || '';
          }
        }
        
        event.reply('prompt-template-loaded', template);
      } catch (error) {
        console.error('📝 [IPC] Failed to get prompt template:', error);
        event.reply('prompt-error', (error as Error).message);
      }
    });

    ipcMain.on('save-prompt-template', async (event, data) => {
      console.log('📝 [IPC] Saving prompt template:', data);
      try {
        const { profession, interviewType, action, template } = data;
        
        // Update prompt template in configuration
        const config = this.services.configurationManager.getConfiguration();
        if (!config.promptLibrary) config.promptLibrary = {};
        if (!config.promptLibrary[profession]) config.promptLibrary[profession] = {};
        if (!config.promptLibrary[profession][interviewType]) {
          config.promptLibrary[profession][interviewType] = { system: '', actions: {} };
        }
        
        if (action === 'system') {
          config.promptLibrary[profession][interviewType].system = template;
        } else {
          if (!config.promptLibrary[profession][interviewType].actions) {
            config.promptLibrary[profession][interviewType].actions = {};
          }
          config.promptLibrary[profession][interviewType].actions[action] = template;
        }
        
        await this.services.configurationManager.updatePromptLibrary(config.promptLibrary);
        
        console.log('📝 [IPC] Prompt template saved successfully');
        event.reply('prompt-template-saved');
      } catch (error) {
        console.error('📝 [IPC] Failed to save prompt template:', error);
        event.reply('prompt-error', (error as Error).message);
      }
    });
  }

  // Helper methods for AI analysis
  private async generateOpenAIScreenshotAnalysis(ocrText: string, profession: string, interviewType: string): Promise<string> {
    if (!this.services.openai) {
      throw new Error('OpenAI client not initialized');
    }

    // Use centralized prompt management
    const systemPrompt = this.services.promptLibraryService.getOpenAISystemPrompt(profession, interviewType);
    const userPrompt = this.services.promptLibraryService.getOpenAIUserPrompt(profession, interviewType, ocrText);

    const completion = await this.services.openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: 1500,
      temperature: 0.3
    });

    return completion.choices[0].message.content || 'Unable to generate analysis';
  }

  private generateFallbackAnalysis(ocrText: string, profession: string, interviewType: string): string {
    // Use centralized fallback analysis prompt
    return this.services.promptLibraryService.getFallbackAnalysisPrompt(ocrText, profession, interviewType);
  }

  private generateFallbackDebugAnalysis(ocrText: string, profession: string): string {
    // Use centralized fallback debug analysis prompt
    return this.services.promptLibraryService.getFallbackDebugAnalysisPrompt(ocrText, profession);
  }

  /**
   * Initialize chat session with context and global RAG data - Task 2.2 & 2.3
   */
  private async initializeChatSessionWithContext(sessionId: string, profession: string, interviewType: string, userContext?: string): Promise<void> {
    try {
      console.log(`🤖 [CONTEXT] Initializing chat session with context for ${sessionId}`);

      if (!this.services.openai) {
        console.log(`⚠️ [CONTEXT] No OpenAI client available, skipping context initialization`);
        return;
      }

      // Search global RAG for relevant context
      let globalContext = '';
      try {
        if (this.services.globalRagService.isReady()) {
          console.log(`📚 [CONTEXT] Searching global RAG for relevant context...`);
          
          // Build comprehensive search queries for better context retrieval
          const searchQueries = [];
          
          // Add profession and interview type specific queries
          searchQueries.push(`${profession} ${interviewType} experience`);
          searchQueries.push(`${profession} background skills`);
          searchQueries.push(`${profession.replace('-', ' ')} resume`);
          
          // Add user context if provided
          if (userContext && userContext.trim().length > 0) {
            searchQueries.push(userContext);
            // Extract key terms from user context
            const contextWords = userContext.toLowerCase().split(/\s+/).filter(word => word.length > 3);
            if (contextWords.length > 0) {
              searchQueries.push(contextWords.slice(0, 5).join(' '));
            }
          }
          
          // Add general resume/experience queries
          searchQueries.push('work experience projects');
          searchQueries.push('education background skills');
          searchQueries.push('technical expertise achievements');
          searchQueries.push('experience and responsibilities');
          searchQueries.push('relevant coursework projects');

          
          console.log(`📚 [CONTEXT] Searching with queries: ${searchQueries.join(', ')}`);
          
          // Try multiple search approaches for better results
          let allSearchResults = [];
          
          for (const query of searchQueries) {
            try {
              const results = await this.services.globalRagService.searchRelevantContext(query, 3);
              if (results && results.length > 0) {
                allSearchResults.push(...results);
              }
            } catch (error) {
              console.error(`📚 [CONTEXT] Search failed for query "${query}":`, error);
            }
          }
          
          // Remove duplicates and get best results
          const uniqueResults = allSearchResults.filter((result, index, array) => 
            array.findIndex(r => r.id === result.id) === index
          );
          
          // Sort by score and take top 5
          const topResults = uniqueResults
            .sort((a, b) => (b.score || 0) - (a.score || 0))
            .slice(0, 5);
          
          if (topResults.length > 0) {
            // Process and clean up the context
            globalContext = topResults
              .map(result => {
                let text = result.text.trim();
                // Clean up the text - remove excessive whitespace and format nicely
                text = text.replace(/\s+/g, ' ').trim();
                // Ensure it ends with proper punctuation
                if (text.length > 0 && !text.match(/[.!?]$/)) {
                  text += '.';
                }
                return text;
              })
              .filter(text => text.length > 10) // Filter out very short results
              .join('\n\n');
              
            console.log(`📚 [CONTEXT] Found ${topResults.length} relevant documents from global RAG (${globalContext.length} characters)`);
          } else {
            console.log(`📚 [CONTEXT] No relevant context found in global RAG after searching ${searchQueries.length} queries`);
          }
        } else {
          console.log(`📚 [CONTEXT] Global RAG service not ready, skipping global context search`);
        }
      } catch (error) {
        console.error(`📚 [CONTEXT] Error searching global RAG:`, error);
      }

      // Build comprehensive context message
      let contextMessage = `🎯 **INTERVIEW SESSION STARTED**\n\n`;
      contextMessage += `**Role:** ${profession}\n`;
      contextMessage += `**Interview Type:** ${interviewType}\n\n`;
      
      if (userContext) {
        contextMessage += `**Interview Context:**\n${userContext}\n\n`;
      }
      
      if (globalContext) {
        contextMessage += `**Your Background & Experience (from resume/documents):**\n${globalContext}\n\n`;
      }
      
      contextMessage += `**Instructions:**\n`;
      contextMessage += `You are a very good assistant helping me in answering  questions which will come in interview the interview is for ${profession} ${interviewType} interview. `;
      contextMessage += `Please provide expert guidance,  questions answer throughout our session. `;
      contextMessage += `Use the context above to personalize your responses and give relevant advice based on my background and the interview requirements.\n\n`;
      contextMessage += `**Ready to star keep the context with you whenever i send you question of interview give me the best answer !** `;

      // Send the context message to ChatService
      const chatResult = await this.services.chatService.sendMessage(sessionId, contextMessage, true); // true indicates this is an initialization message
      
      // Send the initial context message to the session window
      const sessionWindow = this.sessionWindows.get(sessionId);
      if (sessionWindow && !sessionWindow.isDestroyed()) {
        // Send the user's context message
        sessionWindow.webContents.send('chat-response', {
          sessionId,
          content: contextMessage,
          timestamp: new Date().toISOString(),
          source: 'context-initialization'
        });

      // Send AI's response
      sessionWindow.webContents.send('chat-response', {
        sessionId,
        content: chatResult.response,
        timestamp: new Date().toISOString(),
        source: 'ai-initialization'
      });
    }

    // 🎯 CRITICAL FIX: Initialize session RAG settings in ChatService
    this.services.chatService.initializeSessionRAG(sessionId);
    console.log(`🤖 [CONTEXT] Session RAG initialized for ${sessionId}`);

    console.log(`🤖 [CONTEXT] Chat session initialized successfully for ${sessionId}`);
  } catch (error) {
    console.error(`🤖 [CONTEXT] Error initializing chat session with context:`, error);
  }
}

  /**
   * Count supported files in a directory for feedback
   */
  private async countSupportedFiles(folderPath: string): Promise<number> {
    try {
      const supportedExtensions = ['.txt', '.md', '.pdf', '.docx', '.doc'];
      let count = 0;
      
      const countFilesRecursive = async (dirPath: string) => {
        const entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dirPath, entry.name);
          
          if (entry.isDirectory()) {
            await countFilesRecursive(fullPath);
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            if (supportedExtensions.includes(ext)) {
              count++;
            }
          }
        }
      };
      
      await countFilesRecursive(folderPath);
      return count;
      
    } catch (error) {
      console.error('Error counting supported files:', error);
      return 0;
    }
  }
  
  /**
   * Start capturing global mouse clicks for coordinate selection using a simplified approach
   */
  private startGlobalMouseCapture(sessionId: string, event: Electron.IpcMainEvent): void {
    console.log(`🖱️ [MOUSE-CAPTURE] Starting global mouse capture for session: ${sessionId}`);
    
    // Initialize capture state for this session
    this.mouseCaptureSessions.set(sessionId, {
      event,
      clickCount: 0,
      coordinates: []
    });
    
    // Create a simple overlay window approach for mouse capture
    this.createMouseCaptureOverlay(sessionId);
    
    // Set a timeout to auto-stop capture after 30 seconds
    setTimeout(() => {
      if (this.mouseCaptureSessions.has(sessionId)) {
        console.log(`⏰ [MOUSE-CAPTURE] Auto-stopping mouse capture for session: ${sessionId} (timeout)`);
        this.stopGlobalMouseCapture(sessionId);
        
        // Send timeout message to renderer
        const captureSession = this.mouseCaptureSessions.get(sessionId);
        if (captureSession) {
          captureSession.event.reply('coordinate-capture-timeout', {
            sessionId,
            message: 'Mouse capture timed out after 30 seconds'
          });
        }
      }
    }, 30000);
  }
  
  /**
   * Create a transparent overlay for mouse capture
   */
  private createMouseCaptureOverlay(sessionId: string): void {
    console.log(`🖱️ [OVERLAY] Creating mouse capture overlay for session: ${sessionId}`);
    
    const { BrowserWindow, screen } = require('electron');
    const primaryDisplay = screen.getPrimaryDisplay();
    
    // Get both full screen size and work area for debugging
    const fullScreenSize = primaryDisplay.size;
    const workAreaSize = primaryDisplay.workAreaSize;
    const workAreaBounds = primaryDisplay.workArea;
    
    console.log(`🖱️ [OVERLAY-DEBUG] Full screen size: ${fullScreenSize.width}x${fullScreenSize.height}`);
    console.log(`🖱️ [OVERLAY-DEBUG] Work area size: ${workAreaSize.width}x${workAreaSize.height}`);
    console.log(`🖱️ [OVERLAY-DEBUG] Work area bounds:`, workAreaBounds);
    
    // Calculate the offset from work area to full screen (menu bar height)
    const menuBarHeight = workAreaBounds.y;
    console.log(`🖱️ [OVERLAY-DEBUG] Menu bar height offset: ${menuBarHeight}px`);
    
    // Create a fullscreen transparent window to capture clicks
    const overlay = new BrowserWindow({
      width: fullScreenSize.width,
      height: fullScreenSize.height,
      x: 0,
      y: 0,
      transparent: true,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      closable: false,
      focusable: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true
      }
    });
    
    // Load minimal HTML for the overlay
    overlay.loadURL('data:text/html,<html><body style="background:transparent;cursor:default;"></body></html>');
    
    // Store overlay reference
    const captureSession = this.mouseCaptureSessions.get(sessionId);
    if (captureSession) {
      (captureSession as any).overlay = overlay;
    }
    
    // Listen for mouse events on the overlay window using multiple approaches
    console.log(`🖱️ [OVERLAY] Setting up mouse event listeners...`);
    
    // Approach 1: Use webContents mouse events
    overlay.webContents.on('dom-ready', () => {
      console.log(`🖱️ [OVERLAY] DOM ready, injecting click handler...`);
      
      // Inject a script to capture clicks
      overlay.webContents.executeJavaScript(`
        document.addEventListener('click', (event) => {
          console.log('Overlay clicked at:', event.clientX, event.clientY);
          // Send click coordinates to main process
          window.postMessage({
            type: 'overlay-click',
            x: event.screenX,
            y: event.screenY
          });
        });
        
        // Make sure the body can receive clicks
        document.body.style.pointerEvents = 'auto';
        document.body.style.cursor = 'default';
        
        console.log('Overlay click handler injected');
      `);
    });
    
    // Listen for messages from the injected script
    overlay.webContents.on('console-message', (event, level, message) => {
      console.log(`🖱️ [OVERLAY-CONSOLE]`, message);
    });
    
    // Alternative approach: Direct mouse position polling
    const mousePoller = setInterval(() => {
      if (overlay.isDestroyed()) {
        clearInterval(mousePoller);
        return;
      }
      
      // Check if overlay window is focused and get mouse position
      if (overlay.isFocused()) {
        const mousePos = screen.getCursorScreenPoint();
        const overlayBounds = overlay.getBounds();
        
        // Check if mouse is within overlay bounds
        if (mousePos.x >= overlayBounds.x && 
            mousePos.x < overlayBounds.x + overlayBounds.width &&
            mousePos.y >= overlayBounds.y && 
            mousePos.y < overlayBounds.y + overlayBounds.height) {
          // Mouse is over overlay - wait for click
        }
      }
    }, 100);
    
    // Store poller reference for cleanup
    (overlay as any).mousePoller = mousePoller;
    
    // Approach 3: Listen for native mouse events
    overlay.webContents.on('before-input-event', (event, input) => {
      console.log(`🖱️ [OVERLAY] Input event:`, input.type, input.key);
      if (input.type === 'mouseDown' && input.key === 'Left') {
        const mousePos = screen.getCursorScreenPoint();
        console.log(`🖱️ [OVERLAY-CLICK] Mouse click at (${mousePos.x}, ${mousePos.y}) for session: ${sessionId}`);
        this.handleMouseClick(sessionId, mousePos.x, mousePos.y);
      }
    });
    
    // Approach 4: Use window click event
    overlay.on('focus', () => {
      console.log(`🖱️ [OVERLAY] Overlay gained focus`);
    });
    
    overlay.webContents.on('did-finish-load', () => {
      console.log(`🖱️ [OVERLAY] Overlay finished loading`);
      // Try to capture mouse events via JavaScript with coordinate correction
      overlay.webContents.executeJavaScript(`
        let clickCount = 0;
        const menuBarOffset = ${menuBarHeight}; // Menu bar height offset from Electron
        
        console.log('Overlay loaded with menu bar offset:', menuBarOffset);
        
        document.addEventListener('mousedown', (e) => {
          // Calculate corrected coordinates
          // e.clientX, e.clientY are relative to the overlay window
          // Since overlay starts at (0,0) of full screen, we can use them directly
          const correctedX = e.clientX;
          const correctedY = e.clientY;
          
          console.log('Raw coordinates - clientX:', e.clientX, 'clientY:', e.clientY);
          console.log('Screen coordinates - screenX:', e.screenX, 'screenY:', e.screenY);
          console.log('Corrected coordinates:', correctedX, correctedY);
          
          clickCount++;
          
          // Use IPC to send click to main process with corrected coordinates
          if (window.require) {
            const { ipcRenderer } = window.require('electron');
            ipcRenderer.send('overlay-click', {
              sessionId: '${sessionId}',
              x: correctedX,
              y: correctedY,
              clickCount: clickCount
            });
          }
        });
        
        console.log('Mouse event listener added to overlay with coordinate correction');
      `);
    });
    
    // Also listen for click events directly
    overlay.on('closed', () => {
      console.log(`🖱️ [OVERLAY] Overlay closed for session: ${sessionId}`);
      this.stopGlobalMouseCapture(sessionId);
    });
    
    console.log(`🖱️ [OVERLAY] Overlay created and listening for clicks`);
  }
  
  /**
   * Handle a mouse click during coordinate capture
   */
  private handleMouseClick(sessionId: string, x: number, y: number): void {
    const captureSession = this.mouseCaptureSessions.get(sessionId);
    if (!captureSession) {
      console.log(`🖱️ [CLICK] No capture session found for: ${sessionId}`);
      return;
    }
    
    captureSession.clickCount++;
    captureSession.coordinates.push({ x, y });
    
    console.log(`🖱️ [CLICK-CAPTURED] Point ${captureSession.clickCount}: (${x}, ${y}) for session: ${sessionId}`);
    
    // Send coordinate back to renderer
    const sessionWindow = this.sessionWindows.get(sessionId);
    if (sessionWindow && !sessionWindow.isDestroyed()) {
      sessionWindow.webContents.send('coordinate-captured', {
        sessionId,
        x,
        y,
        clickCount: captureSession.clickCount
      });
    }
    
    // If we've captured 2 points, immediately stop capturing and start area capture
    if (captureSession.clickCount >= 2) {
      console.log(`🖱️ [COMPLETE] Captured both coordinates for session: ${sessionId}`);
      
      // Immediately stop mouse capture before starting area capture
      this.stopGlobalMouseCapture(sessionId);
      
      // Trigger area capture with the collected coordinates
      const coords = captureSession.coordinates;
      if (coords.length >= 2) {
        console.log(`🔲 [AREA-CAPTURE] Starting area capture with coordinates: (${coords[0].x}, ${coords[0].y}) to (${coords[1].x}, ${coords[1].y})`);
        
        // Trigger area capture via the session window
        if (sessionWindow && !sessionWindow.isDestroyed()) {
          sessionWindow.webContents.send('trigger-area-capture', {
            sessionId,
            coordinates: {
              x1: coords[0].x,
              y1: coords[0].y,
              x2: coords[1].x,
              y2: coords[1].y
            }
          });
        }
      }
    }
  }
  
  /**
   * Stop capturing global mouse clicks for coordinate selection
   */
  private stopGlobalMouseCapture(sessionId: string): void {
    console.log(`🖱️ [MOUSE-CAPTURE] Stopping global mouse capture for session: ${sessionId}`);
    
    const captureSession = this.mouseCaptureSessions.get(sessionId);
    if (captureSession) {
      // Close the overlay window if it exists
      const overlay = (captureSession as any).overlay;
      if (overlay && !overlay.isDestroyed()) {
        console.log(`🖱️ [OVERLAY] Forcefully destroying overlay window for session: ${sessionId}`);
        
        // Clear any polling intervals
        const mousePoller = (overlay as any).mousePoller;
        if (mousePoller) {
          clearInterval(mousePoller);
          console.log(`🖱️ [OVERLAY] Mouse poller cleared for session: ${sessionId}`);
        }
        
        // Remove all event listeners before closing
        try {
          overlay.webContents.removeAllListeners();
          overlay.removeAllListeners();
          console.log(`🖱️ [OVERLAY] Event listeners removed for session: ${sessionId}`);
        } catch (error) {
          console.error(`⚠️ [OVERLAY] Error removing listeners:`, error);
        }
        
        // Force close and destroy the overlay window
        try {
          overlay.destroy();
          console.log(`🖱️ [OVERLAY] Overlay window forcefully destroyed for session: ${sessionId}`);
        } catch (error) {
          console.error(`⚠️ [OVERLAY] Error destroying overlay:`, error);
          // Try alternative close method
          try {
            overlay.close();
            console.log(`🖱️ [OVERLAY] Overlay window closed (fallback) for session: ${sessionId}`);
          } catch (closeError) {
            console.error(`⚠️ [OVERLAY] Failed to close overlay:`, closeError);
          }
        }
      }
      
      // Remove the capture session
      this.mouseCaptureSessions.delete(sessionId);
      console.log(`🖱️ [CLEANUP] Mouse capture session cleaned up for: ${sessionId}`);
    } else {
      console.log(`⚠️ [MOUSE-CAPTURE] No capture session found to stop for: ${sessionId}`);
    }
  }
}
