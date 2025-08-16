# GhostGuide Prompt Collection Documentation

This document provides a comprehensive overview of all prompts used throughout the GhostGuide application, their categorization, usage flows, and implementation details.

## Overview

The GhostGuide application uses a centralized prompt management system implemented in `PromptLibraryService.ts` to ensure consistency, maintainability, and easy updates across all AI interactions.

## Prompt Categories

### 1. System Prompts
**Location:** `PromptLibraryService.getSystemPrompt()`  
**Usage:** Initial context setting for AI conversations  
**Files using:** 
- `src/services/ChatService.ts` - Session initialization
- `src/controllers/IPCController.ts` - Context initialization

**Content Structure:**
- Role definition as interview coach/assistant
- Context awareness for profession and interview type
- Guidance on providing personalized advice
- Instructions for maintaining conversation flow

### 2. Action Prompts
**Location:** `PromptLibraryService.getActionPrompt()`  
**Usage:** Processing different types of user inputs and actions  
**Files using:**
- `src/services/ChatService.ts` - Action processing in `processOCRText()` and `processTranscript()`

**Action Types:**
- **SCREENSHOT**: Analyzing interview questions from screen captures
- **DEBUG**: Code debugging and analysis assistance  
- **CHAT**: General conversational responses
- **TRANSCRIPTION**: Processing audio transcriptions

### 3. Audio Coaching Prompts
**Location:** `PromptLibraryService.getAudioCoachingPrompt()`  
**Usage:** Real-time audio coaching during interviews  
**Files using:**
- `src/services/ChatService.ts` - Audio transcript processing

**Audio Source Types:**
- **INTERVIEWER**: Questions and prompts from interviewer
- **INTERVIEWEE**: User's spoken responses  
- **SYSTEM**: System audio capture
- **BOTH**: Combined audio sources

### 4. OpenAI API Prompts
**Location:** `PromptLibraryService.getOpenAISystemPrompt()` and `getOpenAIUserPrompt()`  
**Usage:** Direct OpenAI API calls for screenshot analysis  
**Files using:**
- `src/controllers/IPCController.ts` - Screenshot analysis with OpenAI

**Components:**
- **System Prompt**: Role definition and behavioral guidelines
- **User Prompt**: Specific analysis request with OCR text

### 5. Fallback Prompts
**Location:** `PromptLibraryService.getFallbackAnalysisPrompt()`  
**Usage:** When OpenAI API is not available or configured  
**Files using:**
- `src/controllers/IPCController.ts` - Fallback screenshot analysis

## Usage Flows

### Flow 1: Session Initialization
```
User creates session → IPCController.initializeChatSessionWithContext()
                  → ChatService.sendMessage() 
                  → PromptLibraryService.getSystemPrompt()
```

### Flow 2: Screenshot Analysis
```
User captures screenshot → IPCController screenshot handler
                      → OpenAI available? 
                      → YES: PromptLibraryService.getOpenAI*Prompts()
                      → NO:  PromptLibraryService.getFallbackAnalysisPrompt()
```

### Flow 3: Audio Processing
```
User stops recording → IPCController audio handler
                   → ChatService.processTranscript()
                   → PromptLibraryService.getAudioCoachingPrompt()
```

### Flow 4: OCR Text Analysis
```
Multi-step capture → IPCController analyze handler
                 → ChatService.processOCRText()
                 → PromptLibraryService.getActionPrompt(SCREENSHOT/DEBUG)
```

### Flow 5: General Chat
```
User sends message → IPCController chat handler
                  → ChatService.sendMessage()
                  → PromptLibraryService.getActionPrompt(CHAT)
```

## File-by-File Prompt Usage

### `src/services/PromptLibraryService.ts`
**Role:** Central prompt repository and management  
**Prompts defined:**
- All system prompts for different professions/interview types
- Action-specific prompts for all ActionTypes
- Audio coaching prompts for all AudioSources
- OpenAI API prompts (system and user)
- Fallback analysis templates
- Debug analysis templates

### `src/services/ChatService.ts`
**Role:** AI conversation management  
**Prompts used:**
- `getSystemPrompt()` - Session initialization
- `getActionPrompt(CHAT)` - Regular chat messages  
- `getActionPrompt(SCREENSHOT/DEBUG)` - OCR text processing
- `getAudioCoachingPrompt()` - Audio transcript processing

**Key Methods:**
- `initializeSession()` - Uses system prompts
- `sendMessage()` - Uses action prompts
- `processOCRText()` - Uses screenshot/debug action prompts
- `processTranscript()` - Uses audio coaching prompts

### `src/controllers/IPCController.ts`
**Role:** IPC communication and OpenAI API integration  
**Prompts used:**
- `getSystemPrompt()` - Context initialization
- `getOpenAISystemPrompt()` - Direct OpenAI calls
- `getOpenAIUserPrompt()` - Direct OpenAI calls  
- `getFallbackAnalysisPrompt()` - When API unavailable

**Key Methods:**
- `initializeChatSessionWithContext()` - Uses system prompts
- `generateOpenAIScreenshotAnalysis()` - Uses OpenAI prompts
- `generateFallbackAnalysis()` - Uses fallback prompts

### `src/services/OCRService.ts`
**Role:** Optical Character Recognition  
**Prompts used:** None directly (OCR text processed by other services)

## Prompt Customization by Context

### Profession-Specific Adaptations
Prompts are dynamically customized based on:
- **software-engineer**: Technical focus, coding challenges, system design
- **data-scientist**: Data analysis, machine learning, statistical methods
- **product-manager**: Strategy, stakeholder management, metrics
- **designer**: User experience, design thinking, creative process

### Interview Type Adaptations  
Prompts adapt based on interview type:
- **technical**: Algorithm focus, code review, problem-solving
- **behavioral**: STAR method, experience-based questions
- **system-design**: Architecture, scalability, trade-offs
- **case-study**: Business analysis, structured thinking

## Prompt Template Structure

### Standard Template Components
1. **Context Header**: Role and situation setup
2. **Instruction Block**: Specific guidance for the AI
3. **Format Guidelines**: Expected response structure  
4. **Personalization**: Dynamic insertion of user context
5. **Fallback Instructions**: Handling edge cases

### Example Template Structure
```typescript
const promptTemplate = `
🎯 **CONTEXT**: ${context}
📋 **TASK**: ${task}
🔍 **FOCUS**: ${focusAreas}
📝 **FORMAT**: ${expectedFormat}
⚠️  **CONSTRAINTS**: ${limitations}
`;
```

## Maintenance Guidelines

### Adding New Prompts
1. Define prompt template in `PromptLibraryService.ts`
2. Add to appropriate category (system, action, audio, etc.)
3. Update consuming services to use new prompt
4. Test across different contexts and professions
5. Update this documentation

### Modifying Existing Prompts
1. Update template in `PromptLibraryService.ts`
2. Test changes across all usage flows  
3. Verify backward compatibility
4. Update documentation if structure changes

### Prompt Quality Guidelines
- **Clarity**: Instructions should be unambiguous
- **Context-awareness**: Templates should adapt to user context
- **Consistency**: Similar situations should use similar language
- **Brevity**: Avoid unnecessary verbosity while maintaining completeness
- **Actionability**: Prompts should guide toward useful responses

## Performance Considerations

### Prompt Length Optimization
- System prompts: ~200-400 tokens
- Action prompts: ~150-300 tokens  
- Audio prompts: ~100-250 tokens
- Fallback prompts: ~300-500 tokens

### Caching Strategy
- Prompts are generated dynamically but could benefit from caching
- Consider memoization for frequently used profession/type combinations
- Template compilation happens at service initialization

## Integration Points

### External Dependencies
- **OpenAI GPT-4**: Primary AI model for prompt processing
- **Electron IPC**: Communication layer for prompt delivery
- **OCR Service**: Provides text input for screenshot prompts  
- **Audio Service**: Provides transcriptions for audio prompts

### Data Flow
```
User Input → Service Layer → PromptLibraryService → AI Model → Response
```

## Testing Strategy

### Prompt Validation
- Unit tests for prompt generation methods
- Integration tests for end-to-end flows
- Manual testing across different professions/types
- A/B testing for prompt effectiveness

### Quality Metrics
- Response relevance and accuracy
- User satisfaction with AI guidance  
- Task completion rates
- Error handling effectiveness

## Future Enhancements

### Planned Improvements
1. **Dynamic Learning**: Adapt prompts based on user feedback
2. **A/B Testing Framework**: Compare prompt effectiveness
3. **Multi-language Support**: Internationalization of prompts
4. **Role-based Customization**: Fine-tuning for specific company cultures
5. **Prompt Analytics**: Track usage patterns and effectiveness

### Extensibility
The current architecture supports easy addition of:
- New profession types
- Additional interview formats  
- Custom action types
- Extended audio source handling
- Specialized fallback scenarios

---

## Conclusion

The centralized prompt management system in GhostGuide ensures consistent, maintainable, and effective AI interactions across all application features. This documentation serves as both a reference for current implementation and a guide for future enhancements.

For technical implementation details, refer to the source code in `src/services/PromptLibraryService.ts` and the consuming services documented above.

**Last Updated:** December 2024  
**Version:** 1.0  
**Maintainer:** GhostGuide Development Team
