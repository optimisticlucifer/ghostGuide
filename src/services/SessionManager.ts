import { Session, SessionConfig, ChatMessage } from '../types';
import { randomUUID } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { PersistenceService } from './PersistenceService';

export class SessionManager {
  private sessions: Map<string, Session> = new Map();
  private maxSessions: number = 5;
  private persistenceService: PersistenceService;

  constructor() {
    this.persistenceService = new PersistenceService();
  }

  async createSession(config: Omit<SessionConfig, 'id' | 'createdAt' | 'isActive'>): Promise<Session> {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error('Maximum number of sessions reached');
    }

    const sessionId = randomUUID();
    const session: Session = {
      id: uuidv4(),
      profession: config.profession,
      interviewType: config.interviewType,
      chatHistory: [],
      isRecording: false,
      isSystemRecording: false,
      ragContext: []
    };

    this.sessions.set(sessionId, session);
    
    // Persist session immediately
    await this.persistenceService.saveSession(session);
    
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  async closeSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      // Save final state before closing
      await this.persistenceService.saveSession(session);
      // Delete from persistence
      await this.persistenceService.deleteSession(sessionId);
    }
    this.sessions.delete(sessionId);
  }

  listActiveSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  async addChatMessage(sessionId: string, message: ChatMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.chatHistory.push(message);
      // Auto-save session after adding message
      await this.persistenceService.saveSession(session);
    }
  }

  async updateRecordingState(sessionId: string, isRecording: boolean): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isRecording = isRecording;
      // Auto-save session after state change
      await this.persistenceService.saveSession(session);
    }
  }

  async addRagContext(sessionId: string, context: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.ragContext.push(context);
      // Auto-save session after adding context
      await this.persistenceService.saveSession(session);
    }
  }

  getChatHistory(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session ? session.chatHistory : [];
  }

  clearChatHistory(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.chatHistory = [];
    }
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  isSessionActive(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  updateSessionConfig(sessionId: string, updates: Partial<Pick<Session, 'profession' | 'interviewType'>>): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (updates.profession) session.profession = updates.profession;
      if (updates.interviewType) session.interviewType = updates.interviewType;
    }
  }

  // Session restoration methods
  async restoreActiveSessions(): Promise<Session[]> {
    try {
      const sessionConfigs = await this.persistenceService.getActiveSessions();
      const restoredSessions: Session[] = [];
      
      for (const config of sessionConfigs) {
        const session = await this.persistenceService.loadSession(config.id);
        if (session) {
          this.sessions.set(session.id, session);
          restoredSessions.push(session);
        }
      }
      
      return restoredSessions;
    } catch (error) {
      console.error('Failed to restore sessions:', error);
      return [];
    }
  }

  async restoreSession(sessionId: string): Promise<Session | null> {
    try {
      const session = await this.persistenceService.loadSession(sessionId);
      if (session) {
        this.sessions.set(sessionId, session);
        return session;
      }
      return null;
    } catch (error) {
      console.error('Failed to restore session:', error);
      return null;
    }
  }

  async saveAllSessions(): Promise<void> {
    try {
      const savePromises = Array.from(this.sessions.values()).map(session =>
        this.persistenceService.saveSession(session)
      );
      await Promise.all(savePromises);
    } catch (error) {
      console.error('Failed to save all sessions:', error);
      throw error;
    }
  }

  async clearAllSessions(): Promise<void> {
    try {
      await this.persistenceService.clearAllSessions();
      this.sessions.clear();
    } catch (error) {
      console.error('Failed to clear all sessions:', error);
      throw error;
    }
  }

  async backupSessions(): Promise<string> {
    try {
      // Save current state before backup
      await this.saveAllSessions();
      return await this.persistenceService.backupData();
    } catch (error) {
      console.error('Failed to backup sessions:', error);
      throw error;
    }
  }

  // Session isolation - ensure no data leakage between sessions
  private validateSessionIsolation(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;
    
    // Ensure session data is properly isolated
    return session.chatHistory.every(msg => msg.sessionId === sessionId) &&
           session.ragContext.length >= 0; // Basic validation
  }
}