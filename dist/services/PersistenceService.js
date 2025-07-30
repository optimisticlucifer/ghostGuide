"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.PersistenceService = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
const EncryptionService_1 = require("./EncryptionService");
class PersistenceService {
    constructor() {
        this.dataPath = path.join(electron_1.app.getPath('userData'), 'interview-assistant');
        this.sessionsFile = path.join(this.dataPath, 'sessions.json');
        this.configFile = path.join(this.dataPath, 'config.json');
        this.encryptionService = new EncryptionService_1.EncryptionService();
        this.ensureDataDirectory();
        this.initializeEncryption();
    }
    async initializeEncryption() {
        try {
            await this.encryptionService.initializeKey();
        }
        catch (error) {
            console.error('Failed to initialize encryption:', error);
        }
    }
    ensureDataDirectory() {
        if (!fs.existsSync(this.dataPath)) {
            fs.mkdirSync(this.dataPath, { recursive: true });
        }
    }
    async saveSession(session) {
        try {
            const sessions = await this.loadAllSessions();
            sessions[session.id] = {
                id: session.id,
                profession: session.profession,
                interviewType: session.interviewType,
                chatHistory: session.chatHistory,
                isRecording: session.isRecording,
                isSystemRecording: session.isSystemRecording,
                ragContext: session.ragContext,
                lastUpdated: new Date().toISOString()
            };
            await fs.promises.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
        }
        catch (error) {
            console.error('Failed to save session:', error);
            throw error;
        }
    }
    async loadSession(sessionId) {
        try {
            const sessions = await this.loadAllSessions();
            const sessionData = sessions[sessionId];
            if (!sessionData)
                return null;
            return {
                id: sessionData.id,
                profession: sessionData.profession,
                interviewType: sessionData.interviewType,
                chatHistory: sessionData.chatHistory || [],
                isRecording: sessionData.isRecording || false,
                isSystemRecording: sessionData.isSystemRecording || false,
                ragContext: sessionData.ragContext || []
            };
        }
        catch (error) {
            console.error('Failed to load session:', error);
            return null;
        }
    }
    async loadAllSessions() {
        try {
            if (!fs.existsSync(this.sessionsFile)) {
                return {};
            }
            const data = await fs.promises.readFile(this.sessionsFile, 'utf8');
            return JSON.parse(data);
        }
        catch (error) {
            console.error('Failed to load sessions:', error);
            return {};
        }
    }
    async deleteSession(sessionId) {
        try {
            const sessions = await this.loadAllSessions();
            delete sessions[sessionId];
            await fs.promises.writeFile(this.sessionsFile, JSON.stringify(sessions, null, 2), 'utf8');
        }
        catch (error) {
            console.error('Failed to delete session:', error);
            throw error;
        }
    }
    async getActiveSessions() {
        try {
            const sessions = await this.loadAllSessions();
            return Object.values(sessions).map(session => ({
                id: session.id,
                profession: session.profession,
                interviewType: session.interviewType,
                createdAt: new Date(session.lastUpdated || Date.now()),
                isActive: true
            }));
        }
        catch (error) {
            console.error('Failed to get active sessions:', error);
            return [];
        }
    }
    async saveAppConfig(config) {
        try {
            // Encrypt sensitive data before saving (but don't fail if encryption fails)
            const configToSave = { ...config };
            // Try to encrypt API key if encryption service is available
            if (configToSave.apiKey && this.encryptionService.isInitialized()) {
                try {
                    configToSave.apiKey = this.encryptionService.encrypt(configToSave.apiKey);
                    configToSave._encrypted = true;
                    console.log('✅ [PERSISTENCE] API key encrypted successfully');
                }
                catch (encryptError) {
                    console.warn('⚠️ [PERSISTENCE] API key encryption failed, saving in plain text:', encryptError.message);
                    // Continue without encryption - save in plain text
                    configToSave._encrypted = false;
                }
            }
            // Try to encrypt prompt library if encryption service is available
            if (configToSave.promptLibrary && this.encryptionService.isInitialized()) {
                try {
                    configToSave.promptLibrary = this.encryptionService.encryptObject(configToSave.promptLibrary);
                    configToSave._promptsEncrypted = true;
                    console.log('✅ [PERSISTENCE] Prompt library encrypted successfully');
                }
                catch (encryptError) {
                    console.warn('⚠️ [PERSISTENCE] Prompt library encryption failed, saving in plain text:', encryptError.message);
                    // Continue without encryption - save in plain text
                    configToSave._promptsEncrypted = false;
                }
            }
            await fs.promises.writeFile(this.configFile, JSON.stringify(configToSave, null, 2), 'utf8');
            console.log('✅ [PERSISTENCE] App config saved successfully');
        }
        catch (error) {
            console.error('❌ [PERSISTENCE] Failed to save app config:', error);
            throw error;
        }
    }
    async loadAppConfig() {
        try {
            if (!fs.existsSync(this.configFile)) {
                return this.getDefaultConfig();
            }
            const data = await fs.promises.readFile(this.configFile, 'utf8');
            const config = JSON.parse(data);
            // Decrypt sensitive data if encrypted
            if (config._encrypted && config.apiKey && this.encryptionService.isInitialized()) {
                try {
                    config.apiKey = this.encryptionService.decrypt(config.apiKey);
                    delete config._encrypted;
                }
                catch (error) {
                    console.warn('Failed to decrypt API key, resetting to empty:', error.message);
                    config.apiKey = '';
                    delete config._encrypted;
                }
            }
            if (config._promptsEncrypted && config.promptLibrary && this.encryptionService.isInitialized()) {
                try {
                    config.promptLibrary = this.encryptionService.decryptObject(config.promptLibrary);
                    delete config._promptsEncrypted;
                }
                catch (error) {
                    console.warn('Failed to decrypt prompt library, resetting to empty:', error.message);
                    config.promptLibrary = {};
                    delete config._promptsEncrypted;
                }
            }
            return config;
        }
        catch (error) {
            console.error('Failed to load app config:', error);
            return this.getDefaultConfig();
        }
    }
    getDefaultConfig() {
        return {
            apiKey: '',
            promptLibrary: {},
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
    async clearAllSessions() {
        try {
            await fs.promises.writeFile(this.sessionsFile, '{}', 'utf8');
        }
        catch (error) {
            console.error('Failed to clear sessions:', error);
            throw error;
        }
    }
    async backupData() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = path.join(this.dataPath, 'backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }
            const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
            const sessions = await this.loadAllSessions();
            const config = await this.loadAppConfig();
            const backupData = {
                sessions,
                config,
                timestamp: new Date().toISOString()
            };
            await fs.promises.writeFile(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
            return backupFile;
        }
        catch (error) {
            console.error('Failed to backup data:', error);
            throw error;
        }
    }
}
exports.PersistenceService = PersistenceService;
