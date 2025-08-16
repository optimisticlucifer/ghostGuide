"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaptureService = exports.CaptureType = void 0;
const screenshot_desktop_1 = __importDefault(require("screenshot-desktop"));
const sharp_1 = __importDefault(require("sharp"));
var CaptureType;
(function (CaptureType) {
    CaptureType["FULL"] = "full";
    CaptureType["LEFT_HALF"] = "left_half";
    CaptureType["RIGHT_HALF"] = "right_half";
})(CaptureType || (exports.CaptureType = CaptureType = {}));
class CaptureService {
    /**
     * Capture full screen (original method)
     */
    async captureScreen() {
        return this.captureScreenWithType(CaptureType.FULL);
    }
    /**
     * Capture screen with specified type (full, left half, right half)
     */
    async captureScreenWithType(captureType) {
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
                default:
                    throw new Error(`Unsupported capture type: ${captureType}`);
            }
        }
        catch (error) {
            console.error(`❌ [CAPTURE] ${captureType} capture failed: ${error.message}`);
            throw new Error(`${captureType} capture failed: ${error.message}`);
        }
    }
    /**
     * Capture the full screen using screenshot-desktop
     */
    async captureFullScreen() {
        console.log('📷 [CAPTURE] Capturing full screen...');
        const imgBuffer = await (0, screenshot_desktop_1.default)();
        if (!imgBuffer || imgBuffer.length === 0) {
            throw new Error('Screenshot capture returned empty buffer');
        }
        return imgBuffer;
    }
    /**
     * Crop the left half of the screen
     */
    async cropLeftHalf(imageBuffer) {
        try {
            console.log('📷 [CAPTURE] Cropping left half of screen...');
            const image = (0, sharp_1.default)(imageBuffer);
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
        }
        catch (error) {
            console.error(`❌ [CAPTURE] Left half crop failed: ${error.message}`);
            throw new Error(`Left half crop failed: ${error.message}`);
        }
    }
    /**
     * Crop the right half of the screen
     */
    async cropRightHalf(imageBuffer) {
        try {
            console.log('📷 [CAPTURE] Cropping right half of screen...');
            const image = (0, sharp_1.default)(imageBuffer);
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
        }
        catch (error) {
            console.error(`❌ [CAPTURE] Right half crop failed: ${error.message}`);
            throw new Error(`Right half crop failed: ${error.message}`);
        }
    }
}
exports.CaptureService = CaptureService;
// Adding logging for screen capture functionality
console.log("Starting screen capture...");
// Check if screenshot-desktop is available
if (typeof screenshot_desktop_1.default !== 'function') {
    console.error("Screen capture failed: screenshot is not a function");
    // Removed return statement to avoid TypeScript error
}
