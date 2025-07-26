import { VersionManager, VersionInfo, CompatibilityInfo } from '../../src/services/VersionManager';
import { ConfigurationManager } from '../../src/services/ConfigurationManager';
import { ErrorHandler } from '../../src/services/ErrorHandler';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';

// Mock dependencies
jest.mock('electron', () => ({
  app: {
    getVersion: jest.fn(() => '1.0.0'),
    getAppPath: jest.fn(() => '/mock/app/path')
  }
}));

jest.mock('fs');
jest.mock('path');

describe('VersionManager', () => {
  let versionManager: VersionManager;
  let mockConfigManager: jest.Mocked<ConfigurationManager>;
  let mockErrorHandler: jest.Mocked<ErrorHandler>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfigManager = {
      getConfig: jest.fn(() => ({
        previousVersion: '0.9.0',
        currentVersion: '1.0.0',
        versionHistory: []
      })),
      saveConfig: jest.fn()
    } as any;

    mockErrorHandler = {
      handleError: jest.fn()
    } as any;

    // Mock fs methods
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
      if (filePath.includes('package.json')) {
        return JSON.stringify({
          version: '1.0.0',
          name: 'interview-assistant'
        });
      }
      if (filePath.includes('build-info.json')) {
        return JSON.stringify({
          buildNumber: '123',
          buildDate: '2024-01-01T00:00:00.000Z',
          gitCommit: 'abc123'
        });
      }
      return '{}';
    });

    versionManager = new VersionManager(mockConfigManager, mockErrorHandler);
  });

  describe('initialization', () => {
    it('should initialize with correct version info', () => {
      const versionInfo = versionManager.getVersionInfo();

      expect(versionInfo.current).toBe('1.0.0');
      expect(versionInfo.previous).toBe('0.9.0');
      expect(versionInfo.channel).toBe('stable');
    });

    it('should determine release channel correctly', () => {
      (app.getVersion as jest.Mock).mockReturnValue('1.0.0-beta.1');
      const betaVersionManager = new VersionManager(mockConfigManager, mockErrorHandler);
      
      expect(betaVersionManager.getVersionInfo().channel).toBe('beta');
    });

    it('should handle missing build info gracefully', () => {
      (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
        return !filePath.includes('build-info.json');
      });

      const versionManagerNoBuildInfo = new VersionManager(mockConfigManager, mockErrorHandler);
      const versionInfo = versionManagerNoBuildInfo.getVersionInfo();

      expect(versionInfo.buildNumber).toBeDefined();
      expect(versionInfo.buildDate).toBeDefined();
    });
  });

  describe('version comparison', () => {
    it('should compare versions correctly', () => {
      expect(versionManager.compareVersions('1.0.0', '0.9.0')).toBe(1);
      expect(versionManager.compareVersions('0.9.0', '1.0.0')).toBe(-1);
      expect(versionManager.compareVersions('1.0.0', '1.0.0')).toBe(0);
    });

    it('should handle pre-release versions', () => {
      expect(versionManager.compareVersions('1.0.0-beta.1', '1.0.0-alpha.1')).toBe(0);
      expect(versionManager.compareVersions('1.0.0', '1.0.0-beta.1')).toBe(0);
    });

    it('should handle different version formats', () => {
      expect(versionManager.compareVersions('1.0', '1.0.0')).toBe(0);
      expect(versionManager.compareVersions('1.0.1', '1.0')).toBe(1);
    });
  });

  describe('version status', () => {
    it('should detect first run', () => {
      mockConfigManager.getConfig.mockReturnValue({});
      const firstRunManager = new VersionManager(mockConfigManager, mockErrorHandler);

      expect(firstRunManager.isFirstRun()).toBe(true);
    });

    it('should detect upgrade', () => {
      expect(versionManager.isUpgrade()).toBe(true);
    });

    it('should detect downgrade', () => {
      mockConfigManager.getConfig.mockReturnValue({
        previousVersion: '1.1.0'
      });
      const downgradeManager = new VersionManager(mockConfigManager, mockErrorHandler);

      expect(downgradeManager.isDowngrade()).toBe(true);
    });
  });

  describe('compatibility', () => {
    it('should check version compatibility', () => {
      expect(versionManager.isVersionCompatible('1.0.0', '1.1.0')).toBe(true);
      expect(versionManager.isVersionCompatible('0.9.0', '2.0.0')).toBe(false);
    });

    it('should get compatibility info', () => {
      const compatInfo = versionManager.getCompatibilityInfo('1.0.0');

      expect(compatInfo).toBeDefined();
      expect(compatInfo?.minVersion).toBe('1.0.0');
      expect(compatInfo?.supportedFeatures).toContain('ocr-basic');
    });

    it('should check feature support', () => {
      expect(versionManager.isFeatureSupported('ocr-basic', '1.0.0')).toBe(true);
      expect(versionManager.isFeatureSupported('cloud-sync', '1.0.0')).toBe(false);
    });

    it('should check removed features', () => {
      expect(versionManager.isFeatureRemoved('ocr-basic', '2.0.0')).toBe(true);
      expect(versionManager.isFeatureRemoved('ocr-advanced', '2.0.0')).toBe(false);
    });
  });

  describe('version history', () => {
    it('should get version history', () => {
      const mockHistory = [
        { version: '1.0.0', timestamp: '2024-01-01T00:00:00.000Z' },
        { version: '0.9.0', timestamp: '2023-12-01T00:00:00.000Z' }
      ];

      mockConfigManager.getConfig.mockReturnValue({
        versionHistory: mockHistory
      });

      const history = versionManager.getVersionHistory();
      expect(history).toEqual(mockHistory);
    });

    it('should record version change', async () => {
      await versionManager.recordVersionChange();

      expect(mockConfigManager.saveConfig).toHaveBeenCalled();
      const savedConfig = mockConfigManager.saveConfig.mock.calls[0][0];
      expect(savedConfig.currentVersion).toBe('1.0.0');
      expect(savedConfig.versionHistory).toBeDefined();
    });

    it('should limit version history to 10 entries', async () => {
      const longHistory = Array.from({ length: 15 }, (_, i) => ({
        version: `1.0.${i}`,
        timestamp: '2024-01-01T00:00:00.000Z'
      }));

      mockConfigManager.getConfig.mockReturnValue({
        versionHistory: longHistory
      });

      await versionManager.recordVersionChange();

      const savedConfig = mockConfigManager.saveConfig.mock.calls[0][0];
      expect(savedConfig.versionHistory.length).toBe(10);
    });
  });

  describe('upgrade requirements', () => {
    it('should analyze upgrade requirements', () => {
      const requirements = versionManager.getUpgradeRequirements('1.0.0', '1.1.0');

      expect(requirements.compatible).toBe(true);
      expect(requirements.requiresDataMigration).toBe(true);
      expect(requirements.requiresFullReinstall).toBe(false);
      expect(requirements.warnings).toBeInstanceOf(Array);
      expect(requirements.blockers).toBeInstanceOf(Array);
    });

    it('should detect major version upgrade', () => {
      const requirements = versionManager.getUpgradeRequirements('1.0.0', '2.0.0');

      expect(requirements.requiresFullReinstall).toBe(true);
      expect(requirements.warnings).toContain(expect.stringContaining('Major version upgrade'));
    });

    it('should detect removed features', () => {
      const requirements = versionManager.getUpgradeRequirements('1.0.0', '2.0.0');

      expect(requirements.warnings.some(w => w.includes('removed'))).toBe(true);
    });
  });

  describe('version report', () => {
    it('should generate version report', () => {
      const report = versionManager.generateVersionReport();

      expect(report).toContain('# Version Report');
      expect(report).toContain('Current Version');
      expect(report).toContain('1.0.0');
      expect(report).toContain('Supported Features');
    });

    it('should include previous version in report', () => {
      const report = versionManager.generateVersionReport();

      expect(report).toContain('Previous Version');
      expect(report).toContain('0.9.0');
    });
  });

  describe('version integrity', () => {
    it('should check version integrity successfully', async () => {
      const result = await versionManager.checkVersionIntegrity();

      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
    });

    it('should detect version mismatch', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('package.json')) {
          return JSON.stringify({ version: '1.1.0' });
        }
        return '{}';
      });

      const mismatchManager = new VersionManager(mockConfigManager, mockErrorHandler);
      const result = await mismatchManager.checkVersionIntegrity();

      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('Version mismatch'))).toBe(true);
    });

    it('should detect invalid version format', async () => {
      (app.getVersion as jest.Mock).mockReturnValue('invalid-version');
      const invalidManager = new VersionManager(mockConfigManager, mockErrorHandler);
      
      const result = await invalidManager.checkVersionIntegrity();

      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('Invalid version format'))).toBe(true);
    });

    it('should detect version regression', async () => {
      mockConfigManager.getConfig.mockReturnValue({
        previousVersion: '1.1.0'
      });
      
      const regressionManager = new VersionManager(mockConfigManager, mockErrorHandler);
      const result = await regressionManager.checkVersionIntegrity();

      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('Version regression'))).toBe(true);
    });

    it('should detect future build date', async () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);

      (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
        if (filePath.includes('build-info.json')) {
          return JSON.stringify({
            buildDate: futureDate.toISOString()
          });
        }
        return '{}';
      });

      const futureBuildManager = new VersionManager(mockConfigManager, mockErrorHandler);
      const result = await futureBuildManager.checkVersionIntegrity();

      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('Build date is in the future'))).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should handle config errors gracefully', () => {
      mockConfigManager.getConfig.mockImplementation(() => {
        throw new Error('Config error');
      });

      // Should not throw during initialization
      expect(() => new VersionManager(mockConfigManager, mockErrorHandler)).not.toThrow();
    });

    it('should handle file system errors', async () => {
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File system error');
      });

      const result = await versionManager.checkVersionIntegrity();

      expect(result.valid).toBe(false);
      expect(result.issues.some(issue => issue.includes('File system error'))).toBe(true);
    });
  });
});