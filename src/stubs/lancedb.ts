// File-based vector database stub implementation
import * as fs from 'fs';
import * as path from 'path';

export interface Connection {
  createTable(name: string, data: any[]): Promise<Table>;
  openTable(name: string): Promise<Table>;
  dropTable(name: string): Promise<void>;
  tableNames(): Promise<string[]>;
}

export interface Table {
  add(data: any[]): Promise<void>;
  delete(condition: string): Promise<void>;
  search(vector: number[]): VectorSearch;
  countRows(): Promise<number>;
}

export interface VectorSearch {
  limit(n: number): VectorSearch;
  where(condition: string): VectorSearch;
  toArray(): Promise<any[]>;
}

class FileVectorSearch implements VectorSearch {
  private limitValue: number = 10;
  private tablePath: string;
  private queryVector: number[];

  constructor(tablePath: string, queryVector: number[]) {
    this.tablePath = tablePath;
    this.queryVector = queryVector;
  }

  limit(n: number): VectorSearch {
    this.limitValue = n;
    return this;
  }

  where(condition: string): VectorSearch {
    return this;
  }

  async toArray(): Promise<any[]> {
    try {
      if (!fs.existsSync(this.tablePath)) {
        return [];
      }
      
      const data = JSON.parse(fs.readFileSync(this.tablePath, 'utf8'));
      
      // Simple cosine similarity search
      const results = data.map((doc: any) => {
        const similarity = this.cosineSimilarity(this.queryVector, doc.vector);
        return {
          ...doc,
          _distance: similarity
        };
      });
      
      // Sort by similarity and limit
      return results
        .sort((a, b) => b._distance - a._distance)
        .slice(0, this.limitValue);
    } catch (error) {
      console.error('Search failed:', error);
      return [];
    }
  }

  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) return 0;
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB)) || 0;
  }
}

class FileTable implements Table {
  private tablePath: string;
  private tableName: string;

  constructor(dbPath: string, tableName: string) {
    this.tableName = tableName;
    this.tablePath = path.join(dbPath, `${tableName}.json`);
  }

  async add(data: any[]): Promise<void> {
    try {
      let existingData: any[] = [];
      
      if (fs.existsSync(this.tablePath)) {
        const content = fs.readFileSync(this.tablePath, 'utf8');
        existingData = content ? JSON.parse(content) : [];
      }
      
      existingData.push(...data);
      
      // Ensure directory exists
      const dir = path.dirname(this.tablePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.tablePath, JSON.stringify(existingData, null, 2));
      console.log(`📄 [FILE_DB] Added ${data.length} documents to ${this.tableName}`);
    } catch (error) {
      console.error(`Failed to add data to ${this.tableName}:`, error);
      throw error;
    }
  }

  async delete(condition: string): Promise<void> {
    try {
      if (!fs.existsSync(this.tablePath)) {
        return;
      }
      
      let data = JSON.parse(fs.readFileSync(this.tablePath, 'utf8'));
      
      // Simple condition parsing for "id = value" format
      if (condition.includes('id = ')) {
        const idMatch = condition.match(/id = "([^"]+)"/);
        if (idMatch) {
          const targetId = idMatch[1];
          data = data.filter((doc: any) => doc.id !== targetId);
        }
      } else if (condition === 'id IS NOT NULL') {
        // Clear all documents
        data = [];
      }
      
      fs.writeFileSync(this.tablePath, JSON.stringify(data, null, 2));
      console.log(`🗑️ [FILE_DB] Deleted documents from ${this.tableName} with condition: ${condition}`);
    } catch (error) {
      console.error(`Failed to delete from ${this.tableName}:`, error);
      throw error;
    }
  }

  search(vector: number[]): VectorSearch {
    return new FileVectorSearch(this.tablePath, vector);
  }

  async countRows(): Promise<number> {
    try {
      if (!fs.existsSync(this.tablePath)) {
        return 0;
      }
      
      const data = JSON.parse(fs.readFileSync(this.tablePath, 'utf8'));
      return Array.isArray(data) ? data.length : 0;
    } catch (error) {
      console.error(`Failed to count rows in ${this.tableName}:`, error);
      return 0;
    }
  }
}

class FileConnection implements Connection {
  private dbPath: string;
  private tables: Map<string, FileTable> = new Map();

  constructor(dbPath: string) {
    this.dbPath = dbPath;
    // Ensure database directory exists
    if (!fs.existsSync(dbPath)) {
      fs.mkdirSync(dbPath, { recursive: true });
    }
  }

  async createTable(name: string, data: any[]): Promise<Table> {
    const table = new FileTable(this.dbPath, name);
    this.tables.set(name, table);
    
    if (data && data.length > 0) {
      await table.add(data);
    }
    
    console.log(`📊 [FILE_DB] Created table: ${name}`);
    return table;
  }

  async openTable(name: string): Promise<Table> {
    if (!this.tables.has(name)) {
      this.tables.set(name, new FileTable(this.dbPath, name));
    }
    return this.tables.get(name)!;
  }

  async dropTable(name: string): Promise<void> {
    const tablePath = path.join(this.dbPath, `${name}.json`);
    if (fs.existsSync(tablePath)) {
      fs.unlinkSync(tablePath);
      console.log(`🗑️ [FILE_DB] Dropped table: ${name}`);
    }
    this.tables.delete(name);
  }

  async tableNames(): Promise<string[]> {
    try {
      if (!fs.existsSync(this.dbPath)) {
        return [];
      }
      
      const files = fs.readdirSync(this.dbPath);
      return files
        .filter(file => file.endsWith('.json'))
        .map(file => path.basename(file, '.json'));
    } catch (error) {
      console.error('Failed to list tables:', error);
      return [];
    }
  }
}

export async function connect(uri: string): Promise<Connection> {
  console.log(`📊 [FILE_DB] Connecting to file-based database at: ${uri}`);
  return new FileConnection(uri);
}
