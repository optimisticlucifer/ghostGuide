// Core interfaces and types

export interface SessionConfig {
  id: string;
  profession: string;
  interviewType: string;
  createdAt: Date;
  isActive: boolean;
}

export interface Session {
  id: string;
  profession: string;
  interviewType: string;
  chatHistory: ChatMessage[];
  isRecording: boolean;
  ragContext: string[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: {
    action?: ActionType;
    source?: AudioSource;
    ocrText?: string;
  };
}

export enum ActionType {
  SCREENSHOT = 'screenshot',
  DEBUG = 'debug',
  GENERAL = 'general'
}

export enum AudioSource {
  INTERVIEWER = 'internal',
  INTERVIEWEE = 'microphone',
  BOTH = 'both',
  SYSTEM = 'system'
}

export interface AppConfig {
  apiKey: string; // AES-256 encrypted
  promptLibrary: PromptLibrary;
  userPreferences: UserPreferences;
  sessions: SessionConfig[];
}

export interface PromptLibrary {
  [professionKey: string]: {
    [interviewTypeKey: string]: {
      system: string;
      actions: {
        [actionKey: string]: string;
      };
    };
  };
}

export interface UserPreferences {
  defaultProfession: string;
  defaultInterviewType: string;
  audioQuality: 'low' | 'medium' | 'high';
  ocrLanguage: string;
  maxSessions: number;
}

export interface PromptTemplate {
  id: string;
  profession: string;
  interviewType: string;
  action: ActionType;
  template: string;
  variables: string[];
}

export interface Document {
  id: string;
  sessionId: string;
  filename: string;
  content: string;
  embedding: number[];
  metadata: {
    fileType: string;
    uploadDate: Date;
    pageCount?: number;
  };
}

export interface KnowledgeBase {
  sessionId: string;
  documents: Document[];
  vectorIndex: any; // FAISS index
  lastUpdated: Date;
}