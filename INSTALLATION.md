# Interview Assistant - Installation Guide

Welcome to Interview Assistant, your AI-powered stealth interview companion. This guide will walk you through the complete installation and setup process.

## Table of Contents

1. [System Requirements](#system-requirements)
2. [Installation Methods](#installation-methods)
3. [macOS Setup](#macos-setup)
4. [Windows Setup](#windows-setup)
5. [Linux Setup](#linux-setup)
6. [Audio Configuration](#audio-configuration)
7. [API Key Configuration](#api-key-configuration)
8. [First Run Setup](#first-run-setup)
9. [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements
- **macOS**: 10.14 (Mojave) or later
- **Windows**: Windows 10 (64-bit) or later
- **Linux**: Ubuntu 18.04+ or equivalent
- **RAM**: 4GB minimum, 8GB recommended
- **Storage**: 500MB free space
- **Network**: Internet connection for AI features

### Recommended Requirements
- **RAM**: 8GB or more
- **Storage**: 1GB free space
- **CPU**: Multi-core processor for optimal performance
- **Audio**: Dedicated audio interface (for advanced features)

## Installation Methods

### Method 1: Installer Packages (Recommended)

#### macOS
1. Download `InterviewAssistant-1.0.0.dmg`
2. Double-click the DMG file to mount it
3. Drag the Interview Assistant app to your Applications folder
4. Eject the DMG file

#### Windows
1. Download `InterviewAssistant-1.0.0-Setup.exe`
2. Right-click and select "Run as administrator"
3. Follow the installation wizard
4. Launch from Start Menu or Desktop shortcut

#### Linux (Ubuntu/Debian)
```bash
# Download the .deb package
wget https://github.com/interview-assistant/app/releases/download/v1.0.0/interview-assistant_1.0.0_amd64.deb

# Install the package
sudo dpkg -i interview-assistant_1.0.0_amd64.deb

# Install dependencies if needed
sudo apt-get install -f
```

### Method 2: Portable Version

1. Download the appropriate portable archive for your platform
2. Extract to your desired location
3. Run the executable directly (no installation required)

## macOS Setup

### Required Permissions

Interview Assistant requires several permissions to function properly. You'll be prompted for these during first launch:

#### 1. Screen Recording Permission
**Why needed**: For enhanced OCR functionality to capture and analyze interview questions across multiple displays using Electron's desktopCapturer API

**How to grant**:
1. Go to **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Screen Recording** from the left sidebar
3. Click the lock icon and enter your password
4. Check the box next to **Interview Assistant**
5. Restart the application

**Enhanced Features**: With this permission, Interview Assistant can:
- Capture from multiple monitors simultaneously
- Detect and select optimal screen sources
- Provide high-quality screenshots for better OCR accuracy

#### 2. Microphone Access
**Why needed**: For audio transcription during interviews

**How to grant**:
1. Go to **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Microphone** from the left sidebar
3. Click the lock icon and enter your password
4. Check the box next to **Interview Assistant**

#### 3. Accessibility Access
**Why needed**: For stealth mode and global hotkey functionality

**How to grant**:
1. Go to **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Accessibility** from the left sidebar
3. Click the lock icon and enter your password
4. Click the **+** button and add **Interview Assistant**

#### 4. Full Disk Access (Optional)
**Why needed**: For advanced file processing and RAG functionality

**How to grant**:
1. Go to **System Preferences** → **Security & Privacy** → **Privacy**
2. Select **Full Disk Access** from the left sidebar
3. Click the lock icon and enter your password
4. Click the **+** button and add **Interview Assistant**

### Gatekeeper and Code Signing

If you see a warning about the app being from an "unidentified developer":

1. **First time**: Right-click the app and select **Open**
2. **If blocked**: Go to **System Preferences** → **Security & Privacy** → **General**
3. Click **Open Anyway** next to the Interview Assistant warning
4. **Alternative**: Run this command in Terminal:
   ```bash
   sudo xattr -rd com.apple.quarantine "/Applications/Interview Assistant.app"
   ```

### Stealth Mode Configuration

For maximum stealth operation on macOS:

1. **Hide from Dock**: The app automatically removes its dock icon during stealth mode
2. **Process Name**: The app runs as `systemAssistance` to blend in
3. **Menu Bar**: Access the app through global hotkeys (default: `G` for main window)

## Windows Setup

### Windows Defender and Antivirus

If Windows Defender or your antivirus blocks the installation:

1. **Windows Defender**:
   - Go to **Windows Security** → **Virus & threat protection**
   - Click **Manage settings** under "Virus & threat protection settings"
   - Add an exclusion for the systemAssistance folder

2. **Third-party Antivirus**: Add the installation directory to your antivirus whitelist

### User Account Control (UAC)

The installer may require administrator privileges:
1. Right-click the installer and select **Run as administrator**
2. Click **Yes** when prompted by UAC
3. Follow the installation wizard

### Windows Permissions

Interview Assistant will request the following permissions:
- **Microphone access**: For audio transcription
- **Screen capture**: For OCR functionality
- **Network access**: For AI API calls

## Linux Setup

### Dependencies

Install required dependencies:

```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y \
    gconf2 \
    gconf-service \
    libnotify4 \
    libappindicator1 \
    libxtst6 \
    libnss3 \
    pulseaudio

# CentOS/RHEL/Fedora
sudo yum install -y \
    GConf2 \
    libnotify \
    libappindicator \
    libXtst \
    nss \
    pulseaudio
```

### Audio System

Ensure PulseAudio is running:
```bash
# Check if PulseAudio is running
pulseaudio --check

# Start PulseAudio if not running
pulseaudio --start
```

### Desktop Integration

The .deb package automatically creates:
- Desktop entry in applications menu
- MIME type associations
- Icon in system theme

For manual installation:
```bash
# Make executable
chmod +x interview-assistant

# Create desktop entry
cat > ~/.local/share/applications/interview-assistant.desktop << EOF
[Desktop Entry]
Name=Interview Assistant
Comment=AI-powered interview assistance
Exec=/path/to/interview-assistant
Icon=interview-assistant
Terminal=false
Type=Application
Categories=Utility;Office;Education;
EOF
```

## Audio Configuration

### Blackhole Audio Driver (macOS)

For advanced audio features, install Blackhole to capture system audio:

#### Installation Steps

1. **Download Blackhole**:
   ```bash
   # Using Homebrew (recommended)
   brew install blackhole-2ch
   
   # Or download from: https://github.com/ExistentialAudio/BlackHole
   ```

2. **Install the Package**:
   - Download `BlackHole.2ch.pkg`
   - Double-click to install
   - Follow the installation wizard
   - Restart your Mac

3. **Configure Audio MIDI Setup**:
   - Open **Audio MIDI Setup** (Applications → Utilities)
   - Click the **+** button and select **Create Multi-Output Device**
   - Name it "Interview Assistant Output"
   - Check both your speakers/headphones and **BlackHole 2ch**
   - Set as default output device when using Interview Assistant

4. **Configure Interview Assistant**:
   - Launch Interview Assistant
   - Go to Settings → Audio
   - Select **BlackHole 2ch** as the system audio input
   - Select your microphone as the microphone input

#### Alternative: SoundFlower (Legacy)

If you prefer SoundFlower:
```bash
# Install via Homebrew
brew install soundflower

# Or download from: https://github.com/mattingalls/Soundflower
```

### Windows Audio Configuration

#### Virtual Audio Cable

For system audio capture on Windows:

1. **Install VB-Audio Virtual Cable**:
   - Download from: https://vb-audio.com/Cable/
   - Run as administrator and install
   - Restart your computer

2. **Configure Audio**:
   - Right-click the speaker icon in system tray
   - Select **Open Sound settings**
   - Set **CABLE Input** as default playback device
   - Set **CABLE Output** as default recording device
   - Configure Interview Assistant to use CABLE Output

#### Alternative: Voicemeeter

For advanced audio routing:
1. Download Voicemeeter from: https://vb-audio.com/Voicemeeter/
2. Install and configure virtual audio routing
3. Set up Interview Assistant to capture from Voicemeeter

### Linux Audio Configuration

#### PulseAudio Virtual Sink

Create a virtual audio sink for system audio capture:

```bash
# Create virtual sink
pactl load-module module-null-sink sink_name=interview_sink sink_properties=device.description="Interview Assistant Sink"

# Create loopback from default sink to virtual sink
pactl load-module module-loopback source=interview_sink.monitor sink=@DEFAULT_SINK@

# Set virtual sink as default
pactl set-default-sink interview_sink
```

#### JACK Audio (Advanced)

For professional audio setups:
```bash
# Install JACK
sudo apt-get install jackd2 qjackctl

# Configure JACK for low-latency audio routing
# Use QjackCtl for graphical configuration
```

## API Key Configuration

### OpenAI API Key Setup

1. **Obtain API Key**:
   - Visit https://platform.openai.com/api-keys
   - Sign in or create an account
   - Click **Create new secret key**
   - Copy the key (starts with `sk-`)

2. **Configure in Interview Assistant**:
   - Launch Interview Assistant
   - Press `G` to open the main window
   - Click **Settings**
   - Go to **API Configuration** tab
   - Paste your API key in the **OpenAI API Key** field
   - Click **Test Connection** to verify
   - Click **Save**

3. **Security Best Practices**:
   - Never share your API key
   - Use environment variables for additional security:
     ```bash
     export OPENAI_API_KEY="your-api-key-here"
     ```
   - Monitor your API usage at https://platform.openai.com/usage

### Alternative AI Providers

Interview Assistant supports multiple AI providers:

#### Anthropic Claude
1. Get API key from: https://console.anthropic.com/
2. Configure in Settings → API Configuration → Claude API Key

#### Azure OpenAI
1. Set up Azure OpenAI resource
2. Configure endpoint and key in Settings → API Configuration → Azure OpenAI

#### Local AI Models
For privacy-conscious users:
1. Install Ollama: https://ollama.ai/
2. Configure local endpoint in Settings → API Configuration → Local AI

## First Run Setup

### Initial Configuration Wizard

On first launch, Interview Assistant will guide you through:

1. **Welcome Screen**: Overview of features and capabilities
2. **Permissions Setup**: Grant required system permissions
3. **Audio Configuration**: Set up microphone and system audio
4. **API Key Setup**: Configure your AI provider
5. **Hotkey Configuration**: Set up global hotkeys (default: G/H)
6. **Stealth Settings**: Configure stealth mode preferences

### Creating Your First Session

1. **Launch Interview Assistant**: Press `G` or click the app icon
2. **Select Profession**: Choose your field (Software Engineer, Data Scientist, etc.)
3. **Choose Interview Type**: Technical, Behavioral, System Design, etc.
4. **Start Session**: Click **Start Session** to begin
5. **Use Features**:
   - Press `H` to toggle session window
   - Use toolbar buttons for screenshots, audio, RAG, etc.
   - Chat with AI for assistance

### Customizing Prompts

1. **Open Settings**: Click Settings in main window
2. **Go to Prompt Library**: Select the Prompt Library tab
3. **Edit Prompts**: Customize prompts for your specific needs
4. **Add Personas**: Create custom profession/interview combinations
5. **Save Changes**: Click Save to apply your customizations

## Troubleshooting

### Common Issues

#### App Won't Launch

**macOS**:
```bash
# Check if app is quarantined
xattr -l "/Applications/Interview Assistant.app"

# Remove quarantine if present
sudo xattr -rd com.apple.quarantine "/Applications/Interview Assistant.app"

# Check permissions
ls -la "/Applications/Interview Assistant.app"
```

**Windows**:
- Run as administrator
- Check Windows Defender exclusions
- Verify .NET Framework is installed

**Linux**:
```bash
# Check executable permissions
chmod +x interview-assistant

# Check dependencies
ldd interview-assistant

# Check for missing libraries
sudo apt-get install -f
```

#### Permissions Not Working

**macOS**:
1. Reset permissions:
   ```bash
   sudo tccutil reset ScreenCapture com.interviewassistant.app
   sudo tccutil reset Microphone com.interviewassistant.app
   sudo tccutil reset Accessibility com.interviewassistant.app
   ```
2. Restart Interview Assistant
3. Grant permissions when prompted

**Windows**:
- Check Windows Privacy settings
- Ensure microphone/camera access is enabled for desktop apps

#### Audio Issues

**No System Audio Capture**:
1. Verify virtual audio driver installation
2. Check audio routing configuration
3. Test with other audio applications
4. Restart audio services:
   ```bash
   # macOS
   sudo killall coreaudiod
   
   # Windows
   net stop audiosrv && net start audiosrv
   
   # Linux
   pulseaudio -k && pulseaudio --start
   ```

**Microphone Not Working**:
1. Check microphone permissions
2. Test microphone in other applications
3. Verify correct input device selection
4. Check audio levels and gain settings

#### OCR Not Working

**Screen Capture Issues**:
1. Grant Screen Recording permission (macOS)
2. Check if other screen capture apps are running
3. Verify display scaling settings
4. Test with different window capture modes

**Poor OCR Accuracy**:
1. Ensure good screen resolution
2. Check text contrast and clarity
3. Try different capture regions
4. Update Tesseract language data

#### API Connection Issues

**OpenAI API Errors**:
1. Verify API key is correct and active
2. Check API usage limits and billing
3. Test API key with curl:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        https://api.openai.com/v1/models
   ```
4. Check network connectivity and firewall settings

**Rate Limiting**:
- Reduce request frequency
- Upgrade API plan if needed
- Implement request queuing

#### Performance Issues

**High Memory Usage**:
1. Close unused sessions
2. Clear application cache
3. Restart the application
4. Check for memory leaks in logs

**Slow Response Times**:
1. Check internet connection speed
2. Verify API service status
3. Reduce image resolution for OCR
4. Optimize prompt length

### Getting Help

#### Log Files

**macOS**:
```bash
# Application logs
~/Library/Logs/Interview Assistant/

# System logs
log show --predicate 'process == "Interview Assistant"' --last 1h
```

**Windows**:
```
# Application logs
%APPDATA%\Interview Assistant\logs\

# Event Viewer
eventvwr.msc → Windows Logs → Application
```

**Linux**:
```bash
# Application logs
~/.local/share/interview-assistant/logs/

# System logs
journalctl -u interview-assistant --since "1 hour ago"
```

#### Support Channels

1. **GitHub Issues**: https://github.com/interview-assistant/app/issues
2. **Documentation**: https://docs.interviewassistant.com
3. **Community Forum**: https://community.interviewassistant.com
4. **Email Support**: support@interviewassistant.com

#### Before Reporting Issues

Please include:
1. Operating system and version
2. Interview Assistant version
3. Steps to reproduce the issue
4. Error messages or logs
5. Screenshots if applicable

### Advanced Configuration

#### Environment Variables

```bash
# API Configuration
export OPENAI_API_KEY="your-key"
export INTERVIEW_ASSISTANT_LOG_LEVEL="debug"
export INTERVIEW_ASSISTANT_DATA_DIR="/custom/path"

# Performance Tuning
export INTERVIEW_ASSISTANT_MAX_MEMORY="2048"
export INTERVIEW_ASSISTANT_OCR_TIMEOUT="5000"
export INTERVIEW_ASSISTANT_AUDIO_BUFFER_SIZE="4096"
```

#### Configuration Files

**macOS**: `~/Library/Application Support/Interview Assistant/`
**Windows**: `%APPDATA%\Interview Assistant\`
**Linux**: `~/.config/interview-assistant/`

Key configuration files:
- `config.json`: Main application settings
- `prompts.json`: Custom prompt templates
- `sessions.json`: Session history and data
- `preferences.json`: User preferences

#### Command Line Options

```bash
# Debug mode
interview-assistant --debug

# Custom data directory
interview-assistant --data-dir="/custom/path"

# Disable stealth mode
interview-assistant --no-stealth

# Custom log level
interview-assistant --log-level=verbose
```

---

## Security and Privacy

### Data Handling
- All sensitive data is encrypted at rest
- API keys are stored securely in system keychain
- Session data is isolated and can be deleted
- No data is transmitted without explicit user action

### Network Security
- All API communications use HTTPS/TLS
- Certificate pinning for enhanced security
- Optional proxy support for corporate environments

### Stealth Features
- Process name masquerading
- Hidden dock/taskbar presence
- Minimal system footprint
- Configurable hotkeys for discrete access

---

**Need more help?** Visit our [comprehensive documentation](https://docs.interviewassistant.com) or [contact support](mailto:support@interviewassistant.com).