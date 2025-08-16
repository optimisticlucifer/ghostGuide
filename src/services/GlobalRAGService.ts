import { VectorDatabaseService, VectorDocument, SearchResult } from './VectorDatabaseService';
import { DocumentProcessor, ProcessedDocument } from './DocumentProcessor';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export interface GlobalRAGStats {
  totalDocuments: number;
  totalChunks: number;
  lastUpdate: string | null;
  databaseSize: string;
  supportedFormats: string[];
}

export class GlobalRAGService {
  private vectorDb: VectorDatabaseService;
  private documentProcessor: DocumentProcessor;
  private isInitialized = false;
  private lastIndexedPath: string | null = null;

  constructor() {
    this.vectorDb = new VectorDatabaseService();
    this.documentProcessor = new DocumentProcessor();
  }

  /**
   * Initialize the global RAG service
   */
  async initialize(): Promise<void> {
    try {
      if (this.isInitialized) {
        return;
      }

      console.log('🚀 [GLOBAL_RAG] Initializing Global RAG service...');
      
      await this.vectorDb.initialize();
      this.isInitialized = true;
      
      console.log('✅ [GLOBAL_RAG] Global RAG service initialized successfully');
    } catch (error) {
      console.error('❌ [GLOBAL_RAG] Failed to initialize Global RAG service:', error);
      throw new Error(`Global RAG initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Index documents from a folder into the global knowledge base
   */
  async indexFolder(folderPath: string): Promise<{
    success: boolean;
    documentsProcessed: number;
    chunksAdded: number;
    errors: string[];
  }> {
    if (!this.isInitialized) {
      throw new Error('Global RAG service not initialized');
    }

    const result = {
      success: false,
      documentsProcessed: 0,
      chunksAdded: 0,
      errors: [] as string[]
    };

    try {
      console.log(`📁 [GLOBAL_RAG] Starting to index folder: ${folderPath}`);
      
      // Process documents in the folder
      const processedDocuments = await this.documentProcessor.processFolder(folderPath);
      
      if (processedDocuments.length === 0) {
        console.log('⚠️ [GLOBAL_RAG] No documents found to process');
        result.success = true;
        return result;
      }

      // Get the global documents table
      const globalTable = await this.vectorDb.getGlobalTable();

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
                source: 'global'
              }
            };

            vectorDocuments.push(vectorDoc);
          } catch (error) {
            console.error(`❌ [GLOBAL_RAG] Failed to create embedding for chunk ${chunk.id}:`, error);
            result.errors.push(`Failed to create embedding for ${doc.filename} chunk ${chunk.chunkIndex}`);
          }
        }
      }

      // Insert vector documents into the database
      if (vectorDocuments.length > 0) {
        await this.vectorDb.insertDocuments(globalTable, vectorDocuments);
        result.chunksAdded = vectorDocuments.length;
      }

      result.documentsProcessed = processedDocuments.length;
      result.success = true;
      this.lastIndexedPath = folderPath;

      console.log(`✅ [GLOBAL_RAG] Successfully indexed ${result.documentsProcessed} documents (${result.chunksAdded} chunks)`);
      
      return result;

    } catch (error) {
      console.error('❌ [GLOBAL_RAG] Failed to index folder:', error);
      result.errors.push(`Failed to index folder: ${(error as Error).message}`);
      return result;
    }
  }

  /**
   * Refresh the global knowledge base (clear and re-index)
   */
  async refreshGlobalKnowledgeBase(folderPath?: string): Promise<{
    success: boolean;
    documentsProcessed: number;
    chunksAdded: number;
    errors: string[];
  }> {
    if (!this.isInitialized) {
      throw new Error('Global RAG service not initialized');
    }

    try {
      console.log('🔄 [GLOBAL_RAG] Refreshing global knowledge base...');
      
      // Clear the global table
      const globalTable = await this.vectorDb.getGlobalTable();
      await this.vectorDb.clearTable(globalTable);
      
      console.log('✅ [GLOBAL_RAG] Cleared existing global knowledge base');

      // Re-index if folder path is provided
      if (folderPath) {
        return await this.indexFolder(folderPath);
      } else if (this.lastIndexedPath) {
        return await this.indexFolder(this.lastIndexedPath);
      } else {
        console.log('⚠️ [GLOBAL_RAG] No folder path provided for re-indexing');
        return {
          success: true,
          documentsProcessed: 0,
          chunksAdded: 0,
          errors: []
        };
      }

    } catch (error) {
      console.error('❌ [GLOBAL_RAG] Failed to refresh global knowledge base:', error);
      return {
        success: false,
        documentsProcessed: 0,
        chunksAdded: 0,
        errors: [`Failed to refresh: ${(error as Error).message}`]
      };
    }
  }

  /**
   * Search for relevant context in the global knowledge base
   */
  async searchRelevantContext(
    query: string,
    limit: number = 5,
    threshold: number = 0.3
  ): Promise<SearchResult[]> {
    if (!this.isInitialized) {
      throw new Error('Global RAG service not initialized');
    }

    try {
      console.log(`🔍 [GLOBAL_RAG] Searching for: "${query.substring(0, 50)}..."`);
      
      // Create query embedding
      const queryEmbedding = this.documentProcessor.createSimpleEmbedding(query);
      
      // Search in the global table
      const globalTable = await this.vectorDb.getGlobalTable();
      const results = await this.vectorDb.searchSimilar(
        globalTable, 
        queryEmbedding, 
        limit, 
        threshold
      );

      console.log(`✅ [GLOBAL_RAG] Found ${results.length} relevant documents`);
      return results;

    } catch (error) {
      console.error('❌ [GLOBAL_RAG] Search failed:', error);
      return [];
    }
  }

  /**
   * Get formatted context strings from search results
   */
  async getContextStrings(query: string, limit: number = 3): Promise<string[]> {
    const searchResults = await this.searchRelevantContext(query, limit);
    
    return searchResults.map(result => {
      // Show more context for better RAG performance - increase from 2000 to 4000 characters
      return `[Global: ${result.metadata.filename}] ${result.text.substring(0, 4000)}${result.text.length > 4000 ? '...' : ''}`;
    });
  }

  /**
   * Get global RAG statistics
   */
  async getStats(): Promise<GlobalRAGStats> {
    try {
      if (!this.isInitialized) {
        return {
          totalDocuments: 0,
          totalChunks: 0,
          lastUpdate: null,
          databaseSize: '0 MB',
          supportedFormats: this.documentProcessor.getSupportedExtensions()
        };
      }

      const dbStats = await this.vectorDb.getStats();
      
      return {
        totalDocuments: Math.ceil(dbStats.globalDocuments / 5), // Rough estimate based on avg chunks per doc
        totalChunks: dbStats.globalDocuments,
        lastUpdate: this.lastIndexedPath ? new Date().toISOString() : null,
        databaseSize: dbStats.totalSize,
        supportedFormats: this.documentProcessor.getSupportedExtensions()
      };

    } catch (error) {
      console.error('❌ [GLOBAL_RAG] Failed to get stats:', error);
      return {
        totalDocuments: 0,
        totalChunks: 0,
        lastUpdate: null,
        databaseSize: '0 MB',
        supportedFormats: this.documentProcessor.getSupportedExtensions()
      };
    }
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.vectorDb.isReady();
  }

  /**
   * Get supported file formats
   */
  getSupportedFormats(): string[] {
    return this.documentProcessor.getSupportedExtensions();
  }

  /**
   * Get the last indexed folder path
   */
  getLastIndexedPath(): string | null {
    return this.lastIndexedPath;
  }

  /**
   * Clear all global documents
   */
  async clearGlobalKnowledgeBase(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Global RAG service not initialized');
    }

    try {
      console.log('🗑️ [GLOBAL_RAG] Clearing global knowledge base...');
      
      const globalTable = await this.vectorDb.getGlobalTable();
      await this.vectorDb.clearTable(globalTable);
      
      this.lastIndexedPath = null;
      
      console.log('✅ [GLOBAL_RAG] Global knowledge base cleared');
    } catch (error) {
      console.error('❌ [GLOBAL_RAG] Failed to clear global knowledge base:', error);
      throw error;
    }
  }

  /**
   * Close the service and cleanup resources
   */
  async close(): Promise<void> {
    try {
      await this.vectorDb.close();
      this.isInitialized = false;
      console.log('✅ [GLOBAL_RAG] Global RAG service closed');
    } catch (error) {
      console.error('❌ [GLOBAL_RAG] Failed to close service:', error);
    }
  }
}
