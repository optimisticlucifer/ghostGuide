# GhostGuide API Reference

## Table of Contents

1. [Overview](#overview)
2. [Core Controllers](#core-controllers)
3. [Service APIs](#service-apis)
4. [IPC Events](#ipc-events)
5. [Type Definitions](#type-definitions)
6. [Error Handling](#error-handling)
7. [Usage Examples](#usage-examples)

---

## Overview

This document provides comprehensive API reference for all public methods, interfaces, and types in the GhostGuide application. The API is organized into several layers:

- **Controllers**: Application orchestration and IPC handling
- **Services**: Core business logic and external integrations
- **Types**: TypeScript interfaces and enums
- **IPC Events**: Inter-process communication events

---

## Core Controllers

### ApplicationController

Main application lifecycle and service orchestration controller.

#### Constructor

```typescript
constructor(config: ApplicationConfig = {})
```

**Parameters:**
- `config: ApplicationConfig` - Optional application configuration

**Example:**
```typescript
const appController = new ApplicationController({
  debug: true,
  stealthMode: true,
  logLevel: 'debug'
});
```

#### Methods

##### initialize()

```typescript
async initialize(): Promise<void>
```

**Description:** Initializes all application services and components  
**Returns:** Promise that resolves when initialization is complete  
**Throws:** `Error` if any service fails to initialize

**Example:**
```typescript
try {
  await appController.initialize();
  console.log('Application initialized successfully');
} catch (error) {
  console.error('Initialization failed:', error);
}
```

##### createMainWindow()

```typescript
createMainWindow(): BrowserWindow
```

**Description:** Creates the main application window with stealth mode configuration  
**Returns:** `BrowserWindow` instance for the main window

**Example:**
```typescript
const mainWindow = appController.createMainWindow();
console.log('Main window created with ID:', mainWindow.id);
```

##### createSessionWindow()

```typescript
createSessionWindow(sessionId: string, config: SessionConfig): BrowserWindow
```

**Parameters:**
- `sessionId: string` - Unique session identifier
- `config: SessionConfig` - Session configuration object

**Returns:** `BrowserWindow` instance for the session window

**Example:**
```typescript
const sessionWindow = appController.createSessionWindow('session-123', {
  id: 'session-123',
  profession: 'software-engineer',
  interviewType: 'technical',
  context: 'Frontend React interview',
  createdAt: new Date(),
  isActive: true
});
```

##### getServices()

```typescript
getServices(): IPCServices
```

**Description:** Returns all initialized services for dependency injection  
**Returns:** Object containing all service instances

##### shutdown()

```typescript
async shutdown(): Promise<void>
```

**Description:** Performs clean application shutdown  
**Returns:** Promise that resolves when shutdown is complete

---

### IPCController

Handles all inter-process communication between main and renderer processes.

#### Constructor

```typescript
constructor(
  services: IPCServices,
  sessionWindows: Map<string, BrowserWindow>,
  sessions: Map<string, any>,
  createSessionWindowCallback?: (sessionId: string, config: any) => BrowserWindow
)
```

**Parameters:**
- `services: IPCServices` - All application services
- `sessionWindows: Map<string, BrowserWindow>` - Session window map
- `sessions: Map<string, any>` - Session data map
- `createSessionWindowCallback?: Function` - Optional session window creation callback

#### Methods

##### initialize()

```typescript
initialize(): void
```

**Description:** Sets up all IPC event handlers  
**Returns:** void

**Example:**
```typescript
const ipcController = new IPCController(services, windows, sessions);
ipcController.initialize();
```

---

## Service APIs

### ChatService

Centralized AI conversation management with OpenAI integration.

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

##### initializeSession()

```typescript
async initializeSession(
  sessionId: string,
  profession: string,
  interviewType: string
): Promise<void>
```

**Description:** Sets up conversation context for a new interview session  
**Parameters:**
- `sessionId: string` - Unique session identifier
- `profession: string` - Interview profession (e.g., 'software-engineer')
- `interviewType: string` - Interview type (e.g., 'technical')

**Example:**
```typescript
await chatService.initializeSession(
  'session-123',
  'software-engineer',
  'technical'
);
```

##### sendMessage()

```typescript
async sendMessage(
  sessionId: string,
  message: string,
  isInitialization?: boolean
): Promise<string>
```

**Description:** Sends message to OpenAI and returns AI response  
**Parameters:**
- `sessionId: string` - Session identifier
- `message: string` - User message or system prompt
- `isInitialization?: boolean` - Whether this is a session setup message (default: false)

**Returns:** AI response as string

**Example:**
```typescript
const response = await chatService.sendMessage(
  'session-123',
  'How do I implement a binary search tree?'
);
console.log('AI Response:', response);
```

##### processOCRText()

```typescript
async processOCRText(
  sessionId: string,
  ocrText: string,
  action: ActionType
): Promise<string>
```

**Description:** Processes OCR-extracted text for analysis  
**Parameters:**
- `sessionId: string` - Session identifier
- `ocrText: string` - Text extracted from screenshot
- `action: ActionType` - Type of action (SCREENSHOT | DEBUG)

**Returns:** AI analysis of the OCR text

**Example:**
```typescript
const analysis = await chatService.processOCRText(
  'session-123',
  'def binary_search(arr, target):',
  ActionType.DEBUG
);
```

##### processTranscript()

```typescript
async processTranscript(
  sessionId: string,
  transcript: string,
  audioSource: AudioSource
): Promise<string>
```

**Description:** Processes audio transcription for real-time coaching  
**Parameters:**
- `sessionId: string` - Session identifier
- `transcript: string` - Audio transcription text
- `audioSource: AudioSource` - Audio source (INTERVIEWER | INTERVIEWEE | SYSTEM)

**Returns:** AI coaching response

**Example:**
```typescript
const coaching = await chatService.processTranscript(
  'session-123',
  'I think the time complexity is O(n log n)',
  AudioSource.INTERVIEWEE
);
```

##### isConfigured()

```typescript
isConfigured(): boolean
```

**Description:** Checks if OpenAI API key is properly configured  
**Returns:** Boolean indicating configuration status

---

### PromptLibraryService

Centralized prompt management and template generation.

#### Methods

##### getSystemPrompt()

```typescript
getSystemPrompt(profession: string, interviewType: string): string
```

**Description:** Returns initial system prompt for conversation context  
**Parameters:**
- `profession: string` - Interview profession
- `interviewType: string` - Interview type

**Returns:** System prompt template

**Example:**
```typescript
const systemPrompt = promptLibrary.getSystemPrompt(
  'software-engineer',
  'technical'
);
```

##### getActionPrompt()

```typescript
getActionPrompt(
  action: ActionType,
  profession: string,
  interviewType: string
): string
```

**Description:** Returns action-specific prompt template  
**Parameters:**
- `action: ActionType` - Action type (SCREENSHOT | DEBUG | CHAT | TRANSCRIPTION)
- `profession: string` - Interview profession
- `interviewType: string` - Interview type

**Returns:** Action-specific prompt template

**Example:**
```typescript
const screenshotPrompt = promptLibrary.getActionPrompt(
  ActionType.SCREENSHOT,
  'software-engineer',
  'technical'
);
```

##### getAudioCoachingPrompt()

```typescript
getAudioCoachingPrompt(
  audioSource: AudioSource,
  profession: string,
  interviewType: string
): string
```

**Description:** Returns audio coaching prompt template  
**Parameters:**
- `audioSource: AudioSource` - Audio source type
- `profession: string` - Interview profession  
- `interviewType: string` - Interview type

**Returns:** Audio coaching prompt template

##### getOpenAISystemPrompt()

```typescript
getOpenAISystemPrompt(profession: string, interviewType: string): string
```

**Description:** Returns system prompt formatted for OpenAI API  
**Parameters:**
- `profession: string` - Interview profession
- `interviewType: string` - Interview type

**Returns:** OpenAI-formatted system prompt

##### getOpenAIUserPrompt()

```typescript
getOpenAIUserPrompt(
  profession: string,
  interviewType: string,
  ocrText: string
): string
```

**Description:** Returns user prompt for screenshot analysis  
**Parameters:**
- `profession: string` - Interview profession
- `interviewType: string` - Interview type
- `ocrText: string` - OCR extracted text

**Returns:** OpenAI-formatted user prompt

##### getFallbackAnalysisPrompt()

```typescript
getFallbackAnalysisPrompt(
  ocrText: string,
  profession: string,
  interviewType: string
): string
```

**Description:** Returns fallback analysis when API unavailable  
**Parameters:**
- `ocrText: string` - OCR extracted text
- `profession: string` - Interview profession
- `interviewType: string` - Interview type

**Returns:** Fallback analysis text

---

### AudioService

Audio capture and transcription using FFmpeg + Whisper.

#### Methods

##### initialize()

```typescript
async initialize(): Promise<void>
```

**Description:** Sets up FFmpeg, Whisper CLI, and audio device detection  
**Throws:** `Error` if required dependencies are not available

**Example:**
```typescript
try {
  await audioService.initialize();
  console.log('Audio service ready');
} catch (error) {
  console.error('Audio initialization failed:', error);
}
```

##### startRecording()

```typescript
async startRecording(source: AudioSource, sessionId: string): Promise<void>
```

**Description:** Starts real-time audio capture  
**Parameters:**
- `source: AudioSource` - Audio input source
- `sessionId: string` - Session identifier

**Throws:** `Error` if recording cannot start

**Example:**
```typescript
await audioService.startRecording(AudioSource.INTERVIEWEE, 'session-123');
```

##### stopRecording()

```typescript
async stopRecording(sessionId: string): Promise<string | null>
```

**Description:** Stops recording and returns complete transcription  
**Parameters:**
- `sessionId: string` - Session identifier

**Returns:** Complete transcription text or null if no audio captured

**Example:**
```typescript
const transcription = await audioService.stopRecording('session-123');
if (transcription) {
  console.log('Transcription:', transcription);
}
```

##### getRecordingStatus()

```typescript
getRecordingStatus(sessionId: string): {
  isRecording: boolean;
  source?: AudioSource;
}
```

**Description:** Returns current recording state  
**Parameters:**
- `sessionId: string` - Session identifier

**Returns:** Recording status object

**Example:**
```typescript
const status = audioService.getRecordingStatus('session-123');
console.log('Is recording:', status.isRecording);
```

##### isReady()

```typescript
isReady(): boolean
```

**Description:** Checks if audio service is properly initialized  
**Returns:** Boolean indicating readiness

---

### CaptureService

Screen capture with multiple capture modes.

#### Methods

##### captureScreen()

```typescript
async captureScreen(): Promise<Buffer>
```

**Description:** Captures full screen  
**Returns:** Screenshot image data as Buffer  
**Throws:** `Error` if screen capture fails

**Example:**
```typescript
try {
  const screenshot = await captureService.captureScreen();
  console.log('Screenshot captured:', screenshot.length, 'bytes');
} catch (error) {
  console.error('Screen capture failed:', error);
}
```

##### captureScreenWithType()

```typescript
async captureScreenWithType(captureType: CaptureType): Promise<Buffer>
```

**Description:** Captures specified screen area  
**Parameters:**
- `captureType: CaptureType` - Screen capture area (FULL | LEFT_HALF | RIGHT_HALF)

**Returns:** Processed screenshot image data as Buffer

**Example:**
```typescript
const leftHalf = await captureService.captureScreenWithType(CaptureType.LEFT_HALF);
```

---

### OCRService

Optical Character Recognition using Tesseract.js.

#### Methods

##### initialize()

```typescript
async initialize(): Promise<void>
```

**Description:** Initializes Tesseract.js worker and language models  
**Throws:** `Error` if OCR initialization fails

##### extractText()

```typescript
async extractText(imageBuffer: Buffer): Promise<string>
```

**Description:** Performs OCR text extraction  
**Parameters:**
- `imageBuffer: Buffer` - Screenshot or image data

**Returns:** Extracted text content  
**Throws:** `Error` if OCR processing fails

**Example:**
```typescript
const text = await ocrService.extractText(screenshotBuffer);
console.log('Extracted text:', text);
```

---

### RAGService

Session-specific Retrieval-Augmented Generation.

#### Methods

##### ingestDocuments()

```typescript
async ingestDocuments(folderPath: string, sessionId: string): Promise<void>
```

**Description:** Processes and indexes documents  
**Parameters:**
- `folderPath: string` - Path to folder containing documents
- `sessionId: string` - Session to associate knowledge base with

**Throws:** `Error` if document processing fails

**Example:**
```typescript
await ragService.ingestDocuments('/path/to/docs', 'session-123');
```

##### getKnowledgeBase()

```typescript
getKnowledgeBase(sessionId: string): KnowledgeBase | undefined
```

**Description:** Retrieves knowledge base for session  
**Parameters:**
- `sessionId: string` - Session identifier

**Returns:** Knowledge base object or undefined

---

### GlobalRAGService

Application-wide Retrieval-Augmented Generation.

#### Methods

##### initialize()

```typescript
async initialize(): Promise<void>
```

**Description:** Sets up global vector database  
**Throws:** `Error` if database initialization fails

##### indexFolder()

```typescript
async indexFolder(folderPath: string): Promise<{
  success: boolean;
  documentsProcessed: number;
}>
```

**Description:** Adds documents to global knowledge base  
**Parameters:**
- `folderPath: string` - Path to folder containing documents

**Returns:** Processing result object

**Example:**
```typescript
const result = await globalRAGService.indexFolder('/path/to/knowledge');
console.log(`Processed ${result.documentsProcessed} documents`);
```

##### searchRelevantContext()

```typescript
async searchRelevantContext(
  query: string,
  limit: number
): Promise<SearchResult[]>
```

**Description:** Performs vector similarity search  
**Parameters:**
- `query: string` - Search query text
- `limit: number` - Maximum number of results

**Returns:** Array of ranked search results

**Example:**
```typescript
const results = await globalRAGService.searchRelevantContext(
  'React hooks useState',
  5
);
```

##### refreshGlobalKnowledgeBase()

```typescript
async refreshGlobalKnowledgeBase(): Promise<{
  success: boolean;
  documentsProcessed: number;
}>
```

**Description:** Rebuilds global knowledge base  
**Returns:** Refresh result object

##### clearGlobalKnowledgeBase()

```typescript
async clearGlobalKnowledgeBase(): Promise<void>
```

**Description:** Removes all documents from global knowledge base

##### getStats()

```typescript
async getStats(): Promise<{
  totalDocuments: number;
  totalChunks: number;
  databaseSize: number;
  lastUpdate: Date | null;
  supportedFormats: string[];
}>
```

**Description:** Returns knowledge base statistics  
**Returns:** Statistics object

---

### SessionManager

Interview session state management.

#### Methods

##### createSession()

```typescript
async createSession(config: {
  profession: string;
  interviewType: string;
  context?: string;
}): Promise<Session>
```

**Description:** Creates new interview session  
**Parameters:**
- `config.profession: string` - Interview profession
- `config.interviewType: string` - Interview type  
- `config.context?: string` - Optional interview context

**Returns:** Created session object

**Example:**
```typescript
const session = await sessionManager.createSession({
  profession: 'software-engineer',
  interviewType: 'technical',
  context: 'Frontend React position at startup'
});
```

##### getSession()

```typescript
getSession(sessionId: string): Session | undefined
```

**Description:** Retrieves session by ID  
**Parameters:**
- `sessionId: string` - Session identifier

**Returns:** Session object or undefined

##### closeSession()

```typescript
async closeSession(sessionId: string): Promise<void>
```

**Description:** Closes session and cleans up resources  
**Parameters:**
- `sessionId: string` - Session identifier

##### getAllSessions()

```typescript
getAllSessions(): Session[]
```

**Description:** Returns all active sessions  
**Returns:** Array of active sessions

---

### ConfigurationManager

Application configuration management.

#### Methods

##### initialize()

```typescript
async initialize(): Promise<void>
```

**Description:** Loads configuration from persistent storage

##### getApiKey()

```typescript
getApiKey(): string
```

**Description:** Returns stored OpenAI API key  
**Returns:** API key string  
**Throws:** `Error` if no API key configured

##### setApiKey()

```typescript
async setApiKey(apiKey: string): Promise<void>
```

**Description:** Stores OpenAI API key securely  
**Parameters:**
- `apiKey: string` - OpenAI API key

##### isApiKeyConfigured()

```typescript
isApiKeyConfigured(): boolean
```

**Description:** Checks if API key is configured  
**Returns:** Boolean indicating configuration status

##### updateApiKey()

```typescript
async updateApiKey(apiKey: string): Promise<void>
```

**Description:** Updates and validates API key  
**Parameters:**
- `apiKey: string` - New OpenAI API key

**Throws:** `Error` if API key validation fails

---

## IPC Events

### Session Events

#### create-session

**Direction:** Renderer → Main

**Payload:**
```typescript
{
  profession: string;
  interviewType: string;
  context?: string;
  createdAt: string;
}
```

**Response:** `session-created` or `session-creation-failed`

**Example:**
```javascript
// Renderer
ipcRenderer.send('create-session', {
  profession: 'software-engineer',
  interviewType: 'technical',
  context: 'Senior React developer role',
  createdAt: new Date().toISOString()
});

// Listen for response
ipcRenderer.on('session-created', (event, data) => {
  console.log('Session created:', data.sessionId);
});
```

#### close-session

**Direction:** Renderer → Main

**Payload:** `string` (sessionId)

**Response:** `session-closed` or `session-close-failed`

### Screenshot Events

#### capture-screenshot

**Direction:** Renderer → Main

**Payload:**
```typescript
{
  sessionId: string;
}
```

**Response:** `screenshot-captured` (sent to session window)

#### multi-capture

**Direction:** Renderer → Main

**Payload:**
```typescript
{
  sessionId: string;
  actionType: 'screenshot' | 'debug';
  captureType: 'full' | 'left_half' | 'right_half';
  accumulatedText: string;
}
```

**Response:** `screenshot-captured` or `debug-captured`

#### analyze-accumulated-text

**Direction:** Renderer → Main

**Payload:**
```typescript
{
  sessionId: string;
  actionType: 'screenshot' | 'debug';
  accumulatedText: string;
}
```

**Response:** `chat-response`

### Audio Events

#### start-recording

**Direction:** Renderer → Main

**Payload:**
```typescript
{
  sessionId: string;
  source: 'interviewer' | 'interviewee' | 'both' | 'system';
}
```

**Response:** `recording-status` or `recording-error`

#### stop-recording

**Direction:** Renderer → Main

**Payload:**
```typescript
{
  sessionId: string;
}
```

**Response:** `recording-status` and `chat-response` (transcription + analysis)

### Chat Events

#### chat-message

**Direction:** Renderer → Main

**Payload:**
```typescript
{
  sessionId: string;
  message: string;
  source?: string;
}
```

**Response:** `chat-response`

### RAG Events

#### add-rag-material

**Direction:** Renderer → Main

**Payload:**
```typescript
{
  sessionId: string;
}
```

**Response:** `rag-success` or `rag-error`

### Settings Events

#### save-api-key

**Direction:** Renderer → Main

**Payload:** `string` (API key)

**Response:** `api-key-saved` or `api-key-invalid`

#### test-api-key

**Direction:** Renderer → Main

**Payload:** `string` (API key)

**Response:** `api-key-valid` or `api-key-invalid`

---

## Type Definitions

### Core Interfaces

#### ApplicationConfig

```typescript
interface ApplicationConfig {
  stealthMode?: boolean;
  debug?: boolean;
  logLevel?: 'error' | 'warn' | 'info' | 'debug';
}
```

#### Session

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
  isSystemRecording?: boolean;
  recordingSource?: AudioSource;
  hasRAG: boolean;
  accumulatedOCR?: Record<string, string>;
}
```

#### ChatMessage

```typescript
interface ChatMessage {
  id: string;
  sessionId: string;
  content: string;
  timestamp: Date;
  source: 'user' | 'ai' | 'system';
  metadata?: Record<string, any>;
}
```

#### KnowledgeBase

```typescript
interface KnowledgeBase {
  sessionId: string;
  documents: Document[];
  embeddings: number[][];
  createdAt: Date;
  updatedAt: Date;
}
```

#### Document

```typescript
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
```

#### SearchResult

```typescript
interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: Record<string, any>;
}
```

#### IPCServices

```typescript
interface IPCServices {
  globalRagService: GlobalRAGService;
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
```

### Enums

#### ActionType

```typescript
enum ActionType {
  SCREENSHOT = 'screenshot',
  DEBUG = 'debug',
  CHAT = 'chat',
  TRANSCRIPTION = 'transcription'
}
```

#### AudioSource

```typescript
enum AudioSource {
  INTERVIEWER = 'interviewer',
  INTERVIEWEE = 'interviewee',
  BOTH = 'both',
  SYSTEM = 'system'
}
```

#### CaptureType

```typescript
enum CaptureType {
  FULL = 'full',
  LEFT_HALF = 'left_half',
  RIGHT_HALF = 'right_half'
}
```

#### PromptCategory

```typescript
enum PromptCategory {
  SYSTEM = 'system',
  ACTION = 'action',
  AUDIO = 'audio',
  FALLBACK = 'fallback'
}
```

#### AudioPromptType

```typescript
enum AudioPromptType {
  COACHING = 'coaching',
  FEEDBACK = 'feedback',
  GUIDANCE = 'guidance'
}
```

---

## Error Handling

### Common Error Types

#### ServiceInitializationError

Thrown when a service fails to initialize properly.

```typescript
try {
  await audioService.initialize();
} catch (error) {
  if (error instanceof ServiceInitializationError) {
    console.error('Service init failed:', error.message);
    // Handle service-specific initialization failure
  }
}
```

#### APIKeyNotConfiguredError

Thrown when OpenAI API operations are attempted without valid API key.

```typescript
try {
  await chatService.sendMessage(sessionId, message);
} catch (error) {
  if (error instanceof APIKeyNotConfiguredError) {
    // Redirect to settings to configure API key
    showAPIKeyDialog();
  }
}
```

#### OCRProcessingError

Thrown when OCR text extraction fails.

```typescript
try {
  const text = await ocrService.extractText(imageBuffer);
} catch (error) {
  if (error instanceof OCRProcessingError) {
    console.error('OCR failed:', error.message);
    // Provide fallback text or retry
  }
}
```

#### AudioRecordingError

Thrown when audio recording operations fail.

```typescript
try {
  await audioService.startRecording(AudioSource.INTERVIEWEE, sessionId);
} catch (error) {
  if (error instanceof AudioRecordingError) {
    // Check microphone permissions
    // Display user-friendly error message
  }
}
```

### Error Handling Best Practices

#### Service Layer Errors

Always wrap service method calls in try-catch blocks:

```typescript
async function handleScreenshot(sessionId: string) {
  try {
    const screenshot = await captureService.captureScreen();
    const text = await ocrService.extractText(screenshot);
    const analysis = await chatService.processOCRText(sessionId, text, ActionType.SCREENSHOT);
    return analysis;
  } catch (error) {
    console.error('Screenshot analysis failed:', error);
    // Return fallback response or rethrow with context
    throw new Error(`Screenshot analysis failed: ${error.message}`);
  }
}
```

#### IPC Error Handling

Handle errors in IPC communication:

```javascript
// Renderer process
ipcRenderer.send('capture-screenshot', {sessionId});

ipcRenderer.once('screenshot-captured', (event, data) => {
  if (data.error) {
    displayError('Screenshot capture failed: ' + data.error);
    return;
  }
  // Process successful result
  displayScreenshotResult(data.text);
});

// Set timeout for IPC operations
const timeout = setTimeout(() => {
  displayError('Screenshot capture timed out');
}, 30000);

ipcRenderer.once('screenshot-captured', () => {
  clearTimeout(timeout);
});
```

---

## Usage Examples

### Complete Session Flow

```typescript
// 1. Initialize application
const appController = new ApplicationController({
  debug: true,
  stealthMode: true
});

await appController.initialize();

// 2. Create main window
const mainWindow = appController.createMainWindow();

// 3. Create session
const sessionConfig = {
  profession: 'software-engineer',
  interviewType: 'technical',
  context: 'Senior React developer, focus on hooks and state management'
};

const session = await sessionManager.createSession(sessionConfig);

// 4. Create session window
const sessionWindow = appController.createSessionWindow(session.id, {
  id: session.id,
  ...sessionConfig,
  createdAt: new Date(),
  isActive: true
});

// 5. Initialize chat with context
await chatService.initializeSession(
  session.id,
  sessionConfig.profession,
  sessionConfig.interviewType
);
```

### Screenshot Analysis Flow

```typescript
// 1. Capture screenshot
const screenshot = await captureService.captureScreen();

// 2. Extract text using OCR
const ocrText = await ocrService.extractText(screenshot);

// 3. Process with AI
const analysis = await chatService.processOCRText(
  sessionId,
  ocrText,
  ActionType.SCREENSHOT
);

// 4. Send result to UI
sessionWindow.webContents.send('chat-response', {
  sessionId,
  content: analysis,
  timestamp: new Date().toISOString()
});
```

### Audio Recording Flow

```typescript
// 1. Start recording
await audioService.startRecording(AudioSource.INTERVIEWEE, sessionId);

// 2. Stop recording (after user action)
const transcription = await audioService.stopRecording(sessionId);

// 3. Process transcription
if (transcription) {
  const coaching = await chatService.processTranscript(
    sessionId,
    transcription,
    AudioSource.INTERVIEWEE
  );
  
  // 4. Send coaching to UI
  sessionWindow.webContents.send('chat-response', {
    sessionId,
    content: `🤖 **AI Coaching:** ${coaching}`,
    timestamp: new Date().toISOString()
  });
}
```

### RAG Integration

```typescript
// 1. Add documents to global knowledge base
const result = await globalRAGService.indexFolder('/path/to/resume/docs');
console.log(`Indexed ${result.documentsProcessed} documents`);

// 2. Search for relevant context during session initialization
const searchQueries = [
  'React experience frontend development',
  'JavaScript TypeScript skills',
  'software engineer background'
];

const contextResults = [];
for (const query of searchQueries) {
  const results = await globalRAGService.searchRelevantContext(query, 3);
  contextResults.push(...results);
}

// 3. Build context message
const personalContext = contextResults
  .map(result => result.text)
  .join('\n\n');

const contextMessage = `
🎯 **INTERVIEW SESSION STARTED**

**Role:** ${profession}
**Interview Type:** ${interviewType}

**Your Background & Experience:**
${personalContext}

**Instructions:**
You are an AI assistant helping during a ${profession} ${interviewType} interview. 
Provide expert guidance based on the context above.
`;

// 4. Send to ChatService
const aiResponse = await chatService.sendMessage(sessionId, contextMessage, true);
```

### Error Handling Example

```typescript
async function handleUserAction(sessionId: string, action: string) {
  try {
    switch (action) {
      case 'screenshot':
        const screenshot = await captureService.captureScreen();
        const text = await ocrService.extractText(screenshot);
        const analysis = await chatService.processOCRText(
          sessionId, 
          text, 
          ActionType.SCREENSHOT
        );
        return {success: true, data: analysis};
        
      case 'start-recording':
        await audioService.startRecording(AudioSource.INTERVIEWEE, sessionId);
        return {success: true, message: 'Recording started'};
        
      case 'stop-recording':
        const transcription = await audioService.stopRecording(sessionId);
        if (transcription) {
          const coaching = await chatService.processTranscript(
            sessionId,
            transcription,
            AudioSource.INTERVIEWEE
          );
          return {success: true, data: {transcription, coaching}};
        }
        return {success: false, message: 'No transcription available'};
        
      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error(`Action ${action} failed:`, error);
    
    // Provide user-friendly error messages
    if (error instanceof OCRProcessingError) {
      return {success: false, message: 'Screenshot analysis failed. Please try again.'};
    } else if (error instanceof AudioRecordingError) {
      return {success: false, message: 'Audio recording failed. Check microphone permissions.'};
    } else if (error instanceof APIKeyNotConfiguredError) {
      return {success: false, message: 'Please configure your OpenAI API key in settings.'};
    } else {
      return {success: false, message: 'An unexpected error occurred. Please try again.'};
    }
  }
}
```

---

This comprehensive API reference provides detailed documentation for all public interfaces, methods, and usage patterns in the GhostGuide application.
