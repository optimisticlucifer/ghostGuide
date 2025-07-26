import { UpdateService, UpdateInfo, UpdateProgress, BackupInfo } from '../../src/services/UpdateService';
import { ConfigurationManager } from '../../src/services/ConfigurationManager';
import { EncryptionService } from '../../src/services/EncryptionService';
import { ErrorHandler } from '../../src/services/ErrorHandler';
import { app, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('electron', () => ({
  app: {
    getVersion: jest.fn(() => '1.0.0'),
    getPath: jest.fn((name: string) => `/mock/path/${name}`),
    relaunch: jest.fn(),
    exit: jest.fn()
  },
  dialog: {
    showMessageBox: jest.fn()
  }
}));

jest.mock('electron-updater', () => ({
  autoUpdater: {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    verifySignature: true,
    setFeedURL: jest.fn(),
    on: jest.fn(),
    checkForUpdates: jest.fn(),
    downloadUpdate: jest.fn(),
    quitAndInstall: jest.fn()
  }
}));

jest.mock('fs');
jest.mock('path');

describe('UpdateService', () => {
  let updateService: UpdateService;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;
  let mockEncryptionService: jest.Mocked<EncryptionService>;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock services
    mockConfigManager = {
      getConfig: jest.fn(() => ({
        updateServer: 'https://api.github.com/repos/interview-assistant/app',
        updateCheckInterval: 24 * 60 * 60 * 1000
      })),
      saveConfig: jest.fn()
    } as any;

    mockEncryptionService = {
      encrypt: jest.fn((data: string) => Promise.resolve(`encrypted_${data}`)),
      decrypt: jest.fn((data: string) => Promise.resolve(data.replace('encrypted_', '')))
    } as any;

    mockErrorHandler = {
      handleError: jest.fn()
    } as any;

    // Mock fs methods
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.mkdirSync as jest.Mock).mockImplementation();
    (fs.writeFileSync as jest.Mock).mockImplementation();
    (fs.readFileSync as jest.Mock).mockReturnValue('{}');
    (fs.readdirSync as jest.Mock).mockReturnValue([]);
    (fs.statSync as jest.Mock).mockReturnValue({ size: 1024, isDirectory: () => false });
    (fs.copyFileSync as jest.Mock).mockImplementation();
    (fs.rmSync as jest.Mock).mockImplementation();

    updateService = new UpdateService(mockConfigManager, mockEncryptionService, mockErrorHandler);
  });

  afterEach(() => {
    updateService.dispose();
  });

  describe('initialization', () => {
    it('should initialize with correct configuration', () => {
      expect(autoUpdater.autoDownload).toBe(false);
      expect(autoUpdater.autoInstallOnAppQuit).toBe(false);
      expect(autoUpdater.verifySignature).toBe(true);
      expect(autoUpdater.setFeedURL).toHaveBeenCalledWith({
        provider: 'github',
        owner: 'interview-assistant',
        repo: 'app',
        private: false
      });
    });

    it('should set up event handlers', () => {
      expect(autoUpdater.on).toHaveBeenCalledWith('checking-for-update', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('update-available', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('update-not-available', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('download-progress', expect.any(Function));
      expect(autoUpdater.on).toHaveBeenCalledWith('update-downloaded', expect.any(Function));
    });
  });

  describe('checkForUpdates', () => {
    it('should check for updates successfully', async () => {
      const mockUpdateInfo = {
        version: '1.1.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'Bug fixes and improvements',
        downloadUrl: 'https://example.com/download',
        signature: 'abc123',
        size: 50000000
      };

      (autoUpdater.checkForUpdates as jest.Mock).mockResolvedValue({
        updateInfo: mockUpdateInfo
      });

      const result = await updateService.checkForUpdates();

      expect(autoUpdater.checkForUpdates).toHaveBeenCalled();
      expect(result).toEqual(mockUpdateInfo);
    });

    it('should return null when no updates available', async () => {
      (autoUpdater.checkForUpdates as jest.Mock).mockResolvedValue(null);

      const result = await updateService.checkForUpdates();

      expect(result).toBeNull();
    });

    it('should handle errors during update check', async () => {
      const error = new Error('Network error');
      (autoUpdater.checkForUpdates as jest.Mock).mockRejectedValue(error);

      await expect(updateService.checkForUpdates()).rejects.toThrow('Network error');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        'UpdateService',
        'Failed to check for updates'
      );
    });
  });

  describe('downloadUpdate', () => {
    it('should download update successfully', async () => {
      (autoUpdater.downloadUpdate as jest.Mock).mockResolvedValue(undefined);

      await updateService.downloadUpdate();

      expect(autoUpdater.downloadUpdate).toHaveBeenCalled();
    });

    it('should handle download errors', async () => {
      const error = new Error('Download failed');
      (autoUpdater.downloadUpdate as jest.Mock).mockRejectedValue(error);

      await expect(updateService.downloadUpdate()).rejects.toThrow('Download failed');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        'UpdateService',
        'Failed to download update'
      );
    });
  });

  describe('createBackup', () => {
    beforeEach(() => {
      // Mock Date.now for consistent timestamps
      jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2024-01-01T00:00:00.000Z');
    });

    it('should create backup successfully', async () => {
      const mockBackupInfo: BackupInfo = {
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        configPath: '/mock/path/userData/backups/backup-1.0.0-2024-01-01T00-00-00-000Z/config',
        dataPath: '/mock/path/userData/backups/backup-1.0.0-2024-01-01T00-00-00-000Z/data',
        size: 1024
      };

      const result = await updateService.createBackup();

      expect(fs.mkdirSync).toHaveBeenCalled();
      expect(fs.writeFileSync).toHaveBeenCalled();
      expect(result.version).toBe('1.0.0');
      expect(result.timestamp).toBe('2024-01-01T00:00:00.000Z');
    });

    it('should handle backup creation errors', async () => {
      const error = new Error('Backup failed');
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {
        throw error;
      });

      await expect(updateService.createBackup()).rejects.toThrow('Backup failed');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        'UpdateService',
        'Failed to create backup'
      );
    });
  });

  describe('restoreBackup', () => {
    it('should restore backup successfully', async () => {
      const mockManifest = {
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        configPath: '/mock/backup/config',
        dataPath: '/mock/backup/data'
      };

      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockManifest));

      await updateService.restoreBackup('/mock/backup/path');

      expect(fs.readFileSync).toHaveBeenCalled();
      expect(app.relaunch).toHaveBeenCalled();
      expect(app.exit).toHaveBeenCalledWith(0);
    });

    it('should handle missing manifest file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(updateService.restoreBackup('/mock/backup/path'))
        .rejects.toThrow('Invalid backup: manifest.json not found');
    });
  });

  describe('migrateConfiguration', () => {
    it('should migrate configuration successfully', async () => {
      const mockConfig = {
        version: '1.0.0',
        features: {}
      };

      mockConfigManager.getConfig.mockReturnValue(mockConfig);

      await updateService.migrateConfiguration('1.0.0', '1.1.0');

      expect(mockConfigManager.getConfig).toHaveBeenCalled();
      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
    });

    it('should handle migration errors', async () => {
      const error = new Error('Migration failed');
      mockConfigManager.getConfig.mockImplementation(() => {
        throw error;
      });

      await expect(updateService.migrateConfiguration('1.0.0', '1.1.0'))
        .rejects.toThrow('Migration failed');
      expect(mockErrorHandler.handleError).toHaveBeenCalledWith(
        error,
        'UpdateService',
        'Configuration migration failed'
      );
    });
  });

  describe('getAvailableBackups', () => {
    it('should return available backups', () => {
      const mockManifest = {
        version: '1.0.0',
        timestamp: '2024-01-01T00:00:00.000Z',
        configPath: '/mock/config',
        dataPath: '/mock/data'
      };

      (fs.readdirSync as jest.Mock).mockReturnValue(['backup-1.0.0-2024-01-01']);
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockManifest));

      const backups = updateService.getAvailableBackups();

      expect(backups).toHaveLength(1);
      expect(backups[0].version).toBe('1.0.0');
    });

    it('should return empty array when backup directory does not exist', () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const backups = updateService.getAvailableBackups();

      expect(backups).toEqual([]);
    });
  });

  describe('cleanupOldBackups', () => {
    it('should cleanup old backups', async () => {
      const mockBackups = Array.from({ length: 10 }, (_, i) => ({
        version: `1.0.${i}`,
        timestamp: `2024-01-0${i + 1}T00:00:00.000Z`,
        configPath: `/mock/backup-${i}/config`,
        dataPath: `/mock/backup-${i}/data`,
        size: 1024
      }));

      jest.spyOn(updateService, 'getAvailableBackups').mockReturnValue(mockBackups);

      await updateService.cleanupOldBackups(5);

      expect(fs.rmSync).toHaveBeenCalledTimes(5);
    });

    it('should not cleanup when backups are within limit', async () => {
      const mockBackups = Array.from({ length: 3 }, (_, i) => ({
        version: `1.0.${i}`,
        timestamp: `2024-01-0${i + 1}T00:00:00.000Z`,
        configPath: `/mock/backup-${i}/config`,
        dataPath: `/mock/backup-${i}/data`,
        size: 1024
      }));

      jest.spyOn(updateService, 'getAvailableBackups').mockReturnValue(mockBackups);

      await updateService.cleanupOldBackups(5);

      expect(fs.rmSync).not.toHaveBeenCalled();
    });
  });

  describe('showUpdateDialog', () => {
    it('should show update dialog and return user choice', async () => {
      const mockUpdateInfo: UpdateInfo = {
        version: '1.1.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'Bug fixes',
        downloadUrl: 'https://example.com',
        signature: 'abc123',
        size: 50000000
      };

      (dialog.showMessageBox as jest.Mock).mockResolvedValue({ response: 0 });

      const result = await updateService.showUpdateDialog(mockUpdateInfo);

      expect(dialog.showMessageBox).toHaveBeenCalledWith({
        type: 'info',
        title: 'Update Available',
        message: 'A new version (1.1.0) is available!',
        detail: expect.stringContaining('Current version: 1.0.0'),
        buttons: ['Download and Install', 'Download Later', 'Skip This Version'],
        defaultId: 0,
        cancelId: 2
      });
      expect(result).toBe(true);
    });

    it('should return false when user chooses to skip', async () => {
      const mockUpdateInfo: UpdateInfo = {
        version: '1.1.0',
        releaseDate: '2024-01-01',
        releaseNotes: 'Bug fixes',
        downloadUrl: 'https://example.com',
        signature: 'abc123',
        size: 50000000
      };

      (dialog.showMessageBox as jest.Mock).mockResolvedValue({ response: 2 });

      const result = await updateService.showUpdateDialog(mockUpdateInfo);

      expect(result).toBe(false);
    });
  });

  describe('event handling', () => {
    it('should emit events correctly', () => {
      const eventSpy = jest.fn();
      updateService.on('checking-for-update', eventSpy);

      // Simulate event emission
      updateService.emit('checking-for-update');

      expect(eventSpy).toHaveBeenCalled();
    });
  });

  describe('dispose', () => {
    it('should cleanup resources', () => {
      const removeAllListenersSpy = jest.spyOn(updateService, 'removeAllListeners');

      updateService.dispose();

      expect(removeAllListenersSpy).toHaveBeenCalled();
    });
  });
});