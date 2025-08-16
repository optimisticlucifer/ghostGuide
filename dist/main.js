"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const ApplicationController_1 = require("./controllers/ApplicationController");
/**
 * Main application entry point
 *
 * This file has been significantly simplified by using the ApplicationController
 * pattern to manage the application lifecycle and services.
 *
 * The ApplicationController now handles:
 * - Service initialization and dependency injection
 * - IPC communication setup
 * - Window creation and management
 * - Application lifecycle events
 * - Error handling and logging
 */
console.log('🚀 [MAIN] Starting Interview Assistant...');
// Initialize ApplicationController with debug mode in development
const appController = new ApplicationController_1.ApplicationController({
    debug: process.env.NODE_ENV === 'development',
    stealthMode: true,
    logLevel: 'info'
});
// When Electron is ready, create the main window
electron_1.app.whenReady().then(() => {
    console.log('⚡ [MAIN] Electron ready, creating main window');
    appController.createMainWindow();
});
// Handle macOS app activation
electron_1.app.on('activate', () => {
    console.log('🍎 [MAIN] App activation event - showing main window');
    appController.createMainWindow();
});
// Exit cleanly on request from parent process in development mode
if (process.env.NODE_ENV === 'development') {
    if (process.platform === 'win32') {
        process.on('message', (data) => {
            if (data === 'graceful-exit') {
                console.log('👋 [MAIN] Graceful exit requested');
                electron_1.app.quit();
            }
        });
    }
    else {
        process.on('SIGTERM', () => {
            console.log('👋 [MAIN] SIGTERM received - shutting down');
            electron_1.app.quit();
        });
    }
}
console.log('✅ [MAIN] Interview Assistant main process initialized');
console.log('🎯 [MAIN] Using ApplicationController pattern for better architecture');
