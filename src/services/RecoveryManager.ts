import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { SessionManager } from './SessionManager';
import { ConfigurationManager } from './ConfigurationManager';
import { GracefulErrorHandler } from './ErrorHandler';

export interface RecoveryState {
  timestamp: Date;
  sessionIds: string[];
  lastOperation: string;
  applicationState: 'starting' | 'running' | 'shutting_down' | 'crashed';
  services: {
    ocr: boolean;
    audio: boolean;
    chat: boolean;
    rag: boolean;
  };
}

export interface ServiceStatus {
  name: string;
  isAvailable: boolean;
  lastError?: string;
  degradedMode: boolean;
  retryCount: number;
  nextRetryTime?: Date;
}

export class RecoveryManager {
  private sessionManager: SessionManager;
  private configurationManager: ConfigurationManager;
  private errorHandler: GracefulErrorHandler;
  private recoveryStatePath: string;
  private serviceStatuses: Map<string, ServiceStatus> = new Map();
  private heartbeatInterval?: NodeJS.Timeout;
  private crashDetectionEnabled = true;

  constructor(
    sessionManager: SessionManager,
    configurationManager: ConfigurationManager,
    errorHandler: GracefulErrorHandler
  ) {
    this.sessionManager = sessionManager;
    this.configurationManager = configurationManager;
    this.errorHandler = errorHandler;
    this.recoveryStatePath = path.join(app.getPath('userData'), 'interview-assistant', 'recovery-state.json');
    
    this.initializeServiceStatuses();
    this.setupCrashDetection();
  }

  /**
   * Initialize service status tracking
   */
  private initializeServiceStatuses(): void {
    const services = ['ocr', 'audio', 'chat', 'rag'];
    
    services.forEach(service => {
      this.serviceStatuses.set(service, {
        name: service,
        isAvailable: true,
        degradedMode: false,
        retryCount: 0
      });
    });
  }

  /**
   * Setup crash detection and recovery
   */
  private setupCrashDetection(): void {
    if (!this.crashDetectionEnabled) return;

    // Create recovery state directory
    const recoveryDir = path.dirname(this.recoveryStatePath);
    if (!fs.existsSync(recoveryDir)) {
      fs.mkdirSync(recoveryDir, { recursive: true });
    }

    // Start heartbeat to track application state
    this.startHeartbeat();

    // Handle process events
    process.on('SIGINT', () => this.handleGracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => this.handleGracefulShutdown('SIGTERM'));
    process.on('uncaughtException', (error) => this.handleCrash('uncaughtException', error));
    process.on('unhandledRejection', (reason) => this.handleCrash('unhandledRejection', reason));
  }

  /**
   * Start heartbeat to track application health
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.updateRecoveryState('running');
    }, 5000); // Update every 5 seconds
  }

  /**
   * Stop heartbeat
   */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
  }

  /**
   * Update recovery state
   */
  private async updateRecoveryState(state: RecoveryState['applicationState'], operation?: string): Promise<void> {
    try {
      const activeSessions = await this.sessionManager.getActiveSessions();
      
      const recoveryState: RecoveryState = {
        timestamp: new Date(),
        sessionIds: activeSessions.map(session => session.id),
        lastOperation: operation || 'heartbeat',
        applicationState: state,
        services: {
          ocr: this.serviceStatuses.get('ocr')?.isAvailable || false,
          audio: this.serviceStatuses.get('audio')?.isAvailable || false,
          chat: this.serviceStatuses.get('chat')?.isAvailable || false,
          rag: this.serviceStatuses.get('rag')?.isAvailable || false
        }
      };

      await fs.promises.writeFile(this.recoveryStatePath, JSON.stringify(recoveryState, null, 2));
    } catch (error) {
      console.error('Failed to update recovery state:', error);
    }
  }

  /**
   * Check if application crashed and attempt recovery
   */
  async checkForCrashRecovery(): Promise<boolean> {
    try {
      if (!fs.existsSync(this.recoveryStatePath)) {
        return false; // No previous state, clean start
      }

      const recoveryData = await fs.promises.readFile(this.recoveryStatePath, 'utf8');
      const recoveryState: RecoveryState = JSON.parse(recoveryData);

      // Check if last state indicates a crash
      const timeSinceLastUpdate = Date.now() - new Date(recoveryState.timestamp).getTime();
      const wasCrashed = recoveryState.applicationState === 'running' && timeSinceLastUpdate > 30000; // 30 seconds

      if (wasCrashed) {
        console.log('Crash detected, attempting recovery...');
        await this.performCrashRecovery(recoveryState);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Failed to check for crash recovery:', error);
      return false;
    }
  }

  /**
   * Perform crash recovery
   */
  private async performCrashRecovery(recoveryState: RecoveryState): Promise<void> {
    try {
      console.log(`Recovering from crash. Last operation: ${recoveryState.lastOperation}`);
      
      // Restore sessions
      if (recoveryState.sessionIds.length > 0) {
        console.log(`Restoring ${recoveryState.sessionIds.length} sessions...`);
        
        for (const sessionId of recoveryState.sessionIds) {
          try {
            await this.sessionManager.restoreSession(sessionId);
            console.log(`Restored session: ${sessionId}`);
          } catch (error) {
            console.error(`Failed to restore session ${sessionId}:`, error);
          }
        }
      }

      // Check service availability and enable degraded mode if needed
      await this.checkServiceAvailability();

      // Log recovery completion
      console.log('Crash recovery completed');
      
      // Update state to indicate successful recovery
      await this.updateRecoveryState('running', 'crash_recovery_completed');
      
    } catch (error) {
      console.error('Failed to perform crash recovery:', error);
      this.errorHandler.handleSystemError(error as Error);
    }
  }

  /**
   * Handle graceful shutdown
   */
  private async handleGracefulShutdown(signal: string): Promise<void> {
    console.log(`Received ${signal}, performing graceful shutdown...`);
    
    try {
      // Update state to indicate shutdown
      await this.updateRecoveryState('shutting_down', `graceful_shutdown_${signal}`);
      
      // Stop heartbeat
      this.stopHeartbeat();
      
      // Save all sessions
      await this.sessionManager.saveAllSessions();
      
      // Clean up recovery state file
      if (fs.existsSync(this.recoveryStatePath)) {
        fs.unlinkSync(this.recoveryStatePath);
      }
      
      console.log('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      console.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Handle application crash
   */
  private async handleCrash(type: string, error: any): Promise<void> {
    console.error(`Application crash detected (${type}):`, error);
    
    try {
      // Update state to indicate crash
      await this.updateRecoveryState('crashed', `crash_${type}`);
      
      // Log crash details
      this.errorHandler.handleSystemError(error instanceof Error ? error : new Error(String(error)));
      
      // Stop heartbeat
      this.stopHeartbeat();
      
      // Attempt to save critical data
      try {
        await this.sessionManager.saveAllSessions();
      } catch (saveError) {
        console.error('Failed to save sessions during crash:', saveError);
      }
      
    } catch (recoveryError) {
      console.error('Failed to handle crash properly:', recoveryError);
    }
    
    // Exit with error code
    process.exit(1);
  }

  /**
   * Check availability of all services
   */
  async checkServiceAvailability(): Promise<void> {
    const services = ['ocr', 'audio', 'chat', 'rag'];
    
    for (const serviceName of services) {
      const status = this.serviceStatuses.get(serviceName);
      if (!status) continue;

      try {
        const isAvailable = await this.testServiceAvailability(serviceName);
        
        if (isAvailable && !status.isAvailable) {
          // Service recovered
          console.log(`Service ${serviceName} recovered`);
          status.isAvailable = true;
          status.degradedMode = false;
          status.retryCount = 0;
          status.nextRetryTime = undefined;
        } else if (!isAvailable && status.isAvailable) {
          // Service failed
          console.log(`Service ${serviceName} failed, enabling degraded mode`);
          status.isAvailable = false;
          status.degradedMode = true;
          status.retryCount++;
          status.nextRetryTime = new Date(Date.now() + Math.pow(2, status.retryCount) * 60000); // Exponential backoff in minutes
        }
        
        this.serviceStatuses.set(serviceName, status);
      } catch (error) {
        console.error(`Failed to check service ${serviceName}:`, error);
      }
    }
  }

  /**
   * Test if a specific service is available
   */
  private async testServiceAvailability(serviceName: string): Promise<boolean> {
    switch (serviceName) {
      case 'ocr':
        // Test OCR service by checking if Tesseract is available
        return this.testOCRAvailability();
      case 'audio':
        // Test audio service by checking if recording capabilities are available
        return this.testAudioAvailability();
      case 'chat':
        // Test chat service by checking API key configuration
        return this.testChatAvailability();
      case 'rag':
        // Test RAG service by checking if vector database is accessible
        return this.testRAGAvailability();
      default:
        return false;
    }
  }

  /**
   * Test OCR service availability
   */
  private async testOCRAvailability(): Promise<boolean> {
    try {
      // Simple test - check if we can create a worker
      // In a real implementation, this would test Tesseract initialization
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test audio service availability
   */
  private async testAudioAvailability(): Promise<boolean> {
    try {
      // Test if audio recording capabilities are available
      // In a real implementation, this would test microphone access and FFmpeg
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test chat service availability
   */
  private async testChatAvailability(): Promise<boolean> {
    try {
      const config = this.configurationManager.getConfiguration();
      return !!config.apiKey && config.apiKey.trim().length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Test RAG service availability
   */
  private async testRAGAvailability(): Promise<boolean> {
    try {
      // Test if vector database is accessible
      // In a real implementation, this would test database connectivity
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service status
   */
  getServiceStatus(serviceName: string): ServiceStatus | undefined {
    return this.serviceStatuses.get(serviceName);
  }

  /**
   * Get all service statuses
   */
  getAllServiceStatuses(): ServiceStatus[] {
    return Array.from(this.serviceStatuses.values());
  }

  /**
   * Check if service is in degraded mode
   */
  isServiceDegraded(serviceName: string): boolean {
    const status = this.serviceStatuses.get(serviceName);
    return status?.degradedMode || false;
  }

  /**
   * Attempt to recover a specific service
   */
  async attemptServiceRecovery(serviceName: string): Promise<boolean> {
    const status = this.serviceStatuses.get(serviceName);
    if (!status) return false;

    // Check if it's time to retry
    if (status.nextRetryTime && new Date() < status.nextRetryTime) {
      return false;
    }

    console.log(`Attempting to recover service: ${serviceName}`);
    
    try {
      const isAvailable = await this.testServiceAvailability(serviceName);
      
      if (isAvailable) {
        status.isAvailable = true;
        status.degradedMode = false;
        status.retryCount = 0;
        status.nextRetryTime = undefined;
        this.serviceStatuses.set(serviceName, status);
        
        console.log(`Service ${serviceName} recovered successfully`);
        return true;
      } else {
        // Increase retry count and set next retry time
        status.retryCount++;
        status.nextRetryTime = new Date(Date.now() + Math.pow(2, status.retryCount) * 60000);
        this.serviceStatuses.set(serviceName, status);
        
        console.log(`Service ${serviceName} recovery failed, next retry in ${Math.pow(2, status.retryCount)} minutes`);
        return false;
      }
    } catch (error) {
      console.error(`Error during service recovery for ${serviceName}:`, error);
      return false;
    }
  }

  /**
   * Enable degraded mode for a service
   */
  enableDegradedMode(serviceName: string, error?: string): void {
    const status = this.serviceStatuses.get(serviceName);
    if (status) {
      status.isAvailable = false;
      status.degradedMode = true;
      status.lastError = error;
      this.serviceStatuses.set(serviceName, status);
      
      console.log(`Enabled degraded mode for service: ${serviceName}`);
    }
  }

  /**
   * Get degraded functionality message
   */
  getDegradedFunctionalityMessage(): string {
    const degradedServices = Array.from(this.serviceStatuses.values())
      .filter(status => status.degradedMode)
      .map(status => status.name);

    if (degradedServices.length === 0) {
      return '';
    }

    const serviceMessages = {
      ocr: 'Screenshot analysis is temporarily unavailable',
      audio: 'Audio recording and transcription is temporarily unavailable',
      chat: 'AI chat responses are temporarily unavailable',
      rag: 'Document-based assistance is temporarily unavailable'
    };

    const messages = degradedServices.map(service => serviceMessages[service as keyof typeof serviceMessages]);
    
    return `Some features are currently unavailable:\n${messages.join('\n')}\n\nThe application will continue to retry these services automatically.`;
  }

  /**
   * Initialize recovery manager
   */
  async initialize(): Promise<void> {
    console.log('Initializing Recovery Manager...');
    
    // Check for crash recovery
    const wasRecovered = await this.checkForCrashRecovery();
    
    if (!wasRecovered) {
      // Normal startup
      await this.updateRecoveryState('starting', 'normal_startup');
    }
    
    // Check initial service availability
    await this.checkServiceAvailability();
    
    // Set up periodic service checks
    setInterval(() => {
      this.checkServiceAvailability();
    }, 60000); // Check every minute
    
    console.log('Recovery Manager initialized');
  }

  /**
   * Cleanup recovery manager
   */
  async cleanup(): Promise<void> {
    console.log('Cleaning up Recovery Manager...');
    
    this.stopHeartbeat();
    
    // Clean up recovery state file
    try {
      if (fs.existsSync(this.recoveryStatePath)) {
        fs.unlinkSync(this.recoveryStatePath);
      }
    } catch (error) {
      console.error('Failed to clean up recovery state file:', error);
    }
    
    console.log('Recovery Manager cleanup completed');
  }
}