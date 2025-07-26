import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export class EncryptionService {
  private algorithm = 'aes-256-gcm';
  private keyLength = 32; // 256 bits
  private ivLength = 16; // 128 bits
  private tagLength = 16; // 128 bits
  private saltLength = 32; // 256 bits
  private iterations = 100000; // PBKDF2 iterations
  
  private masterKey: Buffer | null = null;
  private keyPath: string;

  constructor() {
    const userDataPath = app.getPath('userData');
    this.keyPath = path.join(userDataPath, 'interview-assistant', '.key');
    this.ensureKeyDirectory();
  }

  private ensureKeyDirectory(): void {
    const keyDir = path.dirname(this.keyPath);
    if (!fs.existsSync(keyDir)) {
      fs.mkdirSync(keyDir, { recursive: true });
    }
  }

  /**
   * Initialize or load the master key
   */
  async initializeKey(password?: string): Promise<void> {
    try {
      if (fs.existsSync(this.keyPath)) {
        // Load existing key
        await this.loadMasterKey(password);
      } else {
        // Generate new key
        await this.generateMasterKey(password);
      }
    } catch (error) {
      console.error('Failed to initialize encryption key:', error);
      throw new Error('Encryption initialization failed');
    }
  }

  /**
   * Generate a new master key and save it
   */
  private async generateMasterKey(password?: string): Promise<void> {
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
      } else {
        // Generate random key
        this.masterKey = crypto.randomBytes(this.keyLength);
        
        // Save encrypted key (using a default password for now)
        const defaultPassword = 'interview-assistant-default';
        const salt = crypto.randomBytes(this.saltLength);
        const derivedKey = crypto.pbkdf2Sync(defaultPassword, salt, this.iterations, this.keyLength, 'sha256');
        
        const cipher = crypto.createCipher('aes-256-cbc', derivedKey);
        let encrypted = cipher.update(this.masterKey, null, 'base64');
        encrypted += cipher.final('base64');
        
        const keyData = {
          encryptedKey: encrypted,
          salt: salt.toString('base64'),
          iterations: this.iterations,
          algorithm: this.algorithm
        };
        
        await fs.promises.writeFile(this.keyPath, JSON.stringify(keyData), 'utf8');
      }
    } catch (error) {
      console.error('Failed to generate master key:', error);
      throw error;
    }
  }

  /**
   * Load existing master key
   */
  private async loadMasterKey(password?: string): Promise<void> {
    try {
      const keyData = JSON.parse(await fs.promises.readFile(this.keyPath, 'utf8'));
      const salt = Buffer.from(keyData.salt, 'base64');
      
      if (password) {
        // Derive key from password
        this.masterKey = crypto.pbkdf2Sync(password, salt, keyData.iterations, this.keyLength, 'sha256');
      } else {
        // Use default password to decrypt stored key
        const defaultPassword = 'interview-assistant-default';
        const derivedKey = crypto.pbkdf2Sync(defaultPassword, salt, keyData.iterations, this.keyLength, 'sha256');
        
        if (keyData.encryptedKey) {
          const decipher = crypto.createDecipher('aes-256-cbc', derivedKey);
          let decrypted = decipher.update(keyData.encryptedKey, 'base64', null);
          decrypted = Buffer.concat([decrypted, decipher.final()]);
          this.masterKey = decrypted;
        } else {
          this.masterKey = derivedKey;
        }
      }
    } catch (error) {
      console.error('Failed to load master key:', error);
      throw new Error('Failed to decrypt master key. Invalid password?');
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   */
  encrypt(data: string): string {
    if (!this.masterKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const iv = crypto.randomBytes(this.ivLength);
      const cipher = crypto.createCipherGCM(this.algorithm, this.masterKey, iv);
      
      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      const tag = cipher.getAuthTag();
      
      // Combine IV, tag, and encrypted data
      const result = {
        iv: iv.toString('base64'),
        tag: tag.toString('base64'),
        data: encrypted
      };
      
      return Buffer.from(JSON.stringify(result)).toString('base64');
    } catch (error) {
      console.error('Encryption failed:', error);
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   */
  decrypt(encryptedData: string): string {
    if (!this.masterKey) {
      throw new Error('Encryption key not initialized');
    }

    try {
      const combined = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
      const iv = Buffer.from(combined.iv, 'base64');
      const tag = Buffer.from(combined.tag, 'base64');
      const data = combined.data;
      
      const decipher = crypto.createDecipherGCM(this.algorithm, this.masterKey, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(data, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      console.error('Decryption failed:', error);
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Encrypt an object (converts to JSON first)
   */
  encryptObject(obj: any): string {
    return this.encrypt(JSON.stringify(obj));
  }

  /**
   * Decrypt to an object (parses JSON after decryption)
   */
  decryptObject<T>(encryptedData: string): T {
    const decryptedJson = this.decrypt(encryptedData);
    return JSON.parse(decryptedJson);
  }

  /**
   * Generate a secure hash of data
   */
  hash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Generate a secure random string
   */
  generateSecureRandom(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Verify if the encryption service is properly initialized
   */
  isInitialized(): boolean {
    return this.masterKey !== null;
  }

  /**
   * Clear the master key from memory (for security)
   */
  clearKey(): void {
    if (this.masterKey) {
      this.masterKey.fill(0); // Overwrite with zeros
      this.masterKey = null;
    }
  }

  /**
   * Change the master key password
   */
  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
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
      
    } catch (error) {
      console.error('Failed to change password:', error);
      throw new Error('Failed to change encryption password');
    }
  }
}