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
exports.CaptureService = void 0;
const screenshot = __importStar(require("screenshot-desktop"));
class CaptureService {
    async captureScreen() {
        console.log('📷 [CAPTURE] Starting full-resolution screen capture...');
        try {
            // Use screenshot-desktop for full-resolution capture
            const imgBuffer = await screenshot({ format: 'png' });
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
