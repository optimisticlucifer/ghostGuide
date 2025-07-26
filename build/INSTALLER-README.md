# Application Installer System

This directory contains the complete installer system for the Interview Assistant application, providing cross-platform distribution capabilities with security features and automated testing.

## Overview

The installer system supports:
- **Windows**: NSIS-based EXE and MSI installers
- **macOS**: Code-signed DMG packages with notarization
- **Linux**: Debian packages (.deb) and AppImage
- **Portable**: ZIP/TAR.GZ archives for all platforms
- **Security**: Code signing, checksums, and integrity verification
- **Automation**: Full build pipeline with testing and validation

## Quick Start

### Build All Installers
```bash
npm run release
```
This runs the complete pipeline: build → package → create installers → test → validate

### Individual Commands
```bash
# Clean previous builds
npm run build:clean

# Build application only
npm run build:app

# Create installers for all platforms
npm run installer:all

# Test installer integrity
npm run test:installers

# Create release package
npm run release:create
```

## File Structure

```
build/
├── installer-config.js       # Main installer builder
├── build-scripts.js          # Build automation
├── release-automation.js     # Release management
├── test-installers.js        # Installer testing
├── windows-installer.nsi     # Windows NSIS script
├── entitlements.plist        # macOS entitlements
├── electron-builder.json     # Electron Builder config
└── INSTALLER-README.md       # This file

Generated Output:
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
├── CHECKSUMS.json            # Detailed checksums
├── checksums.txt             # Simple checksum format
└── test-report.json          # Test results
```

## Platform-Specific Features

### Windows
- **NSIS Installer**: Full GUI installer with options
- **MSI Package**: Enterprise deployment support
- **Code Signing**: Authenticode signatures with timestamping
- **Registry Integration**: Proper Windows integration
- **Uninstaller**: Clean removal with registry cleanup

### macOS
- **DMG Package**: Standard macOS distribution format
- **Code Signing**: Developer ID Application certificate
- **Notarization**: Apple notarization for Gatekeeper
- **Entitlements**: Proper permissions for stealth features
- **Bundle Configuration**: Correct app bundle structure

### Linux
- **Debian Package**: Standard .deb for Ubuntu/Debian
- **Dependencies**: Automatic dependency resolution
- **Desktop Integration**: Menu entries and file associations
- **System Integration**: Proper Linux app installation

### Portable
- **No Installation**: Run directly from extracted folder
- **Cross-Platform**: Works on all supported platforms
- **Self-Contained**: All dependencies included
- **README Included**: Setup instructions in each archive

## Security Features

### Code Signing
- **Windows**: Authenticode signing with timestamp server
- **macOS**: Developer ID signing with hardened runtime
- **Verification**: Automatic signature validation

### Integrity Verification
- **SHA256/SHA512**: Dual hash algorithms
- **Checksum Files**: Both JSON and text formats
- **Automated Testing**: Integrity verification in CI/CD

### Build Security
- **Clean Environment**: Isolated build processes
- **Dependency Verification**: Package integrity checks
- **Secure Distribution**: HTTPS-only download links

## Environment Variables

### Required for Signing
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

### Optional
```bash
# Custom build settings
export BUILD_NUMBER="123"
export RELEASE_CHANNEL="stable"
export SKIP_NOTARIZATION="true"  # Skip macOS notarization
```

## Testing

### Automated Tests
The installer system includes comprehensive testing:

```bash
npm run test:installers
```

Tests include:
- **File Integrity**: Verify all expected files exist
- **Size Validation**: Check installer sizes are reasonable
- **Format Verification**: Validate file formats (PE, DMG, DEB, etc.)
- **Checksum Validation**: Verify all checksums match
- **Platform Compatibility**: Basic compatibility checks

### Manual Testing
1. **Installation Testing**: Install on target platforms
2. **Functionality Testing**: Verify app works after installation
3. **Uninstall Testing**: Ensure clean removal
4. **Upgrade Testing**: Test version upgrades

## Troubleshooting

### Common Issues

#### Build Failures
```bash
# Clean and rebuild
npm run build:clean
npm install
npm run build:full
```

#### Code Signing Issues
- Verify certificates are valid and not expired
- Check environment variables are set correctly
- Ensure proper keychain access on macOS

#### Size Issues
- Check if native dependencies are properly bundled
- Verify asset optimization is working
- Review included/excluded files in build config

#### Platform-Specific Issues
- **Windows**: Install Visual Studio Build Tools
- **macOS**: Install Xcode Command Line Tools
- **Linux**: Install build-essential package

### Debug Mode
Enable verbose logging:
```bash
DEBUG=electron-builder npm run build:full
```

## CI/CD Integration

### GitHub Actions Example
```yaml
- name: Build and Package
  run: |
    npm ci
    npm run test
    npm run release
  env:
    APPLE_ID: ${{ secrets.APPLE_ID }}
    APPLE_ID_PASSWORD: ${{ secrets.APPLE_ID_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    MACOS_SIGNING_IDENTITY: ${{ secrets.MACOS_SIGNING_IDENTITY }}
    WINDOWS_CERT_FILE: ${{ secrets.WINDOWS_CERT_FILE }}
    WINDOWS_CERT_PASSWORD: ${{ secrets.WINDOWS_CERT_PASSWORD }}
```

### Release Process
1. **Version Bump**: Update package.json version
2. **Build**: Run full build pipeline
3. **Test**: Validate all installers
4. **Tag**: Create git tag
5. **Upload**: Distribute installers
6. **Announce**: Update documentation

## Customization

### Adding New Platforms
1. Add platform-specific builder in `installer-config.js`
2. Update test suite in `test-installers.js`
3. Add platform scripts to package.json
4. Update documentation

### Modifying Installers
- **Windows**: Edit `windows-installer.nsi`
- **macOS**: Update `entitlements.plist` and DMG options
- **Linux**: Modify Debian package configuration
- **All**: Update `electron-builder.json`

## Support

For installer-related issues:
1. Check the troubleshooting section above
2. Review build logs for specific errors
3. Verify environment setup
4. Test on clean systems
5. Open issue with detailed error information

---

**Note**: This installer system is specifically designed for the Interview Assistant application's stealth requirements and cross-platform distribution needs. Modify configurations as needed for different applications.