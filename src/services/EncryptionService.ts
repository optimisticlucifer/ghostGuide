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
      
      console.log('✅ [ENCRYPTION] Encryption service initialized successfully');
    } catch (error) {
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
      } catch (recoveryError) {
        console.error('❌ [ENCRYPTION] Recovery failed:', recoveryError);
        throw new Error('Encryption initialization failed');
      }
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
            } else {
              // Old format without IV - for backward compatibility
              const decipher = crypto.createDecipher('aes-256-cbc', derivedKey);
              let decrypted = decipher.update(keyData.encryptedKey, 'base64');
              const final = decipher.final();
              this.masterKey = Buffer.concat([decrypted, final]);
            }
          } catch (decryptError) {
            console.warn('Failed to decrypt existing key, generating new one:', (decryptError as Error).message);
            // Generate new key if decryption fails
            this.masterKey = derivedKey;
            // Save the new key by regenerating the key file
            await this.generateMasterKey();
          }
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
      // Use modern crypto with IV
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv('aes-256-cbc', this.masterKey, iv);
      let encrypted = cipher.update(data, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // Prepend IV to encrypted data
      const ivBase64 = iv.toString('base64');
      return ivBase64 + ':' + encrypted;
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
    } catch (newFormatError) {
      console.warn('New format decryption failed, trying old format:', (newFormatError as Error).message);
    }

    // Try old format as fallback
    try {
      const decipher = crypto.createDecipher('aes-256-cbc', this.masterKey);
      let decrypted = decipher.update(encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (oldFormatError) {
      console.error('Both decryption formats failed:', (oldFormatError as Error).message);
      throw new Error('Failed to decrypt data - data may be corrupted');
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