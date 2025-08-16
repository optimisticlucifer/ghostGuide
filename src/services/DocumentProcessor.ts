import * as fs from 'fs';
import * as path from 'path';
import pdfParse from 'pdf-parse';
import * as mammoth from 'mammoth';
import { TfIdf } from 'natural';

export interface ProcessedDocument {
  id: string;
  filename: string;
  fileType: string;
  content: string;
  chunks: DocumentChunk[];
  metadata: {
    size: number;
    lastModified: Date;
    wordCount: number;
    chunkCount: number;
  };
}

export interface DocumentChunk {
  id: string;
  text: string;
  chunkIndex: number;
  filename: string;
  startPosition: number;
  endPosition: number;
}

export class DocumentProcessor {
  private supportedExtensions = ['.txt', '.md', '.pdf', '.doc', '.docx'];
  private chunkSize = 5000; // characters
  private chunkOverlap = 500; // characters
  private tfidf: TfIdf;

  constructor() {
    this.tfidf = new TfIdf();
  }

  /**
   * Check if a file type is supported
   */
  isSupported(filename: string): boolean {
    const ext = path.extname(filename).toLowerCase();
    return this.supportedExtensions.includes(ext);
  }

  /**
   * Get list of supported file extensions
   */
  getSupportedExtensions(): string[] {
    return [...this.supportedExtensions];
  }

  /**
   * Process a single document
   */
  async processDocument(filePath: string): Promise<ProcessedDocument> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const filename = path.basename(filePath);
    const fileType = path.extname(filename).toLowerCase().slice(1);
    const stats = fs.statSync(filePath);

    if (!this.isSupported(filename)) {
      throw new Error(`Unsupported file type: ${fileType}`);
    }

    try {
      console.log(`📄 [DOC_PROCESSOR] Processing ${filename}...`);

      // Extract text content based on file type
      const content = await this.extractTextContent(filePath, fileType);
      
      // Create text chunks
      const chunks = this.createChunks(content, filename);

      // Count words
      const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

      const document: ProcessedDocument = {
        id: this.generateDocumentId(filePath),
        filename,
        fileType,
        content,
        chunks,
        metadata: {
          size: stats.size,
          lastModified: stats.mtime,
          wordCount,
          chunkCount: chunks.length
        }
      };

      console.log(`✅ [DOC_PROCESSOR] Processed ${filename}: ${chunks.length} chunks, ${wordCount} words`);
      return document;

    } catch (error) {
      console.error(`❌ [DOC_PROCESSOR] Failed to process ${filename}:`, error);
      throw new Error(`Document processing failed: ${(error as Error).message}`);
    }
  }

  /**
   * Process multiple documents from a folder
   */
  async processFolder(folderPath: string): Promise<ProcessedDocument[]> {
    if (!fs.existsSync(folderPath)) {
      throw new Error(`Folder not found: ${folderPath}`);
    }

    const results: ProcessedDocument[] = [];
    const files = fs.readdirSync(folderPath);
    
    console.log(`📁 [DOC_PROCESSOR] Processing folder: ${folderPath}`);
    console.log(`📁 [DOC_PROCESSOR] Found ${files.length} files`);

    for (const file of files) {
      const filePath = path.join(folderPath, file);
      const stats = fs.statSync(filePath);

      // Skip directories and unsupported files
      if (stats.isDirectory() || !this.isSupported(file)) {
        console.log(`⏭️ [DOC_PROCESSOR] Skipping ${file} (${stats.isDirectory() ? 'directory' : 'unsupported'})`);
        continue;
      }

      try {
        const document = await this.processDocument(filePath);
        results.push(document);
      } catch (error) {
        console.error(`⚠️ [DOC_PROCESSOR] Failed to process ${file}:`, (error as Error).message);
        // Continue processing other files
      }
    }

    console.log(`✅ [DOC_PROCESSOR] Processed ${results.length} documents from folder`);
    return results;
  }

  /**
   * Extract text content based on file type
   */
  private async extractTextContent(filePath: string, fileType: string): Promise<string> {
    switch (fileType) {
      case 'txt':
      case 'md':
        return fs.readFileSync(filePath, 'utf8');

      case 'pdf':
        try {
          const pdfBuffer = fs.readFileSync(filePath);
          console.log(`📄 [PDF] Processing PDF buffer of size: ${pdfBuffer.length} bytes`);
          
          const pdfData = await pdfParse(pdfBuffer);
          console.log(`📄 [PDF] Extracted ${pdfData.text.length} characters from PDF`);
          
          if (!pdfData.text || pdfData.text.trim().length === 0) {
            throw new Error('No text content found in PDF');
          }
          
          return pdfData.text;
        } catch (error) {
          console.error(`❌ [PDF] Failed to parse PDF:`, error);
          throw new Error(`PDF parsing failed: ${(error as Error).message}`);
        }

      case 'doc':
      case 'docx':
        try {
          const docBuffer = fs.readFileSync(filePath);
          console.log(`📄 [DOC] Processing Word document buffer of size: ${docBuffer.length} bytes`);
          
          const docResult = await mammoth.extractRawText({ buffer: docBuffer });
          console.log(`📄 [DOC] Extracted ${docResult.value.length} characters from Word document`);
          
          if (!docResult.value || docResult.value.trim().length === 0) {
            throw new Error('No text content found in Word document');
          }
          
          return docResult.value;
        } catch (error) {
          console.error(`❌ [DOC] Failed to parse Word document:`, error);
          throw new Error(`Word document parsing failed: ${(error as Error).message}`);
        }

      default:
        throw new Error(`Unsupported file type: ${fileType}`);
    }
  }

  /**
   * Create text chunks from content
   */
  private createChunks(content: string, filename: string): DocumentChunk[] {
    const chunks: DocumentChunk[] = [];
    const cleanContent = this.cleanText(content);
    
    if (cleanContent.length <= this.chunkSize) {
      // Content is small enough to be a single chunk
      chunks.push({
        id: this.generateChunkId(filename, 0),
        text: cleanContent,
        chunkIndex: 0,
        filename,
        startPosition: 0,
        endPosition: cleanContent.length
      });
      return chunks;
    }

    let startPosition = 0;
    let chunkIndex = 0;

    while (startPosition < cleanContent.length) {
      let endPosition = Math.min(startPosition + this.chunkSize, cleanContent.length);

      // Try to end at a sentence boundary
      if (endPosition < cleanContent.length) {
        const sentenceEnd = this.findSentenceEnd(cleanContent, endPosition);
        if (sentenceEnd > startPosition && sentenceEnd - startPosition <= this.chunkSize + 100) {
          endPosition = sentenceEnd;
        }
      }

      const chunkText = cleanContent.slice(startPosition, endPosition);
      
      if (chunkText.trim().length > 0) {
        chunks.push({
          id: this.generateChunkId(filename, chunkIndex),
          text: chunkText.trim(),
          chunkIndex,
          filename,
          startPosition,
          endPosition
        });
        chunkIndex++;
      }

      // Move start position with overlap
      startPosition = Math.max(endPosition - this.chunkOverlap, startPosition + 1);
    }

    return chunks;
  }

  /**
   * Find the end of a sentence near the given position
   */
  private findSentenceEnd(text: string, position: number): number {
    const sentenceEnders = ['.', '!', '?', '\n\n'];
    let bestPosition = position;

    // Look backwards for sentence endings within reasonable distance
    for (let i = position; i > position - 200 && i >= 0; i--) {
      if (sentenceEnders.includes(text[i])) {
        bestPosition = i + 1;
        break;
      }
    }

    return bestPosition;
  }

  /**
   * Clean and normalize text
   */
  private cleanText(text: string): string {
    return text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Remove excessive newlines
      .replace(/\n{3,}/g, '\n\n')
      // Trim
      .trim();
  }

  /**
   * Generate a unique document ID
   */
  private generateDocumentId(filePath: string): string {
    const filename = path.basename(filePath);
    const timestamp = Date.now();
    return `doc_${filename.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;
  }

  /**
   * Generate a unique chunk ID
   */
  private generateChunkId(filename: string, chunkIndex: number): string {
    const cleanFilename = filename.replace(/[^a-zA-Z0-9]/g, '_');
    return `chunk_${cleanFilename}_${chunkIndex}_${Date.now()}`;
  }

  /**
   * Create simple embeddings using TF-IDF (basic implementation)
   * For production, you'd want to use a proper embedding model
   */
  createSimpleEmbedding(text: string): number[] {
    // Simple TF-IDF based embedding (384 dimensions to match sentence transformers)
    const words = text.toLowerCase().split(/\s+/).filter(word => word.length > 2);
    
    // Create a simple frequency vector
    const wordFreq: { [key: string]: number } = {};
    words.forEach(word => {
      wordFreq[word] = (wordFreq[word] || 0) + 1;
    });

    // Convert to fixed-size vector (384 dimensions)
    const embedding = new Array(384).fill(0);
    const wordList = Object.keys(wordFreq);
    
    wordList.slice(0, 384).forEach((word, index) => {
      // Simple hash function to map words to dimensions
      const hash = this.simpleHash(word) % 384;
      embedding[hash] = Math.log(1 + wordFreq[word]);
    });

    // Normalize the vector
    const magnitude = Math.sqrt(embedding.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 0) {
      return embedding.map(val => val / magnitude);
    }

    return embedding;
  }

  /**
   * Simple hash function for words
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Get processing statistics
   */
  getStats(): {
    supportedExtensions: string[];
    chunkSize: number;
    chunkOverlap: number;
  } {
    return {
      supportedExtensions: [...this.supportedExtensions],
      chunkSize: this.chunkSize,
      chunkOverlap: this.chunkOverlap
    };
  }

  /**
   * Update processing configuration
   */
  updateConfig(config: {
    chunkSize?: number;
    chunkOverlap?: number;
  }): void {
    if (config.chunkSize && config.chunkSize > 0) {
      this.chunkSize = config.chunkSize;
    }
    if (config.chunkOverlap && config.chunkOverlap >= 0) {
      this.chunkOverlap = config.chunkOverlap;
    }

    console.log(`⚙️ [DOC_PROCESSOR] Config updated: chunkSize=${this.chunkSize}, chunkOverlap=${this.chunkOverlap}`);
  }
}
