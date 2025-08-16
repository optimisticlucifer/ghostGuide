import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { Session, SessionConfig } from '../types';

export class PersistenceService {
  private dataPath: string;
  private sessionsFile: string;
  private configFile: string;

  constructor() {
    this.dataPath = path.join(app.getPath('userData'), 'interview-assistant');
    this.sessionsFile = path.join(this.dataPath, 'sessions.json');
    this.configFile = path.join(this.dataPath, 'config.json');
    
    this.ensureDataDirectory();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataPath)) {
      fs.mkdirSync(this.dataPath, { recursive: true });
    }
  }

  async saveSession(session: Session): Promise<void> {
    try {
      const sessions = await this.loadAllSessions();
      sessions[session.id] = {
        id: session.id,
        profession: session.profession,
        interviewType: session.interviewType,
        chatHistory: session.chatHistory,
        isRecording: session.isRecording,
        isSystemRecording: session.isSystemRecording,
        ragContext: session.ragContext,
        lastUpdated: new Date().toISOString()
      };
      
      await fs.promises.writeFile(
        this.sessionsFile, 
        JSON.stringify(sessions, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  async loadSession(sessionId: string): Promise<Session | null> {
    try {
      const sessions = await this.loadAllSessions();
      const sessionData = sessions[sessionId];
      
      if (!sessionData) return null;
      
      return {
        id: sessionData.id,
        profession: sessionData.profession,
        interviewType: sessionData.interviewType,
        chatHistory: sessionData.chatHistory || [],
        isRecording: sessionData.isRecording || false,
        isSystemRecording: sessionData.isSystemRecording || false,
        ragContext: sessionData.ragContext || []
      };
    } catch (error) {
      console.error('Failed to load session:', error);
      return null;
    }
  }

  async loadAllSessions(): Promise<Record<string, any>> {
    try {
      if (!fs.existsSync(this.sessionsFile)) {
        return {};
      }
      
      const data = await fs.promises.readFile(this.sessionsFile, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error('Failed to load sessions:', error);
      return {};
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    try {
      const sessions = await this.loadAllSessions();
      delete sessions[sessionId];
      
      await fs.promises.writeFile(
        this.sessionsFile,
        JSON.stringify(sessions, null, 2),
        'utf8'
      );
    } catch (error) {
      console.error('Failed to delete session:', error);
      throw error;
    }
  }

  async getActiveSessions(): Promise<SessionConfig[]> {
    try {
      const sessions = await this.loadAllSessions();
      return Object.values(sessions).map(session => ({
        id: session.id,
        profession: session.profession,
        interviewType: session.interviewType,
        createdAt: new Date(session.lastUpdated || Date.now()),
        isActive: true
      }));
    } catch (error) {
      console.error('Failed to get active sessions:', error);
      return [];
    }
  }

  async saveAppConfig(config: any): Promise<void> {
    try {
      // Save config directly without encryption
      const configToSave = { ...config };
      
      await fs.promises.writeFile(
        this.configFile,
        JSON.stringify(configToSave, null, 2),
        'utf8'
      );
      
      console.log('✅ [PERSISTENCE] App config saved successfully');
    } catch (error) {
      console.error('❌ [PERSISTENCE] Failed to save app config:', error);
      throw error;
    }
  }

  async loadAppConfig(): Promise<any> {
    try {
      if (!fs.existsSync(this.configFile)) {
        return this.getDefaultConfig();
      }
      
      const data = await fs.promises.readFile(this.configFile, 'utf8');
      const config = JSON.parse(data);
      
      // Clean up old encryption flags if they exist
      if (config._encrypted) {
        delete config._encrypted;
      }
      if (config._promptsEncrypted) {
        delete config._promptsEncrypted;
      }
      
      return config;
    } catch (error) {
      console.error('Failed to load app config:', error);
      return this.getDefaultConfig();
    }
  }

  private getDefaultConfig(): any {
    return {
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
  }

  async clearAllSessions(): Promise<void> {
    try {
      await fs.promises.writeFile(this.sessionsFile, '{}', 'utf8');
    } catch (error) {
      console.error('Failed to clear sessions:', error);
      throw error;
    }
  }

  async backupData(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupDir = path.join(this.dataPath, 'backups');
      
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      
      const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
      const sessions = await this.loadAllSessions();
      const config = await this.loadAppConfig();
      
      const backupData = {
        sessions,
        config,
        timestamp: new Date().toISOString()
      };
      
      await fs.promises.writeFile(
        backupFile,
        JSON.stringify(backupData, null, 2),
        'utf8'
      );
      
      return backupFile;
    } catch (error) {
      console.error('Failed to backup data:', error);
      throw error;
    }
  }
}