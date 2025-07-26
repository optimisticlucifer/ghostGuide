import { GracefulErrorHandler, ErrorCategory, ErrorInfo } from '../../src/services/ErrorHandler';
import { dialog } from 'electron';

// Mock electron dialog
jest.mock('electron');

describe('GracefulErrorHandler', () => {
  let errorHandler: GracefulErrorHandler;
  let mockDialog: jest.Mocked<typeof dialog>;

  beforeEach(() => {
    errorHandler = new GracefulErrorHandler();
    mockDialog = dialog as jest.Mocked<typeof dialog>;
    jest.clearAllMocks();
  });

  describe('handleOCRError', () => {
    it('should handle generic OCR error', () => {
      const error = new Error('OCR processing failed');
      const result = errorHandler.handleOCRError(error, 'session-1');

      expect(result).toMatchObject({
        category: ErrorCategory.PROCESSING,
        code: 'OCR_ERROR',
        message: 'Screenshot capture failed',
        technical: 'OCR processing failed',
        retryable: true,
        userAction: 'Try capturing a different window or check screen permissions'
      });
    });

    it('should handle no suitable window error', () => {
      const error = new Error('No suitable window found');
      const result = errorHandler.handleOCRError(error);

      expect(result.message).toBe('No suitable window found for capture');
      expect(result.userAction).toBe('Make sure you have a window open to capture');
    });

    it('should handle no text found error', () => {
      const error = new Error('No text found in image');
      const result = errorHandler.handleOCRError(error);

      expect(result.message).toBe('No text was detected in the screenshot');
      expect(result.userAction).toBe('Try capturing an area with visible text');
    });

    it('should handle timeout error', () => {
      const error = new Error('Operation timed out');
      const result = errorHandler.handleOCRError(error);

      expect(result.message).toBe('Screenshot processing took too long');
      expect(result.userAction).toBe('Please try again in a moment');
    });

    it('should handle permission error', () => {
      const error = new Error('Screen recording permission denied');
      const result = errorHandler.handleOCRError(error);

      expect(result.category).toBe(ErrorCategory.SYSTEM);
      expect(result.message).toBe('Screen recording permission required');
      expect(result.retryable).toBe(false);
    });
  });

  describe('handleAudioError', () => {
    it('should handle generic audio error', () => {
      const error = new Error('Audio capture failed');
      const result = errorHandler.handleAudioError(error, 'session-1');

      expect(result).toMatchObject({
        category: ErrorCategory.PROCESSING,
        code: 'AUDIO_ERROR',
        message: 'Audio recording failed',
        technical: 'Audio capture failed',
        retryable: true,
        userAction: 'Check audio permissions and try again'
      });
    });

    it('should handle FFmpeg error', () => {
      const error = new Error('FFmpeg not found');
      const result = errorHandler.handleAudioError(error);

      expect(result.category).toBe(ErrorCategory.SYSTEM);
      expect(result.message).toBe('Audio recording software not available');
      expect(result.retryable).toBe(false);
    });

    it('should handle BlackHole error', () => {
      const error = new Error('BlackHole driver not installed');
      const result = errorHandler.handleAudioError(error);

      expect(result.message).toBe('Internal audio capture requires BlackHole driver');
      expect(result.retryable).toBe(false);
    });

    it('should handle device busy error', () => {
      const error = new Error('Device or resource busy');
      const result = errorHandler.handleAudioError(error);

      expect(result.message).toBe('Audio device is busy');
      expect(result.userAction).toBe('Close other audio applications and try again');
    });
  });

  describe('handleAPIError', () => {
    it('should handle generic API error', () => {
      const error = new Error('API request failed');
      const result = errorHandler.handleAPIError(error, 'session-1');

      expect(result).toMatchObject({
        category: ErrorCategory.NETWORK,
        code: 'API_ERROR',
        message: 'AI service error',
        technical: 'API request failed',
        retryable: true,
        userAction: 'Check your internet connection and try again'
      });
    });

    it('should handle 401 API key error', () => {
      const error = new Error('401 Unauthorized - Invalid API key');
      const result = errorHandler.handleAPIError(error);

      expect(result.message).toBe('Invalid API key');
      expect(result.userAction).toBe('Check your OpenAI API key in settings');
      expect(result.retryable).toBe(false);
    });

    it('should handle rate limit error', () => {
      const error = new Error('429 Too Many Requests - rate limit exceeded');
      const result = errorHandler.handleAPIError(error);

      expect(result.message).toBe('Rate limit exceeded');
      expect(result.userAction).toBe('Wait a moment and try again');
      expect(result.retryable).toBe(true);
    });

    it('should handle quota exceeded error', () => {
      const error = new Error('API quota exceeded');
      const result = errorHandler.handleAPIError(error);

      expect(result.message).toBe('API quota exceeded');
      expect(result.retryable).toBe(false);
    });

    it('should handle network error', () => {
      const error = new Error('Network connection failed');
      const result = errorHandler.handleAPIError(error);

      expect(result.message).toBe('Network connection error');
      expect(result.userAction).toBe('Check your internet connection');
    });
  });

  describe('handleSystemError', () => {
    it('should handle generic system error', () => {
      const error = new Error('System failure');
      const result = errorHandler.handleSystemError(error);

      expect(result).toMatchObject({
        category: ErrorCategory.SYSTEM,
        code: 'SYSTEM_ERROR',
        message: 'System error occurred',
        retryable: false,
        userAction: 'Restart the application if the problem persists'
      });
    });

    it('should handle file not found error', () => {
      const error = new Error('ENOENT: no such file or directory');
      const result = errorHandler.handleSystemError(error);

      expect(result.message).toBe('Required file or resource not found');
      expect(result.userAction).toBe('Reinstall the application');
    });

    it('should handle permission denied error', () => {
      const error = new Error('EACCES: permission denied');
      const result = errorHandler.handleSystemError(error);

      expect(result.message).toBe('Permission denied');
      expect(result.userAction).toBe('Check file permissions or run as administrator');
    });

    it('should handle too many files error', () => {
      const error = new Error('EMFILE: too many open files');
      const result = errorHandler.handleSystemError(error);

      expect(result.message).toBe('Too many open files');
      expect(result.userAction).toBe('Close other applications and restart');
    });

    it('should handle no space error', () => {
      const error = new Error('ENOSPC: no space left on device');
      const result = errorHandler.handleSystemError(error);

      expect(result.message).toBe('Insufficient disk space');
      expect(result.userAction).toBe('Free up disk space and try again');
    });
  });

  describe('handleUserError', () => {
    it('should handle generic user error', () => {
      const error = new Error('Invalid user input');
      const result = errorHandler.handleUserError(error);

      expect(result).toMatchObject({
        category: ErrorCategory.USER,
        code: 'USER_ERROR',
        message: 'Invalid input or configuration',
        retryable: true,
        userAction: 'Check your input and try again'
      });
    });

    it('should handle API key configuration error', () => {
      const error = new Error('API key not configured');
      const result = errorHandler.handleUserError(error);

      expect(result.message).toBe('API key not configured');
      expect(result.userAction).toBe('Add your OpenAI API key in settings');
    });

    it('should handle session error', () => {
      const error = new Error('Session not found');
      const result = errorHandler.handleUserError(error);

      expect(result.message).toBe('Session not found or expired');
      expect(result.userAction).toBe('Create a new session');
    });
  });

  describe('showErrorDialog', () => {
    it('should show error dialog with retry option for retryable errors', async () => {
      const errorInfo: ErrorInfo = {
        category: ErrorCategory.PROCESSING,
        code: 'TEST_ERROR',
        message: 'Test error message',
        technical: 'Technical details',
        retryable: true,
        userAction: 'Try again'
      };

      mockDialog.showMessageBox.mockResolvedValue({ response: 0 });

      await errorHandler.showErrorDialog(errorInfo);

      expect(mockDialog.showMessageBox).toHaveBeenCalledWith({
        type: 'error',
        title: 'Interview Assistant Error',
        message: 'Test error message',
        detail: 'Try again',
        buttons: ['Retry', 'Cancel']
      });
    });

    it('should show error dialog with OK button for non-retryable errors', async () => {
      const errorInfo: ErrorInfo = {
        category: ErrorCategory.SYSTEM,
        code: 'TEST_ERROR',
        message: 'Test error message',
        technical: 'Technical details',
        retryable: false,
        userAction: 'Contact support'
      };

      mockDialog.showMessageBox.mockResolvedValue({ response: 0 });

      await errorHandler.showErrorDialog(errorInfo);

      expect(mockDialog.showMessageBox).toHaveBeenCalledWith({
        type: 'error',
        title: 'Interview Assistant Error',
        message: 'Test error message',
        detail: 'Contact support',
        buttons: ['OK']
      });
    });

    it('should handle dialog errors gracefully', async () => {
      const errorInfo: ErrorInfo = {
        category: ErrorCategory.PROCESSING,
        code: 'TEST_ERROR',
        message: 'Test error message',
        technical: 'Technical details',
        retryable: true
      };

      mockDialog.showMessageBox.mockRejectedValue(new Error('Dialog failed'));

      await expect(errorHandler.showErrorDialog(errorInfo)).resolves.not.toThrow();
    });
  });

  describe('error logging', () => {
    it('should log errors with session information', () => {
      const error = new Error('Test error');
      errorHandler.handleOCRError(error, 'session-123');

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(1);
      expect(stats.byCategory[ErrorCategory.PROCESSING]).toBe(1);
      expect(stats.byCode['OCR_ERROR']).toBe(1);
    });

    it('should maintain error log size limit', () => {
      // Generate more errors than the max log size (100)
      for (let i = 0; i < 150; i++) {
        const error = new Error(`Test error ${i}`);
        errorHandler.handleOCRError(error);
      }

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(100); // Should be capped at max size
    });

    it('should provide error statistics', () => {
      const error1 = new Error('OCR error');
      const error2 = new Error('Audio error');
      const error3 = new Error('Another OCR error');

      errorHandler.handleOCRError(error1);
      errorHandler.handleAudioError(error2);
      errorHandler.handleOCRError(error3);

      const stats = errorHandler.getErrorStats();
      expect(stats.total).toBe(3);
      expect(stats.byCategory[ErrorCategory.PROCESSING]).toBe(3);
      expect(stats.byCode['OCR_ERROR']).toBe(2);
      expect(stats.byCode['AUDIO_ERROR']).toBe(1);
    });
  });

  describe('error categorization', () => {
    it('should categorize network errors correctly', () => {
      const error = new Error('fetch failed');
      const result = errorHandler.categorizeError(error);

      expect(result.category).toBe(ErrorCategory.NETWORK);
    });

    it('should categorize system errors correctly', () => {
      const error = new Error('ENOENT: file not found');
      const result = errorHandler.categorizeError(error);

      expect(result.category).toBe(ErrorCategory.SYSTEM);
    });

    it('should categorize OCR processing errors correctly', () => {
      const error = new Error('OCR processing failed');
      const result = errorHandler.categorizeError(error);

      expect(result.category).toBe(ErrorCategory.PROCESSING);
      expect(result.code).toBe('OCR_ERROR');
    });

    it('should categorize audio processing errors correctly', () => {
      const error = new Error('audio transcription failed');
      const result = errorHandler.categorizeError(error);

      expect(result.category).toBe(ErrorCategory.PROCESSING);
      expect(result.code).toBe('AUDIO_ERROR');
    });

    it('should categorize user errors correctly', () => {
      const error = new Error('API key not configured');
      const result = errorHandler.categorizeError(error);

      expect(result.category).toBe(ErrorCategory.USER);
    });

    it('should default to system error for unknown errors', () => {
      const error = new Error('Unknown error type');
      const result = errorHandler.categorizeError(error);

      expect(result.category).toBe(ErrorCategory.SYSTEM);
    });
  });

  describe('retry mechanisms', () => {
    it('should handle error with retry successfully', async () => {
      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Temporary failure');
        }
        return Promise.resolve('success');
      });

      const result = await errorHandler.handleErrorWithRetry(
        operation,
        (error) => errorHandler.handleAPIError(error),
        'session-1',
        'test-operation'
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max retry attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(errorHandler.handleErrorWithRetry(
        operation,
        (error) => errorHandler.handleAPIError(error),
        'session-1',
        'test-operation'
      )).rejects.toThrow('Persistent failure');

      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('401 Unauthorized'));

      await expect(errorHandler.handleErrorWithRetry(
        operation,
        (error) => errorHandler.handleAPIError(error),
        'session-1',
        'test-operation'
      )).rejects.toThrow('401 Unauthorized');

      expect(operation).toHaveBeenCalledTimes(1); // No retries for non-retryable errors
    });

    it('should clear retry count on success', async () => {
      const operation = jest.fn().mockResolvedValue('success');

      await errorHandler.handleErrorWithRetry(
        operation,
        (error) => errorHandler.handleAPIError(error),
        'session-1',
        'test-operation'
      );

      expect(errorHandler.getRetryCount('test-operation')).toBe(0);
    });

    it('should reset retry attempts for operation', () => {
      // Simulate some retry attempts
      (errorHandler as any).retryAttempts.set('test-op', 2);

      errorHandler.resetRetryAttempts('test-op');

      expect(errorHandler.getRetryCount('test-op')).toBe(0);
    });
  });

  describe('additional error handlers', () => {
    it('should handle RAG errors', () => {
      const error = new Error('Document processing failed');
      const result = errorHandler.handleRAGError(error, 'session-1');

      expect(result).toMatchObject({
        category: ErrorCategory.PROCESSING,
        code: 'RAG_ERROR',
        message: 'Document processing failed',
        retryable: true
      });
    });

    it('should handle RAG permission errors', () => {
      const error = new Error('Permission denied accessing documents');
      const result = errorHandler.handleRAGError(error);

      expect(result.category).toBe(ErrorCategory.SYSTEM);
      expect(result.message).toBe('Permission denied accessing documents');
      expect(result.retryable).toBe(false);
    });

    it('should handle configuration errors', () => {
      const error = new Error('API key configuration error');
      const result = errorHandler.handleConfigError(error, 'session-1');

      expect(result).toMatchObject({
        category: ErrorCategory.USER,
        code: 'CONFIG_ERROR',
        message: 'API key configuration error',
        retryable: true
      });
    });

    it('should handle encryption configuration errors', () => {
      const error = new Error('Data encryption error');
      const result = errorHandler.handleConfigError(error);

      expect(result.category).toBe(ErrorCategory.SYSTEM);
      expect(result.message).toBe('Data encryption error');
      expect(result.retryable).toBe(false);
    });
  });

  describe('error notification and filtering', () => {
    it('should show error notification', () => {
      const errorInfo: ErrorInfo = {
        category: ErrorCategory.PROCESSING,
        code: 'TEST_ERROR',
        message: 'Test notification',
        technical: 'Technical details',
        retryable: true,
        userAction: 'Try again'
      };

      // Should not throw
      expect(() => errorHandler.showErrorNotification(errorInfo)).not.toThrow();
    });

    it('should determine if error should be shown to user', () => {
      const error = new Error('Test error');
      
      // First occurrence should be shown
      errorHandler.handleOCRError(error);
      const errorInfo = errorHandler.handleOCRError(error);
      expect(errorHandler.shouldShowToUser(errorInfo)).toBe(true);

      // Rapid repeated errors should not be shown
      for (let i = 0; i < 5; i++) {
        errorHandler.handleOCRError(error);
      }
      const repeatedErrorInfo = errorHandler.handleOCRError(error);
      expect(errorHandler.shouldShowToUser(repeatedErrorInfo)).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should clear error log', () => {
      const error = new Error('Test error');
      errorHandler.handleOCRError(error);

      expect(errorHandler.getErrorStats().total).toBe(1);

      errorHandler.clearErrorLog();
      expect(errorHandler.getErrorStats().total).toBe(0);
    });

    it('should export error log as JSON', () => {
      const error = new Error('Test error');
      errorHandler.handleOCRError(error, 'session-1');

      const exported = errorHandler.exportErrorLog();
      const parsed = JSON.parse(exported);

      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        category: ErrorCategory.PROCESSING,
        code: 'OCR_ERROR',
        sessionId: 'session-1'
      });
    });

    it('should provide error summary', () => {
      const error1 = new Error('OCR error');
      const error2 = new Error('Audio error');

      errorHandler.handleOCRError(error1);
      errorHandler.handleAudioError(error2);

      const summary = errorHandler.getErrorSummary();
      expect(summary).toContain('Recent errors:');
      expect(summary).toContain('processing: Screenshot capture failed');
      expect(summary).toContain('processing: Audio recording failed');
    });

    it('should return no errors message when log is empty', () => {
      const summary = errorHandler.getErrorSummary();
      expect(summary).toBe('No recent errors');
    });
  });

  describe('retry mechanisms', () => {
    it('should retry operation with exponential backoff', async () => {
      let attemptCount = 0;
      const operation = jest.fn().mockImplementation(() => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error('Operation failed');
        }
        return Promise.resolve('success');
      });

      const errorHandlerFn = jest.fn().mockImplementation((error) => 
        errorHandler.handleOCRError(error)
      );

      const result = await errorHandler.handleErrorWithRetry(
        operation,
        errorHandlerFn,
        'session-1',
        'test-operation'
      );

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(errorHandlerFn).toHaveBeenCalledTimes(2);
    });

    it('should stop retrying after max attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));
      const errorHandlerFn = jest.fn().mockImplementation((error) => 
        errorHandler.handleOCRError(error)
      );

      await expect(errorHandler.handleErrorWithRetry(
        operation,
        errorHandlerFn,
        'session-1',
        'test-operation'
      )).rejects.toThrow('Always fails');

      expect(operation).toHaveBeenCalledTimes(4); // Initial + 3 retries
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('permission denied'));
      const errorHandlerFn = jest.fn().mockImplementation((error) => 
        errorHandler.handleSystemError(error) // Returns non-retryable error
      );

      await expect(errorHandler.handleErrorWithRetry(
        operation,
        errorHandlerFn,
        'session-1',
        'test-operation'
      )).rejects.toThrow('permission denied');

      expect(operation).toHaveBeenCalledTimes(1); // No retries
    });

    it('should clear retry count on success', async () => {
      const operation = jest.fn().mockResolvedValue('success');
      const errorHandlerFn = jest.fn();

      await errorHandler.handleErrorWithRetry(
        operation,
        errorHandlerFn,
        'session-1',
        'test-operation'
      );

      expect(errorHandler.getRetryCount('test-operation')).toBe(0);
    });

    it('should track retry attempts', async () => {
      const operation = jest.fn().mockRejectedValue(new Error('Always fails'));
      const errorHandlerFn = jest.fn().mockImplementation((error) => 
        errorHandler.handleOCRError(error)
      );

      try {
        await errorHandler.handleErrorWithRetry(
          operation,
          errorHandlerFn,
          'session-1',
          'test-operation'
        );
      } catch (error) {
        // Expected to fail
      }

      expect(errorHandler.getRetryCount('test-operation')).toBe(0); // Cleared after max retries
    });

    it('should reset retry attempts manually', () => {
      // Simulate some retry attempts
      (errorHandler as any).retryAttempts.set('test-operation', 2);

      errorHandler.resetRetryAttempts('test-operation');

      expect(errorHandler.getRetryCount('test-operation')).toBe(0);
    });
  });

  describe('enhanced error handling', () => {
    it('should handle RAG errors', () => {
      const error = new Error('Document processing failed');
      const result = errorHandler.handleRAGError(error, 'session-1');

      expect(result).toMatchObject({
        category: ErrorCategory.PROCESSING,
        code: 'RAG_ERROR',
        message: 'Document processing failed',
        retryable: true
      });
    });

    it('should handle RAG permission errors', () => {
      const error = new Error('Permission denied accessing documents');
      const result = errorHandler.handleRAGError(error);

      expect(result.category).toBe(ErrorCategory.SYSTEM);
      expect(result.message).toBe('Permission denied accessing documents');
      expect(result.retryable).toBe(false);
    });

    it('should handle configuration errors', () => {
      const error = new Error('API key configuration error');
      const result = errorHandler.handleConfigError(error);

      expect(result).toMatchObject({
        category: ErrorCategory.USER,
        code: 'CONFIG_ERROR',
        message: 'API key configuration error',
        retryable: true
      });
    });

    it('should show error notifications', () => {
      const errorInfo: ErrorInfo = {
        category: ErrorCategory.PROCESSING,
        code: 'TEST_ERROR',
        message: 'Test notification',
        technical: 'Technical details',
        retryable: true
      };

      // Should not throw
      expect(() => errorHandler.showErrorNotification(errorInfo)).not.toThrow();
    });

    it('should determine if error should be shown to user', () => {
      const error = new Error('Test error');
      
      // First occurrence should be shown
      errorHandler.handleOCRError(error);
      const errorInfo = errorHandler.handleOCRError(error);
      expect(errorHandler.shouldShowToUser(errorInfo)).toBe(true);

      // Rapid repeated errors should not be shown
      for (let i = 0; i < 5; i++) {
        errorHandler.handleOCRError(error);
      }
      const repeatedErrorInfo = errorHandler.handleOCRError(error);
      expect(errorHandler.shouldShowToUser(repeatedErrorInfo)).toBe(false);
    });
  });
});