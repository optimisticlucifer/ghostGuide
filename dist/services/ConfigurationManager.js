"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigurationManager = void 0;
const PersistenceService_1 = require("./PersistenceService");
class ConfigurationManager {
    constructor() {
        this.currentConfig = null;
        this.configVersion = '1.0.0';
        this.persistenceService = new PersistenceService_1.PersistenceService();
    }
    /**
     * Initialize configuration system
     */
    async initialize() {
        try {
            await this.loadConfiguration();
            await this.validateConfiguration();
            await this.migrateConfigurationIfNeeded();
        }
        catch (error) {
            console.error('Failed to initialize configuration:', error);
            await this.resetToDefaults();
        }
    }
    /**
     * Load configuration from storage
     */
    async loadConfiguration() {
        try {
            this.currentConfig = await this.persistenceService.loadAppConfig();
            return this.currentConfig;
        }
        catch (error) {
            console.error('Failed to load configuration:', error);
            this.currentConfig = this.getDefaultConfiguration();
            return this.currentConfig;
        }
    }
    /**
     * Save current configuration to storage
     */
    async saveConfiguration() {
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
        }
        catch (error) {
            console.error('Failed to save configuration:', error);
            throw error;
        }
    }
    /**
     * Get current configuration
     */
    getConfiguration() {
        if (!this.currentConfig) {
            throw new Error('Configuration not initialized');
        }
        return { ...this.currentConfig };
    }
    /**
     * Update API key
     */
    async updateApiKey(apiKey) {
        if (!this.currentConfig) {
            throw new Error('Configuration not initialized');
        }
        this.currentConfig.apiKey = apiKey;
        await this.saveConfiguration();
    }
    /**
     * Get API key
     */
    getApiKey() {
        if (!this.currentConfig) {
            throw new Error('Configuration not initialized');
        }
        return this.currentConfig.apiKey;
    }
    /**
     * Set API key (synchronous version for immediate use)
     */
    setApiKey(apiKey) {
        if (!this.currentConfig) {
            this.currentConfig = this.getDefaultConfiguration();
        }
        this.currentConfig.apiKey = apiKey;
    }
    /**
     * Update user preferences
     */
    async updateUserPreferences(preferences) {
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
    getUserPreferences() {
        if (!this.currentConfig) {
            throw new Error('Configuration not initialized');
        }
        return { ...this.currentConfig.userPreferences };
    }
    /**
     * Update prompt library
     */
    async updatePromptLibrary(promptLibrary) {
        if (!this.currentConfig) {
            throw new Error('Configuration not initialized');
        }
        this.currentConfig.promptLibrary = promptLibrary;
        await this.saveConfiguration();
    }
    /**
     * Get prompt library
     */
    getPromptLibrary() {
        if (!this.currentConfig) {
            throw new Error('Configuration not initialized');
        }
        return { ...this.currentConfig.promptLibrary };
    }
    /**
     * Add or update a specific prompt template
     */
    async updatePromptTemplate(profession, interviewType, prompts) {
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
    getDefaultConfiguration() {
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
    getDefaultPromptLibrary() {
        return {
            'software-engineer': {
                'technical': {
                    system: 'You are an Interview Assistant specialized in software engineering technical interviews. You will receive questions extracted from images (via OCR). Always respond in the structured format with Hints and Detailed Answer sections. Focus on clean code, algorithms, and system design principles.',
                    actions: {
                        screenshot: `You are an Interview Assistant for software engineering technical interviews. Analyze the following technical problem or code snippet.

## Hints

• Break down the problem into smaller, manageable parts
• Identify the key data structures and algorithms needed
• Consider time and space complexity implications
• Think about edge cases and error handling
• Plan your approach before coding

## Detailed Answer

Provide a comprehensive analysis with:
- Problem understanding and requirements
- Step-by-step solution approach
- Complete code implementation with explanations
- Time and space complexity analysis
- Edge cases and testing considerations
- Best practices and optimizations`,
                        debug: `You are an Interview & Debugging Assistant for software engineering. Review the following code for bugs, errors, or improvements.

## Hints

• Look for syntax errors like missing brackets or semicolons
• Check for null pointer exceptions or undefined variables
• Verify array bounds and loop conditions
• Review variable types and conversions
• Consider logic errors in conditional statements
• Think about performance and memory issues

## Detailed Answer

Provide detailed debugging analysis:
- Error identification and root cause analysis
- Step-by-step fix explanations
- Corrected code with improvements
- Best practices to prevent similar issues
- Performance considerations and optimizations`,
                        general: 'Provide technical guidance and explanations for software engineering concepts, algorithms, or system design questions using the structured Hints and Detailed Answer format.'
                    }
                },
                'behavioral': {
                    system: 'You are a behavioral interview coach for software engineers. Help candidates structure responses using the STAR method and provide examples relevant to software development. Use the structured Hints and Detailed Answer format.',
                    actions: {
                        screenshot: `Help structure a response to this behavioral question for software engineers.

## Hints

• Use the STAR method (Situation, Task, Action, Result)
• Focus on technical leadership and problem-solving
• Include specific metrics or outcomes
• Highlight collaboration and communication skills
• Connect to software engineering best practices

## Detailed Answer

Provide a structured behavioral response:
- STAR framework breakdown
- Technical context and challenges
- Leadership and teamwork examples
- Quantifiable results and impact
- Key lessons learned`,
                        debug: 'This appears to be a technical question, but I can help you think through the problem-solving approach and communication strategy using structured hints and detailed explanations.',
                        general: 'Provide guidance on behavioral interview questions, focusing on leadership, teamwork, and technical decision-making scenarios using the Hints and Detailed Answer format.'
                    }
                },
                'system-design': {
                    system: 'You are a system design interview expert. Help candidates think through scalable architecture, trade-offs, and design decisions for large-scale systems. Use the structured Hints and Detailed Answer format.',
                    actions: {
                        screenshot: `Analyze this system design problem for software engineering interviews.

## Hints

• Start by clarifying requirements and scale
• Identify key components and services needed
• Consider data flow and storage requirements
• Think about scalability and performance bottlenecks
• Plan for fault tolerance and reliability
• Discuss trade-offs between different approaches

## Detailed Answer

Provide comprehensive system design analysis:
- Requirements gathering and clarification
- High-level architecture overview
- Detailed component design
- Database and storage solutions
- Scalability and performance considerations
- Monitoring, security, and operational aspects`,
                        debug: 'Review this system design or architecture diagram. Identify potential issues, bottlenecks, or improvements using structured hints and detailed analysis.',
                        general: 'Guide through system design principles, scalability patterns, and architectural trade-offs using the Hints and Detailed Answer format.'
                    }
                }
            },
            'data-scientist': {
                'technical': {
                    system: 'You are an Interview Assistant specialized in data science technical interviews. Help with statistical concepts, machine learning algorithms, data analysis techniques, and Python/R programming. Use the structured Hints and Detailed Answer format.',
                    actions: {
                        screenshot: `Analyze this data science problem, statistical question, or code for technical interviews.

## Hints

• Identify the type of problem (classification, regression, clustering, etc.)
• Consider appropriate statistical methods or ML algorithms
• Think about data preprocessing and feature engineering
• Plan for model evaluation and validation
• Consider interpretability and business impact

## Detailed Answer

Provide comprehensive data science analysis:
- Problem understanding and data requirements
- Statistical or ML approach selection
- Step-by-step implementation with code
- Model evaluation and validation strategy
- Results interpretation and business insights`,
                        debug: `Review this data analysis code or statistical approach for errors and improvements.

## Hints

• Check for data preprocessing errors
• Verify statistical assumptions and validity
• Look for coding errors in data manipulation
• Consider model overfitting or underfitting
• Review evaluation metrics and interpretation

## Detailed Answer

Provide detailed debugging for data science:
- Error identification in statistical analysis
- Code corrections and best practices
- Improved model validation approaches
- Better visualization and interpretation
- Performance optimization suggestions`,
                        general: 'Provide guidance on data science concepts, machine learning algorithms, statistical methods, and data analysis techniques using the Hints and Detailed Answer format.'
                    }
                },
                'behavioral': {
                    system: 'You are a behavioral interview coach for data scientists. Focus on analytical thinking, project management, and stakeholder communication using the structured Hints and Detailed Answer format.',
                    actions: {
                        screenshot: `Help structure a response to this behavioral question for data scientists.

## Hints

• Use the STAR method with analytical focus
• Emphasize data-driven decision making
• Include stakeholder communication examples
• Highlight project impact and business value
• Show analytical problem-solving skills

## Detailed Answer

Provide structured behavioral response:
- STAR framework with analytical context
- Data-driven insights and methodologies
- Stakeholder management and communication
- Project outcomes and business impact
- Lessons learned and analytical growth`,
                        debug: 'This appears to be a technical question, but I can help you communicate your analytical approach clearly using structured guidance.',
                        general: 'Guide through behavioral questions focusing on analytical projects, cross-functional collaboration, and data storytelling using the Hints and Detailed Answer format.'
                    }
                }
            }
        };
    }
    /**
     * Validate current configuration
     */
    async validateConfiguration() {
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
    async migrateConfigurationIfNeeded() {
        if (!this.currentConfig)
            return;
        const currentVersion = this.currentConfig.version;
        if (!currentVersion || currentVersion !== this.configVersion) {
            console.log(`Migrating configuration from ${currentVersion || 'unknown'} to ${this.configVersion}`);
            // Perform migration steps here
            await this.performConfigurationMigration(currentVersion);
            // Update version
            this.currentConfig.version = this.configVersion;
            await this.saveConfiguration();
        }
    }
    /**
     * Perform configuration migration
     */
    async performConfigurationMigration(fromVersion) {
        // Add migration logic here for future versions
        console.log(`Migration from ${fromVersion} completed`);
    }
    /**
     * Reset configuration to defaults
     */
    async resetToDefaults() {
        this.currentConfig = this.getDefaultConfiguration();
        await this.saveConfiguration();
    }
    /**
     * Export configuration for backup
     */
    async exportConfiguration() {
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
    async importConfiguration(configJson) {
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
        }
        catch (error) {
            console.error('Failed to import configuration:', error);
            throw new Error('Invalid configuration file');
        }
    }
    /**
     * Check if API key is configured
     */
    isApiKeyConfigured() {
        return !!(this.currentConfig?.apiKey && this.currentConfig.apiKey.trim().length > 0);
    }
    /**
     * Get configuration summary for debugging
     */
    getConfigurationSummary() {
        if (!this.currentConfig) {
            return { status: 'not_initialized' };
        }
        return {
            status: 'initialized',
            hasApiKey: this.isApiKeyConfigured(),
            promptLibrarySize: Object.keys(this.currentConfig.promptLibrary).length,
            maxSessions: this.currentConfig.userPreferences.maxSessions,
            defaultProfession: this.currentConfig.userPreferences.defaultProfession,
            version: this.currentConfig.version || 'unknown'
        };
    }
}
exports.ConfigurationManager = ConfigurationManager;
