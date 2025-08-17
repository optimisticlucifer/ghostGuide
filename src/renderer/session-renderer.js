const { ipcRenderer } = require('electron');

class SessionWindowRenderer {
  constructor() {
    this.sessionId = this.getSessionId();
    this.isRecording = false;
    this.currentRecordingSource = null;
    
    // RAG State Management
    this.globalRAGEnabled = false;
    this.localRAGEnabled = false;
    
    // Auto Recorder State Management
    this.autoRecorderActive = false;
    
    this.initializeElements();
    this.setupEventListeners();
    this.setupIpcListeners();
    this.initializeSession();
  }

  getSessionId() {
    // Check for global session ID variable first (set by ApplicationController)
    if (window.GHOST_GUIDE_SESSION_ID) {
      console.log('🎯 [SESSION] Using global session ID:', window.GHOST_GUIDE_SESSION_ID);
      return window.GHOST_GUIDE_SESSION_ID;
    }
    
    // Fallback: Extract session ID from command line arguments  
    const args = process.argv;
    const sessionArg = args.find(arg => arg.startsWith('--session-id='));
    const cmdSessionId = sessionArg ? sessionArg.split('=')[1] : 'unknown';
    console.log('🎯 [SESSION] Using command line session ID:', cmdSessionId);
    return cmdSessionId;
  }

  initializeElements() {
    // Toolbar buttons
    this.screenshotBtn = document.getElementById('screenshot');
    this.debugBtn = document.getElementById('debug');
    this.recordInterviewerBtn = document.getElementById('recordInterviewer');
    this.recordIntervieweeBtn = document.getElementById('recordInterviewee');
    this.autoRecorderBtn = document.getElementById('autoRecorderMode');
    this.addRAGBtn = document.getElementById('addRAG');
    this.closeBtn = document.getElementById('close');
    
    // New RAG Control buttons
    this.refreshLocalRAGBtn = document.getElementById('refreshLocalRAG');
    this.toggleGlobalRAGBtn = document.getElementById('toggleGlobalRAG');
    this.toggleLocalRAGBtn = document.getElementById('toggleLocalRAG');
    
    // Chat elements
    this.chatMessages = document.getElementById('chatMessages');
    this.messageInput = document.getElementById('messageInput');
    this.sendMessageBtn = document.getElementById('sendMessage');
    this.loading = document.getElementById('loading');
    
    // Status elements
    this.sessionInfo = document.getElementById('sessionInfo');
    this.recordingIndicator = document.getElementById('recordingIndicator');
    
    // Set welcome timestamp
    document.getElementById('welcomeTime').textContent = new Date().toLocaleTimeString();
  }

  setupEventListeners() {
    // Toolbar button events
    this.screenshotBtn.addEventListener('click', () => this.captureScreenshot());
    this.debugBtn.addEventListener('click', () => this.debugCode());
    this.recordInterviewerBtn.addEventListener('click', () => this.toggleRecording('system')); // Use system audio for interviewer
    this.recordIntervieweeBtn.addEventListener('click', () => this.toggleRecording('interviewee'));
    this.autoRecorderBtn.addEventListener('click', () => this.toggleAutoRecorder());
    this.addRAGBtn.addEventListener('click', () => this.openFolderSelection());
    this.closeBtn.addEventListener('click', () => this.closeSession());
    
    // New RAG Control button events
    if (this.refreshLocalRAGBtn) {
      this.refreshLocalRAGBtn.addEventListener('click', () => this.refreshLocalRAG());
    }
    if (this.toggleGlobalRAGBtn) {
      this.toggleGlobalRAGBtn.addEventListener('click', () => this.toggleGlobalRAG());
    }
    if (this.toggleLocalRAGBtn) {
      this.toggleLocalRAGBtn.addEventListener('click', () => this.toggleLocalRAG());
    }
    
    // Chat input events
    this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
    this.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
      // Shift+Enter will create a new line (default behavior)
    });
    
    // Auto-scroll chat messages
    this.chatMessages.addEventListener('DOMNodeInserted', () => {
      this.scrollToBottom();
    });
  }

  setupIpcListeners() {
    ipcRenderer.on('chat-response', (event, response) => {
      this.hideLoading();
      this.addMessage('assistant', response.content, response.metadata);
    });
    
    // 🎯 NEW: Multi-step screenshot capture flow
    ipcRenderer.on('screenshot-captured', (event, result) => {
      console.log('🎯 [UI] Received screenshot-captured event:', result);
      
      this.hideLoading();
      
      // Show the captured OCR text and action buttons
      this.addMessage('assistant', `📷 Screenshot captured!\n\nExtracted text: ${result.text}`, {
        action: 'screenshot',
        timestamp: result.timestamp
      });
      
      console.log('🎯 [UI] Adding capture action buttons for screenshot');
      
      // Add action buttons for multi-step capture
      this.addCaptureActionButtons(result.sessionId, 'screenshot', result.accumulatedText || result.text);
      
      console.log('🎯 [UI] addCaptureActionButtons completed!');
    });
    
    // 🎯 NEW: Multi-step debug capture flow  
    ipcRenderer.on('debug-captured', (event, result) => {
      this.hideLoading();
      
      // Show the captured OCR text and action buttons
      this.addMessage('assistant', `🐛 Code captured for debugging!\n\nExtracted text: ${result.text}`, {
        action: 'debug',
        timestamp: result.timestamp
      });
      
      // Add action buttons for multi-step debug capture
      this.addCaptureActionButtons(result.sessionId, 'debug', result.accumulatedText || result.text);
    });
    
    // Legacy handlers for backward compatibility
    ipcRenderer.on('ocr-result', (event, result) => {
      this.hideLoading();
      this.addMessage('assistant', `📷 ${result.analysis}`, { 
        action: 'screenshot',
        timestamp: result.timestamp
      });
    });
    
    ipcRenderer.on('ocr-error', (event, error) => {
      this.hideLoading();
      this.addMessage('assistant', `❌ Screenshot Error: ${error.error}`, { 
        action: 'screenshot',
        error: true
      });
    });
    
    ipcRenderer.on('debug-result', (event, result) => {
      this.hideLoading();
      this.addMessage('assistant', `🐛 ${result.analysis}`, { 
        action: 'debug',
        timestamp: result.timestamp
      });
    });
    
    ipcRenderer.on('debug-error', (event, error) => {
      this.hideLoading();
      this.addMessage('assistant', `❌ Debug Error: ${error.error}`, { 
        action: 'debug',
        error: true
      });
    });
    
    ipcRenderer.on('recording-status', (event, status) => {
      this.updateRecordingStatus(status.isRecording, status.source);
    });
    
    ipcRenderer.on('recording-error', (event, error) => {
      this.hideLoading();
      this.addMessage('assistant', `❌ Recording Error: ${error.error}`, { 
        action: 'audio',
        error: true
      });
      
      // Reset recording state on error
      this.updateRecordingStatus(false, null);
    });
    
    ipcRenderer.on('transcription', (event, transcription) => {
      this.addMessage('assistant', `🎤 Transcription: ${transcription.text}`, { 
        source: transcription.source,
        action: 'audio'
      });
    });
    
    // RAG-related IPC listeners
    ipcRenderer.on('folder-selected', (event, result) => {
      if (result.success) {
        this.addMessage('assistant', `📁 Folder selected: ${result.path}\n📝 Processing ${result.fileCount} documents...`, { action: 'rag' });
      } else {
        this.addMessage('assistant', `❌ Folder selection cancelled or failed`, { action: 'rag', error: true });
      }
    });
    
    ipcRenderer.on('rag-processed', (event, result) => {
      this.hideLoading();
      if (result.success) {
        this.addMessage('assistant', `✅ RAG processing complete!\n📊 Processed ${result.documentCount} documents\n🔍 ${result.embeddingCount} embeddings created`, { action: 'rag' });
      } else {
        this.addMessage('assistant', `❌ RAG processing failed: ${result.error}`, { action: 'rag', error: true });
      }
    });
    
    ipcRenderer.on('local-rag-refreshed', (event, result) => {
      this.hideLoading();
      if (result.success) {
        this.addMessage('assistant', `🔄 Local RAG database refreshed!\n📊 ${result.documentCount} documents reprocessed`, { action: 'rag' });
      } else {
        this.addMessage('assistant', `❌ Failed to refresh local RAG: ${result.error}`, { action: 'rag', error: true });
      }
    });
    
    ipcRenderer.on('global-rag-toggled', (event, result) => {
      this.addMessage('assistant', `🌐 Global RAG ${result.enabled ? 'enabled' : 'disabled'}`, { action: 'rag' });
    });
    
    ipcRenderer.on('local-rag-toggled', (event, result) => {
      this.addMessage('assistant', `📁 Local RAG ${result.enabled ? 'enabled' : 'disabled'}`, { action: 'rag' });
    });
    
    // Auto Recorder IPC listeners
    ipcRenderer.on('auto-recorder-status', (event, status) => {
      this.updateAutoRecorderStatus(status.active);
    });
    
    ipcRenderer.on('auto-recorder-result', (event, result) => {
      this.hideLoading();
      this.addMessage('user', `🔄 Transcription sent: "${result.transcription}"`, { 
        action: 'auto-recorder',
        timestamp: result.timestamp 
      });
      this.addMessage('assistant', result.aiResponse, { 
        action: 'auto-recorder',
        timestamp: result.timestamp 
      });
    });
  }

  initializeSession() {
    this.sessionInfo.textContent = `Session: ${this.sessionId.substring(0, 8)}...`;
    
    // Initialize RAG button states
    this.updateRAGButtonState('global');
    this.updateRAGButtonState('local');
  }

  captureScreenshot() {
    this.showLoading();
    this.addMessage('user', 'Capturing screenshot...', { action: 'screenshot' });
    ipcRenderer.send('capture-screenshot', { sessionId: this.sessionId });
  }

  debugCode() {
    this.showLoading();
    this.addMessage('user', 'Debugging code...', { action: 'debug' });
    ipcRenderer.send('debug-code', { sessionId: this.sessionId });
  }

  toggleRecording(source) {
    if (this.isRecording && this.currentRecordingSource === source) {
      // Stop recording
      ipcRenderer.send('stop-recording', { sessionId: this.sessionId });
      this.addMessage('user', `Stopped recording ${source}`, { action: 'audio' });
    } else {
      // Start recording
      if (this.isRecording) {
        // Stop current recording first
        ipcRenderer.send('stop-recording', { sessionId: this.sessionId });
      }
      ipcRenderer.send('start-recording', { sessionId: this.sessionId, source });
      this.addMessage('user', `Started recording ${source}`, { action: 'audio' });
    }
  }

  addRAGMaterial() {
    this.addMessage('user', 'Adding RAG material...', { action: 'rag' });
    ipcRenderer.send('add-rag-material', { sessionId: this.sessionId });
  }

  // New RAG Control Methods
  openFolderSelection() {
    this.addMessage('user', 'Opening folder selection for local RAG...', { action: 'rag' });
    ipcRenderer.send('select-folder-for-rag', { sessionId: this.sessionId });
  }

  refreshLocalRAG() {
    this.addMessage('user', 'Refreshing local RAG database...', { action: 'rag' });
    ipcRenderer.send('refresh-local-rag', { sessionId: this.sessionId });
  }

  toggleGlobalRAG() {
    this.globalRAGEnabled = !this.globalRAGEnabled;
    this.updateRAGButtonState('global');
    this.addMessage('user', `Global RAG ${this.globalRAGEnabled ? 'enabled' : 'disabled'}`, { action: 'rag' });
    ipcRenderer.send('toggle-global-rag', { 
      sessionId: this.sessionId, 
      enabled: this.globalRAGEnabled 
    });
  }

  toggleLocalRAG() {
    this.localRAGEnabled = !this.localRAGEnabled;
    this.updateRAGButtonState('local');
    this.addMessage('user', `Local RAG ${this.localRAGEnabled ? 'enabled' : 'disabled'}`, { action: 'rag' });
    ipcRenderer.send('toggle-local-rag', { 
      sessionId: this.sessionId, 
      enabled: this.localRAGEnabled 
    });
  }

  updateRAGButtonState(type) {
    if (type === 'global' && this.toggleGlobalRAGBtn) {
      if (this.globalRAGEnabled) {
        this.toggleGlobalRAGBtn.classList.add('rag-enabled');
        this.toggleGlobalRAGBtn.classList.remove('rag-disabled');
      } else {
        this.toggleGlobalRAGBtn.classList.add('rag-disabled');
        this.toggleGlobalRAGBtn.classList.remove('rag-enabled');
      }
    } else if (type === 'local' && this.toggleLocalRAGBtn) {
      if (this.localRAGEnabled) {
        this.toggleLocalRAGBtn.classList.add('rag-enabled');
        this.toggleLocalRAGBtn.classList.remove('rag-disabled');
      } else {
        this.toggleLocalRAGBtn.classList.add('rag-disabled');
        this.toggleLocalRAGBtn.classList.remove('rag-enabled');
      }
    }
  }
  
  // ========================================
  // AUTO RECORDER MODE METHODS
  // ========================================
  
  /**
   * Toggle auto recorder mode on/off
   */
  toggleAutoRecorder() {
    this.autoRecorderActive = !this.autoRecorderActive;
    
    if (this.autoRecorderActive) {
      this.addMessage('user', '🔄 Starting Auto Recorder Mode...\n\n⏱️ Continuous recording active\n⌨️ Press Cmd+S to send transcription to LLM', { action: 'auto-recorder' });
      ipcRenderer.send('toggle-auto-recorder', { 
        sessionId: this.sessionId, 
        active: true 
      });
    } else {
      this.addMessage('user', '🔄 Stopping Auto Recorder Mode...', { action: 'auto-recorder' });
      ipcRenderer.send('toggle-auto-recorder', { 
        sessionId: this.sessionId, 
        active: false 
      });
    }
    
    this.updateAutoRecorderButtonState();
  }
  
  /**
   * Update auto recorder button visual state
   */
  updateAutoRecorderStatus(active) {
    this.autoRecorderActive = active;
    this.updateAutoRecorderButtonState();
    
    if (active) {
      this.addMessage('assistant', '✅ Auto Recorder Mode Active\n\n🎤 Listening continuously...\n⌨️ Press Cmd+S to send current transcription to LLM', { action: 'auto-recorder' });
    } else {
      this.addMessage('assistant', '❌ Auto Recorder Mode Stopped', { action: 'auto-recorder' });
    }
  }
  
  /**
   * Update auto recorder button visual state
   */
  updateAutoRecorderButtonState() {
    if (!this.autoRecorderBtn) return;
    
    if (this.autoRecorderActive) {
      this.autoRecorderBtn.classList.add('active');
      this.autoRecorderBtn.classList.remove('inactive');
    } else {
      this.autoRecorderBtn.classList.add('inactive');
      this.autoRecorderBtn.classList.remove('active');
    }
  }

  closeSession() {
    ipcRenderer.send('close-session', { sessionId: this.sessionId });
    window.close();
  }

  sendMessage() {
    const message = this.messageInput.value.trim();
    if (!message) return;
    
    this.addMessage('user', message);
    this.messageInput.value = '';
    this.showLoading();
    
    ipcRenderer.send('chat-message', { 
      sessionId: this.sessionId, 
      message 
    });
  }

  addMessage(role, content, metadata = {}) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${role}`;
    
    const contentDiv = document.createElement('div');
    
    // Handle special formatting for RAG enhanced messages or markdown-like content
    if (metadata.source === 'rag-enhanced-message' || content.includes('**') || content.includes('\n\n')) {
      // Convert basic markdown to HTML for better formatting
      let formattedContent = content
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold text
        .replace(/\n\n/g, '<br><br>') // Double newlines to double line breaks
        .replace(/\n/g, '<br>'); // Single newlines to line breaks
      
      contentDiv.innerHTML = formattedContent;
    } else {
      contentDiv.textContent = content;
    }
    
    messageDiv.appendChild(contentDiv);
    
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    timestampDiv.textContent = new Date().toLocaleTimeString();
    messageDiv.appendChild(timestampDiv);
    
    if (Object.keys(metadata).length > 0) {
      const metadataDiv = document.createElement('div');
      metadataDiv.className = 'metadata';
      metadataDiv.textContent = `Action: ${metadata.action || 'chat'}${metadata.source ? `, Source: ${metadata.source}` : ''}`;
      messageDiv.appendChild(metadataDiv);
    }
    
    this.chatMessages.appendChild(messageDiv);
    this.scrollToBottom();
  }

  showLoading() {
    this.loading.classList.add('show');
  }

  hideLoading() {
    this.loading.classList.remove('show');
  }

  scrollToBottom() {
    this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
  }

  updateRecordingStatus(isRecording, source) {
    this.isRecording = isRecording;
    this.currentRecordingSource = source;
    
    // Update button states (only existing buttons)
    [this.recordInterviewerBtn, this.recordIntervieweeBtn].forEach(btn => {
      if (btn) btn.classList.remove('active');
    });
    
    if (isRecording) {
      this.recordingIndicator.classList.add('active');
      
      // Highlight active recording button
      if (source === 'system') this.recordInterviewerBtn.classList.add('active'); // Interviewer uses system audio
      else if (source === 'interviewee') this.recordIntervieweeBtn.classList.add('active');
    } else {
      this.recordingIndicator.classList.remove('active');
    }
  }

  /**
   * 🎯 NEW: Add capture action buttons for multi-step screenshot/debug flow
   */
  addCaptureActionButtons(sessionId, actionType, accumulatedText) {
    console.log('🎯 [UI] addCaptureActionButtons called:', { sessionId, actionType, accumulatedText: accumulatedText.substring(0, 100) + '...' });
    
    // IMMEDIATE DEBUG MESSAGE to verify function is called
    this.addMessage('system', '🎯 [DEBUG] addCaptureActionButtons function STARTED!', { action: 'debug' });
    
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message assistant capture-actions';
    
    const headerDiv = document.createElement('div');
    headerDiv.className = 'capture-actions-header';
    headerDiv.textContent = actionType === 'screenshot' ? 
      '📷 Need more context? Choose an action:' : 
      '🐛 Need more code context? Choose an action:';
    actionsDiv.appendChild(headerDiv);
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'capture-action-buttons';
    
    // Create the four action buttons
    const actions = [
      { id: 'capture-more', text: '📷 Capture More', type: 'full' },
      { id: 'capture-left', text: '⬅️ Left Half', type: 'left_half' },
      { id: 'capture-right', text: '➡️ Right Half', type: 'right_half' },
      { id: 'no-need', text: '✅ No Need - Analyze', type: 'analyze' }
    ];
    
    actions.forEach(action => {
      const button = document.createElement('button');
      button.className = 'capture-action-btn';
      button.textContent = action.text;
      button.setAttribute('data-action', action.type);
      button.setAttribute('data-session-id', sessionId);
      button.setAttribute('data-action-type', actionType);
      button.setAttribute('data-accumulated-text', accumulatedText);
      
      // Add click handler
      button.addEventListener('click', (e) => this.handleCaptureAction(e));
      
      buttonsContainer.appendChild(button);
    });
    
    actionsDiv.appendChild(buttonsContainer);
    
    // Add timestamp
    const timestampDiv = document.createElement('div');
    timestampDiv.className = 'timestamp';
    timestampDiv.textContent = new Date().toLocaleTimeString();
    actionsDiv.appendChild(timestampDiv);
    
    this.chatMessages.appendChild(actionsDiv);
    this.scrollToBottom();
  }

  /**
   * 🎯 NEW: Handle capture action button clicks
   */
  handleCaptureAction(event) {
    const button = event.target;
    const action = button.getAttribute('data-action');
    const sessionId = button.getAttribute('data-session-id');
    const actionType = button.getAttribute('data-action-type'); // 'screenshot' or 'debug'
    const accumulatedText = button.getAttribute('data-accumulated-text');
    
    // Disable all buttons in this group to prevent double-clicks
    const buttonsContainer = button.parentElement;
    const allButtons = buttonsContainer.querySelectorAll('.capture-action-btn');
    allButtons.forEach(btn => {
      btn.disabled = true;
      btn.style.opacity = '0.5';
    });
    
    // Handle different actions
    switch (action) {
      case 'full':
        this.handleCaptureMore(sessionId, actionType, accumulatedText);
        break;
      case 'left_half':
        this.handleCaptureLeftHalf(sessionId, actionType, accumulatedText);
        break;
      case 'right_half':
        this.handleCaptureRightHalf(sessionId, actionType, accumulatedText);
        break;
      case 'analyze':
        this.handleAnalyzeText(sessionId, actionType, accumulatedText);
        break;
    }
  }

  /**
   * 🎯 Handle "Capture More" action
   */
  handleCaptureMore(sessionId, actionType, accumulatedText) {
    this.showLoading();
    this.addMessage('user', `Capturing more ${actionType === 'screenshot' ? 'screenshots' : 'code'}...`);
    
    ipcRenderer.send('multi-capture', {
      sessionId,
      actionType,
      captureType: 'full',
      accumulatedText
    });
  }

  /**
   * 🎯 Handle "Left Half" capture action
   */
  handleCaptureLeftHalf(sessionId, actionType, accumulatedText) {
    this.showLoading();
    this.addMessage('user', `Capturing left half of screen...`);
    
    ipcRenderer.send('multi-capture', {
      sessionId,
      actionType,
      captureType: 'left_half',
      accumulatedText
    });
  }

  /**
   * 🎯 Handle "Right Half" capture action
   */
  handleCaptureRightHalf(sessionId, actionType, accumulatedText) {
    this.showLoading();
    this.addMessage('user', `Capturing right half of screen...`);
    
    ipcRenderer.send('multi-capture', {
      sessionId,
      actionType,
      captureType: 'right_half',
      accumulatedText
    });
  }

  /**
   * 🎯 Handle "No Need - Analyze" action
   */
  handleAnalyzeText(sessionId, actionType, accumulatedText) {
    this.showLoading();
    
    // Show what we're analyzing
    this.addMessage('user', `📝 **Starting Analysis**\n\nAnalyzing accumulated ${actionType} text (${accumulatedText.length} characters)...\n\nText being analyzed:\n\n"${accumulatedText.substring(0, 500)}${accumulatedText.length > 500 ? '...' : ''}"`);
    
    ipcRenderer.send('analyze-accumulated-text', {
      sessionId,
      actionType,
      accumulatedText
    });
  }
}

// Initialize when DOM is loaded AND global session ID is available
document.addEventListener('DOMContentLoaded', () => {
  // Wait for the global session ID to be available
  const waitForSessionId = () => {
    if (window.GHOST_GUIDE_SESSION_ID) {
      console.log('🎯 [SESSION] Global session ID is available, initializing renderer');
      new SessionWindowRenderer();
    } else {
      console.log('🎯 [SESSION] Waiting for global session ID...');
      setTimeout(waitForSessionId, 50); // Check every 50ms
    }
  };
  
  waitForSessionId();
});
