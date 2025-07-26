import { SessionManager } from '../../src/services/SessionManager';
import { Session, SessionConfig } from '../../src/types';

// Mock dependencies
jest.mock('../../src/services/PersistenceService');

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockPersistenceService: any;

  beforeEach(() => {
    sessionManager = new SessionManager();
    // Access the private persistence service for mocking
    mockPersistenceService = (sessionManager as any).persistenceService;
    jest.clearAllMocks();
  });

  describe('createSession', () => {
    const mockSessionConfig: SessionConfig = {
      profession: 'software-engineer',
      interviewType: 'technical'
    };

    it('should create a new session with valid configuration', async () => {
      mockPersistenceService.saveSession.mockResolvedValue(undefined);

      const session = await sessionManager.createSession(mockSessionConfig);

      expect(session).toMatchObject({
        profession: 'software-engineer',
        interviewType: 'technical',
        isActive: true,
        chatHistory: []
      });
      expect(session.id).toBeDefined();
      expect(session.createdAt).toBeInstanceOf(Date);
      expect(mockPersistenceService.saveSession).toHaveBeenCalledWith(session);
    });

    it('should generate unique session IDs', async () => {
      mockPersistenceService.saveSession.mockResolvedValue(undefined);

      const session1 = await sessionManager.createSession(mockSessionConfig);
      const session2 = await sessionManager.createSession(mockSessionConfig);

      expect(session1.id).not.toBe(session2.id);
    });

    it('should handle persistence errors during session creation', async () => {
      const error = new Error('Persistence failed');
      mockPersistenceService.saveSession.mockRejectedValue(error);

      await expect(sessionManager.createSession(mockSessionConfig)).rejects.toThrow('Persistence failed');
    });
  });

  describe('getSession', () => {
    it('should return session from memory if available', async () => {
      const mockSession: Session = {
        id: 'test-session-id',
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true,
        chatHistory: []
      };

      // Add session to memory
      (sessionManager as any).activeSessions.set('test-session-id', mockSession);

      const result = await sessionManager.getSession('test-session-id');
      expect(result).toBe(mockSession);
      expect(mockPersistenceService.loadSession).not.toHaveBeenCalled();
    });

    it('should load session from persistence if not in memory', async () => {
      const mockSession: Session = {
        id: 'test-session-id',
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true,
        chatHistory: []
      };

      mockPersistenceService.loadSession.mockResolvedValue(mockSession);

      const result = await sessionManager.getSession('test-session-id');
      expect(result).toEqual(mockSession);
      expect(mockPersistenceService.loadSession).toHaveBeenCalledWith('test-session-id');
    });

    it('should return null for non-existent session', async () => {
      mockPersistenceService.loadSession.mockResolvedValue(null);

      const result = await sessionManager.getSession('non-existent-id');
      expect(result).toBeNull();
    });
  });

  describe('closeSession', () => {
    it('should close an active session', async () => {
      const mockSession: Session = {
        id: 'test-session-id',
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true,
        chatHistory: []
      };

      (sessionManager as any).activeSessions.set('test-session-id', mockSession);
      mockPersistenceService.saveSession.mockResolvedValue(undefined);

      await sessionManager.closeSession('test-session-id');

      expect(mockSession.isActive).toBe(false);
      expect(mockPersistenceService.saveSession).toHaveBeenCalledWith(mockSession);
      expect((sessionManager as any).activeSessions.has('test-session-id')).toBe(false);
    });

    it('should handle closing non-existent session', async () => {
      await expect(sessionManager.closeSession('non-existent-id')).resolves.not.toThrow();
    });
  });

  describe('addChatMessage', () => {
    it('should add message to session chat history', async () => {
      const mockSession: Session = {
        id: 'test-session-id',
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true,
        chatHistory: []
      };

      const mockMessage = {
        id: 'msg-1',
        sessionId: 'test-session-id',
        role: 'user' as const,
        content: 'Test message',
        timestamp: new Date()
      };

      (sessionManager as any).activeSessions.set('test-session-id', mockSession);
      mockPersistenceService.saveSession.mockResolvedValue(undefined);

      await sessionManager.addChatMessage('test-session-id', mockMessage);

      expect(mockSession.chatHistory).toContain(mockMessage);
      expect(mockPersistenceService.saveSession).toHaveBeenCalledWith(mockSession);
    });

    it('should handle adding message to non-existent session', async () => {
      const mockMessage = {
        id: 'msg-1',
        sessionId: 'non-existent-id',
        role: 'user' as const,
        content: 'Test message',
        timestamp: new Date()
      };

      await expect(sessionManager.addChatMessage('non-existent-id', mockMessage)).rejects.toThrow();
    });
  });

  describe('updateRecordingState', () => {
    it('should update recording state for session', async () => {
      const mockSession: Session = {
        id: 'test-session-id',
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true,
        chatHistory: [],
        isRecording: false
      };

      (sessionManager as any).activeSessions.set('test-session-id', mockSession);
      mockPersistenceService.saveSession.mockResolvedValue(undefined);

      await sessionManager.updateRecordingState('test-session-id', true);

      expect(mockSession.isRecording).toBe(true);
      expect(mockPersistenceService.saveSession).toHaveBeenCalledWith(mockSession);
    });
  });

  describe('getActiveSessions', () => {
    it('should return all active sessions', async () => {
      const mockSession1: Session = {
        id: 'session-1',
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true,
        chatHistory: []
      };

      const mockSession2: Session = {
        id: 'session-2',
        profession: 'data-scientist',
        interviewType: 'behavioral',
        createdAt: new Date(),
        isActive: true,
        chatHistory: []
      };

      (sessionManager as any).activeSessions.set('session-1', mockSession1);
      (sessionManager as any).activeSessions.set('session-2', mockSession2);

      const activeSessions = await sessionManager.getActiveSessions();

      expect(activeSessions).toHaveLength(2);
      expect(activeSessions).toContain(mockSession1);
      expect(activeSessions).toContain(mockSession2);
    });

    it('should return empty array when no active sessions', async () => {
      const activeSessions = await sessionManager.getActiveSessions();
      expect(activeSessions).toHaveLength(0);
    });
  });

  describe('restoreActiveSessions', () => {
    it('should restore sessions from persistence', async () => {
      const mockSessions: Session[] = [
        {
          id: 'session-1',
          profession: 'software-engineer',
          interviewType: 'technical',
          createdAt: new Date(),
          isActive: true,
          chatHistory: []
        },
        {
          id: 'session-2',
          profession: 'data-scientist',
          interviewType: 'behavioral',
          createdAt: new Date(),
          isActive: true,
          chatHistory: []
        }
      ];

      mockPersistenceService.loadActiveSessions.mockResolvedValue(mockSessions);

      const restoredSessions = await sessionManager.restoreActiveSessions();

      expect(restoredSessions).toEqual(mockSessions);
      expect((sessionManager as any).activeSessions.size).toBe(2);
      expect((sessionManager as any).activeSessions.has('session-1')).toBe(true);
      expect((sessionManager as any).activeSessions.has('session-2')).toBe(true);
    });

    it('should handle restoration errors gracefully', async () => {
      mockPersistenceService.loadActiveSessions.mockRejectedValue(new Error('Load failed'));

      const restoredSessions = await sessionManager.restoreActiveSessions();

      expect(restoredSessions).toEqual([]);
      expect((sessionManager as any).activeSessions.size).toBe(0);
    });
  });

  describe('saveAllSessions', () => {
    it('should save all active sessions', async () => {
      const mockSession1: Session = {
        id: 'session-1',
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true,
        chatHistory: []
      };

      const mockSession2: Session = {
        id: 'session-2',
        profession: 'data-scientist',
        interviewType: 'behavioral',
        createdAt: new Date(),
        isActive: true,
        chatHistory: []
      };

      (sessionManager as any).activeSessions.set('session-1', mockSession1);
      (sessionManager as any).activeSessions.set('session-2', mockSession2);
      mockPersistenceService.saveSession.mockResolvedValue(undefined);

      await sessionManager.saveAllSessions();

      expect(mockPersistenceService.saveSession).toHaveBeenCalledTimes(2);
      expect(mockPersistenceService.saveSession).toHaveBeenCalledWith(mockSession1);
      expect(mockPersistenceService.saveSession).toHaveBeenCalledWith(mockSession2);
    });

    it('should handle save errors for individual sessions', async () => {
      const mockSession: Session = {
        id: 'session-1',
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true,
        chatHistory: []
      };

      (sessionManager as any).activeSessions.set('session-1', mockSession);
      mockPersistenceService.saveSession.mockRejectedValue(new Error('Save failed'));

      // Should not throw, but handle error gracefully
      await expect(sessionManager.saveAllSessions()).resolves.not.toThrow();
    });
  });
});