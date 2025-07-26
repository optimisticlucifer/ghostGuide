import { ConfigurationManager } from '../../src/services/ConfigurationManager';
import { AppConfig, PromptLibrary } from '../../src/types';
import { EncryptionService } from '../../src/services/EncryptionService';
import * as fs from 'fs';

// Mock dependencies
jest.mock('../../src/services/EncryptionService');
jest.mock('fs');

describe('ConfigurationManager', () => {
  let configurationManager: ConfigurationManager;
  let mockEncryptionService: jest.Mocked<EncryptionService>;
  let mockFs: jest.Mocked<typeof fs>;

  const mockDefaultConfig: AppConfig = {
    apiKey: '',
    promptLibrary: {},
    userPreferences: {
      defaultProfession: 'software-engineer',
      defaultInterviewType: 'technical',
      audioQuality: 'medium',
      ocrLanguage: 'eng',
      maxSessions: 5
    },
    sessions: []
  };

  beforeEach(() => {
    mockEncryptionService = new EncryptionService() as jest.Mocked<EncryptionService>;
    mockFs = fs as jest.Mocked<typeof fs>;
    
    configurationManager = new ConfigurationManager();
    (configurationManager as any).encryptionService = mockEncryptionService;

    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default configuration when no config file exists', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => '');
      mockEncryptionService.initialize.mockResolvedValue();
      mockEncryptionService.isInitialized.mockReturnValue(true);

      await configurationManager.initialize();

      const config = configurationManager.getConfiguration();
      expect(config).toMatchObject(mockDefaultConfig);
    });

    it('should load existing configuration', async () => {
      const existingConfig: AppConfig = {
        ...mockDefaultConfig,
        apiKey: 'existing-api-key',
        userPreferences: {
          ...mockDefaultConfig.userPreferences,
          defaultProfession: 'data-scientist'
        }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile.mockResolvedValue('encrypted-config-data');
      mockEncryptionService.initialize.mockResolvedValue();
      mockEncryptionService.isInitialized.mockReturnValue(true);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(existingConfig));

      await configurationManager.initialize();

      const config = configurationManager.getConfiguration();
      expect(config.apiKey).toBe('existing-api-key');
      expect(config.userPreferences.defaultProfession).toBe('data-scientist');
    });

    it('should handle corrupted configuration file', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile.mockResolvedValue('encrypted-config-data');
      mockEncryptionService.initialize.mockResolvedValue();
      mockEncryptionService.isInitialized.mockReturnValue(true);
      mockEncryptionService.decrypt.mockResolvedValue('invalid-json');

      await configurationManager.initialize();

      // Should fall back to default configuration
      const config = configurationManager.getConfiguration();
      expect(config).toMatchObject(mockDefaultConfig);
    });

    it('should handle encryption service initialization failure', async () => {
      mockEncryptionService.initialize.mockRejectedValue(new Error('Encryption failed'));

      await expect(configurationManager.initialize()).rejects.toThrow('Encryption failed');
    });
  });

  describe('configuration management', () => {
    beforeEach(async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => '');
      mockEncryptionService.initialize.mockResolvedValue();
      mockEncryptionService.isInitialized.mockReturnValue(true);
      await configurationManager.initialize();
    });

    it('should get current configuration', () => {
      const config = configurationManager.getConfiguration();
      expect(config).toMatchObject(mockDefaultConfig);
    });

    it('should update API key', async () => {
      const newApiKey = 'new-api-key';
      mockEncryptionService.encrypt.mockResolvedValue('encrypted-data');
      mockFs.promises.writeFile.mockResolvedValue();

      await configurationManager.updateApiKey(newApiKey);

      const config = configurationManager.getConfiguration();
      expect(config.apiKey).toBe(newApiKey);
      expect(mockEncryptionService.encrypt).toHaveBeenCalled();
      expect(mockFs.promises.writeFile).toHaveBeenCalled();
    });

    it('should update user preferences', async () => {
      const newPreferences = {
        defaultProfession: 'product-manager',
        defaultInterviewType: 'behavioral',
        audioQuality: 'high',
        ocrLanguage: 'fra',
        maxSessions: 10
      };

      mockEncryptionService.encrypt.mockResolvedValue('encrypted-data');
      mockFs.promises.writeFile.mockResolvedValue();

      await configurationManager.updateUserPreferences(newPreferences);

      const config = configurationManager.getConfiguration();
      expect(config.userPreferences).toEqual(newPreferences);
    });

    it('should update prompt library', async () => {
      const newPromptLibrary: PromptLibrary = {
        'software-engineer': {
          'technical': {
            system: 'New system prompt',
            actions: {
              screenshot: 'New screenshot prompt',
              debug: 'New debug prompt'
            }
          }
        }
      };

      mockEncryptionService.encrypt.mockResolvedValue('encrypted-data');
      mockFs.promises.writeFile.mockResolvedValue();

      await configurationManager.updatePromptLibrary(newPromptLibrary);

      const config = configurationManager.getConfiguration();
      expect(config.promptLibrary).toEqual(newPromptLibrary);
    });

    it('should get prompt library', () => {
      const promptLibrary = configurationManager.getPromptLibrary();
      expect(promptLibrary).toEqual(mockDefaultConfig.promptLibrary);
    });
  });

  describe('configuration validation', () => {
    beforeEach(async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => '');
      mockEncryptionService.initialize.mockResolvedValue();
      mockEncryptionService.isInitialized.mockReturnValue(true);
      await configurationManager.initialize();
    });

    it('should validate valid configuration', () => {
      const validConfig: AppConfig = {
        apiKey: 'valid-api-key',
        promptLibrary: {},
        userPreferences: {
          defaultProfession: 'software-engineer',
          defaultInterviewType: 'technical',
          audioQuality: 'medium',
          ocrLanguage: 'eng',
          maxSessions: 5
        },
        sessions: []
      };

      const isValid = (configurationManager as any).validateConfiguration(validConfig);
      expect(isValid).toBe(true);
    });

    it('should reject invalid configuration structure', () => {
      const invalidConfig = {
        apiKey: 'valid-api-key',
        // Missing required fields
      };

      const isValid = (configurationManager as any).validateConfiguration(invalidConfig);
      expect(isValid).toBe(false);
    });

    it('should reject invalid user preferences', () => {
      const invalidConfig: AppConfig = {
        apiKey: 'valid-api-key',
        promptLibrary: {},
        userPreferences: {
          defaultProfession: 'invalid-profession',
          defaultInterviewType: 'technical',
          audioQuality: 'medium',
          ocrLanguage: 'eng',
          maxSessions: -1 // Invalid value
        },
        sessions: []
      };

      const isValid = (configurationManager as any).validateConfiguration(invalidConfig);
      expect(isValid).toBe(false);
    });
  });

  describe('configuration persistence', () => {
    beforeEach(async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => '');
      mockEncryptionService.initialize.mockResolvedValue();
      mockEncryptionService.isInitialized.mockReturnValue(true);
      await configurationManager.initialize();
    });

    it('should save configuration to file', async () => {
      mockEncryptionService.encrypt.mockResolvedValue('encrypted-config');
      mockFs.promises.writeFile.mockResolvedValue();

      await (configurationManager as any).saveConfiguration();

      expect(mockEncryptionService.encrypt).toHaveBeenCalled();
      expect(mockFs.promises.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('config.json'),
        'encrypted-config',
        'utf8'
      );
    });

    it('should handle save errors', async () => {
      mockEncryptionService.encrypt.mockResolvedValue('encrypted-config');
      mockFs.promises.writeFile.mockRejectedValue(new Error('Write failed'));

      await expect((configurationManager as any).saveConfiguration()).rejects.toThrow('Write failed');
    });

    it('should handle encryption errors during save', async () => {
      mockEncryptionService.encrypt.mockRejectedValue(new Error('Encryption failed'));

      await expect((configurationManager as any).saveConfiguration()).rejects.toThrow('Encryption failed');
    });
  });

  describe('default configuration', () => {
    it('should provide default configuration', () => {
      const defaultConfig = configurationManager.getDefaultConfiguration();
      
      expect(defaultConfig).toMatchObject({
        apiKey: '',
        userPreferences: {
          defaultProfession: 'software-engineer',
          defaultInterviewType: 'technical',
          audioQuality: 'medium',
          ocrLanguage: 'eng',
          maxSessions: 5
        },
        sessions: []
      });
      expect(defaultConfig.promptLibrary).toBeDefined();
    });

    it('should include default prompt library', () => {
      const defaultConfig = configurationManager.getDefaultConfiguration();
      const promptLibrary = defaultConfig.promptLibrary;
      
      // Should have default professions
      expect(promptLibrary['software-engineer']).toBeDefined();
      expect(promptLibrary['data-scientist']).toBeDefined();
      expect(promptLibrary['product-manager']).toBeDefined();
      expect(promptLibrary['designer']).toBeDefined();
      
      // Should have default interview types for each profession
      const sePrompts = promptLibrary['software-engineer'];
      expect(sePrompts['technical']).toBeDefined();
      expect(sePrompts['behavioral']).toBeDefined();
      expect(sePrompts['system-design']).toBeDefined();
    });
  });

  describe('configuration migration', () => {
    it('should migrate old configuration format', async () => {
      const oldConfig = {
        apiKey: 'old-api-key',
        // Missing new fields
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile.mockResolvedValue('encrypted-config-data');
      mockEncryptionService.initialize.mockResolvedValue();
      mockEncryptionService.isInitialized.mockReturnValue(true);
      mockEncryptionService.decrypt.mockResolvedValue(JSON.stringify(oldConfig));
      mockEncryptionService.encrypt.mockResolvedValue('encrypted-migrated-config');
      mockFs.promises.writeFile.mockResolvedValue();

      await configurationManager.initialize();

      const config = configurationManager.getConfiguration();
      expect(config.apiKey).toBe('old-api-key');
      expect(config.userPreferences).toBeDefined();
      expect(config.promptLibrary).toBeDefined();
      expect(config.sessions).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should handle file system errors during initialization', async () => {
      mockFs.existsSync.mockImplementation(() => {
        throw new Error('File system error');
      });

      await expect(configurationManager.initialize()).rejects.toThrow('File system error');
    });

    it('should handle decryption errors during load', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile.mockResolvedValue('encrypted-config-data');
      mockEncryptionService.initialize.mockResolvedValue();
      mockEncryptionService.isInitialized.mockReturnValue(true);
      mockEncryptionService.decrypt.mockRejectedValue(new Error('Decryption failed'));

      await configurationManager.initialize();

      // Should fall back to default configuration
      const config = configurationManager.getConfiguration();
      expect(config).toMatchObject(mockDefaultConfig);
    });

    it('should handle directory creation errors', async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => {
        throw new Error('Directory creation failed');
      });

      await expect(configurationManager.initialize()).rejects.toThrow('Directory creation failed');
    });
  });

  describe('configuration export/import', () => {
    beforeEach(async () => {
      mockFs.existsSync.mockReturnValue(false);
      mockFs.mkdirSync.mockImplementation(() => '');
      mockEncryptionService.initialize.mockResolvedValue();
      mockEncryptionService.isInitialized.mockReturnValue(true);
      await configurationManager.initialize();
    });

    it('should export configuration', async () => {
      const exportedData = await configurationManager.exportConfiguration();
      
      expect(typeof exportedData).toBe('string');
      
      const parsedData = JSON.parse(exportedData);
      expect(parsedData).toMatchObject({
        userPreferences: expect.any(Object),
        promptLibrary: expect.any(Object)
      });
      // API key should not be exported for security
      expect(parsedData.apiKey).toBeUndefined();
    });

    it('should import configuration', async () => {
      const importData = {
        userPreferences: {
          defaultProfession: 'designer',
          defaultInterviewType: 'behavioral',
          audioQuality: 'high',
          ocrLanguage: 'fra',
          maxSessions: 3
        },
        promptLibrary: {
          'designer': {
            'behavioral': {
              system: 'Imported system prompt',
              actions: {}
            }
          }
        }
      };

      mockEncryptionService.encrypt.mockResolvedValue('encrypted-data');
      mockFs.promises.writeFile.mockResolvedValue();

      await configurationManager.importConfiguration(JSON.stringify(importData));

      const config = configurationManager.getConfiguration();
      expect(config.userPreferences.defaultProfession).toBe('designer');
      expect(config.promptLibrary['designer']).toBeDefined();
    });

    it('should handle invalid import data', async () => {
      const invalidImportData = 'invalid-json';

      await expect(configurationManager.importConfiguration(invalidImportData))
        .rejects.toThrow();
    });

    it('should reset to defaults', async () => {
      // First modify the configuration
      await configurationManager.updateApiKey('test-key');
      
      mockEncryptionService.encrypt.mockResolvedValue('encrypted-data');
      mockFs.promises.writeFile.mockResolvedValue();

      await configurationManager.resetToDefaults();

      const config = configurationManager.getConfiguration();
      expect(config.apiKey).toBe('');
      expect(config.userPreferences.defaultProfession).toBe('software-engineer');
    });
  });
});