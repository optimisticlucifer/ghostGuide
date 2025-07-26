import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigurationManager } from './ConfigurationManager';
import { ErrorHandler } from './ErrorHandler';

export interface VersionInfo {
  current: string;
  previous?: string;
  buildNumber?: string;
  buildDate?: string;
  gitCommit?: string;
  channel: 'stable' | 'beta' | 'alpha' | 'dev';
}

export interface CompatibilityInfo {
  minVersion: string;
  maxVersion?: string;
  deprecated: boolean;
  supportedFeatures: string[];
  removedFeatures: string[];
}

export class VersionManager {
  private configManager: ConfigurationManager;
  private errorHandler: ErrorHandler;
  private versionInfo: VersionInfo;
  private compatibilityMatrix: Map<string, CompatibilityInfo>;

  constructor(configManager: ConfigurationManager, errorHandler: ErrorHandler) {
    this.configManager = configManager;
    this.errorHandler = errorHandler;
    this.compatibilityMatrix = new Map();
    
    this.initializeVersionInfo();
    this.loadCompatibilityMatrix();
  }

  private initializeVersionInfo(): void {
    const packageJson = this.getPackageInfo();
    const buildInfo = this.getBuildInfo();
    
    this.versionInfo = {
      current: app.getVersion(),
      previous: this.getPreviousVersion(),
      buildNumber: buildInfo.buildNumber,
      buildDate: buildInfo.buildDate,
      gitCommit: buildInfo.gitCommit,
      channel: this.determineReleaseChannel(app.getVersion())
    };
  }

  private getPackageInfo(): any {
    try {
      const packagePath = path.join(app.getAppPath(), 'package.json');
      if (fs.existsSync(packagePath)) {
        return JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not read package.json:', error.message);
    }
    return {};
  }

  private getBuildInfo(): any {
    try {
      const buildInfoPath = path.join(app.getAppPath(), 'build-info.json');
      if (fs.existsSync(buildInfoPath)) {
        return JSON.parse(fs.readFileSync(buildInfoPath, 'utf8'));
      }
    } catch (error) {
      console.warn('Could not read build-info.json:', error.message);
    }
    
    return {
      buildNumber: process.env.BUILD_NUMBER || 'unknown',
      buildDate: process.env.BUILD_DATE || new Date().toISOString(),
      gitCommit: process.env.GIT_COMMIT || 'unknown'
    };
  }

  private getPreviousVersion(): string | undefined {
    try {
      const config = this.configManager.getConfig();
      return config.previousVersion;
    } catch (error) {
      return undefined;
    }
  }

  private determineReleaseChannel(version: string): 'stable' | 'beta' | 'alpha' | 'dev' {
    if (version.includes('dev')) return 'dev';
    if (version.includes('alpha')) return 'alpha';
    if (version.includes('beta')) return 'beta';
    return 'stable';
  }

  private loadCompatibilityMatrix(): void {
    // Define compatibility information for different versions
    this.compatibilityMatrix.set('1.0.0', {
      minVersion: '1.0.0',
      deprecated: false,
      supportedFeatures: [
        'ocr-basic',
        'audio-transcription',
        'chat-basic',
        'rag-basic',
        'session-management'
      ],
      removedFeatures: []
    });

    this.compatibilityMatrix.set('1.1.0', {
      minVersion: '1.0.0',
      deprecated: false,
      supportedFeatures: [
        'ocr-basic',
        'ocr-advanced',
        'audio-transcription',
        'audio-streaming',
        'chat-basic',
        'chat-context-aware',
        'rag-basic',
        'rag-advanced',
        'session-management',
        'prompt-library',
        'stealth-mode'
      ],
      removedFeatures: []
    });

    this.compatibilityMatrix.set('2.0.0', {
      minVersion: '1.1.0',
      deprecated: false,
      supportedFeatures: [
        'ocr-advanced',
        'audio-streaming',
        'chat-context-aware',
        'rag-advanced',
        'session-management',
        'prompt-library',
        'stealth-mode',
        'multi-language',
        'cloud-sync',
        'team-features'
      ],
      removedFeatures: [
        'ocr-basic',
        'chat-basic',
        'rag-basic'
      ]
    });
  }

  public getVersionInfo(): VersionInfo {
    return { ...this.versionInfo };
  }

  public getCurrentVersion(): string {
    return this.versionInfo.current;
  }

  public getPreviousVersion(): string | undefined {
    return this.versionInfo.previous;
  }

  public isFirstRun(): boolean {
    return !this.versionInfo.previous;
  }

  public isUpgrade(): boolean {
    if (!this.versionInfo.previous) return false;
    return this.compareVersions(this.versionInfo.current, this.versionInfo.previous) > 0;
  }

  public isDowngrade(): boolean {
    if (!this.versionInfo.previous) return false;
    return this.compareVersions(this.versionInfo.current, this.versionInfo.previous) < 0;
  }

  public compareVersions(version1: string, version2: string): number {
    // Remove pre-release identifiers for comparison
    const clean1 = version1.split('-')[0];
    const clean2 = version2.split('-')[0];
    
    const parts1 = clean1.split('.').map(Number);
    const parts2 = clean2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 < part2) return -1;
      if (part1 > part2) return 1;
    }
    
    return 0;
  }

  public isVersionCompatible(version: string, targetVersion: string): boolean {
    const compatibility = this.compatibilityMatrix.get(targetVersion);
    if (!compatibility) return true; // Assume compatible if no info available
    
    return this.compareVersions(version, compatibility.minVersion) >= 0 &&
           (!compatibility.maxVersion || this.compareVersions(version, compatibility.maxVersion) <= 0);
  }

  public getCompatibilityInfo(version: string): CompatibilityInfo | undefined {
    return this.compatibilityMatrix.get(version);
  }

  public getSupportedFeatures(version?: string): string[] {
    const targetVersion = version || this.versionInfo.current;
    const compatibility = this.compatibilityMatrix.get(targetVersion);
    return compatibility?.supportedFeatures || [];
  }

  public getRemovedFeatures(version?: string): string[] {
    const targetVersion = version || this.versionInfo.current;
    const compatibility = this.compatibilityMatrix.get(targetVersion);
    return compatibility?.removedFeatures || [];
  }

  public isFeatureSupported(feature: string, version?: string): boolean {
    const supportedFeatures = this.getSupportedFeatures(version);
    return supportedFeatures.includes(feature);
  }

  public isFeatureRemoved(feature: string, version?: string): boolean {
    const removedFeatures = this.getRemovedFeatures(version);
    return removedFeatures.includes(feature);
  }

  public getVersionHistory(): string[] {
    try {
      const config = this.configManager.getConfig();
      return config.versionHistory || [];
    } catch (error) {
      return [];
    }
  }

  public async recordVersionChange(): Promise<void> {
    try {
      const config = this.configManager.getConfig();
      
      // Update previous version
      config.previousVersion = config.currentVersion || this.versionInfo.current;
      config.currentVersion = this.versionInfo.current;
      
      // Update version history
      if (!config.versionHistory) {
        config.versionHistory = [];
      }
      
      const historyEntry = {
        version: this.versionInfo.current,
        timestamp: new Date().toISOString(),
        buildInfo: {
          buildNumber: this.versionInfo.buildNumber,
          buildDate: this.versionInfo.buildDate,
          gitCommit: this.versionInfo.gitCommit
        }
      };
      
      // Add to history if not already present
      const existingEntry = config.versionHistory.find((entry: any) => entry.version === this.versionInfo.current);
      if (!existingEntry) {
        config.versionHistory.unshift(historyEntry);
        
        // Keep only last 10 versions in history
        config.versionHistory = config.versionHistory.slice(0, 10);
      }
      
      await this.configManager.saveConfig(config);
    } catch (error) {
      this.errorHandler.handleError(error, 'VersionManager', 'Failed to record version change');
    }
  }

  public getUpgradeRequirements(fromVersion: string, toVersion: string): {
    compatible: boolean;
    requiresDataMigration: boolean;
    requiresFullReinstall: boolean;
    warnings: string[];
    blockers: string[];
  } {
    const warnings: string[] = [];
    const blockers: string[] = [];
    
    // Check basic compatibility
    const compatible = this.isVersionCompatible(fromVersion, toVersion);
    if (!compatible) {
      blockers.push(`Version ${fromVersion} is not compatible with ${toVersion}`);
    }
    
    // Check for major version changes
    const fromMajor = parseInt(fromVersion.split('.')[0]);
    const toMajor = parseInt(toVersion.split('.')[0]);
    const requiresFullReinstall = toMajor > fromMajor;
    
    if (requiresFullReinstall) {
      warnings.push('Major version upgrade detected - full reinstall recommended');
    }
    
    // Check for data migration requirements
    const requiresDataMigration = this.compareVersions(toVersion, fromVersion) > 0;
    
    // Check for removed features
    const removedFeatures = this.getRemovedFeatures(toVersion);
    if (removedFeatures.length > 0) {
      warnings.push(`The following features will be removed: ${removedFeatures.join(', ')}`);
    }
    
    // Check for deprecated versions
    const fromCompatibility = this.getCompatibilityInfo(fromVersion);
    if (fromCompatibility?.deprecated) {
      warnings.push(`Version ${fromVersion} is deprecated and should be upgraded`);
    }
    
    return {
      compatible,
      requiresDataMigration,
      requiresFullReinstall,
      warnings,
      blockers
    };
  }

  public generateVersionReport(): string {
    const info = this.getVersionInfo();
    const history = this.getVersionHistory();
    const supportedFeatures = this.getSupportedFeatures();
    
    let report = `# Version Report\n\n`;
    report += `## Current Version\n`;
    report += `- Version: ${info.current}\n`;
    report += `- Channel: ${info.channel}\n`;
    report += `- Build Number: ${info.buildNumber || 'unknown'}\n`;
    report += `- Build Date: ${info.buildDate || 'unknown'}\n`;
    report += `- Git Commit: ${info.gitCommit || 'unknown'}\n\n`;
    
    if (info.previous) {
      report += `## Previous Version\n`;
      report += `- Version: ${info.previous}\n`;
      report += `- Upgrade: ${this.isUpgrade() ? 'Yes' : 'No'}\n`;
      report += `- First Run: ${this.isFirstRun() ? 'Yes' : 'No'}\n\n`;
    }
    
    report += `## Supported Features\n`;
    supportedFeatures.forEach(feature => {
      report += `- ${feature}\n`;
    });
    report += `\n`;
    
    if (history.length > 0) {
      report += `## Version History\n`;
      history.slice(0, 5).forEach((entry: any) => {
        report += `- ${entry.version} (${new Date(entry.timestamp).toLocaleDateString()})\n`;
      });
    }
    
    return report;
  }

  public async checkVersionIntegrity(): Promise<{
    valid: boolean;
    issues: string[];
  }> {
    const issues: string[] = [];
    
    try {
      // Check if current version matches package.json
      const packageInfo = this.getPackageInfo();
      if (packageInfo.version && packageInfo.version !== this.versionInfo.current) {
        issues.push(`Version mismatch: app reports ${this.versionInfo.current}, package.json has ${packageInfo.version}`);
      }
      
      // Check version format
      const versionRegex = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
      if (!versionRegex.test(this.versionInfo.current)) {
        issues.push(`Invalid version format: ${this.versionInfo.current}`);
      }
      
      // Check for version regression
      if (this.versionInfo.previous && this.isDowngrade()) {
        issues.push(`Version regression detected: ${this.versionInfo.previous} -> ${this.versionInfo.current}`);
      }
      
      // Check build info consistency
      if (this.versionInfo.buildDate) {
        const buildDate = new Date(this.versionInfo.buildDate);
        const now = new Date();
        if (buildDate > now) {
          issues.push(`Build date is in the future: ${this.versionInfo.buildDate}`);
        }
      }
      
    } catch (error) {
      issues.push(`Version integrity check failed: ${error.message}`);
    }
    
    return {
      valid: issues.length === 0,
      issues
    };
  }
}