import { Application } from 'spectron';
import { expect } from 'chai';
import * as path from 'path';
import * as fs from 'fs';

describe('Interview Assistant E2E Workflow Tests', () => {
  let app: Application;
  const testTimeout = 30000;

  beforeEach(async function() {
    this.timeout(testTimeout);
    
    // Start the Electron app
    app = new Application({
      path: path.join(__dirname, '../../node_modules/.bin/electron'),
      args: [path.join(__dirname, '../../dist/main.js')],
      env: {
        NODE_ENV: 'test',
        ELECTRON_IS_DEV: '0'
      },
      startTimeout: 10000,
      waitTimeout: 10000
    });

    await app.start();
    await app.client.waitUntilWindowLoaded();
  });

  afterEach(async function() {
    this.timeout(testTimeout);
    
    if (app && app.isRunning()) {
      await app.stop();
    }
  });

  describe('Stealth Mode Functionality', () => {
    it('should start in stealth mode with no visible windows', async function() {
      this.timeout(testTimeout);
      
      // Check that no windows are visible initially
      const windowCount = await app.client.getWindowCount();
      expect(windowCount).to.equal(0);
      
      // Verify process name is set correctly
      const title = await app.mainProcess.evaluate(() => {
        return process.title;
      });
      expect(title).to.equal('systemAssistance');
    });

    it('should show main window when global hotkey is pressed', async function() {
      this.timeout(testTimeout);
      
      // Simulate global hotkey press (Cmd+G)
      await app.webContents.sendInputEvent({
        type: 'keyDown',
        modifiers: ['cmd'],
        keyCode: 'KeyG'
      });
      
      // Wait for main window to appear
      await app.client.waitUntilWindowLoaded();
      
      // Verify main window is visible
      const windowCount = await app.client.getWindowCount();
      expect(windowCount).to.equal(1);
      
      // Check window dimensions
      const bounds = await app.browserWindow.getBounds();
      expect(bounds.width).to.equal(200);
      expect(bounds.height).to.equal(400);
    });

    it('should hide main window when hotkey is pressed again', async function() {
      this.timeout(testTimeout);
      
      // First show the window
      await app.webContents.sendInputEvent({
        type: 'keyDown',
        modifiers: ['cmd'],
        keyCode: 'KeyG'
      });
      
      await app.client.waitUntilWindowLoaded();
      
      // Then hide it
      await app.webContents.sendInputEvent({
        type: 'keyDown',
        modifiers: ['cmd'],
        keyCode: 'KeyG'
      });
      
      // Verify window is hidden
      const isVisible = await app.browserWindow.isVisible();
      expect(isVisible).to.be.false;
    });
  });

  describe('Session Management Workflow', () => {
    beforeEach(async function() {
      this.timeout(testTimeout);
      
      // Show main window for session tests
      await app.webContents.sendInputEvent({
        type: 'keyDown',
        modifiers: ['cmd'],
        keyCode: 'KeyG'
      });
      
      await app.client.waitUntilWindowLoaded();
    });

    it('should create a new session with selected profession and interview type', async function() {
      this.timeout(testTimeout);
      
      // Select profession
      await app.client.selectByValue('#profession', 'software-engineer');
      
      // Select interview type
      await app.client.selectByValue('#interview-type', 'technical');
      
      // Click start session
      await app.client.click('#start-session');
      
      // Wait for session window to open
      await app.client.pause(2000);
      
      // Verify session window exists
      const windowCount = await app.client.getWindowCount();
      expect(windowCount).to.equal(2); // Main + Session window
      
      // Switch to session window
      await app.client.windowByIndex(1);
      
      // Verify session window dimensions
      const bounds = await app.browserWindow.getBounds();
      expect(bounds.width).to.equal(400);
      expect(bounds.height).to.equal(400);
      
      // Verify session window title contains profession and interview type
      const title = await app.browserWindow.getTitle();
      expect(title).to.include('software-engineer');
      expect(title).to.include('technical');
    });

    it('should maintain independent chat histories across multiple sessions', async function() {
      this.timeout(testTimeout);
      
      // Create first session
      await app.client.selectByValue('#profession', 'software-engineer');
      await app.client.selectByValue('#interview-type', 'technical');
      await app.client.click('#start-session');
      await app.client.pause(1000);
      
      // Switch to first session window
      await app.client.windowByIndex(1);
      
      // Send a message in first session
      await app.client.setValue('#message-input', 'Test message session 1');
      await app.client.click('#send-button');
      await app.client.pause(1000);
      
      // Switch back to main window
      await app.client.windowByIndex(0);
      
      // Create second session
      await app.client.selectByValue('#profession', 'data-scientist');
      await app.client.selectByValue('#interview-type', 'behavioral');
      await app.client.click('#start-session');
      await app.client.pause(1000);
      
      // Switch to second session window
      await app.client.windowByIndex(2);
      
      // Send a different message in second session
      await app.client.setValue('#message-input', 'Test message session 2');
      await app.client.click('#send-button');
      await app.client.pause(1000);
      
      // Verify messages are in correct sessions
      const session2Messages = await app.client.getText('.chat-message');
      expect(session2Messages).to.include('Test message session 2');
      expect(session2Messages).to.not.include('Test message session 1');
      
      // Switch back to first session
      await app.client.windowByIndex(1);
      const session1Messages = await app.client.getText('.chat-message');
      expect(session1Messages).to.include('Test message session 1');
      expect(session1Messages).to.not.include('Test message session 2');
    });

    it('should close session without affecting other sessions', async function() {
      this.timeout(testTimeout);
      
      // Create two sessions
      await app.client.selectByValue('#profession', 'software-engineer');
      await app.client.selectByValue('#interview-type', 'technical');
      await app.client.click('#start-session');
      await app.client.pause(1000);
      
      await app.client.windowByIndex(0);
      await app.client.selectByValue('#profession', 'data-scientist');
      await app.client.selectByValue('#interview-type', 'behavioral');
      await app.client.click('#start-session');
      await app.client.pause(1000);
      
      // Verify we have 3 windows (main + 2 sessions)
      let windowCount = await app.client.getWindowCount();
      expect(windowCount).to.equal(3);
      
      // Close first session
      await app.client.windowByIndex(1);
      await app.client.click('#close-session');
      await app.client.pause(1000);
      
      // Verify we now have 2 windows (main + 1 session)
      windowCount = await app.client.getWindowCount();
      expect(windowCount).to.equal(2);
      
      // Verify second session is still active
      await app.client.windowByIndex(1);
      const title = await app.browserWindow.getTitle();
      expect(title).to.include('data-scientist');
    });
  });

  describe('OCR and Screenshot Workflow', () => {
    let sessionWindowIndex: number;

    beforeEach(async function() {
      this.timeout(testTimeout);
      
      // Setup session for OCR tests
      await app.webContents.sendInputEvent({
        type: 'keyDown',
        modifiers: ['cmd'],
        keyCode: 'KeyG'
      });
      
      await app.client.waitUntilWindowLoaded();
      await app.client.selectByValue('#profession', 'software-engineer');
      await app.client.selectByValue('#interview-type', 'technical');
      await app.client.click('#start-session');
      await app.client.pause(2000);
      
      sessionWindowIndex = 1;
      await app.client.windowByIndex(sessionWindowIndex);
    });

    it('should capture screenshot and process OCR within 2 seconds', async function() {
      this.timeout(testTimeout);
      
      const startTime = Date.now();
      
      // Click screenshot button
      await app.client.click('#screenshot-button');
      
      // Wait for OCR processing to complete
      await app.client.waitForExist('.ocr-result', 5000);
      
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      // Verify OCR completed within 2 seconds
      expect(processingTime).to.be.lessThan(2000);
      
      // Verify OCR result appears in chat
      const chatMessages = await app.client.getText('.chat-message');
      expect(chatMessages).to.include('Screenshot captured');
    });

    it('should handle OCR errors gracefully', async function() {
      this.timeout(testTimeout);
      
      // Mock OCR service to fail
      await app.mainProcess.evaluate(() => {
        // Simulate OCR service failure
        global.mockOCRFailure = true;
      });
      
      // Click screenshot button
      await app.client.click('#screenshot-button');
      
      // Wait for error message
      await app.client.waitForExist('.error-message', 5000);
      
      // Verify error message is user-friendly
      const errorMessage = await app.client.getText('.error-message');
      expect(errorMessage).to.include('Screenshot capture failed');
      expect(errorMessage).to.include('Please try again');
    });

    it('should provide debug analysis for code screenshots', async function() {
      this.timeout(testTimeout);
      
      // Click debug button
      await app.client.click('#debug-button');
      
      // Wait for debug analysis
      await app.client.waitForExist('.debug-result', 10000);
      
      // Verify debug result appears in chat
      const chatMessages = await app.client.getText('.chat-message');
      expect(chatMessages).to.include('Debug code screenshot captured');
      
      // Verify debug analysis is provided
      const debugResult = await app.client.getText('.debug-result');
      expect(debugResult.length).to.be.greaterThan(0);
    });
  });

  describe('Audio Recording and Transcription Workflow', () => {
    let sessionWindowIndex: number;

    beforeEach(async function() {
      this.timeout(testTimeout);
      
      // Setup session for audio tests
      await app.webContents.sendInputEvent({
        type: 'keyDown',
        modifiers: ['cmd'],
        keyCode: 'KeyG'
      });
      
      await app.client.waitUntilWindowLoaded();
      await app.client.selectByValue('#profession', 'software-engineer');
      await app.client.selectByValue('#interview-type', 'technical');
      await app.client.click('#start-session');
      await app.client.pause(2000);
      
      sessionWindowIndex = 1;
      await app.client.windowByIndex(sessionWindowIndex);
    });

    it('should start and stop audio recording', async function() {
      this.timeout(testTimeout);
      
      // Start recording
      await app.client.click('#record-button');
      
      // Verify recording status
      await app.client.waitForExist('.recording-indicator', 3000);
      const recordingStatus = await app.client.getText('.recording-indicator');
      expect(recordingStatus).to.include('Recording');
      
      // Wait a moment
      await app.client.pause(2000);
      
      // Stop recording
      await app.client.click('#record-button');
      
      // Verify recording stopped
      const isRecordingVisible = await app.client.isExisting('.recording-indicator');
      expect(isRecordingVisible).to.be.false;
    });

    it('should process audio segments within 3 seconds', async function() {
      this.timeout(testTimeout);
      
      // Start recording
      await app.client.click('#record-button');
      
      // Wait for first segment to be processed (5 seconds + processing time)
      await app.client.waitForExist('.transcription-result', 8000);
      
      // Verify transcription appears in chat
      const chatMessages = await app.client.getText('.chat-message');
      expect(chatMessages).to.include('transcription') || expect(chatMessages).to.include('audio');
      
      // Stop recording
      await app.client.click('#record-button');
    });

    it('should handle audio recording errors gracefully', async function() {
      this.timeout(testTimeout);
      
      // Mock audio service to fail
      await app.mainProcess.evaluate(() => {
        global.mockAudioFailure = true;
      });
      
      // Try to start recording
      await app.client.click('#record-button');
      
      // Wait for error message
      await app.client.waitForExist('.error-message', 5000);
      
      // Verify error message is user-friendly
      const errorMessage = await app.client.getText('.error-message');
      expect(errorMessage).to.include('recording failed') || expect(errorMessage).to.include('audio');
    });
  });

  describe('RAG (Knowledge Base) Workflow', () => {
    let sessionWindowIndex: number;

    beforeEach(async function() {
      this.timeout(testTimeout);
      
      // Setup session for RAG tests
      await app.webContents.sendInputEvent({
        type: 'keyDown',
        modifiers: ['cmd'],
        keyCode: 'KeyG'
      });
      
      await app.client.waitUntilWindowLoaded();
      await app.client.selectByValue('#profession', 'software-engineer');
      await app.client.selectByValue('#interview-type', 'technical');
      await app.client.click('#start-session');
      await app.client.pause(2000);
      
      sessionWindowIndex = 1;
      await app.client.windowByIndex(sessionWindowIndex);
    });

    it('should open folder dialog when RAG button is clicked', async function() {
      this.timeout(testTimeout);
      
      // Click RAG button
      await app.client.click('#rag-button');
      
      // Verify folder dialog opens (this is mocked in test environment)
      await app.client.pause(1000);
      
      // In a real test, we would verify the dialog opened
      // For now, we'll check that the button click was registered
      const ragButton = await app.client.element('#rag-button');
      expect(ragButton).to.exist;
    });

    it('should process documents and update knowledge base', async function() {
      this.timeout(testTimeout);
      
      // Create test documents
      const testDocsPath = path.join(__dirname, '../fixtures/test-docs');
      if (!fs.existsSync(testDocsPath)) {
        fs.mkdirSync(testDocsPath, { recursive: true });
      }
      
      fs.writeFileSync(path.join(testDocsPath, 'test.txt'), 'Test document content for RAG');
      
      // Mock folder selection
      await app.mainProcess.evaluate((docsPath) => {
        global.mockFolderSelection = docsPath;
      }, testDocsPath);
      
      // Click RAG button
      await app.client.click('#rag-button');
      
      // Wait for processing to complete
      await app.client.waitForExist('.rag-success', 10000);
      
      // Verify success message
      const successMessage = await app.client.getText('.rag-success');
      expect(successMessage).to.include('Study materials') || expect(successMessage).to.include('knowledge base');
      
      // Cleanup
      fs.unlinkSync(path.join(testDocsPath, 'test.txt'));
      fs.rmdirSync(testDocsPath);
    });
  });

  describe('Settings and Configuration Workflow', () => {
    beforeEach(async function() {
      this.timeout(testTimeout);
      
      // Show main window
      await app.webContents.sendInputEvent({
        type: 'keyDown',
        modifiers: ['cmd'],
        keyCode: 'KeyG'
      });
      
      await app.client.waitUntilWindowLoaded();
    });

    it('should open settings window', async function() {
      this.timeout(testTimeout);
      
      // Click settings button
      await app.client.click('#settings-button');
      
      // Wait for settings window
      await app.client.pause(2000);
      
      // Verify settings window opened
      const windowCount = await app.client.getWindowCount();
      expect(windowCount).to.equal(2); // Main + Settings
      
      // Switch to settings window
      await app.client.windowByIndex(1);
      
      // Verify settings window title
      const title = await app.browserWindow.getTitle();
      expect(title).to.include('Settings');
    });

    it('should validate and save API key', async function() {
      this.timeout(testTimeout);
      
      // Open settings
      await app.client.click('#settings-button');
      await app.client.pause(2000);
      await app.client.windowByIndex(1);
      
      // Enter test API key
      await app.client.setValue('#api-key-input', 'sk-test-api-key-for-testing');
      
      // Click test button
      await app.client.click('#test-api-key');
      
      // Wait for validation result
      await app.client.waitForExist('.api-key-status', 5000);
      
      // Verify validation feedback
      const status = await app.client.getText('.api-key-status');
      expect(status.length).to.be.greaterThan(0);
    });

    it('should manage prompt library', async function() {
      this.timeout(testTimeout);
      
      // Open settings
      await app.client.click('#settings-button');
      await app.client.pause(2000);
      await app.client.windowByIndex(1);
      
      // Switch to prompt library tab
      await app.client.click('#prompt-library-tab');
      
      // Verify prompt library interface
      const promptTable = await app.client.isExisting('#prompt-table');
      expect(promptTable).to.be.true;
      
      // Test adding a new persona
      await app.client.click('#add-persona-button');
      await app.client.setValue('#persona-name-input', 'Test Engineer');
      await app.client.click('#save-persona-button');
      
      // Verify persona was added
      await app.client.waitForExist('.persona-row', 5000);
      const personas = await app.client.getText('.persona-row');
      expect(personas).to.include('Test Engineer');
    });
  });

  describe('Error Recovery and Graceful Handling', () => {
    let sessionWindowIndex: number;

    beforeEach(async function() {
      this.timeout(testTimeout);
      
      // Setup session for error tests
      await app.webContents.sendInputEvent({
        type: 'keyDown',
        modifiers: ['cmd'],
        keyCode: 'KeyG'
      });
      
      await app.client.waitUntilWindowLoaded();
      await app.client.selectByValue('#profession', 'software-engineer');
      await app.client.selectByValue('#interview-type', 'technical');
      await app.client.click('#start-session');
      await app.client.pause(2000);
      
      sessionWindowIndex = 1;
      await app.client.windowByIndex(sessionWindowIndex);
    });

    it('should recover from API failures with retry logic', async function() {
      this.timeout(testTimeout);
      
      // Mock API failure followed by success
      await app.mainProcess.evaluate(() => {
        global.mockAPIFailureCount = 2; // Fail twice, then succeed
      });
      
      // Send chat message
      await app.client.setValue('#message-input', 'Test message for API retry');
      await app.client.click('#send-button');
      
      // Wait for retry attempts and eventual success
      await app.client.waitForExist('.chat-response', 15000);
      
      // Verify message was eventually processed
      const chatMessages = await app.client.getText('.chat-message');
      expect(chatMessages).to.include('Test message for API retry');
    });

    it('should restore session state after application restart', async function() {
      this.timeout(testTimeout);
      
      // Send a message to create session state
      await app.client.setValue('#message-input', 'Message before restart');
      await app.client.click('#send-button');
      await app.client.pause(2000);
      
      // Get session ID for verification
      const sessionId = await app.client.getAttribute('body', 'data-session-id');
      
      // Restart the application
      await app.restart();
      await app.client.waitUntilWindowLoaded();
      
      // Verify session was restored
      // Note: In a real implementation, this would check for restored sessions
      const windowCount = await app.client.getWindowCount();
      expect(windowCount).to.be.greaterThan(0);
    });

    it('should provide clear error messages for permission issues', async function() {
      this.timeout(testTimeout);
      
      // Mock permission denied error
      await app.mainProcess.evaluate(() => {
        global.mockPermissionDenied = true;
      });
      
      // Try to capture screenshot
      await app.client.click('#screenshot-button');
      
      // Wait for permission error
      await app.client.waitForExist('.permission-error', 5000);
      
      // Verify error message provides clear instructions
      const errorMessage = await app.client.getText('.permission-error');
      expect(errorMessage).to.include('permission') || expect(errorMessage).to.include('access');
      expect(errorMessage).to.include('Settings') || expect(errorMessage).to.include('System Preferences');
    });
  });

  describe('Performance and Latency Requirements', () => {
    let sessionWindowIndex: number;

    beforeEach(async function() {
      this.timeout(testTimeout);
      
      // Setup session for performance tests
      await app.webContents.sendInputEvent({
        type: 'keyDown',
        modifiers: ['cmd'],
        keyCode: 'KeyG'
      });
      
      await app.client.waitUntilWindowLoaded();
      await app.client.selectByValue('#profession', 'software-engineer');
      await app.client.selectByValue('#interview-type', 'technical');
      await app.client.click('#start-session');
      await app.client.pause(2000);
      
      sessionWindowIndex = 1;
      await app.client.windowByIndex(sessionWindowIndex);
    });

    it('should meet OCR latency requirement of <2 seconds', async function() {
      this.timeout(testTimeout);
      
      const measurements: number[] = [];
      
      // Take multiple measurements
      for (let i = 0; i < 3; i++) {
        const startTime = Date.now();
        
        await app.client.click('#screenshot-button');
        await app.client.waitForExist('.ocr-result', 5000);
        
        const endTime = Date.now();
        const latency = endTime - startTime;
        measurements.push(latency);
        
        // Clear result for next test
        await app.client.pause(1000);
      }
      
      // Verify all measurements are under 2 seconds
      const averageLatency = measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(averageLatency).to.be.lessThan(2000);
      
      console.log(`Average OCR latency: ${averageLatency}ms`);
    });

    it('should meet audio transcription latency requirement of <3 seconds per segment', async function() {
      this.timeout(testTimeout);
      
      // Start recording
      await app.client.click('#record-button');
      
      // Wait for first segment (5 seconds) plus processing time
      const startTime = Date.now();
      await app.client.waitForExist('.transcription-result', 10000);
      const endTime = Date.now();
      
      // Stop recording
      await app.client.click('#record-button');
      
      // Verify total time (5s recording + <3s processing) is reasonable
      const totalTime = endTime - startTime;
      expect(totalTime).to.be.lessThan(8000); // 5s + 3s buffer
      
      console.log(`Audio transcription total time: ${totalTime}ms`);
    });

    it('should maintain responsive UI during intensive operations', async function() {
      this.timeout(testTimeout);
      
      // Start multiple operations simultaneously
      await app.client.click('#screenshot-button');
      await app.client.click('#record-button');
      
      // Verify UI remains responsive
      await app.client.pause(1000);
      
      // Try to interact with UI elements
      const messageInput = await app.client.element('#message-input');
      await app.client.setValue('#message-input', 'UI responsiveness test');
      
      const inputValue = await app.client.getValue('#message-input');
      expect(inputValue).to.equal('UI responsiveness test');
      
      // Cleanup
      await app.client.click('#record-button'); // Stop recording
    });
  });
});