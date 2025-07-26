# Interview Assistant - Troubleshooting Guide

This guide provides detailed solutions for common issues you might encounter with Interview Assistant.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Permission Problems](#permission-problems)
3. [Audio Configuration Issues](#audio-configuration-issues)
4. [OCR and Screenshot Problems](#ocr-and-screenshot-problems)
5. [API and Network Issues](#api-and-network-issues)
6. [Performance Problems](#performance-problems)
7. [Getting Support](#getting-support)

## Installation Issues

### macOS Installation Problems

#### "App is damaged and can't be opened"
**Cause**: Gatekeeper security feature blocking unsigned or quarantined apps.

**Solution**:
```bash
# Remove quarantine attribute
sudo xattr -rd com.apple.quarantine "/Applications/Interview Assistant.app"

# Alternative: Allow in System Preferences
# System Preferences → Security & Privacy → General → "Open Anyway"
```

#### "Cannot verify developer" warning
**Solution**:
1. Right-click the app and select **Open**
2. Click **Open** in the security dialog
3. Or use Terminal:
   ```bash
   sudo spctl --master-disable  # Temporarily disable Gatekeeper
   # Launch the app, then re-enable:
   sudo spctl --master-enable
   ```

### Windows Installation Problems

#### "Windows protected your PC" warning
**Solution**:
1. Click **More info** in the warning dialog
2. Click **Run anyway**
3. Or disable SmartScreen temporarily in Windows Security settings

#### Antivirus blocking installation
**Solution**:
```powershell
# Windows Defender exclusion
Add-MpPreference -ExclusionPath "C:\Program Files\Interview Assistant"
```

### Linux Installation Problems

#### Package dependency errors
**Solution**:
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -f  # Fix broken dependencies

# Install missing dependencies
sudo apt-get install gconf2 gconf-service libnotify4 libappindicator1 libxtst6 libnss3
```

## Permission Problems

### macOS Permission Issues

#### Screen Recording permission not working
**Solution**:
```bash
# Reset TCC database
sudo tccutil reset ScreenCapture com.interviewassistant.app

# Manual permission grant:
# System Preferences → Security & Privacy → Privacy → Screen Recording
# Add Interview Assistant and restart the app
```

#### Microphone access denied
**Solution**:
```bash
# Reset microphone permissions
sudo tccutil reset Microphone com.interviewassistant.app

# Grant permission in System Preferences → Security & Privacy → Privacy → Microphone
```

#### Accessibility permission issues
**Solution**:
1. System Preferences → Security & Privacy → Privacy → Accessibility
2. Click lock icon, enter password
3. Add Interview Assistant
4. If still not working:
   ```bash
   sudo tccutil reset Accessibility com.interviewassistant.app
   ```

## Audio Configuration Issues

### Blackhole Audio Driver Issues (macOS)

#### Blackhole not appearing in audio devices
**Solution**:
```bash
# Reinstall Blackhole
brew uninstall blackhole-2ch
brew install blackhole-2ch

# Restart Core Audio
sudo killall coreaudiod
```

#### No system audio being captured
**Solution**:
1. Create Multi-Output Device in Audio MIDI Setup
2. Select both your speakers and BlackHole 2ch
3. Set as default output
4. Configure Interview Assistant:
   - Settings → Audio → System Audio Input → BlackHole 2ch

### Windows Audio Issues

#### Virtual Audio Cable not working
**Solution**:
1. Reinstall VB-Audio Cable as administrator
2. Configure Windows Audio:
   - Set CABLE Input as default playback
   - Set CABLE Output as default recording

### Linux Audio Issues

#### PulseAudio configuration problems
**Solution**:
```bash
# Restart PulseAudio
pulseaudio -k
pulseaudio --start

# Create virtual audio sink
pactl load-module module-null-sink sink_name=interview_sink
pactl load-module module-loopback source=interview_sink.monitor sink=@DEFAULT_SINK@
```

## OCR and Screenshot Problems

### Screenshot Capture Issues

#### Blank or black screenshots
**macOS Solution**:
```bash
# Check screen recording permission
sudo tccutil reset ScreenCapture com.interviewassistant.app
```

**Windows Solution**:
- Right-click app → Properties → Compatibility → "Override high DPI scaling behavior"

#### OCR accuracy problems
**Solution**:
1. Settings → OCR → Image Enhancement → Enable
2. Update Tesseract:
   ```bash
   # macOS
   brew upgrade tesseract
   
   # Ubuntu/Debian
   sudo apt-get upgrade tesseract-ocr
   ```

## API and Network Issues

### OpenAI API Problems

#### API key authentication failures
**Solution**:
1. Test API key manually:
   ```bash
   curl -H "Authorization: Bearer YOUR_API_KEY" \
        https://api.openai.com/v1/models
   ```
2. Verify API key in Settings → API Configuration
3. Check usage limits and billing status

#### Rate limiting issues
**Solution**:
1. Check OpenAI usage dashboard
2. Settings → API Configuration → Request Delay → 1000ms
3. Consider upgrading API plan

#### Network connectivity issues
**Solution**:
```bash
# Test connectivity
ping api.openai.com
curl -I https://api.openai.com/v1/models

# Configure firewall
# macOS
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add "/Applications/Interview Assistant.app"

# Windows
netsh advfirewall firewall add rule name="Interview Assistant" dir=out action=allow program="C:\Program Files\Interview Assistant\Interview Assistant.exe"
```

## Performance Problems

### High Memory Usage

#### Memory leaks
**Solution**:
1. Settings → Advanced → Clear Cache
2. Settings → Sessions → History Limit → 10 sessions
3. Restart application

#### High CPU usage
**Solution**:
1. Settings → Performance → Monitoring Interval → 10 seconds
2. Settings → OCR → Processing Threads → 2
3. Settings → Audio → Buffer Size → 1024 samples

### Slow Response Times

#### API response delays
**Solution**:
1. Check internet speed
2. Optimize prompts (reduce length)
3. Settings → OCR → Fast Mode → Enable

## Getting Support

### Information to Include

When reporting issues:

1. **System Information**:
   - Operating system and version
   - Interview Assistant version
   - Hardware specifications

2. **Problem Description**:
   - Exact steps to reproduce
   - Expected vs actual behavior
   - Error messages
   - Screenshots

3. **Log Files**:
   ```bash
   # macOS
   ~/Library/Logs/Interview Assistant/
   
   # Windows
   %APPDATA%\Interview Assistant\logs\
   
   # Linux
   ~/.local/share/interview-assistant/logs/
   ```

### Support Channels

1. **GitHub Issues**: https://github.com/interview-assistant/app/issues
2. **Community Forum**: https://community.interviewassistant.com
3. **Email Support**: support@interviewassistant.com
4. **Documentation**: https://docs.interviewassistant.com

### Emergency Recovery

#### Complete reset (last resort)
```bash
# Backup user data first
cp -r ~/Library/Application\ Support/Interview\ Assistant/ ~/Desktop/backup/

# Remove all application data
rm -rf ~/Library/Application\ Support/Interview\ Assistant/
rm -rf ~/Library/Caches/com.interviewassistant.app/

# Reinstall application
```

---

**Still having issues?** Contact our support team at support@interviewassistant.com