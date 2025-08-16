/**
 * Error Boundary Pattern Implementation
 * 
 * This class provides comprehensive error handling and recovery mechanisms
 * throughout the application to prevent crashes and improve reliability.
 */

import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

export interface ErrorContext {
  component: string;
  operation: string;
  sessionId?: string;
  userId?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ErrorReport {
  id: string;
  error: Error;
  context: ErrorContext;
  stack?: string;
  severity: ErrorSeverity;
  handled: boolean;
  retryCount: number;
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface ErrorBoundaryConfig {
  maxRetries?: number;
  retryDelay?: number;
  logToFile?: boolean;
  logFilePath?: string;
  enableConsoleOutput?: boolean;
  enableRecovery?: boolean;
  onError?: (report: ErrorReport) => void;
  onRecovery?: (report: ErrorReport) => void;
}

export interface RetryOptions {
  maxRetries?: number;
  delay?: number;
  exponentialBackoff?: boolean;
  condition?: (error: Error, attempt: number) => boolean;
}

export class ErrorBoundary {
  private static instance: ErrorBoundary;
  private config: Required<ErrorBoundaryConfig>;
  private errorReports = new Map<string, ErrorReport>();
  private retryCounters = new Map<string, number>();

  constructor(config: ErrorBoundaryConfig = {}) {
    const defaultLogPath = app ? path.join(app.getPath('userData'), 'logs', 'errors.log') : './errors.log';
    
    this.config = {
      maxRetries: 3,
      retryDelay: 1000,
      logToFile: true,
      logFilePath: defaultLogPath,
      enableConsoleOutput: true,
      enableRecovery: true,
      onError: () => {},
      onRecovery: () => {},
      ...config
    } as Required<ErrorBoundaryConfig>;

    this.ensureLogDirectory();
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: ErrorBoundaryConfig): ErrorBoundary {
    if (!ErrorBoundary.instance) {
      ErrorBoundary.instance = new ErrorBoundary(config);
    }
    return ErrorBoundary.instance;
  }

  /**
   * Wrap a function with error boundary protection
   */
  wrap<T extends (...args: any[]) => any>(
    fn: T, 
    context: Partial<ErrorContext>,
    options: RetryOptions = {}
  ): T {
    return ((...args: any[]) => {
      return this.executeWithBoundary(
        () => fn(...args),
        { component: 'unknown', operation: 'unknown', ...context },
        options
      );
    }) as T;
  }

  /**
   * Wrap an async function with error boundary protection
   */
  wrapAsync<T extends (...args: any[]) => Promise<any>>(
    fn: T, 
    context: Partial<ErrorContext>,
    options: RetryOptions = {}
  ): T {
    return ((...args: any[]) => {
      return this.executeWithBoundaryAsync(
        () => fn(...args),
        { component: 'unknown', operation: 'unknown', ...context },
        options
      );
    }) as T;
  }

  /**
   * Execute function with error boundary protection
   */
  executeWithBoundary<T>(
    fn: () => T,
    context: Partial<ErrorContext>,
    options: RetryOptions = {}
  ): T {
    const fullContext: ErrorContext = {
      component: 'unknown',
      operation: 'unknown',
      timestamp: new Date(),
      ...context
    };

    try {
      return fn();
    } catch (error) {
      return this.handleError(error as Error, fullContext, options, fn);
    }
  }

  /**
   * Execute async function with error boundary protection
   */
  async executeWithBoundaryAsync<T>(
    fn: () => Promise<T>,
    context: Partial<ErrorContext>,
    options: RetryOptions = {}
  ): Promise<T> {
    const fullContext: ErrorContext = {
      component: 'unknown',
      operation: 'unknown',
      timestamp: new Date(),
      ...context
    };

    try {
      return await fn();
    } catch (error) {
      return await this.handleErrorAsync(error as Error, fullContext, options, fn);
    }
  }

  /**
   * Handle errors with recovery and retry logic
   */
  private handleError<T>(
    error: Error,
    context: ErrorContext,
    options: RetryOptions,
    originalFn: () => T
  ): T {
    const report = this.createErrorReport(error, context);
    const maxRetries = options.maxRetries ?? this.config.maxRetries;
    const retryKey = this.getRetryKey(context);

    // Log the error
    this.logError(report);

    // Check if we should retry
    if (report.retryCount < maxRetries && this.shouldRetry(error, report.retryCount, options)) {
      this.incrementRetryCounter(retryKey);
      
      // Apply delay if specified
      const delay = this.calculateDelay(report.retryCount, options);
      if (delay > 0) {
        // For synchronous functions, we can't really wait, so we log and rethrow
        this.log(`⏳ [ERROR_BOUNDARY] Would retry after ${delay}ms, but cannot wait in sync function`);
      }

      this.log(`🔄 [ERROR_BOUNDARY] Retrying ${context.component}.${context.operation} (attempt ${report.retryCount + 1})`);
      
      try {
        const result = originalFn();
        this.onRecoverySuccess(report);
        return result;
      } catch (retryError) {
        return this.handleError(retryError as Error, context, options, originalFn);
      }
    }

    // No more retries, determine final action
    return this.handleFinalError(error, report);
  }

  /**
   * Handle async errors with recovery and retry logic
   */
  private async handleErrorAsync<T>(
    error: Error,
    context: ErrorContext,
    options: RetryOptions,
    originalFn: () => Promise<T>
  ): Promise<T> {
    const report = this.createErrorReport(error, context);
    const maxRetries = options.maxRetries ?? this.config.maxRetries;
    const retryKey = this.getRetryKey(context);

    // Log the error
    this.logError(report);

    // Check if we should retry
    if (report.retryCount < maxRetries && this.shouldRetry(error, report.retryCount, options)) {
      this.incrementRetryCounter(retryKey);
      
      // Apply delay if specified
      const delay = this.calculateDelay(report.retryCount, options);
      if (delay > 0) {
        this.log(`⏳ [ERROR_BOUNDARY] Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }

      this.log(`🔄 [ERROR_BOUNDARY] Retrying ${context.component}.${context.operation} (attempt ${report.retryCount + 1})`);
      
      try {
        const result = await originalFn();
        this.onRecoverySuccess(report);
        return result;
      } catch (retryError) {
        return await this.handleErrorAsync(retryError as Error, context, options, originalFn);
      }
    }

    // No more retries, determine final action
    return this.handleFinalError(error, report);
  }

  /**
   * Create an error report
   */
  private createErrorReport(error: Error, context: ErrorContext): ErrorReport {
    const retryKey = this.getRetryKey(context);
    const retryCount = this.retryCounters.get(retryKey) || 0;
    
    const report: ErrorReport = {
      id: this.generateErrorId(),
      error,
      context,
      stack: error.stack,
      severity: this.determineSeverity(error, context),
      handled: false,
      retryCount
    };

    this.errorReports.set(report.id, report);
    return report;
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error, context: ErrorContext): ErrorSeverity {
    // Check for critical system errors
    if (error.name === 'ENOSPC' || error.message.includes('out of memory')) {
      return ErrorSeverity.CRITICAL;
    }

    // Check for high severity errors
    if (error.name === 'TypeError' || error.name === 'ReferenceError') {
      return ErrorSeverity.HIGH;
    }

    // Check component context for severity hints
    if (context.component.includes('critical') || context.component.includes('core')) {
      return ErrorSeverity.HIGH;
    }

    // Network and IO errors are usually medium
    if (error.name === 'ENOTFOUND' || error.name === 'ECONNREFUSED' || error.message.includes('network')) {
      return ErrorSeverity.MEDIUM;
    }

    return ErrorSeverity.LOW;
  }

  /**
   * Check if error should be retried
   */
  private shouldRetry(error: Error, attempt: number, options: RetryOptions): boolean {
    // Check custom condition first
    if (options.condition && !options.condition(error, attempt)) {
      return false;
    }

    // Don't retry syntax errors or type errors
    if (error.name === 'SyntaxError' || error.name === 'TypeError') {
      return false;
    }

    // Retry network and IO errors
    if (error.name === 'ENOTFOUND' || error.name === 'ECONNREFUSED' || 
        error.message.includes('network') || error.message.includes('timeout')) {
      return true;
    }

    // Retry file system errors (except permission errors)
    if (error.name === 'ENOENT' || error.name === 'EBUSY') {
      return true;
    }

    return false;
  }

  /**
   * Calculate retry delay
   */
  private calculateDelay(attempt: number, options: RetryOptions): number {
    const baseDelay = options.delay ?? this.config.retryDelay;
    
    if (options.exponentialBackoff) {
      return baseDelay * Math.pow(2, attempt);
    }
    
    return baseDelay;
  }

  /**
   * Handle final error when no more retries
   */
  private handleFinalError<T>(error: Error, report: ErrorReport): T {
    report.handled = true;
    this.config.onError(report);

    // Depending on severity, either throw or return a safe fallback
    switch (report.severity) {
      case ErrorSeverity.CRITICAL:
        this.log(`💥 [ERROR_BOUNDARY] Critical error in ${report.context.component}.${report.context.operation}`);
        throw error;
      
      case ErrorSeverity.HIGH:
        this.log(`🚨 [ERROR_BOUNDARY] High severity error in ${report.context.component}.${report.context.operation}`);
        throw error;
      
      case ErrorSeverity.MEDIUM:
        this.log(`⚠️ [ERROR_BOUNDARY] Medium severity error in ${report.context.component}.${report.context.operation}`);
        return this.getFallbackValue(report) as T;
      
      case ErrorSeverity.LOW:
        this.log(`ℹ️ [ERROR_BOUNDARY] Low severity error in ${report.context.component}.${report.context.operation}`);
        return this.getFallbackValue(report) as T;
      
      default:
        throw error;
    }
  }

  /**
   * Get fallback value for recoverable errors
   */
  private getFallbackValue(report: ErrorReport): any {
    // Return appropriate fallback based on operation
    if (report.context.operation.includes('get') || report.context.operation.includes('read')) {
      return null;
    }
    
    if (report.context.operation.includes('list') || report.context.operation.includes('search')) {
      return [];
    }
    
    if (report.context.operation.includes('count') || report.context.operation.includes('size')) {
      return 0;
    }
    
    if (report.context.operation.includes('exists') || report.context.operation.includes('check')) {
      return false;
    }
    
    return null;
  }

  /**
   * Handle successful recovery
   */
  private onRecoverySuccess(report: ErrorReport): void {
    this.log(`✅ [ERROR_BOUNDARY] Recovered from error in ${report.context.component}.${report.context.operation}`);
    const retryKey = this.getRetryKey(report.context);
    this.retryCounters.delete(retryKey);
    this.config.onRecovery(report);
  }

  /**
   * Log error to file and console
   */
  private logError(report: ErrorReport): void {
    const logMessage = this.formatErrorMessage(report);
    
    if (this.config.enableConsoleOutput) {
      console.error(logMessage);
    }
    
    if (this.config.logToFile) {
      this.writeToLogFile(logMessage);
    }
  }

  /**
   * Format error message
   */
  private formatErrorMessage(report: ErrorReport): string {
    return [
      `[${report.context.timestamp.toISOString()}] ERROR BOUNDARY`,
      `ID: ${report.id}`,
      `Severity: ${report.severity.toUpperCase()}`,
      `Component: ${report.context.component}`,
      `Operation: ${report.context.operation}`,
      `Message: ${report.error.message}`,
      `Retry: ${report.retryCount}`,
      report.context.sessionId ? `Session: ${report.context.sessionId}` : '',
      report.stack ? `Stack: ${report.stack}` : '',
      report.context.metadata ? `Metadata: ${JSON.stringify(report.context.metadata)}` : '',
      '---'
    ].filter(Boolean).join('\n');
  }

  /**
   * Write to log file
   */
  private writeToLogFile(message: string): void {
    try {
      fs.appendFileSync(this.config.logFilePath, message + '\n');
    } catch (error) {
      console.error('[ERROR_BOUNDARY] Failed to write to log file:', error);
    }
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    try {
      const logDir = path.dirname(this.config.logFilePath);
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
    } catch (error) {
      console.error('[ERROR_BOUNDARY] Failed to create log directory:', error);
    }
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get retry key for tracking retry attempts
   */
  private getRetryKey(context: ErrorContext): string {
    return `${context.component}.${context.operation}${context.sessionId ? `.${context.sessionId}` : ''}`;
  }

  /**
   * Increment retry counter
   */
  private incrementRetryCounter(key: string): void {
    const current = this.retryCounters.get(key) || 0;
    this.retryCounters.set(key, current + 1);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Log message with configuration respect
   */
  private log(message: string): void {
    if (this.config.enableConsoleOutput) {
      console.log(message);
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    totalErrors: number;
    errorsBySeverity: Record<ErrorSeverity, number>;
    errorsByComponent: Record<string, number>;
    recentErrors: ErrorReport[];
  } {
    const reports = Array.from(this.errorReports.values());
    
    const errorsBySeverity: Record<ErrorSeverity, number> = {
      [ErrorSeverity.LOW]: 0,
      [ErrorSeverity.MEDIUM]: 0,
      [ErrorSeverity.HIGH]: 0,
      [ErrorSeverity.CRITICAL]: 0
    };
    
    const errorsByComponent: Record<string, number> = {};
    
    reports.forEach(report => {
      errorsBySeverity[report.severity]++;
      errorsByComponent[report.context.component] = (errorsByComponent[report.context.component] || 0) + 1;
    });
    
    const recentErrors = reports
      .sort((a, b) => b.context.timestamp.getTime() - a.context.timestamp.getTime())
      .slice(0, 10);
    
    return {
      totalErrors: reports.length,
      errorsBySeverity,
      errorsByComponent,
      recentErrors
    };
  }

  /**
   * Clear error history (for testing)
   */
  clearErrors(): void {
    this.errorReports.clear();
    this.retryCounters.clear();
  }
}
