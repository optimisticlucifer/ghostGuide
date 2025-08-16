import { connect, Connection, Table } from '../stubs/lancedb';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';

export interface VectorDocument {
  id: string;
  text: string;
  vector: number[];
  metadata: {
    filename: string;
    fileType: string;
    uploadDate: string;
    chunk_index: number;
    source: 'global' | 'local';
    sessionId?: string;
  };
}

export interface SearchResult {
  id: string;
  text: string;
  score: number;
  metadata: VectorDocument['metadata'];
}

export class VectorDatabaseService {
  private connection: Connection | null = null;
  private dbPath: string;

  constructor() {
    this.dbPath = path.join(app.getPath('userData'), 'interview-assistant', 'vector-db');
    this.ensureDbDirectory();
  }

  private ensureDbDirectory(): void {
    if (!fs.existsSync(this.dbPath)) {
      fs.mkdirSync(this.dbPath, { recursive: true });
    }
  }

  /**
   * Initialize the database connection
   */
  async initialize(): Promise<void> {
    try {
      this.connection = await connect(this.dbPath);
      console.log('✅ [VECTOR_DB] LanceDB connection established');

      // Ensure required tables exist
      await this.ensureTables();
    } catch (error) {
      console.error('❌ [VECTOR_DB] Failed to initialize LanceDB:', error);
      throw new Error(`Vector database initialization failed: ${(error as Error).message}`);
    }
  }

  /**
   * Ensure required tables exist
   */
  private async ensureTables(): Promise<void> {
    if (!this.connection) {
      throw new Error('Database connection not initialized');
    }

    try {
      // Check if global_documents table exists
      const tableNames = await this.connection.tableNames();
      
      if (!tableNames.includes('global_documents')) {
        // Create global documents table with initial empty data
        const sampleData = [{
          id: 'init',
          text: 'initialization document',
          vector: new Array(384).fill(0), // 384-dimensional vector for sentence transformers
          metadata: {
            filename: 'init.txt',
            fileType: 'txt',
            uploadDate: new Date().toISOString(),
            chunk_index: 0,
            source: 'global' as const
          }
        }];

        await this.connection.createTable('global_documents', sampleData);
        
        // Remove the initialization document
        const table = await this.connection.openTable('global_documents');
        await table.delete('id = "init"');
        
        console.log('✅ [VECTOR_DB] Created global_documents table');
      }

    } catch (error) {
      console.error('❌ [VECTOR_DB] Failed to ensure tables:', error);
      throw error;
    }
  }

  /**
   * Get or create a table for local session documents
   */
  async getSessionTable(sessionId: string): Promise<Table> {
    if (!this.connection) {
      throw new Error('Database connection not initialized');
    }

    const tableName = `session_${sessionId.replace(/[-]/g, '_')}`;
    
    try {
      const tableNames = await this.connection.tableNames();
      
      if (!tableNames.includes(tableName)) {
        // Create session-specific table
        const sampleData = [{
          id: 'init',
          text: 'initialization document',
          vector: new Array(384).fill(0),
          metadata: {
            filename: 'init.txt',
            fileType: 'txt',
            uploadDate: new Date().toISOString(),
            chunk_index: 0,
            source: 'local' as const,
            sessionId: sessionId
          }
        }];

        await this.connection.createTable(tableName, sampleData);
        const table = await this.connection.openTable(tableName);
        await table.delete('id = "init"');
        
        console.log(`✅ [VECTOR_DB] Created session table: ${tableName}`);
        return table;
      } else {
        return await this.connection.openTable(tableName);
      }
    } catch (error) {
      console.error(`❌ [VECTOR_DB] Failed to get session table ${tableName}:`, error);
      throw error;
    }
  }

  /**
   * Get the global documents table
   */
  async getGlobalTable(): Promise<Table> {
    if (!this.connection) {
      throw new Error('Database connection not initialized');
    }

    try {
      return await this.connection.openTable('global_documents');
    } catch (error) {
      console.error('❌ [VECTOR_DB] Failed to get global table:', error);
      throw error;
    }
  }

  /**
   * Insert documents into a table
   */
  async insertDocuments(table: Table, documents: VectorDocument[]): Promise<void> {
    try {
      await table.add(documents);
      console.log(`✅ [VECTOR_DB] Inserted ${documents.length} documents`);
    } catch (error) {
      console.error('❌ [VECTOR_DB] Failed to insert documents:', error);
      throw error;
    }
  }

  /**
   * Search for similar documents using vector similarity
   */
  async searchSimilar(
    table: Table,
    queryVector: number[],
    limit: number = 5,
    threshold: number = 0.7
  ): Promise<SearchResult[]> {
    try {
      const results = await table
        .search(queryVector)
        .limit(limit)
        .toArray();

      return results.map(result => ({
        id: result.id,
        text: result.text,
        score: result._distance || 0,
        metadata: result.metadata
      })).filter(result => result.score >= threshold);

    } catch (error) {
      console.error('❌ [VECTOR_DB] Search failed:', error);
      throw error;
    }
  }

  /**
   * Delete all documents from a table (used for refresh operations)
   */
  async clearTable(table: Table): Promise<void> {
    try {
      await table.delete('id IS NOT NULL'); // Delete all records
      console.log('✅ [VECTOR_DB] Table cleared');
    } catch (error) {
      console.error('❌ [VECTOR_DB] Failed to clear table:', error);
      throw error;
    }
  }

  /**
   * Delete a session table completely
   */
  async deleteSessionTable(sessionId: string): Promise<void> {
    if (!this.connection) {
      throw new Error('Database connection not initialized');
    }

    const tableName = `session_${sessionId.replace(/[-]/g, '_')}`;
    
    try {
      await this.connection.dropTable(tableName);
      console.log(`✅ [VECTOR_DB] Deleted session table: ${tableName}`);
    } catch (error) {
      console.error(`❌ [VECTOR_DB] Failed to delete session table ${tableName}:`, error);
      // Don't throw - table might not exist
    }
  }

  /**
   * Get database statistics
   */
  async getStats(): Promise<{
    globalDocuments: number;
    sessionTables: string[];
    totalSize: string;
  }> {
    if (!this.connection) {
      return {
        globalDocuments: 0,
        sessionTables: [],
        totalSize: '0 MB'
      };
    }

    try {
      const tableNames = await this.connection.tableNames();
      const globalTable = await this.getGlobalTable();
      
      // Count global documents
      const globalCount = await globalTable.countRows();
      
      // Find session tables
      const sessionTables = tableNames.filter(name => name.startsWith('session_'));
      
      // Calculate total file size
      let totalSizeBytes = 0;
      if (fs.existsSync(this.dbPath)) {
        const files = fs.readdirSync(this.dbPath);
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(this.dbPath, file);
            const stats = fs.statSync(filePath);
            totalSizeBytes += stats.size;
          }
        }
      }
      
      const totalSize = totalSizeBytes > 0 
        ? `${(totalSizeBytes / 1024 / 1024).toFixed(2)} MB`
        : '0 B';

      console.log(`📊 [VECTOR_DB] Stats: ${globalCount} global docs, ${sessionTables.length} session tables, ${totalSize}`);

      return {
        globalDocuments: globalCount,
        sessionTables,
        totalSize
      };
    } catch (error) {
      console.error('❌ [VECTOR_DB] Failed to get stats:', error);
      return {
        globalDocuments: 0,
        sessionTables: [],
        totalSize: '0 MB'
      };
    }
  }

  /**
   * Close the database connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      // LanceDB connections are automatically closed when the process ends
      this.connection = null;
      console.log('✅ [VECTOR_DB] Connection closed');
    }
  }

  /**
   * Check if the service is ready
   */
  isReady(): boolean {
    return this.connection !== null;
  }

  /**
   * Get the database path
   */
  getDbPath(): string {
    return this.dbPath;
  }
}
