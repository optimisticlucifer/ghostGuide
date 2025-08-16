import { ipcMain, dialog, BrowserWindow } from 'electron';
import OpenAI from 'openai';
import { GlobalRAGService } from '../services/GlobalRAGService';
import { ChatService } from '../services/ChatService';
import { AudioService } from '../services/AudioService';
import { RAGService } from '../services/RAGService';
import { OCRService } from '../services/OCRService';
import { CaptureService } from '../services/CaptureService';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { SessionManager } from '../services/SessionManager';
import { WindowManager } from '../services/WindowManager';
import { AudioSource } from '../types';

export interface IPCServices {
  globalRagService: GlobalRAGService;
  chatService: ChatService;
  audioService: AudioService;
  ragService: RAGService;
  ocrService: OCRService;
  captureService: CaptureService;
  configurationManager: ConfigurationManager;
  sessionManager: SessionManager;
  windowManager: WindowManager;
  openai: OpenAI | null;
}

export class IPCController {
  private services: IPCServices;
  private sessionWindows: Map<string, BrowserWindow>;
  private sessions: Map<string, any>;
  private createSessionWindowCallback?: (sessionId: string, config: any) => BrowserWindow;

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

          aiResponse = await this.services.chatService.sendMessage(sessionId, contextualMessage);
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

        // Step 3: Generate AI analysis using OpenAI
        let aiAnalysis = '';
        if (this.services.openai && session) {
          console.log(`🤖 [AI] Using OpenAI for screenshot analysis (${session.profession} ${session.interviewType})`);
          aiAnalysis = await this.generateOpenAIScreenshotAnalysis(ocrText, session.profession, session.interviewType);
        } else {
          console.log(`⚠️ [AI] No OpenAI client available, using fallback analysis`);
          aiAnalysis = this.generateFallbackAnalysis(ocrText, session?.profession || 'software-engineer', session?.interviewType || 'technical');
        }

        console.log(`📷 [IPC] Sending OCR result for session ${sessionId}`);

        event.reply('ocr-result', {
          sessionId,
          text: ocrText,
          analysis: aiAnalysis,
          debugInfo: {
            ocrText: ocrText,
            profession: session?.profession || 'unknown',
            interviewType: session?.interviewType || 'unknown',
            hasOpenAI: !!this.services.openai,
            analysisLength: aiAnalysis.length
          },
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.log(`❌ [OCR] Screenshot processing failed: ${(error as Error).message}`);

        event.reply('ocr-result', {
          sessionId,
          text: 'Screenshot capture failed',
          analysis: 'I encountered an error while capturing and analyzing the screenshot. Please try again or check your system permissions.',
          timestamp: new Date().toISOString()
        });
      }
    });

    ipcMain.on('debug-code', async (event, data) => {
      const { sessionId } = data;
      const session = this.sessions.get(sessionId);
      console.log(`🐛 [IPC] Code debug requested for session: ${sessionId}`);

      try {
        const screenshot = await this.services.captureService.captureScreen();
        const ocrText = await this.services.ocrService.extractText(screenshot);

        let debugAnalysis = '';
        if (this.services.openai && session) {
          console.log(`🤖 [DEBUG] Using OpenAI for debug analysis (${session.profession} ${session.interviewType})`);
          
          const systemPrompt = `You are an expert code reviewer and debugging assistant specializing in ${session.profession} interviews.
                        Given the OCR-extracted error context below (including failing examples and error messages), extract the failure details and provide only the corrected, fully working code.
                        Analyze the following code and provide comprehensive debugging guidance:

                        CODE: "${ocrText}"

                        Provide a detailed response that includes:
                        1. Code analysis and potential issues
                        2. Bug identification and explanations
                        3. Suggested fixes with code examples 
                        4. Best practices and improvements
                        5. Edge cases to consider
                        6. give full working code according to the language the question is asked or according to the template given in ocr text

                        Format your response with clear sections and use markdown for better readability. Be specific and actionable.`;

          const completion = await this.services.openai.chat.completions.create({
            model: 'gpt-4',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Please debug this code: ${ocrText}` }
            ],
            max_tokens: 1500,
            temperature: 0.3
          });

          debugAnalysis = completion.choices[0].message.content || 'Unable to generate debug analysis';
        } else {
          console.log(`⚠️ [DEBUG] No OpenAI client available, using fallback analysis`);
          debugAnalysis = this.generateFallbackDebugAnalysis(ocrText, session?.profession || 'software-engineer');
        }

        console.log(`🐛 [IPC] Sending debug result for session ${sessionId}`);

        event.reply('debug-result', {
          sessionId,
          text: ocrText,
          analysis: debugAnalysis,
          timestamp: new Date().toISOString()
        });

      } catch (error) {
        console.log(`❌ [DEBUG] Debug processing failed: ${(error as Error).message}`);

        event.reply('debug-result', {
          sessionId,
          text: 'Debug capture failed',
          analysis: 'I encountered an error while capturing and analyzing the code. Please try again or check your system permissions.',
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

              // Process with AI if available
              if (this.services.openai && session) {
                try {
                  const systemPrompt = `You are an expert interview coach specializing in ${session.profession} ${session.interviewType} interviews. The user has just provided their response to a question.`;
                  
                  const coachingRequest = `🗣️ **MY INTERVIEW RESPONSE REVIEW:**\n\n"${transcription}"\n\nThis is what I just said in response. Please analyze and provide:\n\n1. **Assessment** – Did I correctly understand and address the question?\n\n2. **Strengths** – What I did well in terms of content, clarity, and delivery.\n\n3. **Improvements** – Specific areas where I can be clearer, more structured, or more concise.\n\n4. **Polished Version** – Rewrite a strong, spoken-style version of my answer that I can say next time.\n\n5. **Follow-up Suggestions** – Any additional points or questions I could raise to show depth.\n\n\nEvaluate this in the context of a **${session.profession}** role during a **${session.interviewType}** interview.`;

                  const completion = await this.services.openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: coachingRequest }
                    ],
                    max_tokens: 800,
                    temperature: 0.7
                  });
                  
                  const aiResponse = completion.choices[0].message.content || 'Unable to generate analysis';
                  
                  if (sessionWindow && !sessionWindow.isDestroyed()) {
                    sessionWindow.webContents.send('chat-response', {
                      sessionId,
                      content: `🤖 **AI Feedback:** ${aiResponse}`,
                      timestamp: new Date().toISOString(),
                      source: 'audio-transcription'
                    });
                  }
                } catch (error) {
                  console.error(`Failed to process mic audio transcription: ${error}`);
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

              // Process with AI for system audio (interviewer questions)
              if (this.services.openai && session) {
                try {
                  const systemPrompt = `You are an expert interview coach specializing in ${session.profession} ${session.interviewType} interviews. The interviewer just asked a question.`;
                  
                  const coachingRequest = `🧠 **INTERVIEW QUESTION DETECTED:**\n\n"${transcription}"\n\nPlease analyze this question and provide:\n\n1. **Question Type** – Is this a theoretical, behavioral, or coding question?\n\n2. **What the interviewer is expecting** – What should a strong answer include?\n\n3. **Answer Structure** – Step-by-step breakdown of how to respond effectively.\n\n4. ** Answer** – A clear and detailed answer I can say directly in the interview.if there is code asked the give the code too its important.\n\n5. **Follow-up Advice** – Any clarifying questions I should ask or pitfalls to avoid.\n\n\nTailor everything specifically for a **${session.profession}** role in a **${session.interviewType}** interview.`;

                  const completion = await this.services.openai.chat.completions.create({
                    model: 'gpt-3.5-turbo',
                    messages: [
                      { role: 'system', content: systemPrompt },
                      { role: 'user', content: coachingRequest }
                    ],
                    max_tokens: 800,
                    temperature: 0.7
                  });
                  
                  const aiResponse = completion.choices[0].message.content || 'Unable to generate analysis';
                  
                  if (sessionWindow && !sessionWindow.isDestroyed()) {
                    sessionWindow.webContents.send('chat-response', {
                      sessionId,
                      content: `🤖 **AI Interview Coach:** ${aiResponse}`,
                      timestamp: new Date().toISOString(),
                      source: 'system-audio-transcription'
                    });
                  }
                } catch (error) {
                  console.error(`Failed to process system audio transcription: ${error}`);
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
    ipcMain.on('save-api-key', async (event, apiKey) => {
      console.log('🔑 [IPC] Saving API key...');
      try {
        await this.services.configurationManager.updateApiKey(apiKey);
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
  }

  // Helper methods for AI analysis
  private async generateOpenAIScreenshotAnalysis(ocrText: string, profession: string, interviewType: string): Promise<string> {
    if (!this.services.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const systemPrompt = `You are an intelligent assistant that processes OCR-scanned exam or assignment text. Your job is to extract **each individual question** and provide structured answers accordingly in ${profession} ${interviewType} interviews.

Analyze the following interview question and provide comprehensive guidance.

Provide a detailed response that includes:
1. Carefully read the OCR text below.
2. Identify and number each question in the format "Question 1", "Question 2", etc.
3. Problem analysis and approach
4. Step-by-step solution strategy
5. Code implementation (if applicable and provide code in the language the question is asked or according to the template given in ocr text) - ALWAYS include working code examples
6. Time and space complexity analysis
7. Edge cases to consider
8. Interview tips and best practices

Format your response with clear sections and use markdown for better readability. Be specific and actionable. ALWAYS include actual code implementations.`;

    const userPrompt = `You are an intelligent assistant that processes OCR-scanned exam or assignment text. Your job is to extract **each individual question** and provide structured answers accordingly in ${profession} ${interviewType} interviews.

Instructions:
1. Carefully read the OCR text below.
2. Identify and number each question in the format "Question 1", "Question 2", etc.
3. If the question is an MCQ (Multiple Choice Question), identify the correct option and output it as:
  Question X: Answer is (Option Letter) - (Full Answer Text)
4. If the question is not MCQ, summarize or explain the answer concisely.
5. Use the following format for each question:
  Question X: Answer is ---- [your answer]
6. If the question is a coding question, provide the code in the language the question is asked or according to the template given in OCR text.

OCR Extracted Text:
---
${ocrText}
---

Return only the structured answers for each question in the above format. Do not include any additional commentary or explanations.`;

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
    return `📸 **Interview Question Analysis**

**Question Detected:** ${ocrText}

**Analysis for ${profession} - ${interviewType} Interview:**

**Approach:**
• Break down the problem into smaller components
• Identify the core requirements and constraints
• Consider time and space complexity implications
• Think about edge cases and error handling

**General Strategy:**
1. **Clarify Requirements** - Ask questions about input/output format
2. **Plan Your Approach** - Discuss algorithm choice and data structures
3. **Implement Step by Step** - Code incrementally with explanations
4. **Test and Optimize** - Verify with examples and optimize if needed

**Interview Tips:**
• Think out loud during problem solving
• Start with a brute force solution, then optimize
• Discuss trade-offs between different approaches
• Test your solution with edge cases

**⚠️ Note:** This is a basic analysis. For personalized, AI-powered assistance with detailed code examples and specific guidance, please configure your OpenAI API key in Settings.

**Next Steps:**
1. Go to Settings (⚙️ button)
2. Add your OpenAI API key
3. Get intelligent, context-aware analysis for every screenshot!`;
  }

  private generateFallbackDebugAnalysis(ocrText: string, profession: string): string {
    return `🐛 **Code Debug Analysis**

**Code Detected:** ${ocrText}

**Debug Analysis for ${profession}:**

**Potential Issues to Check:**
• **Null Pointer Exceptions** - Check for null references before use
• **Array Bounds** - Verify array indices are within valid range
• **Logic Errors** - Review conditional statements and loops
• **Memory Leaks** - Ensure proper resource cleanup
• **Type Mismatches** - Verify variable types and conversions

**Common Debugging Steps:**
1. **Add Logging** - Insert debug statements to trace execution
2. **Check Inputs** - Validate all input parameters
3. **Test Edge Cases** - Try boundary conditions and null inputs
4. **Review Algorithms** - Verify logic matches intended behavior
5. **Use Debugger** - Step through code line by line

**Best Practices:**
• Use meaningful variable names
• Add proper error handling
• Write unit tests for functions
• Document complex logic
• Follow coding standards

**⚠️ Note:** This is a basic debug analysis. For detailed, AI-powered code review with specific bug identification and fixes, please configure your OpenAI API key in Settings.

**Next Steps:**
1. Go to Settings (⚙️ button)
2. Add your OpenAI API key
3. Get intelligent, context-aware debugging assistance!`;
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
          
          // Build search query from user context and profession/interview type
          const searchQueries = [
            `${profession} ${interviewType}`,
            userContext || '',
            `resume experience ${profession}`,
            `skills ${profession}`,
            'background experience'
          ].filter(q => q.trim().length > 0);

          const searchResults = await this.services.globalRagService.searchRelevantContext(searchQueries.join(' '), 5);
          
          if (searchResults && searchResults.length > 0) {
            globalContext = searchResults.map(result => result.text).join('\n\n');
            console.log(`📚 [CONTEXT] Found ${searchResults.length} relevant documents from global RAG`);
          } else {
            console.log(`📚 [CONTEXT] No relevant context found in global RAG`);
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
      contextMessage += `You are a very good assistant helping me prepare for this ${profession} ${interviewType} interview. `;
      contextMessage += `Please provide expert guidance, practice questions, and coaching throughout our session. `;
      contextMessage += `Use the context above to personalize your responses and give relevant advice based on my background and the interview requirements.\n\n`;
      contextMessage += `**Ready to start!** 🚀`;

      // Send the context message to ChatService
      const aiResponse = await this.services.chatService.sendMessage(sessionId, contextMessage, true); // true indicates this is an initialization message
      
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
          content: aiResponse,
          timestamp: new Date().toISOString(),
          source: 'ai-initialization'
        });
      }

      console.log(`🤖 [CONTEXT] Chat session initialized successfully for ${sessionId}`);
    } catch (error) {
      console.error(`🤖 [CONTEXT] Error initializing chat session with context:`, error);
    }
  }
}
