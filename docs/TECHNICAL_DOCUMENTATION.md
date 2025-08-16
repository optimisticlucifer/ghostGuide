# GhostGuide Technical Documentation

## Table of Contents

1. [Application Overview](#application-overview)
2. [Architecture](#architecture)
3. [Application Flow](#application-flow)
4. [Service Layer](#service-layer)
5. [IPC Communication](#ipc-communication)
6. [Data Models](#data-models)
7. [API Reference](#api-reference)
8. [Configuration](#configuration)
9. [Security Features](#security-features)
10. [Development Guide](#development-guide)

---

## Application Overview

**GhostGuide** is an Electron-based desktop application designed to provide AI-powered assistance during technical interviews. It operates in stealth mode to remain undetectable during screen sharing sessions while providing real-time help through screenshot analysis, audio transcription, and AI coaching.

### Key Technologies

- **Framework**: Electron 30.0.6
- **Language**: TypeScript 5.0+
- **AI/ML**: OpenAI GPT-4, Whisper ASR
- **OCR**: Tesseract.js
- **Vector Database**: LanceDB
- **Audio Processing**: FFmpeg
- **Build System**: TypeScript Compiler, npm scripts

### Core Features

- **Screenshot Analysis**: OCR text extraction and AI-powered question analysis
- **Audio Transcription**: Real-time microphone and system audio capture with Whisper
- **AI Coaching**: Contextual interview assistance using GPT-4
- **RAG Integration**: Personal knowledge base for context-aware responses  
- **Stealth Mode**: Screen sharing detection and window protection
- **Multi-session Support**: Concurrent interview sessions management

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GhostGuide Application                    │
├─────────────────────────────────────────────────────────────┤
│  Main Process (Node.js/Electron)                           │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │ ApplicationController │  │    main.ts      │              │
│  │  - Lifecycle Mgmt   │  │  - Entry Point  │              │
│  │  - Service Init     │  │  - Event Setup  │              │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┤
│  │                   Service Layer                         │
│  ├─────────────────┬─────────────────┬───────────────────┤
│  │ Core Services   │ AI Services     │ System Services    │
│  │ - SessionManager│ - ChatService   │ - CaptureService  │
│  │ - WindowManager │ - OCRService    │ - AudioService    │
│  │ - ConfigManager │ - RAGService    │ - ScreenDetection │
│  │                 │ - PromptLibrary │                   │
│  └─────────────────┴─────────────────┴───────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────────┤
│  │                  IPC Controller                         │
│  │  - Session Handlers    - Audio Handlers                │
│  │  - Screenshot Handlers - RAG Handlers                  │
│  │  - Chat Handlers       - Settings Handlers             │
│  └─────────────────────────────────────────────────────────┤
├─────────────────────────────────────────────────────────────┤
│  Renderer Process (Chromium/HTML/CSS/JS)                   │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │  Main Window    │  │ Session Windows │                  │
│  │  - Setup UI     │  │  - Chat UI      │                  │
│  │  - Config Forms │  │  - Controls     │                  │
│  └─────────────────┘  └─────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

### Process Architecture

**Main Process**: Node.js environment running Electron's main process
- Application lifecycle management
- Service initialization and dependency injection
- IPC communication handling
- System-level operations (file access, audio capture, screen capture)

**Renderer Process**: Chromium environment for UI
- HTML/CSS/JavaScript user interface
- Limited Node.js access through IPC
- Separate process per window for isolation

---

## Application Flow

### 1. Application Startup Flow

```
main.ts
├── 1. Create ApplicationController({debug, stealthMode, logLevel})
├── 2. app.whenReady() → appController.createMainWindow()
└── 3. Event listeners setup (activate, SIGTERM, etc.)

ApplicationController.constructor()
├── 1. initializeLogging()
├── 2. initializeServices() - sync service creation
├── 3. setupApplicationEvents()
└── 4. Store initialization (electron-store)

ApplicationController.initialize() [async]
├── 1. initializeServicesAsync()
│   ├── configurationManager.initialize()
│   ├── promptLibraryService.addPersona()
│   ├── audioService.initialize()
│   ├── ocrService.initialize()
│   └── globalRagService.initialize()
├── 2. initializeOpenAI() - API key setup
├── 3. setupIPC() - create IPCController
├── 4. setupStealthMode() - screen sharing detection
└── 5. setupGlobalHotkeys() - Cmd+G, Cmd+H
```

### 2. Session Creation Flow

```
User clicks "Start Session" in Main Window
├── 1. main-window.js: startSession()
├── 2. ipcRenderer.send('create-session', {profession, interviewType, context})
├── 3. IPCController.setupSessionHandlers() receives event
├── 4. sessionManager.createSession(config)
├── 5. ApplicationController.createSessionWindow(sessionId, config)
├── 6. initializeChatSessionWithContext(sessionId, profession, interviewType, context)
│   ├── Search globalRagService for relevant context
│   ├── Build comprehensive context message
│   ├── chatService.sendMessage(sessionId, contextMessage, true)
│   └── Send context and AI response to session window
└── 7. event.reply('session-created', {sessionId, session})
```

### 3. Screenshot Analysis Flow

```
User clicks "Screenshot" button in Session Window
├── 1. session-renderer.js: takeScreenshot()
├── 2. ipcRenderer.send('capture-screenshot', {sessionId})
├── 3. IPCController.setupScreenshotHandlers() receives event
├── 4. captureService.captureScreen() - full screen capture
├── 5. ocrService.extractText(screenshot) - text extraction
├── 6. Send initial result with multi-step options to UI
├── 7. User selects additional capture (left_half/right_half/analyze)
├── 8. Multi-step capture: captureService.captureScreenWithType(captureType)
├── 9. Accumulate OCR text from multiple captures
├── 10. User clicks "Analyze Complete Text"
├── 11. chatService.processOCRText(sessionId, accumulatedText, ActionType.SCREENSHOT)
├── 12. promptLibraryService.getActionPrompt(SCREENSHOT, profession, interviewType)
├── 13. OpenAI GPT-4 API call with system and user prompts
├── 14. AI analysis sent back to session window as chat response
└── 15. Clean up accumulated OCR data
```

### 4. Audio Recording Flow

```
User clicks "Record Mic"/"Record System" in Session Window
├── 1. session-renderer.js: startRecording(source)
├── 2. ipcRenderer.send('start-recording', {sessionId, source})
├── 3. IPCController.setupAudioHandlers() receives event
├── 4. audioService.startRecording(AudioSource.INTERVIEWEE/SYSTEM, sessionId)
├── 5. FFmpeg process starts: ffmpeg -f avfoundation -i :deviceId
├── 6. Real-time audio capture and buffering
├── 7. User clicks "Stop Recording"
├── 8. ipcRenderer.send('stop-recording', {sessionId})
├── 9. audioService.stopRecording(sessionId)
├── 10. Extract final audio segment (last 10 seconds or full duration)
├── 11. Whisper CLI transcription: whisper-cli --model ggml-base.en.bin
├── 12. Complete transcription sent to session window
├── 13. chatService.processTranscript(sessionId, transcription, audioSource)
├── 14. promptLibraryService.getAudioCoachingPrompt(audioSource, profession, interviewType)
├── 15. OpenAI GPT-4 analysis of transcription
└── 16. AI coaching response sent to session window
```

### 5. RAG Knowledge Base Flow

```
User clicks "RAG" button in Session Window
├── 1. session-renderer.js: addRAGMaterial()
├── 2. ipcRenderer.send('add-rag-material', {sessionId})
├── 3. IPCController.setupRAGHandlers() receives event
├── 4. dialog.showOpenDialog() - folder selection
├── 5. ragService.ingestDocuments(folderPath, sessionId)
├── 6. Process documents (.txt, .md files)
├── 7. Text chunking and embedding generation
├── 8. Store in LanceDB vector database
└── 9. event.reply('rag-success', {documentsProcessed, folderPath})

Context Search During Session Initialization
├── 1. globalRagService.searchRelevantContext(queries[], limit)
├── 2. Vector similarity search in LanceDB
├── 3. Rank results by relevance score
├── 4. Include top results in chat context
└── 5. Enhanced AI responses with personal knowledge
```

---

## Service Layer

### Core Services

#### ApplicationController
**File**: `src/controllers/ApplicationController.ts`  
**Purpose**: Main application orchestrator and lifecycle manager

**Key Methods**:
```typescript
constructor(config: ApplicationConfig)
async initialize(): Promise<void>
createMainWindow(): BrowserWindow
createSessionWindow(sessionId: string, config: any): BrowserWindow
getServices(): IPCServices
async shutdown(): Promise<void>
```

**Responsibilities**:
- Service dependency injection and initialization
- Window lifecycle management  
- Stealth mode configuration
- Global hotkey registration
- Application cleanup

#### SessionManager
**File**: `src/services/SessionManager.ts`  
**Purpose**: Interview session state management

**Data Model**:
```typescript
interface Session {
  id: string;
  profession: string;
  interviewType: string;
  context?: string;
  createdAt: Date;
  isActive: boolean;
  chatHistory: ChatMessage[];
  isRecording: boolean;
  hasRAG: boolean;
  accumulatedOCR?: Record<string, string>;
}
```

### AI Services

#### ChatService
**File**: `src/services/ChatService.ts`  
**Purpose**: Centralized AI conversation management with OpenAI integration

**Constructor Dependencies**:
```typescript
constructor(
  configurationManager: ConfigurationManager,
  promptLibraryService: PromptLibraryService, 
  sessionManager: SessionManager,
  ragService: RAGService
)
```

**Key Methods**:
```typescript
async initializeSession(sessionId: string, profession: string, interviewType: string): Promise<void>
async sendMessage(sessionId: string, message: string, isInitialization?: boolean): Promise<string>
async processOCRText(sessionId: string, ocrText: string, action: ActionType): Promise<string>
async processTranscript(sessionId: string, transcript: string, audioSource: AudioSource): Promise<string>
isConfigured(): boolean
```

**Internal Architecture**:
- Maintains per-session conversation context
- Integrates with PromptLibraryService for consistent prompting
- Handles different action types (SCREENSHOT, DEBUG, CHAT, TRANSCRIPTION)
- OpenAI API management with error handling

#### PromptLibraryService
**File**: `src/services/PromptLibraryService.ts`  
**Purpose**: Centralized prompt management and template generation

**Categories**:
- **System Prompts**: Initial conversation context setting
- **Action Prompts**: Context-specific prompts for different actions
- **Audio Coaching Prompts**: Real-time audio coaching responses
- **OpenAI API Prompts**: Direct API call formatting
- **Fallback Prompts**: Offline/no-API-key scenarios

**Key Methods**:
```typescript
getSystemPrompt(profession: string, interviewType: string): string
getActionPrompt(action: ActionType, profession: string, interviewType: string): string  
getAudioCoachingPrompt(audioSource: AudioSource, profession: string, interviewType: string): string
getOpenAISystemPrompt(profession: string, interviewType: string): string
getOpenAIUserPrompt(profession: string, interviewType: string, ocrText: string): string
getFallbackAnalysisPrompt(ocrText: string, profession: string, interviewType: string): string
```

#### OCRService
**File**: `src/services/OCRService.ts`  
**Purpose**: Optical Character Recognition using Tesseract.js

**Key Methods**:
```typescript
async initialize(): Promise<void>
async extractText(imageBuffer: Buffer): Promise<string>
```

**Internal Process**:
1. Image preprocessing and optimization
2. Tesseract.js worker initialization
3. Text extraction with confidence scoring
4. Post-processing and cleanup

#### RAGService & GlobalRAGService  
**Files**: `src/services/RAGService.ts`, `src/services/GlobalRAGService.ts`  
**Purpose**: Retrieval-Augmented Generation with vector similarity search

**RAGService** (Session-specific):
```typescript
async ingestDocuments(folderPath: string, sessionId: string): Promise<void>
getKnowledgeBase(sessionId: string): KnowledgeBase | undefined
```

**GlobalRAGService** (Application-wide):
```typescript
async initialize(): Promise<void>
async indexFolder(folderPath: string): Promise<{success: boolean, documentsProcessed: number}>
async searchRelevantContext(query: string, limit: number): Promise<SearchResult[]>
async refreshGlobalKnowledgeBase(): Promise<{success: boolean, documentsProcessed: number}>
```

### System Services

#### AudioService
**File**: `src/services/AudioService.ts`  
**Purpose**: Audio capture and transcription using FFmpeg + Whisper

**Audio Sources**:
```typescript
enum AudioSource {
  INTERVIEWER = 'interviewer',
  INTERVIEWEE = 'interviewee', 
  BOTH = 'both',
  SYSTEM = 'system'
}
```

**Key Methods**:
```typescript
async initialize(): Promise<void>
async startRecording(source: AudioSource, sessionId: string): Promise<void>
async stopRecording(sessionId: string): Promise<string | null>
getRecordingStatus(sessionId: string): {isRecording: boolean, source?: AudioSource}
```

**Internal Architecture**:
1. **FFmpeg Integration**: Device detection and audio capture
2. **Real-time Processing**: Continuous audio stream processing
3. **Whisper Integration**: Local speech-to-text using whisper-cli
4. **Session Management**: Per-session audio state tracking

#### CaptureService
**File**: `src/services/CaptureService.ts`  
**Purpose**: Screen capture with multiple capture modes

**Capture Types**:
```typescript
enum CaptureType {
  FULL = 'full',
  LEFT_HALF = 'left_half', 
  RIGHT_HALF = 'right_half'
}
```

**Key Methods**:
```typescript
async captureScreen(): Promise<Buffer>
async captureScreenWithType(captureType: CaptureType): Promise<Buffer>
```

**Internal Process**:
1. Screen dimension detection
2. Platform-specific capture (macOS screenshot utility)
3. Image processing and cropping
4. Buffer management and optimization

---

## IPC Communication

### IPC Architecture

```
Main Process (IPCController)          Renderer Process (Windows)
├── Session Handlers                  ├── Main Window
│   ├── 'create-session'             │   ├── startSession()
│   └── 'close-session'              │   └── openSettings()
├── Screenshot Handlers               └── Session Windows  
│   ├── 'capture-screenshot'             ├── takeScreenshot()
│   ├── 'debug-code'                     ├── debugCode()
│   ├── 'multi-capture'                  ├── toggleRecording()
│   └── 'analyze-accumulated-text'       ├── addRAGMaterial()
├── Audio Handlers                       └── sendMessage()
│   ├── 'start-recording'
│   ├── 'stop-recording'
│   ├── 'toggle-recording'
│   └── 'toggle-system-recording'
├── Chat Handlers
│   └── 'chat-message'
├── RAG Handlers
│   └── 'add-rag-material'
└── Settings Handlers
    ├── 'save-api-key'
    ├── 'test-api-key'
    └── 'open-settings'
```

### IPC Event Details

#### Session Events

**'create-session'**
```typescript
// Renderer → Main
ipcRenderer.send('create-session', {
  profession: string,
  interviewType: string, 
  context?: string,
  createdAt: string
})

// Main → Renderer  
event.reply('session-created', {
  sessionId: string,
  session: Session
})
```

**'close-session'**
```typescript
// Renderer → Main
ipcRenderer.send('close-session', sessionId: string)

// Main → Renderer
event.reply('session-closed', {sessionId: string})
```

#### Screenshot Events

**'capture-screenshot'**
```typescript
// Renderer → Main
ipcRenderer.send('capture-screenshot', {sessionId: string})

// Main → Renderer (to specific session window)
sessionWindow.webContents.send('screenshot-captured', {
  sessionId: string,
  text: string,
  accumulatedText: string,
  timestamp: string
})
```

**'multi-capture'**
```typescript  
// Renderer → Main
ipcRenderer.send('multi-capture', {
  sessionId: string,
  actionType: 'screenshot' | 'debug',
  captureType: 'full' | 'left_half' | 'right_half', 
  accumulatedText: string
})
```

**'analyze-accumulated-text'**
```typescript
// Renderer → Main  
ipcRenderer.send('analyze-accumulated-text', {
  sessionId: string,
  actionType: 'screenshot' | 'debug',
  accumulatedText: string
})

// Main → Renderer
event.reply('chat-response', {
  sessionId: string,
  content: string,
  metadata: {
    action: string,
    accumulatedTextLength: number,
    analysisType: 'accumulated'
  },
  timestamp: string
})
```

#### Audio Events

**'start-recording'**
```typescript
// Renderer → Main
ipcRenderer.send('start-recording', {
  sessionId: string,
  source: 'interviewer' | 'interviewee' | 'both' | 'system'
})

// Main → Renderer
event.reply('recording-status', {
  sessionId: string,
  isRecording: boolean,
  source: string
})
```

**'stop-recording'**
```typescript
// Renderer → Main
ipcRenderer.send('stop-recording', {sessionId: string})

// Main → Renderer (via session window)
sessionWindow.webContents.send('chat-response', {
  sessionId: string,
  content: string, // "🎤 **Complete Transcription:** ..."
  timestamp: string,
  source: 'complete-audio-transcription'
})

// Followed by AI analysis
sessionWindow.webContents.send('chat-response', {
  sessionId: string,
  content: string, // "🤖 **AI Analysis:** ..."
  timestamp: string, 
  source: 'complete-audio-analysis'
})
```

---

## Data Models

### Core Types

```typescript
// Application Configuration
interface ApplicationConfig {
  stealthMode?: boolean;
  debug?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}

// Session Data
interface Session {
  id: string;
  profession: string;
  interviewType: string;
  context?: string;
  createdAt: Date;
  isActive: boolean;
  chatHistory: ChatMessage[];
  isRecording: boolean;
  isSystemRecording?: boolean;
  recordingSource?: AudioSource;
  hasRAG: boolean;
  accumulatedOCR?: Record<string, string>;
}

// Chat Message
interface ChatMessage {
  id: string;
  sessionId: string;
  content: string;
  timestamp: Date;
  source: 'user' | 'ai' | 'system';
  metadata?: Record<string, any>;
}

// Knowledge Base  
interface KnowledgeBase {
  sessionId: string;
  documents: Document[];
  embeddings: number[][];
  createdAt: Date;
  updatedAt: Date;
}

interface Document {
  id: string;
  content: string;
  metadata: {
    filename: string;
    path: string;
    size: number;
    type: string;
  };
}

// Search Results
interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, any>;
}
```

### Enums

```typescript
enum ActionType {
  SCREENSHOT = 'screenshot',
  DEBUG = 'debug', 
  CHAT = 'chat',
  TRANSCRIPTION = 'transcription'
}

enum AudioSource {
  INTERVIEWER = 'interviewer',
  INTERVIEWEE = 'interviewee',
  BOTH = 'both',
  SYSTEM = 'system'
}

enum CaptureType {
  FULL = 'full',
  LEFT_HALF = 'left_half',
  RIGHT_HALF = 'right_half'  
}

enum PromptCategory {
  SYSTEM = 'system',
  ACTION = 'action',
  AUDIO = 'audio', 
  FALLBACK = 'fallback'
}

enum AudioPromptType {
  COACHING = 'coaching',
  FEEDBACK = 'feedback',
  GUIDANCE = 'guidance'
}
```

---

## API Reference

### ApplicationController

#### Constructor
```typescript
constructor(config: ApplicationConfig = {})
```
**Parameters**:
- `config.stealthMode?: boolean` - Enable screen sharing protection (default: true)
- `config.debug?: boolean` - Enable debug logging (default: false)  
- `config.logLevel?: string` - Logging level (default: 'info')

#### Methods

**initialize()**
```typescript
async initialize(): Promise<void>
```
Initializes all services and application components. Called automatically on app ready.

**createMainWindow()**  
```typescript
createMainWindow(): BrowserWindow
```
Creates and returns the main application window with stealth mode configuration.

**createSessionWindow()**
```typescript
createSessionWindow(sessionId: string, config: any): BrowserWindow
```
**Parameters**:
- `sessionId: string` - Unique session identifier
- `config: any` - Session configuration object

Creates a new session window for interview assistance.

**getServices()**
```typescript
getServices(): IPCServices
```
Returns all initialized services for dependency injection into IPCController.

**shutdown()**
```typescript
async shutdown(): Promise<void>  
```
Performs clean application shutdown, closing all services and resources.

### ChatService

#### Constructor
```typescript
constructor(
  configurationManager: ConfigurationManager,
  promptLibraryService: PromptLibraryService,
  sessionManager: SessionManager, 
  ragService: RAGService
)
```

#### Methods

**initializeSession()**
```typescript
async initializeSession(
  sessionId: string,
  profession: string,
  interviewType: string
): Promise<void>
```
Sets up conversation context for a new interview session.

**sendMessage()**
```typescript
async sendMessage(
  sessionId: string,
  message: string,
  isInitialization?: boolean
): Promise<string>
```
**Parameters**:
- `sessionId: string` - Session identifier
- `message: string` - User message or system prompt
- `isInitialization?: boolean` - Whether this is a session setup message

Sends message to OpenAI and returns AI response.

**processOCRText()**
```typescript
async processOCRText(
  sessionId: string,
  ocrText: string,
  action: ActionType
): Promise<string>
```
Processes OCR-extracted text for interview question analysis or code debugging.

**processTranscript()**
```typescript
async processTranscript(
  sessionId: string,
  transcript: string, 
  audioSource: AudioSource
): Promise<string>
```
Processes audio transcription for real-time interview coaching.

**isConfigured()**
```typescript
isConfigured(): boolean
```
Returns whether OpenAI API key is properly configured.

### PromptLibraryService

#### Methods

**getSystemPrompt()**
```typescript
getSystemPrompt(profession: string, interviewType: string): string
```
Returns initial system prompt for conversation context setup.

**getActionPrompt()**
```typescript
getActionPrompt(
  action: ActionType,
  profession: string, 
  interviewType: string
): string
```
Returns action-specific prompt template for different user interactions.

**getAudioCoachingPrompt()**
```typescript
getAudioCoachingPrompt(
  audioSource: AudioSource,
  profession: string,
  interviewType: string  
): string
```
Returns real-time audio coaching prompt based on audio source and context.

**getOpenAISystemPrompt()**
```typescript
getOpenAISystemPrompt(profession: string, interviewType: string): string
```
Returns system prompt formatted for direct OpenAI API calls.

**getOpenAIUserPrompt()**
```typescript
getOpenAIUserPrompt(
  profession: string,
  interviewType: string,
  ocrText: string
): string
```
Returns user prompt for screenshot analysis formatted for OpenAI API.

**getFallbackAnalysisPrompt()**
```typescript
getFallbackAnalysisPrompt(
  ocrText: string,
  profession: string,
  interviewType: string
): string  
```
Returns fallback analysis when OpenAI API is not available.

### AudioService

#### Methods

**initialize()**
```typescript
async initialize(): Promise<void>
```
Sets up FFmpeg, Whisper CLI, and audio device detection.

**startRecording()**
```typescript
async startRecording(source: AudioSource, sessionId: string): Promise<void>
```
**Parameters**:
- `source: AudioSource` - Audio input source (microphone/system/both)
- `sessionId: string` - Session identifier for recording association

Starts real-time audio capture using FFmpeg.

**stopRecording()**
```typescript
async stopRecording(sessionId: string): Promise<string | null>
```
**Returns**: Complete transcription text or null if no audio captured

Stops recording, processes final audio segment, and returns full transcription.

**getRecordingStatus()**
```typescript
getRecordingStatus(sessionId: string): {
  isRecording: boolean;
  source?: AudioSource;
}
```
Returns current recording state for specified session.

**isReady()**
```typescript
isReady(): boolean
```
Returns whether audio service is properly initialized with required dependencies.

### CaptureService

#### Methods

**captureScreen()**
```typescript
async captureScreen(): Promise<Buffer>
```
**Returns**: Screenshot image data as Buffer

Captures full screen using platform-specific screenshot utility.

**captureScreenWithType()**
```typescript
async captureScreenWithType(captureType: CaptureType): Promise<Buffer>
```
**Parameters**:
- `captureType: CaptureType` - Screen capture area (full/left_half/right_half)

**Returns**: Processed screenshot image data as Buffer

Captures specified screen area with automatic cropping and processing.

### OCRService

#### Methods

**initialize()**
```typescript
async initialize(): Promise<void>
```
Initializes Tesseract.js worker and language models.

**extractText()**
```typescript
async extractText(imageBuffer: Buffer): Promise<string>
```
**Parameters**:
- `imageBuffer: Buffer` - Screenshot or image data

**Returns**: Extracted text content

Performs OCR text extraction with post-processing and cleanup.

### RAGService

#### Methods

**ingestDocuments()**
```typescript
async ingestDocuments(folderPath: string, sessionId: string): Promise<void>
```
**Parameters**:
- `folderPath: string` - Path to folder containing documents (.txt, .md files)
- `sessionId: string` - Session to associate knowledge base with

Processes documents, generates embeddings, and stores in vector database.

**getKnowledgeBase()**
```typescript
getKnowledgeBase(sessionId: string): KnowledgeBase | undefined
```
Returns knowledge base associated with session or undefined if none exists.

### GlobalRAGService

#### Methods

**initialize()**
```typescript
async initialize(): Promise<void>
```
Sets up global vector database and prepares for document indexing.

**indexFolder()**
```typescript
async indexFolder(folderPath: string): Promise<{
  success: boolean;
  documentsProcessed: number;
}>
```
Adds documents from folder to global knowledge base.

**searchRelevantContext()**
```typescript
async searchRelevantContext(
  query: string,
  limit: number
): Promise<SearchResult[]>
```
**Parameters**:
- `query: string` - Search query text
- `limit: number` - Maximum number of results

**Returns**: Ranked search results with similarity scores

Performs vector similarity search against global knowledge base.

**refreshGlobalKnowledgeBase()**
```typescript
async refreshGlobalKnowledgeBase(): Promise<{
  success: boolean;
  documentsProcessed: number;
}>
```
Rebuilds global knowledge base from all indexed folders.

**clearGlobalKnowledgeBase()**
```typescript
async clearGlobalKnowledgeBase(): Promise<void>
```
Removes all documents from global knowledge base.

**getStats()**
```typescript
async getStats(): Promise<{
  totalDocuments: number;
  totalChunks: number;
  databaseSize: number;
  lastUpdate: Date | null;
  supportedFormats: string[];
}>
```
Returns statistics about the global knowledge base.

### SessionManager

#### Methods

**createSession()**
```typescript
async createSession(config: {
  profession: string;
  interviewType: string;
  context?: string;
}): Promise<Session>
```
Creates new interview session with generated ID and initialization.

**getSession()**
```typescript
getSession(sessionId: string): Session | undefined
```
Retrieves session data by ID.

**closeSession()**
```typescript
async closeSession(sessionId: string): Promise<void>
```
Properly closes session and cleans up resources.

**getAllSessions()**
```typescript
getAllSessions(): Session[]
```
Returns all active sessions.

### ConfigurationManager

#### Methods

**initialize()**
```typescript
async initialize(): Promise<void>
```
Loads configuration from persistent storage.

**getApiKey()**
```typescript
getApiKey(): string
```
Returns stored OpenAI API key.

**setApiKey()**
```typescript
async setApiKey(apiKey: string): Promise<void>
```
Stores OpenAI API key securely.

**isApiKeyConfigured()**
```typescript
isApiKeyConfigured(): boolean  
```
Returns whether valid API key is configured.

**updateApiKey()**
```typescript
async updateApiKey(apiKey: string): Promise<void>
```
Updates stored API key and validates it.

---

## Configuration

### Application Configuration

**Location**: Managed by `ConfigurationManager` service  
**Storage**: Electron's `app.getPath('userData')` directory  
**Format**: JSON configuration files

### Configuration Files

**Main Configuration**: `config.json`
```json
{
  "apiKey": "sk-...", 
  "stealthMode": true,
  "debug": false,
  "logLevel": "info",
  "audioDevices": {
    "microphone": 6,
    "system": 0
  },
  "ocrLanguage": "eng"
}
```

**Session Storage**: `sessions/`
- Individual session files with chat history
- Session state persistence across app restarts

**Global RAG**: `vector-db/`
- LanceDB vector database files
- Document embeddings and metadata

### Environment Variables

**Development**:
```bash
NODE_ENV=development          # Enables debug logging
OPENAI_API_KEY=sk-...        # Optional API key override
WHISPER_MODEL_PATH=/path     # Custom Whisper model location
```

**Production**:
```bash
NODE_ENV=production          # Optimized for performance
```

---

## Security Features

### Stealth Mode

**Screen Sharing Detection**:
- Monitors running processes for screen sharing applications
- Detects browser screen capture flags
- Automatically protects windows when screen sharing detected

**Window Protection**:
- `setContentProtection(true)` - Prevents window capture
- `setSharingType('none')` - macOS-specific sharing prevention  
- Window remains visible to user but hidden from screen capture

**Process Obfuscation**:
- Process title changed to "systemAssistance"
- Hidden from dock and mission control on macOS
- Skip taskbar on Windows/Linux

### Data Security

**API Key Storage**:
- Encrypted storage using Electron's safeStorage
- No API keys in logs or temporary files
- Secure key validation before use

**Audio Data**:
- Temporary audio files automatically cleaned up
- Local-only processing (no cloud transcription)
- Debug mode preserves files for troubleshooting

**OCR Data**:
- In-memory text extraction only
- No image data persistence
- Screenshot buffers cleaned after processing

---

## Development Guide

### Prerequisites

```bash
Node.js >= 18.0.0
npm >= 8.0.0
FFmpeg (for audio processing)
whisper-cli (for transcription)
```

### Installation

```bash
git clone <repository>
cd GhostGuide
npm install
```

### Development Commands

```bash
npm run dev           # Start development with hot reload
npm run build         # Build TypeScript to dist/
npm start            # Build and run Electron app
npm run test         # Run test suite
npm run lint         # ESLint code checking
```

### Project Structure

```
src/
├── main.ts                    # Application entry point
├── controllers/               # Application orchestration
│   ├── ApplicationController.ts
│   └── IPCController.ts
├── services/                  # Core business logic
│   ├── AudioService.ts
│   ├── CaptureService.ts
│   ├── ChatService.ts
│   ├── ConfigurationManager.ts
│   ├── GlobalRAGService.ts
│   ├── OCRService.ts
│   ├── PromptLibraryService.ts
│   ├── RAGService.ts
│   ├── ScreenSharingDetectionService.ts
│   ├── SessionManager.ts
│   └── WindowManager.ts
├── renderer/                  # UI components
│   ├── session.html
│   ├── session-renderer.js
│   └── styles/
└── types.ts                   # TypeScript definitions

docs/
├── TECHNICAL_DOCUMENTATION.md
├── PROMPT_COLLECTION.md
└── API_REFERENCE.md

dist/                          # Compiled TypeScript
build/                         # Build scripts and configuration
tests/                         # Test files
```

### Adding New Services

1. **Create Service Class**:
```typescript
// src/services/NewService.ts
export class NewService {
  async initialize(): Promise<void> {
    // Service initialization
  }
  
  // Service methods
}
```

2. **Register in ApplicationController**:
```typescript
// Add to services object in initializeServices()
newService: new NewService()
```

3. **Add to IPCServices Interface**:
```typescript
// src/controllers/IPCController.ts
export interface IPCServices {
  // ... existing services
  newService: NewService;
}
```

4. **Update getServices() Method**:
```typescript
getServices(): IPCServices {
  return {
    // ... existing services
    newService: this.services.newService,
  };
}
```

### Testing

**Unit Tests**:
```typescript
// tests/services/ChatService.test.ts
import { ChatService } from '../../src/services/ChatService';

describe('ChatService', () => {
  it('should initialize properly', async () => {
    // Test implementation
  });
});
```

**Integration Tests**:
```typescript
// tests/integration/SessionFlow.test.ts  
describe('Session Creation Flow', () => {
  it('should create session and initialize chat', async () => {
    // Full flow testing
  });
});
```

### Building & Distribution

```bash
npm run build                 # Compile TypeScript
npm run package              # Package for current platform
npm run package-all          # Package for all platforms
```

### Debugging

**Main Process**:
- Enable debug mode in ApplicationController constructor
- Logs written to `~/Library/Application Support/Interview Assistant/logs/`
- Console output in terminal when running `npm start`

**Renderer Process**:
- Open DevTools in any window: `View → Toggle Developer Tools`
- Console logs and network inspection available
- React-style component debugging

**Audio Debugging**:
- Set `DEBUG_AUDIO=true` to preserve audio files
- Check `/tmp/interview-assistant-audio/` for recordings
- Whisper CLI logs available in console output

### Performance Optimization

**Memory Management**:
- Services properly clean up resources in shutdown()
- Audio buffers cleared after processing  
- OCR workers terminated after use

**CPU Optimization**:
- OCR processing throttled during high activity
- Audio processing in background threads
- Vector search optimized with proper indexing

**Storage Optimization**:
- RAG documents chunked efficiently
- Old session data automatically archived
- Temporary files cleaned regularly

---

This comprehensive technical documentation covers the complete GhostGuide application architecture, providing detailed insights into every component, flow, and API for developers and technical users.
