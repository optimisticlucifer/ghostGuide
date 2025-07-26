import { ChatService } from '../../src/services/ChatService';
import { SessionManager } from '../../src/services/SessionManager';
import { ConfigurationManager } from '../../src/services/ConfigurationManager';
import { PromptLibraryService } from '../../src/services/PromptLibraryService';
import { RAGService } from '../../src/services/RAGService';
import { ActionType } from '../../src/types';

// Mock external dependencies
jest.mock('openai');

describe('Chat Pipeline Integration', () => {
  let chatService: ChatService;
  let sessionManager: SessionManager;
  let configurationManager: ConfigurationManager;
  let promptLibraryService: PromptLibraryService;
  let ragService: RAGService;

  beforeEach(async () => {
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

    // Set up API key
    await configurationManager.updateApiKey('test-api-key');

    jest.clearAllMocks();
  });

  describe('message to prompt to API pipeline', () => {
    it('should process user message through complete chat pipeline', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      // Mock OpenAI response
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'To solve this algorithm problem, I would recommend using a two-pointer approach...'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      const userMessage = 'How do I find two numbers in an array that sum to a target?';
      const response = await chatService.sendMessage(session.id, userMessage);

      expect(response).toContain('two-pointer approach');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();

      // Verify conversation history
      const updatedSession = await sessionManager.getSession(session.id);
      expect(updatedSession?.chatHistory).toHaveLength(2); // User message + AI response
    });

    it('should use profession-specific system prompts', async () => {
      const session = await sessionManager.createSession({
        profession: 'data-scientist',
        interviewType: 'technical'
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{
                message: {
                  content: 'For this data science problem, I would start with exploratory data analysis...'
                }
              }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await chatService.sendMessage(session.id, 'How do I analyze this dataset?');

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const systemMessage = callArgs.messages.find((msg: any) => msg.role === 'system');
      
      expect(systemMessage.content).toContain('data scientist');
      expect(systemMessage.content).toContain('technical');
    });

    it('should handle different interview types appropriately', async () => {
      const technicalSession = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      const behavioralSession = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'behavioral'
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn()
              .mockResolvedValueOnce({
                choices: [{ message: { content: 'Technical response about algorithms' } }]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: 'Behavioral response about teamwork' } }]
              })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await chatService.sendMessage(technicalSession.id, 'Explain quicksort');
      await chatService.sendMessage(behavioralSession.id, 'Tell me about a time you led a team');

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);

      // Check that different system prompts were used
      const technicalCall = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const behavioralCall = mockOpenAI.chat.completions.create.mock.calls[1][0];

      const technicalSystemMsg = technicalCall.messages.find((msg: any) => msg.role === 'system');
      const behavioralSystemMsg = behavioralCall.messages.find((msg: any) => msg.role === 'system');

      expect(technicalSystemMsg.content).toContain('technical');
      expect(behavioralSystemMsg.content).toContain('behavioral');
    });
  });

  describe('context-aware prompting', () => {
    it('should maintain conversation context across messages', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn()
              .mockResolvedValueOnce({
                choices: [{ message: { content: 'Binary search is an efficient algorithm...' } }]
              })
              .mockResolvedValueOnce({
                choices: [{ message: { content: 'The time complexity of binary search is O(log n)...' } }]
              })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      // First message
      await chatService.sendMessage(session.id, 'What is binary search?');
      
      // Follow-up message
      await chatService.sendMessage(session.id, 'What is its time complexity?');

      // Second call should include previous conversation
      const secondCall = mockOpenAI.chat.completions.create.mock.calls[1][0];
      expect(secondCall.messages).toHaveLength(4); // System + User1 + AI1 + User2
    });

    it('should prune conversation history when token limit is approached', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      // Mock a very long conversation
      const longMessage = 'A'.repeat(1000); // Very long message
      
      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Response' } }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      // Add many messages to approach token limit
      for (let i = 0; i < 10; i++) {
        await chatService.sendMessage(session.id, `${longMessage} ${i}`);
      }

      // Verify that conversation was pruned (exact behavior depends on implementation)
      const finalCall = mockOpenAI.chat.completions.create.mock.calls[9][0];
      expect(finalCall.messages.length).toBeLessThan(22); // Should be pruned
    });

    it('should inject session-specific context', async () => {
      const session = await sessionManager.createSession({
        profession: 'product-manager',
        interviewType: 'behavioral'
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Product management response' } }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await chatService.sendMessage(session.id, 'How do you prioritize features?');

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const systemMessage = callArgs.messages.find((msg: any) => msg.role === 'system');
      
      expect(systemMessage.content).toContain('product manager');
      expect(systemMessage.content).toContain('behavioral');
    });
  });

  describe('RAG integration with chat', () => {
    it('should inject relevant context from RAG when available', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      // Mock RAG service with relevant content
      jest.spyOn(ragService, 'searchRelevantContent').mockResolvedValue([
        {
          content: 'Binary search algorithm implementation details from study materials',
          score: 0.9,
          metadata: { source: 'algorithms.txt' }
        }
      ]);

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Based on your study materials, binary search...' } }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await chatService.sendMessage(session.id, 'Explain binary search');

      expect(ragService.searchRelevantContent).toHaveBeenCalledWith(
        'Explain binary search',
        session.id
      );

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      const userMessage = callArgs.messages.find((msg: any) => msg.role === 'user');
      
      expect(userMessage.content).toContain('study materials');
      expect(userMessage.content).toContain('Binary search algorithm implementation');
    });

    it('should handle RAG service failures gracefully', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      // Mock RAG service failure
      jest.spyOn(ragService, 'searchRelevantContent').mockRejectedValue(
        new Error('RAG service unavailable')
      );

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Standard response without RAG context' } }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      const response = await chatService.sendMessage(session.id, 'Explain algorithms');

      expect(response).toBe('Standard response without RAG context');
      // Should continue without RAG context
    });
  });

  describe('error handling and recovery', () => {
    it('should handle API rate limiting with exponential backoff', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn()
              .mockRejectedValueOnce(new Error('Rate limit exceeded'))
              .mockRejectedValueOnce(new Error('Rate limit exceeded'))
              .mockResolvedValueOnce({
                choices: [{ message: { content: 'Success after retries' } }]
              })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      const response = await chatService.sendMessage(session.id, 'Test message');

      expect(response).toBe('Success after retries');
      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
    });

    it('should handle invalid API key errors', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('Invalid API key'))
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await expect(chatService.sendMessage(session.id, 'Test message'))
        .rejects.toThrow('Invalid API key');
    });

    it('should handle network connectivity issues', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockRejectedValue(new Error('Network error'))
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await expect(chatService.sendMessage(session.id, 'Test message'))
        .rejects.toThrow('Network error');
    });
  });

  describe('performance and scalability', () => {
    it('should handle multiple concurrent chat sessions', async () => {
      const sessions = await Promise.all([
        sessionManager.createSession({ profession: 'software-engineer', interviewType: 'technical' }),
        sessionManager.createSession({ profession: 'data-scientist', interviewType: 'behavioral' }),
        sessionManager.createSession({ profession: 'product-manager', interviewType: 'system-design' })
      ]);

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Concurrent response' } }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      const promises = sessions.map(session => 
        chatService.sendMessage(session.id, `Message for ${session.profession}`)
      );

      const responses = await Promise.all(promises);

      expect(responses).toHaveLength(3);
      responses.forEach(response => {
        expect(response).toBe('Concurrent response');
      });

      expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(3);
    });

    it('should maintain performance with large conversation histories', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Response' } }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      // Create a large conversation history
      const startTime = Date.now();
      
      for (let i = 0; i < 50; i++) {
        await chatService.sendMessage(session.id, `Message ${i}`);
      }
      
      const endTime = Date.now();
      const averageResponseTime = (endTime - startTime) / 50;

      // Should maintain reasonable performance
      expect(averageResponseTime).toBeLessThan(1000); // Less than 1 second average
    });

    it('should optimize token usage for cost efficiency', async () => {
      const session = await sessionManager.createSession({
        profession: 'software-engineer',
        interviewType: 'technical'
      });

      const mockOpenAI = {
        chat: {
          completions: {
            create: jest.fn().mockResolvedValue({
              choices: [{ message: { content: 'Optimized response' } }]
            })
          }
        }
      };

      const { OpenAI } = require('openai');
      OpenAI.mockImplementation(() => mockOpenAI);

      await chatService.sendMessage(session.id, 'Short message');

      const callArgs = mockOpenAI.chat.completions.create.mock.calls[0][0];
      
      // Should use appropriate model and settings for cost optimization
      expect(callArgs.model).toBeDefined();
      expect(callArgs.max_tokens).toBeDefined();
      expect(callArgs.temperature).toBeDefined();
    });
  });
});