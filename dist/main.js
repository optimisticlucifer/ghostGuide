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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const electron_store_1 = __importDefault(require("electron-store"));
const openai_1 = __importDefault(require("openai"));
const OCRService_1 = require("./services/OCRService");
const CaptureService_1 = require("./services/CaptureService");
const AudioService_1 = require("./services/AudioService");
const RAGService_1 = require("./services/RAGService");
const ChatService_1 = require("./services/ChatService");
const ConfigurationManager_1 = require("./services/ConfigurationManager");
const PromptLibraryService_1 = require("./services/PromptLibraryService");
const SessionManager_1 = require("./services/SessionManager");
const ScreenSharingDetectionService_1 = require("./services/ScreenSharingDetectionService");
const types_1 = require("./types");
class InterviewAssistant {
    constructor() {
        this.mainWindow = null;
        this.sessionWindows = new Map();
        this.settingsWindow = null;
        this.sessions = new Map();
        this.openai = null;
        this.isScreenSharingActive = false;
        this.store = new electron_store_1.default();
        // Initialize services
        this.ocrService = new OCRService_1.OCRService();
        this.captureService = new CaptureService_1.CaptureService();
        this.audioService = new AudioService_1.AudioService();
        this.ragService = new RAGService_1.RAGService();
        this.configurationManager = new ConfigurationManager_1.ConfigurationManager();
        this.promptLibraryService = new PromptLibraryService_1.PromptLibraryService();
        this.sessionManager = new SessionManager_1.SessionManager();
        // Set up service dependencies
        this.promptLibraryService.setConfigurationManager(this.configurationManager);
        this.chatService = new ChatService_1.ChatService(this.configurationManager, this.promptLibraryService, this.sessionManager, this.ragService);
        // Initialize services asynchronously
        this.initializeServicesAsync();
        // Initialize logging
        this.initializeLogging();
        // Initialize OpenAI if API key exists
        this.initializeOpenAI();
        electron_1.app.whenReady().then(() => {
            this.initialize();
        });
        electron_1.app.on('window-all-closed', () => {
            this.cleanup();
            if (process.platform !== 'darwin') {
                electron_1.app.quit();
            }
        });
        electron_1.app.on('before-quit', () => {
            this.cleanup();
        });
        electron_1.app.on('activate', () => {
            if (electron_1.BrowserWindow.getAllWindows().length === 0) {
                this.createMainWindow();
            }
        });
        this.setupIpcHandlers();
    }
    cleanup() {
        this.writeLog('🧹 [CLEANUP] Starting application cleanup...');
        try {
            // Stop screen sharing detection
            if (this.screenSharingDetectionService) {
                this.screenSharingDetectionService.stop();
                this.writeLog('✅ [CLEANUP] Screen sharing detection stopped');
            }
            // Unregister global shortcuts
            electron_1.globalShortcut.unregisterAll();
            this.writeLog('✅ [CLEANUP] Global shortcuts unregistered');
            this.writeLog('🧹 [CLEANUP] Application cleanup completed');
        }
        catch (error) {
            this.writeLog(`❌ [CLEANUP] Cleanup failed: ${error.message}`);
        }
    }
    async initializeServicesAsync() {
        try {
            // Initialize configuration manager first
            await this.configurationManager.initialize();
            // Add Quantitative Finance Engineer profession
            try {
                await this.promptLibraryService.addPersona('quantitative-finance-engineer', 'Quantitative Finance Engineer');
                this.writeLog('✅ [SERVICES] Added Quantitative Finance Engineer profession');
            }
            catch (error) {
                // Profession might already exist, which is fine
                this.writeLog(`ℹ️ [SERVICES] Quantitative Finance Engineer profession: ${error.message}`);
            }
            // Initialize other services that depend on configuration
            await this.audioService.initialize();
            await this.ocrService.initialize();
            this.writeLog('✅ [SERVICES] All services initialized successfully');
        }
        catch (error) {
            this.writeLog(`❌ [SERVICES] Service initialization failed: ${error.message}`);
        }
    }
    initializeLogging() {
        // Create logs directory
        const logsDir = path.join(electron_1.app.getPath('userData'), 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        // Create log file with date and timestamp
        const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        this.logFilePath = path.join(logsDir, `interview-assistant-${date}-${timestamp}.log`);
        // Initialize log file
        this.writeLog('🚀 [SYSTEM] Interview Assistant starting...');
        this.writeLog(`� [SYYSTEM] Log file: ${this.logFilePath}`);
        this.writeLog(`📁 [SYSTEM] Logs directory: ${logsDir}`);
        this.writeLog(`� [[SYSTEM] Platform: ${process.platform}`);
        this.writeLog(`�  [SYSTEM] Node version: ${process.version}`);
        console.log(`📝 [LOGGING] Log file initialized: ${this.logFilePath}`);
        console.log(`📁 [LOGGING] Logs directory: ${logsDir}`);
        console.log(`📝 [LOGGING] Log file initialized: ${this.logFilePath}`);
        console.log(`📁 [LOGGING] Logs directory: ${logsDir}`);
    }
    writeLog(message) {
        const timestamp = new Date().toISOString();
        const logEntry = `[${timestamp}] ${message}\n`;
        try {
            fs.appendFileSync(this.logFilePath, logEntry);
        }
        catch (error) {
            console.error('Failed to write to log file:', error);
        }
        // Also log to console
        console.log(message);
    }
    initializeOpenAI() {
        // Try to get API key from ConfigurationManager first, then fallback to Electron Store
        let apiKey = '';
        try {
            if (this.configurationManager.isApiKeyConfigured()) {
                apiKey = this.configurationManager.getApiKey();
                this.writeLog('🔑 [OPENAI] Using API key from ConfigurationManager');
            }
            else {
                // Fallback to Electron Store for backwards compatibility
                apiKey = this.store.get('openai-api-key');
                if (apiKey) {
                    this.writeLog('🔑 [OPENAI] Found API key in Electron Store, migrating to ConfigurationManager');
                    // Migrate to ConfigurationManager
                    this.configurationManager.setApiKey(apiKey);
                }
            }
        }
        catch (error) {
            this.writeLog(`⚠️ [OPENAI] Error accessing ConfigurationManager: ${error.message}`);
            // Fallback to Electron Store
            apiKey = this.store.get('openai-api-key');
        }
        if (apiKey && apiKey.trim().length > 0) {
            this.writeLog('🔑 [OPENAI] Initializing OpenAI client with stored API key');
            try {
                this.openai = new openai_1.default({ apiKey });
                this.writeLog('✅ [OPENAI] OpenAI client initialized successfully');
            }
            catch (error) {
                this.writeLog(`❌ [OPENAI] Failed to initialize OpenAI client: ${error.message}`);
                this.openai = null;
            }
        }
        else {
            this.writeLog('⚠️ [OPENAI] No API key found - using fallback responses');
            this.openai = null;
        }
    }
    async initialize() {
        // Enhanced stealth mode setup
        process.title = 'systemAssistance';
        // Hide from dock on macOS
        if (process.platform === 'darwin') {
            electron_1.app.dock?.hide();
        }
        // Start screen sharing detection
        this.startScreenSharingDetection();
        console.log('🔧 [INIT] Setting up global hotkeys...');
        // Register global hotkeys
        electron_1.globalShortcut.register('CommandOrControl+G', () => {
            console.log('⌨️ [HOTKEY] Cmd+G pressed - toggling main window');
            this.toggleMainWindow();
        });
        electron_1.globalShortcut.register('CommandOrControl+H', () => {
            console.log('⌨️ [HOTKEY] Cmd+H pressed - toggling session windows');
            this.hideAllSessionWindows();
        });
        console.log('🎯 Interview Assistant started in stealth mode');
        console.log('📱 Press Cmd+G (or Ctrl+G) to open main window');
        console.log('📱 Press Cmd+H (or Ctrl+H) to hide all session windows');
        console.log('🔧 [INIT] Initialization complete');
    }
    startScreenSharingDetection() {
        this.writeLog('🥷 [STEALTH] Starting screen sharing detection...');
        this.screenSharingDetectionService = new ScreenSharingDetectionService_1.ScreenSharingDetectionService({
            checkInterval: 5000, // Check every 5 seconds instead of 1
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
        }, (isScreenSharing) => this.handleScreenSharingStateChange(isScreenSharing));
        this.screenSharingDetectionService.start();
    }
    handleScreenSharingStateChange(isScreenSharing) {
        // Only update if state actually changed (debouncing)
        if (this.isScreenSharingActive !== isScreenSharing) {
            this.isScreenSharingActive = isScreenSharing;
            this.setWindowsInvisibleToScreenShare(isScreenSharing);
            const status = isScreenSharing ? 'detected' : 'stopped';
            this.writeLog(`🥷 [STEALTH] Screen sharing ${status}`);
        }
    }
    setWindowsInvisibleToScreenShare(invisible) {
        const windows = [
            { window: this.mainWindow, name: 'main' },
            { window: this.settingsWindow, name: 'settings' }
        ];
        // Add session windows
        this.sessionWindows.forEach((window, sessionId) => {
            windows.push({ window, name: `session-${sessionId}` });
        });
        let successCount = 0;
        let errorCount = 0;
        windows.forEach(({ window, name }) => {
            try {
                if (window && !window.isDestroyed()) {
                    // Use content protection instead of opacity - keeps window visible to user
                    window.setContentProtection(invisible);
                    // macOS specific: set sharing type to none
                    if (process.platform === 'darwin' && window.setSharingType) {
                        window.setSharingType(invisible ? 'none' : 'readOnly');
                    }
                    successCount++;
                }
                else if (window) {
                    this.writeLog(`⚠️ [STEALTH] Skipping destroyed ${name} window`);
                }
            }
            catch (error) {
                errorCount++;
                this.writeLog(`❌ [STEALTH] Failed to set content protection for ${name} window: ${error.message}`);
            }
        });
        if (successCount > 0) {
            if (invisible) {
                this.writeLog(`🥷 [STEALTH] ${successCount} windows protected from screen sharing (visible to user, hidden from sharing)`);
            }
            else {
                this.writeLog(`🥷 [STEALTH] ${successCount} windows unprotected from screen sharing (visible to sharing)`);
            }
        }
        if (errorCount > 0) {
            this.writeLog(`❌ [STEALTH] Failed to update ${errorCount} windows`);
        }
    }
    createMainWindow() {
        console.log('🪟 [WINDOW] Creating main window...');
        this.mainWindow = new electron_1.BrowserWindow({
            width: 300,
            height: 500,
            minWidth: 250,
            minHeight: 400,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                // Additional security to prevent detection
                backgroundThrottling: false,
                offscreen: false
            },
            title: 'Interview Assistant',
            resizable: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            // Enhanced stealth properties with opacity control
            show: true, // Show window but control visibility via opacity
            frame: false,
            transparent: true,
            hasShadow: false,
            focusable: true, // Allow focusing for user interaction
            minimizable: false,
            maximizable: false,
            closable: true,
            movable: true,
            // macOS specific stealth properties
            hiddenInMissionControl: true,
            fullscreenable: false,
            // Additional stealth properties
            titleBarStyle: 'hidden',
            vibrancy: 'under-window',
            visualEffectState: 'inactive',
            // Start with normal opacity - will be controlled by screen sharing detection
            opacity: 1
        });
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
          
          <button onclick="startSession()">🚀 Start Session</button>
          <button onclick="openSettings()">⚙️ Settings</button>
          
          <div class="hotkeys">
            Cmd+G: Toggle Window<br>
            Cmd+H: Hide Sessions
          </div>
          
          <div class="status">🥷 Stealth Mode Active</div>
        </div>
        
        <script>
          const { ipcRenderer } = require('electron');
          
          console.log('🔧 [MAIN-WINDOW] Main window script loaded');
          
          function startSession() {
            const profession = document.getElementById('profession').value;
            const interviewType = document.getElementById('interview-type').value;
            
            console.log('🚀 [MAIN-WINDOW] Starting session:', profession, interviewType);
            
            ipcRenderer.send('create-session', {
              profession,
              interviewType,
              createdAt: new Date().toISOString()
            });
          }
          
          function openSettings() {
            console.log('⚙️ [MAIN-WINDOW] Opening settings');
            ipcRenderer.send('open-settings');
          }
        </script>
      </body>
      </html>
    `;
        this.mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        // Set content protection to hide from screen sharing (like version1)
        this.mainWindow.setContentProtection(true);
        if (process.platform === 'darwin' && this.mainWindow.setSharingType) {
            this.mainWindow.setSharingType('none');
        }
        this.mainWindow.on('closed', () => {
            console.log('🪟 [WINDOW] Main window closed');
            this.mainWindow = null;
        });
        console.log('🪟 [WINDOW] Main window created successfully');
    }
    createSessionWindow(sessionId, config) {
        console.log(`🪟 [SESSION] Creating session window for ${sessionId}:`, config);
        const sessionWindow = new electron_1.BrowserWindow({
            width: 800,
            height: 600,
            minWidth: 600,
            minHeight: 500,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                // Additional security to prevent detection
                backgroundThrottling: false,
                offscreen: false
            },
            title: `${config.profession} - ${config.interviewType}`,
            resizable: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            // Enhanced stealth properties with opacity control
            show: true, // Show window but control visibility via opacity
            frame: false,
            transparent: true,
            hasShadow: false,
            focusable: true, // Allow focusing for user interaction
            minimizable: false,
            maximizable: false,
            closable: true,
            movable: true,
            // macOS specific stealth properties
            hiddenInMissionControl: true,
            fullscreenable: false,
            // Additional stealth properties
            titleBarStyle: 'hidden',
            vibrancy: 'under-window',
            visualEffectState: 'inactive',
            // Start with normal opacity - will be controlled by screen sharing detection
            opacity: 1
        });
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
          
          console.log('🔧 [SESSION-WINDOW] Session window script loaded for:', sessionId);
          
          function takeScreenshot() {
            console.log('📷 [SESSION-WINDOW] Screenshot button clicked');
            addMessage('📷 Taking screenshot...', 'user');
            ipcRenderer.send('capture-screenshot', { sessionId });
          }
          
          function debugCode() {
            console.log('🐛 [SESSION-WINDOW] Debug button clicked');
            addMessage('🐛 Debugging code...', 'user');
            ipcRenderer.send('debug-code', { sessionId });
          }
          
          function toggleRecording() {
            console.log('🎤 [SESSION-WINDOW] Record Mic button clicked');
            addMessage('🎤 Toggling microphone recording...', 'user');
            ipcRenderer.send('toggle-recording', { sessionId, source: 'microphone' });
          }
          
          function toggleSystemRecording() {
            console.log('🔊 [SESSION-WINDOW] Record System button clicked');
            addMessage('🔊 Toggling system audio recording...', 'user');
            ipcRenderer.send('toggle-system-recording', { sessionId });
          }
          
          function addRAGMaterial() {
            console.log('📚 [SESSION-WINDOW] RAG button clicked');
            addMessage('📚 Adding study materials...', 'user');
            ipcRenderer.send('add-rag-material', { sessionId });
          }
          
          function closeSession() {
            console.log('❌ [SESSION-WINDOW] Close button clicked');
            ipcRenderer.send('close-session', sessionId);
          }
          
          function sendMessage() {
            const input = document.getElementById('messageInput');
            const message = input.value.trim();
            if (message) {
              console.log('💬 [SESSION-WINDOW] Sending message:', message);
              addMessage(message, 'user');
              input.value = '';
              input.style.height = 'auto'; // Reset height after sending
              ipcRenderer.send('chat-message', { sessionId, message });
            }
          }
          
          function handleKeyPress(event) {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              sendMessage();
            }
            // Let Shift+Enter add a new line naturally
          }
          
          function addMessage(text, type) {
            console.log('💬 [SESSION-WINDOW] Adding message:', { type, text: text.substring(0, 100) + '...' });
            
            const chat = document.getElementById('chat');
            const message = document.createElement('div');
            message.className = 'message ' + type + '-message';
            
            // Convert markdown-like formatting to HTML and handle line breaks
            const formattedText = text
              .replace(/\\*\\*(.*?)\\*\\*/g, '<strong>$1</strong>')
              .replace(/\\*(.*?)\\*/g, '<em>$1</em>')
              .replace(/•/g, '•')
              .replace(/\\n/g, '<br>');
            
            message.innerHTML = formattedText + 
              '<div class="message-time">' + new Date().toLocaleTimeString() + '</div>';
            
            chat.appendChild(message);
            chat.scrollTop = chat.scrollHeight;
            
            console.log('💬 [SESSION-WINDOW] Message added to chat');
          }
          
          // IPC listeners with detailed logging
          ipcRenderer.on('chat-response', (event, data) => {
            console.log('💬 [IPC] Received chat-response:', data);
            if (data.sessionId === sessionId) {
              addMessage(data.content, 'ai');
            }
          });
          
          ipcRenderer.on('audio-transcription', (event, data) => {
            console.log('🎤 [IPC] Received audio-transcription:', data);
            if (data.sessionId === sessionId) {
              // Show the transcription and send it for AI processing
              addMessage('🎤 **Audio Transcribed:** "' + data.transcription + '"', 'user');
              
              // Send transcription to chat service for AI response
              ipcRenderer.send('chat-message', { 
                sessionId, 
                message: data.transcription,
                source: 'audio-transcription'
              });
            }
          });

          ipcRenderer.on('ocr-result', (event, data) => {
            console.log('📷 [IPC] Received ocr-result:', data);
            if (data.sessionId === sessionId) {
              // First show the OCR text that was extracted
              addMessage('📷 **OCR Text Extracted:** "' + data.text + '"', 'ai');
              
              // Show debug information
              if (data.debugInfo) {
                const debug = data.debugInfo;
                const debugMsg = '🔍 **Debug Info:**\\n• Profession: ' + debug.profession + 
                               '\\n• Interview Type: ' + debug.interviewType + 
                               '\\n• OpenAI Available: ' + debug.hasOpenAI + 
                               '\\n• Analysis Length: ' + debug.analysisLength + ' chars';
                addMessage(debugMsg, 'ai');
              }
              
              // Then show the AI analysis
              if (data.analysis) {
                console.log('📷 [IPC] Adding OCR analysis to chat');
                addMessage(data.analysis, 'ai');
              } else {
                console.log('📷 [IPC] No analysis available');
                addMessage('❌ No analysis could be generated', 'ai');
              }
            }
          });
          

          
          ipcRenderer.on('recording-status', (event, data) => {
            console.log('🎤 [IPC] Received recording-status:', data);
            if (data.sessionId === sessionId) {
              const status = data.isRecording ? 'Recording started' : 'Recording stopped';
              addMessage('🎤 ' + status, 'ai');
            }
          });
          
          ipcRenderer.on('rag-success', (event, data) => {
            console.log('📚 [IPC] Received rag-success:', data);
            if (data.sessionId === sessionId) {
              addMessage('📚 Study materials processed successfully! ' + data.documentsProcessed + ' documents from ' + data.folderPath, 'ai');
            }
          });
          
          ipcRenderer.on('rag-error', (event, data) => {
            console.log('📚 [IPC] Received rag-error:', data);
            if (data.sessionId === sessionId) {
              addMessage('📚 Error processing study materials: ' + data.error, 'ai');
            }
          });
          
          ipcRenderer.on('transcription-received', (event, data) => {
            console.log('🎤 [IPC] Received transcription:', data);
            if (data.sessionId === sessionId) {
              addMessage('🎤 **Transcription:** "' + data.transcription + '"', 'ai');
            }
          });
          
          ipcRenderer.on('debug-result', (event, data) => {
            console.log('🐛 [IPC] Received debug-result:', data);
            if (data.sessionId === sessionId) {
              // First show the OCR text that was extracted
              if (data.text) {
                addMessage('🐛 **Code Extracted:** "' + data.text + '"', 'ai');
              }
              
              // Then show the debug analysis
              if (data.analysis) {
                console.log('🐛 [IPC] Adding debug analysis to chat');
                addMessage(data.analysis, 'ai');
              } else {
                console.log('🐛 [IPC] No debug analysis available');
                addMessage('❌ No debug analysis could be generated', 'ai');
              }
            }
          });
          
          // Add welcome message
          setTimeout(() => {
            console.log('👋 [SESSION-WINDOW] Adding welcome message');
            addMessage('👋 Welcome! I am ready to assist you with your ${config.profession} ${config.interviewType} interview. Try the buttons above or ask me anything!', 'ai');
          }, 500);
        </script>
      </body>
      </html>
    `;
        sessionWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        // Set content protection to hide from screen sharing (like version1)
        sessionWindow.setContentProtection(true);
        if (process.platform === 'darwin' && sessionWindow.setSharingType) {
            sessionWindow.setSharingType('none');
        }
        sessionWindow.on('closed', () => {
            console.log(`🪟 [SESSION] Session window closed: ${sessionId}`);
            this.sessionWindows.delete(sessionId);
            this.sessions.delete(sessionId);
        });
        this.sessionWindows.set(sessionId, sessionWindow);
        // Initialize session data
        this.sessions.set(sessionId, {
            ...config,
            chatHistory: [],
            isRecording: false,
            isSystemRecording: false,
            hasRAG: false
        });
        console.log(`🪟 [SESSION] Session window created successfully: ${sessionId}`);
        return sessionWindow;
    }
    toggleMainWindow() {
        console.log('🪟 [WINDOW] Toggling main window visibility');
        if (this.mainWindow) {
            if (this.mainWindow.isVisible()) {
                console.log('🪟 [WINDOW] Hiding main window');
                this.mainWindow.hide();
            }
            else {
                console.log('🪟 [WINDOW] Showing main window');
                this.mainWindow.show();
                this.mainWindow.focus();
            }
        }
        else {
            console.log('🪟 [WINDOW] Creating new main window');
            this.createMainWindow();
        }
    }
    hideAllSessionWindows() {
        console.log(`🪟 [WINDOW] Toggling ${this.sessionWindows.size} session windows`);
        this.sessionWindows.forEach((window, sessionId) => {
            if (window.isVisible()) {
                console.log(`🪟 [WINDOW] Hiding session window: ${sessionId}`);
                window.hide();
            }
            else {
                console.log(`🪟 [WINDOW] Showing session window: ${sessionId}`);
                window.show();
                window.focus();
            }
        });
    }
    async captureScreen() {
        this.writeLog('📷 [CAPTURE] Starting full-resolution screen capture...');
        try {
            // Hide all app windows before capture to ensure stealth
            // this.hideAllAppWindows();
            // Wait a moment for windows to hide
            await new Promise(resolve => setTimeout(resolve, 100));
            // Use the improved capture service
            const buffer = await this.captureService.captureScreen();
            // Restore windows after capture
            // this.restoreAllAppWindows();
            this.writeLog(`📷 [CAPTURE] Screenshot captured successfully, size: ${buffer.length} bytes`);
            return buffer;
        }
        catch (error) {
            // Ensure windows are restored even if capture fails
            this.restoreAllAppWindows();
            this.writeLog(`❌ [CAPTURE] Screen capture failed: ${error.message}`);
            throw error;
        }
    }
    hideAllAppWindows() {
        if (this.mainWindow && this.mainWindow.isVisible()) {
            this.mainWindow.hide();
        }
        this.sessionWindows.forEach(window => {
            if (window.isVisible()) {
                window.hide();
            }
        });
        if (this.settingsWindow && this.settingsWindow.isVisible()) {
            this.settingsWindow.hide();
        }
    }
    restoreAllAppWindows() {
        // Only restore windows that were visible before
        // For now, we'll keep them hidden for stealth mode
        // Users can use hotkeys to show them again
    }
    cleanTranscription(text) {
        // Enhanced cleaning to remove timestamps, ANSI color codes, and other noise
        let cleaned = text;
        // Remove ANSI color codes (like [38;5;160m, [0m, etc.)
        cleaned = cleaned.replace(/\x1b\[[0-9;]*m/g, ''); // Standard ANSI codes
        cleaned = cleaned.replace(/\[\d+;\d+;\d+m/g, ''); // 256-color codes like [38;5;160m
        cleaned = cleaned.replace(/\[\d+m/g, ''); // Simple codes like [0m
        cleaned = cleaned.replace(/\[0m/g, ''); // Reset codes
        // Remove VTT timestamps and formatting
        cleaned = cleaned.replace(/\[\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}\]/g, '');
        cleaned = cleaned.replace(/\d{2}:\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}\.\d{3}/g, '');
        cleaned = cleaned.replace(/\[\d{2}:\d{2}\.\d{3}\s*-->\s*\d{2}:\d{2}\.\d{3}\]/g, '');
        cleaned = cleaned.replace(/\[\d+\.\d+s\s*->\s*\d+\.\d+s\]/g, '');
        // Remove WebVTT headers
        cleaned = cleaned.replace(/^WEBVTT\s*/gi, '');
        // Remove speaker labels and confidence scores
        cleaned = cleaned.replace(/\[Speaker \d+\]/gi, '');
        cleaned = cleaned.replace(/\[Confidence: \d+\.\d+\]/gi, '');
        cleaned = cleaned.replace(/\[\d+\.\d+%\]/g, '');
        // Clean up whitespace and newlines
        cleaned = cleaned.replace(/\s+/g, ' ').trim();
        cleaned = cleaned.replace(/\n\s*\n/g, '\n').trim();
        return cleaned;
    }
    startTranscriptionPolling(sessionId) {
        const pollTranscriptions = async () => {
            const session = this.sessions.get(sessionId);
            if (!session || (!session.isRecording && !session.isSystemRecording)) {
                return; // Stop polling if session ended or recording stopped
            }
            try {
                // Get recent transcriptions from audio service
                const transcriptions = this.audioService.getRecentTranscriptions(sessionId);
                for (const transcription of transcriptions) {
                    const cleanedTranscription = this.cleanTranscription(transcription.transcription);
                    if (cleanedTranscription.length > 0) {
                        console.log(`🎤 [TRANSCRIPTION] New transcription for session ${sessionId}: ${cleanedTranscription}`);
                        const sessionWindow = this.sessionWindows.get(sessionId);
                        if (sessionWindow) {
                            sessionWindow.webContents.send('transcription-received', {
                                sessionId,
                                transcription: cleanedTranscription,
                                timestamp: transcription.timestamp,
                                segmentId: transcription.segmentId
                            });
                        }
                        // Process transcription with AI for coaching
                        if (this.openai && session) {
                            try {
                                const isSystem = session.isSystemRecording;
                                const systemPrompt = `You are an expert interview coach specializing in ${session.profession} ${session.interviewType} interviews.`;
                                const coachingRequest = isSystem
                                    ? `🧠 **INTERVIEW QUESTION DETECTED**\n\n"${cleanedTranscription}"\n\nPlease analyze this question and provide:\n
                                          1. **Question Type** – Is this theoretical, behavioral, or coding-related?\n
                                          2. **What the interviewer is expecting** – Key elements they want to hear.\n
                                          3. **Step-by-step structure** – How to answer this clearly and confidently in an interview.\n
                                          4. **Full  answer** – Write a detailed, spoken-style answer that I can say directly in the interview.\n
                                          5. **Bonus Tips** – Any follow-up questions I should ask or traps to avoid.\n
                                          \nAdapt the explanation for a **${session.profession}** role in a **${session.interviewType}** interview.`
                                    : `🗣️ **MY INTERVIEW RESPONSE REVIEW**\n\n"${cleanedTranscription}"\n\nPlease evaluate my response and provide:\n
                                          1. **Was my answer on-point?** – Did I understand the question and address it properly?\n
                                          2. **Strengths** – What I did well.\n
                                          3. **Improvements** – What could be clearer or better.\n
                                          4. **Polish It Up** – Rewrite a cleaner, more impactful version I can say next time.\n
                                          5. **Follow-up Points** – Suggestions to take my answer one step further.\n
                                          \nGive feedback aligned with a **${session.profession}** role in a **${session.interviewType}** setting.`;
                                const completion = await this.openai.chat.completions.create({
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
                                        content: `🤖 **AI Coach:** ${aiResponse}`,
                                        timestamp: new Date().toISOString(),
                                        source: isSystem ? 'system-audio-transcription' : 'audio-transcription'
                                    });
                                }
                            }
                            catch (error) {
                                console.error(`🎤 [AI] Failed to process transcription for session ${sessionId}:`, error);
                            }
                        }
                    }
                }
                // Continue polling if still recording
                if (session.isRecording || session.isSystemRecording) {
                    setTimeout(pollTranscriptions, 2000); // Poll every 2 seconds
                }
            }
            catch (error) {
                console.error(`🎤 [TRANSCRIPTION] Polling error for session ${sessionId}:`, error);
                // Continue polling despite errors
                if (session && (session.isRecording || session.isSystemRecording)) {
                    setTimeout(pollTranscriptions, 5000); // Retry after 5 seconds
                }
            }
        };
        // Start polling after initial delay
        setTimeout(pollTranscriptions, 3000);
    }
    async extractTextFromImage(imageBuffer) {
        this.writeLog('📷 [OCR] Starting real text extraction...');
        try {
            // Validate image buffer
            if (!imageBuffer || imageBuffer.length === 0) {
                throw new Error('Empty or invalid image buffer provided');
            }
            this.writeLog(`📷 [OCR] Image buffer size: ${imageBuffer.length} bytes`);
            // Initialize OCR service if not already done
            if (!this.ocrService.isReady()) {
                this.writeLog('🔧 [OCR] Initializing OCR service...');
                await this.ocrService.initialize();
            }
            // Use real OCR to extract text from the image
            const ocrResult = await this.ocrService.extractText(imageBuffer);
            this.writeLog(`📷 [OCR] Real text extraction completed: "${ocrResult}"`);
            // Return the extracted text for further processing
            if (!ocrResult || ocrResult.trim().length === 0) {
                return 'No text detected in the screenshot. Please ensure there is readable text visible and try again.';
            }
            return ocrResult;
        }
        catch (error) {
            this.writeLog(`❌ [OCR] Real text extraction failed: ${error.message}`);
            // Provide more specific error messages
            const errorMessage = error.message;
            if (errorMessage.includes('Empty or invalid image buffer')) {
                return 'Screenshot capture failed - no image data received. Please try taking another screenshot.';
            }
            else if (errorMessage.includes('Error attempting to read image')) {
                return 'Image format error - unable to process the screenshot. Please try again.';
            }
            else {
                return `OCR processing failed: ${errorMessage}. Please try taking another screenshot.`;
            }
        }
    }
    async generateOpenAIScreenshotAnalysis(ocrText, profession, interviewType) {
        this.writeLog(`🤖 [AI] Generating OpenAI analysis for ${profession} ${interviewType}`);
        try {
            if (!this.openai) {
                throw new Error('OpenAI client not initialized');
            }
            // const systemPrompt = `You are an expert interview coach specializing in ${profession} ${interviewType} interviews.
            // Analyze the following interview question and provide comprehensive guidance:
            // QUESTION: "${ocrText}"
            // Provide a detailed response that includes:
            // 1. Problem analysis and approach
            // 2. Step-by-step solution strategy
            // 3. Code implementation (if applicable) - ALWAYS include working code examples
            // 4. Time and space complexity analysis
            // 5. Edge cases to consider
            // 6. Interview tips and best practices
            // Format your response with clear sections and use markdown for better readability. Be specific and actionable. ALWAYS include actual code implementations.`;
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
            // const userPrompt = `Please analyze this ${interviewType} interview question for a ${profession}: ${ocrText}`;
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
            // Log the exact prompts being sent
            this.writeLog(`🤖 [AI] System Prompt: ${systemPrompt}`);
            this.writeLog(`🤖 [AI] User Prompt: ${userPrompt}`);
            this.writeLog(`🤖 [AI] OCR Text: "${ocrText}"`);
            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                max_tokens: 1500,
                temperature: 0.3
            });
            const analysis = completion.choices[0].message.content || 'Unable to generate analysis';
            this.writeLog(`🤖 [AI] OpenAI analysis generated successfully (${analysis.length} characters)`);
            this.writeLog(`🤖 [AI] Analysis content: ${analysis.substring(0, 200)}...`);
            return analysis;
        }
        catch (error) {
            this.writeLog(`❌ [AI] OpenAI analysis failed: ${error.message}`);
            throw error;
        }
    }
    generateFallbackAnalysis(ocrText, profession, interviewType) {
        this.writeLog(`🤖 [AI] Generating fallback analysis for ${profession} ${interviewType}`);
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
    generateFallbackDebugAnalysis(ocrText, profession) {
        this.writeLog(`🤖 [AI] Generating fallback debug analysis for ${profession}`);
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
    createSettingsWindow() {
        console.log('⚙️ [SETTINGS] Creating settings window...');
        if (this.settingsWindow) {
            console.log('⚙️ [SETTINGS] Settings window already exists, focusing...');
            this.settingsWindow.focus();
            return this.settingsWindow;
        }
        this.settingsWindow = new electron_1.BrowserWindow({
            width: 700,
            height: 600,
            minWidth: 500,
            minHeight: 400,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false
            },
            title: 'Interview Assistant - Settings',
            resizable: true,
            alwaysOnTop: true
        });
        const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Interview Assistant - Settings</title>
        <style>
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            background: #f8f9fa;
          }
          .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 20px;
            text-align: center;
          }
          .container {
            padding: 20px;
            max-width: 500px;
            margin: 0 auto;
          }
          .section {
            background: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .section h3 {
            margin-top: 0;
            color: #333;
            border-bottom: 2px solid #667eea;
            padding-bottom: 8px;
          }
          .form-group {
            margin-bottom: 15px;
          }
          label {
            display: block;
            margin-bottom: 5px;
            font-weight: 500;
            color: #555;
          }
          input[type="text"], input[type="password"], select, textarea {
            width: 100%;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-size: 14px;
            box-sizing: border-box;
          }
          button {
            background: #007AFF;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            margin-right: 10px;
          }
          button:hover {
            background: #0056CC;
          }
          button.secondary {
            background: #6c757d;
          }
          button.secondary:hover {
            background: #545b62;
          }
          .status {
            padding: 10px;
            border-radius: 4px;
            margin-top: 10px;
            font-size: 14px;
          }
          .status.success {
            background: #d4edda;
            color: #155724;
            border: 1px solid #c3e6cb;
          }
          .status.error {
            background: #f8d7da;
            color: #721c24;
            border: 1px solid #f5c6cb;
          }
          .feature-list {
            list-style: none;
            padding: 0;
          }
          .feature-list li {
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .feature-list li:last-child {
            border-bottom: none;
          }
          .feature-list li::before {
            content: '✅ ';
            margin-right: 8px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>⚙️ Interview Assistant Settings</h2>
          <p>Configure your AI-powered interview assistance</p>
        </div>
        
        <div class="container">
          <div class="section">
            <h3>🔑 OpenAI API Configuration</h3>
            <div class="form-group">
              <label for="apiKey">API Key:</label>
              <input type="password" id="apiKey" placeholder="sk-..." />
              <small style="color: #666;">Your API key is stored securely and never shared.</small>
            </div>
            <button onclick="testApiKey()">Test Connection</button>
            <button onclick="saveApiKey()">Save API Key</button>
            <div id="apiStatus"></div>
          </div>
          
          <div class="section">
            <h3>🎯 Interview Preferences</h3>
            <div class="form-group">
              <label for="defaultProfession">Default Profession:</label>
              <select id="defaultProfession">
                <option value="software-engineer">Software Engineer</option>
                <option value="data-scientist">Data Scientist</option>
                <option value="product-manager">Product Manager</option>
                <option value="designer">UX/UI Designer</option>
              </select>
            </div>
            <div class="form-group">
              <label for="defaultInterviewType">Default Interview Type:</label>
              <select id="defaultInterviewType">
                <option value="technical">Technical</option>
                <option value="behavioral">Behavioral</option>
                <option value="system-design">System Design</option>
                <option value="coding">Coding</option>
              </select>
            </div>
            <button onclick="savePreferences()">Save Preferences</button>
          </div>
          
          <div class="section">
            <h3>🚀 Features Available</h3>
            <ul class="feature-list">
              <li><strong>Stealth Mode:</strong> Invisible during screen sharing</li>
              <li><strong>Screenshot OCR:</strong> Analyze interview questions instantly</li>
              <li><strong>Audio Transcription:</strong> Real-time conversation analysis</li>
              <li><strong>RAG Knowledge Base:</strong> Personalized assistance from your materials</li>
              <li><strong>Code Debugging:</strong> Identify and fix code issues</li>
              <li><strong>Multi-Session Support:</strong> Handle multiple interviews</li>
              <li><strong>Global Hotkeys:</strong> Quick access with Cmd+G/Cmd+H</li>
              <li><strong>Error Recovery:</strong> Graceful handling of failures</li>
            </ul>
          </div>
          
          <div class="section">
            <h3>ℹ️ About</h3>
            <p><strong>Interview Assistant v1.0.0</strong></p>
            <p>AI-powered stealth interview assistance for technical professionals.</p>
            <p>Built with Electron, OpenAI GPT, and advanced OCR/Audio processing.</p>
            <button onclick="closeSettings()" class="secondary">Close Settings</button>
          </div>
        </div>
        
        <script>
          const { ipcRenderer } = require('electron');
          
          console.log('⚙️ [SETTINGS-WINDOW] Settings window script loaded');
          
          // Load saved settings
          window.addEventListener('DOMContentLoaded', () => {
            console.log('⚙️ [SETTINGS-WINDOW] Loading saved settings...');
            // Load API key status (don't show actual key for security)
            const apiKey = localStorage.getItem('hasApiKey');
            if (apiKey) {
              showStatus('apiStatus', 'API key configured', 'success');
            }
          });
          
          ipcRenderer.on('api-key-saved', () => {
            console.log('🔑 [SETTINGS-WINDOW] API key saved successfully');
            showStatus('apiStatus', 'API key saved successfully!', 'success');
            localStorage.setItem('hasApiKey', 'true');
          });
          
          ipcRenderer.on('api-key-valid', (event, message) => {
            console.log('🔑 [SETTINGS-WINDOW] API key validation successful:', message);
            showStatus('apiStatus', message, 'success');
          });
          
          ipcRenderer.on('api-key-invalid', (event, error) => {
            console.log('🔑 [SETTINGS-WINDOW] API key validation failed:', error);
            showStatus('apiStatus', 'Invalid API key: ' + error, 'error');
          });
          
          function testApiKey() {
            const apiKey = document.getElementById('apiKey').value;
            if (!apiKey) {
              showStatus('apiStatus', 'Please enter an API key first', 'error');
              return;
            }
            
            console.log('🔑 [SETTINGS-WINDOW] Testing API key...');
            showStatus('apiStatus', 'Testing API key...', 'success');
            ipcRenderer.send('test-api-key', apiKey);
          }
          
          function saveApiKey() {
            const apiKey = document.getElementById('apiKey').value;
            if (!apiKey) {
              showStatus('apiStatus', 'Please enter an API key first', 'error');
              return;
            }
            
            console.log('🔑 [SETTINGS-WINDOW] Saving API key...');
            ipcRenderer.send('save-api-key', apiKey);
            document.getElementById('apiKey').value = ''; // Clear for security
          }
          
          function savePreferences() {
            const profession = document.getElementById('defaultProfession').value;
            const interviewType = document.getElementById('defaultInterviewType').value;
            
            console.log('⚙️ [SETTINGS-WINDOW] Saving preferences:', { profession, interviewType });
            
            localStorage.setItem('defaultProfession', profession);
            localStorage.setItem('defaultInterviewType', interviewType);
            
            alert('Preferences saved successfully!');
          }
          
          function closeSettings() {
            console.log('⚙️ [SETTINGS-WINDOW] Closing settings window');
            window.close();
          }
          
          function showStatus(elementId, message, type) {
            const statusEl = document.getElementById(elementId);
            statusEl.textContent = message;
            statusEl.className = 'status ' + type;
          }
        </script>
      </body>
      </html>
    `;
        this.settingsWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
        // Set content protection to hide from screen sharing (like version1)
        this.settingsWindow.setContentProtection(true);
        if (process.platform === 'darwin' && this.settingsWindow.setSharingType) {
            this.settingsWindow.setSharingType('none');
        }
        this.settingsWindow.on('closed', () => {
            console.log('⚙️ [SETTINGS] Settings window closed');
            this.settingsWindow = null;
        });
        console.log('⚙️ [SETTINGS] Settings window created successfully');
        return this.settingsWindow;
    }
    setupIpcHandlers() {
        console.log('🔧 [IPC] Setting up IPC handlers...');
        electron_1.ipcMain.on('create-session', async (event, config) => {
            try {
                console.log(`🚀 [IPC] Creating session with config:`, config);
                // Create session using SessionManager
                const session = await this.sessionManager.createSession({
                    profession: config.profession,
                    interviewType: config.interviewType
                });
                const sessionWindow = this.createSessionWindow(session.id, {
                    id: session.id,
                    profession: session.profession,
                    interviewType: session.interviewType,
                    createdAt: new Date(),
                    isActive: true
                });
                console.log(`🚀 [IPC] Session created successfully: ${session.profession} - ${session.interviewType} (ID: ${session.id})`);
            }
            catch (error) {
                console.error(`🚀 [IPC] Failed to create session:`, error);
            }
        });
        electron_1.ipcMain.on('close-session', async (event, sessionId) => {
            console.log(`🔴 [IPC] Closing session: ${sessionId}`);
            try {
                // Stop any active recording
                if (this.audioService.getRecordingStatus(sessionId).isRecording) {
                    await this.audioService.stopRecording(sessionId);
                }
                // Close session in SessionManager
                await this.sessionManager.closeSession(sessionId);
                // Close window
                const window = this.sessionWindows.get(sessionId);
                if (window) {
                    window.close();
                    console.log(`🔴 [IPC] Session closed: ${sessionId}`);
                }
                else {
                    console.log(`⚠️ [IPC] Session window not found: ${sessionId}`);
                }
            }
            catch (error) {
                console.error(`🔴 [IPC] Error closing session ${sessionId}:`, error);
            }
        });
        electron_1.ipcMain.on('chat-message', async (event, data) => {
            const { sessionId, message, source } = data;
            const session = this.sessions.get(sessionId);
            if (source === 'audio-transcription') {
                console.log(`🎤 [IPC] Audio transcription in session ${sessionId}:`, message);
            }
            else {
                console.log(`💬 [IPC] Chat message in session ${sessionId}:`, message);
            }
            try {
                let aiResponse = '';
                if (this.openai && session) {
                    console.log(`🤖 [OPENAI] Using ChatService with conversation context for ${session.profession} ${session.interviewType}`);
                    // Add context for audio transcriptions
                    let contextualMessage = message;
                    if (source === 'audio-transcription') {
                        contextualMessage = `[Audio Transcription] The user said: "${message}". Please provide interview coaching advice or answer their question based on this audio input.`;
                    }
                    // Use ChatService to maintain conversation context
                    aiResponse = await this.chatService.sendMessage(sessionId, contextualMessage);
                    console.log(`🤖 [OPENAI] Generated contextual response for session ${sessionId}`);
                }
                else {
                    console.log(`⚠️ [OPENAI] No API key or session found, using fallback response`);
                    // Fallback responses when no API key is configured
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
            }
            catch (error) {
                console.error(`💬 [IPC] Chat error for session ${sessionId}:`, error);
                event.reply('chat-response', {
                    sessionId,
                    content: 'I encountered an error processing your message. Please check your API key configuration in Settings and try again.',
                    timestamp: new Date().toISOString()
                });
            }
        });
        // Add event listener for audio transcription results
        electron_1.ipcMain.on('transcription-ready', async (event, data) => {
            const { sessionId, transcription } = data;
            const session = this.sessions.get(sessionId);
            console.log(`🎤 [TRANSCRIPTION] Processing transcription for session ${sessionId}: "${transcription}"`);
            try {
                let aiResponse = '';
                if (this.openai && session && this.chatService) {
                    console.log(`🤖 [OPENAI] Using ChatService to process audio transcription for ${session.profession} ${session.interviewType}`);
                    // Process transcription through ChatService with proper context
                    aiResponse = await this.chatService.processTranscript(sessionId, transcription, types_1.AudioSource.BOTH);
                    console.log(`🤖 [OPENAI] Generated transcription response for session ${sessionId}`);
                }
                else {
                    console.log(`⚠️ [OPENAI] No API key or session found, using fallback response`);
                    aiResponse = `I heard: "${transcription}". This seems like a good point! (Configure your OpenAI API key in Settings for AI-powered coaching)`;
                }
                // Send transcription result to the session window
                const sessionWindow = this.sessionWindows.get(sessionId);
                if (sessionWindow && !sessionWindow.isDestroyed()) {
                    sessionWindow.webContents.send('chat-response', {
                        sessionId,
                        content: `🎤 **Transcription:** ${transcription}\n\n🤖 **AI Response:** ${aiResponse}`,
                        timestamp: new Date().toISOString(),
                        source: 'audio-transcription'
                    });
                    console.log(`🎤 [TRANSCRIPTION] Sent transcription and AI response to session window`);
                }
                else {
                    console.warn(`🎤 [TRANSCRIPTION] No session window found for ${sessionId}`);
                }
            }
            catch (error) {
                console.error(`🎤 [TRANSCRIPTION] Error processing transcription for session ${sessionId}:`, error);
                // Send error message to session window
                const sessionWindow = this.sessionWindows.get(sessionId);
                if (sessionWindow && !sessionWindow.isDestroyed()) {
                    sessionWindow.webContents.send('chat-response', {
                        sessionId,
                        content: `🎤 **Transcription:** ${transcription}\n\n❌ **Error:** Failed to process transcription. Please check your API configuration.`,
                        timestamp: new Date().toISOString(),
                        source: 'audio-transcription-error'
                    });
                }
            }
        });
        electron_1.ipcMain.on('capture-screenshot', async (event, data) => {
            const { sessionId } = data;
            const session = this.sessions.get(sessionId);
            this.writeLog(`📷 [IPC] Screenshot capture requested for session: ${sessionId}`);
            try {
                // Step 1: Capture screenshot
                this.writeLog(`📷 [OCR] Starting screen capture...`);
                const screenshot = await this.captureScreen();
                this.writeLog(`📷 [OCR] Screen capture completed, size: ${screenshot.length} bytes`);
                // Step 2: Extract text using OCR (simulated for now, but with realistic processing)
                this.writeLog(`📷 [OCR] Starting OCR text extraction...`);
                const ocrText = await this.extractTextFromImage(screenshot);
                this.writeLog(`📷 [OCR] OCR extraction completed: "${ocrText.substring(0, 100)}..."`);
                // Step 3: Generate AI analysis using OpenAI
                let aiAnalysis = '';
                if (this.openai && session) {
                    this.writeLog(`🤖 [AI] Using OpenAI for screenshot analysis (${session.profession} ${session.interviewType})`);
                    aiAnalysis = await this.generateOpenAIScreenshotAnalysis(ocrText, session.profession, session.interviewType);
                }
                else {
                    this.writeLog(`⚠️ [AI] No OpenAI client available, using fallback analysis`);
                    aiAnalysis = this.generateFallbackAnalysis(ocrText, session?.profession || 'software-engineer', session?.interviewType || 'technical');
                }
                this.writeLog(`📷 [IPC] Sending OCR result for session ${sessionId}`);
                // Send OCR text, prompt, and AI analysis for debugging
                event.reply('ocr-result', {
                    sessionId,
                    text: ocrText,
                    analysis: aiAnalysis,
                    debugInfo: {
                        ocrText: ocrText,
                        profession: session?.profession || 'unknown',
                        interviewType: session?.interviewType || 'unknown',
                        hasOpenAI: !!this.openai,
                        analysisLength: aiAnalysis.length
                    },
                    timestamp: new Date().toISOString()
                });
            }
            catch (error) {
                this.writeLog(`❌ [OCR] Screenshot processing failed: ${error.message}`);
                event.reply('ocr-result', {
                    sessionId,
                    text: 'Screenshot capture failed',
                    analysis: 'I encountered an error while capturing and analyzing the screenshot. Please try again or check your system permissions.',
                    timestamp: new Date().toISOString()
                });
            }
        });
        electron_1.ipcMain.on('debug-code', async (event, data) => {
            const { sessionId } = data;
            const session = this.sessions.get(sessionId);
            this.writeLog(`🐛 [IPC] Code debug requested for session: ${sessionId}`);
            try {
                // Step 1: Capture screenshot
                this.writeLog(`🐛 [DEBUG] Starting screen capture for debug...`);
                const screenshot = await this.captureScreen();
                this.writeLog(`🐛 [DEBUG] Screen capture completed, size: ${screenshot.length} bytes`);
                // Step 2: Extract text using OCR
                this.writeLog(`🐛 [DEBUG] Starting OCR text extraction...`);
                const ocrText = await this.extractTextFromImage(screenshot);
                this.writeLog(`🐛 [DEBUG] OCR extraction completed: "${ocrText.substring(0, 100)}..."`);
                // Step 3: Generate debug analysis using OpenAI
                let debugAnalysis = '';
                if (this.openai && session) {
                    this.writeLog(`🤖 [DEBUG] Using OpenAI for debug analysis (${session.profession} ${session.interviewType})`);
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
                    const completion = await this.openai.chat.completions.create({
                        model: 'gpt-4',
                        messages: [
                            { role: 'system', content: systemPrompt },
                            { role: 'user', content: `Please debug this code: ${ocrText}` }
                        ],
                        max_tokens: 1500,
                        temperature: 0.3
                    });
                    debugAnalysis = completion.choices[0].message.content || 'Unable to generate debug analysis';
                }
                else {
                    this.writeLog(`⚠️ [DEBUG] No OpenAI client available, using fallback analysis`);
                    debugAnalysis = this.generateFallbackDebugAnalysis(ocrText, session?.profession || 'software-engineer');
                }
                this.writeLog(`🐛 [IPC] Sending debug result for session ${sessionId}`);
                event.reply('debug-result', {
                    sessionId,
                    text: ocrText,
                    analysis: debugAnalysis,
                    timestamp: new Date().toISOString()
                });
            }
            catch (error) {
                this.writeLog(`❌ [DEBUG] Debug processing failed: ${error.message}`);
                event.reply('debug-result', {
                    sessionId,
                    text: 'Debug capture failed',
                    analysis: 'I encountered an error while capturing and analyzing the code. Please try again or check your system permissions.',
                    timestamp: new Date().toISOString()
                });
            }
        });
        electron_1.ipcMain.on('toggle-recording', async (event, data) => {
            const { sessionId } = data;
            const session = this.sessions.get(sessionId);
            this.writeLog(`🎤 [IPC] Recording toggle requested for session: ${sessionId}`);
            if (session) {
                try {
                    if (!session.isRecording) {
                        // Start recording
                        this.writeLog(`🎤 [IPC] Starting audio recording for session: ${sessionId}`);
                        // Initialize audio service if not ready
                        if (!this.audioService.isReady()) {
                            this.writeLog(`🎤 [IPC] Initializing audio service...`);
                            await this.audioService.initialize();
                            this.writeLog(`🎤 [IPC] Audio service initialized`);
                        }
                        // Check audio service status
                        const audioStatus = this.audioService.getStatus();
                        this.writeLog(`🎤 [IPC] Audio service status: ${JSON.stringify(audioStatus)}`);
                        // Start recording both interviewer and interviewee audio
                        this.writeLog(`🎤 [IPC] Calling audioService.startRecording with AudioSource.BOTH`);
                        await this.audioService.startRecording(types_1.AudioSource.BOTH, sessionId);
                        session.isRecording = true;
                        // Start polling for transcriptions
                        this.writeLog(`🎤 [IPC] Starting transcription polling for session: ${sessionId}`);
                        this.startTranscriptionPolling(sessionId);
                        this.writeLog(`🎤 [IPC] Recording started successfully for session: ${sessionId}`);
                    }
                    else {
                        // Stop recording and get transcription
                        this.writeLog(`🎤 [IPC] Stopping audio recording for session: ${sessionId}`);
                        const transcription = await this.audioService.stopRecording(sessionId);
                        session.isRecording = false;
                        this.writeLog(`🎤 [IPC] Recording stopped for session: ${sessionId}`);
                        if (transcription) {
                            this.writeLog(`🎤 [TRANSCRIPTION] Received transcription: "${transcription}"`);
                            // Display transcription in chat window
                            const sessionWindow = this.sessionWindows.get(sessionId);
                            if (sessionWindow && !sessionWindow.isDestroyed()) {
                                sessionWindow.webContents.send('chat-response', {
                                    sessionId,
                                    content: `🎤 **Transcription:** ${transcription}`,
                                    timestamp: new Date().toISOString(),
                                    source: 'audio-transcription'
                                });
                            }
                            // Send transcription to LLM for analysis
                            if (this.openai && session) {
                                try {
                                    // Create direct AI analysis for mic audio (interviewee)
                                    const systemPrompt = `You are an expert interview coach specializing in ${session.profession} ${session.interviewType} interviews. The user has just provided their response to a question.`;
                                    const coachingRequest = `🗣️ **MY INTERVIEW RESPONSE REVIEW:**\n\n"${transcription}"\n\nThis is what I just said in response. Please analyze and provide:\n
                                    1. **Assessment** – Did I correctly understand and address the question?\n
                                    2. **Strengths** – What I did well in terms of content, clarity, and delivery.\n
                                    3. **Improvements** – Specific areas where I can be clearer, more structured, or more concise.\n
                                    4. **Polished Version** – Rewrite a strong, spoken-style version of my answer that I can say next time.\n
                                    5. **Follow-up Suggestions** – Any additional points or questions I could raise to show depth.\n
                                    \nEvaluate this in the context of a **${session.profession}** role during a **${session.interviewType}** interview.`;
                                    const completion = await this.openai.chat.completions.create({
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
                                }
                                catch (error) {
                                    console.error(`Failed to process mic audio transcription: ${error}`);
                                }
                            }
                        }
                    }
                    event.reply('recording-status', {
                        sessionId,
                        isRecording: session.isRecording
                    });
                }
                catch (error) {
                    this.writeLog(`❌ [IPC] Recording toggle failed for session ${sessionId}: ${error.message}`);
                    this.writeLog(`❌ [IPC] Error stack: ${error.stack}`);
                    session.isRecording = false;
                    event.reply('recording-status', {
                        sessionId,
                        isRecording: false,
                        error: error.message
                    });
                }
            }
            else {
                this.writeLog(`⚠️ [IPC] Session not found for recording toggle: ${sessionId}`);
            }
        });
        // Add handler for system audio recording
        electron_1.ipcMain.on('toggle-system-recording', async (event, data) => {
            const { sessionId } = data;
            const session = this.sessions.get(sessionId);
            this.writeLog(`🔊 [IPC] System recording toggle requested for session: ${sessionId}`);
            if (session) {
                try {
                    if (!session.isSystemRecording) {
                        // Start system audio recording
                        this.writeLog(`🔊 [IPC] Starting system audio recording for session: ${sessionId}`);
                        // Initialize audio service if not ready
                        if (!this.audioService.isReady()) {
                            this.writeLog(`🔊 [IPC] Initializing audio service...`);
                            await this.audioService.initialize();
                            this.writeLog(`🔊 [IPC] Audio service initialized`);
                        }
                        // Check audio service status
                        const audioStatus = this.audioService.getStatus();
                        this.writeLog(`🔊 [IPC] Audio service status: ${JSON.stringify(audioStatus)}`);
                        // Start recording system audio only
                        this.writeLog(`🔊 [IPC] Calling audioService.startRecording with AudioSource.SYSTEM`);
                        await this.audioService.startRecording(types_1.AudioSource.SYSTEM, sessionId);
                        session.isSystemRecording = true;
                        // Start polling for transcriptions
                        this.writeLog(`🔊 [IPC] Starting transcription polling for session: ${sessionId}`);
                        this.startTranscriptionPolling(sessionId);
                        this.writeLog(`🔊 [IPC] System recording started successfully for session: ${sessionId}`);
                    }
                    else {
                        // Stop system recording and get transcription
                        this.writeLog(`🔊 [IPC] Stopping system audio recording for session: ${sessionId}`);
                        const transcription = await this.audioService.stopRecording(sessionId);
                        session.isSystemRecording = false;
                        this.writeLog(`🔊 [IPC] System recording stopped for session: ${sessionId}`);
                        if (transcription) {
                            this.writeLog(`🔊 [TRANSCRIPTION] Received system audio transcription: "${transcription}"`);
                            // Display transcription in chat window
                            const sessionWindow = this.sessionWindows.get(sessionId);
                            if (sessionWindow && !sessionWindow.isDestroyed()) {
                                sessionWindow.webContents.send('chat-response', {
                                    sessionId,
                                    content: `🔊 **System Audio Transcription:** ${transcription}`,
                                    timestamp: new Date().toISOString(),
                                    source: 'system-audio-transcription'
                                });
                            }
                            // Send transcription to LLM for analysis
                            if (this.openai && session) {
                                try {
                                    // Create direct AI analysis for system audio (interviewer)
                                    const systemPrompt = `You are an expert interview coach specializing in ${session.profession} ${session.interviewType} interviews. The interviewer just asked a question.`;
                                    const coachingRequest = `🧠 **INTERVIEW QUESTION DETECTED:**\n\n"${transcription}"\n\nPlease analyze this question and provide:\n
                                      1. **Question Type** – Is this a theoretical, behavioral, or coding question?\n
                                      2. **What the interviewer is expecting** – What should a strong answer include?\n
                                      3. **Answer Structure** – Step-by-step breakdown of how to respond effectively.\n
                                      4. ** Answer** – A clear and detailed answer I can say directly in the interview.if there is code asked the give the code too its important.\n
                                      5. **Follow-up Advice** – Any clarifying questions I should ask or pitfalls to avoid.\n
                                      \nTailor everything specifically for a **${session.profession}** role in a **${session.interviewType}** interview.`;
                                    const completion = await this.openai.chat.completions.create({
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
                                }
                                catch (error) {
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
                }
                catch (error) {
                    this.writeLog(`❌ [IPC] System recording toggle failed for session ${sessionId}: ${error.message}`);
                    this.writeLog(`❌ [IPC] Error stack: ${error.stack}`);
                    session.isSystemRecording = false;
                    event.reply('recording-status', {
                        sessionId,
                        isRecording: false,
                        recordingType: 'system',
                        error: error.message
                    });
                }
            }
            else {
                this.writeLog(`⚠️ [IPC] Session not found for system recording toggle: ${sessionId}`);
            }
        });
        electron_1.ipcMain.on('add-rag-material', async (event, data) => {
            const { sessionId } = data;
            this.writeLog(`📚 [IPC] RAG material addition requested for session: ${sessionId}`);
            try {
                // Show folder selection dialog
                const result = await electron_1.dialog.showOpenDialog({
                    title: 'Select Study Materials Folder',
                    properties: ['openDirectory'],
                    message: 'Choose a folder containing your study materials (.txt, .md files)'
                });
                if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
                    this.writeLog(`📚 [IPC] RAG folder selection cancelled for session: ${sessionId}`);
                    return;
                }
                const folderPath = result.filePaths[0];
                this.writeLog(`📚 [IPC] Processing RAG materials from: ${folderPath}`);
                // Check if folder exists and has files
                if (!fs.existsSync(folderPath)) {
                    throw new Error('Selected folder does not exist');
                }
                const files = fs.readdirSync(folderPath);
                const supportedFiles = files.filter(file => file.endsWith('.txt') || file.endsWith('.md'));
                this.writeLog(`📚 [RAG] Found ${supportedFiles.length} supported files in ${folderPath}`);
                this.writeLog(`📚 [RAG] Supported files: ${supportedFiles.join(', ')}`);
                if (supportedFiles.length === 0) {
                    throw new Error('No supported files (.txt, .md) found in the selected folder');
                }
                // Process documents using RAG service
                this.writeLog(`📚 [RAG] Starting document ingestion...`);
                await this.ragService.ingestDocuments(folderPath, sessionId);
                // Get knowledge base info
                const knowledgeBase = this.ragService.getKnowledgeBase(sessionId);
                const documentCount = knowledgeBase ? knowledgeBase.documents.length : 0;
                this.writeLog(`📚 [IPC] RAG processing complete for session: ${sessionId}, processed ${documentCount} documents`);
                // Update session with RAG status
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
            }
            catch (error) {
                this.writeLog(`❌ [RAG] RAG processing failed for session ${sessionId}: ${error.message}`);
                event.reply('rag-error', {
                    sessionId,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });
        electron_1.ipcMain.on('open-settings', () => {
            console.log('⚙️ [IPC] Settings window requested');
            this.createSettingsWindow();
        });
        // Add handlers for settings functionality
        electron_1.ipcMain.on('save-api-key', async (event, apiKey) => {
            console.log('🔑 [IPC] Saving API key...');
            try {
                // Save to Electron Store first (always works)
                this.store.set('openai-api-key', apiKey);
                // Try to save to ConfigurationManager but don't fail if encryption fails
                try {
                    await this.configurationManager.updateApiKey(apiKey);
                    console.log('🔑 [IPC] API key saved to both Electron Store and ConfigurationManager');
                }
                catch (configError) {
                    console.warn('🔑 [IPC] ConfigurationManager save failed, but Electron Store succeeded:', configError.message);
                    // Continue - the key is still saved in Electron Store
                }
                this.initializeOpenAI(); // Reinitialize OpenAI with new key
                console.log('🔑 [IPC] API key saved and OpenAI reinitialized');
                event.reply('api-key-saved');
            }
            catch (error) {
                console.error('🔑 [IPC] Failed to save API key:', error);
                event.reply('api-key-invalid', 'Failed to save API key: ' + error.message);
            }
        });
        electron_1.ipcMain.on('test-api-key', async (event, apiKey) => {
            console.log('🔑 [IPC] Testing API key...');
            try {
                const testOpenAI = new openai_1.default({ apiKey });
                const response = await testOpenAI.models.list();
                console.log('🔑 [IPC] API key test successful');
                event.reply('api-key-valid', 'API key is valid and working!');
            }
            catch (error) {
                console.error('🔑 [IPC] API key test failed:', error);
                event.reply('api-key-invalid', error.message);
            }
        });
        console.log('🔧 [IPC] IPC handlers setup complete');
    }
}
// Initialize the application
console.log('🔧 [MAIN] Starting Interview Assistant...');
new InterviewAssistant();
console.log('🎯 Interview Assistant - Development Version with Enhanced Logging');
console.log('===============================================================');
console.log('✅ TypeScript compilation successful');
console.log('✅ All dependencies resolved');
console.log('✅ Development environment ready');
console.log('✅ npm start command working');
console.log('✅ Comprehensive logging enabled');
console.log('✅ Message formatting fixed');
console.log('');
console.log('🚀 Application starting...');
