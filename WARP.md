# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

Repository: Interview Assistant — an Electron + TypeScript desktop app that assists during technical interviews via OCR, audio transcription, and AI.

- Primary OS: macOS (other platforms supported for packaging)
- Runtime: Node.js 18+, npm
- Key external tools: FFmpeg (audio), Whisper (Python CLI), BlackHole (macOS virtual audio device)

1) Common commands (build, run, test)

Environment prerequisites (macOS):
- FFmpeg: brew install ffmpeg
- Whisper CLI: pip install openai-whisper (then whisper --help)
- BlackHole 2ch: https://github.com/ExistentialAudio/BlackHole

Install dependencies:
- npm install

Build and run:
- Build TypeScript: npm run build
- Run the app (builds then launches Electron): npm start
- Dev run (builds then launches with --dev): npm run dev
- Quick demo (runs a JS demo entry): npm run demo

Packaging:
- Create distributables with electron-builder: npm run dist
  - Output directory: dist-electron/

Cleaning:
- Remove build artifacts: npm run clean
- Clean and rebuild: npm run rebuild

Testing (Mocha + ts-node):
- Run all tests (unit + e2e): npm test
- Unit tests only: npm run test:unit
- E2E tests (builds first): npm run test:e2e
- E2E watch: npm run test:e2e:watch

Run a single test:
- Single unit test file:
  - npx mocha --require ts-node/register tests/services/OCRService.test.ts --timeout 10000
- Grep by test name (unit):
  - npx mocha --require ts-node/register "tests/**/*.test.ts" --grep "Your test name"
- Single E2E test (mirrors script):
  - npm run build && npx mocha --require ts-node/register tests/e2e/setup.ts tests/e2e/workflow.test.ts --timeout 60000

Lint/format:
- npm run lint and npm run format are placeholders (no linter/formatter configured in package.json).

2) High-level architecture and flow

Big picture
- Main process (TypeScript): Orchestrated by ApplicationController (src/controllers/ApplicationController.ts) and bootstrapped in src/main.ts.
- IPC layer: IPCController (src/controllers/IPCController.ts) wires renderer UI actions to services.
- Services (src/services/*): Modular services for capture, OCR, audio, chat (OpenAI), RAG (local and global), configuration, sessions, performance, recovery, updates, window management, and screen-sharing detection.
- Renderer (src/renderer/*): Lightweight HTML/JS UIs for main and session windows. Built assets are copied to dist/renderer during build.

Core components
- ApplicationController
  - Initializes logging, config, and all services
  - Sets up stealth mode (hides dock on macOS, enables content protection)
  - Registers global hotkeys:
    - Cmd/Ctrl+G: toggle main window
    - Cmd/Ctrl+H: toggle all session windows
    - Cmd/Ctrl+S: send current auto-recorder transcription for AI processing
  - Manages main and per-session windows; initializes Local RAG per session

- IPCController
  - Session lifecycle: create-session, close-session
  - Screenshot & debug capture: capture-screenshot, debug-code
  - Multi-capture and accumulation: multi-capture (FULL/LEFT_HALF/RIGHT_HALF)
  - Area capture: capture-area (bounding box coordinates)
  - Analyze accumulated OCR text: analyze-accumulated-text (SCREENSHOT/DEBUG)
  - Audio: toggle-recording (mic/system/both), toggle-system-recording
  - Forwards results to the appropriate session window via webContents

- Capture + OCR
  - CaptureService captures screen (full/halves) or a user-defined area
  - OCRService uses Tesseract.js to extract text from image buffers
  - Multi-step capture is supported: accumulate OCR text across captures, then analyze once

- Audio + Transcription
  - AudioService integrates FFmpeg and Whisper; supports microphone and system audio
  - Auto recorder support with pending segment handling; Cmd/Ctrl+S sends the current accumulation
  - Transcriptions can be routed through ChatService for immediate coaching feedback

- Chat + Prompts + RAG
  - ChatService integrates OpenAI (via ConfigurationManager API key)
  - PromptLibraryService controls profession/interview-type personas and action-specific prompts
  - LocalRAGService (per session) and GlobalRAGService (global) provide retrieval to augment prompts

- Configuration and persistence
  - ConfigurationManager manages encrypted API keys and preferences (electron-store under the hood)
  - SessionManager tracks per-session state (profession, interview type, context, OCR accumulation, recording state)

- Stealth and safety
  - ScreenSharingDetectionService periodically detects screen-sharing apps and toggles content protection so app windows don’t appear in shares
  - Windows are created with contentProtection and macOS sharingType where available

Renderer UI
- Main window: profession + interview-type selection, settings, and start-session flow
- Session window: chat interface plus toolbar actions (Screenshot, Debug, Area Capture, Record Mic/System, RAG, Close)
- Session renderer listens for IPC events: screenshot/debug results, transcriptions, and AI responses

Testing layout (Mocha)
- Unit tests: tests/services/*
- Integration/E2E: tests/integration/* and tests/e2e/* (E2E uses tests/e2e/setup.ts then workflow.test.ts)
- Note: A jest.config.js exists, but test scripts use Mocha; use the Mocha commands above

Notes and pointers
- Read README.md for a detailed feature overview and additional operational notes (hotkeys, update/backup features, performance/monitoring targets, and troubleshooting pointers)
- For audio features to work on macOS, ensure FFmpeg and BlackHole are installed and microphone/screen permissions are granted
- Packaged app artifacts are output to dist-electron/ via electron-builder

