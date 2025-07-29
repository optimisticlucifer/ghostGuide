"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionManager = void 0;
const crypto_1 = require("crypto");
const PersistenceService_1 = require("./PersistenceService");
class SessionManager {
    constructor() {
        this.sessions = new Map();
        this.maxSessions = 5;
        this.persistenceService = new PersistenceService_1.PersistenceService();
    }
    async createSession(config) {
        if (this.sessions.size >= this.maxSessions) {
            throw new Error('Maximum number of sessions reached');
        }
        const sessionId = (0, crypto_1.randomUUID)();
        const session = {
            id: sessionId,
            profession: config.profession,
            interviewType: config.interviewType,
            chatHistory: [],
            isRecording: false,
            ragContext: []
        };
        this.sessions.set(sessionId, session);
        // Persist session immediately
        await this.persistenceService.saveSession(session);
        return session;
    }
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    async closeSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            // Save final state before closing
            await this.persistenceService.saveSession(session);
            // Delete from persistence
            await this.persistenceService.deleteSession(sessionId);
        }
        this.sessions.delete(sessionId);
    }
    listActiveSessions() {
        return Array.from(this.sessions.values());
    }
    async addChatMessage(sessionId, message) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.chatHistory.push(message);
            // Auto-save session after adding message
            await this.persistenceService.saveSession(session);
        }
    }
    async updateRecordingState(sessionId, isRecording) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.isRecording = isRecording;
            // Auto-save session after state change
            await this.persistenceService.saveSession(session);
        }
    }
    async addRagContext(sessionId, context) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.ragContext.push(context);
            // Auto-save session after adding context
            await this.persistenceService.saveSession(session);
        }
    }
    getChatHistory(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? session.chatHistory : [];
    }
    clearChatHistory(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.chatHistory = [];
        }
    }
    getSessionCount() {
        return this.sessions.size;
    }
    isSessionActive(sessionId) {
        return this.sessions.has(sessionId);
    }
    updateSessionConfig(sessionId, updates) {
        const session = this.sessions.get(sessionId);
        if (session) {
            if (updates.profession)
                session.profession = updates.profession;
            if (updates.interviewType)
                session.interviewType = updates.interviewType;
        }
    }
    // Session restoration methods
    async restoreActiveSessions() {
        try {
            const sessionConfigs = await this.persistenceService.getActiveSessions();
            const restoredSessions = [];
            for (const config of sessionConfigs) {
                const session = await this.persistenceService.loadSession(config.id);
                if (session) {
                    this.sessions.set(session.id, session);
                    restoredSessions.push(session);
                }
            }
            return restoredSessions;
        }
        catch (error) {
            console.error('Failed to restore sessions:', error);
            return [];
        }
    }
    async restoreSession(sessionId) {
        try {
            const session = await this.persistenceService.loadSession(sessionId);
            if (session) {
                this.sessions.set(sessionId, session);
                return session;
            }
            return null;
        }
        catch (error) {
            console.error('Failed to restore session:', error);
            return null;
        }
    }
    async saveAllSessions() {
        try {
            const savePromises = Array.from(this.sessions.values()).map(session => this.persistenceService.saveSession(session));
            await Promise.all(savePromises);
        }
        catch (error) {
            console.error('Failed to save all sessions:', error);
            throw error;
        }
    }
    async clearAllSessions() {
        try {
            await this.persistenceService.clearAllSessions();
            this.sessions.clear();
        }
        catch (error) {
            console.error('Failed to clear all sessions:', error);
            throw error;
        }
    }
    async backupSessions() {
        try {
            // Save current state before backup
            await this.saveAllSessions();
            return await this.persistenceService.backupData();
        }
        catch (error) {
            console.error('Failed to backup sessions:', error);
            throw error;
        }
    }
    // Session isolation - ensure no data leakage between sessions
    validateSessionIsolation(sessionId) {
        const session = this.sessions.get(sessionId);
        if (!session)
            return false;
        // Ensure session data is properly isolated
        return session.chatHistory.every(msg => msg.sessionId === sessionId) &&
            session.ragContext.length >= 0; // Basic validation
    }
}
exports.SessionManager = SessionManager;
