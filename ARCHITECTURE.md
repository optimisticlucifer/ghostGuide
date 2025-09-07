# Interview Assistant - Complete Architecture Documentation

## Overview
A sophisticated desktop application built with Electron and TypeScript that assists during technical interviews through screen capture, OCR, audio transcription, and AI-powered coaching. The app operates in stealth mode to remain undetectable during screen sharing.

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Electron Application                     │
├─────────────────────────────────────────────────────────────┤
│                    Main Process (Node.js)                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │ Application     │  │ IPC Controller  │  │ Window      │ │
│  │ Controller      │  │                 │  │ Manager     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │                   Service Layer                         │ │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │ │
│  │ │ Capture │ │   OCR   │ │  Audio  │ │      Chat       │ │ │
│  │ │ Service │ │ Service │ │ Service │ │    Service      │ │ │
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │ │
│  │                                                         │ │
│  │ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────────┐ │ │
│  │ │ Session │ │ Config  │ │  Local  │ │     Global      │ │ │
│  │ │ Manager │ │ Manager │ │   RAG   │ │      RAG        │ │ │
│  │ └─────────┘ └─────────┘ └─────────┘ └─────────────────┘ │ │
│  └─────────────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────────────┤
│                 Renderer Processes (Chromium)              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐ │
│  │    Main     │  │   Session   │  │       Notepad       │ │
│  │   Window    │  │   Window    │  │       Window        │ │
│  │ (Setup/Config)│ │ (Chat/Tools)│ │   (Markdown/Notes)  │ │
│  └─────────────┘  └─────────────┘  └─────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 📁 Project Structure

```
GhostGuide/
├── src/
│   ├── main.ts                     # Application entry point
│   ├── controllers/
│   │   ├── ApplicationController.ts # Main orchestrator
│   │   └── IPCController.ts        # Inter-process communication
│   ├── services/                   # Business logic layer
│   │   ├── CaptureService.ts       # Screen capture
│   │   ├── OCRService.ts          # Text extraction
│   │   ├── AudioService.ts        # Audio recording/transcription
│   │   ├── ChatService.ts         # OpenAI integration
│   │   ├── SessionManager.ts      # Session state management
│   │   ├── ConfigurationManager.ts # Settings & secrets
│   │   ├── LocalRAGService.ts     # Per-session context
│   │   ├── GlobalRAGService.ts    # Global knowledge base
│   │   └── WindowManager.ts       # Window lifecycle
│   ├── renderer/                   # Frontend UI
│   │   ├── main.html              # Setup/configuration UI
│   │   ├── session.html           # Interview session UI
│   │   ├── notepad.html           # Markdown notepad UI
│   │   ├── main-renderer.js       # Main window logic
│   │   ├── session-renderer.js    # Session window logic
│   │   └── notepad-renderer.js    # Notepad window logic
│   ├── types/
│   │   └── index.ts               # TypeScript interfaces
│   └── utils/
│       └── logger.ts              # Logging utilities
├── tests/                         # Test suites
│   ├── services/                  # Unit tests
│   ├── integration/               # Integration tests
│   └── e2e/                      # End-to-end tests
├── dist/                          # Compiled TypeScript
├── dist-electron/                 # Built distributables
└── package.json                   # Dependencies & scripts
```

## 🔧 Core Technologies & Stack

### Frontend
- **Electron**: Desktop app framework (Chromium + Node.js)
- **HTML/CSS/JavaScript**: Renderer process UI
- **TypeScript**: Type safety and better development experience
- **Marked**: Markdown parsing for notepad feature

### Backend Services
- **Node.js**: Runtime environment
- **Tesseract.js**: OCR text extraction
- **FFmpeg**: Audio processing
- **OpenAI Whisper**: Speech-to-text transcription
- **OpenAI GPT**: AI coaching and analysis

### Storage & Configuration
- **electron-store**: Encrypted settings storage
- **File System**: Local data persistence
- **JSON**: Session state serialization

### Development & Testing
- **Mocha**: Test framework
- **ts-node**: TypeScript execution
- **electron-builder**: Application packaging

## 🎯 Key Architectural Decisions

### 1. Multi-Process Architecture
- **Main Process**: Controls application lifecycle, manages services
- **Renderer Processes**: Separate UI windows (main, session, notepad)
- **IPC Communication**: Secure message passing between processes

### 2. Service-Oriented Design
- Modular services with single responsibilities
- Dependency injection through ApplicationController
- Clean separation of concerns

### 3. State Management
- Session-based state isolation
- Persistent configuration storage
- In-memory caching for performance

### 4. Security & Stealth Features
- Content protection to prevent screen sharing detection
- Encrypted API key storage
- Global hotkeys for quick access

## 🚀 System Flow & Data Pipeline

### Application Startup
```
1. main.ts → ApplicationController.initialize()
2. Load configuration and secrets
3. Initialize all services
4. Setup global hotkeys
5. Create main window
6. Enter stealth mode (hide dock, enable content protection)
```

### Session Creation Flow
```
1. User selects profession/interview type in main window
2. IPCController.createSession() called
3. SessionManager creates new session with unique ID
4. New session window created with chat interface
5. LocalRAGService initialized for session context
6. Session-specific notepad window available
```

### Screen Capture & OCR Pipeline
```
1. User triggers capture (hotkey/button)
2. CaptureService.captureScreen() → screenshot buffer
3. OCRService.extractText() → raw text extraction
4. Text accumulated across multiple captures
5. ChatService.analyze() → AI coaching feedback
6. Results displayed in session window
```

### Audio Processing Pipeline
```
1. AudioService starts recording (mic/system/both)
2. FFmpeg captures audio → temporary files
3. Whisper CLI transcribes → text segments
4. Auto-recorder accumulates transcription
5. Cmd+L hotkey sends for AI analysis
6. Real-time coaching feedback provided
```

## 🔐 Security & Privacy Features

### Content Protection
```typescript
// Window creation with content protection
const window = new BrowserWindow({
  webPreferences: {
    contentProtection: true,
    sharingType: 'none'  // macOS specific
  }
});
```

### Encrypted Storage
```typescript
// API keys stored encrypted
const store = new Store({
  encryptionKey: 'user-specific-key',
  name: 'ghost-guide-config'
});
```

### Screen Sharing Detection
- Periodic checks for screen sharing applications
- Automatic content protection toggling
- Stealth mode activation/deactivation

## 🎨 User Interface Architecture

### Main Window (Setup)
- Profession selection (Software Engineer, Data Scientist, etc.)
- Interview type configuration
- Settings and API key management
- Session creation interface

### Session Window (Interview)
- Real-time chat interface with AI
- Toolbar with capture tools:
  - Screenshot (full/half screen)
  - Area capture with bounding box
  - Debug code analysis
  - Audio recording controls
  - RAG knowledge integration
- Status indicators and hotkey hints

### Notepad Window (Documentation)
- Split-view markdown editor
- Live preview with syntax highlighting
- Image paste/drag-and-drop support
- Auto-save functionality
- Always-on-top with 50% opacity

## 📊 Performance & Monitoring

### Performance Targets
- Screen capture: < 500ms
- OCR processing: < 2 seconds
- Audio transcription: Real-time streaming
- UI responsiveness: < 100ms interaction time

### Monitoring Features
- Service health checks
- Performance metrics logging
- Error tracking and recovery
- Memory usage monitoring

## 🧪 Testing Strategy

### Unit Tests
```typescript
// Service testing example
describe('OCRService', () => {
  it('should extract text from image buffer', async () => {
    const result = await ocrService.extractText(imageBuffer);
    expect(result.text).to.include('expected content');
  });
});
```

### Integration Tests
- Service interaction testing
- IPC communication validation
- File system operations

### End-to-End Tests
- Complete user workflows
- Multi-window interactions
- Hotkey functionality

## 🚢 Build & Deployment

### Development Workflow
```bash
npm install          # Install dependencies
npm run build        # Compile TypeScript
npm run dev         # Development mode
npm test            # Run test suite
```

### Production Build
```bash
npm run dist        # Create distributables
# Output: dist-electron/GhostGuide-1.0.0.dmg (macOS)
```

### Cross-Platform Support
- Primary: macOS (native features)
- Secondary: Windows, Linux (core functionality)

## 🔮 Advanced Features

### RAG (Retrieval-Augmented Generation)
- **Local RAG**: Session-specific context and history
- **Global RAG**: Persistent knowledge base across sessions
- Vector embeddings for semantic search
- Context injection into AI prompts

### AI Integration
- OpenAI GPT-4 for intelligent coaching
- Custom prompts for different interview scenarios
- Context-aware responses based on profession/role
- Multi-turn conversation handling

### Audio Features
- Multi-source recording (microphone + system audio)
- Real-time transcription streaming
- Background processing with FFmpeg
- BlackHole virtual audio device integration (macOS)

## 💡 Innovation Highlights

1. **Stealth Technology**: Undetectable during screen sharing
2. **Multi-Modal Input**: Screen + Audio + Manual notes
3. **Context Preservation**: Persistent AI conversation threads
4. **Real-Time Processing**: Live transcription and analysis
5. **Professional Customization**: Role-specific AI coaching

## 🎤 Interview Talking Points

### Technical Depth
- "I chose Electron for cross-platform desktop development while maintaining web technologies"
- "Implemented a service-oriented architecture for modularity and testability"
- "Used TypeScript throughout for type safety and better development experience"

### Problem Solving
- "Solved screen sharing detection using native APIs and content protection"
- "Optimized OCR performance through image preprocessing and caching"
- "Implemented robust error handling and recovery mechanisms"

### System Design
- "Designed for scalability with modular services and clean interfaces"
- "Separated concerns between main process logic and renderer UI"
- "Built comprehensive testing strategy from unit to end-to-end"

### Innovation
- "Created unique stealth capabilities for interview assistance"
- "Integrated multiple AI services for comprehensive coaching"
- "Developed real-time multi-modal input processing"

This architecture demonstrates full-stack development skills, system design thinking, security awareness, and practical problem-solving abilities that interviewers value.
