import { app, BrowserWindow, globalShortcut } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import Store from 'electron-store';
import OpenAI from 'openai';

// Services
import { GlobalRAGService } from '../services/GlobalRAGService';
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
      opacity: 1
    });

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

    this.writeLog('✅ [APP] Main window created successfully');
    return this.mainWindow;
  }

  /**
   * Create a new session window
   */
  createSessionWindow(sessionId: string, config: any): BrowserWindow {
    this.writeLog(`🪟 [APP] Creating session window for ${sessionId}: ${JSON.stringify(config)}`);

    const sessionWindow = new BrowserWindow({
      width: 800,
      height: 600,
      minWidth: 600,
      minHeight: 500,
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
      opacity: 1
    });

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

    this.writeLog(`✅ [APP] Session window created successfully: ${sessionId}`);
    return sessionWindow;
  }

  /**
   * Get service instances (for external access)
   */
  getServices(): IPCServices {
    return {
      globalRagService: this.services.globalRagService,
      chatService: this.services.chatService,
      audioService: this.services.audioService,
      ragService: this.services.ragService,
      ocrService: this.services.ocrService,
      captureService: this.services.captureService,
      configurationManager: this.services.configurationManager,
      sessionManager: this.services.sessionManager,
      windowManager: this.services.windowManager,
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
    
    // Re-create chatService with proper dependencies
    this.services.chatService = new ChatService(
      this.services.configurationManager,
      this.services.promptLibraryService,
      this.services.sessionManager,
      this.services.ragService
    );
  }

  private async initializeServicesAsync(): Promise<void> {
    try {
      // Initialize configuration manager first
      await this.services.configurationManager.initialize();
      
      // Add default personas
      try {
        await this.services.promptLibraryService.addPersona('quantitative-finance-engineer', 'Quantitative Finance Engineer');
        this.writeLog('✅ [APP] Added Quantitative Finance Engineer profession');
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

  private setupApplicationEvents(): void {
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
    window.on('closed', () => {
      this.writeLog(`🪟 [APP] Session window closed: ${sessionId}`);
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
  }
}
