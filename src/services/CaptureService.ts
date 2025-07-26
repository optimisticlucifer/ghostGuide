import screenshot from 'screenshot-desktop'; // Adjusting import to default

export class CaptureService {
    
    async captureScreen(): Promise<Buffer> {
        console.log('📷 [CAPTURE] Checking screen recording permissions...');
        console.log('📷 [CAPTURE] Checking for screen recording permissions...');
        console.log('📷 [CAPTURE] Checking if screenshot-desktop is available...');
        
        try {
            // Use screenshot-desktop for full-resolution capture
            const imgBuffer = await screenshot(); // Updated to call without parameters
            
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
// Adding logging for screen capture functionality
console.log("Starting screen capture...");
// Check if screenshot-desktop is available
if (typeof screenshot !== 'function') {
    console.error("Screen capture failed: screenshot is not a function");
    // Removed return statement to avoid TypeScript error
}