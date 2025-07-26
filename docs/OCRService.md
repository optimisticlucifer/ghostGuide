# OCRService Documentation

The OCRService provides real-time text extraction from images using Tesseract.js with comprehensive result data and configurable processing options.

## Overview

The OCRService has been refactored to provide a clean, focused implementation that:
- Uses Tesseract.js for accurate OCR processing
- Provides enhanced result data with confidence scores and metadata
- Supports runtime configuration updates
- Includes comprehensive error handling and logging
- Manages worker lifecycle efficiently

## Core Features

### Real OCR Processing
- **Tesseract.js Integration**: Uses the latest Tesseract.js library for accurate text extraction
- **Worker Management**: Proper initialization, usage, and cleanup of Tesseract workers
- **Buffer Processing**: Direct processing of image buffers without temporary files

### Enhanced Result Data
- **Comprehensive Results**: Returns detailed OCR results including original text, cleaned text, confidence scores, and processing metrics
- **Image Metadata**: Provides image dimensions, format, and size information
- **Performance Metrics**: Tracks processing time and word count statistics
- **Debug Information**: Includes OCR settings and confidence analysis for troubleshooting

### Configurable Settings
- **Language Support**: Configurable language selection (default: English)
- **Engine Modes**: Support for different OCR engine modes (LSTM, Legacy, etc.)
- **Page Segmentation**: Configurable page segmentation modes for different content types
- **Character Filtering**: Optional whitelist/blacklist for character recognition

## API Reference

### Constructor

```typescript
constructor(config?: Partial<OCRConfig>)
```

Creates a new OCRService instance with optional configuration.

**Parameters:**
- `config` (optional): Partial OCR configuration object

**Default Configuration:**
```typescript
{
  language: 'eng',
  engineMode: 1,        // LSTM engine mode
  pageSegMode: 6,       // Uniform block of text
  whitelist: undefined, // No character restrictions
  blacklist: undefined  // No character restrictions
}
```

### Core Methods

#### `initialize(): Promise<void>`
Initializes the Tesseract.js worker with configured settings.

**Process:**
1. Creates Tesseract worker for specified language
2. Applies configuration parameters
3. Sets initialized flag and logs success

**Throws:** Error if initialization fails

**Example:**
```typescript
const ocrService = new OCRService();
await ocrService.initialize();
console.log('OCR service ready');
```

#### `extractText(imageBuffer: Buffer): Promise<EnhancedOCRResult>`
Extracts text from an image buffer with comprehensive result data.

**Parameters:**
- `imageBuffer`: Buffer containing image data (PNG, JPEG, etc.)

**Returns:** `EnhancedOCRResult` with detailed extraction results

**Process:**
1. Validates service initialization
2. Performs OCR on image buffer
3. Cleans and processes extracted text
4. Calculates performance metrics
5. Returns comprehensive result object

**Example:**
```typescript
const imageBuffer = fs.readFileSync('screenshot.png');
const result = await ocrService.extractText(imageBuffer);

console.log(`Extracted: "${result.cleanedText}"`);
console.log(`Confidence: ${result.confidence}%`);
console.log(`Processing time: ${result.processingTime}ms`);
```

#### `cleanup(): Promise<void>`
Terminates the Tesseract worker and cleans up resources.

**Process:**
1. Terminates active worker
2. Resets initialization state
3. Logs cleanup completion

**Example:**
```typescript
await ocrService.cleanup();
console.log('OCR service cleaned up');
```

### Configuration Methods

#### `isReady(): boolean`
Checks if the OCR service is initialized and ready for use.

**Returns:** `true` if service is ready, `false` otherwise

#### `getConfig(): OCRConfig`
Returns a copy of the current OCR configuration.

**Returns:** Current OCR configuration object

#### `updateConfig(newConfig: Partial<OCRConfig>): Promise<void>`
Updates OCR configuration at runtime without reinitializing the service.

**Parameters:**
- `newConfig`: Partial configuration object with new settings

**Process:**
1. Merges new configuration with existing settings
2. Updates worker parameters if service is initialized
3. Logs configuration changes

**Example:**
```typescript
// Update to use different page segmentation mode
await ocrService.updateConfig({
  pageSegMode: 3, // Single text line
  whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz '
});
```

## Data Types

### OCRConfig
```typescript
interface OCRConfig {
  language: string;      // Language code (e.g., 'eng', 'spa')
  engineMode: number;    // OCR engine mode (1=LSTM, 0=Legacy, 2=LSTM+Legacy)
  pageSegMode: number;   // Page segmentation mode (6=uniform block, 3=single line, etc.)
  whitelist?: string;    // Allowed characters (optional)
  blacklist?: string;    // Forbidden characters (optional)
}
```

### EnhancedOCRResult
```typescript
interface EnhancedOCRResult {
  originalText: string;     // Raw OCR output
  cleanedText: string;      // Processed and cleaned text
  confidence: number;       // Overall confidence score (0-100)
  processingTime: number;   // Processing time in milliseconds
  imageInfo: {
    width: number;          // Image width in pixels
    height: number;         // Image height in pixels
    format: string;         // Image format (PNG, JPEG, etc.)
    size: number;           // Image size in bytes
  };
  debugInfo: {
    ocrSettings: OCRConfig; // OCR configuration used
    wordCount: number;      // Number of words extracted
    averageConfidence: number; // Average word confidence
  };
}
```

## Configuration Options

### Engine Modes
- **0 (Legacy)**: Original Tesseract engine, good for older documents
- **1 (LSTM)**: Neural network-based engine, better for modern text (default)
- **2 (LSTM + Legacy)**: Combines both engines for maximum accuracy

### Page Segmentation Modes
- **3**: Single text line
- **6**: Uniform block of text (default)
- **7**: Single text line, treating image as single word
- **8**: Single word
- **13**: Raw line, treating image as single text line

### Language Codes
- **'eng'**: English (default)
- **'spa'**: Spanish
- **'fra'**: French
- **'deu'**: German
- **'chi_sim'**: Simplified Chinese
- **'jpn'**: Japanese

## Text Cleaning

The service automatically cleans extracted text to improve readability:

```typescript
private cleanText(text: string): string {
  return text
    .replace(/\s+/g, ' ')                    // Normalize whitespace
    .replace(/[^\w\s.,!?;:()\-"']/g, '')     // Remove unusual characters
    .trim();                                 // Remove leading/trailing spaces
}
```

**Cleaning Process:**
1. **Whitespace Normalization**: Replaces multiple spaces, tabs, and newlines with single spaces
2. **Character Filtering**: Removes unusual characters while preserving common punctuation
3. **Trimming**: Removes leading and trailing whitespace

## Error Handling

### Common Errors
- **Initialization Failure**: Worker creation or language loading fails
- **Processing Errors**: Image format issues or OCR processing failures
- **Configuration Errors**: Invalid configuration parameters

### Error Messages
All errors include descriptive messages and context:
```typescript
throw new Error(`OCR initialization failed: ${(error as Error).message}`);
throw new Error(`OCR text extraction failed: ${(error as Error).message}`);
```

### Logging
Comprehensive logging throughout the OCR process:
```typescript
console.log('🔧 [OCR] Initializing Tesseract.js worker...');
console.log('✅ [OCR] Tesseract.js worker initialized successfully');
console.log('📷 [OCR] Starting real text extraction...');
console.log(`✅ [OCR] Text extraction completed in ${processingTime}ms`);
```

## Performance Considerations

### Optimization Strategies
- **Worker Reuse**: Single worker instance per service for better performance
- **Buffer Processing**: Direct buffer processing without temporary files
- **Efficient Cleanup**: Proper resource management and cleanup

### Performance Metrics
The service tracks key performance indicators:
- **Processing Time**: Time from start to completion of OCR
- **Confidence Scores**: Overall and per-word confidence metrics
- **Word Count**: Number of words successfully extracted
- **Image Size**: Input image dimensions and file size

### Memory Management
- **Worker Lifecycle**: Proper initialization and cleanup of Tesseract workers
- **Buffer Handling**: Efficient processing of image buffers
- **Resource Cleanup**: Automatic cleanup on service termination

## Usage Examples

### Basic Usage
```typescript
import { OCRService } from './services/OCRService';

const ocrService = new OCRService();

// Initialize service
await ocrService.initialize();

// Process image
const imageBuffer = fs.readFileSync('screenshot.png');
const result = await ocrService.extractText(imageBuffer);

console.log(`Text: ${result.cleanedText}`);
console.log(`Confidence: ${result.confidence}%`);

// Cleanup when done
await ocrService.cleanup();
```

### Advanced Configuration
```typescript
const ocrService = new OCRService({
  language: 'eng',
  engineMode: 1,           // LSTM engine
  pageSegMode: 3,          // Single text line
  whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz .,!?'
});

await ocrService.initialize();

// Process multiple images with same configuration
for (const imagePath of imagePaths) {
  const buffer = fs.readFileSync(imagePath);
  const result = await ocrService.extractText(buffer);
  console.log(`${imagePath}: ${result.cleanedText}`);
}
```

### Runtime Configuration Updates
```typescript
const ocrService = new OCRService();
await ocrService.initialize();

// Update configuration for different content type
await ocrService.updateConfig({
  pageSegMode: 6,          // Uniform block of text
  engineMode: 2            // LSTM + Legacy for better accuracy
});

// Process with new settings
const result = await ocrService.extractText(imageBuffer);
```

### Error Handling
```typescript
const ocrService = new OCRService();

try {
  await ocrService.initialize();
  
  if (!ocrService.isReady()) {
    throw new Error('OCR service not ready');
  }
  
  const result = await ocrService.extractText(imageBuffer);
  
  if (result.confidence < 50) {
    console.warn('Low confidence OCR result:', result.confidence);
  }
  
} catch (error) {
  console.error('OCR processing failed:', error.message);
} finally {
  await ocrService.cleanup();
}
```

## Integration with Application

### Main Application Integration
The OCRService integrates with the main application through:
- **Screenshot Processing**: Processes captured screenshots for text extraction
- **AI Analysis**: Provides extracted text to ChatService for intelligent analysis
- **Performance Monitoring**: Reports processing metrics to PerformanceMonitor
- **Error Handling**: Integrates with ErrorHandler for comprehensive error management

### Session Management
- **Per-Session Configuration**: Different OCR settings per interview session
- **Configuration Persistence**: OCR settings saved with session data
- **Dynamic Updates**: Runtime configuration changes based on content type

### Performance Integration
```typescript
// Record OCR performance metrics
const startTime = Date.now();
const result = await ocrService.extractText(imageBuffer);
const latency = Date.now() - startTime;

performanceMonitor.recordOCRLatency(latency);
```

## Troubleshooting

### Common Issues

#### Initialization Failures
- **Cause**: Network issues downloading language data
- **Solution**: Check internet connection and retry initialization
- **Prevention**: Cache language data locally

#### Low Confidence Results
- **Cause**: Poor image quality, unusual fonts, or complex layouts
- **Solution**: Try different page segmentation modes or engine settings
- **Prevention**: Optimize image capture quality

#### Memory Issues
- **Cause**: Multiple workers or large images
- **Solution**: Ensure proper cleanup and single worker usage
- **Prevention**: Monitor memory usage and implement cleanup

### Debug Information
Use the debug information in OCR results for troubleshooting:
```typescript
const result = await ocrService.extractText(imageBuffer);

console.log('Debug Info:', {
  settings: result.debugInfo.ocrSettings,
  wordCount: result.debugInfo.wordCount,
  avgConfidence: result.debugInfo.averageConfidence,
  processingTime: result.processingTime
});
```

### Performance Optimization
- **Image Quality**: Ensure high-quality, high-contrast images
- **Configuration Tuning**: Adjust engine mode and page segmentation for content type
- **Worker Management**: Reuse workers instead of creating new ones
- **Memory Monitoring**: Monitor and cleanup resources regularly

## Future Enhancements

### Planned Features
- **Image Preprocessing**: Automatic image enhancement for better OCR accuracy
- **Multi-Language Support**: Dynamic language detection and switching
- **Batch Processing**: Process multiple images efficiently
- **Confidence Thresholds**: Configurable confidence thresholds for result validation

### Performance Improvements
- **Caching**: Cache OCR results for identical images
- **Parallel Processing**: Process multiple regions simultaneously
- **Optimization**: Fine-tune settings for specific content types
- **Hardware Acceleration**: Utilize GPU acceleration when available