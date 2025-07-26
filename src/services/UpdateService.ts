import { app, dialog, shell } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { EventEmitter } from 'events';
import { ConfigurationManager } from './ConfigurationManager';
import { EncryptionService } from './EncryptionService';
import { ErrorHandler } from './ErrorHandler';

export interface UpdateInfo {
  version: string;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  signature: string;
  size: number;
}

export interface UpdateProgress {
  percent: number;
  bytesPerSecond: number;
  total: number;
  transferred: number;
}

export interface BackupInfo {
  version: string;
  timestamp: string;
  configPath: string;
  dataPath: string;
  size: number;
}

export class UpdateService extends EventEmitter {
  private configManager: ConfigurationManager;
  private encryptionService: EncryptionService;
  private errorHandler: ErrorHandler;
  private updateCheckInterval: NodeJS.Timeout | null = null;
  private backupDir: string;
  private currentVersion: string;

  constructor(
    configManager: ConfigurationManager,
    encryptionService: EncryptionService,
    errorHandler: ErrorHandler
  ) {
    super();
    this.configManager = configManager;
    this.encryptionService = encryptionService;
    this.errorHandler = errorHandler;
    this.currentVersion = app.getVersion();
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    
    this.initializeUpdater();
    this.setupEventHandlers();
  }

  private initializeUpdater(): void {
    // Configure auto-updater
    autoUpdater.autoDownload = false;
    autoUpdater.autoInstallOnAppQuit = false;
    
    // Set update server URL
    const config = this.configManager.getConfig();
    if (config.updateServer) {
      autoUpdater.setFeedURL({
        provider: 'github',
        owner: 'interview-assistant',
        repo: 'app',
        private: false
      });
    }

    // Enable signature verification
    autoUpdater.verifySignature = true;
    
    // Set update check interval (24 hours)
    const checkInterval = config.updateCheckInterval || 24 * 60 * 60 * 1000;
    this.scheduleUpdateCheck(checkInterval);
  }

  private setupEventHandlers(): void {
    autoUpdater.on('checking-for-update', () => {
      console.log('Checking for updates...');
      this.emit('checking-for-update');
    });

    autoUpdater.on('update-available', (info) => {
      console.log('Update available:', info.version);
      this.emit('update-available', this.formatUpdateInfo(info));
    });

    autoUpdater.on('update-not-available', (info) => {
      console.log('Update not available');
      this.emit('update-not-available', info);
    });

    autoUpdater.on('error', (error) => {
      console.error('Update error:', error);
      this.errorHandler.handleError(error, 'UpdateService', 'Auto-updater error');
      this.emit('error', error);
    });

    autoUpdater.on('download-progress', (progress) => {
      const updateProgress: UpdateProgress = {
        percent: progress.percent,
        bytesPerSecond: progress.bytesPerSecond,
        total: progress.total,
        transferred: progress.transferred
      };
      this.emit('download-progress', updateProgress);
    });

    autoUpdater.on('update-downloaded', (info) => {
      console.log('Update downloaded:', info.version);
      this.emit('update-downloaded', this.formatUpdateInfo(info));
    });
  }

  private formatUpdateInfo(info: any): UpdateInfo {
    return {
      version: info.version,
      releaseDate: info.releaseDate,
      releaseNotes: info.releaseNotes || '',
      downloadUrl: info.downloadUrl || '',
      signature: info.signature || '',
      size: info.size || 0
    };
  }

  public async checkForUpdates(): Promise<UpdateInfo | null> {
    try {
      console.log('Manually checking for updates...');
      const result = await autoUpdater.checkForUpdates();
      
      if (result && result.updateInfo) {
        return this.formatUpdateInfo(result.updateInfo);
      }
      
      return null;
    } catch (error) {
      this.errorHandler.handleError(error, 'UpdateService', 'Failed to check for updates');
      throw error;
    }
  }

  public async downloadUpdate(): Promise<void> {
    try {
      console.log('Starting update download...');
      await autoUpdater.downloadUpdate();
    } catch (error) {
      this.errorHandler.handleError(error, 'UpdateService', 'Failed to download update');
      throw error;
    }
  }

  public async installUpdate(): Promise<void> {
    try {
      // Create backup before installing update
      await this.createBackup();
      
      console.log('Installing update...');
      autoUpdater.quitAndInstall(false, true);
    } catch (error) {
      this.errorHandler.handleError(error, 'UpdateService', 'Failed to install update');
      throw error;
    }
  }

  public async createBackup(): Promise<BackupInfo> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${this.currentVersion}-${timestamp}`;
      const backupPath = path.join(this.backupDir, backupName);

      // Ensure backup directory exists
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }

      // Create backup directory
      fs.mkdirSync(backupPath, { recursive: true });

      // Backup configuration
      const configPath = path.join(backupPath, 'config');
      fs.mkdirSync(configPath, { recursive: true });
      await this.backupConfiguration(configPath);

      // Backup user data
      const dataPath = path.join(backupPath, 'data');
      fs.mkdirSync(dataPath, { recursive: true });
      await this.backupUserData(dataPath);

      // Create backup manifest
      const manifest = {
        version: this.currentVersion,
        timestamp: new Date().toISOString(),
        configPath: configPath,
        dataPath: dataPath,
        files: await this.getBackupFileList(backupPath)
      };

      const manifestPath = path.join(backupPath, 'manifest.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

      // Calculate backup size
      const size = await this.calculateDirectorySize(backupPath);

      const backupInfo: BackupInfo = {
        version: this.currentVersion,
        timestamp: manifest.timestamp,
        configPath: configPath,
        dataPath: dataPath,
        size: size
      };

      console.log(`Backup created: ${backupPath} (${Math.round(size / 1024 / 1024)}MB)`);
      this.emit('backup-created', backupInfo);

      return backupInfo;
    } catch (error) {
      this.errorHandler.handleError(error, 'UpdateService', 'Failed to create backup');
      throw error;
    }
  }

  private async backupConfiguration(backupPath: string): Promise<void> {
    const userDataPath = app.getPath('userData');
    const configFiles = [
      'config.json',
      'prompts.json',
      'sessions.json',
      'preferences.json'
    ];

    for (const file of configFiles) {
      const sourcePath = path.join(userDataPath, file);
      const destPath = path.join(backupPath, file);

      if (fs.existsSync(sourcePath)) {
        // Encrypt sensitive configuration files
        if (file === 'config.json' || file === 'sessions.json') {
          const data = fs.readFileSync(sourcePath, 'utf8');
          const encrypted = await this.encryptionService.encrypt(data);
          fs.writeFileSync(destPath + '.encrypted', encrypted);
        } else {
          fs.copyFileSync(sourcePath, destPath);
        }
      }
    }
  }

  private async backupUserData(backupPath: string): Promise<void> {
    const userDataPath = app.getPath('userData');
    const dataDirectories = [
      'rag-documents',
      'audio-cache',
      'ocr-cache',
      'logs'
    ];

    for (const dir of dataDirectories) {
      const sourcePath = path.join(userDataPath, dir);
      const destPath = path.join(backupPath, dir);

      if (fs.existsSync(sourcePath)) {
        await this.copyDirectory(sourcePath, destPath);
      }
    }
  }

  private async copyDirectory(source: string, destination: string): Promise<void> {
    if (!fs.existsSync(destination)) {
      fs.mkdirSync(destination, { recursive: true });
    }

    const items = fs.readdirSync(source);
    for (const item of items) {
      const sourcePath = path.join(source, item);
      const destPath = path.join(destination, item);
      const stat = fs.statSync(sourcePath);

      if (stat.isDirectory()) {
        await this.copyDirectory(sourcePath, destPath);
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
  }

  private async getBackupFileList(backupPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const walkDir = (dir: string) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const relativePath = path.relative(backupPath, fullPath);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else {
          files.push(relativePath);
        }
      }
    };

    walkDir(backupPath);
    return files;
  }

  private async calculateDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    
    const walkDir = (dir: string) => {
      const items = fs.readdirSync(dir);
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          walkDir(fullPath);
        } else {
          size += stat.size;
        }
      }
    };

    walkDir(dirPath);
    return size;
  }

  public async restoreBackup(backupPath: string): Promise<void> {
    try {
      const manifestPath = path.join(backupPath, 'manifest.json');
      if (!fs.existsSync(manifestPath)) {
        throw new Error('Invalid backup: manifest.json not found');
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      console.log(`Restoring backup from version ${manifest.version}`);

      // Restore configuration
      await this.restoreConfiguration(manifest.configPath);

      // Restore user data
      await this.restoreUserData(manifest.dataPath);

      console.log('Backup restored successfully');
      this.emit('backup-restored', manifest);

      // Restart application to apply restored configuration
      app.relaunch();
      app.exit(0);
    } catch (error) {
      this.errorHandler.handleError(error, 'UpdateService', 'Failed to restore backup');
      throw error;
    }
  }

  private async restoreConfiguration(backupConfigPath: string): Promise<void> {
    const userDataPath = app.getPath('userData');
    
    if (!fs.existsSync(backupConfigPath)) {
      return;
    }

    const files = fs.readdirSync(backupConfigPath);
    for (const file of files) {
      const sourcePath = path.join(backupConfigPath, file);
      const destPath = path.join(userDataPath, file.replace('.encrypted', ''));

      if (file.endsWith('.encrypted')) {
        // Decrypt encrypted files
        const encrypted = fs.readFileSync(sourcePath, 'utf8');
        const decrypted = await this.encryptionService.decrypt(encrypted);
        fs.writeFileSync(destPath, decrypted);
      } else {
        fs.copyFileSync(sourcePath, destPath);
      }
    }
  }

  private async restoreUserData(backupDataPath: string): Promise<void> {
    const userDataPath = app.getPath('userData');
    
    if (!fs.existsSync(backupDataPath)) {
      return;
    }

    const directories = fs.readdirSync(backupDataPath);
    for (const dir of directories) {
      const sourcePath = path.join(backupDataPath, dir);
      const destPath = path.join(userDataPath, dir);

      if (fs.statSync(sourcePath).isDirectory()) {
        // Remove existing directory if it exists
        if (fs.existsSync(destPath)) {
          fs.rmSync(destPath, { recursive: true, force: true });
        }
        
        await this.copyDirectory(sourcePath, destPath);
      }
    }
  }

  public async migrateConfiguration(fromVersion: string, toVersion: string): Promise<void> {
    try {
      console.log(`Migrating configuration from ${fromVersion} to ${toVersion}`);

      // Load current configuration
      const config = this.configManager.getConfig();
      
      // Apply version-specific migrations
      const migratedConfig = await this.applyMigrations(config, fromVersion, toVersion);
      
      // Save migrated configuration
      await this.configManager.saveConfig(migratedConfig);
      
      console.log('Configuration migration completed');
      this.emit('migration-completed', { fromVersion, toVersion });
    } catch (error) {
      this.errorHandler.handleError(error, 'UpdateService', 'Configuration migration failed');
      throw error;
    }
  }

  private async applyMigrations(config: any, fromVersion: string, toVersion: string): Promise<any> {
    const migrations = this.getMigrations();
    let migratedConfig = { ...config };

    // Apply migrations in order
    for (const migration of migrations) {
      if (this.shouldApplyMigration(migration.version, fromVersion, toVersion)) {
        console.log(`Applying migration: ${migration.version}`);
        migratedConfig = await migration.migrate(migratedConfig);
      }
    }

    // Update version in config
    migratedConfig.version = toVersion;
    migratedConfig.lastMigration = new Date().toISOString();

    return migratedConfig;
  }

  private getMigrations() {
    return [
      {
        version: '1.0.1',
        migrate: async (config: any) => {
          // Example migration: Add new default settings
          if (!config.features) {
            config.features = {
              autoUpdate: true,
              telemetry: false,
              betaFeatures: false
            };
          }
          return config;
        }
      },
      {
        version: '1.1.0',
        migrate: async (config: any) => {
          // Example migration: Restructure prompt library
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
      // Add more migrations as needed
    ];
  }

  private shouldApplyMigration(migrationVersion: string, fromVersion: string, toVersion: string): boolean {
    // Simple version comparison (assumes semantic versioning)
    const compareVersions = (v1: string, v2: string): number => {
      const parts1 = v1.split('.').map(Number);
      const parts2 = v2.split('.').map(Number);
      
      for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const part1 = parts1[i] || 0;
        const part2 = parts2[i] || 0;
        
        if (part1 < part2) return -1;
        if (part1 > part2) return 1;
      }
      return 0;
    };

    return compareVersions(migrationVersion, fromVersion) > 0 && 
           compareVersions(migrationVersion, toVersion) <= 0;
  }

  public getAvailableBackups(): BackupInfo[] {
    try {
      if (!fs.existsSync(this.backupDir)) {
        return [];
      }

      const backups: BackupInfo[] = [];
      const backupDirs = fs.readdirSync(this.backupDir);

      for (const dir of backupDirs) {
        const backupPath = path.join(this.backupDir, dir);
        const manifestPath = path.join(backupPath, 'manifest.json');

        if (fs.existsSync(manifestPath)) {
          try {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
            backups.push({
              version: manifest.version,
              timestamp: manifest.timestamp,
              configPath: manifest.configPath,
              dataPath: manifest.dataPath,
              size: this.calculateDirectorySize(backupPath)
            });
          } catch (error) {
            console.warn(`Invalid backup manifest: ${manifestPath}`);
          }
        }
      }

      // Sort by timestamp (newest first)
      return backups.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    } catch (error) {
      this.errorHandler.handleError(error, 'UpdateService', 'Failed to get available backups');
      return [];
    }
  }

  public async cleanupOldBackups(maxBackups: number = 5): Promise<void> {
    try {
      const backups = this.getAvailableBackups();
      
      if (backups.length <= maxBackups) {
        return;
      }

      const backupsToDelete = backups.slice(maxBackups);
      
      for (const backup of backupsToDelete) {
        const backupPath = path.dirname(backup.configPath);
        if (fs.existsSync(backupPath)) {
          fs.rmSync(backupPath, { recursive: true, force: true });
          console.log(`Deleted old backup: ${backup.version} (${backup.timestamp})`);
        }
      }

      this.emit('backups-cleaned', { deleted: backupsToDelete.length });
    } catch (error) {
      this.errorHandler.handleError(error, 'UpdateService', 'Failed to cleanup old backups');
    }
  }

  private scheduleUpdateCheck(interval: number): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    this.updateCheckInterval = setInterval(async () => {
      try {
        await this.checkForUpdates();
      } catch (error) {
        console.warn('Scheduled update check failed:', error.message);
      }
    }, interval);
  }

  public async showUpdateDialog(updateInfo: UpdateInfo): Promise<boolean> {
    const result = await dialog.showMessageBox({
      type: 'info',
      title: 'Update Available',
      message: `A new version (${updateInfo.version}) is available!`,
      detail: `Current version: ${this.currentVersion}\nNew version: ${updateInfo.version}\n\nRelease notes:\n${updateInfo.releaseNotes}`,
      buttons: ['Download and Install', 'Download Later', 'Skip This Version'],
      defaultId: 0,
      cancelId: 2
    });

    return result.response === 0;
  }

  public dispose(): void {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
    }
    
    this.removeAllListeners();
  }
}