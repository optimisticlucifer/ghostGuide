import * as screenshot from 'screenshot-desktop';

export class CaptureService {
    
    async captureScreen(): Promise<Buffer> {
        console.log('📷 [CAPTURE] Starting full-resolution screen capture...');
        
        try {
            // Use screenshot-desktop for full-resolution capture
            const imgBuffer = await screenshot({ format: 'png' });
            
            if (!imgBuffer || imgBuffer.length === 0) {
                throw new Error('Screenshot capture returned empty buffer');
            }
            
            console.log(`📷 [CAPTURE] Screenshot captured successfully, size: ${imgBuffer.length} bytes`);
            return imgBuffer;
            
        } catch (error) {
            console.error(`❌ [CAPTURE] Screen capture failed: ${(error as Error).message}`);
            throw new Error(`Screen capture failed: ${(error as Error).message}`);
        }
    }
}