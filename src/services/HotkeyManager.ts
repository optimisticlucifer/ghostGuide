import { globalShortcut } from 'electron';
import { WindowManager } from './WindowManager';

export class HotkeyManager {
  private windowManager: WindowManager;
  private registeredHotkeys: Set<string> = new Set();

  constructor(windowManager: WindowManager) {
    this.windowManager = windowManager;
  }

  registerHotkeys(): void {
    try {
      // Register 'g' hotkey for main window visibility toggle
      const mainHotkey = 'CommandOrControl+Shift+G';
      if (globalShortcut.register(mainHotkey, () => {
        this.windowManager.toggleVisibility('main');
      })) {
        this.registeredHotkeys.add(mainHotkey);
        console.log('Main window hotkey registered successfully');
      } else {
        console.error('Failed to register main window hotkey');
      }

      // Register 'h' hotkey for session window visibility toggle
      const sessionHotkey = 'CommandOrControl+Shift+H';
      if (globalShortcut.register(sessionHotkey, () => {
        this.toggleAllSessionWindows();
      })) {
        this.registeredHotkeys.add(sessionHotkey);
        console.log('Session window hotkey registered successfully');
      } else {
        console.error('Failed to register session window hotkey');
      }

    } catch (error) {
      console.error('Error registering hotkeys:', error);
    }
  }

  unregisterHotkeys(): void {
    this.registeredHotkeys.forEach(hotkey => {
      globalShortcut.unregister(hotkey);
    });
    this.registeredHotkeys.clear();
  }

  private toggleAllSessionWindows(): void {
    // Get all session windows and toggle their visibility
    const sessionWindows = Array.from(this.windowManager['windows'].keys())
      .filter(id => id !== 'main');
    
    if (sessionWindows.length > 0) {
      // Toggle the first session window (or all if needed)
      sessionWindows.forEach(sessionId => {
        this.windowManager.toggleVisibility(sessionId);
      });
    }
  }

  checkHotkeyConflicts(): boolean {
    // Check if hotkeys are available
    const mainHotkeyAvailable = globalShortcut.isRegistered('CommandOrControl+Shift+G');
    const sessionHotkeyAvailable = globalShortcut.isRegistered('CommandOrControl+Shift+H');
    
    if (mainHotkeyAvailable || sessionHotkeyAvailable) {
      console.warn('Hotkey conflicts detected');
      return true;
    }
    
    return false;
  }

  getRegisteredHotkeys(): string[] {
    return Array.from(this.registeredHotkeys);
  }
}