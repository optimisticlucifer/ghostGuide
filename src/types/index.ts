// Core interfaces and types

export interface SessionConfig {
  id: string;
  profession: string;
  interviewType: string;
  context?: string;
  createdAt: Date;
  isActive: boolean;
}

export interface HistoricalSession extends Session {
  createdAt: Date;
  lastUpdated: Date;
  status: 'active' | 'completed' | 'archived';
  duration?: number; // Duration in minutes
  messageCount: number;
  tags?: string[];
  summary?: string;
}

export interface SessionHistoryQuery {
  profession?: string;
  interviewType?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: 'active' | 'completed' | 'archived';
  tags?: string[];
  searchText?: string;
  limit?: number;
  offset?: number;
}

export interface SessionExportOptions {
  format: 'text' | 'markdown' | 'pdf' | 'json';
  includeMetadata: boolean;
  includeTimestamps: boolean;
  includeRagContext: boolean;
}

export interface SessionAnalytics {
  totalSessions: number;
  totalDuration: number; // in minutes
  averageDuration: number;
  messageDistribution: {
    user: number;
    assistant: number;
  };
  professionBreakdown: Record<string, number>;
  interviewTypeBreakdown: Record<string, number>;
  weeklyTrend: Array<{
    week: string;
    count: number;
    duration: number;
  }>;
}

export interface Session {
  id: string;
  profession: string;
  interviewType: string;
  context?: string;
  chatHistory: ChatMessage[];
  isRecording: boolean;
  isSystemRecording: boolean;
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

export enum PromptCategory {
  SYSTEM = 'system',
  ACTION = 'action',
  AUDIO_COACHING = 'audio_coaching',
  FALLBACK = 'fallback',
  OPENAI_SYSTEM = 'openai_system'
}

export enum AudioPromptType {
  INTERVIEWER_QUESTION = 'interviewer_question',
  INTERVIEWEE_RESPONSE = 'interviewee_response',
  GENERAL_TRANSCRIPT = 'general_transcript'
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