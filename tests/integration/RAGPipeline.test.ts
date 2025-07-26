import { RAGService } from '../../src/services/RAGService';
import { ChatService } from '../../src/services/ChatService';
import { SessionManager } from '../../src/services/SessionManager';
import { ConfigurationManager } from '../../src/services/ConfigurationManager';
import { PromptLibraryService } from '../../src/services/PromptLibraryService';
import * as fs from 'fs';

// Mock external dependencies
jest.mock('sqlite3');
jest.mock('openai');
jest.mock('fs');

describe('RAG Pipeline Integration', () => {
  let ragService: RAGService;
  let chatService: ChatService;
  let sessionManager: SessionManager;
  let configurationManager: ConfigurationManager;
  let promptLibraryService: PromptLibraryService;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(async () => {
    mockFs = fs as jest.Mocked<typeof fs>;
    
    // Initialize services
    configurationManager = new ConfigurationManager();
    await configurationManager.initialize();
    
    promptLibraryService = new PromptLibraryService(configurationManager);
    sessionManager = new SessionManager();
    ragService = new RAGService();
    
    chatService = new ChatService(
      configurationManager,
      promptLibraryService,
      sessionManager,
      ragService
    );

    await configurationManager.updateApiKey('test-api-key');

    jest.clearAllMocks();
  });

  describe('document ingestion pipeline', () => {
    it('should ingest text documents successfully', async () => {
      const sessionId = 'test-session';
      const folderPath = '/test/documents';

      // Mock file system
      mockFs.readdirSync.mockReturnValue([
        'algorithms.txt',
        'data-structures.md',
        'system-design.pdf'
      ] as any);

      mockFs.readFileSync.mockImplementation((filePath) => {
        if (filePath.toString().includes('algorithms.txt')) {
          return 'Binary search is an efficient algorithm for finding items in sorted arrays...';
        } else if (filePath.toString().includes('data-structures.md')) {
          return '# Data Structures\n\nArrays, linked lists, trees, and graphs are fundamental data structures...';
        }
        return 'Mock file content';
      });

      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 1024
      } as any);

      await ragService.ingestDocuments(folderPath, sessionId);

      const knowledgeBase = ragService.getKnowledgeBase(sessionId);
      expect(knowledgeBase).toBeDefined();
      expect(knowledgeBase?.documents.length).toBeGreaterThan(0);
    });

    it('should handle different file types (.txt, .md, .pdf, .pptx)', async () => {
      const sessionId = 'test-session';
      const folderPath = '/test/mixed-documents';

      mockFs.readdirSync.mockReturnValue([
        'notes.txt',
        'readme.md',
        'presentation.pdf',
        'slides.pptx',
        'image.jpg' // Should be ignored
      ] as any);

      mockFs.readFileSync.mockImplementation((filePath) => {
        const path = filePath.toString();
        if (path.includes('.txt')) return 'Text file content';
        if (path.includes('.md')) return '# Markdown content';
        return 'Other content';
      });

      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 1024
      } as any);

      // Mock document processor for PDF and PPTX
      jest.spyOn(ragService as any, 'processFile').mockImplementation(async (filePath) => {
        if (filePath.includes('.pdf')) {
          return {
            id: 'pdf-doc',
            content: 'PDF document content',
            metadata: { fileType: '.pdf', pageCount: 5 }
          };
        }
        if (filePath.includes('.pptx')) {
          return {
            id: 'pptx-doc',
            content: 'PowerPoint slide content',
            metadata: { fileType: '.pptx', pageCount: 10 }
          };
        }
        return null;
      });

      await ragService.ingestDocuments(folderPath, sessionId);

      const knowledgeBase = ragService.getKnowledgeBase(sessionId);
      expect(knowledgeBase?.documents.length).toBe(4); // Should exclude .jpg file
    });

    it('should chunk large documents appropriately', async () => {
      const sessionId = 'test-session';
      const folderPath = '/test/large-documents';

      // Mock large document
      const largeContent = 'A'.repeat(5000); // 5KB content
      
      mockFs.readdirSync.mockReturnValue(['large-doc.txt'] as any);
      mockFs.readFileSync.mockReturnValue(largeContent);
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 5000
      } as any);

      await ragService.ingestDocuments(folderPath, sessionId);

      const knowledgeBase = ragService.getKnowledgeBase(sessionId);
      const document = knowledgeBase?.documents[0];
      
      expect(document).toBeDefined();
      // Should be chunked if larger than max chunk size
      expect(document?.content.length).toBeLessThanOrEqual(1000);
    });

    it('should generate embeddings for document chunks', async () => {
      const sessionId = 'test-session';
      const folderPath = '/test/documents';

      mockFs.readdirSync.mockReturnValue(['test.txt'] as any);
      mockFs.readFileSync.mockReturnValue('Test document content for embedding generation');
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 100
      } as any);

      await ragService.ingestDocuments(folderPath, sessionId);

      const knowledgeBase = ragService.getKnowledgeBase(sessionId);
      const document = knowledgeBase?.documents[0];
      
      expect(document?.embedding).toBeDefined();
      expect(document?.embedding.length).toBeGreaterThan(0);
    });
  });

  describe('document retrieval and search', () => {
    beforeEach(async () => {
      const sessionId = 'test-session';
      
      // Setup test documents
      mockFs.readdirSync.mockReturnValue([
        'algorithms.txt',
        'databases.txt',
        'networking.txt'
      ] as any);

      mockFs.readFileSync.mockImplementation((filePath) => {
        const path = filePath.toString();
        if (path.includes('algorithms')) {
          return 'Binary search, quicksort, and merge sort are fundamental algorithms';
        } else if (path.includes('databases')) {
          return 'SQL databases use ACID properties and normalization';
        } else if (path.includes('networking')) {
          return 'TCP/IP protocol stack includes application, transport, network, and data link layers';
        }
        return 'Default content';
      });

      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 100
      } as any);

      await ragService.ingestDocuments('/test/docs', sessionId);
    });

    it('should find relevant content based on query similarity', async () => {
      const sessionId = 'test-session';
      const query = 'How does binary search work?';

      const results = await ragService.searchRelevantContent(query, sessionId);

      expect(results).toBeDefined();
      expect(results.length).toBeGreaterThan(0);
      
      // Should find algorithm-related content
      const algorithmResult = results.find(r => r.content.includes('Binary search'));
      expect(algorithmResult).toBeDefined();
      expect(algorithmResult?.score).toBeGreaterThan(0);
    });

    it('should rank results by relevance score', async () => {
      const sessionId = 'test-session';
      const query = 'database normalization';

      const results = await ragService.searchRelevantContent(query, sessionId);

      expect(results.length).toBeGreaterThan(0);
      
      // Results should be sorted by score (highest first)
      for (let i = 1; i < results.length; i++) {
        expect(results[i-1].score).toBeGreaterThanOrEqual(results[i].score);
      }
    });

    it('should limit results to specified count', async () => {
      const sessionId = 'test-session';
      const query = 'computer science';

      const results = await ragService.searchRelevantContent(query, sessionId, 2);

      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should handle queries with no relevant results', async () => {
      const sessionId = 'test-session';
      const query = 'quantum physics'; // Not in our test documents

      const results = await ragService.searchRelevantContent(query, sessionId);

      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      // May return empty array or low-relevance results
    });
  });

  describe('RAG integration with chat service', () => {
    beforeEach(async () => {
      const sessionId = 'test-session';
      
      // Setup knowledge base
      mockFs.readdirSync.mockReturnValue(['study-guide.txt'] as any);
      mockFs.readFileSync.mockReturnValue(
        'Dynamic programming is an optimization technique that solves complex problems by breaking them down into simpler subproblems'
      );
      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 100
      } as any);

      await ragService.ingestDocuments('/test/study-materials', sessionId);
    });

    it('should enhance chat responses with relevant document context', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      // Mock OpenAI to verify RAG context is included
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'Based on your study materials, dynamic programming is indeed an optimization technique...'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      const response = await chatService.sendMessage(session.id, 'Explain dynamic programming');

      expect(response).toContain('study materials');
      
      // Verify RAG context was injected
      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user');
      expect(userMessage.content).toContain('optimization technique');
    });

    it('should maintain session isolation for knowledge bases', async () => {
      const session1 = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      const session2 = await sessionManager.createSession({
        profession: 'data-scientist',
        interviewType: 'technical'
      });

      // Add different documents to each session
      mockFs.readdirSync.mockReturnValue(['session1-doc.txt'] as any);
      mockFs.readFileSync.mockReturnValue('Session 1 specific content');
      mockFs.statSync.mockReturnValue({ isFile: () => true, size: 100 } as any);
      
      await ragService.ingestDocuments('/session1/docs', session1.id);

      mockFs.readdirSync.mockReturnValue(['session2-doc.txt'] as any);
      mockFs.readFileSync.mockReturnValue('Session 2 specific content');
      
      await ragService.ingestDocuments('/session2/docs', session2.id);

      // Verify isolation
      const kb1 = ragService.getKnowledgeBase(session1.id);
      const kb2 = ragService.getKnowledgeBase(session2.id);

      expect(kb1?.documents[0].content).toContain('Session 1');
      expect(kb2?.documents[0].content).toContain('Session 2');
      expect(kb1?.documents[0].content).not.toContain('Session 2');
      expect(kb2?.documents[0].content).not.toContain('Session 1');
    });

    it('should gracefully handle RAG service failures', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      // Mock RAG search failure
      jest.spyOn(ragService, 'searchRelevantContent').mockRejectedValue(
        new Error('Vector database unavailable')
      );

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'Standard response without RAG enhancement'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      const response = await chatService.sendMessage(session.id, 'Test question');

      expect(response).toBe('Standard response without RAG enhancement');
      // Should continue without RAG context when service fails
    });
  });

  describe('end-to-end RAG pipeline', () => {
    it('should complete full document ingestion to enhanced response pipeline', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'system-design'
      });

      // Mock comprehensive study materials
      mockFs.readdirSync.mockReturnValue([
        'system-design-basics.txt',
        'scalability-patterns.md',
        'database-design.pdf'
      ] as any);

      mockFs.readFileSync.mockImplementation((filePath) => {
        const path = filePath.toString();
        if (path.includes('system-design-basics')) {
          return 'Load balancers distribute traffic across multiple servers to improve availability and performance';
        } else if (path.includes('scalability-patterns')) {
          return '# Scalability Patterns\n\nHorizontal scaling involves adding more servers, while vertical scaling means upgrading existing hardware';
        }
        return 'Database design content';
      });

      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 200
      } as any);

      // Ingest documents
      await ragService.ingestDocuments('/study-materials', session.id);

      // Mock OpenAI response that uses RAG context
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'Based on your study materials about load balancers and scalability patterns, I recommend using horizontal scaling with load balancers...'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      // Ask question that should trigger RAG
      const response = await chatService.sendMessage(
        session.id, 
        'How do I design a scalable web application?'
      );

      // Verify end-to-end pipeline
      expect(response).toContain('study materials');
      expect(response).toContain('load balancers');
      expect(response).toContain('horizontal scaling');

      // Verify knowledge base was created
      const knowledgeBase = ragService.getKnowledgeBase(session.id);
      expect(knowledgeBase?.documents.length).toBe(3);
    });

    it('should handle mixed content types in single pipeline', async () => {
      const session = await sessionManager.createSession({
        profession: 'data-scientist',
        interviewType: 'technical'
      });

      // Mock mixed file types
      mockFs.readdirSync.mockReturnValue([
        'statistics.txt',
        'machine-learning.md',
        'data-analysis.pdf'
      ] as any);

      mockFs.readFileSync.mockImplementation((filePath) => {
        const path = filePath.toString();
        if (path.includes('statistics')) {
          return 'Central limit theorem states that sample means approach normal distribution';
        } else if (path.includes('machine-learning')) {
          return '# Machine Learning\n\nSupervised learning uses labeled data to train models';
        }
        return 'Data analysis content';
      });

      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 150
      } as any);

      await ragService.ingestDocuments('/data-science-materials', session.id);

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'Your study materials mention the central limit theorem and supervised learning...'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      const response = await chatService.sendMessage(
        session.id,
        'Explain the relationship between statistics and machine learning'
      );

      expect(response).toContain('central limit theorem');
      expect(response).toContain('supervised learning');
    });
  });

  describe('performance and scalability', () => {
    it('should handle large document collections efficiently', async () => {
      const sessionId = 'large-collection-session';
      
      // Mock large number of documents
      const fileNames = Array.from({ length: 100 }, (_, i) => `doc${i}.txt`);
      mockFs.readdirSync.mockReturnValue(fileNames as any);
      
      mockFs.readFileSync.mockImplementation((filePath) => {
        const index = filePath.toString().match(/doc(\d+)/)?.[1] || '0';
        return `Document ${index} content with unique information about topic ${index}`;
      });

      mockFs.statSync.mockReturnValue({
        isFile: () => true,
        size: 100
      } as any);

      const startTime = Date.now();
      await ragService.ingestDocuments('/large-collection', sessionId);
      const endTime = Date.now();

      const knowledgeBase = ragService.getKnowledgeBase(sessionId);
      expect(knowledgeBase?.documents.length).toBe(100);
      
      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(10000); // Less than 10 seconds
    });

    it('should maintain search performance with large knowledge base', async () => {
      const sessionId = 'performance-test-session';
      
      // Setup large knowledge base (mocked)
      const knowledgeBase = {
        id: sessionId,
        documents: Array.from({ length: 1000 }, (_, i) => ({
          id: `doc-${i}`,
          content: `Document ${i} with searchable content`,
          embedding: Array.from({ length: 100 }, () => Math.random()),
          metadata: { source: `doc${i}.txt` }
        })),
        lastUpdated: new Date()
      };

      jest.spyOn(ragService, 'getKnowledgeBase').mockReturnValue(knowledgeBase);

      const startTime = Date.now();
      const results = await ragService.searchRelevantContent('searchable content', sessionId, 10);
      const endTime = Date.now();

      expect(results.length).toBeLessThanOrEqual(10);
      expect(endTime - startTime).toBeLessThan(1000); // Less than 1 second
    });
  });
});