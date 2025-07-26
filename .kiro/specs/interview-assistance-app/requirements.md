# Requirements Document

## Introduction

The Interview Assistance application is an Electron-based desktop application designed to provide real-time, invisible support during technical and HR interviews on macOS. The application leverages on-screen OCR, audio capture, ChatGPT APIs, and RAG (Retrieval-Augmented Generation) to help candidates during live interviews while maintaining complete invisibility on shared screens.

## Requirements

### Requirement 1

**User Story:** As a technical interview candidate, I want the application to remain completely invisible during screen sharing, so that interviewers cannot detect I'm using assistance tools.

#### Acceptance Criteria

1. WHEN the user presses 'g' key THEN the main window SHALL hide and remove its Dock icon
2. WHEN the user presses 'h' key THEN the session window SHALL hide and remove its Dock icon
3. WHEN the application is running THEN the process SHALL be named "systemAssistance" in Activity Monitor
4. WHEN screen sharing is active THEN the application windows SHALL not appear in shared content
5. IF the application is hidden THEN it SHALL maintain functionality for hotkey activation

### Requirement 2

**User Story:** As an interview candidate, I want to capture screenshots of interview questions and get AI-powered explanations, so that I can understand complex problems quickly.

#### Acceptance Criteria

1. WHEN the user clicks "Capture Screenshot" THEN the system SHALL capture the focused window
2. WHEN a screenshot is captured THEN the system SHALL extract text using OCR within 2 seconds
3. WHEN OCR text is extracted THEN the system SHALL send it to ChatGPT with profession-specific prompts
4. WHEN ChatGPT responds THEN the answer SHALL appear in the chat interface
5. IF OCR fails THEN the system SHALL display an error message and allow retry

### Requirement 3

**User Story:** As an interview candidate, I want to record and transcribe audio from interviews, so that I can get real-time coaching on my responses.

#### Acceptance Criteria

1. WHEN the user clicks "Record Interviewer" THEN the system SHALL capture internal audio via FFmpeg and Blackhole
2. WHEN the user clicks "Record Interviewee" THEN the system SHALL capture microphone audio
3. WHEN the user clicks "Record Both" THEN the system SHALL capture both audio sources simultaneously
4. WHEN audio is being recorded THEN the system SHALL process it in 5-second segments
5. WHEN each segment is processed THEN it SHALL be transcribed using Whisper within 3 seconds
6. WHEN transcription is complete THEN the system SHALL send it to ChatGPT for response suggestions
7. IF audio recording fails THEN the system SHALL display an error and stop recording

### Requirement 4

**User Story:** As an interview candidate, I want to add my study materials to enhance AI responses, so that answers are more relevant to my knowledge base.

#### Acceptance Criteria

1. WHEN the user clicks "Add Material for RAG" THEN the system SHALL open a folder selection dialog
2. WHEN a folder is selected THEN the system SHALL scan for .txt, .pdf, and .pptx files
3. WHEN files are found THEN the system SHALL build embeddings and store them in a local vector database
4. WHEN answering questions THEN the system SHALL retrieve relevant information from the knowledge base
5. IF file processing fails THEN the system SHALL display specific error messages for each failed file

### Requirement 5

**User Story:** As an interview candidate, I want to customize AI prompts for different interview types, so that responses match the context and my profession.

#### Acceptance Criteria

1. WHEN the user opens Settings THEN they SHALL see a Prompt Library tab
2. WHEN in Prompt Library THEN the user SHALL be able to view, edit, and add persona-specific prompts
3. WHEN starting a session THEN the system SHALL load the appropriate system prompt based on profession and interview type
4. WHEN using action buttons THEN the system SHALL apply action-specific prompt templates
5. IF prompt templates are missing THEN the system SHALL use default templates

### Requirement 6

**User Story:** As an interview candidate, I want a debug feature for code problems, so that I can quickly identify and fix errors in shared code.

#### Acceptance Criteria

1. WHEN the user clicks "Debug" THEN the system SHALL capture a screenshot of the current screen
2. WHEN the debug screenshot is captured THEN the system SHALL extract code text using OCR
3. WHEN code text is extracted THEN the system SHALL send it to ChatGPT with a debug-specific prompt
4. WHEN ChatGPT analyzes the code THEN it SHALL identify errors and propose corrections
5. WHEN debug results are ready THEN they SHALL appear in the chat interface with clear error identification

### Requirement 7

**User Story:** As an interview candidate, I want secure storage of my API keys and settings, so that my sensitive information is protected.

#### Acceptance Criteria

1. WHEN the user enters an API key THEN it SHALL be encrypted using AES-256 before storage
2. WHEN the application starts THEN it SHALL decrypt and load the API key securely
3. WHEN storing prompt library data THEN it SHALL be encrypted in the config.json file
4. WHEN the application processes audio or screenshots THEN no data SHALL be logged externally
5. IF decryption fails THEN the system SHALL prompt for API key re-entry

### Requirement 8

**User Story:** As an interview candidate, I want a responsive chat interface, so that I can interact naturally with the AI assistant during interviews.

#### Acceptance Criteria

1. WHEN the session window opens THEN it SHALL display a chronological chat interface
2. WHEN the user types a message THEN they SHALL be able to send it via Enter key or Send button
3. WHEN AI responds THEN messages SHALL appear with clear user/AI distinction
4. WHEN the chat becomes long THEN it SHALL be scrollable with auto-scroll to latest messages
5. IF the chat interface becomes unresponsive THEN it SHALL display a loading indicator

### Requirement 9

**User Story:** As an interview candidate, I want quick access to all features through a compact session window, so that I can efficiently use tools during time-pressured interviews.

#### Acceptance Criteria

1. WHEN the session starts THEN the window SHALL be 400x400 pixels with all essential controls
2. WHEN the user needs to capture content THEN screenshot and debug buttons SHALL be easily accessible
3. WHEN the user needs audio features THEN recording buttons SHALL be clearly labeled and functional
4. WHEN the user needs to add materials THEN the RAG button SHALL be prominently displayed
5. IF the window is too small THEN controls SHALL remain usable without overlap

### Requirement 10

**User Story:** As an interview candidate, I want to start multiple independent sessions with different personalizations, so that I can handle multiple interviews or switch contexts without interference.

#### Acceptance Criteria

1. WHEN the user clicks "Start Session" THEN a new independent session window SHALL open
2. WHEN multiple sessions are active THEN each SHALL maintain its own chat history and context
3. WHEN a new session starts THEN it SHALL use the currently selected profession and interview type settings
4. WHEN sessions have different personalizations THEN they SHALL use different prompt libraries independently
5. WHEN a session is closed THEN other active sessions SHALL remain unaffected
6. IF maximum session limit is reached THEN the system SHALL notify the user and prevent new sessions

### Requirement 11

**User Story:** As an interview candidate, I want a comprehensive prompt library that matches specific personalization and situation combinations, so that AI responses are precisely tailored to my current interview context.

#### Acceptance Criteria

1. WHEN the user selects a profession THEN the system SHALL load profession-specific prompt templates
2. WHEN the user selects an interview type THEN the system SHALL combine it with profession prompts for precise context
3. WHEN using different actions (screenshot, debug, audio) THEN each SHALL use situation-specific prompts
4. WHEN creating prompts THEN the system SHALL support variables like {profession}, {interview_type}, {complexity_level}
5. WHEN prompts are missing for a combination THEN the system SHALL use the closest available template and log the gap
6. IF prompt library becomes corrupted THEN the system SHALL restore from default templates

### Requirement 12

**User Story:** As an interview candidate, I want the application to handle errors gracefully, so that technical issues don't disrupt my interview performance.

#### Acceptance Criteria

1. WHEN OCR processing fails THEN the system SHALL display a user-friendly error message
2. WHEN API calls fail THEN the system SHALL retry automatically and notify the user
3. WHEN audio recording encounters issues THEN it SHALL stop gracefully and allow restart
4. WHEN the application crashes THEN it SHALL auto-restart and restore the previous session state
5. IF permissions are denied THEN the system SHALL provide clear instructions for enabling them