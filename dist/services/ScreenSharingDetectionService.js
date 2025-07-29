"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScreenSharingDetectionService = void 0;
const electron_1 = require("electron");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ScreenSharingDetectionService {
    constructor(config = {}, onStateChange) {
        this.interval = null;
        this.isDetecting = false;
        this.config = {
            checkInterval: 5000, // 5 seconds default
            processPatterns: [
                'zoom', 'teams', 'meet', 'webex', 'skype', 'discord',
                'obs', 'streamlabs', 'xsplit', 'wirecast', 'mmhmm',
                'loom', 'screenflow', 'camtasia', 'quicktime'
            ],
            browserPatterns: [
                'chrome.*--enable-usermedia-screen-capturing',
                'firefox.*screen',
                'safari.*screen'
            ],
            ...config
        };
        this.onStateChange = onStateChange;
    }
    start() {
        if (this.isDetecting)
            return;
        this.isDetecting = true;
        this.interval = setInterval(() => {
            this.detectScreenSharing().catch(console.error);
        }, this.config.checkInterval);
    }
    stop() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isDetecting = false;
    }
    async detectScreenSharing() {
        try {
            const [isProcessScreenSharing, isBrowserScreenSharing, hasActiveSources] = await Promise.all([
                this.checkProcesses(this.config.processPatterns),
                this.checkProcesses(this.config.browserPatterns),
                this.checkDesktopCapture()
            ]);
            const isScreenSharing = isProcessScreenSharing || isBrowserScreenSharing || hasActiveSources;
            this.onStateChange(isScreenSharing);
        }
        catch (error) {
            console.error('Screen sharing detection failed:', error);
        }
    }
    async checkProcesses(patterns) {
        try {
            const processPattern = patterns.join('|');
            const command = `ps aux | grep -iE "(${processPattern})" | grep -v grep`;
            const { stdout } = await execAsync(command);
            return stdout.trim().length > 0;
        }
        catch {
            return false;
        }
    }
    async checkDesktopCapture() {
        try {
            const sources = await electron_1.desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 1, height: 1 }
            });
            return sources.length > 0;
        }
        catch {
            return false;
        }
    }
}
exports.ScreenSharingDetectionService = ScreenSharingDetectionService;
