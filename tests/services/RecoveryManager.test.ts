import { RecoveryManager, RecoveryState, ServiceStatus } from '../../src/services/RecoveryManager';
import { SessionManager } from '../../src/services/SessionManager';
import { ConfigurationManager } from '../../src/services/ConfigurationManager';
import { GracefulErrorHandler } from '../../src/services/ErrorHandler';
import * as fs from 'fs';

// Mock dependencies
jest.mock('../../src/services/SessionManager');
jest.mock('../../src/services/ConfigurationManager');
jest.mock('../../src/services/ErrorHandler');
jest.mock('fs');

describe('RecoveryManager', () => {
  let recoveryManager: RecoveryManager;
  let mockSessionManager: jest.Mocked<SessionManager>;
  let mockConfigurationManager: jest.Mocked<ConfigurationManager>;
  let mockErrorHandler: jest.Mocked<GracefulErrorHandler>;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    mockSessionManager = new SessionManager() as jest.Mocked<SessionManager>;
    mockConfigurationManager = new ConfigurationManager() as jest.Mocked<ConfigurationManager>;
    mockErrorHandler = new GracefulErrorHandler() as jest.Mocked<GracefulErrorHandler>;
    mockFs = fs as jest.Mocked<typeof fs>;

    recoveryManager = new RecoveryManager(
      mockSessionManager,
      mockConfigurationManager,
      mockErrorHandler
    );

    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize service statuses', () => {
      const statuses = recoveryManager.getAllServiceStatuses();
      
      expect(statuses).toHaveLength(4);
      expect(statuses.map(s => s.name)).toEqual(['ocr', 'audio', 'chat', 'rag']);
      
      statuses.forEach(status => {
        expect(status.isAvailable).toBe(true);
        expect(status.degradedMode).toBe(false);
        expect(status.retryCount).toBe(0);
      });
    });

    it('should check for crash recovery on initialization', async () => {
      mockFs.existsSync.mockReturnValue(false);
      
      const result = await recoveryManager.initialize();
      
      expect(mockFs.existsSync).toHaveBeenCalled();
    });

    it('should detect and recover from crash', async () => {
      const mockRecoveryState: RecoveryState = {
        timestamp: new Date(Date.now() - 60000), // 1 minute ago
        sessionIds: ['session-1', 'session-2'],
        lastOperation: 'test-operation',
        applicationState: 'running',
        services: {
          ocr: true,
          audio: true,
          chat: true,
          rag: true
        }
      };

      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile.mockResolvedValue(JSON.stringify(mockRecoveryState));
      mockSessionManager.restoreSession.mockResolvedValue({
        id: 'session-1',
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true,
        chatHistory: []
      });

      const wasRecovered = await (recoveryManager as any).checkForCrashRecovery();
      
      expect(wasRecovered).toBe(true);
      expect(mockSessionManager.restoreSession).toHaveBeenCalledTimes(2);
      expect(mockSessionManager.restoreSession).toHaveBeenCalledWith('session-1');
      expect(mockSessionManager.restoreSession).toHaveBeenCalledWith('session-2');
    });

    it('should handle recovery state file read errors', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.promises.readFile.mockRejectedValue(new Error('File read error'));

      const wasRecovered = await (recoveryManager as any).checkForCrashRecovery();
      
      expect(wasRecovered).toBe(false);
    });
  });

  describe('service status management', () => {
    it('should get service status', () => {
      const status = recoveryManager.getServiceStatus('ocr');
      
      expect(status).toBeDefined();
      expect(status?.name).toBe('ocr');
      expect(status?.isAvailable).toBe(true);
      expect(status?.degradedMode).toBe(false);
    });

    it('should return undefined for unknown service', () => {
      const status = recoveryManager.getServiceStatus('unknown-service');
      expect(status).toBeUndefined();
    });

    it('should check if service is degraded', () => {
      expect(recoveryManager.isServiceDegraded('ocr')).toBe(false);
      
      recoveryManager.enableDegradedMode('ocr', 'Test error');
      
      expect(recoveryManager.isServiceDegraded('ocr')).toBe(true);
    });

    it('should enable degraded mode for service', () => {
      const errorMessage = 'Service failed';
      
      recoveryManager.enableDegradedMode('audio', errorMessage);
      
      const status = recoveryManager.getServiceStatus('audio');
      expect(status?.isAvailable).toBe(false);
      expect(status?.degradedMode).toBe(true);
      expect(status?.lastError).toBe(errorMessage);
    });
  });

  describe('service availability testing', () => {
    it('should test OCR service availability', async () => {
      const result = await (recoveryManager as any).testOCRAvailability();
      expect(result).toBe(true);
    });

    it('should test audio service availability', async () => {
      const result = await (recoveryManager as any).testAudioAvailability();
      expect(result).toBe(true);
    });

    it('should test chat service availability with API key', async () => {
      mockConfigurationManager.getConfiguration.mockReturnValue({
        apiKey: 'test-api-key',
        promptLibrary: {},
        userPreferences: {
          defaultProfession: 'software-engineer',
          defaultInterviewType: 'technical',
          audioQuality: 'medium',
          ocrLanguage: 'eng',
          maxSessions: 5
        },
        sessions: []
      });

      const result = await (recoveryManager as any).testChatAvailability();
      expect(result).toBe(true);
    });

    it('should test chat service availability without API key', async () => {
      mockConfigurationManager.getConfiguration.mockReturnValue({
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
      });

      const result = await (recoveryManager as any).testChatAvailability();
      expect(result).toBe(false);
    });

    it('should test RAG service availability', async () => {
      const result = await (recoveryManager as any).testRAGAvailability();
      expect(result).toBe(true);
    });
  });

  describe('service recovery', () => {
    it('should attempt service recovery successfully', async () => {
      recoveryManager.enableDegradedMode('ocr', 'Test error');
      
      const recovered = await recoveryManager.attemptServiceRecovery('ocr');
      
      expect(recovered).toBe(true);
      
      const status = recoveryManager.getServiceStatus('ocr');
      expect(status?.isAvailable).toBe(true);
      expect(status?.degradedMode).toBe(false);
      expect(status?.retryCount).toBe(0);
    });

    it('should handle service recovery failure', async () => {
      recoveryManager.enableDegradedMode('chat', 'Test error');
      
      // Mock chat service to fail availability test
      mockConfigurationManager.getConfiguration.mockReturnValue({
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
      });

      const recovered = await recoveryManager.attemptServiceRecovery('chat');
      
      expect(recovered).toBe(false);
      
      const status = recoveryManager.getServiceStatus('chat');
      expect(status?.isAvailable).toBe(false);
      expect(status?.degradedMode).toBe(true);
      expect(status?.retryCount).toBe(1);
      expect(status?.nextRetryTime).toBeDefined();
    });

    it('should not retry before next retry time', async () => {
      recoveryManager.enableDegradedMode('audio', 'Test error');
      
      // Set next retry time to future
      const status = recoveryManager.getServiceStatus('audio');
      if (status) {
        status.nextRetryTime = new Date(Date.now() + 60000); // 1 minute from now
        (recoveryManager as any).serviceStatuses.set('audio', status);
      }

      const recovered = await recoveryManager.attemptServiceRecovery('audio');
      
      expect(recovered).toBe(false);
    });

    it('should return false for unknown service recovery', async () => {
      const recovered = await recoveryManager.attemptServiceRecovery('unknown-service');
      expect(recovered).toBe(false);
    });
  });

  describe('degraded functionality messaging', () => {
    it('should return empty message when no services are degraded', () => {
      const message = recoveryManager.getDegradedFunctionalityMessage();
      expect(message).toBe('');
    });

    it('should return appropriate message for degraded services', () => {
      recoveryManager.enableDegradedMode('ocr', 'OCR failed');
      recoveryManager.enableDegradedMode('audio', 'Audio failed');

      const message = recoveryManager.getDegradedFunctionalityMessage();
      
      expect(message).toContain('Screenshot analysis is temporarily unavailable');
      expect(message).toContain('Audio recording and transcription is temporarily unavailable');
      expect(message).toContain('The application will continue to retry these services automatically');
    });
  });

  describe('recovery state management', () => {
    it('should update recovery state', async () => {
      mockSessionManager.getActiveSessions.mockResolvedValue([
        {
          id: 'session-1',
          profession: 'software-engineer',
          interviewType: 'technical',
          createdAt: new Date(),
          isActive: true,
          chatHistory: []
        }
      ]);

      mockFs.promises.writeFile.mockResolvedValue();

      await (recoveryManager as any).updateRecoveryState('running', 'test-operation');

      expect(mockFs.promises.writeFile).toHaveBeenCalled();
      expect(mockSessionManager.getActiveSessions).toHaveBeenCalled();
    });

    it('should handle recovery state update errors', async () => {
      mockSessionManager.getActiveSessions.mockRejectedValue(new Error('Session error'));

      // Should not throw
      await expect((recoveryManager as any).updateRecoveryState('running', 'test-operation'))
        .resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup recovery manager', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {});

      await recoveryManager.cleanup();

      expect(mockFs.unlinkSync).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockFs.existsSync.mockReturnValue(true);
      mockFs.unlinkSync.mockImplementation(() => {
        throw new Error('Cleanup error');
      });

      // Should not throw
      await expect(recoveryManager.cleanup()).resolves.not.toThrow();
    });
  });

  describe('service availability checking', () => {
    it('should check all service availability', async () => {
      mockConfigurationManager.getConfiguration.mockReturnValue({
        apiKey: 'test-api-key',
        promptLibrary: {},
        userPreferences: {
          defaultProfession: 'software-engineer',
          defaultInterviewType: 'technical',
          audioQuality: 'medium',
          ocrLanguage: 'eng',
          maxSessions: 5
        },
        sessions: []
      });

      await recoveryManager.checkServiceAvailability();

      // All services should remain available
      const statuses = recoveryManager.getAllServiceStatuses();
      statuses.forEach(status => {
        expect(status.isAvailable).toBe(true);
        expect(status.degradedMode).toBe(false);
      });
    });

    it('should detect service failures during availability check', async () => {
      // Mock chat service to fail
      mockConfigurationManager.getConfiguration.mockReturnValue({
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
      });

      await recoveryManager.checkServiceAvailability();

      const chatStatus = recoveryManager.getServiceStatus('chat');
      expect(chatStatus?.isAvailable).toBe(false);
      expect(chatStatus?.degradedMode).toBe(true);
    });
  });
});