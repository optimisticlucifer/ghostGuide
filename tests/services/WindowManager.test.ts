import { WindowManager } from '../../src/services/WindowManager';
import { BrowserWindow } from 'electron';

// Mock BrowserWindow
jest.mock('electron');

describe('WindowManager', () => {
  let windowManager: WindowManager;
  let mockBrowserWindow: jest.Mocked<BrowserWindow>;

  beforeEach(() => {
    windowManager = new WindowManager();
    mockBrowserWindow = new BrowserWindow() as jest.Mocked<BrowserWindow>;
    jest.clearAllMocks();
  });

  describe('createMainWindow', () => {
    it('should create a main window with correct configuration', () => {
      const window = windowManager.createMainWindow();

      expect(BrowserWindow).toHaveBeenCalledWith({
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

      expect(window).toBeDefined();
    });

    it('should configure stealth properties on macOS', () => {
      // Mock process.platform
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', {
        value: 'darwin'
      });

      const window = windowManager.createMainWindow();

      expect(window.setVisibleOnAllWorkspaces).toHaveBeenCalledWith(true, { visibleOnFullScreen: true });
      expect(window.setAlwaysOnTop).toHaveBeenCalledWith(true, 'screen-saver');

      // Restore original platform
      Object.defineProperty(process, 'platform', {
        value: originalPlatform
      });
    });

    it('should load the main window HTML file', () => {
      const window = windowManager.createMainWindow();
      expect(window.loadFile).toHaveBeenCalledWith(expect.stringContaining('main.html'));
    });
  });

  describe('createSessionWindow', () => {
    const mockSessionConfig = {
      id: 'test-session-id',
      profession: 'software-engineer',
      interviewType: 'technical',
      createdAt: new Date(),
      isActive: true
    };

    it('should create a session window with correct configuration', () => {
      const window = windowManager.createSessionWindow('test-session-id', mockSessionConfig);

      expect(BrowserWindow).toHaveBeenCalledWith({
        width: 400,
        height: 400,
        frame: false,
        alwaysOnTop: true,
        resizable: false,
        skipTaskbar: true,
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          additionalArguments: ['--session-id=test-session-id']
        }
      });

      expect(window).toBeDefined();
    });

    it('should load the session window HTML file', () => {
      const window = windowManager.createSessionWindow('test-session-id', mockSessionConfig);
      expect(window.loadFile).toHaveBeenCalledWith(expect.stringContaining('session.html'));
    });

    it('should store window reference with session ID', () => {
      const window = windowManager.createSessionWindow('test-session-id', mockSessionConfig);
      const retrievedWindow = windowManager.getWindow('test-session-id');
      expect(retrievedWindow).toBe(window);
    });
  });

  describe('createSettingsWindow', () => {
    it('should create a settings window with correct configuration', () => {
      const window = windowManager.createSettingsWindow();

      expect(BrowserWindow).toHaveBeenCalledWith({
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

      expect(window).toBeDefined();
    });

    it('should return existing settings window if already created', () => {
      const window1 = windowManager.createSettingsWindow();
      const window2 = windowManager.createSettingsWindow();

      expect(window1).toBe(window2);
      expect(window1.focus).toHaveBeenCalled();
    });

    it('should load the settings window HTML file', () => {
      const window = windowManager.createSettingsWindow();
      expect(window.loadFile).toHaveBeenCalledWith(expect.stringContaining('settings.html'));
    });
  });

  describe('window management', () => {
    it('should hide a window by ID', () => {
      const sessionId = 'test-session';
      const mockConfig = {
        id: sessionId,
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true
      };

      const window = windowManager.createSessionWindow(sessionId, mockConfig);
      windowManager.hideWindow(sessionId);

      expect(window.hide).toHaveBeenCalled();
    });

    it('should show a window by ID', () => {
      const sessionId = 'test-session';
      const mockConfig = {
        id: sessionId,
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true
      };

      const window = windowManager.createSessionWindow(sessionId, mockConfig);
      windowManager.showWindow(sessionId);

      expect(window.show).toHaveBeenCalled();
    });

    it('should toggle window visibility', () => {
      const sessionId = 'test-session';
      const mockConfig = {
        id: sessionId,
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true
      };

      const window = windowManager.createSessionWindow(sessionId, mockConfig);
      
      // Mock isVisible to return false initially
      (window as any).isVisible = jest.fn().mockReturnValue(false);
      
      windowManager.toggleVisibility(sessionId);
      expect(window.show).toHaveBeenCalled();

      // Mock isVisible to return true
      (window as any).isVisible = jest.fn().mockReturnValue(true);
      
      windowManager.toggleVisibility(sessionId);
      expect(window.hide).toHaveBeenCalled();
    });

    it('should close a window by ID', () => {
      const sessionId = 'test-session';
      const mockConfig = {
        id: sessionId,
        profession: 'software-engineer',
        interviewType: 'technical',
        createdAt: new Date(),
        isActive: true
      };

      const window = windowManager.createSessionWindow(sessionId, mockConfig);
      windowManager.closeWindow(sessionId);

      expect(window.close).toHaveBeenCalled();
    });

    it('should return undefined for non-existent window', () => {
      const window = windowManager.getWindow('non-existent-id');
      expect(window).toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle errors when hiding non-existent window', () => {
      expect(() => {
        windowManager.hideWindow('non-existent-id');
      }).not.toThrow();
    });

    it('should handle errors when showing non-existent window', () => {
      expect(() => {
        windowManager.showWindow('non-existent-id');
      }).not.toThrow();
    });

    it('should handle errors when closing non-existent window', () => {
      expect(() => {
        windowManager.closeWindow('non-existent-id');
      }).not.toThrow();
    });
  });
});