const { ipcRenderer } = require('electron');

class SettingsRenderer {
  constructor() {
    this.initializeTabs();
    this.initializeFormElements();
    this.setupEventListeners();
    this.loadSettings();
  }

  initializeTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        // Remove active class from all tabs and contents
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // Add active class to clicked tab and corresponding content
        tab.classList.add('active');
        const tabId = tab.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
      });
    });
  }

  initializeFormElements() {
    // General settings
    this.defaultProfession = document.getElementById('defaultProfession');
    this.defaultInterviewType = document.getElementById('defaultInterviewType');
    this.maxSessions = document.getElementById('maxSessions');
    this.saveGeneralSettings = document.getElementById('saveGeneralSettings');
    this.generalStatus = document.getElementById('generalStatus');
    
    // API settings
    this.openaiApiKey = document.getElementById('openaiApiKey');
    this.apiKeyStatus = document.getElementById('apiKeyStatus');
    this.testApiKey = document.getElementById('testApiKey');
    this.saveApiKey = document.getElementById('saveApiKey');
    
    // Prompt library
    this.promptProfession = document.getElementById('promptProfession');
    this.promptInterviewType = document.getElementById('promptInterviewType');
    this.promptAction = document.getElementById('promptAction');
    this.promptTemplate = document.getElementById('promptTemplate');
    this.promptStatus = document.getElementById('promptStatus');
    this.resetPrompt = document.getElementById('resetPrompt');
    this.savePrompt = document.getElementById('savePrompt');
    
    // Persona management
    this.newPersona = document.getElementById('newPersona');
    this.addPersona = document.getElementById('addPersona');
    this.personaTableBody = document.getElementById('personaTableBody');
  }

  setupEventListeners() {
    // General settings
    this.saveGeneralSettings.addEventListener('click', () => this.saveGeneralSettingsHandler());
    
    // API settings
    this.testApiKey.addEventListener('click', () => this.testApiKeyHandler());
    this.saveApiKey.addEventListener('click', () => this.saveApiKeyHandler());
    
    // Prompt library
    this.promptProfession.addEventListener('change', () => this.loadPromptTemplate());
    this.promptInterviewType.addEventListener('change', () => this.loadPromptTemplate());
    this.promptAction.addEventListener('change', () => this.loadPromptTemplate());
    this.resetPrompt.addEventListener('click', () => this.resetPromptHandler());
    this.savePrompt.addEventListener('click', () => this.savePromptHandler());
    
    // Persona management
    this.addPersona.addEventListener('click', () => this.addPersonaHandler());
    this.newPersona.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.addPersonaHandler();
      }
    });
    
    // IPC listeners
    this.setupIpcListeners();
  }

  setupIpcListeners() {
    // Config data
    ipcRenderer.on('config-data', (event, config) => {
      this.updateFormWithConfig(config);
    });
    
    // API key status
    ipcRenderer.on('api-key-updated', () => {
      this.showStatus(this.apiKeyStatus, 'API key saved successfully', 'success');
    });
    
    ipcRenderer.on('api-key-valid', () => {
      this.showStatus(this.apiKeyStatus, 'API key is valid', 'success');
    });
    
    ipcRenderer.on('api-key-invalid', (event, error) => {
      this.showStatus(this.apiKeyStatus, `API key is invalid: ${error}`, 'error');
    });
    
    // Prompt library
    ipcRenderer.on('prompt-template-loaded', (event, template) => {
      this.promptTemplate.value = template || '';
    });
    
    ipcRenderer.on('prompt-template-saved', () => {
      this.showStatus(this.promptStatus, 'Prompt template saved successfully', 'success');
    });
    
    ipcRenderer.on('persona-added', (event, persona) => {
      this.showStatus(this.promptStatus, `Persona "${persona}" added successfully`, 'success');
      this.loadPersonaTable();
      this.newPersona.value = '';
    });
    
    ipcRenderer.on('persona-removed', (event, persona) => {
      this.showStatus(this.promptStatus, `Persona "${persona}" removed successfully`, 'success');
      this.loadPersonaTable();
    });
    
    // General settings
    ipcRenderer.on('preferences-updated', () => {
      this.showStatus(this.generalStatus, 'Settings saved successfully', 'success');
    });
    
    // Error handling
    ipcRenderer.on('config-error', (event, error) => {
      this.showStatus(this.generalStatus, `Error: ${error}`, 'error');
    });
    
    ipcRenderer.on('prompt-error', (event, error) => {
      this.showStatus(this.promptStatus, `Error: ${error}`, 'error');
    });
  }

  loadSettings() {
    // Request config data from main process
    ipcRenderer.send('get-config');
    
    // Load prompt template for current selection
    this.loadPromptTemplate();
    
    // Load persona table
    this.loadPersonaTable();
  }

  updateFormWithConfig(config) {
    // General settings
    if (config.userPreferences) {
      this.defaultProfession.value = config.userPreferences.defaultProfession || 'software-engineer';
      this.defaultInterviewType.value = config.userPreferences.defaultInterviewType || 'technical';
      this.maxSessions.value = (config.userPreferences.maxSessions || 5).toString();
    }
    
    // API settings
    if (config.apiKey) {
      this.openaiApiKey.value = '••••••••••••••••••••••'; // Mask the actual key
      this.openaiApiKey.placeholder = 'API key is set (click to change)';
    }
  }

  loadPromptTemplate() {
    const profession = this.promptProfession.value;
    const interviewType = this.promptInterviewType.value;
    const action = this.promptAction.value;
    
    // Request prompt template from main process
    ipcRenderer.send('get-prompt-template', { profession, interviewType, action });
  }

  loadPersonaTable() {
    // Request persona list from main process
    ipcRenderer.send('get-personas');
    
    // Listen for persona data
    ipcRenderer.once('personas-data', (event, personas) => {
      this.updatePersonaTable(personas);
    });
  }

  updatePersonaTable(personas) {
    this.personaTableBody.innerHTML = '';
    
    personas.forEach(persona => {
      const row = document.createElement('tr');
      
      const professionCell = document.createElement('td');
      professionCell.textContent = persona.name;
      
      const interviewTypesCell = document.createElement('td');
      interviewTypesCell.textContent = persona.interviewTypes.join(', ');
      
      const actionsCell = document.createElement('td');
      const removeButton = document.createElement('button');
      removeButton.textContent = 'Remove';
      removeButton.className = 'secondary';
      removeButton.addEventListener('click', () => {
        if (confirm(`Are you sure you want to remove the "${persona.name}" persona?`)) {
          ipcRenderer.send('remove-persona', persona.name);
        }
      });
      actionsCell.appendChild(removeButton);
      
      row.appendChild(professionCell);
      row.appendChild(interviewTypesCell);
      row.appendChild(actionsCell);
      
      this.personaTableBody.appendChild(row);
    });
  }

  saveGeneralSettingsHandler() {
    const preferences = {
      defaultProfession: this.defaultProfession.value,
      defaultInterviewType: this.defaultInterviewType.value,
      maxSessions: parseInt(this.maxSessions.value, 10)
    };
    
    ipcRenderer.send('update-preferences', preferences);
  }

  testApiKeyHandler() {
    const apiKey = this.openaiApiKey.value;
    if (!apiKey || apiKey === '••••••••••••••••••••••') {
      this.showStatus(this.apiKeyStatus, 'Please enter an API key', 'warning');
      return;
    }
    
    ipcRenderer.send('test-api-key', apiKey);
    this.showStatus(this.apiKeyStatus, 'Testing API key...', 'warning');
  }

  saveApiKeyHandler() {
    const apiKey = this.openaiApiKey.value;
    if (!apiKey || apiKey === '••••••••••••••••••••••') {
      this.showStatus(this.apiKeyStatus, 'Please enter an API key', 'warning');
      return;
    }
    
    ipcRenderer.send('update-api-key', apiKey);
  }

  resetPromptHandler() {
    const profession = this.promptProfession.value;
    const interviewType = this.promptInterviewType.value;
    const action = this.promptAction.value;
    
    ipcRenderer.send('reset-prompt-template', { profession, interviewType, action });
  }

  savePromptHandler() {
    const profession = this.promptProfession.value;
    const interviewType = this.promptInterviewType.value;
    const action = this.promptAction.value;
    const template = this.promptTemplate.value;
    
    if (!template.trim()) {
      this.showStatus(this.promptStatus, 'Please enter a prompt template', 'warning');
      return;
    }
    
    const promptTemplate = {
      profession,
      interviewType,
      action,
      template: template.trim()
    };
    
    ipcRenderer.send('save-prompt-template', promptTemplate);
  }

  addPersonaHandler() {
    const personaName = this.newPersona.value.trim();
    if (!personaName) {
      this.showStatus(this.promptStatus, 'Please enter a persona name', 'warning');
      return;
    }
    
    // Convert to kebab-case for internal use
    const personaId = personaName.toLowerCase().replace(/\s+/g, '-');
    
    ipcRenderer.send('add-persona', { name: personaName, id: personaId });
  }

  showStatus(element, message, type) {
    if (!element) return;
    
    element.textContent = message;
    element.className = `status ${type}`;
    element.classList.remove('hidden');
    
    // Hide after 5 seconds
    setTimeout(() => {
      element.classList.add('hidden');
    }, 5000);
  }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  new SettingsRenderer();
});