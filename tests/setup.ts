// Test setup file
import { jest } from '@jest/globals';

// Mock Electron modules
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/mock/path'),
    whenReady: jest.fn(() => Promise.resolve()),
    on: jest.fn(),
    exit: jest.fn()
  },
  BrowserWindow: jest.fn().mockImplementation(() => ({
    loadFile: jest.fn(),
    webContents: {
      send: jest.fn(),
      once: jest.fn()
    },
    on: jest.fn(),
    show: jest.fn(),
    hide: jest.fn(),
    focus: jest.fn(),
    isDestroyed: jest.fn(() => false),
    setVisibleOnAllWorkspaces: jest.fn(),
    setAlwaysOnTop: jest.fn()
  })),
  ipcMain: {
    on: jest.fn(),
    once: jest.fn(),
    handle: jest.fn()
  },
  dialog: {
    showOpenDialog: jest.fn(),
    showSaveDialog: jest.fn(),
    showMessageBox: jest.fn()
  },
  globalShortcut: {
    register: jest.fn(),
    unregister: jest.fn(),
    unregisterAll: jest.fn()
  }
}));

// Mock external dependencies
jest.mock('tesseract.js', () => ({
  createWorker: jest.fn(() => ({
    load: jest.fn(),
    loadLanguage: jest.fn(),
    initialize: jest.fn(),
    recognize: jest.fn(),
    terminate: jest.fn()
  }))
}));

jest.mock('openai', () => ({
  OpenAI: jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn()
      }
    }
  }))
}));

jest.mock('sqlite3', () => ({
  Database: jest.fn().mockImplementation(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn()
  }))
}));

// Mock Node.js modules
jest.mock('fs', () => ({
  promises: {
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    access: jest.fn(),
    unlink: jest.fn()
  },
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  unlinkSync: jest.fn(),
  readdirSync: jest.fn()
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn(() => Buffer.from('mock-random-bytes')),
  createCipher: jest.fn(),
  createDecipher: jest.fn(),
  pbkdf2Sync: jest.fn(() => Buffer.from('mock-derived-key')),
  createHash: jest.fn(() => ({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(() => 'mock-hash')
  }))
}));

// Global test utilities
global.mockElectronApp = {
  getPath: jest.fn(() => '/mock/app/path')
};

// Suppress console logs during tests unless explicitly needed
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};