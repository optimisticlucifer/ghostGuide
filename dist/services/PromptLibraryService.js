"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromptLibraryService = void 0;
const types_1 = require("../types");
class PromptLibraryService {
    constructor(configurationManager) {
        this.configurationManager = null;
        this.promptCache = new Map();
        this.configurationManager = configurationManager || null;
    }
    setConfigurationManager(configurationManager) {
        this.configurationManager = configurationManager;
    }
    /**
     * Get system prompt for a specific profession and interview type
     */
    getSystemPrompt(profession, interviewType) {
        const cacheKey = `system_${profession}_${interviewType}`;
        // Check cache first
        if (this.promptCache.has(cacheKey)) {
            return this.promptCache.get(cacheKey);
        }
        try {
            if (!this.configurationManager) {
                return this.getFallbackSystemPrompt(profession, interviewType);
            }
            const promptLibrary = this.configurationManager.getPromptLibrary();
            // Get profession-specific prompts
            const professionPrompts = promptLibrary[profession];
            if (!professionPrompts) {
                console.warn(`No prompts found for profession: ${profession}`);
                return this.getFallbackSystemPrompt(profession, interviewType);
            }
            // Get interview type-specific prompts
            const interviewPrompts = professionPrompts[interviewType];
            if (!interviewPrompts || !interviewPrompts.system) {
                console.warn(`No system prompt found for ${profession} - ${interviewType}`);
                return this.getFallbackSystemPrompt(profession, interviewType);
            }
            // Resolve template variables
            const resolvedPrompt = this.resolveTemplate(interviewPrompts.system, {
                profession,
                interview_type: interviewType,
                complexity_level: 'medium',
                context: 'interview assistance'
            });
            // Cache the resolved prompt
            this.promptCache.set(cacheKey, resolvedPrompt);
            return resolvedPrompt;
        }
        catch (error) {
            console.error('Failed to get system prompt:', error);
            return this.getFallbackSystemPrompt(profession, interviewType);
        }
    }
    /**
     * Get action-specific prompt for a profession, interview type, and action
     */
    getActionPrompt(action, profession, interviewType) {
        const cacheKey = `action_${action}_${profession}_${interviewType}`;
        // Check cache first
        if (this.promptCache.has(cacheKey)) {
            return this.promptCache.get(cacheKey);
        }
        try {
            const promptLibrary = this.configurationManager.getPromptLibrary();
            // Get profession-specific prompts
            const professionPrompts = promptLibrary[profession];
            if (!professionPrompts) {
                console.warn(`No prompts found for profession: ${profession}`);
                return this.getFallbackActionPrompt(action, profession, interviewType);
            }
            // Get interview type-specific prompts
            const interviewPrompts = professionPrompts[interviewType];
            if (!interviewPrompts || !interviewPrompts.actions || !interviewPrompts.actions[action]) {
                console.warn(`No action prompt found for ${action} in ${profession} - ${interviewType}`);
                return this.getFallbackActionPrompt(action, profession, interviewType);
            }
            // Resolve template variables
            const resolvedPrompt = this.resolveTemplate(interviewPrompts.actions[action], {
                profession,
                interview_type: interviewType,
                action,
                complexity_level: 'medium',
                context: 'interview assistance'
            });
            // Cache the resolved prompt
            this.promptCache.set(cacheKey, resolvedPrompt);
            return resolvedPrompt;
        }
        catch (error) {
            console.error('Failed to get action prompt:', error);
            return this.getFallbackActionPrompt(action, profession, interviewType);
        }
    }
    /**
     * Save a prompt template
     */
    async savePromptTemplate(template) {
        try {
            const promptLibrary = this.configurationManager.getPromptLibrary();
            // Ensure profession exists
            if (!promptLibrary[template.profession]) {
                promptLibrary[template.profession] = {};
            }
            // Ensure interview type exists
            if (!promptLibrary[template.profession][template.interviewType]) {
                promptLibrary[template.profession][template.interviewType] = {
                    system: '',
                    actions: {}
                };
            }
            // Save the template based on action type
            if (template.action === types_1.ActionType.GENERAL) {
                promptLibrary[template.profession][template.interviewType].system = template.template;
            }
            else {
                promptLibrary[template.profession][template.interviewType].actions[template.action] = template.template;
            }
            // Update configuration
            await this.configurationManager.updatePromptLibrary(promptLibrary);
            // Clear cache for affected prompts
            this.clearCacheForProfessionAndType(template.profession, template.interviewType);
            console.log(`Saved prompt template for ${template.profession} - ${template.interviewType} - ${template.action}`);
        }
        catch (error) {
            console.error('Failed to save prompt template:', error);
            throw error;
        }
    }
    /**
     * Resolve template variables in a prompt string
     */
    resolveTemplate(template, variables) {
        let resolved = template;
        // Replace all variables in the format {variable_name}
        for (const [key, value] of Object.entries(variables)) {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            resolved = resolved.replace(regex, value);
        }
        // Handle conditional sections (basic implementation)
        resolved = this.resolveConditionals(resolved, variables);
        return resolved.trim();
    }
    /**
     * Get all available prompt templates for a profession and interview type
     */
    getPromptTemplates(profession, interviewType) {
        try {
            const promptLibrary = this.configurationManager.getPromptLibrary();
            const professionPrompts = promptLibrary[profession];
            if (!professionPrompts) {
                return this.getDefaultPromptTemplates(profession, interviewType);
            }
            const interviewPrompts = professionPrompts[interviewType];
            if (!interviewPrompts) {
                return this.getDefaultPromptTemplates(profession, interviewType);
            }
            return {
                system: interviewPrompts.system || '',
                actions: interviewPrompts.actions || {}
            };
        }
        catch (error) {
            console.error('Failed to get prompt templates:', error);
            return this.getDefaultPromptTemplates(profession, interviewType);
        }
    }
    /**
     * Get all available professions
     */
    getAvailableProfessions() {
        try {
            const promptLibrary = this.configurationManager.getPromptLibrary();
            return Object.keys(promptLibrary);
        }
        catch (error) {
            console.error('Failed to get available professions:', error);
            return ['software-engineer', 'data-scientist', 'product-manager', 'designer'];
        }
    }
    /**
     * Get all available interview types for a profession
     */
    getAvailableInterviewTypes(profession) {
        try {
            const promptLibrary = this.configurationManager.getPromptLibrary();
            const professionPrompts = promptLibrary[profession];
            if (!professionPrompts) {
                return ['technical', 'behavioral', 'system-design'];
            }
            return Object.keys(professionPrompts);
        }
        catch (error) {
            console.error('Failed to get available interview types:', error);
            return ['technical', 'behavioral', 'system-design'];
        }
    }
    /**
     * Validate a prompt template
     */
    validatePromptTemplate(template) {
        const errors = [];
        if (!template.profession || template.profession.trim().length === 0) {
            errors.push('Profession is required');
        }
        if (!template.interviewType || template.interviewType.trim().length === 0) {
            errors.push('Interview type is required');
        }
        if (!template.template || template.template.trim().length === 0) {
            errors.push('Template content is required');
        }
        if (!Object.values(types_1.ActionType).includes(template.action)) {
            errors.push('Invalid action type');
        }
        // Check for valid variable syntax
        const variableRegex = /\{([^}]+)\}/g;
        const matches = template.template.match(variableRegex);
        if (matches) {
            for (const match of matches) {
                const variableName = match.slice(1, -1);
                if (!this.isValidVariableName(variableName)) {
                    errors.push(`Invalid variable name: ${variableName}`);
                }
            }
        }
        return {
            isValid: errors.length === 0,
            errors
        };
    }
    /**
     * Clear prompt cache
     */
    clearCache() {
        this.promptCache.clear();
        console.log('Prompt cache cleared');
    }
    /**
     * Get fallback system prompt
     */
    getFallbackSystemPrompt(profession, interviewType) {
        return `You are an expert ${profession.replace('-', ' ')} interview assistant. Help the candidate with ${interviewType} interview questions and provide guidance based on best practices in the field.`;
    }
    /**
     * Get fallback action prompt
     */
    getFallbackActionPrompt(action, profession, interviewType) {
        switch (action) {
            case types_1.ActionType.SCREENSHOT:
                return `Analyze this ${interviewType} question or content for a ${profession.replace('-', ' ')} interview. Provide a clear explanation and suggest an approach to solve it.`;
            case types_1.ActionType.DEBUG:
                return `Review this code for bugs, errors, or improvements in the context of a ${profession.replace('-', ' ')} ${interviewType} interview. Identify issues and provide specific corrections.`;
            default:
                return `Provide guidance for this ${interviewType} interview question in the context of ${profession.replace('-', ' ')} role.`;
        }
    }
    /**
     * Get default prompt templates
     */
    getDefaultPromptTemplates(profession, interviewType) {
        return {
            system: this.getFallbackSystemPrompt(profession, interviewType),
            actions: {
                [types_1.ActionType.SCREENSHOT]: this.getFallbackActionPrompt(types_1.ActionType.SCREENSHOT, profession, interviewType),
                [types_1.ActionType.DEBUG]: this.getFallbackActionPrompt(types_1.ActionType.DEBUG, profession, interviewType),
                [types_1.ActionType.GENERAL]: this.getFallbackActionPrompt(types_1.ActionType.GENERAL, profession, interviewType)
            }
        };
    }
    /**
     * Clear cache for specific profession and interview type
     */
    clearCacheForProfessionAndType(profession, interviewType) {
        const keysToDelete = [];
        for (const key of this.promptCache.keys()) {
            if (key.includes(`_${profession}_${interviewType}`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.promptCache.delete(key));
    }
    /**
     * Resolve conditional sections in templates
     */
    resolveConditionals(template, variables) {
        // Basic conditional syntax: {{if variable}}content{{endif}}
        const conditionalRegex = /\{\{if\s+(\w+)\}\}(.*?)\{\{endif\}\}/gs;
        return template.replace(conditionalRegex, (match, variable, content) => {
            const value = variables[variable];
            return value && value.trim().length > 0 ? content : '';
        });
    }
    /**
     * Get default system prompt (from built-in templates)
     */
    getDefaultSystemPrompt(profession, interviewType) {
        return this.getFallbackSystemPrompt(profession, interviewType);
    }
    /**
     * Get default action prompt (from built-in templates)
     */
    getDefaultActionPrompt(action, profession, interviewType) {
        return this.getFallbackActionPrompt(action, profession, interviewType);
    }
    /**
     * Add a new persona/profession to the prompt library
     */
    async addPersona(personaId, personaName) {
        try {
            const promptLibrary = this.configurationManager.getPromptLibrary();
            // Check if persona already exists
            if (promptLibrary[personaId]) {
                throw new Error(`Persona "${personaName}" already exists`);
            }
            // Add default templates for the new persona
            promptLibrary[personaId] = {
                'technical': {
                    system: this.getFallbackSystemPrompt(personaId, 'technical'),
                    actions: {
                        [types_1.ActionType.SCREENSHOT]: this.getFallbackActionPrompt(types_1.ActionType.SCREENSHOT, personaId, 'technical'),
                        [types_1.ActionType.DEBUG]: this.getFallbackActionPrompt(types_1.ActionType.DEBUG, personaId, 'technical'),
                        [types_1.ActionType.GENERAL]: this.getFallbackActionPrompt(types_1.ActionType.GENERAL, personaId, 'technical')
                    }
                },
                'behavioral': {
                    system: this.getFallbackSystemPrompt(personaId, 'behavioral'),
                    actions: {
                        [types_1.ActionType.SCREENSHOT]: this.getFallbackActionPrompt(types_1.ActionType.SCREENSHOT, personaId, 'behavioral'),
                        [types_1.ActionType.DEBUG]: this.getFallbackActionPrompt(types_1.ActionType.DEBUG, personaId, 'behavioral'),
                        [types_1.ActionType.GENERAL]: this.getFallbackActionPrompt(types_1.ActionType.GENERAL, personaId, 'behavioral')
                    }
                },
                'system-design': {
                    system: this.getFallbackSystemPrompt(personaId, 'system-design'),
                    actions: {
                        [types_1.ActionType.SCREENSHOT]: this.getFallbackActionPrompt(types_1.ActionType.SCREENSHOT, personaId, 'system-design'),
                        [types_1.ActionType.DEBUG]: this.getFallbackActionPrompt(types_1.ActionType.DEBUG, personaId, 'system-design'),
                        [types_1.ActionType.GENERAL]: this.getFallbackActionPrompt(types_1.ActionType.GENERAL, personaId, 'system-design')
                    }
                }
            };
            // Update configuration
            await this.configurationManager.updatePromptLibrary(promptLibrary);
            console.log(`Added new persona: ${personaName} (${personaId})`);
        }
        catch (error) {
            console.error('Failed to add persona:', error);
            throw error;
        }
    }
    /**
     * Remove a persona/profession from the prompt library
     */
    async removePersona(personaId) {
        try {
            const promptLibrary = this.configurationManager.getPromptLibrary();
            // Check if persona exists
            if (!promptLibrary[personaId]) {
                throw new Error(`Persona "${personaId}" does not exist`);
            }
            // Don't allow removal of core personas
            const corePersonas = ['software-engineer', 'data-scientist', 'product-manager', 'designer'];
            if (corePersonas.includes(personaId)) {
                throw new Error(`Cannot remove core persona: ${personaId}`);
            }
            // Remove the persona
            delete promptLibrary[personaId];
            // Update configuration
            await this.configurationManager.updatePromptLibrary(promptLibrary);
            // Clear cache for this persona
            this.clearCacheForPersona(personaId);
            console.log(`Removed persona: ${personaId}`);
        }
        catch (error) {
            console.error('Failed to remove persona:', error);
            throw error;
        }
    }
    /**
     * Clear cache for a specific persona
     */
    clearCacheForPersona(personaId) {
        const keysToDelete = [];
        for (const key of this.promptCache.keys()) {
            if (key.includes(`_${personaId}_`)) {
                keysToDelete.push(key);
            }
        }
        keysToDelete.forEach(key => this.promptCache.delete(key));
    }
    /**
     * Check if variable name is valid
     */
    isValidVariableName(name) {
        const validVariables = [
            'profession',
            'interview_type',
            'action',
            'complexity_level',
            'context',
            'user_name',
            'company_name'
        ];
        return validVariables.includes(name);
    }
}
exports.PromptLibraryService = PromptLibraryService;
