import { dialog } from 'electron';

export enum ErrorCategory {
  SYSTEM = 'system',
  NETWORK = 'network',
  PROCESSING = 'processing',
  USER = 'user'
}

export interface ErrorInfo {
  category: ErrorCategory;
  code: string;
  message: string;
  technical: string;
  retryable: boolean;
  userAction?: string;
}

export class GracefulErrorHandler {
  private errorLog: ErrorInfo[] = [];
  private maxLogSize = 100;
  private retryAttempts: Map<string, number> = new Map();
  private maxRetryAttempts = 3;

  /**
   * Handle OCR-related errors
   */
  handleOCRError(error: Error, sessionId?: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.PROCESSING,
      code: 'OCR_ERROR',
      message: 'Screenshot capture failed',
      technical: error.message,
      retryable: true,
      userAction: 'Try capturing a different window or check screen permissions'
    };

    if (error.message.includes('No suitable window')) {
      errorInfo.message = 'No suitable window found for capture';
      errorInfo.userAction = 'Make sure you have a window open to capture';
    } else if (error.message.includes('No text found')) {
      errorInfo.message = 'No text was detected in the screenshot';
      errorInfo.userAction = 'Try capturing an area with visible text';
    } else if (error.message.includes('timed out')) {
      errorInfo.message = 'Screenshot processing took too long';
      errorInfo.userAction = 'Please try again in a moment';
    } else if (error.message.includes('permission')) {
      errorInfo.category = ErrorCategory.SYSTEM;
      errorInfo.message = 'Screen recording permission required';
      errorInfo.userAction = 'Grant screen recording permission in System Preferences > Security & Privacy';
      errorInfo.retryable = false;
    }

    this.logError(errorInfo, sessionId);
    return errorInfo;
  }

  /**
   * Handle audio-related errors
   */
  handleAudioError(error: Error, sessionId?: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.PROCESSING,
      code: 'AUDIO_ERROR',
      message: 'Audio recording failed',
      technical: error.message,
      retryable: true,
      userAction: 'Check audio permissions and try again'
    };

    if (error.message.includes('FFmpeg')) {
      errorInfo.category = ErrorCategory.SYSTEM;
      errorInfo.message = 'Audio recording software not available';
      errorInfo.userAction = 'Install FFmpeg or check system audio setup';
      errorInfo.retryable = false;
    } else if (error.message.includes('BlackHole')) {
      errorInfo.category = ErrorCategory.SYSTEM;
      errorInfo.message = 'Internal audio capture requires BlackHole driver';
      errorInfo.userAction = 'Install BlackHole audio driver for internal audio capture';
      errorInfo.retryable = false;
    } else if (error.message.includes('Device or resource busy')) {
      errorInfo.message = 'Audio device is busy';
      errorInfo.userAction = 'Close other audio applications and try again';
    } else if (error.message.includes('permission')) {
      errorInfo.category = ErrorCategory.SYSTEM;
      errorInfo.message = 'Microphone permission required';
      errorInfo.userAction = 'Grant microphone permission in System Preferences > Security & Privacy';
      errorInfo.retryable = false;
    }

    this.logError(errorInfo, sessionId);
    return errorInfo;
  }

  /**
   * Handle API-related errors
   */
  handleAPIError(error: Error, sessionId?: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.NETWORK,
      code: 'API_ERROR',
      message: 'AI service error',
      technical: error.message,
      retryable: true,
      userAction: 'Check your internet connection and try again'
    };

    if (error.message.includes('401') || error.message.includes('API key')) {
      errorInfo.message = 'Invalid API key';
      errorInfo.userAction = 'Check your OpenAI API key in settings';
      errorInfo.retryable = false;
    } else if (error.message.includes('429') || error.message.includes('rate limit')) {
      errorInfo.message = 'Rate limit exceeded';
      errorInfo.userAction = 'Wait a moment and try again';
    } else if (error.message.includes('quota')) {
      errorInfo.message = 'API quota exceeded';
      errorInfo.userAction = 'Check your OpenAI account billing and usage';
      errorInfo.retryable = false;
    } else if (error.message.includes('network') || error.message.includes('fetch')) {
      errorInfo.message = 'Network connection error';
      errorInfo.userAction = 'Check your internet connection';
    } else if (error.message.includes('timeout')) {
      errorInfo.message = 'Request timed out';
      errorInfo.userAction = 'Try again with a shorter message';
    }

    this.logError(errorInfo, sessionId);
    return errorInfo;
  }

  /**
   * Handle system-level errors
   */
  handleSystemError(error: Error, sessionId?: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.SYSTEM,
      code: 'SYSTEM_ERROR',
      message: 'System error occurred',
      technical: error.message,
      retryable: false,
      userAction: 'Restart the application if the problem persists'
    };

    if (error.message.includes('ENOENT')) {
      errorInfo.message = 'Required file or resource not found';
      errorInfo.userAction = 'Reinstall the application';
    } else if (error.message.includes('EACCES')) {
      errorInfo.message = 'Permission denied';
      errorInfo.userAction = 'Check file permissions or run as administrator';
    } else if (error.message.includes('EMFILE') || error.message.includes('ENFILE')) {
      errorInfo.message = 'Too many open files';
      errorInfo.userAction = 'Close other applications and restart';
    } else if (error.message.includes('ENOSPC')) {
      errorInfo.message = 'Insufficient disk space';
      errorInfo.userAction = 'Free up disk space and try again';
    }

    this.logError(errorInfo, sessionId);
    return errorInfo;
  }

  /**
   * Handle user input errors
   */
  handleUserError(error: Error, sessionId?: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.USER,
      code: 'USER_ERROR',
      message: 'Invalid input or configuration',
      technical: error.message,
      retryable: true,
      userAction: 'Check your input and try again'
    };

    if (error.message.includes('API key')) {
      errorInfo.message = 'API key not configured';
      errorInfo.userAction = 'Add your OpenAI API key in settings';
    } else if (error.message.includes('session')) {
      errorInfo.message = 'Session not found or expired';
      errorInfo.userAction = 'Create a new session';
    } else if (error.message.includes('file')) {
      errorInfo.message = 'File access error';
      errorInfo.userAction = 'Check file permissions and try again';
    }

    this.logError(errorInfo, sessionId);
    return errorInfo;
  }

  /**
   * Show user-friendly error dialog
   */
  async showErrorDialog(errorInfo: ErrorInfo): Promise<void> {
    const options = {
      type: 'error' as const,
      title: 'Interview Assistant Error',
      message: errorInfo.message,
      detail: errorInfo.userAction || 'Please try again',
      buttons: errorInfo.retryable ? ['Retry', 'Cancel'] : ['OK']
    };

    try {
      const result = await dialog.showMessageBox(options);
      return result.response === 0 && errorInfo.retryable ? Promise.resolve() : Promise.reject();
    } catch (error) {
      console.error('Failed to show error dialog:', error);
    }
  }

  /**
   * Log error for debugging and analytics
   */
  private logError(errorInfo: ErrorInfo, sessionId?: string): void {
    const logEntry = {
      ...errorInfo,
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'unknown'
    };

    this.errorLog.push(logEntry);

    // Keep log size manageable
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }

    // Log to console for development
    console.error(`[${errorInfo.category.toUpperCase()}] ${errorInfo.code}:`, {
      message: errorInfo.message,
      technical: errorInfo.technical,
      sessionId,
      timestamp: logEntry.timestamp
    });
  }

  /**
   * Get error statistics
   */
  getErrorStats(): any {
    const stats = {
      total: this.errorLog.length,
      byCategory: {} as Record<string, number>,
      byCode: {} as Record<string, number>,
      recent: this.errorLog.slice(-10)
    };

    for (const error of this.errorLog) {
      stats.byCategory[error.category] = (stats.byCategory[error.category] || 0) + 1;
      stats.byCode[error.code] = (stats.byCode[error.code] || 0) + 1;
    }

    return stats;
  }

  /**
   * Clear error log
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * Export error log for debugging
   */
  exportErrorLog(): string {
    return JSON.stringify(this.errorLog, null, 2);
  }

  /**
   * Handle error with automatic retry logic
   */
  async handleErrorWithRetry<T>(
    operation: () => Promise<T>,
    errorHandler: (error: Error, sessionId?: string) => ErrorInfo,
    sessionId?: string,
    operationId?: string
  ): Promise<T> {
    const id = operationId || `${Date.now()}-${Math.random()}`;
    const currentAttempts = this.retryAttempts.get(id) || 0;

    try {
      const result = await operation();
      // Clear retry count on success
      this.retryAttempts.delete(id);
      return result;
    } catch (error) {
      const errorInfo = errorHandler(error as Error, sessionId);
      
      if (errorInfo.retryable && currentAttempts < this.maxRetryAttempts) {
        this.retryAttempts.set(id, currentAttempts + 1);
        
        // Exponential backoff: wait 1s, 2s, 4s
        const delay = Math.pow(2, currentAttempts) * 1000;
        await new Promise(resolve => setTimeout(resolve, delay));
        
        console.log(`Retrying operation ${id}, attempt ${currentAttempts + 1}/${this.maxRetryAttempts}`);
        return this.handleErrorWithRetry(operation, errorHandler, sessionId, id);
      } else {
        // Max retries reached or not retryable
        this.retryAttempts.delete(id);
        throw error;
      }
    }
  }

  /**
   * Categorize error automatically based on error type and message
   */
  categorizeError(error: Error): ErrorInfo {
    // Network errors
    if (error.message.includes('fetch') || 
        error.message.includes('network') || 
        error.message.includes('timeout') ||
        error.message.includes('ENOTFOUND') ||
        error.message.includes('ECONNREFUSED')) {
      return this.handleAPIError(error);
    }

    // System errors
    if (error.message.includes('ENOENT') ||
        error.message.includes('EACCES') ||
        error.message.includes('EMFILE') ||
        error.message.includes('ENOSPC') ||
        error.message.includes('permission')) {
      return this.handleSystemError(error);
    }

    // Processing errors
    if (error.message.includes('OCR') ||
        error.message.includes('screenshot') ||
        error.message.includes('audio') ||
        error.message.includes('transcription')) {
      if (error.message.includes('audio') || error.message.includes('transcription')) {
        return this.handleAudioError(error);
      } else {
        return this.handleOCRError(error);
      }
    }

    // User errors
    if (error.message.includes('API key') ||
        error.message.includes('configuration') ||
        error.message.includes('session') ||
        error.message.includes('invalid input')) {
      return this.handleUserError(error);
    }

    // Default to system error
    return this.handleSystemError(error);
  }

  /**
   * Handle RAG-related errors
   */
  handleRAGError(error: Error, sessionId?: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.PROCESSING,
      code: 'RAG_ERROR',
      message: 'Document processing failed',
      technical: error.message,
      retryable: true,
      userAction: 'Try with different documents or check file permissions'
    };

    if (error.message.includes('does not exist')) {
      errorInfo.message = 'Selected folder or file not found';
      errorInfo.userAction = 'Check that the selected folder exists and try again';
    } else if (error.message.includes('permission')) {
      errorInfo.category = ErrorCategory.SYSTEM;
      errorInfo.message = 'Permission denied accessing documents';
      errorInfo.userAction = 'Check folder permissions and try again';
      errorInfo.retryable = false;
    } else if (error.message.includes('unsupported')) {
      errorInfo.message = 'Unsupported file format';
      errorInfo.userAction = 'Use supported formats: .txt, .md, .pdf, .pptx';
      errorInfo.retryable = false;
    } else if (error.message.includes('too large')) {
      errorInfo.message = 'Document too large to process';
      errorInfo.userAction = 'Try with smaller documents or split large files';
      errorInfo.retryable = false;
    }

    this.logError(errorInfo, sessionId);
    return errorInfo;
  }

  /**
   * Handle configuration-related errors
   */
  handleConfigError(error: Error, sessionId?: string): ErrorInfo {
    const errorInfo: ErrorInfo = {
      category: ErrorCategory.USER,
      code: 'CONFIG_ERROR',
      message: 'Configuration error',
      technical: error.message,
      retryable: true,
      userAction: 'Check your settings and try again'
    };

    if (error.message.includes('API key')) {
      errorInfo.message = 'API key configuration error';
      errorInfo.userAction = 'Verify your OpenAI API key in settings';
    } else if (error.message.includes('prompt')) {
      errorInfo.message = 'Prompt template error';
      errorInfo.userAction = 'Check your prompt templates in settings';
    } else if (error.message.includes('encryption')) {
      errorInfo.category = ErrorCategory.SYSTEM;
      errorInfo.message = 'Data encryption error';
      errorInfo.userAction = 'Restart the application or reset settings';
      errorInfo.retryable = false;
    }

    this.logError(errorInfo, sessionId);
    return errorInfo;
  }

  /**
   * Show notification-style error (less intrusive than dialog)
   */
  showErrorNotification(errorInfo: ErrorInfo): void {
    // This would integrate with the UI notification system
    console.warn(`[NOTIFICATION] ${errorInfo.message}: ${errorInfo.userAction}`);
    
    // In a real implementation, this would send to the renderer process
    // to show a toast notification or status bar message
  }

  /**
   * Check if error should be shown to user or just logged
   */
  shouldShowToUser(errorInfo: ErrorInfo): boolean {
    // Don't show repeated errors within a short time
    const recentSimilar = this.errorLog
      .filter(log => log.code === errorInfo.code)
      .filter(log => {
        const logTime = new Date(log.timestamp).getTime();
        const now = Date.now();
        return (now - logTime) < 30000; // 30 seconds
      });

    return recentSimilar.length <= 1;
  }

  /**
   * Get user-friendly error summary
   */
  getErrorSummary(): string {
    if (this.errorLog.length === 0) {
      return 'No recent errors';
    }

    const recent = this.errorLog.slice(-5);
    const summary = recent.map(error => 
      `${error.category}: ${error.message}`
    ).join('\n');

    return `Recent errors:\n${summary}`;
  }

  /**
   * Reset retry attempts for a specific operation
   */
  resetRetryAttempts(operationId: string): void {
    this.retryAttempts.delete(operationId);
  }

  /**
   * Get current retry count for an operation
   */
  getRetryCount(operationId: string): number {
    return this.retryAttempts.get(operationId) || 0;
  }
}