const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');

class NotepadRenderer {
  constructor() {
    this.sessionId = this.getSessionId();
    this.currentViewMode = 'split'; // 'split', 'editor', 'preview'
    this.currentFile = null;
    this.hasUnsavedChanges = false;
    this.autoSaveTimer = null;
    
    // Storage paths
    this.notepadDataPath = this.getNotepadDataPath();
    this.persistentNotePath = path.join(this.notepadDataPath, 'persistent-notes.md');
    
    this.initializeElements();
    this.setupEventListeners();
    this.loadPersistedContent();
    this.setupAutoSave();
    this.initializeMarkdown();
  }

  getSessionId() {
    // Get session ID from URL parameters or fallback methods
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const urlSessionId = urlParams.get('sessionId');
      if (urlSessionId) {
        return urlSessionId;
      }
    } catch (error) {
      console.warn('📝 [NOTEPAD] Failed to parse URL parameters:', error);
    }
    
    // Fallback to global variable or command line
    if (window.GHOST_GUIDE_SESSION_ID) {
      return window.GHOST_GUIDE_SESSION_ID;
    }
    
    return 'default';
  }
  
  getNotepadDataPath() {
    // Create persistent storage directory for notepad data using IPC
    try {
      // Request user data path from main process via IPC
      const userDataPath = ipcRenderer.sendSync('get-user-data-path');
      const notepadPath = path.join(userDataPath, 'notepad-data');
      
      // Ensure directory exists
      if (!fs.existsSync(notepadPath)) {
        fs.mkdirSync(notepadPath, { recursive: true });
      }
      
      return notepadPath;
    } catch (error) {
      console.error('📝 [NOTEPAD] Failed to create notepad data directory:', error);
      // Fallback to current directory
      return path.join(process.cwd(), 'notepad-data');
    }
  }

  initializeElements() {
    // Toolbar buttons
    this.newFileBtn = document.getElementById('newFile');
    this.openFileBtn = document.getElementById('openFile');
    this.saveFileBtn = document.getElementById('saveFile');
    this.insertImageBtn = document.getElementById('insertImage');
    this.viewModeBtn = document.getElementById('viewMode');
    this.closeNotepadBtn = document.getElementById('closeNotepad');
    
    // Main elements
    this.contentContainer = document.getElementById('contentContainer');
    this.editor = document.getElementById('editor');
    this.preview = document.getElementById('preview');
    this.statusText = document.getElementById('statusText');
    this.charCount = document.getElementById('charCount');
    
    // File inputs
    this.fileInput = document.getElementById('fileInput');
    this.imageInput = document.getElementById('imageInput');
    
    // Toast
    this.toast = document.getElementById('toast');
    
    console.log('📝 [NOTEPAD] Elements initialized for session:', this.sessionId);
  }

  setupEventListeners() {
    // Toolbar button events
    this.newFileBtn.addEventListener('click', () => this.newFile());
    this.openFileBtn.addEventListener('click', () => this.openFile());
    this.saveFileBtn.addEventListener('click', () => this.saveFile());
    this.insertImageBtn.addEventListener('click', () => this.insertImage());
    this.viewModeBtn.addEventListener('click', () => this.toggleViewMode());
    this.closeNotepadBtn.addEventListener('click', () => this.closeNotepad());
    
    // Editor events
    this.editor.addEventListener('input', () => this.onEditorChange());
    this.editor.addEventListener('paste', (e) => this.onPaste(e));
    this.editor.addEventListener('dragover', (e) => this.onDragOver(e));
    this.editor.addEventListener('dragleave', (e) => this.onDragLeave(e));
    this.editor.addEventListener('drop', (e) => this.onDrop(e));
    
    // File input events
    this.fileInput.addEventListener('change', (e) => this.onFileSelected(e));
    this.imageInput.addEventListener('change', (e) => this.onImageSelected(e));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    
    // Window events
    window.addEventListener('beforeunload', () => this.savePersistedContent());
    
    // IPC events
    ipcRenderer.on('notepad-toggle', () => {
      console.log('📝 [NOTEPAD] Received toggle command');
      this.toggleVisibility();
    });
    
    console.log('📝 [NOTEPAD] Event listeners setup complete');
  }
  
  async initializeMarkdown() {
    try {
      // Import marked for markdown parsing
      const marked = require('marked');
      this.marked = marked;
      
      // Configure marked options
      if (this.marked.setOptions) {
        this.marked.setOptions({
          highlight: function(code, lang) {
            // Basic syntax highlighting could be added here
            return code;
          },
          breaks: true,
          gfm: true
        });
      }
      
      // Initial render
      this.updatePreview();
      
      console.log('📝 [NOTEPAD] Markdown renderer initialized');
    } catch (error) {
      console.error('📝 [NOTEPAD] Failed to initialize markdown:', error);
      // Fallback to basic text rendering
      this.marked = null;
      this.updatePreview();
    }
  }

  loadPersistedContent() {
    try {
      if (fs.existsSync(this.persistentNotePath)) {
        const content = fs.readFileSync(this.persistentNotePath, 'utf8');
        this.editor.value = content;
        this.updateCharCount();
        this.updatePreview();
        this.showToast('📝 Previous notes restored');
        console.log('📝 [NOTEPAD] Persisted content loaded');
      } else {
        // Use default template
        this.updatePreview();
        console.log('📝 [NOTEPAD] Using default template');
      }
    } catch (error) {
      console.error('📝 [NOTEPAD] Failed to load persisted content:', error);
      this.showToast('❌ Failed to load previous notes', true);
    }
  }
  
  savePersistedContent() {
    try {
      const content = this.editor.value;
      fs.writeFileSync(this.persistentNotePath, content, 'utf8');
      console.log('📝 [NOTEPAD] Content persisted successfully');
    } catch (error) {
      console.error('📝 [NOTEPAD] Failed to persist content:', error);
    }
  }
  
  setupAutoSave() {
    // Auto-save every 30 seconds if there are changes
    setInterval(() => {
      if (this.hasUnsavedChanges) {
        this.savePersistedContent();
        this.hasUnsavedChanges = false;
        this.updateStatus('Auto-saved');
      }
    }, 30000);
  }

  onEditorChange() {
    this.hasUnsavedChanges = true;
    this.updateCharCount();
    this.updatePreview();
    this.updateStatus('Modified');
    
    // Debounce auto-save
    if (this.autoSaveTimer) {
      clearTimeout(this.autoSaveTimer);
    }
    
    this.autoSaveTimer = setTimeout(() => {
      this.savePersistedContent();
      this.hasUnsavedChanges = false;
      this.updateStatus('Auto-saved');
    }, 2000);
  }

  updateCharCount() {
    const count = this.editor.value.length;
    this.charCount.textContent = `${count} characters`;
  }

  updatePreview() {
    const content = this.editor.value;
    
    if (this.marked) {
      try {
        // Use marked to parse markdown
        let html;
        if (typeof this.marked.parse === 'function') {
          html = this.marked.parse(content);
        } else if (typeof this.marked === 'function') {
          html = this.marked(content);
        } else {
          throw new Error('marked library not properly loaded');
        }
        
        this.preview.innerHTML = html;
        console.log('📝 [NOTEPAD] Markdown rendered successfully');
      } catch (error) {
        console.error('📝 [NOTEPAD] Markdown parsing error:', error);
        // Fallback to basic markdown-like rendering
        this.renderBasicMarkdown(content);
      }
    } else {
      // Fallback: basic markdown-like rendering
      this.renderBasicMarkdown(content);
    }
  }
  
  renderBasicMarkdown(content) {
    console.log('📝 [NOTEPAD] Using fallback markdown rendering');
    
    // Basic markdown rendering without external library
    let html = content;
    
    // Convert line breaks
    html = html.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Headers
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    
    // Bold and italic
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    
    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    // Images - Handle both regular images and data URLs
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      // If it's a data URL, use it directly
      if (src.startsWith('data:')) {
        return `<img src="${src}" alt="${alt}" style="max-width: 100%; height: auto; margin: 8px 0;">`;
      } else {
        return `<img src="${src}" alt="${alt}" style="max-width: 100%; height: auto; margin: 8px 0;">`;
      }
    });
    
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');
    
    // Lists
    html = html.replace(/^\* (.+)$/gm, '<li>$1</li>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    // Line breaks and paragraphs
    html = html.replace(/\n\n/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');
    html = '<p>' + html + '</p>';
    
    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');
    html = html.replace(/<p>(<h[1-6])/g, '$1');
    html = html.replace(/(<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>)/g, '$1');
    html = html.replace(/(<\/ul>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>)/g, '$1');
    html = html.replace(/(<\/pre>)<\/p>/g, '$1');
    
    this.preview.innerHTML = html;
  }

  updateStatus(text) {
    this.statusText.textContent = text;
    
    // Clear status after 3 seconds
    setTimeout(() => {
      if (this.statusText.textContent === text) {
        this.statusText.textContent = 'Ready';
      }
    }, 3000);
  }

  toggleViewMode() {
    const modes = ['split', 'editor', 'preview'];
    const currentIndex = modes.indexOf(this.currentViewMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    this.currentViewMode = modes[nextIndex];
    
    // Update UI
    this.contentContainer.className = 'content-container';
    if (this.currentViewMode === 'editor') {
      this.contentContainer.classList.add('editor-only');
      this.viewModeBtn.textContent = '👁️ Editor';
    } else if (this.currentViewMode === 'preview') {
      this.contentContainer.classList.add('preview-only');
      this.viewModeBtn.textContent = '👁️ Preview';
    } else {
      this.viewModeBtn.textContent = '👁️ Split';
    }
    
    this.showToast(`View mode: ${this.currentViewMode}`);
  }

  toggleVisibility() {
    // Use IPC to toggle window visibility
    ipcRenderer.send('toggle-notepad-window', this.sessionId);
  }

  newFile() {
    if (this.hasUnsavedChanges) {
      const confirmed = confirm('You have unsaved changes. Continue with new file?');
      if (!confirmed) return;
    }
    
    this.editor.value = this.editor.placeholder;
    this.currentFile = null;
    this.hasUnsavedChanges = false;
    this.updateCharCount();
    this.updatePreview();
    this.updateStatus('New file created');
  }

  openFile() {
    this.fileInput.click();
  }

  onFileSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      this.editor.value = e.target.result;
      this.currentFile = file.name;
      this.hasUnsavedChanges = false;
      this.updateCharCount();
      this.updatePreview();
      this.updateStatus(`Opened: ${file.name}`);
      this.showToast(`📁 Opened: ${file.name}`);
    };
    
    reader.readAsText(file);
    
    // Clear the input
    event.target.value = '';
  }

  saveFile() {
    const content = this.editor.value;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = this.currentFile || 'interview-notes.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.hasUnsavedChanges = false;
    this.updateStatus('File saved');
    this.showToast('💾 File saved successfully');
  }

  insertImage() {
    this.imageInput.click();
  }

  onImageSelected(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const markdownImage = `![${file.name}](${dataUrl})\n\n`;
      
      // Insert at cursor position
      const cursorPos = this.editor.selectionStart;
      const textBefore = this.editor.value.substring(0, cursorPos);
      const textAfter = this.editor.value.substring(cursorPos);
      
      this.editor.value = textBefore + markdownImage + textAfter;
      this.editor.focus();
      this.editor.setSelectionRange(cursorPos + markdownImage.length, cursorPos + markdownImage.length);
      
      this.onEditorChange();
      this.showToast(`🖼️ Image "${file.name}" inserted`);
    };
    
    reader.readAsDataURL(file);
    
    // Clear the input
    event.target.value = '';
  }

  onKeyDown(event) {
    // Cmd+J / Ctrl+J to toggle visibility
    if ((event.metaKey || event.ctrlKey) && event.key === 'j') {
      event.preventDefault();
      this.toggleVisibility();
    }
    
    // Cmd+S / Ctrl+S to save
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      this.saveFile();
    }
    
    // Cmd+N / Ctrl+N to new file
    if ((event.metaKey || event.ctrlKey) && event.key === 'n') {
      event.preventDefault();
      this.newFile();
    }
    
    // Cmd+O / Ctrl+O to open file
    if ((event.metaKey || event.ctrlKey) && event.key === 'o') {
      event.preventDefault();
      this.openFile();
    }
  }

  onPaste(event) {
    // Handle pasted images
    const items = Array.from(event.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    
    if (imageItem) {
      event.preventDefault();
      
      const file = imageItem.getAsFile();
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const dataUrl = e.target.result;
        const markdownImage = `![Pasted Image](${dataUrl})\n\n`;
        
        // Insert at cursor position
        const cursorPos = this.editor.selectionStart;
        const textBefore = this.editor.value.substring(0, cursorPos);
        const textAfter = this.editor.value.substring(cursorPos);
        
        this.editor.value = textBefore + markdownImage + textAfter;
        this.editor.setSelectionRange(cursorPos + markdownImage.length, cursorPos + markdownImage.length);
        
        this.onEditorChange();
        this.showToast('🖼️ Image pasted successfully');
      };
      
      reader.readAsDataURL(file);
    }
  }

  onDragOver(event) {
    event.preventDefault();
    this.editor.classList.add('drag-over');
  }

  onDragLeave(event) {
    event.preventDefault();
    this.editor.classList.remove('drag-over');
  }

  onDrop(event) {
    event.preventDefault();
    this.editor.classList.remove('drag-over');
    
    const files = Array.from(event.dataTransfer.files);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      imageFiles.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target.result;
          const markdownImage = `![${file.name}](${dataUrl})\n\n`;
          
          // Insert at cursor position or end
          const cursorPos = this.editor.selectionStart || this.editor.value.length;
          const textBefore = this.editor.value.substring(0, cursorPos);
          const textAfter = this.editor.value.substring(cursorPos);
          
          this.editor.value = textBefore + markdownImage + textAfter;
          this.onEditorChange();
        };
        
        reader.readAsDataURL(file);
      });
      
      this.showToast(`🖼️ ${imageFiles.length} image(s) added`);
    } else if (files.length > 0) {
      // Handle text files
      const textFile = files.find(file => file.type.startsWith('text/') || file.name.endsWith('.md'));
      if (textFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          this.editor.value = e.target.result;
          this.currentFile = textFile.name;
          this.onEditorChange();
          this.showToast(`📁 Loaded: ${textFile.name}`);
        };
        reader.readAsText(textFile);
      }
    }
  }

  closeNotepad() {
    if (this.hasUnsavedChanges) {
      this.savePersistedContent();
    }
    
    // Hide the window instead of closing it via IPC
    ipcRenderer.send('hide-notepad-window', this.sessionId);
  }

  showToast(message, isError = false) {
    this.toast.textContent = message;
    this.toast.className = `toast ${isError ? 'error' : ''}`;
    this.toast.classList.add('show');
    
    setTimeout(() => {
      this.toast.classList.remove('show');
    }, 3000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  console.log('📝 [NOTEPAD] DOM loaded, initializing notepad renderer...');
  try {
    new NotepadRenderer();
    console.log('📝 [NOTEPAD] Notepad renderer initialized successfully');
  } catch (error) {
    console.error('📝 [NOTEPAD] Failed to initialize notepad renderer:', error);
  }
});
