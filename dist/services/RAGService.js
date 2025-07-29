"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.RAGService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const crypto_1 = require("crypto");
class RAGService {
    constructor() {
        this.knowledgeBases = new Map();
        this.maxChunkSize = 1000; // Characters per chunk
        this.overlapSize = 200; // Overlap between chunks
        // Initialize RAG service
    }
    /**
     * Ingest documents from a folder
     */
    async ingestDocuments(folderPath, sessionId) {
        try {
            console.log(`Starting document ingestion for session ${sessionId} from ${folderPath}`);
            if (!fs.existsSync(folderPath)) {
                throw new Error('Folder path does not exist');
            }
            const files = fs.readdirSync(folderPath);
            const supportedExtensions = ['.txt', '.md'];
            const documents = [];
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
                    }
                    catch (error) {
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
        }
        catch (error) {
            console.error('Document ingestion failed:', error);
            throw new Error(`Failed to ingest documents: ${error.message}`);
        }
    }
    /**
     * Process a single file
     */
    async processFile(filePath, sessionId) {
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
            const document = {
                id: (0, crypto_1.randomUUID)(),
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
        }
        catch (error) {
            console.error(`Failed to process file ${filePath}:`, error);
            throw error;
        }
    }
    /**
     * Build embeddings for documents (simplified implementation)
     */
    async buildEmbeddings(documents) {
        try {
            for (const document of documents) {
                // Split document into chunks
                const chunks = this.splitIntoChunks(document.content);
                // For now, create simple embeddings based on word frequency
                // In a production system, you would use a proper embedding model
                document.embedding = this.createSimpleEmbedding(document.content);
                console.log(`Created embedding for document: ${document.filename}`);
            }
        }
        catch (error) {
            console.error('Failed to build embeddings:', error);
            throw error;
        }
    }
    /**
     * Split text into chunks
     */
    splitIntoChunks(text) {
        const chunks = [];
        let startIndex = 0;
        while (startIndex < text.length) {
            let endIndex = startIndex + this.maxChunkSize;
            // Try to break at a sentence or word boundary
            if (endIndex < text.length) {
                const sentenceEnd = text.lastIndexOf('.', endIndex);
                const wordEnd = text.lastIndexOf(' ', endIndex);
                if (sentenceEnd > startIndex + this.maxChunkSize / 2) {
                    endIndex = sentenceEnd + 1;
                }
                else if (wordEnd > startIndex + this.maxChunkSize / 2) {
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
    createSimpleEmbedding(text) {
        // This is a very simplified embedding approach
        // In production, use proper embedding models like sentence-transformers
        const words = text.toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(word => word.length > 2);
        const wordFreq = {};
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
    async searchRelevantContent(query, sessionId) {
        try {
            const knowledgeBase = this.knowledgeBases.get(sessionId);
            if (!knowledgeBase || knowledgeBase.documents.length === 0) {
                return [];
            }
            // Create embedding for query
            const queryEmbedding = this.createSimpleEmbedding(query);
            // Calculate similarity scores
            const similarities = [];
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
            const relevantContent = [];
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
        }
        catch (error) {
            console.error('Failed to search relevant content:', error);
            return [];
        }
    }
    /**
     * Find the best chunk within a document for the query
     */
    findBestChunk(query, chunks) {
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
    calculateCosineSimilarity(vec1, vec2) {
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
    getKnowledgeBase(sessionId) {
        return this.knowledgeBases.get(sessionId) || null;
    }
    /**
     * Clear knowledge base for a session
     */
    clearKnowledgeBase(sessionId) {
        this.knowledgeBases.delete(sessionId);
    }
    /**
     * Get service status
     */
    getStatus() {
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
exports.RAGService = RAGService;
