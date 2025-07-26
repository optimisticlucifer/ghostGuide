import { EncryptionService } from '../../src/services/EncryptionService';
import * as crypto from 'crypto';

// Mock crypto module
jest.mock('crypto');

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  let mockCrypto: jest.Mocked<typeof crypto>;

  beforeEach(() => {
    mockCrypto = crypto as jest.Mocked<typeof crypto>;
    encryptionService = new EncryptionService();
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with a master key', async () => {
      mockCrypto.randomBytes.mockReturnValue(Buffer.from('mock-random-bytes'));
      mockCrypto.pbkdf2Sync.mockReturnValue(Buffer.from('mock-derived-key'));

      await encryptionService.initialize();

      expect(mockCrypto.randomBytes).toHaveBeenCalledWith(32);
      expect(mockCrypto.pbkdf2Sync).toHaveBeenCalled();
    });

    it('should handle initialization errors', async () => {
      mockCrypto.randomBytes.mockImplementation(() => {
        throw new Error('Random bytes generation failed');
      });

      await expect(encryptionService.initialize()).rejects.toThrow('Random bytes generation failed');
    });
  });

  describe('encrypt', () => {
    beforeEach(async () => {
      mockCrypto.randomBytes.mockReturnValue(Buffer.from('mock-random-bytes'));
      mockCrypto.pbkdf2Sync.mockReturnValue(Buffer.from('mock-derived-key'));
      await encryptionService.initialize();
    });

    it('should encrypt data successfully', async () => {
      const mockCipher = {
        update: jest.fn().mockReturnValue(Buffer.from('encrypted-part')),
        final: jest.fn().mockReturnValue(Buffer.from('final-part'))
      };

      mockCrypto.randomBytes.mockReturnValue(Buffer.from('mock-iv'));
      mockCrypto.createCipher.mockReturnValue(mockCipher as any);

      const plaintext = 'sensitive data';
      const result = await encryptionService.encrypt(plaintext);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(mockCrypto.createCipher).toHaveBeenCalledWith('aes-256-cbc', expect.any(Buffer));
      expect(mockCipher.update).toHaveBeenCalledWith(plaintext, 'utf8');
      expect(mockCipher.final).toHaveBeenCalled();
    });

    it('should handle encryption errors', async () => {
      mockCrypto.createCipher.mockImplementation(() => {
        throw new Error('Cipher creation failed');
      });

      await expect(encryptionService.encrypt('test data')).rejects.toThrow('Cipher creation failed');
    });

    it('should encrypt empty string', async () => {
      const mockCipher = {
        update: jest.fn().mockReturnValue(Buffer.from('')),
        final: jest.fn().mockReturnValue(Buffer.from(''))
      };

      mockCrypto.randomBytes.mockReturnValue(Buffer.from('mock-iv'));
      mockCrypto.createCipher.mockReturnValue(mockCipher as any);

      const result = await encryptionService.encrypt('');
      expect(result).toBeDefined();
    });
  });

  describe('decrypt', () => {
    beforeEach(async () => {
      mockCrypto.randomBytes.mockReturnValue(Buffer.from('mock-random-bytes'));
      mockCrypto.pbkdf2Sync.mockReturnValue(Buffer.from('mock-derived-key'));
      await encryptionService.initialize();
    });

    it('should decrypt data successfully', async () => {
      const mockDecipher = {
        update: jest.fn().mockReturnValue(Buffer.from('decrypted-part')),
        final: jest.fn().mockReturnValue(Buffer.from('final-part'))
      };

      mockCrypto.createDecipher.mockReturnValue(mockDecipher as any);

      // Mock encrypted data (base64 encoded)
      const encryptedData = Buffer.concat([
        Buffer.from('mock-iv-16-bytes'),
        Buffer.from('encrypted-content')
      ]).toString('base64');

      const result = await encryptionService.decrypt(encryptedData);

      expect(result).toBe('decrypted-partfinal-part');
      expect(mockCrypto.createDecipher).toHaveBeenCalledWith('aes-256-cbc', expect.any(Buffer));
      expect(mockDecipher.update).toHaveBeenCalled();
      expect(mockDecipher.final).toHaveBeenCalled();
    });

    it('should handle decryption errors', async () => {
      mockCrypto.createDecipher.mockImplementation(() => {
        throw new Error('Decipher creation failed');
      });

      const encryptedData = Buffer.concat([
        Buffer.from('mock-iv-16-bytes'),
        Buffer.from('encrypted-content')
      ]).toString('base64');

      await expect(encryptionService.decrypt(encryptedData)).rejects.toThrow('Decipher creation failed');
    });

    it('should handle invalid encrypted data format', async () => {
      const invalidData = 'invalid-base64-data';

      await expect(encryptionService.decrypt(invalidData)).rejects.toThrow();
    });

    it('should handle encrypted data that is too short', async () => {
      const shortData = Buffer.from('short').toString('base64');

      await expect(encryptionService.decrypt(shortData)).rejects.toThrow();
    });
  });

  describe('generateHash', () => {
    it('should generate hash for data', () => {
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('mock-hash-result')
      };

      mockCrypto.createHash.mockReturnValue(mockHash as any);

      const result = encryptionService.generateHash('test data');

      expect(result).toBe('mock-hash-result');
      expect(mockCrypto.createHash).toHaveBeenCalledWith('sha256');
      expect(mockHash.update).toHaveBeenCalledWith('test data');
      expect(mockHash.digest).toHaveBeenCalledWith('hex');
    });

    it('should handle hash generation errors', () => {
      mockCrypto.createHash.mockImplementation(() => {
        throw new Error('Hash creation failed');
      });

      expect(() => encryptionService.generateHash('test data')).toThrow('Hash creation failed');
    });
  });

  describe('isInitialized', () => {
    it('should return false before initialization', () => {
      const newService = new EncryptionService();
      expect(newService.isInitialized()).toBe(false);
    });

    it('should return true after successful initialization', async () => {
      mockCrypto.randomBytes.mockReturnValue(Buffer.from('mock-random-bytes'));
      mockCrypto.pbkdf2Sync.mockReturnValue(Buffer.from('mock-derived-key'));

      await encryptionService.initialize();
      expect(encryptionService.isInitialized()).toBe(true);
    });
  });

  describe('key derivation', () => {
    it('should derive key with proper parameters', async () => {
      const mockSalt = Buffer.from('mock-salt');
      const mockDerivedKey = Buffer.from('mock-derived-key');

      mockCrypto.randomBytes.mockReturnValue(mockSalt);
      mockCrypto.pbkdf2Sync.mockReturnValue(mockDerivedKey);

      await encryptionService.initialize();

      expect(mockCrypto.pbkdf2Sync).toHaveBeenCalledWith(
        expect.any(String), // password
        mockSalt,
        100000, // iterations
        32, // key length
        'sha256' // digest
      );
    });
  });

  describe('error handling', () => {
    it('should throw error when encrypting without initialization', async () => {
      const newService = new EncryptionService();
      await expect(newService.encrypt('test')).rejects.toThrow();
    });

    it('should throw error when decrypting without initialization', async () => {
      const newService = new EncryptionService();
      await expect(newService.decrypt('test')).rejects.toThrow();
    });

    it('should handle null or undefined input gracefully', async () => {
      mockCrypto.randomBytes.mockReturnValue(Buffer.from('mock-random-bytes'));
      mockCrypto.pbkdf2Sync.mockReturnValue(Buffer.from('mock-derived-key'));
      await encryptionService.initialize();

      await expect(encryptionService.encrypt(null as any)).rejects.toThrow();
      await expect(encryptionService.encrypt(undefined as any)).rejects.toThrow();
      await expect(encryptionService.decrypt(null as any)).rejects.toThrow();
      await expect(encryptionService.decrypt(undefined as any)).rejects.toThrow();
    });
  });
});