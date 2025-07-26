import * as Tesseract from 'tesseract.js';

// Simple OCR service using direct Tesseract approach
export class OCRService {
    
    async extractText(imageBuffer: Buffer): Promise<string> {
        console.log('📷 [OCR] Starting text extraction...');
        console.log(`📷 [OCR] Image buffer size: ${imageBuffer.length} bytes`);
        
        try {
            const startTime = Date.now();
            
            // Use direct Tesseract recognition
            const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng');
            
            const processingTime = Date.now() - startTime;
            const cleanedText = text.trim();
            
            console.log(`✅ [OCR] Text extraction completed in ${processingTime}ms`);
            console.log(`📷 [OCR] Extracted text: "${cleanedText}"`);
            
            return cleanedText;
            
        } catch (error) {
            console.error(`❌ [OCR] Text extraction failed:`, error);
            throw new Error(`OCR text extraction failed: ${(error as Error).message}`);
        }
    }
    
    isReady(): boolean {
        return true; // Direct Tesseract doesn't need initialization
    }
    
    async initialize(): Promise<void> {
        // No initialization needed for direct approach
        console.log('✅ [OCR] OCR service ready (direct mode)');
    }
    
    async cleanup(): Promise<void> {
        // No cleanup needed for direct approach
        console.log('✅ [OCR] OCR service cleaned up');
    }
}