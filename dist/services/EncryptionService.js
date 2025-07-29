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
exports.EncryptionService = void 0;
const crypto = __importStar(require("crypto"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const electron_1 = require("electron");
class EncryptionService {
    constructor() {
        this.algorithm = 'aes-256-gcm';
        this.keyLength = 32; // 256 bits
        this.ivLength = 16; // 128 bits
        this.tagLength = 16; // 128 bits
        this.saltLength = 32; // 256 bits
        this.iterations = 100000; // PBKDF2 iterations
        this.masterKey = null;
        const userDataPath = electron_1.app.getPath('userData');
        this.keyPath = path.join(userDataPath, 'interview-assistant', '.key');
        this.ensureKeyDirectory();
    }
    ensureKeyDirectory() {
        const keyDir = path.dirname(this.keyPath);
        if (!fs.existsSync(keyDir)) {
            fs.mkdirSync(keyDir, { recursive: true });
        }
    }
    /**
     * Initialize or load the master key
     */
    async initializeKey(password) {
        try {
            if (fs.existsSync(this.keyPath)) {
                // Load existing key
                await this.loadMasterKey(password);
            }
            else {
                // Generate new key
                await this.generateMasterKey(password);
            }
            console.log('✅ [ENCRYPTION] Encryption service initialized successfully');
        }
        catch (error) {
            console.error('❌ [ENCRYPTION] Failed to initialize encryption key:', error);
            // Try to recover by generating a fresh key
            try {
                console.log('🔄 [ENCRYPTION] Attempting to recover with fresh key...');
                // Delete corrupted key file if it exists
                if (fs.existsSync(this.keyPath)) {
                    fs.unlinkSync(this.keyPath);
                }
                // Generate fresh key
                await this.generateMasterKey(password);
                console.log('✅ [ENCRYPTION] Encryption service recovered with fresh key');
            }
            catch (recoveryError) {
                console.error('❌ [ENCRYPTION] Recovery failed:', recoveryError);
                throw new Error('Encryption initialization failed');
            }
        }
    }
    /**
     * Generate a new master key and save it
     */
    async generateMasterKey(password) {
        try {
            if (password) {
                // Derive key from password
                const salt = crypto.randomBytes(this.saltLength);
                this.masterKey = crypto.pbkdf2Sync(password, salt, this.iterations, this.keyLength, 'sha256');
                // Save salt for future key derivation
                const keyData = {
                    salt: salt.toString('base64'),
                    iterations: this.iterations,
                    algorithm: this.algorithm
                };
                await fs.promises.writeFile(this.keyPath, JSON.stringify(keyData), 'utf8');
            }
            else {
                // Generate random key
                this.masterKey = crypto.randomBytes(this.keyLength);
                // Save encrypted key (using a default password for now)
                const defaultPassword = 'interview-assistant-default';
                const salt = crypto.randomBytes(this.saltLength);
                const derivedKey = crypto.pbkdf2Sync(defaultPassword, salt, this.iterations, this.keyLength, 'sha256');
                const iv = crypto.randomBytes(16);
                const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
                let encrypted = cipher.update(this.masterKey).toString('base64');
                encrypted += cipher.final('base64');
                // Prepend IV to encrypted data
                const ivBase64 = iv.toString('base64');
                encrypted = ivBase64 + ':' + encrypted;
                const keyData = {
                    encryptedKey: encrypted,
                    salt: salt.toString('base64'),
                    iterations: this.iterations,
                    algorithm: this.algorithm
                };
                await fs.promises.writeFile(this.keyPath, JSON.stringify(keyData), 'utf8');
            }
        }
        catch (error) {
            console.error('Failed to generate master key:', error);
            throw error;
        }
    }
    /**
     * Load existing master key
     */
    async loadMasterKey(password) {
        try {
            const keyData = JSON.parse(await fs.promises.readFile(this.keyPath, 'utf8'));
            const salt = Buffer.from(keyData.salt, 'base64');
            if (password) {
                // Derive key from password
                this.masterKey = crypto.pbkdf2Sync(password, salt, keyData.iterations, this.keyLength, 'sha256');
            }
            else {
                // Use default password to decrypt stored key
                const defaultPassword = 'interview-assistant-default';
                const derivedKey = crypto.pbkdf2Sync(defaultPassword, salt, keyData.iterations, this.keyLength, 'sha256');
                if (keyData.encryptedKey) {
                    try {
                        // Handle both old format (without IV) and new format (with IV)
                        if (keyData.encryptedKey.includes(':')) {
                            // New format with IV
                            const [ivBase64, encrypted] = keyData.encryptedKey.split(':');
                            const iv = Buffer.from(ivBase64, 'base64');
                            const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
                            let decrypted = decipher.update(encrypted, 'base64');
                            const final = decipher.final();
                            this.masterKey = Buffer.concat([decrypted, final]);
                        }
                        else {
                            // Old format without IV - for backward compatibility
                            const decipher = crypto.createDecipher('aes-256-cbc', derivedKey);
                            let decrypted = decipher.update(keyData.encryptedKey, 'base64');
                            const final = decipher.final();
                            this.masterKey = Buffer.concat([decrypted, final]);
                        }
                    }
                    catch (decryptError) {
                        console.warn('Failed to decrypt existing key, generating new one:', decryptError.message);
                        // Generate new key if decryption fails
                        this.masterKey = derivedKey;
                        // Save the new key by regenerating the key file
                        await this.generateMasterKey();
                    }
                }
                else {
                    this.masterKey = derivedKey;
                }
            }
        }
        catch (error) {
            console.error('Failed to load master key:', error);
            throw new Error('Failed to decrypt master key. Invalid password?');
        }
    }
    /**
     * Encrypt data using AES-256-GCM
     */
    encrypt(data) {
        if (!this.masterKey) {
            throw new Error('Encryption key not initialized');
        }
        try {
            // Use modern crypto with IV
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipheriv('aes-256-cbc', this.masterKey, iv);
            let encrypted = cipher.update(data, 'utf8', 'base64');
            encrypted += cipher.final('base64');
            // Prepend IV to encrypted data
            const ivBase64 = iv.toString('base64');
            return ivBase64 + ':' + encrypted;
        }
        catch (error) {
            console.error('Encryption failed:', error);
            throw new Error('Failed to encrypt data');
        }
    }
    /**
     * Decrypt data using AES-256-GCM
     */
    decrypt(encryptedData) {
        if (!this.masterKey) {
            throw new Error('Encryption key not initialized');
        }
        // Try new format first, then fall back to old format
        try {
            if (encryptedData.includes(':')) {
                // New format with IV
                const [ivBase64, encrypted] = encryptedData.split(':');
                const iv = Buffer.from(ivBase64, 'base64');
                const decipher = crypto.createDecipheriv('aes-256-cbc', this.masterKey, iv);
                let decrypted = decipher.update(encrypted, 'base64', 'utf8');
                decrypted += decipher.final('utf8');
                return decrypted;
            }
        }
        catch (newFormatError) {
            console.warn('New format decryption failed, trying old format:', newFormatError.message);
        }
        // Try old format as fallback
        try {
            const decipher = crypto.createDecipher('aes-256-cbc', this.masterKey);
            let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
            decrypted += decipher.final('utf8');
            return decrypted;
        }
        catch (oldFormatError) {
            console.error('Both decryption formats failed:', oldFormatError.message);
            throw new Error('Failed to decrypt data - data may be corrupted');
        }
    }
    /**
     * Encrypt an object (converts to JSON first)
     */
    encryptObject(obj) {
        return this.encrypt(JSON.stringify(obj));
    }
    /**
     * Decrypt to an object (parses JSON after decryption)
     */
    decryptObject(encryptedData) {
        const decryptedJson = this.decrypt(encryptedData);
        return JSON.parse(decryptedJson);
    }
    /**
     * Generate a secure hash of data
     */
    hash(data) {
        return crypto.createHash('sha256').update(data).digest('hex');
    }
    /**
     * Generate a secure random string
     */
    generateSecureRandom(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }
    /**
     * Verify if the encryption service is properly initialized
     */
    isInitialized() {
        return this.masterKey !== null;
    }
    /**
     * Clear the master key from memory (for security)
     */
    clearKey() {
        if (this.masterKey) {
            this.masterKey.fill(0); // Overwrite with zeros
            this.masterKey = null;
        }
    }
    /**
     * Change the master key password
     */
    async changePassword(oldPassword, newPassword) {
        try {
            // Verify old password by attempting to load key
            await this.loadMasterKey(oldPassword);
            // Generate new key with new password
            const salt = crypto.randomBytes(this.saltLength);
            const newKey = crypto.pbkdf2Sync(newPassword, salt, this.iterations, this.keyLength, 'sha256');
            // Save new key data
            const keyData = {
                salt: salt.toString('base64'),
                iterations: this.iterations,
                algorithm: this.algorithm
            };
            await fs.promises.writeFile(this.keyPath, JSON.stringify(keyData), 'utf8');
            this.masterKey = newKey;
        }
        catch (error) {
            console.error('Failed to change password:', error);
            throw new Error('Failed to change encryption password');
        }
    }
}
exports.EncryptionService = EncryptionService;
