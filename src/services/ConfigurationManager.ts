import { AppConfig, UserPreferences, PromptLibrary } from '../types';
import { PersistenceService } from './PersistenceService';

export class ConfigurationManager {
  private persistenceService: PersistenceService;
  private currentConfig: AppConfig | null = null;
  private configVersion = '1.0.0';

  constructor() {
    this.persistenceService = new PersistenceService();
  }

  /**
   * Initialize configuration system
   */
  async initialize(): Promise<void> {
    try {
      await this.loadConfiguration();
      await this.validateConfiguration();
      await this.migrateConfigurationIfNeeded();
    } catch (error) {
      console.error('Failed to initialize configuration:', error);
      await this.resetToDefaults();
    }
  }

  /**
   * Load configuration from storage
   */
  async loadConfiguration(): Promise<AppConfig> {
    try {
      this.currentConfig = await this.persistenceService.loadAppConfig();
      return this.currentConfig;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      this.currentConfig = this.getDefaultConfiguration();
      return this.currentConfig;
    }
  }

  /**
   * Save current configuration to storage
   */
  async saveConfiguration(): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('No configuration to save');
    }

    try {
      // Add version and timestamp
      const configToSave = {
        ...this.currentConfig,
        version: this.configVersion,
        lastUpdated: new Date().toISOString()
      };

      await this.persistenceService.saveAppConfig(configToSave);
    } catch (error) {
      console.error('Failed to save configuration:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): AppConfig {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }
    return { ...this.currentConfig };
  }

  /**
   * Update API key
   */
  async updateApiKey(apiKey: string): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }

    this.currentConfig.apiKey = apiKey;
    await this.saveConfiguration();
  }

  /**
   * Get API key
   */
  getApiKey(): string {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }
    return this.currentConfig.apiKey;
  }

  /**
   * Update user preferences
   */
  async updateUserPreferences(preferences: Partial<UserPreferences>): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }

    this.currentConfig.userPreferences = {
      ...this.currentConfig.userPreferences,
      ...preferences
    };

    await this.saveConfiguration();
  }

  /**
   * Get user preferences
   */
  getUserPreferences(): UserPreferences {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }
    return { ...this.currentConfig.userPreferences };
  }

  /**
   * Update prompt library
   */
  async updatePromptLibrary(promptLibrary: PromptLibrary): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }

    this.currentConfig.promptLibrary = promptLibrary;
    await this.saveConfiguration();
  }

  /**
   * Get prompt library
   */
  getPromptLibrary(): PromptLibrary {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }
    return { ...this.currentConfig.promptLibrary };
  }

  /**
   * Add or update a specific prompt template
   */
  async updatePromptTemplate(profession: string, interviewType: string, prompts: any): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('Configuration not initialized');
    }

    if (!this.currentConfig.promptLibrary[profession]) {
      this.currentConfig.promptLibrary[profession] = {};
    }

    this.currentConfig.promptLibrary[profession][interviewType] = prompts;
    await this.saveConfiguration();
  }

  /**
   * Get default configuration
   */
  private getDefaultConfiguration(): AppConfig {
    return {
      apiKey: '',
      promptLibrary: this.getDefaultPromptLibrary(),
      userPreferences: {
        defaultProfession: 'software-engineer',
        defaultInterviewType: 'technical',
        audioQuality: 'medium',
        ocrLanguage: 'eng',
        maxSessions: 5
      },
      sessions: []
    };
  }

  /**
   * Get default prompt library with common templates
   */
  private getDefaultPromptLibrary(): PromptLibrary {
    return {
      'software-engineer': {
        'technical': {
          system: 'You are an expert software engineering interview assistant. Help the candidate understand technical problems, provide coding guidance, and suggest best practices. Focus on clean code, algorithms, and system design principles.',
          actions: {
            screenshot: 'Analyze this technical problem or code snippet. Provide a clear explanation, identify key concepts, and suggest an approach to solve it.',
            debug: 'Review this code for bugs, errors, or improvements. Identify issues and provide specific corrections with explanations.',
            general: 'Provide technical guidance and explanations for software engineering concepts, algorithms, or system design questions.'
          }
        },
        'behavioral': {
          system: 'You are a behavioral interview coach for software engineers. Help the candidate structure responses using the STAR method and provide examples relevant to software development.',
          actions: {
            screenshot: 'Help structure a response to this behavioral question using the STAR method (Situation, Task, Action, Result).',
            debug: 'This appears to be a technical question, but I can help you think through the problem-solving approach and communication strategy.',
            general: 'Provide guidance on behavioral interview questions, focusing on leadership, teamwork, and technical decision-making scenarios.'
          }
        },
        'system-design': {
          system: 'You are a system design interview expert. Help the candidate think through scalable architecture, trade-offs, and design decisions for large-scale systems.',
          actions: {
            screenshot: 'Analyze this system design problem. Break down the requirements, suggest architecture components, and discuss scalability considerations.',
            debug: 'Review this system design or architecture diagram. Identify potential issues, bottlenecks, or improvements.',
            general: 'Guide through system design principles, scalability patterns, and architectural trade-offs.'
          }
        }
      },
      'data-scientist': {
        'technical': {
          system: 'You are a data science interview assistant. Help with statistical concepts, machine learning algorithms, data analysis techniques, and Python/R programming.',
          actions: {
            screenshot: 'Analyze this data science problem, statistical question, or code. Explain the concepts and suggest appropriate methods or solutions.',
            debug: 'Review this data analysis code or statistical approach. Identify errors, suggest improvements, and explain best practices.',
            general: 'Provide guidance on data science concepts, machine learning algorithms, statistical methods, and data analysis techniques.'
          }
        },
        'behavioral': {
          system: 'You are a behavioral interview coach for data scientists. Focus on analytical thinking, project management, and stakeholder communication.',
          actions: {
            screenshot: 'Help structure a response to this behavioral question, emphasizing analytical thinking and data-driven decision making.',
            debug: 'This appears to be a technical question, but I can help you communicate your analytical approach clearly.',
            general: 'Guide through behavioral questions focusing on analytical projects, cross-functional collaboration, and data storytelling.'
          }
        }
      }
    };
  }

  /**
   * Validate current configuration
   */
  private async validateConfiguration(): Promise<void> {
    if (!this.currentConfig) {
      throw new Error('No configuration to validate');
    }

    // Validate user preferences
    const prefs = this.currentConfig.userPreferences;
    if (prefs.maxSessions < 1 || prefs.maxSessions > 10) {
      prefs.maxSessions = 5;
    }

    if (!['low', 'medium', 'high'].includes(prefs.audioQuality)) {
      prefs.audioQuality = 'medium';
    }

    // Ensure prompt library has basic structure
    if (!this.currentConfig.promptLibrary || Object.keys(this.currentConfig.promptLibrary).length === 0) {
      this.currentConfig.promptLibrary = this.getDefaultPromptLibrary();
    }

    // Save validated configuration
    await this.saveConfiguration();
  }

  /**
   * Migrate configuration if version has changed
   */
  private async migrateConfigurationIfNeeded(): Promise<void> {
    if (!this.currentConfig) return;

    const currentVersion = (this.currentConfig as any).version;
    
    if (!currentVersion || currentVersion !== this.configVersion) {
      console.log(`Migrating configuration from ${currentVersion || 'unknown'} to ${this.configVersion}`);
      
      // Perform migration steps here
      await this.performConfigurationMigration(currentVersion);
      
      // Update version
      (this.currentConfig as any).version = this.configVersion;
      await this.saveConfiguration();
    }
  }

  /**
   * Perform configuration migration
   */
  private async performConfigurationMigration(fromVersion: string): Promise<void> {
    // Add migration logic here for future versions
    console.log(`Migration from ${fromVersion} completed`);
  }

  /**
   * Reset configuration to defaults
   */
  async resetToDefaults(): Promise<void> {
    this.currentConfig = this.getDefaultConfiguration();
    await this.saveConfiguration();
  }

  /**
   * Export configuration for backup
   */
  async exportConfiguration(): Promise<string> {
    if (!this.currentConfig) {
      throw new Error('No configuration to export');
    }

    return JSON.stringify({
      ...this.currentConfig,
      exportedAt: new Date().toISOString(),
      version: this.configVersion
    }, null, 2);
  }

  /**
   * Import configuration from backup
   */
  async importConfiguration(configJson: string): Promise<void> {
    try {
      const importedConfig = JSON.parse(configJson);
      
      // Validate imported configuration
      if (!importedConfig.userPreferences || !importedConfig.promptLibrary) {
        throw new Error('Invalid configuration format');
      }

      this.currentConfig = {
        apiKey: importedConfig.apiKey || '',
        promptLibrary: importedConfig.promptLibrary,
        userPreferences: importedConfig.userPreferences,
        sessions: importedConfig.sessions || []
      };

      await this.validateConfiguration();
      await this.saveConfiguration();
    } catch (error) {
      console.error('Failed to import configuration:', error);
      throw new Error('Invalid configuration file');
    }
  }

  /**
   * Check if API key is configured
   */
  isApiKeyConfigured(): boolean {
    return !!(this.currentConfig?.apiKey && this.currentConfig.apiKey.trim().length > 0);
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigurationSummary(): any {
    if (!this.currentConfig) {
      return { status: 'not_initialized' };
    }

    return {
      status: 'initialized',
      hasApiKey: this.isApiKeyConfigured(),
      promptLibrarySize: Object.keys(this.currentConfig.promptLibrary).length,
      maxSessions: this.currentConfig.userPreferences.maxSessions,
      defaultProfession: this.currentConfig.userPreferences.defaultProfession,
      version: (this.currentConfig as any).version || 'unknown'
    };
  }
}