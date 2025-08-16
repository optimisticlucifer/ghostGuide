# GhostGuide Flow Documentation

## Table of Contents

1. [Overview](#overview)
2. [Application Startup Flow](#application-startup-flow)
3. [Session Management Flows](#session-management-flows)
4. [Screenshot Analysis Flow](#screenshot-analysis-flow)
5. [Audio Recording Flow](#audio-recording-flow)
6. [RAG Knowledge Base Flow](#rag-knowledge-base-flow)
7. [Chat Interaction Flow](#chat-interaction-flow)
8. [Configuration Flow](#configuration-flow)
9. [Error Handling Flow](#error-handling-flow)
10. [Data Persistence Flow](#data-persistence-flow)

---

## Overview

This document details all data flows and function call sequences in the GhostGuide application. Each flow shows the exact sequence of method calls, data transformations, and inter-service communications.

**Legend:**
- `→` Function call or data flow
- `⚡` Async operation  
- `🔄` Loop or iteration
- `❓` Conditional branch
- `⚠️` Error handling
- `📝` Data transformation
- `💾` Data persistence
- `🎯` IPC communication

---

## Application Startup Flow

### 1. Main Process Initialization

```
main.ts
├── ApplicationController constructor({debug, stealthMode, logLevel})
│   ├── this.config = {stealthMode: true, debug: false, ...config}
│   ├── this.store = new Store()
│   ├── initializeLogging()
│   │   ├── app.getPath('userData') → logsDir
│   │   ├── fs.mkdirSync(logsDir, {recursive: true})
│   │   └── this.logFilePath = path.join(logsDir, filename)
│   ├── initializeServices()
│   │   ├── this.services = {
│   │   │   ocrService: new OCRService(),
│   │   │   captureService: new CaptureService(),
│   │   │   audioService: new AudioService(),
│   │   │   ragService: new RAGService(),
│   │   │   globalRagService: new GlobalRAGService(),
│   │   │   configurationManager: new ConfigurationManager(),
│   │   │   promptLibraryService: new PromptLibraryService(),
│   │   │   sessionManager: new SessionManager(),
│   │   │   windowManager: new WindowManager(),
│   │   │   chatService: new ChatService(deps...)
│   │   │   }
│   │   ├── promptLibraryService.setConfigurationManager(configManager)
│   │   └── chatService = new ChatService(actualDependencies)
│   └── setupApplicationEvents()
│       ├── app.whenReady() → this.initialize()
│       ├── app.on('window-all-closed') → this.shutdown()
│       ├── app.on('before-quit') → this.shutdown()
│       └── app.on('activate') → this.createMainWindow()
└── app.whenReady() → appController.createMainWindow()
```

### 2. Async Service Initialization

```
ApplicationController.initialize() [⚡async]
├── initializeServicesAsync()
│   ├── configurationManager.initialize() [⚡]
│   │   ├── loadConfig() → JSON.parse(configFile)
│   │   └── validateConfiguration()
│   ├── promptLibraryService.addPersona('quantitative-finance-engineer') [⚡]
│   │   ├── checkPersonaExists() → boolean
│   │   ├── ❓ if (!exists) → addToPersonaList()
│   │   └── ⚠️ else → throw Error("already exists")
│   ├── audioService.initialize() [⚡]
│   │   ├── checkFFmpegAvailability() → execAsync('ffmpeg -version')
│   │   ├── checkWhisperAvailability() → fs.access(whisperPath)
│   │   ├── detectAudioDevices() → execAsync('ffmpeg -f avfoundation -list_devices')
│   │   ├── parseDeviceList() → {microphones: [], systems: []}
│   │   └── this.isInitialized = true
│   ├── ocrService.initialize() [⚡]
│   │   ├── createWorker() → tesseract.createWorker()
│   │   ├── worker.loadLanguage('eng') [⚡]
│   │   ├── worker.initialize('eng') [⚡]
│   │   └── this.worker = worker
│   └── globalRagService.initialize() [⚡]
│       ├── createDatabaseConnection() → new LanceDB()
│       ├── ensureVectorTable() → table = db.createTable()
│       └── this.isReady = true
├── initializeOpenAI()
│   ├── ❓ configurationManager.isApiKeyConfigured()
│   ├── YES → apiKey = configurationManager.getApiKey()
│   ├── NO → apiKey = store.get('openai-api-key')
│   ├── ❓ if (apiKey)
│   │   ├── this.openai = new OpenAI({apiKey})
│   │   └── ✅ OpenAI client ready
│   └── ❌ else → this.openai = null
├── setupIPC()
│   ├── new IPCController(this.getServices(), windows, sessions, callback)
│   └── ipcController.initialize()
│       ├── setupSessionHandlers()
│       ├── setupChatHandlers()
│       ├── setupScreenshotHandlers()
│       ├── setupAudioHandlers()
│       ├── setupRAGHandlers()
│       ├── setupGlobalRAGHandlers()
│       ├── setupSettingsHandlers()
│       └── setupAPIKeyHandlers()
├── ❓ if (config.stealthMode) → setupStealthMode()
│   ├── process.title = 'systemAssistance'
│   ├── ❓ if (darwin) → app.dock?.hide()
│   └── startScreenSharingDetection()
│       ├── new ScreenSharingDetectionService(config, callback)
│       └── detectionService.start()
└── setupGlobalHotkeys()
    ├── globalShortcut.register('CommandOrControl+G', toggleMainWindow)
    └── globalShortcut.register('CommandOrControl+H', hideAllSessionWindows)
```

---

## Session Management Flows

### 1. Session Creation Flow

```
Main Window: User clicks "Start Session"
├── 🎯 ipcRenderer.send('create-session', {profession, interviewType, context})
└── IPCController.setupSessionHandlers() receives event

IPCController.on('create-session')
├── sessionManager.createSession(config) [⚡]
│   ├── generateSessionId() → uuid.v4()
│   ├── validateSessionConfig(config) → boolean
│   ├── session = {
│   │   id: sessionId,
│   │   profession: config.profession,
│   │   interviewType: config.interviewType,
│   │   context: config.context,
│   │   createdAt: new Date(),
│   │   isActive: true,
│   │   chatHistory: [],
│   │   isRecording: false,
│   │   hasRAG: false
│   │   }
│   ├── 💾 persistSession(session)
│   └── return session
├── createSessionWindowCallback(sessionId, config)
│   ├── ApplicationController.createSessionWindow(sessionId, config)
│   │   ├── new BrowserWindow(stealthConfig)
│   │   ├── loadSessionWindowContent(window, sessionId, config)
│   │   │   ├── sessionHtmlPath = path.join(__dirname, 'session.html')
│   │   │   ├── window.loadFile(sessionHtmlPath)
│   │   │   └── window.webContents.once('dom-ready') →
│   │   │       window.executeJavaScript(`window.GHOST_GUIDE_SESSION_ID = '${sessionId}'`)
│   │   ├── setupSessionWindowEvents(window, sessionId)
│   │   │   └── window.on('closed') → cleanup session data
│   │   ├── ❓ if (stealthMode) → window.setContentProtection(true)
│   │   ├── sessionWindows.set(sessionId, window)
│   │   ├── sessions.set(sessionId, sessionData)
│   │   └── return window
│   └── initializeChatSessionWithContext(sessionId, profession, type, context) [⚡]
│       ├── ❓ if (!openai) → skip initialization
│       ├── searchGlobalRAG(profession, interviewType, context) [⚡]
│       │   ├── buildSearchQueries() → string[]
│       │   │   ├── `${profession} ${interviewType} experience`
│       │   │   ├── `${profession} background skills`
│       │   │   ├── userContext (if provided)
│       │   │   └── general resume queries
│       │   ├── 🔄 for each query:
│       │   │   ├── globalRagService.searchRelevantContext(query, 3) [⚡]
│       │   │   └── allSearchResults.push(...results)
│       │   ├── removeResultDuplicates() → uniqueResults
│       │   ├── sortByRelevanceScore() → topResults
│       │   └── formatGlobalContext() → contextString
│       ├── buildComprehensiveContextMessage()
│       │   ├── `🎯 **INTERVIEW SESSION STARTED**`
│       │   ├── `**Role:** ${profession}`
│       │   ├── `**Interview Type:** ${interviewType}`
│       │   ├── ❓ if (userContext) → include context section
│       │   ├── ❓ if (globalContext) → include background section
│       │   └── instructions for AI assistant
│       ├── chatService.sendMessage(sessionId, contextMessage, true) [⚡]
│       │   └── [See Chat Interaction Flow]
│       └── sendToSessionWindow(contextMessage, aiResponse)
│           ├── sessionWindow.webContents.send('chat-response', contextData)
│           └── sessionWindow.webContents.send('chat-response', aiResponseData)
└── 🎯 event.reply('session-created', {sessionId, session})
```

### 2. Session Cleanup Flow

```
User closes session window OR clicks "Close Session"
├── 🎯 ipcRenderer.send('close-session', sessionId)
└── IPCController.on('close-session')

IPCController.on('close-session')
├── ❓ if (audioService.getRecordingStatus(sessionId).isRecording)
│   └── audioService.stopRecording(sessionId) [⚡]
├── sessionManager.closeSession(sessionId) [⚡]
│   ├── session = getSession(sessionId)
│   ├── ❓ if (!session) → throw Error('Session not found')
│   ├── session.isActive = false
│   ├── 💾 persistSessionState(session)
│   ├── cleanupSessionResources(sessionId)
│   │   ├── clearAccumulatedOCR(sessionId)
│   │   ├── stopAnyActiveRecordings(sessionId)
│   │   └── cleanupRAGData(sessionId)
│   └── sessions.delete(sessionId)
├── sessionWindows.delete(sessionId)
└── 🎯 event.reply('session-closed', {sessionId})
```

---

## Screenshot Analysis Flow

### 1. Single Screenshot Capture

```
Session Window: User clicks "Screenshot"
├── 🎯 ipcRenderer.send('capture-screenshot', {sessionId})
└── IPCController.setupScreenshotHandlers() receives event

IPCController.on('capture-screenshot')
├── session = sessions.get(sessionId)
├── captureService.captureScreen() [⚡]
│   ├── getScreenDimensions() → {width, height}
│   ├── ❓ platform-specific capture
│   │   ├── macOS: execAsync('screencapture -t png -')
│   │   ├── Windows: nativeCapture.takeScreenshot()
│   │   └── Linux: execAsync('import -window root png:-')
│   ├── 📝 imageBuffer = processScreenshotData()
│   └── return Buffer
├── ocrService.extractText(screenshot) [⚡]
│   ├── preprocessImage(imageBuffer)
│   │   ├── convertToGrayscale()
│   │   ├── adjustContrast()
│   │   └── resizeForOCR()
│   ├── worker.recognize(imageBuffer) [⚡]
│   ├── 📝 extractTextFromResult() → rawText
│   ├── postprocessText(rawText)
│   │   ├── removeExtraWhitespace()
│   │   ├── fixCommonOCRErrors()
│   │   └── cleanSpecialCharacters()
│   └── return cleanText
├── initializeSessionOCRAccumulation()
│   ├── ❓ if (!session.accumulatedOCR) → session.accumulatedOCR = {}
│   └── session.accumulatedOCR['screenshot'] = ocrText
├── findSessionWindow(sessionId)
│   ├── sessionWindow = sessionWindows.get(sessionId)
│   └── ❓ validate window exists and not destroyed
└── 🎯 sessionWindow.webContents.send('screenshot-captured', {
    sessionId, text: ocrText, accumulatedText: ocrText, timestamp
    })
```

### 2. Multi-Step Screenshot Capture

```
Session Window: User selects "Capture Left Half" / "Capture Right Half"
├── 🎯 ipcRenderer.send('multi-capture', {sessionId, actionType, captureType, accumulatedText})
└── IPCController.on('multi-capture')

IPCController.on('multi-capture')
├── session = sessions.get(sessionId)
├── mapCaptureTypeToEnum(captureType) → CaptureType
│   ├── 'full' → CaptureType.FULL
│   ├── 'left_half' → CaptureType.LEFT_HALF
│   └── 'right_half' → CaptureType.RIGHT_HALF
├── captureService.captureScreenWithType(captureTypeEnum) [⚡]
│   ├── captureFullScreen() → fullScreenshot
│   ├── getScreenDimensions() → {width, height}
│   ├── ❓ switch (captureType)
│   │   ├── FULL → return fullScreenshot
│   │   ├── LEFT_HALF → cropImageLeft(fullScreenshot, width/2)
│   │   └── RIGHT_HALF → cropImageRight(fullScreenshot, width/2)
│   ├── 📝 processedImage = applyCropping()
│   └── return Buffer
├── ocrService.extractText(newScreenshot) [⚡]
│   └── [Same OCR process as above]
├── accumulateOCRText()
│   ├── combinedText = accumulatedText ? 
│   │   `${accumulatedText}\n\n--- Additional Capture ---\n\n${newOcrText}` 
│   │   : newOcrText
│   └── session.accumulatedOCR[actionType] = combinedText
└── 🎯 event.reply('screenshot-captured', {
    sessionId, text: newOcrText, accumulatedText: combinedText, 
    captureType, timestamp
    })
```

### 3. Screenshot Analysis with AI

```
Session Window: User clicks "Analyze Complete Text"
├── 🎯 ipcRenderer.send('analyze-accumulated-text', {sessionId, actionType, accumulatedText})
└── IPCController.on('analyze-accumulated-text')

IPCController.on('analyze-accumulated-text')
├── session = sessions.get(sessionId)
├── ❓ if (chatService.isConfigured() && session)
│   ├── determineActionType() → action = actionType === 'screenshot' ? ActionType.SCREENSHOT : ActionType.DEBUG
│   ├── chatService.processOCRText(sessionId, accumulatedText, action) [⚡]
│   │   ├── session = sessionManager.getSession(sessionId)
│   │   ├── ❓ if (!session) → throw Error('Session not found')
│   │   ├── promptLibraryService.getActionPrompt(action, profession, interviewType)
│   │   │   ├── buildActionPromptTemplate(action)
│   │   │   │   ├── ACTION.SCREENSHOT → screenshotAnalysisTemplate
│   │   │   │   └── ACTION.DEBUG → debugAnalysisTemplate
│   │   │   ├── customizeForProfession(template, profession)
│   │   │   ├── customizeForInterviewType(template, interviewType)
│   │   │   └── return formattedPrompt
│   │   ├── formatMessageWithOCRText(prompt, accumulatedText)
│   │   ├── addToConversationHistory(sessionId, userMessage)
│   │   ├── openai.chat.completions.create({
│   │   │   model: 'gpt-4',
│   │   │   messages: conversationHistory,
│   │   │   max_tokens: 1500,
│   │   │   temperature: 0.3
│   │   │   }) [⚡]
│   │   ├── 📝 aiResponse = completion.choices[0].message.content
│   │   ├── addToConversationHistory(sessionId, aiMessage)
│   │   ├── updateTokenUsage(completion.usage)
│   │   └── return aiResponse
│   └── ✅ analysisResult = aiResponse
├── ❌ else → fallbackAnalysis
│   ├── generateFallbackAnalysis(accumulatedText, profession, interviewType)
│   │   ├── promptLibraryService.getFallbackAnalysisPrompt(ocrText, profession, type)
│   │   ├── buildFallbackTemplate()
│   │   │   ├── analysis header with detected text
│   │   │   ├── profession-specific approach guidelines
│   │   │   ├── general strategy recommendations
│   │   │   ├── interview tips
│   │   │   └── API key configuration prompt
│   │   └── return formattedFallbackText
│   └── analysisResult = fallbackText
├── 🎯 event.reply('chat-response', {
│   sessionId, 
│   content: `📝 **Complete Analysis:**\n\n${analysisResult}`,
│   metadata: {action: actionType, analysisType: 'accumulated'},
│   timestamp
│   })
└── cleanupAccumulatedText()
    └── delete session.accumulatedOCR[actionType]
```

---

## Audio Recording Flow

### 1. Start Recording

```
Session Window: User clicks "Record Mic" / "Record System"
├── 🎯 ipcRenderer.send('start-recording', {sessionId, source})
└── IPCController.on('start-recording')

IPCController.on('start-recording')
├── session = sessions.get(sessionId)
├── ❓ if (!session) → reply with error
├── ❓ if (!audioService.isReady()) 
│   └── audioService.initialize() [⚡]
├── mapSourceToAudioSource(source) → AudioSource
│   ├── 'interviewer' → AudioSource.INTERVIEWER  
│   ├── 'interviewee' → AudioSource.INTERVIEWEE
│   ├── 'both' → AudioSource.BOTH
│   └── 'system' → AudioSource.SYSTEM
├── audioService.startRecording(audioSource, sessionId) [⚡]
│   ├── validateRecordingParams(source, sessionId)
│   ├── ❓ if (isAlreadyRecording(sessionId)) → stopExistingRecording()
│   ├── determineAudioDevice(audioSource)
│   │   ├── AudioSource.INTERVIEWEE → microphoneDeviceId
│   │   ├── AudioSource.SYSTEM → systemAudioDeviceId  
│   │   └── AudioSource.BOTH → combinedDeviceSetup
│   ├── generateOutputFilePath(sessionId) → tempAudioFile
│   ├── buildFFmpegCommand(deviceId, outputFile)
│   │   └── `ffmpeg -y -f avfoundation -i :${deviceId} -ac 1 -ar 16000 -acodec pcm_s16le ${outputFile}`
│   ├── spawn(ffmpegCommand) → recordingProcess
│   ├── setupProcessEventHandlers()
│   │   ├── process.stderr.on('data') → logRecordingProgress()
│   │   ├── process.on('close') → handleRecordingComplete()
│   │   └── process.on('error') → handleRecordingError()
│   ├── recordingSessions.set(sessionId, {process, outputFile, source})
│   └── ✅ recording started
├── updateSessionState()
│   ├── session.isRecording = true
│   └── session.recordingSource = audioSource
└── 🎯 event.reply('recording-status', {sessionId, isRecording: true, source})
```

### 2. Stop Recording and Transcription

```
Session Window: User clicks "Stop Recording"
├── 🎯 ipcRenderer.send('stop-recording', {sessionId})
└── IPCController.on('stop-recording')

IPCController.on('stop-recording')
├── session = sessions.get(sessionId)
├── audioService.stopRecording(sessionId) [⚡]
│   ├── recordingData = recordingSessions.get(sessionId)
│   ├── ❓ if (!recordingData) → return null
│   ├── terminateFFmpegProcess()
│   │   ├── process.kill('SIGTERM')
│   │   └── await processClose
│   ├── calculateRecordingDuration() → totalDuration
│   ├── extractFinalAudioSegment() [⚡]
│   │   ├── ❓ if (totalDuration <= 10s) → use full recording
│   │   ├── ❌ else → extract last 10 seconds
│   │   ├── buildFinalSegmentCommand()
│   │   │   └── `ffmpeg -i ${inputFile} -ss ${startTime} -t ${duration} -c copy ${finalFile}`
│   │   ├── execAsync(segmentCommand)
│   │   └── return finalAudioFile
│   ├── transcribeWithWhisper(finalAudioFile) [⚡]
│   │   ├── buildWhisperCommand()
│   │   │   └── `whisper-cli --model ggml-base.en.bin --output-txt --no-prints ${audioFile}`
│   │   ├── execAsync(whisperCommand) [⚡]
│   │   ├── 📝 parseTranscriptionOutput() → transcriptionText
│   │   ├── cleanTranscriptionText()
│   │   │   ├── removeTimestamps()
│   │   │   ├── fixCommonTranscriptionErrors()
│   │   │   └── normalizeWhitespace()
│   │   └── return cleanedTranscription
│   ├── accumulateTranscription(sessionId, transcription)
│   │   ├── existingTranscript = accumulatedTranscriptions.get(sessionId) || ''
│   │   ├── completeTranscript = existingTranscript + transcription
│   │   └── accumulatedTranscriptions.set(sessionId, completeTranscript)
│   ├── cleanupAudioFiles()
│   │   ├── ❓ if (!DEBUG_AUDIO) → fs.unlink(tempFiles)
│   │   └── ✅ else → preserve for debugging
│   └── return completeTranscription
├── updateSessionState()
│   ├── session.isRecording = false
│   ├── recordingSource = session.recordingSource
│   └── session.recordingSource = null
├── 🎯 sessionWindow.send('chat-response', {
│   sessionId, content: `🎤 **Complete Transcription:** ${transcription}`,
│   timestamp, source: 'complete-audio-transcription'
│   })
├── ❓ if (chatService.isConfigured() && session)
│   ├── chatService.processTranscript(sessionId, transcription, recordingSource) [⚡]
│   │   ├── session = sessionManager.getSession(sessionId)
│   │   ├── promptLibraryService.getAudioCoachingPrompt(audioSource, profession, interviewType)
│   │   │   ├── determineCoachingContext(audioSource)
│   │   │   │   ├── INTERVIEWER → "analyzing interviewer questions"
│   │   │   │   ├── INTERVIEWEE → "coaching user responses"  
│   │   │   │   └── SYSTEM → "analyzing system audio"
│   │   │   ├── buildCoachingPromptTemplate()
│   │   │   ├── customizeForProfession(template, profession)
│   │   │   └── customizeForInterviewType(template, interviewType)
│   │   ├── formatTranscriptMessage(prompt, transcription)
│   │   ├── addToConversationHistory(sessionId, transcriptMessage)
│   │   ├── openai.chat.completions.create() [⚡]
│   │   ├── 📝 coachingResponse = completion.choices[0].message.content
│   │   ├── addToConversationHistory(sessionId, coachingMessage)  
│   │   └── return coachingResponse
│   └── 🎯 sessionWindow.send('chat-response', {
│       sessionId, content: `🤖 **AI Analysis:** ${coachingResponse}`,
│       timestamp, source: 'complete-audio-analysis'
│       })
└── 🎯 event.reply('recording-status', {sessionId, isRecording: false})
```

---

## RAG Knowledge Base Flow

### 1. Session-Specific RAG

```
Session Window: User clicks "RAG"
├── 🎯 ipcRenderer.send('add-rag-material', {sessionId})
└── IPCController.on('add-rag-material')

IPCController.on('add-rag-material')
├── showFolderSelectionDialog() [⚡]
│   ├── dialog.showOpenDialog({
│   │   title: 'Select Study Materials Folder',
│   │   properties: ['openDirectory']
│   │   })
│   └── ❓ if (canceled) → return early
├── ragService.ingestDocuments(folderPath, sessionId) [⚡]
│   ├── scanDirectoryForDocuments(folderPath)
│   │   ├── fs.readdir(folderPath, {recursive: true})
│   │   ├── filterSupportedFiles() → ['.txt', '.md', '.pdf']
│   │   └── return documentPaths[]
│   ├── 🔄 for each documentPath:
│   │   ├── readFileContent(documentPath) → rawContent
│   │   ├── extractTextFromFile(rawContent, fileType)
│   │   │   ├── '.txt' → readAsUTF8()
│   │   │   ├── '.md' → parseMarkdown()
│   │   │   └── '.pdf' → extractWithPDFParser()
│   │   ├── chunkDocument(extractedText)
│   │   │   ├── splitIntoSentences()
│   │   │   ├── combineIntoChunks(maxChunkSize: 1000)
│   │   │   └── return textChunks[]
│   │   ├── generateEmbeddings(textChunks) [⚡]
│   │   │   ├── ❓ if (openaiConfigured)
│   │   │   │   └── openai.embeddings.create({input: chunks})
│   │   │   └── ❌ else → generateLocalEmbeddings()
│   │   ├── storeInKnowledgeBase()
│   │   │   ├── documentId = generateId()
│   │   │   ├── documentMetadata = {filename, path, size, type}
│   │   │   ├── knowledgeBase.documents.push({id, content, metadata})
│   │   │   └── knowledgeBase.embeddings.push(embeddings)
│   │   └── processedDocuments++
│   ├── 💾 persistKnowledgeBase(sessionId, knowledgeBase)
│   └── return {documentsProcessed, knowledgeBase}
├── updateSessionRAGStatus()
│   └── session.hasRAG = true
└── 🎯 event.reply('rag-success', {
    sessionId, documentsProcessed, folderPath, timestamp
    })
```

### 2. Global RAG Search

```
Session Initialization: searchRelevantContext()
├── buildSearchQueries(profession, interviewType, context)
│   ├── baseQueries = [`${profession} ${interviewType} experience`, `${profession} background skills`]
│   ├── ❓ if (context) → extractContextKeywords() → additionalQueries
│   └── return allQueries
├── 🔄 for each searchQuery:
│   ├── globalRagService.searchRelevantContext(query, limit) [⚡]
│   │   ├── ❓ if (!isReady()) → return []
│   │   ├── generateQueryEmbedding(query) [⚡]
│   │   │   └── openai.embeddings.create({input: query})
│   │   ├── performVectorSearch(queryEmbedding)
│   │   │   ├── lanceDB.search(queryEmbedding)
│   │   │   ├── calculateSimilarityScores()
│   │   │   └── rankResultsByRelevance()
│   │   ├── retrieveTopMatches(limit)
│   │   │   └── return SearchResult[]{id, text, score, metadata}
│   │   └── return rankedResults
│   └── allResults.push(...searchResults)
├── removeDuplicateResults()
│   └── uniqueResults = results.filter(unique by id)
├── sortAndLimitResults()
│   ├── sortedResults = results.sort(by score descending)  
│   └── topResults = sortedResults.slice(0, maxResults)
├── 📝 formatContextFromResults()
│   ├── contextText = results.map(r => r.text).join('\n\n')
│   ├── cleanupContextText()
│   │   ├── normalizeWhitespace()
│   │   ├── ensureProperPunctuation()
│   │   └── removeDuplicateContent()
│   └── return formattedContext
└── return {contextText, totalResults: results.length}
```

---

## Chat Interaction Flow

### 1. Regular Chat Message

```
Session Window: User types message and presses Enter
├── 🎯 ipcRenderer.send('chat-message', {sessionId, message, source})
└── IPCController.on('chat-message')

IPCController.on('chat-message')
├── session = sessions.get(sessionId)
├── ❓ if (openai && session)
│   ├── determineMessageContext(source)
│   │   ├── source === 'audio-transcription' → contextualMessage = `[Audio] ${message}`
│   │   └── ❌ else → contextualMessage = message
│   ├── chatService.sendMessage(sessionId, contextualMessage) [⚡]
│   │   ├── session = sessionManager.getSession(sessionId)
│   │   ├── ❓ if (!session) → throw Error('Session not found')
│   │   ├── ❓ if (isInitialization) → buildSystemPrompt()
│   │   │   ├── promptLibraryService.getSystemPrompt(profession, interviewType)
│   │   │   └── initializeConversationHistory(sessionId, systemMessage)
│   │   ├── ❌ else → buildUserMessage()
│   │   │   ├── promptLibraryService.getActionPrompt(ActionType.CHAT, profession, interviewType)
│   │   │   └── formatUserMessage(actionPrompt, message)
│   │   ├── retrieveConversationHistory(sessionId) → messages[]
│   │   ├── addNewMessageToHistory(sessionId, userMessage)
│   │   ├── callOpenAIAPI() [⚡]
│   │   │   ├── openai.chat.completions.create({
│   │   │   │   model: 'gpt-4',
│   │   │   │   messages: conversationHistory,
│   │   │   │   max_tokens: 1000,
│   │   │   │   temperature: 0.3
│   │   │   │   })
│   │   │   ├── 📝 aiResponse = completion.choices[0].message.content
│   │   │   └── logTokenUsage(completion.usage)
│   │   ├── addAIResponseToHistory(sessionId, aiResponse)
│   │   ├── 💾 persistConversationHistory(sessionId)
│   │   └── return aiResponse
│   └── ✅ response = aiResponse
├── ❌ else → generateFallbackResponse()
│   ├── fallbackResponses = [
│   │   'Great question! For technical interviews...',
│   │   'This is a common interview pattern...',
│   │   'I can see this relates to algorithms...'
│   │   ]
│   └── response = randomChoice(fallbackResponses)
└── 🎯 event.reply('chat-response', {sessionId, content: response, timestamp})
```

### 2. Conversation History Management

```
ChatService.conversationHistory
├── sessionHistories: Map<sessionId, messages[]>
├── addToConversationHistory(sessionId, message)
│   ├── history = sessionHistories.get(sessionId) || []
│   ├── history.push({role, content, timestamp})
│   ├── ❓ if (history.length > maxHistoryLength)
│   │   └── history = history.slice(-maxHistoryLength)
│   ├── sessionHistories.set(sessionId, history)
│   └── 💾 persistConversationState(sessionId)
├── getConversationHistory(sessionId) → messages[]
├── clearConversationHistory(sessionId)
│   ├── sessionHistories.delete(sessionId)
│   └── 💾 removePersistedState(sessionId)
└── initializeConversation(sessionId, systemPrompt)
    ├── systemMessage = {role: 'system', content: systemPrompt}
    └── sessionHistories.set(sessionId, [systemMessage])
```

---

## Configuration Flow

### 1. API Key Configuration

```
Settings Window: User enters API key
├── 🎯 ipcRenderer.send('save-api-key', apiKey)
└── IPCController.on('save-api-key')

IPCController.on('save-api-key')
├── configurationManager.updateApiKey(apiKey) [⚡]
│   ├── validateApiKeyFormat(apiKey)
│   │   ├── checkApiKeyStructure() → boolean
│   │   └── ❓ if (!valid) → throw ValidationError
│   ├── testApiKeyWithOpenAI(apiKey) [⚡]
│   │   ├── testClient = new OpenAI({apiKey})
│   │   ├── testClient.models.list() [⚡]
│   │   └── ❓ if (error) → throw AuthenticationError
│   ├── 💾 storeApiKeySecurely(apiKey)
│   │   ├── ❓ if (safeStorage.isEncryptionAvailable())
│   │   │   ├── encryptedKey = safeStorage.encryptString(apiKey)
│   │   │   └── store.set('encrypted-api-key', encryptedKey)
│   │   └── ❌ else → store.set('api-key', apiKey)
│   ├── updateOpenAIClient()
│   │   └── this.openai = new OpenAI({apiKey})
│   └── ✅ configuration updated
└── 🎯 event.reply('api-key-saved')

Settings Window: Test API key
├── 🎯 ipcRenderer.send('test-api-key', apiKey)
└── IPCController.on('test-api-key')

IPCController.on('test-api-key')
├── createTestClient(apiKey) → testOpenAI
├── performAPITest() [⚡]
│   ├── testOpenAI.models.list() [⚡]
│   ├── ✅ validateResponse(response)
│   └── return {success: true}
├── ⚠️ catch (error) → return {success: false, error}
├── ❓ if (testSuccessful)
│   └── 🎯 event.reply('api-key-valid', 'API key is valid!')
└── ❌ else
    └── 🎯 event.reply('api-key-invalid', error.message)
```

### 2. Configuration Loading

```
Application Startup: ConfigurationManager.initialize()
├── loadConfigurationFile() [⚡]
│   ├── configPath = path.join(userData, 'config.json')
│   ├── ❓ if (!fs.existsSync(configPath)) → createDefaultConfig()
│   ├── rawConfig = fs.readFileSync(configPath, 'utf8')
│   ├── 📝 config = JSON.parse(rawConfig)
│   └── return config
├── validateConfiguration(config)
│   ├── checkRequiredFields(config)
│   ├── validateApiKeyIfPresent(config.apiKey)
│   ├── validateAudioDeviceIds(config.audioDevices)
│   └── ❓ if (!valid) → throw ConfigurationError
├── loadApiKeyFromStorage()
│   ├── ❓ if (config.encryptedApiKey)
│   │   ├── decryptedKey = safeStorage.decryptString(config.encryptedApiKey)
│   │   └── this.apiKey = decryptedKey
│   └── ❌ else if (config.apiKey) → this.apiKey = config.apiKey
├── initializeDefaults()
│   ├── audioDevices = detectAudioDevices()
│   ├── ocrLanguage = 'eng'
│   ├── logLevel = 'info'
│   └── stealthMode = true
└── 💾 persistConfiguration()
```

---

## Error Handling Flow

### 1. Service Error Handling

```
Any Service Method Call
├── try {
│   ├── validateParameters()
│   ├── checkServiceReady()
│   ├── performOperation() [⚡]
│   └── return result
│   }
├── catch (ServiceNotReadyError) {
│   ├── logError('Service not initialized')
│   ├── ❓ attemptAutoInitialization()
│   └── ❌ throw new Error('Service unavailable')
│   }
├── catch (APIKeyNotConfiguredError) {
│   ├── logError('OpenAI API key not configured')
│   ├── generateFallbackResponse()
│   └── notifyUserToConfigureAPI()
│   }
├── catch (NetworkError) {
│   ├── logError('Network request failed')
│   ├── ❓ isRetryable(error) → scheduleRetry()
│   └── ❌ fallback to offline mode
│   }
├── catch (ValidationError) {
│   ├── logError('Invalid parameters provided')
│   ├── sanitizeParameters()
│   └── ❓ canRecover() → retry with cleaned params
│   }
└── catch (UnexpectedError) {
    ├── logError('Unexpected error occurred', error.stack)
    ├── captureErrorContext()
    ├── notifyErrorToUser()
    └── gracefulDegradation()
    }
```

### 2. IPC Error Handling

```
IPC Event Handler
├── try {
│   ├── validateEventData()
│   ├── processRequest() [⚡]
│   └── 🎯 event.reply('success', result)
│   }
├── catch (error) {
│   ├── logError('IPC handler failed', {event, error})
│   ├── categorizeError(error)
│   │   ├── ValidationError → userFriendlyMessage
│   │   ├── ServiceError → serviceUnavailableMessage
│   │   └── UnknownError → genericErrorMessage
│   └── 🎯 event.reply('error', {
│       type: errorType,
│       message: userMessage,
│       technical: error.message
│       })
│   }
└── finally {
    └── cleanupResources()
    }
```

---

## Data Persistence Flow

### 1. Session Data Persistence

```
Session State Changes
├── sessionManager.persistSession(session) [⚡]
│   ├── sessionPath = path.join(userDataDir, 'sessions', `${sessionId}.json`)
│   ├── sessionData = {
│   │   id: session.id,
│   │   profession: session.profession,
│   │   interviewType: session.interviewType,
│   │   context: session.context,
│   │   createdAt: session.createdAt,
│   │   isActive: session.isActive,
│   │   chatHistory: session.chatHistory,
│   │   metadata: session.metadata
│   │   }
│   ├── ensureDirectoryExists(sessionsDir)
│   ├── 💾 fs.writeFileSync(sessionPath, JSON.stringify(sessionData, null, 2))
│   └── ✅ session persisted
├── sessionManager.loadSession(sessionId) [⚡]
│   ├── sessionPath = path.join(userDataDir, 'sessions', `${sessionId}.json`)
│   ├── ❓ if (!fs.existsSync(sessionPath)) → return null
│   ├── rawData = fs.readFileSync(sessionPath, 'utf8')
│   ├── 📝 sessionData = JSON.parse(rawData)
│   ├── validateSessionData(sessionData)
│   └── return reconstructSession(sessionData)
└── sessionManager.getAllSessions() [⚡]
    ├── sessionsDir = path.join(userDataDir, 'sessions')
    ├── sessionFiles = fs.readdirSync(sessionsDir).filter('.json')
    ├── 🔄 for each sessionFile:
    │   ├── loadSession(sessionId)
    │   └── activeSessions.push(session)
    └── return activeSessions
```

### 2. Configuration Persistence

```
Configuration Changes
├── configurationManager.saveConfiguration(config) [⚡]
│   ├── configPath = path.join(userDataDir, 'config.json')
│   ├── validateConfiguration(config)
│   ├── 📝 configData = {
│   │   version: CONFIG_VERSION,
│   │   stealthMode: config.stealthMode,
│   │   logLevel: config.logLevel,
│   │   audioDevices: config.audioDevices,
│   │   ocrLanguage: config.ocrLanguage,
│   │   lastUpdated: new Date().toISOString()
│   │   }
│   ├── createBackup(configPath) → backupPath
│   ├── 💾 fs.writeFileSync(configPath, JSON.stringify(configData, null, 2))
│   └── ✅ configuration saved
├── configurationManager.loadConfiguration() [⚡]
│   ├── configPath = path.join(userDataDir, 'config.json')
│   ├── ❓ if (!fs.existsSync(configPath)) → createDefaultConfiguration()
│   ├── rawConfig = fs.readFileSync(configPath, 'utf8')
│   ├── 📝 config = JSON.parse(rawConfig)
│   ├── migrateConfigurationIfNeeded(config)
│   ├── validateConfiguration(config)
│   └── return config
└── autoSaveConfiguration()
    ├── detectConfigurationChanges()
    ├── ❓ if (changesDetected)
    │   ├── debounce(saveConfiguration, 1000)
    │   └── logConfigurationChange()
    └── scheduleNextCheck()
```

### 3. RAG Data Persistence

```
Knowledge Base Operations
├── globalRagService.persistVectorDatabase() [⚡]
│   ├── dbPath = path.join(userDataDir, 'vector-db')
│   ├── ensureDirectoryExists(dbPath)
│   ├── lanceDB.save(dbPath) [⚡]
│   ├── generateDatabaseMetadata()
│   │   ├── totalDocuments = countDocuments()
│   │   ├── totalChunks = countChunks()
│   │   ├── databaseSize = calculateSize()
│   │   └── lastUpdate = new Date()
│   ├── 💾 saveMetadata(metadata)
│   └── ✅ vector database persisted
├── globalRagService.loadVectorDatabase() [⚡]
│   ├── dbPath = path.join(userDataDir, 'vector-db')
│   ├── ❓ if (!fs.existsSync(dbPath)) → initializeEmptyDatabase()
│   ├── lanceDB.load(dbPath) [⚡]
│   ├── loadDatabaseMetadata()
│   ├── validateDatabaseIntegrity()
│   └── ✅ vector database loaded
└── cleanupOldData()
    ├── findExpiredSessions() → oldSessionIds[]
    ├── 🔄 for each oldSessionId:
    │   ├── removeSessionVectorData(oldSessionId)
    │   ├── deleteSessionFiles(oldSessionId)
    │   └── cleanupCount++
    └── logCleanupResults(cleanupCount)
```

---

This comprehensive flow documentation shows the exact sequence of function calls, data transformations, and system interactions for all major application flows in GhostGuide.
