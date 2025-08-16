import { PromptTemplate, PromptLibrary, ActionType, PromptCategory, AudioPromptType, AudioSource } from '../types';
import { ConfigurationManager } from './ConfigurationManager';

export class PromptLibraryService {
  private configurationManager: ConfigurationManager | null = null;
  private promptCache: Map<string, string> = new Map();

  constructor(configurationManager?: ConfigurationManager) {
    this.configurationManager = configurationManager || null;
  }

  setConfigurationManager(configurationManager: ConfigurationManager): void {
    this.configurationManager = configurationManager;
  }

  /**
   * Get system prompt for a specific profession and interview type
   */
  getSystemPrompt(profession: string, interviewType: string): string {
    const cacheKey = `system_${profession}_${interviewType}`;
    
    // Check cache first
    if (this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey)!;
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
    } catch (error) {
      console.error('Failed to get system prompt:', error);
      return this.getFallbackSystemPrompt(profession, interviewType);
    }
  }

  /**
   * Get action-specific prompt for a profession, interview type, and action
   */
  getActionPrompt(action: ActionType, profession: string, interviewType: string): string {
    const cacheKey = `action_${action}_${profession}_${interviewType}`;
    
    // Check cache first
    if (this.promptCache.has(cacheKey)) {
      return this.promptCache.get(cacheKey)!;
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
    } catch (error) {
      console.error('Failed to get action prompt:', error);
      return this.getFallbackActionPrompt(action, profession, interviewType);
    }
  }

  /**
   * Save a prompt template
   */
  async savePromptTemplate(template: PromptTemplate): Promise<void> {
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
      if (template.action === ActionType.GENERAL) {
        promptLibrary[template.profession][template.interviewType].system = template.template;
      } else {
        promptLibrary[template.profession][template.interviewType].actions[template.action] = template.template;
      }
      
      // Update configuration
      await this.configurationManager.updatePromptLibrary(promptLibrary);
      
      // Clear cache for affected prompts
      this.clearCacheForProfessionAndType(template.profession, template.interviewType);
      
      console.log(`Saved prompt template for ${template.profession} - ${template.interviewType} - ${template.action}`);
    } catch (error) {
      console.error('Failed to save prompt template:', error);
      throw error;
    }
  }

  /**
   * Resolve template variables in a prompt string
   */
  resolveTemplate(template: string, variables: Record<string, string>): string {
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
  getPromptTemplates(profession: string, interviewType: string): {
    system: string;
    actions: Record<string, string>;
  } {
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
    } catch (error) {
      console.error('Failed to get prompt templates:', error);
      return this.getDefaultPromptTemplates(profession, interviewType);
    }
  }

  /**
   * Get all available professions
   */
  getAvailableProfessions(): string[] {
    try {
      const promptLibrary = this.configurationManager.getPromptLibrary();
      return Object.keys(promptLibrary);
    } catch (error) {
      console.error('Failed to get available professions:', error);
      return ['software-engineer', 'data-scientist', 'product-manager', 'designer'];
    }
  }

  /**
   * Get all available interview types for a profession
   */
  getAvailableInterviewTypes(profession: string): string[] {
    try {
      const promptLibrary = this.configurationManager.getPromptLibrary();
      const professionPrompts = promptLibrary[profession];
      
      if (!professionPrompts) {
        return ['technical', 'behavioral', 'system-design'];
      }
      
      return Object.keys(professionPrompts);
    } catch (error) {
      console.error('Failed to get available interview types:', error);
      return ['technical', 'behavioral', 'system-design'];
    }
  }

  /**
   * Validate a prompt template
   */
  validatePromptTemplate(template: PromptTemplate): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!template.profession || template.profession.trim().length === 0) {
      errors.push('Profession is required');
    }
    
    if (!template.interviewType || template.interviewType.trim().length === 0) {
      errors.push('Interview type is required');
    }
    
    if (!template.template || template.template.trim().length === 0) {
      errors.push('Template content is required');
    }
    
    if (!Object.values(ActionType).includes(template.action)) {
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
  clearCache(): void {
    this.promptCache.clear();
    console.log('Prompt cache cleared');
  }

  /**
   * Get fallback system prompt
   */
  private getFallbackSystemPrompt(profession: string, interviewType: string): string {
    return `You are an expert ${profession.replace('-', ' ')} interview assistant. Help the candidate with ${interviewType} interview questions and provide guidance based on best practices in the field.`;
  }

  /**
   * Get fallback action prompt
   */
  private getFallbackActionPrompt(action: ActionType, profession: string, interviewType: string): string {
    const professionTitle = profession.replace('-', ' ');
    
    switch (action) {
      case ActionType.SCREENSHOT:
        return `🔍 **Screenshot Analysis Request**

You are an expert ${professionTitle} interviewer and coach. Please analyze the following screenshot content captured during a ${interviewType} interview preparation session.

**Your Task:**
1. **Identify** what type of content this is (coding problem, system design, behavioral question, technical documentation, etc.)
2. **Analyze** the core concepts, requirements, or challenges presented
3. **Provide Guidance** tailored for a ${professionTitle} ${interviewType} interview context
4. **Suggest Approach** - Give step-by-step recommendations on how to tackle this
5. **Key Points** - Highlight important details the candidate should focus on
6. **Best Practices** - Share relevant industry standards and interview tips

**Context:** This is for ${professionTitle} ${interviewType} interview preparation. Provide practical, actionable advice that demonstrates deep understanding of both the technical content and interview dynamics.

**Analysis of Screenshot Content:**`;
      case ActionType.DEBUG:
        return `🐛 **Code Debugging Analysis Request**

You are an expert ${professionTitle} interviewer and code reviewer. Please thoroughly analyze the following code captured during a ${interviewType} interview preparation session.

**Your Task:**
1. **Code Review** - Examine the code structure, logic, and implementation
2. **Bug Detection** - Identify any syntax errors, logical bugs, or runtime issues
3. **Performance Analysis** - Assess efficiency, scalability, and optimization opportunities
4. **Best Practices** - Check adherence to coding standards and industry conventions
5. **Interview Perspective** - Evaluate how this would be received in a ${professionTitle} ${interviewType} interview
6. **Improvement Suggestions** - Provide specific, actionable recommendations
7. **Alternative Approaches** - Suggest better solutions or different methodologies

**Context:** This is for ${professionTitle} ${interviewType} interview preparation. Focus on both correctness and demonstrating strong engineering practices that interviewers value.

**Code Analysis:**`;
      default:
        return `📋 **Interview Question Analysis**

You are an expert ${professionTitle} interview coach. Please provide comprehensive guidance for the following ${interviewType} interview content.

**Your Task:**
1. **Question Analysis** - Break down what the interviewer is really asking
2. **Key Concepts** - Identify the core knowledge areas being tested
3. **Structured Response** - Provide a framework for answering effectively
4. **Examples & Evidence** - Suggest relevant examples to strengthen the response
5. **Common Pitfalls** - Warn about typical mistakes candidates make
6. **Follow-up Preparation** - Anticipate likely follow-up questions

**Context:** This is ${professionTitle} ${interviewType} interview preparation. Provide actionable advice that will help the candidate succeed.

**Analysis:**`;
    }
  }

  /**
   * Get default prompt templates
   */
  private getDefaultPromptTemplates(profession: string, interviewType: string): {
    system: string;
    actions: Record<string, string>;
  } {
    return {
      system: this.getFallbackSystemPrompt(profession, interviewType),
      actions: {
        [ActionType.SCREENSHOT]: this.getFallbackActionPrompt(ActionType.SCREENSHOT, profession, interviewType),
        [ActionType.DEBUG]: this.getFallbackActionPrompt(ActionType.DEBUG, profession, interviewType),
        [ActionType.GENERAL]: this.getFallbackActionPrompt(ActionType.GENERAL, profession, interviewType)
      }
    };
  }

  /**
   * Clear cache for specific profession and interview type
   */
  private clearCacheForProfessionAndType(profession: string, interviewType: string): void {
    const keysToDelete: string[] = [];
    
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
  private resolveConditionals(template: string, variables: Record<string, string>): string {
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
  getDefaultSystemPrompt(profession: string, interviewType: string): string {
    return this.getFallbackSystemPrompt(profession, interviewType);
  }

  /**
   * Get default action prompt (from built-in templates)
   */
  getDefaultActionPrompt(action: ActionType, profession: string, interviewType: string): string {
    return this.getFallbackActionPrompt(action, profession, interviewType);
  }

  /**
   * Add a new persona/profession to the prompt library
   */
  async addPersona(personaId: string, personaName: string): Promise<void> {
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
            [ActionType.SCREENSHOT]: this.getFallbackActionPrompt(ActionType.SCREENSHOT, personaId, 'technical'),
            [ActionType.DEBUG]: this.getFallbackActionPrompt(ActionType.DEBUG, personaId, 'technical'),
            [ActionType.GENERAL]: this.getFallbackActionPrompt(ActionType.GENERAL, personaId, 'technical')
          }
        },
        'behavioral': {
          system: this.getFallbackSystemPrompt(personaId, 'behavioral'),
          actions: {
            [ActionType.SCREENSHOT]: this.getFallbackActionPrompt(ActionType.SCREENSHOT, personaId, 'behavioral'),
            [ActionType.DEBUG]: this.getFallbackActionPrompt(ActionType.DEBUG, personaId, 'behavioral'),
            [ActionType.GENERAL]: this.getFallbackActionPrompt(ActionType.GENERAL, personaId, 'behavioral')
          }
        },
        'system-design': {
          system: this.getFallbackSystemPrompt(personaId, 'system-design'),
          actions: {
            [ActionType.SCREENSHOT]: this.getFallbackActionPrompt(ActionType.SCREENSHOT, personaId, 'system-design'),
            [ActionType.DEBUG]: this.getFallbackActionPrompt(ActionType.DEBUG, personaId, 'system-design'),
            [ActionType.GENERAL]: this.getFallbackActionPrompt(ActionType.GENERAL, personaId, 'system-design')
          }
        }
      };
      
      // Update configuration
      await this.configurationManager.updatePromptLibrary(promptLibrary);
      
      console.log(`Added new persona: ${personaName} (${personaId})`);
    } catch (error) {
      console.error('Failed to add persona:', error);
      throw error;
    }
  }

  /**
   * Remove a persona/profession from the prompt library
   */
  async removePersona(personaId: string): Promise<void> {
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
    } catch (error) {
      console.error('Failed to remove persona:', error);
      throw error;
    }
  }

  /**
   * Clear cache for a specific persona
   */
  private clearCacheForPersona(personaId: string): void {
    const keysToDelete: string[] = [];
    
    for (const key of this.promptCache.keys()) {
      if (key.includes(`_${personaId}_`)) {
        keysToDelete.push(key);
      }
    }
    
    keysToDelete.forEach(key => this.promptCache.delete(key));
  }

  /**
   * Get audio coaching prompt based on source and context
   */
  getAudioCoachingPrompt(audioType: AudioPromptType, profession: string, interviewType: string, transcript: string): string {
    const cacheKey = `audio_${audioType}_${profession}_${interviewType}`;
    const professionTitle = profession.replace('-', ' ');
    
    switch (audioType) {
      case AudioPromptType.INTERVIEWER_QUESTION:
        return `🎯 **INTERVIEWER QUESTION DETECTED:**\n\n"${transcript}"\n\nThis is what the interviewer just asked. Please help me:\n1. Understand what they're looking for\n2. Structure a strong response\n3. Provide key talking points\n4. Suggest any clarifying questions I should ask\n\nTailor your advice for this ${professionTitle} ${interviewType} interview.`;
      
      case AudioPromptType.INTERVIEWEE_RESPONSE:
        return `🎙️ **MY RESPONSE ANALYSIS:**\n\n"${transcript}"\n\nThis is what I just said in response. Please provide:\n1. Feedback on my answer quality\n2. What I did well\n3. Areas for improvement\n4. Suggestions for follow-up points\n5. How to strengthen similar responses\n\nEvaluate this for a ${professionTitle} ${interviewType} interview.`;
      
      case AudioPromptType.GENERAL_TRANSCRIPT:
      default:
        return `📝 **INTERVIEW TRANSCRIPT:**\n\n"${transcript}"\n\nPlease analyze this interview exchange and provide relevant guidance for this ${professionTitle} ${interviewType} interview.`;
    }
  }

  /**
   * Get OpenAI system prompt for screenshot analysis
   */
  getOpenAISystemPrompt(profession: string, interviewType: string): string {
    const professionTitle = profession.replace('-', ' ');
    
    return `You are an intelligent assistant that processes OCR-scanned exam or assignment text. Your job is to extract **each individual question** and provide structured answers accordingly in ${professionTitle} ${interviewType} interviews.

Analyze the following interview question and provide comprehensive guidance.

Provide a detailed response that includes:
1. Carefully read the OCR text below.
2. Identify and number each question in the format "Question 1", "Question 2", etc.
3. Problem analysis and approach
4. Step-by-step solution strategy
5. Code implementation (if applicable and provide code in the language the question is asked or according to the template given in ocr text) - ALWAYS include working code examples
6. Time and space complexity analysis
7. Edge cases to consider
8. Interview tips and best practices

Format your response with clear sections and use markdown for better readability. Be specific and actionable. ALWAYS include actual code implementations.`;
  }

  /**
   * Get OpenAI user prompt for screenshot analysis
   */
  getOpenAIUserPrompt(profession: string, interviewType: string, ocrText: string): string {
    const professionTitle = profession.replace('-', ' ');
    
    return `You are an intelligent assistant that processes OCR-scanned exam or assignment text. Your job is to extract **each individual question** and provide structured answers accordingly in ${professionTitle} ${interviewType} interviews.

Instructions:
1. Carefully read the OCR text below.
2. Identify and number each question in the format "Question 1", "Question 2", etc.
3. If the question is an MCQ (Multiple Choice Question), identify the correct option and output it as:
  Question X: Answer is (Option Letter) - (Full Answer Text)
4. If the question is not MCQ, summarize or explain the answer concisely.
5. Use the following format for each question:
  Question X: Answer is ---- [your answer]
6. If the question is a coding question, provide the code in the language the question is asked or according to the template given in OCR text.

OCR Extracted Text:
---
${ocrText}
---

Return only the structured answers for each question in the above format. Do not include any additional commentary or explanations.`;
  }

  /**
   * Get fallback analysis template
   */
  getFallbackAnalysisPrompt(ocrText: string, profession: string, interviewType: string): string {
    const professionTitle = profession.replace('-', ' ');
    
    return `📸 **Interview Question Analysis**

**Question Detected:** ${ocrText}

**Analysis for ${professionTitle} - ${interviewType} Interview:**

**Approach:**
• Break down the problem into smaller components
• Identify the core requirements and constraints
• Consider time and space complexity implications
• Think about edge cases and error handling

**General Strategy:**
1. **Clarify Requirements** - Ask questions about input/output format
2. **Plan Your Approach** - Discuss algorithm choice and data structures
3. **Implement Step by Step** - Code incrementally with explanations
4. **Test and Optimize** - Verify with examples and optimize if needed

**Interview Tips:**
• Think out loud during problem solving
• Start with a brute force solution, then optimize
• Discuss trade-offs between different approaches
• Test your solution with edge cases

**⚠️ Note:** This is a basic analysis. For personalized, AI-powered assistance with detailed code examples and specific guidance, please configure your OpenAI API key in Settings.

**Next Steps:**
1. Go to Settings (⚙️ button)
2. Add your OpenAI API key
3. Get intelligent, context-aware analysis for every screenshot!`;
  }

  /**
   * Get fallback debug analysis template
   */
  getFallbackDebugAnalysisPrompt(ocrText: string, profession: string): string {
    const professionTitle = profession.replace('-', ' ');
    
    return `🐛 **Code Debug Analysis**

**Code Detected:** ${ocrText}

**Debug Analysis for ${professionTitle}:**

**Potential Issues to Check:**
• **Null Pointer Exceptions** - Check for null references before use
• **Array Bounds** - Verify array indices are within valid range
• **Logic Errors** - Review conditional statements and loops
• **Memory Leaks** - Ensure proper resource cleanup
• **Type Mismatches** - Verify variable types and conversions

**Common Debugging Steps:**
1. **Add Logging** - Insert debug statements to trace execution
2. **Check Inputs** - Validate all input parameters
3. **Test Edge Cases** - Try boundary conditions and null inputs
4. **Review Algorithms** - Verify logic matches intended behavior
5. **Use Debugger** - Step through code line by line

**Best Practices:**
• Use meaningful variable names
• Add proper error handling
• Write unit tests for functions
• Document complex logic
• Follow coding standards

**⚠️ Note:** This is a basic debug analysis. For detailed, AI-powered code review with specific bug identification and fixes, please configure your OpenAI API key in Settings.

**Next Steps:**
1. Go to Settings (⚙️ button)
2. Add your OpenAI API key
3. Get intelligent, context-aware debugging assistance!`;
  }

  /**
   * Check if variable name is valid
   */
  private isValidVariableName(name: string): boolean {
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
