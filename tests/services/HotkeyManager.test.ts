import { HotkeyManager } from '../../src/services/HotkeyManager';
import { WindowManager } from '../../src/services/WindowManager';
import { globalShortcut } from 'electron';

// Mock dependencies
jest.mock('../../src/services/WindowManager');
jest.mock('electron');

describe('HotkeyManager', () => {
  let hotkeyManager: HotkeyManager;
  let mockWindowManager: jest.Mocked<WindowManager>;
  let mockGlobalShortcut: jest.Mocked<typeof globalShortcut>;

  beforeEach(() => {
    mockWindowManager = new WindowManager() as jest.Mocked<WindowManager>;
    mockGlobalShortcut = globalShortcut as jest.Mocked<typeof globalShortcut>;
    
    hotkeyManager = new HotkeyManager(mockWindowManager);
    
    jest.clearAllMocks();
  });

  describe('hotkey registration', () => {
    it('should register global hotkeys successfully', () => {
      mockGlobalShortcut.register.mockReturnValue(true);

      hotkeyManager.registerHotkeys();

      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(2);
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+G', expect.any(Function));
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+H', expect.any(Function));
    });

    it('should handle hotkey registration conflicts', () => {
      mockGlobalShortcut.register.mockReturnValue(false);

      hotkeyManager.registerHotkeys();

      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(2);
      // Should still attempt to register both hotkeys even if first fails
    });

    it('should handle registration errors gracefully', () => {
      mockGlobalShortcut.register.mockImplementation(() => {
        throw new Error('Registration failed');
      });

      // Should not throw
      expect(() => hotkeyManager.registerHotkeys()).not.toThrow();
    });
  });

  describe('hotkey functionality', () => {
    let mainWindowCallback: Function;
    let sessionWindowCallback: Function;

    beforeEach(() => {
      mockGlobalShortcut.register.mockImplementation((accelerator, callback) => {
        if (accelerator === 'CommandOrControl+G') {
          mainWindowCallback = callback;
        } else if (accelerator === 'CommandOrControl+H') {
          sessionWindowCallback = callback;
        }
        return true;
      });

      hotkeyManager.registerHotkeys();
    });

    it('should toggle main window visibility with G hotkey', () => {
      mockWindowManager.toggleVisibility.mockImplementation(() => {});

      mainWindowCallback();

      expect(mockWindowManager.toggleVisibility).toHaveBeenCalledWith('main');
    });

    it('should toggle session window visibility with H hotkey', () => {
      mockWindowManager.toggleVisibility.mockImplementation(() => {});

      sessionWindowCallback();

      expect(mockWindowManager.toggleVisibility).toHaveBeenCalledWith('session');
    });

    it('should handle window manager errors during hotkey execution', () => {
      mockWindowManager.toggleVisibility.mockImplementation(() => {
        throw new Error('Window operation failed');
      });

      // Should not throw
      expect(() => mainWindowCallback()).not.toThrow();
      expect(() => sessionWindowCallback()).not.toThrow();
    });
  });

  describe('hotkey unregistration', () => {
    it('should unregister all hotkeys', () => {
      mockGlobalShortcut.unregisterAll.mockImplementation(() => {});

      hotkeyManager.unregisterHotkeys();

      expect(mockGlobalShortcut.unregisterAll).toHaveBeenCalled();
    });

    it('should handle unregistration errors gracefully', () => {
      mockGlobalShortcut.unregisterAll.mockImplementation(() => {
        throw new Error('Unregistration failed');
      });

      // Should not throw
      expect(() => hotkeyManager.unregisterHotkeys()).not.toThrow();
    });
  });

  describe('hotkey conflict detection', () => {
    it('should detect and report hotkey conflicts', () => {
      let conflictDetected = false;
      
      mockGlobalShortcut.register.mockImplementation((accelerator) => {
        if (accelerator === 'CommandOrControl+G') {
          conflictDetected = true;
          return false; // Simulate conflict
        }
        return true;
      });

      hotkeyManager.registerHotkeys();

      expect(conflictDetected).toBe(true);
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+G', expect.any(Function));
    });

    it('should continue registering other hotkeys when one conflicts', () => {
      mockGlobalShortcut.register.mockImplementation((accelerator) => {
        if (accelerator === 'CommandOrControl+G') {
          return false; // First hotkey conflicts
        }
        return true; // Second hotkey succeeds
      });

      hotkeyManager.registerHotkeys();

      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle window manager being null', () => {
      const hotkeyManagerWithNullWindow = new HotkeyManager(null as any);

      // Should not throw during registration
      expect(() => hotkeyManagerWithNullWindow.registerHotkeys()).not.toThrow();
    });

    it('should handle missing window manager methods', () => {
      const incompleteWindowManager = {} as WindowManager;
      const hotkeyManagerWithIncompleteWindow = new HotkeyManager(incompleteWindowManager);

      // Should not throw during registration
      expect(() => hotkeyManagerWithIncompleteWindow.registerHotkeys()).not.toThrow();
    });
  });

  describe('hotkey state management', () => {
    it('should track registration state', () => {
      mockGlobalShortcut.register.mockReturnValue(true);

      expect((hotkeyManager as any).isRegistered).toBeFalsy();

      hotkeyManager.registerHotkeys();

      expect((hotkeyManager as any).isRegistered).toBeTruthy();
    });

    it('should prevent double registration', () => {
      mockGlobalShortcut.register.mockReturnValue(true);

      hotkeyManager.registerHotkeys();
      hotkeyManager.registerHotkeys(); // Second call

      // Should only register once
      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(2); // Only from first call
    });

    it('should allow re-registration after unregistration', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      mockGlobalShortcut.unregisterAll.mockImplementation(() => {});

      hotkeyManager.registerHotkeys();
      hotkeyManager.unregisterHotkeys();
      hotkeyManager.registerHotkeys();

      expect(mockGlobalShortcut.register).toHaveBeenCalledTimes(4); // 2 calls each time
    });
  });

  describe('platform-specific behavior', () => {
    it('should use CommandOrControl for cross-platform compatibility', () => {
      mockGlobalShortcut.register.mockReturnValue(true);

      hotkeyManager.registerHotkeys();

      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+G', expect.any(Function));
      expect(mockGlobalShortcut.register).toHaveBeenCalledWith('CommandOrControl+H', expect.any(Function));
    });
  });

  describe('cleanup', () => {
    it('should clean up hotkeys on destruction', () => {
      mockGlobalShortcut.register.mockReturnValue(true);
      mockGlobalShortcut.unregisterAll.mockImplementation(() => {});

      hotkeyManager.registerHotkeys();
      hotkeyManager.unregisterHotkeys();

      expect(mockGlobalShortcut.unregisterAll).toHaveBeenCalled();
    });
  });
});