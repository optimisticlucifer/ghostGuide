"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChatService = void 0;
const types_1 = require("../types");
class ChatService {
    constructor(configurationManager, promptLibraryService, sessionManager, ragService, localRAGService, globalRAGService) {
        this.maxTokens = 4000;
        this.maxHistoryMessages = 20;
        // RAG enabled states per session
        this.globalRAGEnabledSessions = new Set();
        this.localRAGEnabledSessions = new Set();
        this.configurationManager = configurationManager;
        this.promptLibraryService = promptLibraryService;
        this.sessionManager = sessionManager;
        this.ragService = ragService;
        this.localRAGService = localRAGService;
        this.globalRAGService = globalRAGService;
        // Initialize all sessions with both RAG types enabled by default
        // (Individual session settings will be managed separately)
    }
    /**
     * Send a regular chat message and get AI response
     */
    async sendMessage(sessionId, message, isInitialization = false) {
        try {
            const session = this.sessionManager.getSession(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }
            // Get system prompt for this session
            const systemPrompt = this.promptLibraryService.getSystemPrompt(session.profession, session.interviewType);
            // Build conversation history
            const messages = this.buildConversationHistory(sessionId, systemPrompt);
            // 🎯 FIXED: Only use RAG for initialization messages or when explicitly enabled
            // For regular chat messages, respect the user's RAG toggle settings
            const ragContextSources = [];
            // Only search RAG if it's an initialization message OR if RAG is explicitly enabled
            const shouldUseRAG = isInitialization || this.isLocalRAGEnabled(sessionId) || this.isGlobalRAGEnabled(sessionId);
            if (shouldUseRAG) {
                try {
                    // Get local RAG context if enabled (or during initialization)
                    if ((isInitialization || this.isLocalRAGEnabled(sessionId)) && this.localRAGService) {
                        console.log(`📚 [CHAT] Searching local RAG for session ${sessionId} with query: "${message.substring(0, 50)}..."`);
                        const localResults = await this.localRAGService.getContextStrings(sessionId, message, 3);
                        if (localResults.length > 0) {
                            console.log(`✅ [CHAT] Found ${localResults.length} local RAG results`);
                            ragContextSources.push(...localResults);
                        }
                        else {
                            console.log(`⚠️ [CHAT] No local RAG results found for session ${sessionId}`);
                        }
                    }
                    // Get global RAG context if enabled (or during initialization)
                    if ((isInitialization || this.isGlobalRAGEnabled(sessionId)) && this.globalRAGService) {
                        console.log(`🌍 [CHAT] Searching global RAG with query: "${message.substring(0, 50)}..."`);
                        const globalResults = await this.globalRAGService.getContextStrings(message, 3);
                        if (globalResults.length > 0) {
                            console.log(`✅ [CHAT] Found ${globalResults.length} global RAG results`);
                            ragContextSources.push(...globalResults);
                        }
                        else {
                            console.log(`⚠️ [CHAT] No global RAG results found`);
                        }
                    }
                    // Fallback to original RAG service if others are not available (only during initialization)
                    if (isInitialization && ragContextSources.length === 0 && !this.isLocalRAGEnabled(sessionId) && !this.isGlobalRAGEnabled(sessionId)) {
                        const fallbackContext = await this.ragService.searchRelevantContent(message, sessionId);
                        ragContextSources.push(...fallbackContext);
                    }
                }
                catch (error) {
                    console.warn('⚠️ [CHAT] RAG context retrieval failed:', error);
                    // Continue without RAG context
                }
            }
            else {
                console.log(`🚫 [CHAT] RAG disabled for session ${sessionId} - using direct chat without context`);
            }
            // Enhance message with RAG context if available
            let enhancedMessage = message;
            const ragContextUsed = ragContextSources.length > 0;
            if (ragContextUsed) {
                enhancedMessage = `${message}\n\nRelevant context from your materials:\n${ragContextSources.join('\n\n')}`;
            }
            // Add current user message
            messages.push({
                role: 'user',
                content: enhancedMessage
            });
            // Get AI response
            const response = await this.callOpenAI(messages);
            // Save both user message and AI response to session
            const timestamp = new Date();
            await this.sessionManager.addChatMessage(sessionId, {
                id: `user-${Date.now()}`,
                sessionId,
                role: 'user',
                content: message,
                timestamp,
                metadata: {
                    action: types_1.ActionType.GENERAL,
                    ragContextUsed,
                    enhancedMessage: ragContextUsed ? enhancedMessage : undefined,
                    isInitialization
                }
            });
            await this.sessionManager.addChatMessage(sessionId, {
                id: `assistant-${Date.now()}`,
                sessionId,
                role: 'assistant',
                content: response,
                timestamp,
                metadata: {
                    action: types_1.ActionType.GENERAL,
                    isInitialization
                }
            });
            return { response, enhancedMessage, ragContextUsed };
        }
        catch (error) {
            console.error('Failed to send message:', error);
            throw new Error(`Chat service error: ${error.message}`);
        }
    }
    /**
     * Process OCR text and get AI analysis - PERSISTENT CONTEXT
     */
    async processOCRText(sessionId, text, action) {
        try {
            const session = this.sessionManager.getSession(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }
            // Get action-specific prompt
            let actionPrompt = this.promptLibraryService.getActionPrompt(action, session.profession, session.interviewType);
            // 🎯 ENHANCED: Detect if OCR text contains coding questions and enhance the prompt
            const codeKeywords = ['code', 'implement', 'write', 'create', 'build', 'develop', 'function', 'component', 'class', 'method', 'api', 'endpoint', 'route', 'database', 'query', 'algorithm', 'solution', 'program', 'script', 'application', 'website', 'app', 'button', 'form', 'login', 'authentication', 'react', 'node', 'python', 'javascript', 'typescript', 'html', 'css', 'array', 'string', 'loop', 'sorting', 'search', 'tree', 'graph', 'dynamic programming', 'recursion', 'data structure', 'leetcode', 'hackerrank', 'coding challenge', 'technical interview'];
            const textLower = text.toLowerCase();
            const isCodeQuestion = codeKeywords.some(keyword => textLower.includes(keyword));
            if (isCodeQuestion) {
                console.log(`💻 [OCR] Detected coding question in OCR text, enhancing prompt...`);
                actionPrompt += `\n\n🔧 ENHANCED CODING INSTRUCTION FOR OCR ANALYSIS:\n\nSince this appears to be a coding question or technical interview question, structure your response as follows:\n\n## Thought Process & Intuition\nProvide a detailed explanation of your thought process in bullet points:\n• Explain the problem understanding and key insights\n• Describe the approach strategy and why you chose it\n• Walk through the logic step-by-step\n• Mention any patterns or techniques being used\n• Explain decision points and trade-offs considered\n\n## Solutions\n\n### Brute Force Approach\n**Hints:** Provide 3-5 bullet points guiding toward the brute force solution\n**Intuition:** Explain the straightforward approach and why it works\n**Code:** Provide complete, runnable brute force implementation\n**Complexity:** State time and space complexity with explanation\n\n### Optimized Approach\n**Hints:** Provide 3-5 bullet points guiding toward the optimal solution\n**Intuition:** Explain the optimized approach and key optimization insights\n**Code:** Provide complete, runnable optimized implementation\n**Complexity:** State improved time and space complexity with explanation\n\n## Interview Tips\n• Best practices and common pitfalls to avoid\n• Related follow-up questions an interviewer might ask\n• How to explain your thought process during interviews`;
            }
            // Create user message for OCR analysis
            const analysisRequest = `${actionPrompt}\n\nExtracted text:\n${text}`;
            // ✅ CRITICAL: Save the OCR text as a user message to maintain context
            const timestamp = new Date();
            await this.sessionManager.addChatMessage(sessionId, {
                id: `user-ocr-${Date.now()}`,
                sessionId,
                role: 'user',
                content: analysisRequest,
                timestamp,
                metadata: {
                    action: action,
                    ocrText: text
                }
            });
            // Get system prompt and build conversation history (now includes the OCR message)
            const systemPrompt = this.promptLibraryService.getSystemPrompt(session.profession, session.interviewType);
            const messages = this.buildConversationHistory(sessionId, systemPrompt);
            // Get AI response using the persistent conversation
            const response = await this.callOpenAI(messages);
            // ✅ CRITICAL: Save the AI response to maintain context
            await this.sessionManager.addChatMessage(sessionId, {
                id: `assistant-ocr-${Date.now()}`,
                sessionId,
                role: 'assistant',
                content: response,
                timestamp: new Date(),
                metadata: {
                    action: action,
                    ocrText: text
                }
            });
            return response;
        }
        catch (error) {
            console.error('Failed to process OCR text:', error);
            throw new Error(`OCR processing error: ${error.message}`);
        }
    }
    /**
     * Process audio transcript and get AI coaching - PERSISTENT CONTEXT with Enhanced Code Examples
     */
    async processTranscript(sessionId, transcript, source) {
        try {
            const session = this.sessionManager.getSession(sessionId);
            if (!session) {
                throw new Error('Session not found');
            }
            // Create coaching request based on source using centralized prompts
            let audioType;
            if (source === types_1.AudioSource.SYSTEM) {
                audioType = types_1.AudioPromptType.INTERVIEWER_QUESTION;
            }
            else if (source === types_1.AudioSource.INTERVIEWEE) {
                audioType = types_1.AudioPromptType.INTERVIEWEE_RESPONSE;
            }
            else {
                audioType = types_1.AudioPromptType.GENERAL_TRANSCRIPT;
            }
            let coachingRequest = this.promptLibraryService.getAudioCoachingPrompt(audioType, session.profession, session.interviewType, transcript);
            // 🎯 ENHANCED: Detect if transcript is asking for code/implementation and enhance the request
            const codeKeywords = ['code', 'implement', 'write', 'create', 'build', 'develop', 'function', 'component', 'class', 'method', 'api', 'endpoint', 'route', 'database', 'query', 'algorithm', 'solution', 'program', 'script', 'application', 'website', 'app', 'button', 'form', 'login', 'authentication', 'react', 'node', 'python', 'javascript', 'typescript', 'html', 'css', 'array', 'string', 'loop', 'sorting', 'search', 'tree', 'graph', 'dynamic programming', 'recursion', 'data structure'];
            const transcriptLower = transcript.toLowerCase();
            const isCodeRequest = codeKeywords.some(keyword => transcriptLower.includes(keyword));
            if (isCodeRequest) {
                console.log(`💻 [TRANSCRIPT] Detected code request in transcription, enhancing prompt...`);
                coachingRequest += `\n\n🔧 ENHANCED CODING INSTRUCTION FOR TRANSCRIPTION:\n\nSince this appears to be a coding question or implementation request, structure your response as follows:\n\n## Thought Process & Intuition\nProvide a detailed explanation of your thought process in bullet points:\n• Explain the problem understanding and key insights\n• Describe the approach strategy and why you chose it\n• Walk through the logic step-by-step\n• Mention any patterns or techniques being used\n• Explain decision points and trade-offs considered\n\n## Solutions\n\n### Brute Force Approach\n**Hints:** Provide 3-5 bullet points guiding toward the brute force solution\n**Intuition:** Explain the straightforward approach and why it works\n**Code:** Provide complete, runnable brute force implementation\n**Complexity:** State time and space complexity with explanation\n\n### Optimized Approach\n**Hints:** Provide 3-5 bullet points guiding toward the optimal solution\n**Intuition:** Explain the optimized approach and key optimization insights\n**Code:** Provide complete, runnable optimized implementation\n**Complexity:** State improved time and space complexity with explanation\n\n## Interview Tips\n• Best practices and common pitfalls to avoid\n• Related follow-up questions an interviewer might ask\n• How to explain your thought process during interviews\n\nFor web development requests, include all necessary files, installation, and running instructions.`;
            }
            // ✅ CRITICAL: Save the transcript as a user message to maintain context
            const timestamp = new Date();
            await this.sessionManager.addChatMessage(sessionId, {
                id: `user-audio-${Date.now()}`,
                sessionId,
                role: 'user',
                content: coachingRequest,
                timestamp,
                metadata: {
                    action: types_1.ActionType.GENERAL,
                    source: source,
                    isCodeRequest
                }
            });
            // Get system prompt and build conversation history (now includes the audio message)
            const systemPrompt = this.promptLibraryService.getSystemPrompt(session.profession, session.interviewType);
            const messages = this.buildConversationHistory(sessionId, systemPrompt);
            // Get AI response using the persistent conversation
            const response = await this.callOpenAI(messages);
            // ✅ CRITICAL: Save the AI response to maintain context
            await this.sessionManager.addChatMessage(sessionId, {
                id: `assistant-audio-${Date.now()}`,
                sessionId,
                role: 'assistant',
                content: response,
                timestamp: new Date(),
                metadata: {
                    action: types_1.ActionType.GENERAL,
                    source: source,
                    isCodeRequest
                }
            });
            return response;
        }
        catch (error) {
            console.error('Failed to process transcript:', error);
            throw new Error(`Transcript processing error: ${error.message}`);
        }
    }
    /**
     * Get conversation history for a session
     */
    getConversationHistory(sessionId) {
        return this.sessionManager.getChatHistory(sessionId);
    }
    /**
     * Build conversation history for OpenAI API
     */
    buildConversationHistory(sessionId, systemPrompt) {
        const messages = [];
        // Add system prompt with development guidelines appended
        const systemWithGuidelines = `${systemPrompt}\n\n${this.getDevelopmentGuidelines()}`.trim();
        messages.push({
            role: 'system',
            content: systemWithGuidelines
        });
        // Get recent chat history
        const chatHistory = this.sessionManager.getChatHistory(sessionId);
        // Take only the most recent messages to stay within token limits
        const recentHistory = chatHistory.slice(-this.maxHistoryMessages);
        // Convert to OpenAI format
        for (const msg of recentHistory) {
            // Skip system messages and metadata-only messages
            if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        }
        return messages;
    }
    // Additional formatting instruction to ensure multi-file code solutions for common stacks
    getDevelopmentGuidelines() {
        return [
            'FORMAT INSTRUCTION — Development Questions:',
            'If the user asks for code or a runnable solution for Node.js, React, Flask, Django, or FastAPI, provide a complete, runnable answer that includes ALL required files, not just snippets.',
            'Always include:',
            '- A short project file tree listing (paths and filenames).',
            '- Full contents for each required file (entry points, routes, components, config, package.json/requirements.txt, tsconfig, webpack/vite config if applicable).',
            '- Any environment variables as placeholders (do NOT include secrets).',
            '- Commands to install and run the project (npm/yarn/pip, and start scripts).',
            'Prefer minimal, production-ready defaults. Do not omit boilerplate if it is required to run the app.'
        ].join('\n');
    }
    /**
     * Call OpenAI API
     */
    async callOpenAI(messages) {
        const apiKey = this.configurationManager.getApiKey();
        if (!apiKey) {
            throw new Error('OpenAI API key not configured. Please add your API key in settings.');
        }
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-3.5-turbo',
                    messages: messages,
                    max_tokens: this.maxTokens,
                    temperature: 0.7,
                    top_p: 1,
                    frequency_penalty: 0,
                    presence_penalty: 0
                })
            });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }
            const data = await response.json();
            if (!data.choices || data.choices.length === 0) {
                throw new Error('No response from OpenAI API');
            }
            const content = data.choices[0].message.content;
            if (!content) {
                throw new Error('Empty response from OpenAI API');
            }
            // Log token usage for monitoring
            if (data.usage) {
                console.log(`OpenAI API usage: ${data.usage.total_tokens} tokens (${data.usage.prompt_tokens} prompt + ${data.usage.completion_tokens} completion)`);
            }
            return content.trim();
        }
        catch (error) {
            console.error('OpenAI API call failed:', error);
            // Provide user-friendly error messages
            if (error.message.includes('401')) {
                throw new Error('Invalid API key. Please check your OpenAI API key in settings.');
            }
            else if (error.message.includes('429')) {
                throw new Error('Rate limit exceeded. Please wait a moment and try again.');
            }
            else if (error.message.includes('quota')) {
                throw new Error('API quota exceeded. Please check your OpenAI account billing.');
            }
            else if (error.message.includes('network') || error.message.includes('fetch')) {
                throw new Error('Network error. Please check your internet connection.');
            }
            else {
                throw error;
            }
        }
    }
    /**
     * Estimate token count for messages (rough approximation)
     */
    estimateTokenCount(messages) {
        let totalTokens = 0;
        for (const message of messages) {
            // Rough approximation: 1 token ≈ 4 characters
            totalTokens += Math.ceil(message.content.length / 4);
            // Add overhead for message structure
            totalTokens += 10;
        }
        return totalTokens;
    }
    /**
     * Trim conversation history to fit within token limits
     */
    trimConversationHistory(messages) {
        const estimatedTokens = this.estimateTokenCount(messages);
        if (estimatedTokens <= this.maxTokens * 0.8) { // Leave 20% buffer for response
            return messages;
        }
        // Keep system message and trim from the middle
        const systemMessage = messages[0];
        const conversationMessages = messages.slice(1);
        // Remove older messages until we're under the limit
        while (conversationMessages.length > 2 &&
            this.estimateTokenCount([systemMessage, ...conversationMessages]) > this.maxTokens * 0.8) {
            conversationMessages.shift(); // Remove oldest message
        }
        return [systemMessage, ...conversationMessages];
    }
    /**
     * Check if API key is configured
     */
    isConfigured() {
        return this.configurationManager.isApiKeyConfigured();
    }
    /**
     * Get service status
     */
    getStatus() {
        return {
            configured: this.isConfigured(),
            model: 'gpt-3.5-turbo',
            maxTokens: this.maxTokens
        };
    }
    /**
     * RAG Management Methods
     */
    /**
     * Enable or disable global RAG for a session
     */
    setGlobalRAGEnabled(sessionId, enabled) {
        if (enabled) {
            this.globalRAGEnabledSessions.add(sessionId);
        }
        else {
            this.globalRAGEnabledSessions.delete(sessionId);
        }
        console.log(`🌐 [CHAT] Global RAG ${enabled ? 'enabled' : 'disabled'} for session: ${sessionId}`);
    }
    /**
     * Enable or disable local RAG for a session
     */
    setLocalRAGEnabled(sessionId, enabled) {
        if (enabled) {
            this.localRAGEnabledSessions.add(sessionId);
        }
        else {
            this.localRAGEnabledSessions.delete(sessionId);
        }
        // Also update the local RAG service if available
        if (this.localRAGService) {
            this.localRAGService.setLocalRAGEnabled(sessionId, enabled);
        }
        console.log(`📁 [CHAT] Local RAG ${enabled ? 'enabled' : 'disabled'} for session: ${sessionId}`);
    }
    /**
     * Check if global RAG is enabled for a session
     */
    isGlobalRAGEnabled(sessionId) {
        return this.globalRAGEnabledSessions.has(sessionId);
    }
    /**
     * Check if local RAG is enabled for a session
     */
    isLocalRAGEnabled(sessionId) {
        return this.localRAGEnabledSessions.has(sessionId);
    }
    /**
     * Initialize RAG settings for a new session (both DISABLED by default)
     * RAG will only be used for the initial context message, then disabled
     */
    initializeSessionRAG(sessionId) {
        // 🎯 FIXED: Start with RAG disabled by default
        // RAG will be used only for initialization, then user can manually enable
        this.setGlobalRAGEnabled(sessionId, false);
        this.setLocalRAGEnabled(sessionId, false);
        console.log(`🔧 [RAG] Initialized session ${sessionId} with RAG disabled by default`);
    }
    /**
     * Clean up session RAG settings when session closes
     */
    cleanupSessionRAG(sessionId) {
        this.globalRAGEnabledSessions.delete(sessionId);
        this.localRAGEnabledSessions.delete(sessionId);
        console.log(`🧹 [CHAT] Cleaned up RAG settings for session: ${sessionId}`);
    }
}
exports.ChatService = ChatService;
