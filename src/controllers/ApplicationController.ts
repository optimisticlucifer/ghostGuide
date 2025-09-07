import { app, BrowserWindow, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import OpenAI from 'openai';

// Services
import { GlobalRAGService } from '../services/GlobalRAGService';
import { LocalRAGService } from '../services/LocalRAGService';
import { ChatService } from '../services/ChatService';
import { AudioService } from '../services/AudioService';
import { RAGService } from '../services/RAGService';
import { OCRService } from '../services/OCRService';
import { CaptureService } from '../services/CaptureService';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { PromptLibraryService } from '../services/PromptLibraryService';
import { SessionManager } from '../services/SessionManager';
import { ScreenSharingDetectionService } from '../services/ScreenSharingDetectionService';
import { WindowManager } from '../services/WindowManager';
import { IPCController, IPCServices } from './IPCController';
import { AudioSource, ActionType } from '../types';

export interface ApplicationConfig {
  stealthMode?: boolean;
  debug?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

export class ApplicationController {
  private store: Store;
  private openai: OpenAI | null = null;
  private logFilePath: string;
  private isScreenSharingActive = false;
  private config: ApplicationConfig;

  // Services
  private services: {
    globalRagService: GlobalRAGService;
    localRagService: LocalRAGService;
    chatService: ChatService;
    audioService: AudioService;
    ragService: RAGService;
    ocrService: OCRService;
    captureService: CaptureService;
    configurationManager: ConfigurationManager;
    promptLibraryService: PromptLibraryService;
    sessionManager: SessionManager;
    screenSharingDetectionService?: ScreenSharingDetectionService;
    windowManager: WindowManager;
  };

  // Controllers
  private ipcController: IPCController;

  // UI State
  private mainWindow: BrowserWindow | null = null;
  private sessionWindows: Map<string, BrowserWindow> = new Map();
  private settingsWindow: BrowserWindow | null = null;
  private sessions: Map<string, any> = new Map();

  constructor(config: ApplicationConfig = {}) {
    this.config = { stealthMode: true, debug: false, logLevel: 'info', ...config };

    // Ensure Application Support directory uses "system Assistant"
    try {
      const desiredUserData = path.join(app.getPath('appData'), 'system Assistant');
      if (!fs.existsSync(desiredUserData)) {
        fs.mkdirSync(desiredUserData, { recursive: true });
      }
      app.setPath('userData', desiredUserData);
      // Optionally set app name to align with folder naming
      try { (app as any).setName?.('system Assistant'); } catch {}
    } catch (e) {
      console.warn('Failed to override userData path:', e);
    }

    this.store = new Store();
    
    this.initializeLogging();
    this.initializeServices();
    this.setupApplicationEvents();
  }

  /**
   * Initialize the application
   */
  async initialize(): Promise<void> {
    this.writeLog('🚀 [APP] Starting Interview Assistant...');

    try {
      // Initialize services asynchronously
      await this.initializeServicesAsync();

      // Initialize OpenAI
      this.initializeOpenAI();

      // Setup IPC communication
      this.setupIPC();

      // Setup stealth mode and security
      if (this.config.stealthMode) {
        await this.setupStealthMode();
      }

      // Register global hotkeys
      this.setupGlobalHotkeys();

      this.writeLog('✅ [APP] Application initialized successfully');
    } catch (error) {
      this.writeLog(`❌ [APP] Application initialization failed: ${(error as Error).message}`);
      throw error;
    }
  }

  /**
   * Create and show the main window
   */
  createMainWindow(): BrowserWindow {
    this.writeLog('🪟 [APP] Creating main window...');

    this.mainWindow = new BrowserWindow({
      width: 300,
      height: 500,
      minWidth: 250,
      minHeight: 400,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false,
        offscreen: false
      },
      title: 'Interview Assistant',
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: true,
      frame: false,
      transparent: true,
      hasShadow: false,
      focusable: true,
      minimizable: false,
      maximizable: false,
      closable: true,
      movable: true,
      hiddenInMissionControl: true,
      fullscreenable: false,
      titleBarStyle: 'hidden',
      vibrancy: 'under-window',
      visualEffectState: 'inactive',
      opacity: 1,
      acceptFirstMouse: true
    });

    // Ensure always-on-top across full-screen spaces
    try {
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
      this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch (e) {
      this.writeLog(`⚠️ [APP] Failed to apply full-screen visibility settings to main window: ${(e as Error).message}`);
    }

    // Load main window content
    this.loadMainWindowContent();

    // Set up window event handlers
    this.setupMainWindowEvents();

    // Apply content protection for stealth mode
    if (this.config.stealthMode) {
      this.mainWindow.setContentProtection(true);
      if (process.platform === 'darwin' && (this.mainWindow as any).setSharingType) {
        (this.mainWindow as any).setSharingType('none');
      }
    }

    // Ensure main window gets focus, especially when launched from Finder
    setTimeout(() => {
      try {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
          this.mainWindow.show();
          this.mainWindow.focus();
          this.mainWindow.moveTop();
          
          // On macOS, also activate the app to ensure it comes to foreground
          if (process.platform === 'darwin') {
            app.focus({ steal: true });
          }
          
          this.writeLog('🪟 [APP] Main window brought to foreground');
        }
      } catch (error) {
        this.writeLog(`⚠️ [APP] Failed to focus main window: ${(error as Error).message}`);
      }
    }, 200);

    this.writeLog('✅ [APP] Main window created successfully');
    return this.mainWindow;
  }

  /**
   * Create a new session window
   */
  createSessionWindow(sessionId: string, config: any): BrowserWindow {
    this.writeLog(`🪟 [APP] Creating session window for ${sessionId}: ${JSON.stringify(config)}`);

    const sessionWindow = new BrowserWindow({
      width: 400,
      height: 400,
      minWidth: 300,
      minHeight: 300,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        backgroundThrottling: false,
        offscreen: false
      },
      title: `${config.profession} - ${config.interviewType}`,
      resizable: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      show: true,
      frame: true,
      transparent: false,
      hasShadow: true,
      focusable: true,
      minimizable: true,
      maximizable: true,
      closable: true,
      movable: true,
      hiddenInMissionControl: true,
      fullscreenable: false,
      titleBarStyle: 'default',
      acceptFirstMouse: true
    });

    // Ensure always-on-top across full-screen spaces
    try {
      sessionWindow.setAlwaysOnTop(true, 'screen-saver');
      sessionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } catch (e) {
      this.writeLog(`⚠️ [APP] Failed to apply full-screen visibility settings to session window: ${(e as Error).message}`);
    }

    // Load session window content
    this.loadSessionWindowContent(sessionWindow, sessionId, config);

    // Set up window event handlers
    this.setupSessionWindowEvents(sessionWindow, sessionId);

    // Apply content protection for stealth mode
    if (this.config.stealthMode) {
      sessionWindow.setContentProtection(true);
      if (process.platform === 'darwin' && (sessionWindow as any).setSharingType) {
        (sessionWindow as any).setSharingType('none');
      }
    }

    // Store session window and data
    this.sessionWindows.set(sessionId, sessionWindow);
    this.sessions.set(sessionId, {
      ...config,
      chatHistory: [],
      isRecording: false,
      isSystemRecording: false,
      hasRAG: false
    });
    
    // Initialize Local RAG database for this session
    try {
      this.services.localRagService.createSessionDatabase(sessionId);
      this.writeLog(`✅ [APP] Local RAG database initialized for session: ${sessionId}`);
    } catch (error) {
      this.writeLog(`⚠️ [APP] Failed to initialize Local RAG database for session ${sessionId}: ${(error as Error).message}`);
    }

    // Ensure proper window focus and visibility
    setTimeout(() => {
      try {
        if (!sessionWindow.isDestroyed()) {
          sessionWindow.show();
          sessionWindow.focus();
          sessionWindow.moveTop();
          this.writeLog(`🪟 [APP] Session window focused and moved to top: ${sessionId}`);
        }
      } catch (error) {
        this.writeLog(`⚠️ [APP] Failed to focus session window ${sessionId}: ${(error as Error).message}`);
      }
    }, 100);

    this.writeLog(`✅ [APP] Session window created successfully: ${sessionId}`);
    return sessionWindow;
  }

  /**
   * Get service instances (for external access)
   */
  getServices(): IPCServices {
    return {
      globalRagService: this.services.globalRagService,
      localRagService: this.services.localRagService,
      chatService: this.services.chatService,
      audioService: this.services.audioService,
      ragService: this.services.ragService,
      ocrService: this.services.ocrService,
      captureService: this.services.captureService,
      configurationManager: this.services.configurationManager,
      sessionManager: this.services.sessionManager,
      windowManager: this.services.windowManager,
      promptLibraryService: this.services.promptLibraryService,
      openai: this.openai
    };
  }

  /**
   * Clean shutdown
   */
  async shutdown(): Promise<void> {
    this.writeLog('🧹 [APP] Starting application cleanup...');

    try {
      // Stop screen sharing detection
      if (this.services.screenSharingDetectionService) {
        this.services.screenSharingDetectionService.stop();
        this.writeLog('✅ [APP] Screen sharing detection stopped');
      }

      // Unregister global shortcuts
      globalShortcut.unregisterAll();
      this.writeLog('✅ [APP] Global shortcuts unregistered');

      // Close all services
      await this.services.globalRagService.close();
      
      this.writeLog('✅ [APP] Application cleanup completed');
    } catch (error) {
      this.writeLog(`❌ [APP] Cleanup failed: ${(error as Error).message}`);
    }
  }

  // Private methods
  private initializeLogging(): void {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    const date = new Date().toISOString().split('T')[0];
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFilePath = path.join(logsDir, `interview-assistant-${date}-${timestamp}.log`);

    this.writeLog('🚀 [APP] Interview Assistant starting...');
    this.writeLog(`📝 [APP] Log file: ${this.logFilePath}`);
    this.writeLog(`📁 [APP] Logs directory: ${logsDir}`);
    this.writeLog(`🖥️ [APP] Platform: ${process.platform}`);
    this.writeLog(`🔢 [APP] Node version: ${process.version}`);
    
    // Log launch context to identify Finder vs terminal launch
    const launchContext = {
      TERM: process.env.TERM || 'none',
      TERM_PROGRAM: process.env.TERM_PROGRAM || 'none',
      PWD: process.env.PWD || 'none',
      isFromTerminal: !!(process.env.TERM || process.env.TERM_PROGRAM),
      parentPID: process.ppid
    };
    this.writeLog(`🚀 [APP] Launch context: ${JSON.stringify(launchContext)}`);
  }

  private writeLog(message: string): void {
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;

    try {
      fs.appendFileSync(this.logFilePath, logEntry);
    } catch (error) {
      console.error('Failed to write to log file:', error);
    }

    if (this.config.debug) {
      console.log(message);
    }
  }

  private initializeServices(): void {
    // Initialize all services
    this.services = {
      ocrService: new OCRService(),
      captureService: new CaptureService(),
      audioService: new AudioService(),
      ragService: new RAGService(),
      globalRagService: new GlobalRAGService(),
      localRagService: new LocalRAGService(),
      configurationManager: new ConfigurationManager(),
      promptLibraryService: new PromptLibraryService(),
      sessionManager: new SessionManager(),
      windowManager: new WindowManager(),
      chatService: new ChatService(
        new ConfigurationManager(),
        new PromptLibraryService(),
        new SessionManager(),
        new RAGService()
      )
    };

    // Set up service dependencies
    this.services.promptLibraryService.setConfigurationManager(this.services.configurationManager);
    
    // Re-create chatService with proper dependencies including RAG services
    this.services.chatService = new ChatService(
      this.services.configurationManager,
      this.services.promptLibraryService,
      this.services.sessionManager,
      this.services.ragService,
      this.services.localRagService,
      this.services.globalRagService
    );
  }

  private async initializeServicesAsync(): Promise<void> {
    try {
      // Initialize configuration manager first
      await this.services.configurationManager.initialize();
      
      // Add default personas
      try {
        // Check if persona already exists before adding
        const existingPersona = this.services.promptLibraryService.getPersona('quantitative-finance-engineer');
        if (!existingPersona) {
          await this.services.promptLibraryService.addPersona('quantitative-finance-engineer', 'Quantitative Finance Engineer');
          this.writeLog('✅ [APP] Added Quantitative Finance Engineer profession');
        } else {
          this.writeLog('ℹ️ [APP] Quantitative Finance Engineer profession already exists');
        }
      } catch (error) {
        this.writeLog(`ℹ️ [APP] Quantitative Finance Engineer profession: ${(error as Error).message}`);
      }
      
      // Initialize other services
      await this.services.audioService.initialize();
      await this.services.ocrService.initialize();
      
      // Initialize Global RAG service
      try {
        await this.services.globalRagService.initialize();
        this.writeLog('✅ [APP] Global RAG service initialized successfully');
      } catch (error) {
        this.writeLog(`⚠️ [APP] Global RAG service initialization failed: ${(error as Error).message}`);
      }
      
      // Initialize Local RAG service
      try {
        await this.services.localRagService.initialize();
        this.writeLog('✅ [APP] Local RAG service initialized successfully');
      } catch (error) {
        this.writeLog(`⚠️ [APP] Local RAG service initialization failed: ${(error as Error).message}`);
      }
      
      this.writeLog('✅ [APP] All services initialized successfully');
    } catch (error) {
      this.writeLog(`❌ [APP] Service initialization failed: ${(error as Error).message}`);
      throw error;
    }
  }

  private initializeOpenAI(): void {
    let apiKey = '';
    try {
      if (this.services.configurationManager.isApiKeyConfigured()) {
        apiKey = this.services.configurationManager.getApiKey();
        this.writeLog('🔑 [APP] Using API key from ConfigurationManager');
      } else {
        apiKey = this.store.get('openai-api-key') as string;
        if (apiKey) {
          this.writeLog('🔑 [APP] Found API key in Electron Store, migrating to ConfigurationManager');
          this.services.configurationManager.setApiKey(apiKey);
        }
      }
    } catch (error) {
      this.writeLog(`⚠️ [APP] Error accessing ConfigurationManager: ${(error as Error).message}`);
      apiKey = this.store.get('openai-api-key') as string;
    }

    if (apiKey && apiKey.trim().length > 0) {
      this.writeLog('🔑 [APP] Initializing OpenAI client with stored API key');
      try {
        this.openai = new OpenAI({ apiKey });
        this.writeLog('✅ [APP] OpenAI client initialized successfully');
      } catch (error) {
        this.writeLog(`❌ [APP] Failed to initialize OpenAI client: ${(error as Error).message}`);
        this.openai = null;
      }
    } else {
      this.writeLog('⚠️ [APP] No API key found - using fallback responses');
      this.openai = null;
    }
  }

  private setupIPC(): void {
    this.ipcController = new IPCController(
      this.getServices(),
      this.sessionWindows,
      this.sessions,
      (sessionId: string, config: any) => this.createSessionWindow(sessionId, config)
    );

    this.ipcController.initialize();

    // Handle session creation from IPC
    this.setupSessionCreationHandler();
  }

  private setupSessionCreationHandler(): void {
    // The IPC controller handles session creation and needs to trigger window creation
    // We need to provide a callback to create the window after session creation
    // This will be handled by adding a direct method call from IPCController
  }

  private async setupStealthMode(): Promise<void> {
    this.writeLog('🥷 [APP] Setting up stealth mode...');
    
    // Set process title
    process.title = 'systemAssistance';
    
    // Hide from dock on macOS
    if (process.platform === 'darwin') {
      app.dock?.hide();
    }

    // Start screen sharing detection
    this.startScreenSharingDetection();
  }

  private startScreenSharingDetection(): void {
    this.writeLog('🥷 [APP] Starting screen sharing detection...');
    
    this.services.screenSharingDetectionService = new ScreenSharingDetectionService(
      {
        checkInterval: 5000,
        processPatterns: [
          'zoom', 'teams', 'meet', 'webex', 'skype', 'discord',
          'obs', 'streamlabs', 'xsplit', 'wirecast', 'mmhmm',
          'loom', 'screenflow', 'camtasia', 'quicktime'
        ],
        browserPatterns: [
          'chrome.*--enable-usermedia-screen-capturing',
          'firefox.*screen',
          'safari.*screen'
        ]
      },
      (isScreenSharing: boolean) => this.handleScreenSharingStateChange(isScreenSharing)
    );
    
    this.services.screenSharingDetectionService.start();
  }

  private handleScreenSharingStateChange(isScreenSharing: boolean): void {
    if (this.isScreenSharingActive !== isScreenSharing) {
      this.isScreenSharingActive = isScreenSharing;
      this.setWindowsInvisibleToScreenShare(isScreenSharing);
      
      const status = isScreenSharing ? 'detected' : 'stopped';
      this.writeLog(`🥷 [APP] Screen sharing ${status}`);
    }
  }

  private setWindowsInvisibleToScreenShare(invisible: boolean): void {
    const windows = [
      { window: this.mainWindow, name: 'main' },
      { window: this.settingsWindow, name: 'settings' }
    ];
    
    this.sessionWindows.forEach((window, sessionId) => {
      windows.push({ window, name: `session-${sessionId}` });
    });
    
    let successCount = 0;
    let errorCount = 0;
    
    windows.forEach(({ window, name }) => {
      try {
        if (window && !window.isDestroyed()) {
          window.setContentProtection(invisible);
          
          if (process.platform === 'darwin' && (window as any).setSharingType) {
            (window as any).setSharingType(invisible ? 'none' : 'readOnly');
          }
          
          successCount++;
        }
      } catch (error) {
        errorCount++;
        this.writeLog(`❌ [APP] Failed to set content protection for ${name} window: ${(error as Error).message}`);
      }
    });
    
    if (successCount > 0) {
      if (invisible) {
        this.writeLog(`🥷 [APP] ${successCount} windows protected from screen sharing`);
      } else {
        this.writeLog(`🥷 [APP] ${successCount} windows unprotected from screen sharing`);
      }
    }
    
    if (errorCount > 0) {
      this.writeLog(`❌ [APP] Failed to update ${errorCount} windows`);
    }
  }

  private setupGlobalHotkeys(): void {
    this.writeLog('🔧 [APP] Setting up global hotkeys...');

    globalShortcut.register('CommandOrControl+G', () => {
      this.writeLog('⌨️ [APP] Cmd+G pressed - toggling main window');
      this.toggleMainWindow();
    });

    globalShortcut.register('CommandOrControl+H', () => {
      this.writeLog('⌨️ [APP] Cmd+H pressed - toggling session windows');
      this.hideAllSessionWindows();
    });

    globalShortcut.register('CommandOrControl+S', () => {
      this.writeLog('⌨️ [APP] Cmd+S pressed - sending auto recorder transcription');
      this.handleAutoRecorderSend();
    });

    // Cmd+Q → Global screenshot analysis (override default quit)
    globalShortcut.register('CommandOrControl+Q', () => {
      this.writeLog('⌨️ [APP] Cmd+Q pressed - performing screenshot analysis instead of quitting');
      this.handleGlobalScreenshotAnalysis();
    });

    // Cmd+Up / Cmd+Down → Scroll answer pane in the active session window
    globalShortcut.register('CommandOrControl+Up', () => {
      this.writeLog('⌨️ [APP] Cmd+Up pressed - scrolling answer pane up');
      this.sendScrollToActiveSession(-200);
    });

    globalShortcut.register('CommandOrControl+Down', () => {
      this.writeLog('⌨️ [APP] Cmd+Down pressed - scrolling answer pane down');
      this.sendScrollToActiveSession(200);
    });

    this.writeLog('✅ [APP] Global hotkeys registered');
  }

  private toggleMainWindow(): void {
    if (this.mainWindow) {
      if (this.mainWindow.isVisible()) {
        this.writeLog('🪟 [APP] Hiding main window');
        this.mainWindow.hide();
      } else {
        this.writeLog('🪟 [APP] Showing main window');
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    } else {
      this.writeLog('🪟 [APP] Creating new main window');
      this.createMainWindow();
    }
  }

  private hideAllSessionWindows(): void {
    this.writeLog(`🪟 [APP] Toggling ${this.sessionWindows.size} session windows`);

    this.sessionWindows.forEach((window, sessionId) => {
      if (window.isVisible()) {
        this.writeLog(`🪟 [APP] Hiding session window: ${sessionId}`);
        window.hide();
      } else {
        this.writeLog(`🪟 [APP] Showing session window: ${sessionId}`);
        window.show();
        window.focus();
      }
    });
  }

  /**
   * Handle Cmd+S pressed - send auto recorder transcription to LLM
   * Now waits for any pending transcription to complete before processing
   */

  // Determine the active session to target actions
  private getFocusedOrLastSessionId(): string | null {
    // Prefer focused session window
    for (const [sessionId, win] of this.sessionWindows.entries()) {
      try {
        if (win && !win.isDestroyed() && win.isVisible() && win.isFocused()) {
          return sessionId;
        }
      } catch {}
    }
    // Fallback to the last created session window
    const keys = Array.from(this.sessionWindows.keys());
    return keys.length > 0 ? keys[keys.length - 1] : null;
  }

  // Global screenshot analysis flow for Cmd+Q
  private async handleGlobalScreenshotAnalysis(): Promise<void> {
    try {
      const targetSessionId = this.getFocusedOrLastSessionId();
      if (!targetSessionId) {
        this.writeLog('⚠️ [HOTKEY] No active session found for screenshot analysis');
        return;
      }

      this.writeLog(`📷 [HOTKEY] Starting screenshot analysis for session ${targetSessionId}`);

      const screenshot = await this.services.captureService.captureScreen();
      const ocrText = await this.services.ocrService.extractText(screenshot);

      const aiResponse = await this.services.chatService.processOCRText(targetSessionId, ocrText, ActionType.SCREENSHOT);

      const sessionWindow = this.sessionWindows.get(targetSessionId);
      if (sessionWindow && !sessionWindow.isDestroyed()) {
        sessionWindow.webContents.send('chat-response', {
          content: aiResponse,
          metadata: { action: 'screenshot' },
        });
      }

      this.writeLog('✅ [HOTKEY] Screenshot analysis completed');
    } catch (error) {
      this.writeLog(`❌ [HOTKEY] Screenshot analysis failed: ${(error as Error).message}`);
    }
  }

  // Send scroll command to the active session window
  private sendScrollToActiveSession(delta: number): void {
    const sessionId = this.getFocusedOrLastSessionId();
    if (!sessionId) return;

    const sessionWindow = this.sessionWindows.get(sessionId);
    if (sessionWindow && !sessionWindow.isDestroyed()) {
      sessionWindow.webContents.send('scroll-answer', { delta });
    }
  }
  private async handleAutoRecorderSend(): Promise<void> {
    this.writeLog('🔄 [AUTO RECORDER] Cmd+S pressed - processing auto recorder transcription');
    
    try {
      // Check if auto recorder is active
      if (!this.services.audioService.isAutoRecorderActive()) {
        this.writeLog('⚠️ [AUTO RECORDER] Auto recorder is not active, ignoring Cmd+S');
        return;
      }
      
      // Get the auto recorder session details first
      const autoRecorderStatus = this.services.audioService.getAutoRecorderStatus();
      const sessionId = autoRecorderStatus.sessionId;
      
      if (!sessionId) {
        this.writeLog('⚠️ [AUTO RECORDER] No active session for auto recorder');
        return;
      }
      
      // Get session window first to send immediate feedback
      const sessionWindow = this.sessionWindows.get(sessionId);
      if (!sessionWindow || sessionWindow.isDestroyed()) {
        this.writeLog('⚠️ [AUTO RECORDER] Session window not available');
        return;
      }
      
      // Send immediate feedback to UI that Cmd+S was pressed
      const timestamp = new Date().toISOString();
      sessionWindow.webContents.send('chat-response', {
        sessionId,
        content: '⌨️ **Cmd+S Pressed** - Processing current transcription... (waiting for any pending segments)',
        timestamp,
        metadata: {
          source: 'auto-recorder-cmd-s',
          action: 'auto-recorder-processing'
        }
      });
      
      // 🎯 CRITICAL FIX: Wait for any pending transcription segment to complete
      this.writeLog('🔄 [AUTO RECORDER] Waiting for pending transcription to complete...');
      await this.services.audioService.waitForPendingTranscription();
      this.writeLog('🔄 [AUTO RECORDER] Pending transcription processing complete');
      
      // Get current accumulated transcription (now includes any pending segment)
      let currentTranscription = '';
      try {
        currentTranscription = this.services.audioService.getCurrentAutoRecorderTranscription();
      } catch (error) {
        this.writeLog(`⚠️ [AUTO RECORDER] Failed to get transcription: ${(error as Error).message}`);
        currentTranscription = '';
      }
      
      // 🎯 NEW APPROACH: Always show what transcription we have, even if empty
      // This gives user feedback about what was captured
      if (!currentTranscription || currentTranscription.trim().length === 0) {
        this.writeLog('⚠️ [AUTO RECORDER] No transcription available after processing current audio');
        
        // Show user that Cmd+S was pressed but no speech was detected
        sessionWindow.webContents.send('chat-response', {
          sessionId,
          content: '⌨️ **Cmd+S Result** - No speech detected in current audio.\n\n💡 Tips:\n• Make sure you\'re speaking clearly\n• Check your audio input device\n• Try speaking for at least 2-3 seconds before pressing Cmd+S',
          timestamp: new Date().toISOString(),
          metadata: {
            source: 'auto-recorder-cmd-s',
            action: 'auto-recorder-empty'
          }
        });
        return;
      }
      
      this.writeLog(`🔄 [AUTO RECORDER] Sending complete transcription: "${currentTranscription}"`);
      
      // Show user the complete transcription that will be sent to AI
      sessionWindow.webContents.send('chat-response', {
        sessionId,
        content: `⌨️ **Cmd+S Complete** - Sending transcription to AI:\n\n"${currentTranscription}"`,
        timestamp: new Date().toISOString(),
        metadata: {
          source: 'auto-recorder-cmd-s',
          action: 'auto-recorder-complete',
          transcriptionLength: currentTranscription.length
        }
      });
      
      // Reset the accumulated transcription context IMMEDIATELY after capturing complete transcription
      // This ensures new segments can start accumulating without interfering
      try {
        this.services.audioService.resetAutoRecorderTranscription();
        this.writeLog('✅ [AUTO RECORDER] Transcription context reset - ready for new segments');
      } catch (error) {
        this.writeLog(`⚠️ [AUTO RECORDER] Failed to reset transcription: ${(error as Error).message}`);
      }
      
      // Send transcription to ChatService for AI analysis
      if (this.services.chatService.isConfigured()) {
        try {
          const aiResponse = await this.services.chatService.processTranscript(
            sessionId, 
            currentTranscription, 
            autoRecorderStatus.source || AudioSource.SYSTEM
          );
          
          // Send AI response to the session window
          sessionWindow.webContents.send('chat-response', {
            sessionId,
            content: `🤖 **AI Analysis:** ${aiResponse}`,
            timestamp: new Date().toISOString(),
            metadata: {
              source: 'auto-recorder-ai-response',
              action: 'auto-recorder'
            }
          });
          
          this.writeLog('✅ [AUTO RECORDER] AI response sent successfully');
          
        } catch (error) {
          this.writeLog(`❌ [AUTO RECORDER] ChatService processing failed: ${(error as Error).message}`);
          
          // Send error message to UI
          sessionWindow.webContents.send('chat-response', {
            sessionId,
            content: '❌ **AI Analysis Error:** Unable to process transcription. Please check your configuration.',
            timestamp: new Date().toISOString(),
            metadata: {
              source: 'auto-recorder-error',
              action: 'auto-recorder',
              error: true
            }
          });
        }
      } else {
        this.writeLog('⚠️ [AUTO RECORDER] ChatService not configured, sending fallback message');
        
        // Send fallback message when AI is not configured
        sessionWindow.webContents.send('chat-response', {
          sessionId,
          content: '⚙️ **AI Not Configured:** Configure your OpenAI API key in Settings for AI analysis of transcriptions.',
          timestamp: new Date().toISOString(),
          metadata: {
            source: 'auto-recorder-no-ai',
            action: 'auto-recorder'
          }
        });
      }
      
      this.writeLog('✅ [AUTO RECORDER] Cmd+S processing completed');
      
    } catch (error) {
      this.writeLog(`❌ [AUTO RECORDER] Failed to process Cmd+S: ${(error as Error).message}`);
      
      // Try to send error to UI if possible
      try {
        const autoRecorderStatus = this.services.audioService.getAutoRecorderStatus();
        if (autoRecorderStatus.sessionId) {
          const sessionWindow = this.sessionWindows.get(autoRecorderStatus.sessionId);
          if (sessionWindow && !sessionWindow.isDestroyed()) {
            sessionWindow.webContents.send('chat-response', {
              sessionId: autoRecorderStatus.sessionId,
              content: `❌ **Cmd+S Error:** ${(error as Error).message}`,
              timestamp: new Date().toISOString(),
              metadata: {
                source: 'auto-recorder-error',
                action: 'auto-recorder',
                error: true
              }
            });
          }
        }
      } catch (uiError) {
        this.writeLog(`❌ [AUTO RECORDER] Failed to send error to UI: ${(uiError as Error).message}`);
      }
    }
  }

  private setupApplicationEvents(): void {
    // Request single instance lock to prevent multiple app instances
    // Apply to all platforms including macOS
    const gotTheLock = app.requestSingleInstanceLock();

    if (!gotTheLock) {
      // Another instance is already running, quit this one
      this.writeLog('🔒 [APP] Another instance is already running, quitting this instance');
      app.quit();
      return;
    }

    // Handle second instance attempts - focus existing window
    app.on('second-instance', (event, commandLine, workingDirectory) => {
      this.writeLog('🔒 [APP] Second instance detected, focusing main window');
      
      // Focus the main window if it exists
      if (this.mainWindow) {
        if (this.mainWindow.isMinimized()) {
          this.mainWindow.restore();
        }
        this.mainWindow.focus();
        this.mainWindow.show();
        
        // On macOS, also try to bring app to foreground
        if (process.platform === 'darwin') {
          app.focus({ steal: true });
        }
      } else {
        // Create main window if it doesn't exist
        this.createMainWindow();
      }
    });
    
    this.writeLog('🔒 [APP] Single instance lock acquired successfully');

    app.whenReady().then(() => {
      this.initialize();
    });

    app.on('window-all-closed', () => {
      this.shutdown();
      if (process.platform !== 'darwin') {
        app.quit();
      }
    });

    app.on('before-quit', () => {
      this.shutdown();
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        this.createMainWindow();
      } else if (this.mainWindow) {
        // Show and focus the main window on macOS dock click
        this.mainWindow.show();
        this.mainWindow.focus();
      }
    });
  }

  private setupMainWindowEvents(): void {
    if (!this.mainWindow) return;

    this.mainWindow.on('closed', () => {
      this.writeLog('🪟 [APP] Main window closed');
      this.mainWindow = null;
    });
  }

  private setupSessionWindowEvents(window: BrowserWindow, sessionId: string): void {
    window.on('closed', async () => {
      this.writeLog(`🪟 [APP] Session window closed: ${sessionId}`);
      
      // Clean up local RAG database for this session
      try {
        await this.services.localRagService.deleteSessionDatabase(sessionId);
        this.writeLog(`✅ [APP] Local RAG database cleaned up for session: ${sessionId}`);
      } catch (error) {
        this.writeLog(`⚠️ [APP] Failed to clean up local RAG database for session ${sessionId}: ${(error as Error).message}`);
      }
      
      this.sessionWindows.delete(sessionId);
      this.sessions.delete(sessionId);
    });
  }

  private loadMainWindowContent(): void {
    if (!this.mainWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Interview Assistant</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 15px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            height: calc(100vh - 30px);
            overflow: hidden;
            -webkit-app-region: drag;
            box-sizing: border-box;
            cursor: default !important;
          }
          
          /* Override all cursor styles to ensure consistent arrow cursor */
          *, *:hover, *:focus, *:active {
            cursor: default !important;
          }
          .container {
            display: flex;
            flex-direction: column;
            gap: 12px;
            height: 100%;
            -webkit-app-region: no-drag;
            background: rgba(0,0,0,0.1);
            border-radius: 8px;
            padding: 10px;
          }
          .title {
            font-size: 14px;
            font-weight: bold;
            text-align: center;
            margin-bottom: 5px;
            text-shadow: 0 1px 2px rgba(0,0,0,0.3);
          }
          select, button {
            padding: 8px;
            border: none;
            border-radius: 6px;
            font-size: 12px;
            background: rgba(255,255,255,0.9);
            color: #333;
            -webkit-app-region: no-drag;
          }
          button {
            background: rgba(255,255,255,0.95);
            cursor: pointer;
            font-weight: 500;
            transition: all 0.2s;
          }
          button:hover {
            background: white;
            transform: translateY(-1px);
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          .status {
            font-size: 10px;
            text-align: center;
            opacity: 0.8;
            margin-top: auto;
          }
          .hotkeys {
            font-size: 9px;
            text-align: center;
            opacity: 0.7;
            line-height: 1.2;
          }
          .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            z-index: 1000;
            justify-content: center;
            align-items: center;
            -webkit-app-region: no-drag;
          }
          .modal-content {
            background: white;
            padding: 20px;
            border-radius: 10px;
            width: 90%;
            max-width: 400px;
            max-height: 80%;
            overflow-y: auto;
            -webkit-app-region: no-drag;
          }
          .modal h3 {
            margin: 0 0 15px 0;
            color: #333;
            text-align: center;
          }
          .modal textarea {
            width: 100%;
            height: 150px;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 5px;
            font-size: 14px;
            resize: vertical;
            font-family: inherit;
            box-sizing: border-box;
          }
          .modal-buttons {
            display: flex;
            gap: 10px;
            margin-top: 15px;
            justify-content: flex-end;
          }
          .modal-buttons button {
            padding: 8px 16px;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-weight: 500;
          }
          .modal-save {
            background: #007AFF;
            color: white;
          }
          .modal-cancel {
            background: #6c757d;
            color: white;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="title">🎯 Interview Assistant</div>
          
          <select id="profession">
            <option value="software-engineer">👨‍💻 Software Engineer</option>
            <option value="data-scientist">📊 Data Scientist</option>
            <option value="product-manager">📋 Product Manager</option>
            <option value="designer">🎨 UX/UI Designer</option>
            <option value="devops-engineer">⚙️ DevOps Engineer</option>
            <option value="security-engineer">🔒 Security Engineer</option>
            <option value="quantitative-finance-engineer">💹 Quantitative Finance Engineer</option>
          </select>
          
          <select id="interview-type">
            <option value="technical">⚙️ Technical</option>
            <option value="behavioral">🗣️ Behavioral</option>
            <option value="system-design">🏗️ System Design</option>
            <option value="coding">💻 Coding</option>
            <option value="leadership">👥 Leadership</option>
          </select>
          
          <button onclick="showContextModal()">🚀 Start Session</button>
          <button onclick="openSettings()">⚙️ Settings</button>
          
          <div class="hotkeys">
            Cmd+G: Toggle Window<br>
            Cmd+H: Hide Sessions
          </div>
          
          <div class="status">🥷 Stealth Mode Active</div>
        </div>
        
        <!-- Context Input Modal -->
        <div id="contextModal" class="modal">
          <div class="modal-content">
            <h3>🎯 Interview Context</h3>
            <p style="color: #666; margin-bottom: 15px;">Provide additional context about your interview (optional):</p>
            <textarea id="contextInput" placeholder="E.g., Company details, specific technologies, role requirements, interview focus areas..."></textarea>
            <div class="modal-buttons">
              <button class="modal-cancel" onclick="skipContext()">Skip</button>
              <button class="modal-save" onclick="startSessionWithContext()">Start Session</button>
            </div>
          </div>
        </div>
        
        <script>
          const { ipcRenderer } = require('electron');
          
          function startSession() {
            const profession = document.getElementById('profession').value;
            const interviewType = document.getElementById('interview-type').value;
            
            ipcRenderer.send('create-session', {
              profession,
              interviewType,
              createdAt: new Date().toISOString()
            });
          }
          
          function openSettings() {
            ipcRenderer.send('open-settings');
          }
          
          function showContextModal() {
            const modal = document.getElementById('contextModal');
            modal.style.display = 'flex';
            document.getElementById('contextInput').focus();
          }
          
          function hideContextModal() {
            const modal = document.getElementById('contextModal');
            modal.style.display = 'none';
            document.getElementById('contextInput').value = '';
          }
          
          function skipContext() {
            const profession = document.getElementById('profession').value;
            const interviewType = document.getElementById('interview-type').value;
            
            ipcRenderer.send('create-session', {
              profession,
              interviewType,
              context: null, // No context
              createdAt: new Date().toISOString()
            });
            
            hideContextModal();
          }
          
          function startSessionWithContext() {
            const profession = document.getElementById('profession').value;
            const interviewType = document.getElementById('interview-type').value;
            const context = document.getElementById('contextInput').value.trim();
            
            ipcRenderer.send('create-session', {
              profession,
              interviewType,
              context: context || null,
              createdAt: new Date().toISOString()
            });
            
            hideContextModal();
          }
          
          // Close modal when clicking outside of it
          document.addEventListener('click', function(event) {
            const modal = document.getElementById('contextModal');
            if (event.target === modal) {
              hideContextModal();
            }
          });
          
          // Close modal with Escape key
          document.addEventListener('keydown', function(event) {
            if (event.key === 'Escape') {
              const modal = document.getElementById('contextModal');
              if (modal.style.display === 'flex') {
                hideContextModal();
              }
            }
          });
        </script>
      </body>
      </html>
    `;

    this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  }

  private loadSessionWindowContent(window: BrowserWindow, sessionId: string, config: any): void {
    // Load the external session.html file with the session ID passed as a global variable
    const sessionHtmlPath = path.join(__dirname, '..', 'renderer', 'session.html');
    
    this.writeLog(`🎯 [SESSION] Loading session window content for ${sessionId}`);
    
    // Method 1: Set session variables via URL parameters
    // This ensures the session data is available immediately when the page loads
    const sessionUrl = new URL(`file://${sessionHtmlPath}`);
    sessionUrl.searchParams.set('sessionId', sessionId);
    sessionUrl.searchParams.set('config', JSON.stringify(config));
    
    // Load the session.html file with parameters
    window.loadURL(sessionUrl.toString());
    
    // Method 2 (Backup): Set variables after DOM ready
    window.webContents.once('dom-ready', () => {
      this.writeLog(`🎯 [SESSION] DOM ready for session ${sessionId}, setting backup variables`);
      
      window.webContents.executeJavaScript(`
        try {
          // Set global session ID variable as backup
          if (!window.GHOST_GUIDE_SESSION_ID) {
            window.GHOST_GUIDE_SESSION_ID = '${sessionId}';
            window.GHOST_GUIDE_SESSION_CONFIG = ${JSON.stringify(config)};
            console.log('🎯 [SESSION] Session variables set as backup after DOM ready:', '${sessionId}');
          } else {
            console.log('🎯 [SESSION] Session variables already exist, skipping backup:', window.GHOST_GUIDE_SESSION_ID);
          }
        } catch (error) {
          console.error('🎯 [SESSION] Failed to set session variables:', error);
        }
      `).catch((error) => {
        this.writeLog(`⚠️ [SESSION] Failed to set session variables as backup: ${error.message}`);
      });
    });
    
    // OLD INLINE HTML CODE (keeping as fallback commented out):
    /*
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${config.profession} - ${config.interviewType}</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            display: flex;
            flex-direction: column;
            height: 100vh;
            background: #f8f9fa;
            -webkit-app-region: no-drag;
          }
          .toolbar {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 8px;
            display: flex;
            gap: 6px;
            border-bottom: 1px solid #ddd;
            flex-wrap: wrap;
            -webkit-app-region: drag;
          }
          .toolbar button {
            padding: 6px 10px;
            border: none;
            border-radius: 4px;
            background: rgba(255,255,255,0.9);
            cursor: pointer;
            font-size: 11px;
            font-weight: 500;
            transition: all 0.2s;
            -webkit-app-region: no-drag;
          }
          .toolbar button:hover {
            background: white;
            transform: translateY(-1px);
          }
          .chat-container {
            flex: 1;
            padding: 10px;
            overflow-y: auto;
            background: white;
            -webkit-app-region: no-drag;
          }
          .message {
            margin-bottom: 15px;
            padding: 12px;
            border-radius: 8px;
            max-width: 90%;
            line-height: 1.5;
            word-wrap: break-word;
            white-space: pre-wrap;
          }
          .user-message {
            background: #007AFF;
            color: white;
            margin-left: auto;
            margin-right: 0;
          }
          .ai-message {
            background: #f1f3f4;
            color: #333;
            margin-right: auto;
            margin-left: 0;
            border-left: 3px solid #667eea;
          }
          .message-time {
            font-size: 10px;
            opacity: 0.7;
            margin-top: 5px;
          }
          .input-container {
            padding: 10px;
            border-top: 1px solid #ddd;
            display: flex;
            gap: 8px;
            background: #f8f9fa;
            flex-shrink: 0;
          }
          .input-container textarea {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            -webkit-app-region: no-drag;
            min-height: 40px;
            max-height: 120px;
            resize: vertical;
            font-family: inherit;
          }
          .input-container button {
            padding: 10px 16px;
            background: #007AFF;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
            -webkit-app-region: no-drag;
          }
          .welcome-message {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="toolbar">
          <button onclick="takeScreenshot()">📷 Screenshot</button>
          <button onclick="debugCode()">🐛 Debug</button>
          <button onclick="toggleRecording()">🎤 Record Mic</button>
          <button onclick="toggleSystemRecording()">🔊 Record System</button>
          <button onclick="addRAGMaterial()">📚 RAG</button>
          <button onclick="closeSession()">❌ Close</button>
        </div>
        
        <div class="chat-container" id="chat">
          <div class="welcome-message">
            <h3>🎯 ${config.profession} - ${config.interviewType} Session</h3>
            <p>I'm your AI interview assistant! I can help with:</p>
            <p>📷 Screenshot analysis • 🎤 Audio transcription • 📚 Study materials • 🐛 Code debugging</p>
          </div>
        </div>
        
        <div class="input-container">
          <textarea id="messageInput" placeholder="Ask me anything about your interview..." onkeydown="handleKeyPress(event)" rows="1"></textarea>
          <button onclick="sendMessage()">Send</button>
        </div>
        
        <script>
          const { ipcRenderer } = require('electron');
          const sessionId = '${sessionId}';
          
          function takeScreenshot() {
            addMessage('📷 Taking screenshot...', 'user');
            ipcRenderer.send('capture-screenshot', { sessionId });
          }
          
          function debugCode() {
            addMessage('🐛 Debugging code...', 'user');
            ipcRenderer.send('debug-code', { sessionId });
          }
          
          function toggleRecording() {
            addMessage('🎤 Toggling microphone recording...', 'user');
            ipcRenderer.send('toggle-recording', { sessionId, source: 'microphone' });
          }
          
          function toggleSystemRecording() {
            addMessage('🔊 Toggling system audio recording...', 'user');
            ipcRenderer.send('toggle-system-recording', { sessionId });
          }
          
          function addRAGMaterial() {
            addMessage('📚 Adding study materials...', 'user');
            ipcRenderer.send('add-rag-material', { sessionId });
          }
          
          function closeSession() {
            ipcRenderer.send('close-session', sessionId);
          }
          
          function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            if (message) {
              addMessage(message, 'user');
              input.value = '';
              input.style.height = 'auto';
              ipcRenderer.send('chat-message', { sessionId, message });
            }
          }
          
          function handleKeyPress(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
          }
          
          function addMessage(text, type) {
            const chat = document.getElementById('chat');
            const message = document.createElement('div');
            message.className = 'message ' + type + '-message';
            
            // Create content div and use textContent to prevent HTML rendering
            const contentDiv = document.createElement('div');
            contentDiv.textContent = text; // This prevents HTML rendering
            message.appendChild(contentDiv);
            
            // Add timestamp
            const timeDiv = document.createElement('div');
            timeDiv.className = 'message-time';
            timeDiv.textContent = new Date().toLocaleTimeString();
            message.appendChild(timeDiv);
            
            chat.appendChild(message);
            chat.scrollTop = chat.scrollHeight;
          }
          
          // IPC listeners
          ipcRenderer.on('chat-response', (event, data) => {
            if (data.sessionId === sessionId) {
              addMessage(data.content, 'ai');
            }
          });
          
          ipcRenderer.on('ocr-result', (event, data) => {
            if (data.sessionId === sessionId) {
              addMessage('📷 **OCR Text Extracted:** "' + data.text + '"', 'ai');
              if (data.analysis) {
                addMessage(data.analysis, 'ai');
              }
            }
          });
          
          ipcRenderer.on('debug-result', (event, data) => {
            if (data.sessionId === sessionId) {
              if (data.text) {
                addMessage('🐛 **Code Extracted:** "' + data.text + '"', 'ai');
              }
              if (data.analysis) {
                addMessage(data.analysis, 'ai');
              }
            }
          });
          
          ipcRenderer.on('recording-status', (event, data) => {
            if (data.sessionId === sessionId) {
              const status = data.isRecording ? 'Recording started' : 'Recording stopped';
              addMessage('🎤 ' + status, 'ai');
            }
          });
          
          ipcRenderer.on('rag-success', (event, data) => {
            if (data.sessionId === sessionId) {
              addMessage('📚 Study materials processed successfully! ' + data.documentsProcessed + ' documents from ' + data.folderPath, 'ai');
            }
          });
          
          ipcRenderer.on('rag-error', (event, data) => {
            if (data.sessionId === sessionId) {
              addMessage('📚 Error processing study materials: ' + data.error, 'ai');
            }
          });
          
          // Add welcome message
          setTimeout(() => {
            addMessage('👋 Welcome! I am ready to assist you with your ${config.profession} ${config.interviewType} interview. Try the buttons above or ask me anything!', 'ai');
          }, 500);
        </script>
      </body>
      </html>
    `;

    window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
    */
  }
}
