# Interview Assistant

An AI-powered stealth interview assistance application designed to help users during technical interviews through OCR, audio transcription, and AI-powered assistance.

## Overview

Interview Assistant is an Electron-based desktop application that provides discreet assistance during interviews by:
- Capturing and analyzing screen content via OCR with Tesseract.js
- Recording and transcribing audio from multiple sources using FFmpeg and Whisper
- Providing AI-powered responses and suggestions via OpenAI GPT-3.5-turbo
- Operating in stealth mode with frameless windows to remain undetectable
- Managing multiple interview sessions with encrypted data persistence

## Features

### Core Capabilities
- **Stealth Mode**: Frameless windows with dock icon removal for invisibility
- **Global Hotkeys**: Quick access via 'g' (main window) and 'h' (session window)
- **OCR Integration**: Screenshot capture with Tesseract.js text extraction
- **Audio Recording**: Multi-source audio capture (internal + microphone) with real-time Whisper transcription
- **AI Chat**: OpenAI GPT-3.5-turbo integration with context-aware prompting
- **Session Management**: Isolated sessions with encrypted data persistence
- **Prompt Library**: Customizable prompts per profession and interview type
- **RAG System**: Document ingestion and retrieval for personalized assistance

### Implementation Status
✅ **Current Implementation (main.ts):**
- Core window management with stealth capabilities and enhanced logging
- Session management with multi-session support
- Interactive UI with profession and interview type selection
- Global hotkey system (Cmd+G for main window, Cmd+H for session windows)
- Session windows with toolbar functionality (Screenshot, Debug, Record, RAG, Close)
- Real-time chat interface with user/AI message distinction
- Context-aware AI analysis for screenshot content
- Profession-specific response templates
- **OpenAI Integration**: Full OpenAI API client with secure API key management
- **Settings Window**: Complete configuration interface for API keys and preferences
- **Enhanced Error Handling**: Comprehensive logging and user feedback systems
- TypeScript implementation with comprehensive console logging

✅ **Available Versions:**
- **Primary**: Full TypeScript implementation (`src/main.ts`) - Currently active
- **Alternative**: Simplified TypeScript version (`src/main-simple.ts`)
- **Demo**: Working JavaScript demo (`src/main-working-demo.js`)
- Comprehensive testing suite and performance optimizations

### Error Handling & Recovery
- **Graceful Error Handling**: Comprehensive error categorization and user-friendly messages
- **Automatic Retry Logic**: Exponential backoff for recoverable errors (max 3 attempts)
- **Enhanced Error Types**: Specialized handlers for OCR, Audio, API, System, User, RAG, and Configuration errors
- **Error Logging**: Detailed error tracking without sensitive data exposure
- **Smart Retry Management**: Operation-specific retry tracking with manual reset capabilities
- **Error Notification System**: User-friendly notifications with duplicate error filtering
- **Crash Recovery**: Automatic detection and recovery from application crashes
- **Service Monitoring**: Real-time monitoring of all core services with degraded mode fallback
- **Session Restoration**: Automatic restoration of active sessions after crashes or restarts
- **Heartbeat System**: Continuous application health monitoring with 5-second intervals

### Update Management & Data Protection
- **Automatic Updates**: Secure update checking and installation with signature verification
- **Backup System**: Automatic backup creation before updates with encrypted sensitive data
- **Configuration Migration**: Seamless migration of settings between application versions
- **Rollback Support**: Ability to restore from backups if updates cause issues
- **Update Scheduling**: Configurable automatic update checking (default: 24 hours)
- **Progress Tracking**: Real-time download progress and installation status
- **Version Management**: Support for semantic versioning and migration scripts
- **Data Integrity**: Checksum verification and encrypted backup storage
- **Selective Restore**: Granular restoration of configuration and user data
- **Cleanup Management**: Automatic cleanup of old backups to manage disk space

### Security & Privacy
- **AES-256 Encryption**: All sensitive data encrypted at rest
- **Local Processing**: OCR and transcription handled locally when possible
- **Session Isolation**: Prevents cross-session data leakage
- **Secure Configuration**: API keys and prompts stored encrypted

## Installation

### Prerequisites
- macOS (primary target platform)
- Node.js 18+ and npm
- **FFmpeg** (for audio recording and processing)
- **Whisper** (for local audio transcription)
- **Blackhole audio driver** (for internal audio capture)

### Production Build

The application is now configured for production deployment with comprehensive build automation:

```bash
# Install dependencies
npm install

# Build TypeScript source
npm run build

# Run in development mode
npm run dev

# Create production packages
npm run dist

# Create complete release with all installers
npm run release
```

The production build includes:
- Full TypeScript compilation to `dist/` directory
- Comprehensive dependency bundling including native modules
- Cross-platform installer generation (Windows, macOS, Linux)
- Automated testing and validation pipeline

#### Installing Audio Dependencies

1. **Install FFmpeg**:
   ```bash
   # Using Homebrew
   brew install ffmpeg
   
   # Or using MacPorts
   sudo port install ffmpeg
   ```

2. **Install Whisper**:
   ```bash
   # Using pip
   pip install openai-whisper
   
   # Verify installation
   whisper --help
   ```

3. **Install BlackHole Audio Driver**:
   - Download from: https://github.com/ExistentialAudio/BlackHole
   - Install the 2ch version for stereo internal audio capture
   - Configure your system audio to route through BlackHole for internal recording

### Setup
```bash
# Clone the repository
git clone <repository-url>
cd interview-assistant

# Install dependencies
npm install

# Build the application (required before first run)
npm run build

# Start the application
npm start

# Run in development mode (builds and runs with dev flag)
npm run dev

# Run the working demo
npm run demo

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Create production build
npm run dist

# Create complete release package
npm run release
```

## Usage

### Basic Operation
1. Build the application first with `npm run build`, then launch with `npm start`
2. Use global hotkey **Cmd+G** (or Ctrl+G) to show/hide main window
3. Select profession and interview type from dropdowns
4. Click "Start Session" to begin a new interview session
5. Use **Cmd+H** (or Ctrl+H) to toggle session windows visibility
6. Use toolbar buttons for various actions:
   - **📷 Screenshot**: Capture and analyze screen content with AI
   - **🐛 Debug**: Analyze code snippets and identify issues
   - **🎤 Record**: Start/stop audio recording and transcription
   - **📚 RAG**: Add study materials for personalized assistance
   - **❌ Close**: Close the current session

### Configuration

#### Settings Window
Access the settings window by clicking the "⚙️ Settings" button in the main window or using the settings option in session windows.

**OpenAI API Configuration:**
- **API Key Setup**: Enter your OpenAI API key for AI-powered responses
- **Connection Testing**: Test your API key before saving to ensure it works
- **Secure Storage**: API keys are stored securely using electron-store encryption

**Interview Preferences:**
- **Default Profession**: Set your preferred profession (Software Engineer, Data Scientist, etc.)
- **Default Interview Type**: Choose default interview type (Technical, Behavioral, etc.)
- **Preference Persistence**: Settings are saved locally and restored on app restart

**Features Overview:**
The settings window displays all available features including:
- Stealth mode capabilities
- Screenshot OCR analysis
- Audio transcription
- RAG knowledge base
- Code debugging assistance
- Multi-session support
- Global hotkey shortcuts
- Error recovery systems

#### API Key Management
The application provides secure API key management with the following features:

**API Key Testing:**
```javascript
// Test API key before saving
ipcMain.on('test-api-key', async (event, apiKey) => {
  // Validates API key with OpenAI service
  // Returns success/error status to settings window
});
```

**Secure Storage:**
```javascript
// API keys are stored securely using electron-store
// Keys are encrypted at rest and never exposed in logs
// Automatic initialization on app startup if key exists
```

**Fallback Handling:**
```javascript
// Graceful degradation when no API key is configured
// Simulated responses for development and testing
// User-friendly error messages for missing configuration
```

#### Configuration Files
- API keys and settings managed through Settings dialog
- Prompt templates customizable per profession/interview type
- Audio sources configurable for optimal capture
- All sensitive data encrypted at rest

### Update Management

The UpdateService provides comprehensive update management with automatic backup and recovery capabilities:

#### Automatic Updates
- **Background Checking**: Automatically checks for updates every 24 hours (configurable)
- **Secure Downloads**: All updates are cryptographically signed and verified
- **User Control**: Updates require user approval before installation
- **Progress Tracking**: Real-time download progress and status updates

#### Backup System
- **Pre-Update Backups**: Automatic backup creation before any update installation
- **Encrypted Storage**: Sensitive configuration files are encrypted in backups
- **Selective Backup**: Separates configuration and user data for granular restoration
- **Automatic Cleanup**: Maintains only the 5 most recent backups (configurable)

#### Configuration Migration
- **Version-Aware**: Automatically migrates settings between application versions
- **Incremental Updates**: Supports step-by-step migrations through multiple versions
- **Rollback Safety**: Maintains backup compatibility for safe rollbacks

#### Usage Examples

**Manual Update Check:**
```javascript
// Check for available updates
const updateInfo = await updateService.checkForUpdates();
if (updateInfo) {
  console.log(`Update ${updateInfo.version} available`);
}
```

**Create Manual Backup:**
```javascript
// Create backup before major changes
const backupInfo = await updateService.createBackup();
console.log(`Backup created: ${backupInfo.version}`);
```

**Restore from Backup:**
```javascript
// Restore from a specific backup
const backups = updateService.getAvailableBackups();
await updateService.restoreBackup(backups[0].configPath);
```

#### Update Events
The system emits events for UI integration:
- `update-available`: New update detected
- `download-progress`: Download progress updates
- `backup-created`: Backup creation completed
- `migration-completed`: Configuration migration finished

For detailed technical documentation, see [docs/UpdateService.md](docs/UpdateService.md).

### OCR Integration with AI Analysis

The OCRService provides screenshot capture, text extraction, and intelligent AI analysis capabilities:

#### Core Features
- **Screenshot Capture**: Captures active window or selected screen area automatically
- **Text Extraction**: Uses Tesseract.js for accurate OCR processing
- **AI-Powered Analysis**: Context-aware analysis based on profession and interview type
- **Image Preprocessing**: Optimizes images for better OCR accuracy
- **Performance Optimization**: Meets 2-second latency requirement
- **Error Handling**: Comprehensive error handling with retry logic

#### Enhanced Screenshot Analysis
The system now provides intelligent analysis of screenshot content:

**Context-Aware Analysis:**
- **Software Engineers**: Technical interview guidance, coding strategies, algorithm explanations
- **Data Scientists**: Data science applications, Python implementation tips, statistical considerations
- **System Design**: Architecture considerations, scalability discussions, distributed systems insights
- **Behavioral Interviews**: STAR method application, experience highlighting techniques

**Analysis Features:**
- **Problem Breakdown**: Step-by-step approach recommendations
- **Technical Insights**: Algorithm complexity, implementation tips, common pitfalls
- **Interview Strategy**: Communication techniques, testing approaches, optimization suggestions
- **Profession-Specific Guidance**: Tailored advice based on selected profession and interview type

#### API Methods
- `captureActiveWindow()` - Capture screenshot of active window
- `extractText(imagePath)` - Extract text from image using OCR
- `processScreenshot(sessionId)` - Complete screenshot to text pipeline with AI analysis
- `generateScreenshotAnalysis(text, profession, interviewType)` - Generate contextual AI analysis
- `getOCRStatus()` - Check OCR service availability
- `optimizeImage(imagePath)` - Preprocess image for better OCR

#### Usage Workflow
1. Click "Screenshot" button in session window
2. System captures active window automatically
3. OCR processes image and extracts text
4. AI generates profession-specific analysis of the content
5. Both OCR text and AI analysis appear in chat interface
6. Analysis includes step-by-step guidance and interview tips

#### Performance Targets
- **OCR Processing**: < 2 seconds from capture to text extraction
- **AI Analysis Generation**: < 1 second for contextual analysis
- **Image Preprocessing**: Automatic optimization for accuracy
- **Error Recovery**: Automatic retry with exponential backoff
- **Memory Management**: Efficient image processing and cleanup

#### Example Analysis Output

For a binary search algorithm question, the system provides:

**Software Engineer - Technical Interview:**
```
📸 Technical Interview Analysis

Question Detected: Implement a binary search algorithm with O(log n) complexity

Approach for Software Engineers:
• Step 1: Clarify requirements and constraints
• Step 2: Discuss time and space complexity
• Step 3: Start with a brute force solution
• Step 4: Optimize using appropriate data structures
• Step 5: Code step by step with explanations

For Binary Search specifically:
• Time Complexity: O(log n)
• Space Complexity: O(1) iterative, O(log n) recursive
• Key insight: Array must be sorted
• Edge cases: Empty array, single element, target not found

Interview Tips:
• Think out loud during coding
• Test with examples
• Discuss trade-offs between iterative vs recursive approaches
```

### AI Chat Integration

The ChatService provides intelligent assistance through OpenAI GPT-3.5-turbo with the following capabilities:

#### Core Features
- **Context-Aware Responses**: Uses profession and interview type to tailor responses
- **Conversation History**: Maintains session-specific chat history with token management
- **Multi-Modal Processing**: Handles text, OCR, and audio transcript inputs
- **Error Handling**: Comprehensive error handling with user-friendly messages

#### API Methods
- `sendMessage(sessionId, message)` - Send regular chat messages
- `processOCRText(sessionId, text, action)` - Analyze screenshot text
- `processTranscript(sessionId, transcript, source)` - Process audio transcriptions
- `getConversationHistory(sessionId)` - Retrieve chat history
- `isConfigured()` - Check if API key is set

#### Prompt System Integration
- Dynamic prompt resolution based on profession/interview type
- Action-specific prompts for screenshot analysis and code debugging
- Template variable substitution for personalized responses
- Fallback prompts for missing configurations

#### Token Management
- Automatic conversation history trimming to stay within limits
- Token usage monitoring and logging
- Configurable maximum tokens (default: 4000)
- Smart message pruning while preserving context

### RAG (Retrieval-Augmented Generation) System

The RAGService provides document-based knowledge retrieval to enhance AI responses with personalized content:

#### Core Features
- **Document Ingestion**: Supports .txt and .md files from selected folders
- **Text Chunking**: Intelligent text splitting with overlap for better context preservation
- **Simple Embeddings**: Word frequency-based embeddings for similarity matching
- **Session Isolation**: Each session maintains its own knowledge base
- **Similarity Search**: Cosine similarity-based content retrieval

#### Supported File Types
- **Text Files (.txt)**: Plain text documents
- **Markdown Files (.md)**: Markdown-formatted documentation
- **Future Support**: PDF and PowerPoint files (planned)

#### API Methods
- `ingestDocuments(folderPath, sessionId)` - Process documents from a folder
- `searchRelevantContent(query, sessionId)` - Find relevant content for queries
- `getKnowledgeBase(sessionId)` - Get session's knowledge base info
- `clearKnowledgeBase(sessionId)` - Clear session's documents
- `getStatus()` - Get service status and statistics

#### Usage Workflow
1. Click "Add Material for RAG" button in session window
2. Select folder containing study materials (.txt, .md files)
3. Documents are automatically processed and indexed
4. AI responses now include relevant content from your materials
5. Knowledge base persists for the session duration

#### Technical Implementation
- **Chunking Strategy**: 1000 characters per chunk with 200-character overlap
- **Embedding Model**: Simple word frequency vectors (100 dimensions)
- **Similarity Threshold**: 0.1 minimum score for relevance
- **Top Results**: Returns top 3 most relevant document chunks
- **Memory Management**: Session-specific knowledge bases with automatic cleanup

### Crash Recovery & Service Monitoring

The RecoveryManager provides comprehensive crash detection, service monitoring, and automatic recovery capabilities:

#### Core Features
- **Crash Detection**: Monitors application health with 5-second heartbeat intervals
- **Automatic Recovery**: Detects crashes on startup and restores previous sessions
- **Service Monitoring**: Real-time monitoring of OCR, Audio, Chat, and RAG services
- **Degraded Mode**: Graceful fallback when services are unavailable
- **Session Restoration**: Automatic restoration of active sessions after crashes

#### Recovery Process
1. **Heartbeat Monitoring**: Continuously tracks application state every 5 seconds
2. **Crash Detection**: Identifies crashes by checking for stale heartbeat timestamps (>30 seconds)
3. **Session Restoration**: Automatically restores all active sessions from previous run
4. **Service Recovery**: Tests and attempts to recover failed services with exponential backoff
5. **Graceful Shutdown**: Properly saves state during normal application termination

#### Service Status Tracking
- **OCR Service**: Monitors Tesseract availability and screenshot capture capabilities
- **Audio Service**: Tracks FFmpeg, Whisper, and audio device availability
- **Chat Service**: Monitors OpenAI API key configuration and connectivity
- **RAG Service**: Checks vector database accessibility and document processing

#### API Methods
- `initialize()` - Start crash detection and service monitoring
- `checkForCrashRecovery()` - Check for and perform crash recovery on startup
- `getServiceStatus(serviceName)` - Get current status of a specific service
- `getAllServiceStatuses()` - Get status of all monitored services
- `attemptServiceRecovery(serviceName)` - Manually attempt to recover a failed service
- `isServiceDegraded(serviceName)` - Check if service is in degraded mode
- `getDegradedFunctionalityMessage()` - Get user-friendly message about unavailable features

#### Recovery State Management
The system maintains a recovery state file that tracks:
- Current application state (starting, running, shutting_down, crashed)
- Active session IDs for restoration
- Last operation performed before potential crash
- Service availability status
- Timestamp for crash detection

#### Error Handling Integration
- Works closely with GracefulErrorHandler for comprehensive error management
- Automatic retry logic with exponential backoff (1min, 2min, 4min intervals)
- User-friendly error messages and recovery suggestions
- Detailed logging without exposing sensitive information

### Performance Monitoring & Optimization

The PerformanceMonitor provides real-time system monitoring, performance tracking, and automatic optimization capabilities:

#### Core Features
- **Real-Time Monitoring**: Continuous tracking of CPU, memory, and system resources
- **Service Latency Tracking**: Monitors performance of OCR, Audio, API, and RAG operations
- **Automatic Optimization**: Triggers optimizations when performance thresholds are exceeded
- **Performance Alerts**: Configurable warning and critical alerts for resource usage
- **Historical Data**: Maintains performance history for trend analysis
- **Memory Management**: Automatic garbage collection and memory cleanup

#### Monitoring Capabilities
- **System Metrics**: CPU usage, memory consumption, load averages, and system information
- **Process Metrics**: Application-specific memory usage, heap statistics, and uptime
- **Service Performance**: Individual service latency tracking with statistical analysis
- **Resource Thresholds**: Configurable warning (80% memory, 70% CPU) and critical (95% memory, 90% CPU) levels

#### Performance Thresholds
The system monitors the following performance targets:

**Memory Usage:**
- Warning: 80% of system memory
- Critical: 95% of system memory

**CPU Usage:**
- Warning: 70% CPU utilization
- Critical: 90% CPU utilization

**Service Latency:**
- **OCR Processing**: Warning at 1.5s, Critical at 2.5s
- **Audio Processing**: Warning at 2.5s, Critical at 4s
- **API Calls**: Warning at 5s, Critical at 10s
- **RAG Search**: Warning at 0.8s, Critical at 1.5s

#### API Methods
- `startMonitoring(intervalMs)` - Begin performance monitoring with specified interval
- `stopMonitoring()` - Stop performance monitoring
- `recordOCRLatency(latency)` - Record OCR operation performance
- `recordAudioLatency(latency)` - Record audio processing performance
- `recordAPILatency(latency)` - Record API call performance
- `recordRAGLatency(latency)` - Record RAG search performance
- `getCurrentMetrics()` - Get current system performance metrics
- `getPerformanceSummary()` - Get aggregated performance statistics
- `getRecentAlerts(count)` - Retrieve recent performance alerts

#### Automatic Optimizations
When critical thresholds are exceeded, the system automatically:

**Memory Optimization:**
- Forces garbage collection if available
- Clears old performance history data
- Reduces metrics retention to free memory
- Emits memory-optimized event for UI updates

**CPU Optimization:**
- Reduces monitoring frequency temporarily
- Adjusts processing intervals to reduce load
- Emits cpu-optimized event for service adjustments

**Latency Optimization:**
- Requests service-specific optimizations
- Adjusts processing parameters for better performance
- Emits latency-optimization-requested event

#### Usage Examples

**Start Performance Monitoring:**
```javascript
// Start monitoring with 5-second intervals
performanceMonitor.startMonitoring(5000);

// Listen for performance alerts
performanceMonitor.on('performance-alert', (alert) => {
  console.log(`${alert.type.toUpperCase()}: ${alert.message}`);
});
```

**Record Service Performance:**
```javascript
// Record OCR operation timing
const startTime = Date.now();
await ocrService.processScreenshot();
const latency = Date.now() - startTime;
performanceMonitor.recordOCRLatency(latency);
```

**Get Performance Summary:**
```javascript
const summary = performanceMonitor.getPerformanceSummary();
console.log(`Average OCR latency: ${summary.averageLatencies.ocr}ms`);
console.log(`Current memory usage: ${summary.currentUsage.memory}%`);
console.log(`Critical alerts: ${summary.alertCounts.critical}`);
```

#### Performance Events
The system emits events for UI integration and service coordination:
- `monitoring-started`: Performance monitoring has begun
- `monitoring-stopped`: Performance monitoring has stopped
- `metrics-collected`: New performance metrics available
- `performance-alert`: Performance threshold exceeded
- `memory-optimized`: Memory optimization completed
- `cpu-optimized`: CPU optimization completed
- `latency-optimization-requested`: Services should optimize for latency

#### Integration with Other Services
- **RecoveryManager**: Coordinates with crash detection and service monitoring
- **ErrorHandler**: Provides performance context for error analysis
- **All Services**: Automatic latency recording for performance tracking
- **UI Components**: Real-time performance data for status displays

#### Data Management
- **History Retention**: Maintains last 1000 performance measurements
- **Alert History**: Keeps last 100 performance alerts
- **Automatic Cleanup**: Periodic cleanup every 5 minutes to prevent memory buildup
- **Configurable Thresholds**: All performance thresholds can be adjusted via `updateThresholds()`

## Architecture

### Core Services
- **WindowManager**: Handles stealth window creation and management
- **SessionManager**: Manages interview sessions and state
- **OCRService**: Screen capture and text extraction
- **AudioService**: Multi-source audio recording and processing
- **ChatService**: AI integration and conversation management
- **RAGService**: Document ingestion and retrieval
- **EncryptionService**: Data security and encryption
- **ConfigurationManager**: Settings and configuration management
- **UpdateService**: Application updates, backups, and configuration migration
- **RecoveryManager**: Crash detection, service monitoring, and automatic recovery
- **PerformanceMonitor**: Real-time performance monitoring and optimization
- **ErrorHandler**: Comprehensive error handling with retry logic

### Technology Stack
- **Frontend**: Electron with HTML/CSS/JavaScript
- **Backend**: TypeScript/Node.js
- **OCR**: Tesseract.js
- **Audio**: FFmpeg + Blackhole (macOS)
- **Transcription**: Whisper (local processing)
- **AI**: OpenAI API
- **Database**: SQLite with FAISS for vector storage
- **Encryption**: AES-256

## Release Management

The application includes a comprehensive release automation system that handles building, packaging, testing, and distributing the application across multiple platforms.

### Release Automation Features

- **Automated Build Pipeline**: Complete build process from source to distributable packages
- **Cross-Platform Support**: Windows (EXE/MSI), macOS (DMG), Linux (DEB), and portable archives
- **Security Features**: Code signing, checksums (SHA256/SHA512), and integrity verification
- **Pre-Release Validation**: Automated testing, git status checks, and environment validation
- **Release Notes Generation**: Automatic generation from git history and standardized format
- **Crash Recovery Integration**: Built-in validation and testing of recovery systems

### Release Process

#### Quick Release
```bash
# Create complete release with all platforms
npm run release

# This runs the full pipeline:
# 1. Pre-release checks (tests, git status, environment)
# 2. Full application build
# 3. Cross-platform installer creation
# 4. Security checksum generation
# 5. Release package creation
# 6. Validation and testing
```

#### Manual Release Steps
```bash
# Individual release commands
node build/release-automation.js create    # Full release creation
node build/release-automation.js validate # Validate existing release
node build/release-automation.js tag      # Create git tag only
```

### Release Output Structure

After running `npm run release`, the following structure is created:

```
release/
└── InterviewAssistant-1.0.0-Release.zip  # Complete release package

installers/
├── windows/
│   ├── InterviewAssistant-1.0.0-Setup.exe
│   └── InterviewAssistant-1.0.0-Setup.msi
├── macos/
│   └── InterviewAssistant-1.0.0.dmg
├── linux/
│   └── interview-assistant_1.0.0_amd64.deb
├── portable/
│   ├── InterviewAssistant-1.0.0-Portable-Windows.zip
│   ├── InterviewAssistant-1.0.0-Portable-macOS.zip
│   └── InterviewAssistant-1.0.0-Portable-Linux.tar.gz
├── CHECKSUMS.json              # Detailed security checksums
├── checksums.txt               # Simple format for command-line verification
└── RELEASE-NOTES-1.0.0.md     # Generated release notes
```

### Security and Validation

#### Checksum Verification
```bash
# Verify installer integrity
cd installers
sha256sum -c checksums.txt

# Or check individual files
sha256sum InterviewAssistant-1.0.0-Setup.exe
```

#### Pre-Release Checks
The release system automatically validates:
- **Git Repository**: Clean working directory, no uncommitted changes
- **Version Uniqueness**: Ensures version tag doesn't already exist
- **Test Suite**: All tests must pass before release
- **Environment**: Checks for required signing certificates and environment variables
- **Dependencies**: Validates all build dependencies are available

#### Code Signing Requirements
For signed releases, set these environment variables:

```bash
# macOS Code Signing
export APPLE_ID="your-apple-id@example.com"
export APPLE_ID_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="your-team-id"
export MACOS_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"

# Windows Code Signing
export WINDOWS_CERT_FILE="path/to/certificate.p12"
export WINDOWS_CERT_PASSWORD="certificate-password"

# Build Configuration
export NODE_ENV="production"
```

### Release Validation

The system includes comprehensive validation:

#### Automated Validation
- **File Existence**: Verifies all expected installers are created
- **Checksum Verification**: Validates file integrity against generated checksums
- **Size Validation**: Ensures installers meet minimum size requirements (50MB+)
- **Format Verification**: Basic validation of installer file formats

#### Manual Testing Checklist
After automated release creation:
1. **Installation Testing**: Install on target platforms
2. **Functionality Testing**: Verify core features work
3. **Stealth Mode Testing**: Confirm invisibility features
4. **Uninstall Testing**: Ensure clean removal
5. **Upgrade Testing**: Test version upgrades

### Release Notes Generation

Release notes are automatically generated and include:
- **Change Log**: Git commits since last release
- **Installation Instructions**: Platform-specific setup guides
- **System Requirements**: Hardware and software requirements
- **Security Information**: Checksums and verification instructions
- **Support Links**: Documentation and issue reporting

### CI/CD Integration

The release system is designed for CI/CD integration:

```yaml
# Example GitHub Actions workflow
- name: Create Release
  run: |
    npm ci
    npm test
    npm run release
  env:
    NODE_ENV: production
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
    MACOS_SIGNING_IDENTITY: ${{ secrets.MACOS_SIGNING_IDENTITY }}
    WINDOWS_CERT_FILE: ${{ secrets.WINDOWS_CERT_FILE }}
    WINDOWS_CERT_PASSWORD: ${{ secrets.WINDOWS_CERT_PASSWORD }}
```

### Troubleshooting Release Issues

#### Common Problems

**Build Failures**
```bash
# Clean and rebuild
npm run build:clean
npm install
npm run release
```

**Code Signing Issues**
- Verify certificates are valid and not expired
- Check environment variables are set correctly
- Ensure proper keychain access on macOS

**Missing Dependencies**
- **Windows**: Install Visual Studio Build Tools
- **macOS**: Install Xcode Command Line Tools  
- **Linux**: Install build-essential package

**Size Validation Failures**
- Check if native dependencies are properly bundled
- Verify asset optimization is working
- Review included/excluded files in build configuration

For detailed build system documentation, see [build/INSTALLER-README.md](build/INSTALLER-README.md).

## Development

### Quick Start

For developers who want to get started quickly:

```bash
# Clone and setup
git clone <repository-url>
cd interview-assistant
npm install

# Run the working demo (fastest way to see the app)
npm run demo

# Or build and run the full TypeScript version
npm run build
npm run start

# Run tests
npm test
```

### Project Structure
```
src/
├── main.ts                 # Electron main process (TypeScript)
├── main-working-demo.js    # Working JavaScript demo version
├── main-simple.ts          # Simplified TypeScript version
├── renderer/              # UI components
│   ├── main.html          # Main window UI
│   ├── main-renderer.js   # Main window logic
│   ├── session.html       # Session window UI
│   └── session-renderer.js # Session window logic
├── services/              # Core business logic (TypeScript)
│   ├── WindowManager.ts
│   ├── SessionManager.ts
│   ├── OCRService.ts
│   ├── AudioService.ts
│   ├── ChatService.ts
│   ├── RAGService.ts
│   ├── EncryptionService.ts
│   └── ConfigurationManager.ts
└── types/                 # TypeScript definitions
    └── index.ts
```

### Scripts
- `npm run build` - Compile TypeScript to dist/
- `npm run start` - Build and run application
- `npm run dev` - Development mode with TypeScript compilation
- `npm run demo` - Run the working demo version
- `npm run test` - Run unit and E2E test suites
- `npm run test:unit` - Run unit tests only
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:e2e:watch` - Run E2E tests in watch mode
- `npm run clean` - Remove build artifacts
- `npm run rebuild` - Clean and rebuild from scratch

### Testing

The application includes comprehensive test coverage with unit tests for individual services and integration tests for complete workflows.

#### Test Structure
```
tests/
├── integration/           # End-to-end workflow tests
│   ├── AudioPipeline.test.ts
│   ├── ChatPipeline.test.ts
│   ├── OCRPipeline.test.ts    # NEW: Complete OCR workflow testing
│   └── RAGPipeline.test.ts
└── services/             # Unit tests for individual services
    ├── AudioService.test.ts
    ├── ChatService.test.ts
    ├── ConfigurationManager.test.ts
    ├── EncryptionService.test.ts
    ├── ErrorHandler.test.ts
    ├── HotkeyManager.test.ts
    ├── OCRService.test.ts
    ├── PromptLibraryService.test.ts
    ├── RecoveryManager.test.ts
    ├── SessionManager.test.ts
    └── WindowManager.test.ts
```

#### OCR Pipeline Integration Testing

The new `OCRPipeline.test.ts` provides comprehensive testing of the complete OCR workflow:

**Screenshot to Text Extraction Pipeline:**
- Screenshot capture and text extraction with Tesseract.js
- OCR preprocessing and optimization for better accuracy
- Performance validation (2-second latency requirement)
- Retry logic and error handling

**OCR to Chat Integration:**
- Processing extracted text through the ChatService
- Profession-specific prompt usage for OCR analysis
- Error handling for API failures and rate limiting
- Context preservation in chat history

**End-to-End Pipeline Testing:**
- Complete screenshot → OCR → AI response workflow
- Debug-specific OCR processing for code analysis
- Session state management and persistence
- Multi-modal content processing

**Performance and Reliability:**
- Concurrent OCR request handling
- Image quality adaptation and confidence scoring
- Resource cleanup and memory management
- Service integration validation

#### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm test -- --testPathPattern=integration/OCRPipeline
npm test -- --testPathPattern=services/OCRService

# Run tests with coverage
npm test -- --coverage
```

#### Test Configuration
Tests use Jest with mocking for external dependencies:
- **Tesseract.js**: Mocked for OCR operations
- **OpenAI API**: Mocked for chat responses
- **Electron APIs**: Mocked for window and system operations
- **File System**: Mocked for persistence operations

#### Performance Benchmarks
The OCR pipeline tests validate key performance requirements:
- **OCR Processing**: < 2 seconds per screenshot
- **End-to-End Latency**: < 5 seconds from capture to AI response
- **Concurrent Processing**: Support for 5+ simultaneous OCR operations
- **Memory Usage**: Efficient cleanup of temporary image files

## Security Considerations

- All API keys stored encrypted
- Local processing preferred for sensitive operations
- Session data isolated and encrypted
- No sensitive information in logs
- Stealth mode prevents detection

## Performance Targets

- OCR processing: <2 seconds
- Audio transcription: <3 seconds per 5-second segment
- Memory usage optimized for long-running sessions
- Minimal CPU footprint in idle state

## Troubleshooting

### Audio Recording Issues

**Problem**: "Audio service not initialized" or "FFmpeg is not installed"
- **Solution**: Install FFmpeg using Homebrew: `brew install ffmpeg`
- **Verify**: Run `ffmpeg -version` in terminal

**Problem**: "BlackHole audio driver not detected"
- **Solution**: Install BlackHole from https://github.com/ExistentialAudio/BlackHole
- **Setup**: Configure system audio routing through BlackHole for internal capture
- **Note**: Internal audio recording requires BlackHole; microphone recording works without it

**Problem**: "Whisper transcription failed" or timeouts
- **Solution**: Install Whisper: `pip install openai-whisper`
- **Verify**: Run `whisper --help` in terminal
- **Note**: First run may be slow as Whisper downloads language models

**Problem**: Audio segments too short or no transcription
- **Cause**: Audio segments under 1KB are skipped to avoid processing noise
- **Solution**: Ensure audio source is active and producing sound during recording

### OCR Issues

**Problem**: "No suitable window found for capture"
- **Solution**: Ensure you have a non-system window open (code editor, browser, etc.)
- **Note**: Desktop and system windows are excluded from capture

**Problem**: "No text found in screenshot"
- **Solution**: Capture windows with visible text content
- **Tip**: OCR works best with high-contrast text on clean backgrounds

### General Issues

**Problem**: Global hotkeys not working
- **Solution**: Check macOS accessibility permissions for the application
- **Path**: System Preferences > Security & Privacy > Accessibility

**Problem**: Windows not staying on top or visible
- **Solution**: Grant screen recording permissions if prompted
- **Note**: Required for stealth mode functionality

### Performance Issues

**Problem**: High CPU usage during transcription
- **Cause**: Whisper processing is CPU-intensive
- **Solution**: Consider using smaller Whisper models or reducing recording frequency

**Problem**: Memory usage growing over time
- **Cause**: Audio segments and transcriptions accumulating
- **Solution**: Restart sessions periodically; cleanup is automatic but gradual

## License

[License information to be added]

## Contributing

[Contributing guidelines to be added]

## Support

[Support information to be added]