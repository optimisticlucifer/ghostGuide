import * as fs from 'fs';
import * as path from 'path';
import { Document, KnowledgeBase } from '../types';
import { randomUUID } from 'crypto';

interface DocumentChunk {
  id: string;
  documentId: string;
  content: string;
  chunkIndex: number;
  embedding?: number[];
}

export class RAGService {
  private knowledgeBases: Map<string, KnowledgeBase> = new Map();
  private maxChunkSize = 1000; // Characters per chunk
  private overlapSize = 200; // Overlap between chunks

  constructor() {
    // Initialize RAG service
  }

  /**
   * Ingest documents from a folder
   */
  async ingestDocuments(folderPath: string, sessionId: string): Promise<void> {
    try {
      console.log(`Starting document ingestion for session ${sessionId} from ${folderPath}`);
      
      if (!fs.existsSync(folderPath)) {
        throw new Error('Folder path does not exist');
      }

      const files = fs.readdirSync(folderPath);
      const supportedExtensions = ['.txt', '.md'];
      const documents: Document[] = [];

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        const ext = path.extname(file).toLowerCase();
        
        if (supportedExtensions.includes(ext)) {
          try {
            const document = await this.processFile(filePath, sessionId);
            if (document) {
              documents.push(document);
              console.log(`Processed document: ${file}`);
            }
          } catch (error) {
            console.error(`Failed to process file ${file}:`, error);
            // Continue with other files
          }
        }
      }

      // Create or update knowledge base
      let knowledgeBase = this.knowledgeBases.get(sessionId);
      if (!knowledgeBase) {
        knowledgeBase = {
          sessionId,
          documents: [],
          vectorIndex: null, // Placeholder for vector index
          lastUpdated: new Date()
        };
        this.knowledgeBases.set(sessionId, knowledgeBase);
      }

      // Add new documents
      knowledgeBase.documents.push(...documents);
      knowledgeBase.lastUpdated = new Date();

      // Build embeddings for new documents
      await this.buildEmbeddings(documents);

      console.log(`Ingested ${documents.length} documents for session ${sessionId}`);
    } catch (error) {
      console.error('Document ingestion failed:', error);
      throw new Error(`Failed to ingest documents: ${(error as Error).message}`);
    }
  }

  /**
   * Process a single file
   */
  private async processFile(filePath: string, sessionId: string): Promise<Document | null> {
    try {
      const stats = fs.statSync(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const filename = path.basename(filePath);

      let content = '';

      switch (ext) {
        case '.txt':
        case '.md':
          content = fs.readFileSync(filePath, 'utf8');
          break;
        default:
          console.warn(`Unsupported file type: ${ext}`);
          return null;
      }

      if (!content || content.trim().length === 0) {
        console.warn(`Empty file: ${filename}`);
        return null;
      }

      // Create document
      const document: Document = {
        id: randomUUID(),
        sessionId,
        filename,
        content: content.trim(),
        embedding: [], // Will be populated by buildEmbeddings
        metadata: {
          fileType: ext,
          uploadDate: new Date(),
          pageCount: 1 // For text files, always 1 page
        }
      };

      return document;
    } catch (error) {
      console.error(`Failed to process file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Build embeddings for documents (simplified implementation)
   */
  async buildEmbeddings(documents: Document[]): Promise<void> {
    try {
      for (const document of documents) {
        // Split document into chunks
        const chunks = this.splitIntoChunks(document.content);
        
        // For now, create simple embeddings based on word frequency
        // In a production system, you would use a proper embedding model
        document.embedding = this.createSimpleEmbedding(document.content);
        
        console.log(`Created embedding for document: ${document.filename}`);
      }
    } catch (error) {
      console.error('Failed to build embeddings:', error);
      throw error;
    }
  }

  /**
   * Split text into chunks
   */
  private splitIntoChunks(text: string): string[] {
    const chunks: string[] = [];
    let startIndex = 0;

    while (startIndex < text.length) {
      let endIndex = startIndex + this.maxChunkSize;
      
      // Try to break at a sentence or word boundary
      if (endIndex < text.length) {
        const sentenceEnd = text.lastIndexOf('.', endIndex);
        const wordEnd = text.lastIndexOf(' ', endIndex);
        
        if (sentenceEnd > startIndex + this.maxChunkSize / 2) {
          endIndex = sentenceEnd + 1;
        } else if (wordEnd > startIndex + this.maxChunkSize / 2) {
          endIndex = wordEnd;
        }
      }

      const chunk = text.substring(startIndex, endIndex).trim();
      if (chunk.length > 0) {
        chunks.push(chunk);
      }

      // Move start index with overlap
      startIndex = Math.max(endIndex - this.overlapSize, endIndex);
    }

    return chunks;
  }

  /**
   * Create simple embedding based on word frequency (placeholder)
   */
  private createSimpleEmbedding(text: string): number[] {
    // This is a very simplified embedding approach
    // In production, use proper embedding models like sentence-transformers
    
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2);

    const wordFreq: Record<string, number> = {};
    for (const word of words) {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    }

    // Create a fixed-size embedding vector (100 dimensions)
    const embedding = new Array(100).fill(0);
    const commonWords = Object.keys(wordFreq).slice(0, 100);
    
    for (let i = 0; i < commonWords.length; i++) {
      embedding[i] = wordFreq[commonWords[i]] / words.length;
    }

    return embedding;
  }

  /**
   * Search for relevant content
   */
  async searchRelevantContent(query: string, sessionId: string): Promise<string[]> {
    try {
      const knowledgeBase = this.knowledgeBases.get(sessionId);
      if (!knowledgeBase || knowledgeBase.documents.length === 0) {
        return [];
      }

      // Create embedding for query
      const queryEmbedding = this.createSimpleEmbedding(query);

      // Calculate similarity scores
      const similarities: Array<{ document: Document; score: number }> = [];
      
      for (const document of knowledgeBase.documents) {
        if (document.embedding && document.embedding.length > 0) {
          const similarity = this.calculateCosineSimilarity(queryEmbedding, document.embedding);
          similarities.push({ document, score: similarity });
        }
      }

      // Sort by similarity and return top results
      similarities.sort((a, b) => b.score - a.score);
      const topResults = similarities.slice(0, 3); // Top 3 most relevant

      // Return relevant content chunks
      const relevantContent: string[] = [];
      for (const result of topResults) {
        if (result.score > 0.1) { // Minimum similarity threshold
          // Split content into smaller chunks for context
          const chunks = this.splitIntoChunks(result.document.content);
          const bestChunk = this.findBestChunk(query, chunks);
          if (bestChunk) {
            relevantContent.push(`From ${result.document.filename}:\n${bestChunk}`);
          }
        }
      }

      return relevantContent;
    } catch (error) {
      console.error('Failed to search relevant content:', error);
      return [];
    }
  }

  /**
   * Find the best chunk within a document for the query
   */
  private findBestChunk(query: string, chunks: string[]): string | null {
    const queryWords = query.toLowerCase().split(/\s+/);
    let bestChunk = '';
    let bestScore = 0;

    for (const chunk of chunks) {
      const chunkLower = chunk.toLowerCase();
      let score = 0;
      
      for (const word of queryWords) {
        if (chunkLower.includes(word)) {
          score += 1;
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestChunk = chunk;
      }
    }

    return bestScore > 0 ? bestChunk : chunks[0]; // Return first chunk if no matches
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  private calculateCosineSimilarity(vec1: number[], vec2: number[]): number {
    if (vec1.length !== vec2.length) {
      return 0;
    }

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    if (norm1 === 0 || norm2 === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Get knowledge base for a session
   */
  getKnowledgeBase(sessionId: string): KnowledgeBase | null {
    return this.knowledgeBases.get(sessionId) || null;
  }

  /**
   * Clear knowledge base for a session
   */
  clearKnowledgeBase(sessionId: string): void {
    this.knowledgeBases.delete(sessionId);
  }

  /**
   * Get service status
   */
  getStatus(): any {
    return {
      activeSessions: this.knowledgeBases.size,
      totalDocuments: Array.from(this.knowledgeBases.values())
        .reduce((total, kb) => total + kb.documents.length, 0),
      knowledgeBases: Array.from(this.knowledgeBases.entries()).map(([sessionId, kb]) => ({
        sessionId,
        documentCount: kb.documents.length,
        lastUpdated: kb.lastUpdated
      }))
    };
  }
}