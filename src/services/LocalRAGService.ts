import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { VectorDatabaseService, VectorDocument, SearchResult } from './VectorDatabaseService';
import { DocumentProcessor, ProcessedDocument } from './DocumentProcessor';
import { randomUUID } from 'crypto';

export interface LocalRAGResult {
  success: boolean;
  documentsProcessed: number;
  chunksAdded: number;
  errors: string[];
  folderPath?: string;
}

export interface LocalRAGStats {
  sessionId: string;
  totalDocuments: number;
  totalChunks: number;
  lastUpdate: string | null;
  folderPath: string | null;
  isEnabled: boolean;
}

export class LocalRAGService {
  private vectorDb: VectorDatabaseService;
  private documentProcessor: DocumentProcessor;
  private sessionDatabases: Map<string, any> = new Map(); // sessionId -> table
  private sessionStats: Map<string, LocalRAGStats> = new Map();
  private sessionFolderPaths: Map<string, string> = new Map(); // sessionId -> folderPath
  private dataPath: string;

  constructor() {
    this.vectorDb = new VectorDatabaseService();
    this.documentProcessor = new DocumentProcessor();
    this.dataPath = path.join(app.getPath('userData'), 'local-rag');
  }

  /**
   * Initialize the local RAG service
   */
  async initialize(): Promise<void> {
    try {
      console.log('🚀 [LOCAL_RAG] Initializing Local RAG service...');
      
      // Ensure data directory exists
      await fs.promises.mkdir(this.dataPath, { recursive: true });
      
      // Initialize vector database service
      await this.vectorDb.initialize();
      
      console.log('✅ [LOCAL_RAG] Local RAG service initialized successfully');
    } catch (error) {
      console.error('❌ [LOCAL_RAG] Failed to initialize Local RAG service:', error);
      throw new Error(`Local RAG initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Create and initialize a local database for a session
   */
  async createSessionDatabase(sessionId: string): Promise<void> {
    try {
      console.log(`🏗️ [LOCAL_RAG] Creating local database for session: ${sessionId}`);
      
      if (this.sessionDatabases.has(sessionId)) {
        console.log(`⚠️ [LOCAL_RAG] Database already exists for session: ${sessionId}`);
        return;
      }

      // Get session table from vector database (will create if doesn't exist)
      const table = await this.vectorDb.getSessionTable(sessionId);
      this.sessionDatabases.set(sessionId, table);

      // Initialize session stats
      this.sessionStats.set(sessionId, {
        sessionId,
        totalDocuments: 0,
        totalChunks: 0,
        lastUpdate: null,
        folderPath: null,
        isEnabled: true
      });

      console.log(`✅ [LOCAL_RAG] Local database created for session: ${sessionId}`);
    } catch (error) {
      console.error(`❌ [LOCAL_RAG] Failed to create database for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Index documents from a folder into the session's local database
   */
  async ingestDocuments(sessionId: string, folderPath: string): Promise<LocalRAGResult> {
    const result: LocalRAGResult = {
      success: false,
      documentsProcessed: 0,
      chunksAdded: 0,
      errors: [],
      folderPath
    };

    try {
      console.log(`📁 [LOCAL_RAG] Starting to ingest documents for session ${sessionId} from: ${folderPath}`);
      
      // Ensure session database exists
      if (!this.sessionDatabases.has(sessionId)) {
        await this.createSessionDatabase(sessionId);
      }

      // Get the session table
      const table = this.sessionDatabases.get(sessionId);
      if (!table) {
        throw new Error(`No database found for session: ${sessionId}`);
      }

      // Process documents in the folder
      const processedDocuments = await this.documentProcessor.processFolder(folderPath);
      
      if (processedDocuments.length === 0) {
        console.log(`⚠️ [LOCAL_RAG] No documents found to process in session ${sessionId}`);
        result.success = true;
        return result;
      }

      // Convert processed documents to vector documents
      const vectorDocuments: VectorDocument[] = [];
      
      for (const doc of processedDocuments) {
        for (const chunk of doc.chunks) {
          try {
            // Create embedding for the chunk text
            const embedding = this.documentProcessor.createSimpleEmbedding(chunk.text);
            
            const vectorDoc: VectorDocument = {
              id: chunk.id,
              text: chunk.text,
              vector: embedding,
              metadata: {
                filename: doc.filename,
                fileType: doc.fileType,
                uploadDate: new Date().toISOString(),
                chunk_index: chunk.chunkIndex,
                source: 'local',
                sessionId: sessionId
              }
            };

            vectorDocuments.push(vectorDoc);
          } catch (error) {
            console.error(`❌ [LOCAL_RAG] Failed to create embedding for chunk ${chunk.id}:`, error);
            result.errors.push(`Failed to create embedding for ${doc.filename} chunk ${chunk.chunkIndex}`);
          }
        }
      }

      // Insert vector documents into the database
      if (vectorDocuments.length > 0) {
        await this.vectorDb.insertDocuments(table, vectorDocuments);
        result.chunksAdded = vectorDocuments.length;
      }

      result.documentsProcessed = processedDocuments.length;
      result.success = true;

      // Update session stats
      const stats = this.sessionStats.get(sessionId);
      if (stats) {
        stats.totalDocuments = processedDocuments.length;
        stats.totalChunks = result.chunksAdded;
        stats.lastUpdate = new Date().toISOString();
        stats.folderPath = folderPath;
      }

      // Store folder path for refresh functionality
      this.sessionFolderPaths.set(sessionId, folderPath);

      console.log(`✅ [LOCAL_RAG] Successfully ingested ${result.documentsProcessed} documents (${result.chunksAdded} chunks) for session ${sessionId}`);
      
      return result;

    } catch (error) {
      console.error(`❌ [LOCAL_RAG] Failed to ingest documents for session ${sessionId}:`, error);
      result.errors.push(`Failed to ingest documents: ${(error as Error).message}`);
      return result;
    }
  }

  /**
   * Search for relevant context in the session's local database
   */
  async searchRelevantContext(
    sessionId: string,
    query: string,
    limit: number = 5,
    threshold: number = 0.3
  ): Promise<SearchResult[]> {
    try {
      console.log(`🔍 [LOCAL_RAG] Searching session ${sessionId} for: "${query.substring(0, 50)}..."`);
      
      // Check if session has local RAG enabled and database exists
      const stats = this.sessionStats.get(sessionId);
      if (!stats || !stats.isEnabled) {
        console.log(`⚠️ [LOCAL_RAG] Local RAG is disabled for session: ${sessionId}`);
        return [];
      }

      const table = this.sessionDatabases.get(sessionId);
      if (!table) {
        console.log(`⚠️ [LOCAL_RAG] No local database found for session: ${sessionId}`);
        return [];
      }

      // Create query embedding
      const queryEmbedding = this.documentProcessor.createSimpleEmbedding(query);
      
      // Search in the session table
      const results = await this.vectorDb.searchSimilar(
        table, 
        queryEmbedding, 
        limit, 
        threshold
      );

      console.log(`✅ [LOCAL_RAG] Found ${results.length} relevant documents in session ${sessionId}`);
      return results;

    } catch (error) {
      console.error(`❌ [LOCAL_RAG] Search failed for session ${sessionId}:`, error);
      return [];
    }
  }

  /**
   * Get formatted context strings from search results
   */
  async getContextStrings(sessionId: string, query: string, limit: number = 3): Promise<string[]> {
    const searchResults = await this.searchRelevantContext(sessionId, query, limit);
    
    return searchResults.map(result => {
      return `[Local: ${result.metadata.filename}] ${result.text.substring(0, 500)}${result.text.length > 500 ? '...' : ''}`;
    });
  }

  /**
   * Refresh the local database for a session (clear and re-ingest)
   */
  async refreshLocalDatabase(sessionId: string): Promise<LocalRAGResult> {
    try {
      console.log(`🔄 [LOCAL_RAG] Refreshing local database for session: ${sessionId}`);
      
      // Get the current folder path
      const folderPath = this.sessionFolderPaths.get(sessionId);
      if (!folderPath) {
        throw new Error(`No folder path found for session: ${sessionId}. Please add RAG material first.`);
      }

      // Clear the existing database
      await this.clearSessionDatabase(sessionId);

      // Re-create and re-ingest
      await this.createSessionDatabase(sessionId);
      return await this.ingestDocuments(sessionId, folderPath);

    } catch (error) {
      console.error(`❌ [LOCAL_RAG] Failed to refresh database for session ${sessionId}:`, error);
      return {
        success: false,
        documentsProcessed: 0,
        chunksAdded: 0,
        errors: [`Failed to refresh: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Enable or disable local RAG for a session
   */
  setLocalRAGEnabled(sessionId: string, enabled: boolean): void {
    const stats = this.sessionStats.get(sessionId);
    if (stats) {
      stats.isEnabled = enabled;
      console.log(`🔧 [LOCAL_RAG] Local RAG ${enabled ? 'enabled' : 'disabled'} for session: ${sessionId}`);
    } else {
      console.warn(`⚠️ [LOCAL_RAG] No stats found for session: ${sessionId}`);
    }
  }

  /**
   * Check if local RAG is enabled for a session
   */
  isLocalRAGEnabled(sessionId: string): boolean {
    const stats = this.sessionStats.get(sessionId);
    return stats ? stats.isEnabled : false;
  }

  /**
   * Get session statistics
   */
  getSessionStats(sessionId: string): LocalRAGStats | null {
    return this.sessionStats.get(sessionId) || null;
  }

  /**
   * Clear local database for a session
   */
  async clearSessionDatabase(sessionId: string): Promise<void> {
    try {
      console.log(`🗑️ [LOCAL_RAG] Clearing local database for session: ${sessionId}`);
      
      const table = this.sessionDatabases.get(sessionId);
      if (table) {
        await this.vectorDb.clearTable(table);
      }

      // Reset stats but keep enabled state
      const stats = this.sessionStats.get(sessionId);
      if (stats) {
        stats.totalDocuments = 0;
        stats.totalChunks = 0;
        stats.lastUpdate = null;
        stats.folderPath = null;
      }

      // Remove folder path
      this.sessionFolderPaths.delete(sessionId);

      console.log(`✅ [LOCAL_RAG] Local database cleared for session: ${sessionId}`);
    } catch (error) {
      console.error(`❌ [LOCAL_RAG] Failed to clear database for session ${sessionId}:`, error);
      throw error;
    }
  }

  /**
   * Delete session database completely (called on session close)
   */
  async deleteSessionDatabase(sessionId: string): Promise<void> {
    try {
      console.log(`🗑️ [LOCAL_RAG] Deleting local database for session: ${sessionId}`);
      
      const table = this.sessionDatabases.get(sessionId);
      if (table) {
        // Delete session table using VectorDatabaseService
        await this.vectorDb.deleteSessionTable(sessionId);
        
        // Remove from memory
        this.sessionDatabases.delete(sessionId);
      }

      // Clean up stats and folder paths
      this.sessionStats.delete(sessionId);
      this.sessionFolderPaths.delete(sessionId);

      console.log(`✅ [LOCAL_RAG] Local database deleted for session: ${sessionId}`);
    } catch (error) {
      console.error(`❌ [LOCAL_RAG] Failed to delete database for session ${sessionId}:`, error);
      // Don't throw - this is cleanup
    }
  }

  /**
   * Get list of all active session databases
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessionDatabases.keys());
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.vectorDb.isReady();
  }

  /**
   * Get supported file formats
   */
  getSupportedFormats(): string[] {
    return this.documentProcessor.getSupportedExtensions();
  }

  /**
   * Close the service and cleanup resources
   */
  async close(): Promise<void> {
    try {
      // Delete all session databases
      for (const sessionId of this.sessionDatabases.keys()) {
        await this.deleteSessionDatabase(sessionId);
      }

      // Close vector database
      await this.vectorDb.close();
      
      console.log('✅ [LOCAL_RAG] Local RAG service closed');
    } catch (error) {
      console.error('❌ [LOCAL_RAG] Failed to close service:', error);
    }
  }
}
