# Prompt Documentation

This document outlines the various prompts used in the Interview Assistant application.

## System Prompts

These prompts define the overall behavior and persona of the AI assistant.

### Main System Prompt

- **Location:** `src/services/PromptLibraryService.ts` (fallback) and configurable in the application's settings.
- **Purpose:** This is the primary prompt that sets the context for the AI. It's dynamically generated based on the user's selected profession and interview type.
- **Example:** "You are an expert {profession} interview assistant. Help the candidate with {interview_type} interview questions and provide guidance based on best practices in the field."
- **Customization:** Users can define their own system prompts for different professions and interview types through the application's settings.

## Action-Specific Prompts

These prompts are used for specific actions within the application.

### Screenshot Analysis

- **Location:** `src/services/PromptLibraryService.ts`
- **Purpose:** Used when the user takes a screenshot. The AI is asked to analyze the content of the screenshot, which is expected to be an interview question.
- **Example:** "Analyze this {interview_type} question or content for a {profession} interview. Provide a clear explanation and suggest an approach to solve it."
- **Customization:** These prompts can be customized for each profession and interview type in the settings.

### Code Debugging

- **Location:** `src/services/PromptLibraryService.ts`
- **Purpose:** Used when the user requests to debug a code snippet. The AI is asked to review the code and provide feedback.
- **Example:** "Review this code for bugs, errors, or improvements in the context of a {profession} {interview_type} interview. Identify issues and provide specific corrections."
- **Customization:** These prompts can be customized for each profession and interview type in the settings.

## Chat Prompts

These prompts are used in the chat interface to handle user messages and provide coaching.

### General Chat

- **Location:** `src/services/ChatService.ts`
- **Purpose:** This is the default prompt used for general conversation with the AI.
- **Example:** The system prompt is used to set the context, and the user's message is sent directly.

### Audio Transcription Coaching

- **Location:** `src/main.ts`
- **Purpose:** When audio is transcribed, this prompt is used to get coaching from the AI based on the transcribed text. It differentiates between the interviewer's speech and the user's speech.
- **Interviewer's Speech Example:** "🎯 **INTERVIEWER QUESTION DETECTED:**

\"{transcription}\"\n\nThis is what the interviewer just asked. Please help me understand:
1. What they're looking for in my response
2. How to structure a strong answer
3. Key talking points to cover
4. Any clarifying questions I should ask

Tailor your advice specifically for this {profession} {interview_type} interview."
- **User's Speech Example:** "🎙️ **MY RESPONSE ANALYSIS:**

\"{transcription}\"\n\nThis is what I just said in response. Please provide:
1. Feedback on my answer quality
2. What I did well
3. Areas for improvement
4. Suggestions for follow-up points
5. How to strengthen similar responses

Evaluate this for a {profession} {interview_type} interview."
- **Customization:** These prompts are currently hardcoded in `src/main.ts` but could be moved to the `PromptLibraryService` for easier customization.

