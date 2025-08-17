import screenshot from 'screenshot-desktop';
import sharp from 'sharp';

export enum CaptureType {
  FULL = 'full',
  LEFT_HALF = 'left_half',
  RIGHT_HALF = 'right_half',
  AREA = 'area'
}

export interface AreaCoordinates {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export class CaptureService {
    
    /**
     * Capture full screen (original method)
     */
    async captureScreen(): Promise<Buffer> {
        return this.captureScreenWithType(CaptureType.FULL);
    }
    
    /**
     * Capture screen with specified type (full, left half, right half)
     */
    async captureScreenWithType(captureType: CaptureType): Promise<Buffer> {
        console.log(`📷 [CAPTURE] Starting ${captureType} screen capture...`);
        
        try {
            // First, capture the full screen
            const fullScreenBuffer = await this.captureFullScreen();
            
            // Process based on capture type
            switch (captureType) {
                case CaptureType.FULL:
                    console.log(`📷 [CAPTURE] Full screen capture completed, size: ${fullScreenBuffer.length} bytes`);
                    return fullScreenBuffer;
                    
                case CaptureType.LEFT_HALF:
                    console.log(`📷 [CAPTURE] Processing left half capture...`);
                    return await this.cropLeftHalf(fullScreenBuffer);
                    
                case CaptureType.RIGHT_HALF:
                    console.log(`📷 [CAPTURE] Processing right half capture...`);
                    return await this.cropRightHalf(fullScreenBuffer);
                    
                case CaptureType.AREA:
                    throw new Error('Area capture requires coordinates. Use captureArea() method instead.');
                    
                default:
                    throw new Error(`Unsupported capture type: ${captureType}`);
            }
            
        } catch (error) {
            console.error(`❌ [CAPTURE] ${captureType} capture failed: ${(error as Error).message}`);
            throw new Error(`${captureType} capture failed: ${(error as Error).message}`);
        }
    }
    
    /**
     * Capture the full screen using screenshot-desktop
     */
    private async captureFullScreen(): Promise<Buffer> {
        console.log('📷 [CAPTURE] Capturing full screen...');
        
        const imgBuffer = await screenshot();
        
        if (!imgBuffer || imgBuffer.length === 0) {
            throw new Error('Screenshot capture returned empty buffer');
        }
        
        return imgBuffer;
    }
    
    /**
     * Crop the left half of the screen
     */
    private async cropLeftHalf(imageBuffer: Buffer): Promise<Buffer> {
        try {
            console.log('📷 [CAPTURE] Cropping left half of screen...');
            
            const image = sharp(imageBuffer);
            const { width, height } = await image.metadata();
            
            if (!width || !height) {
                throw new Error('Unable to get image dimensions');
            }
            
            // Crop left half: x=0, y=0, width=width/2, height=height
            const leftHalf = await image
                .extract({ 
                    left: 0, 
                    top: 0, 
                    width: Math.floor(width / 2), 
                    height: height 
                })
                .png()
                .toBuffer();
            
            console.log(`📷 [CAPTURE] Left half cropped successfully, size: ${leftHalf.length} bytes`);
            return leftHalf;
            
        } catch (error) {
            console.error(`❌ [CAPTURE] Left half crop failed: ${(error as Error).message}`);
            throw new Error(`Left half crop failed: ${(error as Error).message}`);
        }
    }
    
    /**
     * Crop the right half of the screen
     */
    private async cropRightHalf(imageBuffer: Buffer): Promise<Buffer> {
        try {
            console.log('📷 [CAPTURE] Cropping right half of screen...');
            
            const image = sharp(imageBuffer);
            const { width, height } = await image.metadata();
            
            if (!width || !height) {
                throw new Error('Unable to get image dimensions');
            }
            
            // Crop right half: x=width/2, y=0, width=width/2, height=height
            const rightHalf = await image
                .extract({ 
                    left: Math.floor(width / 2), 
                    top: 0, 
                    width: Math.floor(width / 2), 
                    height: height 
                })
                .png()
                .toBuffer();
            
            console.log(`📷 [CAPTURE] Right half cropped successfully, size: ${rightHalf.length} bytes`);
            return rightHalf;
            
        } catch (error) {
            console.error(`❌ [CAPTURE] Right half crop failed: ${(error as Error).message}`);
            throw new Error(`Right half crop failed: ${(error as Error).message}`);
        }
    }
    
    /**
     * Capture a specific rectangular area defined by two coordinate points
     */
    async captureArea(coordinates: AreaCoordinates): Promise<Buffer> {
        console.log(`📷 [CAPTURE] Starting area capture with coordinates:`, coordinates);
        
        try {
            // First, capture the full screen
            const fullScreenBuffer = await this.captureFullScreen();
            
            // Get screen capture dimensions to detect scale factor
            const image = sharp(fullScreenBuffer);
            const { width: screenWidth, height: screenHeight } = await image.metadata();
            
            if (!screenWidth || !screenHeight) {
                throw new Error('Unable to get screen dimensions');
            }
            
            // Import screen module to get logical screen size
            const { screen } = require('electron');
            const primaryDisplay = screen.getPrimaryDisplay();
            const logicalBounds = primaryDisplay.bounds;
            const workArea = primaryDisplay.workArea;
            const scaleFactor = primaryDisplay.scaleFactor;
            
            const logicalWidth = logicalBounds.width;
            const logicalHeight = logicalBounds.height;
            
            // Calculate scale factor
            const scaleFactorX = screenWidth / logicalWidth;
            const scaleFactorY = screenHeight / logicalHeight;
            
            console.log(`📷 [CAPTURE] Screen scale factors: X=${scaleFactorX}, Y=${scaleFactorY}`);
            
            // Calculate the rectangular area from coordinates (in logical pixels)
            const logicalLeft = Math.min(coordinates.x1, coordinates.x2);
            const logicalTop = Math.min(coordinates.y1, coordinates.y2);
            const logicalRight = Math.max(coordinates.x1, coordinates.x2);
            const logicalBottom = Math.max(coordinates.y1, coordinates.y2);
            
            // Scale coordinates to physical pixels
            const left = Math.round(logicalLeft * scaleFactorX);
            const top = Math.round(logicalTop * scaleFactorY);
            const right = Math.round(logicalRight * scaleFactorX);
            const bottom = Math.round(logicalBottom * scaleFactorY);
            
            // IMPORTANT: The overlay coordinates are relative to the screen content area (below menu bar),
            // but the screenshot capture includes the full screen including the menu bar.
            // We need to adjust for the menu bar offset.
            const menuBarOffset = workArea.y; // This is typically 25px on macOS
            
            // Adjust the Y coordinates to account for menu bar
            const adjustedTop = top + (menuBarOffset * scaleFactorY);
            const adjustedBottom = bottom + (menuBarOffset * scaleFactorY);
            
            const width = right - left;
            const height = adjustedBottom - adjustedTop;
            
            console.log(`📷 [CAPTURE] Calculated area: left=${left}, top=${adjustedTop}, width=${width}, height=${height}`);
            
            if (width <= 0 || height <= 0) {
                throw new Error('Invalid area dimensions: width and height must be positive');
            }
            
            // Validate adjusted coordinates are within screen bounds
            if (left < 0 || adjustedTop < 0 || right > screenWidth || adjustedBottom > screenHeight) {
                console.warn(`📷 [CAPTURE] Coordinates may be outside screen bounds. Screen: ${screenWidth}x${screenHeight}`);
            }
            
            // Calculate actual extraction parameters using adjusted coordinates
            const extractLeft = Math.max(0, left);
            const extractTop = Math.max(0, adjustedTop);
            const extractWidth = Math.min(width, screenWidth - extractLeft);
            const extractHeight = Math.min(height, screenHeight - extractTop);
            
            const croppedArea = await image
                .extract({ 
                    left: extractLeft,
                    top: extractTop,
                    width: extractWidth,
                    height: extractHeight
                })
                .png()
                .toBuffer();
            
            console.log(`📷 [CAPTURE] Area captured successfully, size: ${croppedArea.length} bytes`);
            return croppedArea;
            
        } catch (error) {
            console.error(`❌ [CAPTURE] Area capture failed: ${(error as Error).message}`);
            throw new Error(`Area capture failed: ${(error as Error).message}`);
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