import { PromptLibraryService } from '../../src/services/PromptLibraryService';
import { ConfigurationManager } from '../../src/services/ConfigurationManager';
import { ActionType, PromptTemplate } from '../../src/types';

// Mock ConfigurationManager
jest.mock('../../src/services/ConfigurationManager');

describe('PromptLibraryService', () => {
  let promptLibraryService: PromptLibraryService;
  let mockConfigurationManager: jest.Mocked<ConfigurationManager>;

  const mockPromptLibrary = {
    'software-engineer': {
      'technical': {
        system: 'You are a technical interview assistant for {profession} interviews.',
        actions: {
          [ActionType.SCREENSHOT]: 'Analyze this technical question for {profession}.',
          [ActionType.DEBUG]: 'Debug this code for {profession} interview.',
          [ActionType.GENERAL]: 'Provide general guidance for {profession}.'
        }
      },
      'behavioral': {
        system: 'You are a behavioral interview assistant for {profession}.',
        actions: {
          [ActionType.SCREENSHOT]: 'Analyze this behavioral question.',
          [ActionType.DEBUG]: 'Not applicable for behavioral interviews.',
          [ActionType.GENERAL]: 'Provide behavioral guidance.'
        }
      }
    },
    'data-scientist': {
      'technical': {
        system: 'You are a data science interview assistant.',
        actions: {
          [ActionType.SCREENSHOT]: 'Analyze this data science question.',
          [ActionType.DEBUG]: 'Debug this data science code.',
          [ActionType.GENERAL]: 'Provide data science guidance.'
        }
      }
    }
  };

  beforeEach(() => {
    mockConfigurationManager = new ConfigurationManager() as jest.Mocked<ConfigurationManager>;
    mockConfigurationManager.getPromptLibrary.mockReturnValue(mockPromptLibrary);
    mockConfigurationManager.updatePromptLibrary.mockResolvedValue(undefined);

    promptLibraryService = new PromptLibraryService(mockConfigurationManager);
    jest.clearAllMocks();
  });

  describe('getSystemPrompt', () => {
    it('should return system prompt with resolved variables', () => {
      const result = promptLibraryService.getSystemPrompt('software-engineer', 'technical');

      expect(result).toBe('You are a technical interview assistant for software-engineer interviews.');
      expect(mockConfigurationManager.getPromptLibrary).toHaveBeenCalled();
    });

    it('should cache resolved prompts', () => {
      // First call
      promptLibraryService.getSystemPrompt('software-engineer', 'technical');
      // Second call
      promptLibraryService.getSystemPrompt('software-engineer', 'technical');

      // Should only call getPromptLibrary once due to caching
      expect(mockConfigurationManager.getPromptLibrary).toHaveBeenCalledTimes(1);
    });

    it('should return fallback prompt for non-existent profession', () => {
      const result = promptLibraryService.getSystemPrompt('non-existent', 'technical');

      expect(result).toContain('non existent interview assistant');
      expect(result).toContain('technical interview questions');
    });

    it('should return fallback prompt for non-existent interview type', () => {
      const result = promptLibraryService.getSystemPrompt('software-engineer', 'non-existent');

      expect(result).toContain('software engineer interview assistant');
      expect(result).toContain('non-existent interview questions');
    });

    it('should handle configuration manager errors gracefully', () => {
      mockConfigurationManager.getPromptLibrary.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      const result = promptLibraryService.getSystemPrompt('software-engineer', 'technical');

      expect(result).toContain('software engineer interview assistant');
    });
  });

  describe('getActionPrompt', () => {
    it('should return action prompt with resolved variables', () => {
      const result = promptLibraryService.getActionPrompt(ActionType.SCREENSHOT, 'software-engineer', 'technical');

      expect(result).toBe('Analyze this technical question for software-engineer.');
      expect(mockConfigurationManager.getPromptLibrary).toHaveBeenCalled();
    });

    it('should cache resolved action prompts', () => {
      // First call
      promptLibraryService.getActionPrompt(ActionType.SCREENSHOT, 'software-engineer', 'technical');
      // Second call
      promptLibraryService.getActionPrompt(ActionType.SCREENSHOT, 'software-engineer', 'technical');

      // Should only call getPromptLibrary once due to caching
      expect(mockConfigurationManager.getPromptLibrary).toHaveBeenCalledTimes(1);
    });

    it('should return fallback prompt for non-existent action', () => {
      const result = promptLibraryService.getActionPrompt(ActionType.DEBUG, 'software-engineer', 'non-existent');

      expect(result).toContain('Review this code for bugs');
      expect(result).toContain('software engineer');
    });

    it('should handle different action types correctly', () => {
      const screenshotResult = promptLibraryService.getActionPrompt(ActionType.SCREENSHOT, 'data-scientist', 'technical');
      const debugResult = promptLibraryService.getActionPrompt(ActionType.DEBUG, 'data-scientist', 'technical');

      expect(screenshotResult).toBe('Analyze this data science question.');
      expect(debugResult).toBe('Debug this data science code.');
    });
  });

  describe('savePromptTemplate', () => {
    it('should save system prompt template', async () => {
      const template: PromptTemplate = {
        profession: 'software-engineer',
        interviewType: 'technical',
        action: ActionType.GENERAL,
        template: 'New system prompt for {profession}'
      };

      await promptLibraryService.savePromptTemplate(template);

      expect(mockConfigurationManager.updatePromptLibrary).toHaveBeenCalledWith(
        expect.objectContaining({
          'software-engineer': expect.objectContaining({
            'technical': expect.objectContaining({
              system: 'New system prompt for {profession}'
            })
          })
        })
      );
    });

    it('should save action prompt template', async () => {
      const template: PromptTemplate = {
        profession: 'software-engineer',
        interviewType: 'technical',
        action: ActionType.SCREENSHOT,
        template: 'New screenshot prompt for {profession}'
      };

      await promptLibraryService.savePromptTemplate(template);

      expect(mockConfigurationManager.updatePromptLibrary).toHaveBeenCalledWith(
        expect.objectContaining({
          'software-engineer': expect.objectContaining({
            'technical': expect.objectContaining({
              actions: expect.objectContaining({
                [ActionType.SCREENSHOT]: 'New screenshot prompt for {profession}'
              })
            })
          })
        })
      );
    });

    it('should create new profession and interview type if they do not exist', async () => {
      const template: PromptTemplate = {
        profession: 'new-profession',
        interviewType: 'new-type',
        action: ActionType.GENERAL,
        template: 'New template'
      };

      await promptLibraryService.savePromptTemplate(template);

      expect(mockConfigurationManager.updatePromptLibrary).toHaveBeenCalledWith(
        expect.objectContaining({
          'new-profession': {
            'new-type': {
              system: 'New template',
              actions: {}
            }
          }
        })
      );
    });

    it('should clear cache after saving template', async () => {
      // First, populate cache
      promptLibraryService.getSystemPrompt('software-engineer', 'technical');
      expect(mockConfigurationManager.getPromptLibrary).toHaveBeenCalledTimes(1);

      const template: PromptTemplate = {
        profession: 'software-engineer',
        interviewType: 'technical',
        action: ActionType.GENERAL,
        template: 'Updated template'
      };

      await promptLibraryService.savePromptTemplate(template);

      // After saving, cache should be cleared, so next call should fetch from config again
      promptLibraryService.getSystemPrompt('software-engineer', 'technical');
      expect(mockConfigurationManager.getPromptLibrary).toHaveBeenCalledTimes(2);
    });
  });

  describe('getPromptTemplates', () => {
    it('should return prompt templates for existing profession and interview type', () => {
      const result = promptLibraryService.getPromptTemplates('software-engineer', 'technical');

      expect(result).toEqual({
        system: 'You are a technical interview assistant for {profession} interviews.',
        actions: {
          [ActionType.SCREENSHOT]: 'Analyze this technical question for {profession}.',
          [ActionType.DEBUG]: 'Debug this code for {profession} interview.',
          [ActionType.GENERAL]: 'Provide general guidance for {profession}.'
        }
      });
    });

    it('should return default templates for non-existent profession', () => {
      const result = promptLibraryService.getPromptTemplates('non-existent', 'technical');

      expect(result.system).toContain('non existent interview assistant');
      expect(result.actions[ActionType.SCREENSHOT]).toContain('Analyze this technical question');
    });
  });

  describe('getAvailableProfessions', () => {
    it('should return list of available professions', () => {
      const result = promptLibraryService.getAvailableProfessions();

      expect(result).toEqual(['software-engineer', 'data-scientist']);
    });

    it('should return default professions on error', () => {
      mockConfigurationManager.getPromptLibrary.mockImplementation(() => {
        throw new Error('Configuration error');
      });

      const result = promptLibraryService.getAvailableProfessions();

      expect(result).toEqual(['software-engineer', 'data-scientist', 'product-manager', 'designer']);
    });
  });

  describe('getAvailableInterviewTypes', () => {
    it('should return interview types for existing profession', () => {
      const result = promptLibraryService.getAvailableInterviewTypes('software-engineer');

      expect(result).toEqual(['technical', 'behavioral']);
    });

    it('should return default interview types for non-existent profession', () => {
      const result = promptLibraryService.getAvailableInterviewTypes('non-existent');

      expect(result).toEqual(['technical', 'behavioral', 'system-design']);
    });
  });

  describe('validatePromptTemplate', () => {
    it('should validate valid template', () => {
      const template: PromptTemplate = {
        profession: 'software-engineer',
        interviewType: 'technical',
        action: ActionType.SCREENSHOT,
        template: 'Valid template with {profession} variable'
      };

      const result = promptLibraryService.validatePromptTemplate(template);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing profession', () => {
      const template: PromptTemplate = {
        profession: '',
        interviewType: 'technical',
        action: ActionType.SCREENSHOT,
        template: 'Template content'
      };

      const result = promptLibraryService.validatePromptTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Profession is required');
    });

    it('should detect missing interview type', () => {
      const template: PromptTemplate = {
        profession: 'software-engineer',
        interviewType: '',
        action: ActionType.SCREENSHOT,
        template: 'Template content'
      };

      const result = promptLibraryService.validatePromptTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Interview type is required');
    });

    it('should detect missing template content', () => {
      const template: PromptTemplate = {
        profession: 'software-engineer',
        interviewType: 'technical',
        action: ActionType.SCREENSHOT,
        template: ''
      };

      const result = promptLibraryService.validatePromptTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Template content is required');
    });

    it('should detect invalid variable names', () => {
      const template: PromptTemplate = {
        profession: 'software-engineer',
        interviewType: 'technical',
        action: ActionType.SCREENSHOT,
        template: 'Template with {invalid_variable} and {profession}'
      };

      const result = promptLibraryService.validatePromptTemplate(template);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid variable name: invalid_variable');
    });
  });

  describe('template resolution', () => {
    it('should resolve template variables correctly', () => {
      const template = 'Hello {profession}, this is a {interview_type} interview for {action}';
      const variables = {
        profession: 'software-engineer',
        interview_type: 'technical',
        action: 'screenshot'
      };

      const result = promptLibraryService.resolveTemplate(template, variables);

      expect(result).toBe('Hello software-engineer, this is a technical interview for screenshot');
    });

    it('should handle conditional sections', () => {
      const template = 'Base content {{if profession}}for {profession}{{endif}}';
      const variables = { profession: 'software-engineer' };

      const result = promptLibraryService.resolveTemplate(template, variables);

      expect(result).toBe('Base content for software-engineer');
    });

    it('should remove conditional sections when variable is empty', () => {
      const template = 'Base content {{if profession}}for {profession}{{endif}}';
      const variables = { profession: '' };

      const result = promptLibraryService.resolveTemplate(template, variables);

      expect(result).toBe('Base content');
    });
  });

  describe('cache management', () => {
    it('should clear all cache', () => {
      // Populate cache
      promptLibraryService.getSystemPrompt('software-engineer', 'technical');
      promptLibraryService.getActionPrompt(ActionType.SCREENSHOT, 'software-engineer', 'technical');

      expect(mockConfigurationManager.getPromptLibrary).toHaveBeenCalledTimes(2);

      // Clear cache
      promptLibraryService.clearCache();

      // Next calls should fetch from config again
      promptLibraryService.getSystemPrompt('software-engineer', 'technical');
      promptLibraryService.getActionPrompt(ActionType.SCREENSHOT, 'software-engineer', 'technical');

      expect(mockConfigurationManager.getPromptLibrary).toHaveBeenCalledTimes(4);
    });
  });

  describe('persona management', () => {
    it('should add new persona with default templates', async () => {
      await promptLibraryService.addPersona('devops-engineer', 'DevOps Engineer');

      expect(mockConfigurationManager.updatePromptLibrary).toHaveBeenCalledWith(
        expect.objectContaining({
          'devops-engineer': expect.objectContaining({
            'technical': expect.any(Object),
            'behavioral': expect.any(Object),
            'system-design': expect.any(Object)
          })
        })
      );
    });

    it('should prevent adding duplicate persona', async () => {
      await expect(
        promptLibraryService.addPersona('software-engineer', 'Software Engineer')
      ).rejects.toThrow('Persona "Software Engineer" already exists');
    });

    it('should remove persona', async () => {
      // First add a custom persona
      const updatedLibrary = { ...mockPromptLibrary, 'custom-role': {} };
      mockConfigurationManager.getPromptLibrary.mockReturnValue(updatedLibrary);

      await promptLibraryService.removePersona('custom-role');

      expect(mockConfigurationManager.updatePromptLibrary).toHaveBeenCalledWith(
        expect.not.objectContaining({
          'custom-role': expect.anything()
        })
      );
    });

    it('should prevent removing core personas', async () => {
      await expect(
        promptLibraryService.removePersona('software-engineer')
      ).rejects.toThrow('Cannot remove core persona: software-engineer');
    });

    it('should handle removing non-existent persona', async () => {
      await expect(
        promptLibraryService.removePersona('non-existent')
      ).rejects.toThrow('Persona "non-existent" does not exist');
    });
  });
});