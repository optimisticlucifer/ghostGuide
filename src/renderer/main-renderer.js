const { ipcRenderer } = require('electron');

class MainWindowRenderer {
  constructor() {
    this.professionSelect = document.getElementById('profession');
    this.interviewTypeSelect = document.getElementById('interviewType');
    this.startSessionButton = document.getElementById('startSession');
    this.settingsButton = document.getElementById('settings');
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    this.startSessionButton.addEventListener('click', () => {
      this.startSession();
    });

    this.settingsButton.addEventListener('click', () => {
      this.openSettings();
    });

    // Handle keyboard shortcuts
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        this.startSession();
      }
    });
  }

  startSession() {
    const profession = this.professionSelect.value;
    const interviewType = this.interviewTypeSelect.value;
    
    const sessionConfig = {
      profession,
      interviewType
    };

    // Send session creation request to main process
    ipcRenderer.send('create-session', sessionConfig);
  }

  openSettings() {
    // Send settings window request to main process
    ipcRenderer.send('open-settings');
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new MainWindowRenderer();
});