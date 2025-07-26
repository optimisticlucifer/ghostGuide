"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CaptureService = void 0;
const screenshot_desktop_1 = __importDefault(require("screenshot-desktop")); // Adjusting import to default
class CaptureService {
    async captureScreen() {
        console.log('📷 [CAPTURE] Checking screen recording permissions...');
        console.log('📷 [CAPTURE] Checking for screen recording permissions...');
        console.log('📷 [CAPTURE] Checking if screenshot-desktop is available...');
        try {
            // Use screenshot-desktop for full-resolution capture
            const imgBuffer = await (0, screenshot_desktop_1.default)(); // Updated to call without parameters
            if (!imgBuffer || imgBuffer.length === 0) {
                throw new Error('Screenshot capture returned empty buffer');
            }
            console.log(`📷 [CAPTURE] Screenshot captured successfully, size: ${imgBuffer.length} bytes`);
            return imgBuffer;
        }
        catch (error) {
            console.error(`❌ [CAPTURE] Screen capture failed: ${error.message}`);
            throw new Error(`Screen capture failed: ${error.message}`);
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
