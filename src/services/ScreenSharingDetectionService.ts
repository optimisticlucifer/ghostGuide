import { desktopCapturer } from 'electron';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface ScreenSharingDetectionConfig {
    checkInterval: number;
    processPatterns: string[];
    browserPatterns: string[];
}

export class ScreenSharingDetectionService {
    private interval: NodeJS.Timeout | null = null;
    private isDetecting = false;
    private config: ScreenSharingDetectionConfig;
    private onStateChange: (isScreenSharing: boolean) => void;

    constructor(
        config: Partial<ScreenSharingDetectionConfig> = {},
        onStateChange: (isScreenSharing: boolean) => void
    ) {
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

    start(): void {
        if (this.isDetecting) return;
        
        this.isDetecting = true;
        this.interval = setInterval(() => {
            this.detectScreenSharing().catch(console.error);
        }, this.config.checkInterval);
    }

    stop(): void {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        this.isDetecting = false;
    }

    private async detectScreenSharing(): Promise<void> {
        try {
            const [isProcessScreenSharing, isBrowserScreenSharing, hasActiveSources] = await Promise.all([
                this.checkProcesses(this.config.processPatterns),
                this.checkProcesses(this.config.browserPatterns),
                this.checkDesktopCapture()
            ]);

            const isScreenSharing = isProcessScreenSharing || isBrowserScreenSharing || hasActiveSources;
            this.onStateChange(isScreenSharing);

        } catch (error) {
            console.error('Screen sharing detection failed:', error);
        }
    }

    private async checkProcesses(patterns: string[]): Promise<boolean> {
        try {
            const processPattern = patterns.join('|');
            const command = `ps aux | grep -iE "(${processPattern})" | grep -v grep`;
            const { stdout } = await execAsync(command);
            return stdout.trim().length > 0;
        } catch {
            return false;
        }
    }

    private async checkDesktopCapture(): Promise<boolean> {
        try {
            const sources = await desktopCapturer.getSources({
                types: ['screen', 'window'],
                thumbnailSize: { width: 1, height: 1 }
            });
            return sources.length > 0;
        } catch {
            return false;
        }
    }
}