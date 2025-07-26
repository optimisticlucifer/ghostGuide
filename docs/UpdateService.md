# UpdateService Documentation

The UpdateService provides comprehensive update management, backup creation, and configuration migration capabilities for the Interview Assistant application.

## Overview

The UpdateService extends Node.js EventEmitter and manages:
- Automatic update checking and installation
- Secure backup creation before updates
- Configuration migration between versions
- Rollback capabilities through backup restoration
- Progress tracking and user notifications

## Core Features

### Automatic Updates
- **Signature Verification**: All updates are cryptographically verified
- **Scheduled Checking**: Configurable automatic update checks (default: 24 hours)
- **Download Management**: Controlled download with progress tracking
- **Installation Control**: User-controlled installation timing

### Backup System
- **Pre-Update Backups**: Automatic backup creation before any update
- **Encrypted Storage**: Sensitive configuration files are encrypted in backups
- **Selective Backup**: Separates configuration and user data for granular restoration
- **Cleanup Management**: Automatic cleanup of old backups (configurable retention)

### Configuration Migration
- **Version-Aware Migration**: Applies migrations based on version differences
- **Incremental Updates**: Supports step-by-step migrations through multiple versions
- **Rollback Safety**: Maintains backup compatibility for safe rollbacks

## API Reference

### Constructor

```typescript
constructor(
  configManager: ConfigurationManager,
  encryptionService: EncryptionService,
  errorHandler: ErrorHandler
)
```

Creates a new UpdateService instance with required dependencies.

### Update Management Methods

#### `checkForUpdates(): Promise<UpdateInfo | null>`
Manually checks for available updates.

**Returns:**
- `UpdateInfo` object if update is available
- `null` if no update is available

**Example:**
```typescript
const updateInfo = await updateService.checkForUpdates();
if (updateInfo) {
  console.log(`Update available: ${updateInfo.version}`);
}
```

#### `downloadUpdate(): Promise<void>`
Downloads the available update without installing it.

**Throws:** Error if download fails or no update is available

#### `installUpdate(): Promise<void>`
Installs the downloaded update after creating a backup.

**Process:**
1. Creates automatic backup
2. Installs update
3. Restarts application

### Backup Management Methods

#### `createBackup(): Promise<BackupInfo>`
Creates a complete backup of the current application state.

**Returns:** `BackupInfo` object with backup details

**Backup Structure:**
```
backup-1.0.0-2024-01-15T10-30-00/
├── manifest.json           # Backup metadata
├── config/                 # Configuration files
│   ├── config.json.encrypted
│   ├── sessions.json.encrypted
│   ├── prompts.json
│   └── preferences.json
└── data/                   # User data
    ├── rag-documents/
    ├── audio-cache/
    ├── ocr-cache/
    └── logs/
```

#### `restoreBackup(backupPath: string): Promise<void>`
Restores application state from a backup.

**Parameters:**
- `backupPath`: Path to the backup directory

**Process:**
1. Validates backup integrity
2. Restores configuration files (decrypting as needed)
3. Restores user data
4. Restarts application

#### `getAvailableBackups(): BackupInfo[]`
Returns list of available backups sorted by timestamp (newest first).

#### `cleanupOldBackups(maxBackups: number = 5): Promise<void>`
Removes old backups, keeping only the specified number of recent backups.

### Migration Methods

#### `migrateConfiguration(fromVersion: string, toVersion: string): Promise<void>`
Migrates configuration between versions.

**Parameters:**
- `fromVersion`: Source version
- `toVersion`: Target version

**Process:**
1. Loads current configuration
2. Applies version-specific migrations in order
3. Updates configuration version
4. Saves migrated configuration

### User Interface Methods

#### `showUpdateDialog(updateInfo: UpdateInfo): Promise<boolean>`
Shows update notification dialog to user.

**Returns:** `true` if user chooses to install, `false` otherwise

## Events

The UpdateService emits the following events:

### Update Events
- `checking-for-update`: Update check started
- `update-available`: Update is available (emits `UpdateInfo`)
- `update-not-available`: No update available
- `download-progress`: Download progress (emits `UpdateProgress`)
- `update-downloaded`: Update download completed
- `error`: Update error occurred

### Backup Events
- `backup-created`: Backup creation completed (emits `BackupInfo`)
- `backup-restored`: Backup restoration completed
- `backups-cleaned`: Old backups cleaned up

### Migration Events
- `migration-completed`: Configuration migration finished

## Data Types

### UpdateInfo
```typescript
interface UpdateInfo {
  version: string;        // New version number
  releaseDate: string;    // Release date
  releaseNotes: string;   // Release notes
  downloadUrl: string;    // Download URL
  signature: string;      // Cryptographic signature
  size: number;          // Download size in bytes
}
```

### UpdateProgress
```typescript
interface UpdateProgress {
  percent: number;        // Progress percentage (0-100)
  bytesPerSecond: number; // Download speed
  total: number;          // Total bytes to download
  transferred: number;    // Bytes downloaded so far
}
```

### BackupInfo
```typescript
interface BackupInfo {
  version: string;        // Application version at backup time
  timestamp: string;      // ISO timestamp of backup creation
  configPath: string;     // Path to configuration backup
  dataPath: string;       // Path to user data backup
  size: number;          // Total backup size in bytes
}
```

## Configuration

### Update Server Configuration
```typescript
// In configuration manager
{
  updateServer: {
    provider: 'github',
    owner: 'interview-assistant',
    repo: 'app',
    private: false
  },
  updateCheckInterval: 86400000, // 24 hours in milliseconds
  autoDownload: false,
  autoInstallOnAppQuit: false
}
```

### Backup Configuration
```typescript
{
  maxBackups: 5,           // Maximum number of backups to retain
  backupBeforeUpdate: true, // Create backup before updates
  encryptSensitiveData: true // Encrypt sensitive files in backups
}
```

## Migration System

### Migration Structure
Migrations are defined as objects with version and migrate function:

```typescript
{
  version: '1.1.0',
  migrate: async (config: any) => {
    // Perform migration logic
    if (config.oldProperty) {
      config.newProperty = config.oldProperty;
      delete config.oldProperty;
    }
    return config;
  }
}
```

### Version Comparison
The service uses semantic versioning for migration ordering:
- Migrations are applied in version order
- Only migrations between `fromVersion` and `toVersion` are applied
- Version comparison handles major.minor.patch format

### Example Migrations

#### Version 1.0.1 Migration
```typescript
{
  version: '1.0.1',
  migrate: async (config: any) => {
    // Add new feature flags
    if (!config.features) {
      config.features = {
        autoUpdate: true,
        telemetry: false,
        betaFeatures: false
      };
    }
    return config;
  }
}
```

#### Version 1.1.0 Migration
```typescript
{
  version: '1.1.0',
  migrate: async (config: any) => {
    // Restructure prompt library
    if (config.prompts && !config.promptLibrary) {
      config.promptLibrary = {
        templates: config.prompts,
        version: '1.1.0'
      };
      delete config.prompts;
    }
    return config;
  }
}
```

## Security Considerations

### Update Security
- **Signature Verification**: All updates must have valid cryptographic signatures
- **HTTPS Downloads**: All update downloads use secure connections
- **Integrity Checking**: Downloaded files are verified before installation

### Backup Security
- **Encryption**: Sensitive configuration files are encrypted in backups
- **Access Control**: Backup files have restricted permissions
- **Secure Deletion**: Old backups are securely deleted

### Migration Security
- **Validation**: All migrated configurations are validated before saving
- **Rollback Safety**: Original configuration is preserved until migration succeeds
- **Error Handling**: Migration failures don't corrupt existing configuration

## Error Handling

### Update Errors
- Network connectivity issues
- Invalid signatures
- Download corruption
- Installation failures

### Backup Errors
- Insufficient disk space
- File permission issues
- Encryption failures
- Corruption detection

### Migration Errors
- Invalid configuration format
- Migration script failures
- Version compatibility issues
- Rollback requirements

## Usage Examples

### Basic Update Check
```typescript
const updateService = new UpdateService(configManager, encryptionService, errorHandler);

// Check for updates
const updateInfo = await updateService.checkForUpdates();
if (updateInfo) {
  console.log(`Update ${updateInfo.version} available`);
  
  // Show dialog to user
  const shouldInstall = await updateService.showUpdateDialog(updateInfo);
  
  if (shouldInstall) {
    // Download and install
    await updateService.downloadUpdate();
    await updateService.installUpdate();
  }
}
```

### Manual Backup Creation
```typescript
// Create backup before major operation
const backupInfo = await updateService.createBackup();
console.log(`Backup created: ${backupInfo.version} (${backupInfo.size} bytes)`);

// Later, if needed, restore from backup
await updateService.restoreBackup(backupInfo.configPath);
```

### Event Handling
```typescript
updateService.on('download-progress', (progress) => {
  console.log(`Download: ${progress.percent}% (${progress.bytesPerSecond} B/s)`);
});

updateService.on('backup-created', (backupInfo) => {
  console.log(`Backup created for version ${backupInfo.version}`);
});

updateService.on('error', (error) => {
  console.error('Update service error:', error);
});
```

### Configuration Migration
```typescript
// Migrate from version 1.0.0 to 1.1.0
await updateService.migrateConfiguration('1.0.0', '1.1.0');
console.log('Configuration migrated successfully');
```

## Best Practices

### Update Management
1. **Always create backups** before installing updates
2. **Test updates** in development environment first
3. **Monitor update events** for proper error handling
4. **Validate signatures** for security

### Backup Management
1. **Regular cleanup** of old backups to manage disk space
2. **Verify backup integrity** before relying on them
3. **Test restoration process** periodically
4. **Encrypt sensitive data** in backups

### Migration Development
1. **Test migrations** with various configuration states
2. **Provide rollback mechanisms** for failed migrations
3. **Validate migrated data** thoroughly
4. **Document migration changes** clearly

## Troubleshooting

### Common Issues

#### Update Check Failures
```typescript
// Check network connectivity
// Verify update server configuration
// Check for firewall blocking
```

#### Backup Creation Failures
```typescript
// Check disk space availability
// Verify file permissions
// Ensure encryption service is initialized
```

#### Migration Failures
```typescript
// Validate source configuration format
// Check migration script syntax
// Verify version compatibility
```

### Debugging

Enable detailed logging:
```typescript
// Set environment variable
process.env.DEBUG_UPDATES = 'true';

// Or configure in application
updateService.setDebugMode(true);
```

### Recovery Procedures

#### Failed Update Recovery
1. Stop application
2. Restore from most recent backup
3. Restart application
4. Check logs for failure cause

#### Corrupted Backup Recovery
1. Use previous backup if available
2. Recreate configuration from defaults
3. Restore user data manually if needed

## Integration with Other Services

### ConfigurationManager Integration
- Loads update configuration settings
- Saves migrated configurations
- Provides configuration validation

### EncryptionService Integration
- Encrypts sensitive backup data
- Decrypts restored configuration files
- Provides secure key management

### ErrorHandler Integration
- Reports update errors with context
- Provides user-friendly error messages
- Logs detailed error information

## Performance Considerations

### Update Performance
- **Background Downloads**: Updates download in background
- **Incremental Updates**: Only changed files are downloaded when possible
- **Compression**: Update packages are compressed for faster downloads

### Backup Performance
- **Selective Backup**: Only necessary files are backed up
- **Compression**: Backups are compressed to save space
- **Parallel Processing**: Multiple files processed simultaneously

### Migration Performance
- **Lazy Loading**: Migrations loaded only when needed
- **Batch Processing**: Multiple migrations applied efficiently
- **Memory Management**: Large configurations processed in chunks