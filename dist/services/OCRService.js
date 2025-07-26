"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.OCRService = void 0;
const Tesseract = __importStar(require("tesseract.js"));
// Simple OCR service using direct Tesseract approach
class OCRService {
    async extractText(imageBuffer) {
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
        }
        catch (error) {
            console.error(`❌ [OCR] Text extraction failed:`, error);
            throw new Error(`OCR text extraction failed: ${error.message}`);
        }
    }
    isReady() {
        return true; // Direct Tesseract doesn't need initialization
    }
    async initialize() {
        // No initialization needed for direct approach
        console.log('✅ [OCR] OCR service ready (direct mode)');
    }
    async cleanup() {
        // No cleanup needed for direct approach
        console.log('✅ [OCR] OCR service cleaned up');
    }
}
exports.OCRService = OCRService;
