import { BrowserWindow, app } from 'electron';
import * as path from 'path';
import { SessionConfig } from '../types';

export class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();
  private mainWindow: BrowserWindow | null = null;

  createMainWindow(): BrowserWindow {
    this.mainWindow = new BrowserWindow({
      width: 200,
      height: 400,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });

    // Configure stealth properties
    if (process.platform === 'darwin') {
      this.mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      this.mainWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    // Load main window HTML
    this.mainWindow.loadFile(path.join(__dirname, '../renderer/main.html'));

    // Store window reference
    this.windows.set('main', this.mainWindow);

    // Handle window events
    this.setupWindowEvents(this.mainWindow, 'main');

    return this.mainWindow;
  }

  createSessionWindow(sessionId: string, config: SessionConfig): BrowserWindow {
    const sessionWindow = new BrowserWindow({
      width: 400,
      height: 400,
      frame: false,
      alwaysOnTop: true,
      resizable: false,
      skipTaskbar: true,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        additionalArguments: [`--session-id=${sessionId}`]
      }
    });

    // Configure stealth properties
    if (process.platform === 'darwin') {
      sessionWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      sessionWindow.setAlwaysOnTop(true, 'screen-saver');
    }

    // Load session window HTML
    sessionWindow.loadFile(path.join(__dirname, '../renderer/session.html'));

    // Store window reference
    this.windows.set(sessionId, sessionWindow);

    // Handle window events
    this.setupWindowEvents(sessionWindow, sessionId);

    return sessionWindow;
  }
  
  createSettingsWindow(): BrowserWindow {
    // Check if settings window already exists
    const existingWindow = this.windows.get('settings');
    if (existingWindow && !existingWindow.isDestroyed()) {
      existingWindow.focus();
      return existingWindow;
    }
    
    const settingsWindow = new BrowserWindow({
      width: 650,
      height: 750,
      frame: true,
      resizable: false,
      skipTaskbar: false,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false
      }
    });
    
    // Load settings window HTML
    settingsWindow.loadFile(path.join(__dirname, '../renderer/settings.html'));
    
    // Store window reference
    this.windows.set('settings', settingsWindow);
    
    // Handle window events
    this.setupWindowEvents(settingsWindow, 'settings');
    
    return settingsWindow;
  }

  hideWindow(windowId: string): void {
    const window = this.windows.get(windowId);
    if (window) {
      window.hide();
      if (windowId === 'main') {
        this.removeDockIcon();
      }
    }
  }

  showWindow(windowId: string): void {
    const window = this.windows.get(windowId);
    if (window) {
      window.show();
      if (windowId === 'main') {
        this.restoreDockIcon();
      }
    }
  }

  toggleVisibility(windowId: string): void {
    const window = this.windows.get(windowId);
    if (window) {
      if (window.isVisible()) {
        this.hideWindow(windowId);
      } else {
        this.showWindow(windowId);
      }
    }
  }

  removeDockIcon(): void {
    if (process.platform === 'darwin') {
      app.dock?.hide();
    }
  }

  restoreDockIcon(): void {
    if (process.platform === 'darwin') {
      app.dock?.show();
    }
  }

  getWindow(windowId: string): BrowserWindow | undefined {
    return this.windows.get(windowId);
  }

  closeWindow(windowId: string): void {
    const window = this.windows.get(windowId);
    if (window) {
      window.close();
      this.windows.delete(windowId);
    }
  }

  private setupWindowEvents(window: BrowserWindow, windowId: string): void {
    window.on('closed', () => {
      this.windows.delete(windowId);
      if (windowId === 'main') {
        this.mainWindow = null;
      }
    });

    // Prevent window from being captured in screen sharing
    window.setContentProtection(true);
    
    // Handle focus events for stealth
    window.on('blur', () => {
      if (process.platform === 'darwin') {
        window.setAlwaysOnTop(false);
        setTimeout(() => window.setAlwaysOnTop(true, 'screen-saver'), 100);
      }
    });
  }
}