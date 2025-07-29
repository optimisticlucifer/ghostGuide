const { ipcRenderer } = require('electron');

class SessionWindowRenderer {
  constructor() {
    this.sessionId = this.getSessionId();
    this.isRecording = false;
    this.currentRecordingSource = null;
    
    this.initializeElements();
    this.setupEventListeners();
    this.setupIpcListeners();
    this.initializeSession();
  }

  getSessionId() {
    // Extract session ID from command line arguments
    const args = process.argv;
    const sessionArg = args.find(arg => arg.startsWith('--session-id='));
    return sessionArg ? sessionArg.split('=')[1] : 'unknown';
  }

  initializeElements() {
    // Toolbar buttons
    this.screenshotBtn = document.getElementById('screenshot');
    this.debugBtn = document.getElementById('debug');
    this.recordInterviewerBtn = document.getElementById('recordInterviewer');
    this.recordIntervieweeBtn = document.getElementById('recordInterviewee');
    this.recordBothBtn = document.getElementById('recordBoth');
    this.recordSystemBtn = document.getElementById('recordSystem');
    this.addRAGBtn = document.getElementById('addRAG');
    this.closeBtn = document.getElementById('close');
    
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
    this.recordInterviewerBtn.addEventListener('click', () => this.toggleRecording('interviewer'));
    this.recordIntervieweeBtn.addEventListener('click', () => this.toggleRecording('interviewee'));
    this.recordBothBtn.addEventListener('click', () => this.toggleRecording('both'));
    this.recordSystemBtn.addEventListener('click', () => this.toggleRecording('system'));
    this.addRAGBtn.addEventListener('click', () => this.addRAGMaterial());
    this.closeBtn.addEventListener('click', () => this.closeSession());
    
    // Chat input events
    this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
    this.messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
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
    
    ipcRenderer.on('ocr-result', (event, result) => {
      this.hideLoading();
      
      // Display the extracted text
      this.addMessage('assistant', `📷 Screenshot captured and processed:\n\n${result.text}`, { 
        action: 'screenshot',
        timestamp: result.timestamp
      });
      
      // TODO: Send to ChatGPT for analysis
      // For now, just show the extracted text
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
  }

  initializeSession() {
    this.sessionInfo.textContent = `Session: ${this.sessionId.substring(0, 8)}...`;
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
    contentDiv.textContent = content;
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
    
    // Update button states
    [this.recordInterviewerBtn, this.recordIntervieweeBtn, this.recordBothBtn, this.recordSystemBtn].forEach(btn => {
      btn.classList.remove('active');
    });
    
    if (isRecording) {
      this.recordingIndicator.classList.add('active');
      
      // Highlight active recording button
      if (source === 'interviewer') this.recordInterviewerBtn.classList.add('active');
      else if (source === 'interviewee') this.recordIntervieweeBtn.classList.add('active');
      else if (source === 'both') this.recordBothBtn.classList.add('active');
      else if (source === 'system') this.recordSystemBtn.classList.add('active');
    } else {
      this.recordingIndicator.classList.remove('active');
    }
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SessionWindowRenderer();
});