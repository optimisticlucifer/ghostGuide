# GhostGuide

An AI-powered study assistant application designed to help students learn more effectively through OCR, audio transcription, and intelligent tutoring.

## Overview

GhostGuide is an Electron-based desktop application that enhances your study sessions by:
- Capturing and analyzing lecture slides, textbooks, and notes via OCR
- Recording and transcribing lectures and audio study materials
- Providing AI-powered explanations and tutoring via OpenAI
- Operating in distraction-free mode with minimal UI
- Managing multiple study sessions with organized notes

## Features

### Core Capabilities
- **Focus Mode**: Distraction-free interface to keep you in the zone
- **Global Hotkeys**: Quick access via keyboard shortcuts for seamless studying
- **Smart OCR**: Capture text from slides, textbooks, PDFs, and handwritten notes
- **Lecture Recording**: Record and transcribe lectures with real-time Whisper transcription
- **AI Tutor**: Get instant explanations and answers from GPT-3.5-turbo
- **Study Sessions**: Organize your learning by subject and topic
- **Knowledge Base (RAG)**: Upload study materials for personalized assistance
- **Smart Notepad**: AI-enhanced note-taking with context awareness

### What You Can Do
- **Capture Lecture Slides**: Screenshot any content and get instant AI analysis
- **Record Lectures**: Transcribe audio from classes or video lectures
- **Ask Questions**: Get explanations on any topic from your AI tutor
- **Build Knowledge**: Upload your notes and materials for contextual help
- **Review Concepts**: Get summaries and explanations tailored to your level

## Installation

### Prerequisites
- macOS (primary platform)
- Node.js 18+ and npm
- **FFmpeg** (for audio processing)
- **Whisper** (for lecture transcription)

### Quick Setup

```bash
# Clone the repository
git clone <repository-url>
cd GhostGuide

# Install dependencies
npm install

# Build the application
npm run build

# Start studying!
npm start
```

### Installing Audio Dependencies

1. **Install FFmpeg**:
   ```bash
   brew install ffmpeg
   ```

2. **Install Whisper**:
   ```bash
   pip install openai-whisper
   brew install whisper-cpp
   ```

3. **Optional - Internal Audio Capture**:
   - Install [BlackHole](https://github.com/ExistentialAudio/BlackHole) for capturing system audio

## Usage

### Getting Started
1. Launch the app with `npm start`
2. Press **Cmd+G** to show/hide the main window
3. Select your subject area and topic
4. Click "Start Session" to begin studying
5. Use **Cmd+H** to toggle study windows

### Study Tools

| Tool | Description |
|------|-------------|
| **Screenshot** | Capture lecture slides or textbook pages for AI analysis |
| **Record** | Record and transcribe lectures or study audio |
| **Ask AI** | Get explanations on any concept |
| **RAG** | Upload study materials for personalized help |
| **Notepad** | Take AI-enhanced notes |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd+G | Toggle main window |
| Cmd+H | Toggle study session windows |
| Cmd+S | Send transcription to AI |
| Cmd+Q | Quick screenshot analysis |
| Cmd+Up/Down | Scroll answers |

## Configuration

### OpenAI API Setup
1. Click the Settings button
2. Enter your OpenAI API key
3. Test the connection
4. Save your settings

### Study Preferences
- Set default subject areas
- Configure preferred study topics
- Customize AI response style

## How It Works

### OCR Analysis
1. Capture any screen content (slides, textbooks, notes)
2. Tesseract.js extracts the text
3. AI analyzes and explains the content
4. Get instant clarification on difficult concepts

### Lecture Transcription
1. Start recording during a lecture
2. Audio is processed in real-time
3. Whisper transcribes speech to text
4. Review and search your lecture notes

### Knowledge Base (RAG)
1. Upload your study materials (.txt, .md files)
2. Documents are indexed for quick retrieval
3. AI uses your materials for contextual answers
4. Get help that's specific to your coursework

## Architecture

### Technology Stack
- **Frontend**: Electron with HTML/CSS/JavaScript
- **Backend**: TypeScript/Node.js
- **OCR**: Tesseract.js
- **Audio**: FFmpeg + Whisper
- **AI**: OpenAI API
- **Storage**: SQLite with encrypted data

### Performance
- OCR processing: <2 seconds
- Audio transcription: <3 seconds per 5-second segment
- Optimized for long study sessions

## Development

```bash
# Development mode
npm run dev

# Run tests
npm test

# Build for production
npm run dist
```

## Troubleshooting

### Common Issues

**OCR not working?**
- Ensure you're capturing windows with visible text
- Works best with high-contrast content

**Audio not recording?**
- Check FFmpeg installation: `ffmpeg -version`
- Grant microphone permissions in System Preferences

**AI not responding?**
- Verify your OpenAI API key in Settings
- Check your internet connection

### Permissions Required
- **Accessibility**: For global hotkeys
- **Screen Recording**: For screenshot capture
- **Microphone**: For lecture recording

## License

MIT License

## Support

For issues and feature requests, please open an issue on GitHub.

---

*GhostGuide - Your invisible study companion*
