import { screen, desktopCapturer, BrowserWindow } from 'electron';
import * as Tesseract from 'tesseract.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export class OCRService {
  private tesseractWorker: Tesseract.Worker | null = null;
  private isInitialized = false;
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(os.tmpdir(), 'interview-assistant-ocr');
    this.ensureTempDirectory();
  }

  private ensureTempDirectory(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Initialize Tesseract worker
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      this.tesseractWorker = await Tesseract.createWorker();
      await this.tesseractWorker.loadLanguage('eng');
      await this.tesseractWorker.initialize('eng');
      
      // Configure Tesseract for better accuracy
      await this.tesseractWorker.setParameters({
        tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,;:!?()[]{}+-=*/<>@#$%^&|\\\'\"',
        tessedit_pageseg_mode: Tesseract.PSM.SINGLE_BLOCK,
        preserve_interword_spaces: '1'
      });

      this.isInitialized = true;
      console.log('OCR Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize OCR service:', error);
      throw new Error('OCR initialization failed');
    }
  }

  /**
   * Capture screenshot of the active window
   */
  async captureActiveWindow(): Promise<Buffer> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['window'],
        thumbnailSize: { width: 1920, height: 1080 }
      });

      // Find the focused window (excluding our own windows)
      const focusedWindow = BrowserWindow.getFocusedWindow();
      let targetSource = sources.find(source => 
        !source.name.includes('Interview') && 
        !source.name.includes('systemAssistance') &&
        source.name !== 'Desktop'
      );

      // If no specific window found, capture the first non-system window
      if (!targetSource && sources.length > 0) {
        targetSource = sources.find(source => 
          !source.name.includes('Dock') && 
          !source.name.includes('Desktop')
        ) || sources[0];
      }

      if (!targetSource) {
        throw new Error('No suitable window found for capture');
      }

      // Convert thumbnail to buffer
      const thumbnail = targetSource.thumbnail;
      const buffer = thumbnail.toPNG();
      
      console.log(`Captured window: ${targetSource.name}`);
      return buffer;
    } catch (error) {
      console.error('Failed to capture active window:', error);
      throw new Error('Screenshot capture failed');
    }
  }

  /**
   * Capture screenshot of entire screen
   */
  async captureScreen(): Promise<Buffer> {
    try {
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width: 1920, height: 1080 }
      });

      if (sources.length === 0) {
        throw new Error('No screen sources available');
      }

      // Use the primary screen
      const primaryScreen = sources[0];
      const buffer = primaryScreen.thumbnail.toPNG();
      
      console.log('Screen captured successfully');
      return buffer;
    } catch (error) {
      console.error('Failed to capture screen:', error);
      throw new Error('Screen capture failed');
    }
  }

  /**
   * Extract text from image buffer using OCR
   */
  async extractText(imageBuffer: Buffer): Promise<string> {
    if (!this.isInitialized || !this.tesseractWorker) {
      await this.initialize();
    }

    try {
      const startTime = Date.now();
      
      // Save image to temp file for processing
      const tempImagePath = path.join(this.tempDir, `ocr-${Date.now()}.png`);
      fs.writeFileSync(tempImagePath, imageBuffer);

      // Preprocess image for better OCR accuracy
      const preprocessedBuffer = await this.preprocessImage(imageBuffer);
      
      // Perform OCR
      const { data: { text } } = await this.tesseractWorker!.recognize(preprocessedBuffer);
      
      // Clean up temp file
      if (fs.existsSync(tempImagePath)) {
        fs.unlinkSync(tempImagePath);
      }

      const processingTime = Date.now() - startTime;
      console.log(`OCR completed in ${processingTime}ms`);
      
      return this.cleanExtractedText(text);
    } catch (error) {
      console.error('OCR text extraction failed:', error);
      throw new Error('Text extraction failed');
    }
  }

  /**
   * Process screenshot and extract text (main method with retry logic)
   */
  async processScreenshot(captureType: 'window' | 'screen' = 'window'): Promise<string> {
    const maxRetries = 3;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const startTime = Date.now();
        
        console.log(`OCR attempt ${attempt}/${maxRetries}`);
        
        // Capture screenshot
        const imageBuffer = captureType === 'window' 
          ? await this.captureActiveWindow()
          : await this.captureScreen();
        
        // Validate image buffer
        if (!imageBuffer || imageBuffer.length === 0) {
          throw new Error('Invalid image buffer captured');
        }
        
        // Extract text with timeout
        const extractedText = await this.extractTextWithTimeout(imageBuffer, 10000); // 10 second timeout
        
        const totalTime = Date.now() - startTime;
        console.log(`Screenshot processing completed in ${totalTime}ms (attempt ${attempt})`);
        
        // Validate extracted text
        if (!extractedText || extractedText.trim().length === 0) {
          throw new Error('No text found in screenshot');
        }
        
        // Check if text quality is acceptable
        if (extractedText.trim().length < 3 && attempt < maxRetries) {
          throw new Error('Text quality too low, retrying');
        }
        
        return extractedText;
      } catch (error) {
        lastError = error as Error;
        console.error(`OCR attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    // All attempts failed
    throw new Error(`OCR failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Extract text with timeout to prevent hanging
   */
  private async extractTextWithTimeout(imageBuffer: Buffer, timeoutMs: number): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('OCR operation timed out'));
      }, timeoutMs);
      
      try {
        const text = await this.extractText(imageBuffer);
        clearTimeout(timeout);
        resolve(text);
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }

  /**
   * Preprocess image for better OCR accuracy
   */
  private async preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
    // For now, return the original buffer
    // In a production environment, you might want to add image preprocessing
    // such as contrast enhancement, noise reduction, etc.
    return imageBuffer;
  }

  /**
   * Clean and format extracted text
   */
  private cleanExtractedText(text: string): string {
    return text
      // Remove excessive whitespace
      .replace(/\s+/g, ' ')
      // Remove leading/trailing whitespace
      .trim()
      // Fix common OCR errors
      .replace(/[|]/g, 'I')
      .replace(/[0]/g, 'O')
      // Remove very short lines that are likely noise
      .split('\n')
      .filter(line => line.trim().length > 2)
      .join('\n')
      .trim();
  }

  /**
   * Get OCR confidence score for the last operation
   */
  async getConfidenceScore(imageBuffer: Buffer): Promise<number> {
    if (!this.isInitialized || !this.tesseractWorker) {
      await this.initialize();
    }

    try {
      const { data } = await this.tesseractWorker!.recognize(imageBuffer);
      return data.confidence || 0;
    } catch (error) {
      console.error('Failed to get confidence score:', error);
      return 0;
    }
  }

  /**
   * Extract text from specific region of image
   */
  async extractTextFromRegion(
    imageBuffer: Buffer, 
    region: { x: number; y: number; width: number; height: number }
  ): Promise<string> {
    if (!this.isInitialized || !this.tesseractWorker) {
      await this.initialize();
    }

    try {
      const { data: { text } } = await this.tesseractWorker!.recognize(imageBuffer, {
        rectangle: region
      });
      
      return this.cleanExtractedText(text);
    } catch (error) {
      console.error('Region OCR failed:', error);
      throw new Error('Region text extraction failed');
    }
  }

  /**
   * Check if OCR service is ready
   */
  isReady(): boolean {
    return this.isInitialized && this.tesseractWorker !== null;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    try {
      if (this.tesseractWorker) {
        await this.tesseractWorker.terminate();
        this.tesseractWorker = null;
      }
      
      // Clean up temp directory
      if (fs.existsSync(this.tempDir)) {
        const files = fs.readdirSync(this.tempDir);
        for (const file of files) {
          fs.unlinkSync(path.join(this.tempDir, file));
        }
      }
      
      this.isInitialized = false;
      console.log('OCR Service cleaned up');
    } catch (error) {
      console.error('OCR cleanup failed:', error);
    }
  }

  /**
   * Get service status
   */
  getStatus(): { initialized: boolean; ready: boolean; tempDir: string } {
    return {
      initialized: this.isInitialized,
      ready: this.isReady(),
      tempDir: this.tempDir
    };
  }
}