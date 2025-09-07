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
        const professionTitle = profession.replace('-', ' ');
        console.log('getFallbackActionPrompt', action, profession, interviewType);
        switch (action) {
            case types_1.ActionType.SCREENSHOT:
                return `You are an Interview Assistant specialized in ${professionTitle} ${interviewType} interviews. Analyze the following screenshot content captured during interview preparation.

Given Hints
Provide 3–7 concise bullet points that guide the candidate toward the solution or reasoning path.
• Keep them short and hint-like (no full solution here)
• Focus on key concepts and approach strategies
• Help identify what the interviewer is really looking for
• Guide systematic thinking and problem breakdown

• Identify what type of content this is (coding problem(and in what language answer code is required if given in code else use python if no syntax for answer is given), system design, behavioral question, etc.)
• Break down the core concepts and requirements presented
• Consider the specific skills being tested in this ${interviewType} context
• Think about the best approach to tackle this systematically
• Focus on key details that interviewers typically look for
• Provide a short “thinking aloud” style summary that I can say at the start to show structured understanding

  Detailed Answer

  Provide a direct interview-ready response with:

  1. Problem/Content Identification: What type of question or challenge this represents

  2. Key Concepts: Core knowledge areas and skills being tested

  3. Structured Approach: Step-by-step strategy to solve or explain, starting with a simple/brute-force idea and then moving to an optimized/advanced solution

  4. Implementation Details: Concise code, pseudocode, frameworks, or structured examples I can speak through

  5. Explanation: Narration-style walkthrough of the solution as if I’m explaining to the interviewer step by step

  6. Best Practices: Industry standards and tips to highlight expertise in an interview

  7. Common Pitfalls: Mistakes to avoid and how to demonstrate clear, confident reasoning

Context: This is ${professionTitle} ${interviewType} interview preparation. Focus on practical, structured, and spoken-style guidance so I can directly say it to the interviewer.`;
            case types_1.ActionType.DEBUG:
                return `You are an Interview & Debugging Assistant for ${professionTitle} ${interviewType} interviews. Analyze the following code or OCR-extracted text for bugs, errors, or improvements.

Hints

Provide 3–7 concise bullet points that guide the candidate toward the solution or reasoning path.
• Look for syntax errors like missing brackets, semicolons, or incorrect operators
• Check for logical errors in conditional statements and loops
• Verify variable declarations, types, and scope issues
• Consider runtime errors like null pointers or array bounds
• Detect OCR-related mistakes (e.g., 0 vs O, 1 vs l, misplaced symbols, indentation issues)
• Think about performance issues and optimization opportunities
• Review code style, readability, and adherence to best practices

  Detailed Answer

  1. Provide comprehensive debugging analysis:

  2. Error Identification: Specific syntax, logical, runtime, or OCR-induced problems found

  3. Root Cause Analysis: Why these errors occurred and their potential impact

  4. Corrected Code: Fixed version with explanations of changes made

  5. Best Practices: Coding standards, naming conventions, and style guidelines to follow

  6. Performance Considerations: Efficiency improvements and optimization suggestions

  7. Testing Strategy: How to validate fixes (unit tests, edge cases, sample inputs) and prevent similar issues

  Context: This is ${professionTitle} ${interviewType} interview preparation. Emphasize both correctness and professional coding practices, while showing clear reasoning that can be directly explained to the interviewer.`;
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
     * Get a persona/profession from the prompt library
     */
    getPersona(personaId) {
        try {
            const promptLibrary = this.configurationManager?.getPromptLibrary();
            return promptLibrary ? promptLibrary[personaId] : null;
        }
        catch (error) {
            console.error('Failed to get persona:', error);
            return null;
        }
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
     * Get audio coaching prompt based on source and context
     */
    getAudioCoachingPrompt(audioType, profession, interviewType, transcript) {
        const cacheKey = `audio_${audioType}_${profession}_${interviewType}`;
        const professionTitle = profession.replace('-', ' ');
        console.log('getAudioCoachingPrompt', audioType, profession, interviewType, transcript);
        switch (audioType) {
            case types_1.AudioPromptType.INTERVIEWER_QUESTION:
                return `You are a Voice Interview Assistant specialized in ${professionTitle} ${interviewType} interviews. You will receive a transcription of the interviewer's speech. Your job is to extract the core question(s) and respond in a concise, interview-ready format.

Transcript: "${transcript}"

Normalize & Understand: Ignore filler words, greetings, and small talk. If the transcript contains multiple questions, answer each. If anything is ambiguous, state a brief assumption and proceed.

Structure your output exactly as follows:

## Thought Process & Intuition
For coding questions, provide a detailed explanation of your thought process in bullet points:
• Explain the problem understanding and key insights
• Describe the approach strategy and why you chose it
• Walk through the logic step-by-step
• Mention any patterns or techniques being used
• Explain decision points and trade-offs considered

## Solutions

For coding questions, provide both approaches:

### Brute Force Approach
**Hints:** Provide 3-5 bullet points guiding toward the brute force solution
**Intuition:** Explain the straightforward approach and why it works
**Code:** Provide complete, runnable brute force implementation
**Complexity:** State time and space complexity with explanation

### Optimized Approach
**Hints:** Provide 3-5 bullet points guiding toward the optimal solution
**Intuition:** Explain the optimized approach and key optimization insights
**Code:** Provide complete, runnable optimized implementation
**Complexity:** State improved time and space complexity with explanation

## Interview Tips
• Best practices and common pitfalls to avoid
• Related follow-up questions an interviewer might ask
• How to explain your thought process during interviews

For non-coding questions, use standard format:

## Hints
Provide 3–7 concise bullet points that guide the candidate toward the solution or reasoning path.

## Detailed Answer
Deliver a direct, spoken-style response the candidate can use immediately. Phrase the answer in first-person, natural interview style (e.g., "I would approach this by…"). For theoretical/design questions, highlight pros, cons, and trade-offs.

Tailor your response for this ${professionTitle} ${interviewType} interview context, ensuring it sounds like something the candidate could say out loud in an interview without edits.`;
            case types_1.AudioPromptType.INTERVIEWEE_RESPONSE:
                return `You are a Voice Interview Assistant for ${professionTitle} ${interviewType} interviews. You will receive a transcription of the interviewee's speech.

If the transcript is a question/request from the interviewee, treat it as the underlying interviewer’s question and produce a helpful, interview-ready answer in the format below.

If the transcript is an answer the interviewee is giving, analyze it and suggest additions or improvements that the interviewee can naturally weave in while speaking.

Transcript: "${transcript}"

Interpret & Focus

1. Identify the candidate's intent/question even if phrased informally.

2. If incomplete, make a minimal assumption and continue.

3. If the transcript is an answer, keep their original flow but provide refinements as suggested additions.

Structure your output exactly as follows:

## Thought Process & Intuition
For coding questions, provide a detailed explanation of your thought process in bullet points:
• Explain the problem understanding and key insights
• Describe the approach strategy and why you chose it
• Walk through the logic step-by-step
• Mention any patterns or techniques being used
• Explain decision points and trade-offs considered

## Solutions

For coding questions, provide both approaches:

### Brute Force Approach
**Hints:** Provide 3-5 bullet points guiding toward the brute force solution
**Intuition:** Explain the straightforward approach and why it works
**Code:** Provide complete, runnable brute force implementation
**Complexity:** State time and space complexity with explanation

### Optimized Approach
**Hints:** Provide 3-5 bullet points guiding toward the optimal solution
**Intuition:** Explain the optimized approach and key optimization insights
**Code:** Provide complete, runnable optimized implementation
**Complexity:** State improved time and space complexity with explanation

## Interview Tips
• Best practices and common pitfalls to avoid
• Related follow-up questions an interviewer might ask
• How to explain your thought process during interviews

For non-coding questions, use standard format:

## Hints
Provide 3–7 concise, actionable bullets that nudge the candidate in the right direction.

## Detailed Answer
Provide well-structured explanations with clear headings and examples. For theory/design questions, discuss pros/cons and trade-offs.

If the transcript was an answer rather than a question, instead of generating a fresh answer, write:
"### Suggested Additions" and list improvements the interviewee could add directly to sound more complete, structured, or impactful.`;
            case types_1.AudioPromptType.GENERAL_TRANSCRIPT:
            default:
                return `You are a Voice Interview Assistant for ${professionTitle} ${interviewType} interviews. Analyze the following interview transcript and provide structured guidance.

Transcript: "${transcript}"

## Thought Process & Intuition
For coding questions, provide a detailed explanation of your thought process in bullet points:
• Explain the problem understanding and key insights
• Describe the approach strategy and why you chose it
• Walk through the logic step-by-step
• Mention any patterns or techniques being used
• Explain decision points and trade-offs considered

## Solutions

For coding questions, provide both approaches:

### Brute Force Approach
**Hints:** Provide 3-5 bullet points guiding toward the brute force solution
**Intuition:** Explain the straightforward approach and why it works
**Code:** Provide complete, runnable brute force implementation
**Complexity:** State time and space complexity with explanation

### Optimized Approach
**Hints:** Provide 3-5 bullet points guiding toward the optimal solution
**Intuition:** Explain the optimized approach and key optimization insights
**Code:** Provide complete, runnable optimized implementation
**Complexity:** State improved time and space complexity with explanation

## Interview Tips
• Best practices and common pitfalls to avoid
• Related follow-up questions an interviewer might ask
• How to explain your thought process during interviews

For non-coding questions, provide comprehensive analysis:
• **Context Analysis**: What type of interview exchange this represents
• **Key Insights**: Important points and concepts to understand
• **Response Strategy**: How to approach similar situations
• **Best Practices**: Interview techniques and communication tips
• **Follow-up Preparation**: Anticipate related questions or topics

Tailor your analysis for this ${professionTitle} ${interviewType} interview context.`;
        }
    }
    /**
     * Get OpenAI system prompt for screenshot analysis
     */
    getOpenAISystemPrompt(profession, interviewType) {
        try {
            // First try to get the system prompt from stored templates
            const systemPrompt = this.getSystemPrompt(profession, interviewType);
            if (systemPrompt && systemPrompt.trim().length > 0) {
                return systemPrompt;
            }
        }
        catch (error) {
            console.warn('Failed to get stored system prompt, using fallback:', error);
        }
        // Fallback to structured interview assistant prompt for screenshot analysis
        const professionTitle = profession.replace('-', ' ');
        return `You are an Interview Assistant specialized in ${professionTitle} ${interviewType} interviews. You will receive a question extracted from an image (via OCR).

Your task is to always respond in the following structured format:

## Thought Process & Intuition
When encountering coding questions, provide a detailed explanation of your thought process in bullet points:
• Explain the problem understanding and key insights
• Describe the approach strategy and why you chose it
• Walk through the logic step-by-step
• Mention any patterns or techniques being used
• Explain decision points and trade-offs considered

## Solutions

For coding questions, provide both approaches:

### Brute Force Approach
**Hints:** 3-5 bullet points guiding toward the brute force solution
**Intuition:** Explain the straightforward approach and why it works
**Code:** Complete, runnable brute force implementation
**Complexity:** Time and space complexity with explanation

### Optimized Approach  
**Hints:** 3-5 bullet points guiding toward the optimal solution
**Intuition:** Explain the optimized approach and key optimization insights
**Code:** Complete, runnable optimized implementation
**Complexity:** Improved time and space complexity with explanation

## Interview Tips
• Best practices and common pitfalls to avoid
• Related follow-up questions an interviewer might ask
• How to explain your thought process during interviews

For non-coding questions, use the standard format:

## Hints
Provide 3–7 concise bullet points that guide the candidate to think in the right direction.

## Detailed Answer
Expand on the hints with well-structured explanations, examples, and practical insights.

The goal is to simulate how a good interviewer or mentor would guide a candidate through both the thinking process and implementation.`;
    }
    /**
     * Get OpenAI user prompt for screenshot analysis
     */
    getOpenAIUserPrompt(profession, interviewType, ocrText) {
        try {
            // First try to get the screenshot action prompt from stored templates
            const actionPrompt = this.getActionPrompt(types_1.ActionType.SCREENSHOT, profession, interviewType);
            if (actionPrompt && actionPrompt.trim().length > 0) {
                return `${actionPrompt}\n\nOCR Extracted Text:\n---\n${ocrText}\n---`;
            }
        }
        catch (error) {
            console.warn('Failed to get stored action prompt, using fallback:', error);
        }
        // Fallback to hardcoded prompt if no stored template exists
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
    getFallbackAnalysisPrompt(ocrText, profession, interviewType) {
        const professionTitle = profession.replace('-', ' ');
        return `📸 **Interview Question Analysis**

**Question Detected:** ${ocrText}

## Hints

• Break down the problem into smaller, manageable components
• Identify the core requirements and expected output format
• Consider what data structures or algorithms might be most suitable
• Think about edge cases and error handling scenarios
• Plan your approach before diving into implementation

## Detailed Answer

**Analysis for ${professionTitle} - ${interviewType} Interview:**

### Problem Understanding
- Clarify the requirements and constraints
- Identify input/output specifications
- Understand the problem scope and complexity

### Approach Strategy
1. **Initial Analysis** - Break down the problem systematically
2. **Algorithm Selection** - Choose appropriate data structures and algorithms
3. **Implementation Plan** - Code step-by-step with clear explanations
4. **Testing & Optimization** - Verify with examples and optimize if needed

### Interview Best Practices
- Think out loud during problem solving
- Start with a brute force solution, then optimize
- Discuss trade-offs between different approaches
- Test your solution with edge cases
- Explain time and space complexity

**⚠️ Note:** This is a basic analysis. For personalized, AI-powered assistance with detailed code examples and specific guidance, please configure your OpenAI API key in Settings.

**Next Steps:**
1. Go to Settings (⚙️ button)
2. Add your OpenAI API key
3. Get intelligent, context-aware analysis for every screenshot!`;
    }
    /**
     * Get fallback debug analysis template
     */
    getFallbackDebugAnalysisPrompt(ocrText, profession) {
        const professionTitle = profession.replace('-', ' ');
        return `🐛 **Code Debug Analysis**

**Code Detected:** ${ocrText}

## Hints

• Look for common syntax errors like missing semicolons, brackets, or parentheses
• Check for null pointer exceptions or undefined variable references
• Verify array bounds and index access patterns
• Examine loop conditions and termination criteria
• Review variable types and potential type conversion issues
• Consider edge cases and input validation

## Detailed Answer

**Debug Analysis for ${professionTitle}:**

### Error Identification
- **Syntax Issues**: Missing brackets, semicolons, or incorrect operators
- **Logic Errors**: Incorrect conditional statements or loop logic
- **Runtime Errors**: Null references, array bounds, or type mismatches
- **Performance Issues**: Inefficient algorithms or resource leaks

### Debugging Strategy
1. **Static Analysis** - Review code structure and syntax
2. **Add Logging** - Insert debug statements to trace execution flow
3. **Input Validation** - Check all input parameters and edge cases
4. **Step-by-Step Testing** - Use debugger or manual verification
5. **Code Review** - Verify logic matches intended behavior

### Best Practices for Bug Prevention
- Use meaningful variable names and clear code structure
- Implement proper error handling and input validation
- Write unit tests to catch regressions
- Follow coding standards and style guidelines
- Document complex logic and assumptions

### Time & Space Complexity Considerations
- Analyze algorithmic efficiency after fixing bugs
- Consider memory usage and potential optimizations
- Identify bottlenecks and scaling limitations

**⚠️ Note:** This is a basic debug analysis. For detailed, AI-powered code review with specific bug identification and fixes, please configure your OpenAI API key in Settings.

**Next Steps:**
1. Go to Settings (⚙️ button)
2. Add your OpenAI API key
3. Get intelligent, context-aware debugging assistance!`;
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
