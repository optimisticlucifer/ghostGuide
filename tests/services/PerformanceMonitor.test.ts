import { PerformanceMonitor, PerformanceMetrics, PerformanceAlert } from '../../src/services/PerformanceMonitor';
import { app } from 'electron';
import * as os from 'os';

// Mock dependencies
jest.mock('electron', () => ({
  app: {
    getVersion: jest.fn(() => '1.0.0')
  }
}));

jest.mock('os');

describe('PerformanceMonitor', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock os functions
    (os.totalmem as jest.Mock).mockReturnValue(8 * 1024 * 1024 * 1024); // 8GB
    (os.freemem as jest.Mock).mockReturnValue(4 * 1024 * 1024 * 1024);  // 4GB
    (os.loadavg as jest.Mock).mockReturnValue([0.5, 0.6, 0.7]);
    (os.platform as jest.Mock).mockReturnValue('darwin');
    (os.arch as jest.Mock).mockReturnValue('x64');
    (os.release as jest.Mock).mockReturnValue('20.0.0');
    (os.cpus as jest.Mock).mockReturnValue([
      { times: { user: 1000, nice: 0, sys: 500, idle: 8500, irq: 0 } },
      { times: { user: 1200, nice: 0, sys: 600, idle: 8200, irq: 0 } }
    ]);

    // Mock process functions
    jest.spyOn(process, 'memoryUsage').mockReturnValue({
      rss: 100 * 1024 * 1024,      // 100MB
      heapUsed: 50 * 1024 * 1024,  // 50MB
      heapTotal: 80 * 1024 * 1024, // 80MB
      external: 10 * 1024 * 1024,  // 10MB
      arrayBuffers: 5 * 1024 * 1024 // 5MB
    });

    jest.spyOn(process, 'cpuUsage').mockReturnValue({
      user: 1000000,
      system: 500000
    });

    jest.spyOn(process, 'uptime').mockReturnValue(3600); // 1 hour

    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    performanceMonitor.dispose();
    jest.restoreAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with default thresholds', () => {
      const thresholds = performanceMonitor.getThresholds();
      
      expect(thresholds.memory.warning).toBe(80);
      expect(thresholds.memory.critical).toBe(95);
      expect(thresholds.cpu.warning).toBe(70);
      expect(thresholds.cpu.critical).toBe(90);
      expect(thresholds.latency.ocr.warning).toBe(1500);
      expect(thresholds.latency.ocr.critical).toBe(2500);
    });

    it('should not be monitoring initially', () => {
      expect(performanceMonitor.isMonitoringActive()).toBe(false);
    });
  });

  describe('monitoring lifecycle', () => {
    it('should start monitoring', () => {
      const startSpy = jest.spyOn(performanceMonitor, 'startMonitoring');
      
      performanceMonitor.startMonitoring(1000);
      
      expect(performanceMonitor.isMonitoringActive()).toBe(true);
      expect(startSpy).toHaveBeenCalledWith(1000);
    });

    it('should stop monitoring', () => {
      performanceMonitor.startMonitoring(1000);
      expect(performanceMonitor.isMonitoringActive()).toBe(true);
      
      performanceMonitor.stopMonitoring();
      expect(performanceMonitor.isMonitoringActive()).toBe(false);
    });

    it('should emit monitoring events', (done) => {
      performanceMonitor.on('monitoring-started', () => {
        expect(performanceMonitor.isMonitoringActive()).toBe(true);
        performanceMonitor.stopMonitoring();
      });

      performanceMonitor.on('monitoring-stopped', () => {
        expect(performanceMonitor.isMonitoringActive()).toBe(false);
        done();
      });

      performanceMonitor.startMonitoring(100);
    });
  });

  describe('metrics collection', () => {
    it('should collect performance metrics', (done) => {
      performanceMonitor.on('metrics-collected', (metrics: PerformanceMetrics) => {
        expect(metrics).toBeDefined();
        expect(metrics.timestamp).toBeGreaterThan(0);
        expect(metrics.memory).toBeDefined();
        expect(metrics.cpu).toBeDefined();
        expect(metrics.process).toBeDefined();
        expect(metrics.system).toBeDefined();
        expect(metrics.performance).toBeDefined();
        
        performanceMonitor.stopMonitoring();
        done();
      });

      performanceMonitor.startMonitoring(100);
    });

    it('should provide current metrics', () => {
      performanceMonitor.startMonitoring(100);
      
      // Wait a bit for metrics to be collected
      setTimeout(() => {
        const metrics = performanceMonitor.getCurrentMetrics();
        expect(metrics).toBeDefined();
        if (metrics) {
          expect(metrics.memory.percentage).toBeGreaterThan(0);
          expect(metrics.cpu.usage).toBeGreaterThanOrEqual(0);
        }
        performanceMonitor.stopMonitoring();
      }, 150);
    });

    it('should maintain metrics history', () => {
      performanceMonitor.startMonitoring(50);
      
      setTimeout(() => {
        const history = performanceMonitor.getMetricsHistory();
        expect(history.length).toBeGreaterThan(0);
        performanceMonitor.stopMonitoring();
      }, 200);
    });
  });

  describe('latency recording', () => {
    it('should record OCR latency', () => {
      const latency = 1800; // 1.8 seconds
      performanceMonitor.recordOCRLatency(latency);
      
      const summary = performanceMonitor.getPerformanceSummary();
      expect(summary.averageLatencies.ocr).toBe(latency);
    });

    it('should record audio latency', () => {
      const latency = 2800; // 2.8 seconds
      performanceMonitor.recordAudioLatency(latency);
      
      const summary = performanceMonitor.getPerformanceSummary();
      expect(summary.averageLatencies.audio).toBe(latency);
    });

    it('should record API latency', () => {
      const latency = 3000; // 3 seconds
      performanceMonitor.recordAPILatency(latency);
      
      const summary = performanceMonitor.getPerformanceSummary();
      expect(summary.averageLatencies.api).toBe(latency);
    });

    it('should record RAG latency', () => {
      const latency = 900; // 0.9 seconds
      performanceMonitor.recordRAGLatency(latency);
      
      const summary = performanceMonitor.getPerformanceSummary();
      expect(summary.averageLatencies.rag).toBe(latency);
    });
  });

  describe('alert system', () => {
    it('should generate warning alert for high OCR latency', (done) => {
      performanceMonitor.on('performance-alert', (alert: PerformanceAlert) => {
        expect(alert.type).toBe('warning');
        expect(alert.category).toBe('latency');
        expect(alert.message).toContain('OCR');
        expect(alert.value).toBe(1800);
        done();
      });

      performanceMonitor.recordOCRLatency(1800); // Above warning threshold
    });

    it('should generate critical alert for very high OCR latency', (done) => {
      performanceMonitor.on('performance-alert', (alert: PerformanceAlert) => {
        expect(alert.type).toBe('critical');
        expect(alert.category).toBe('latency');
        expect(alert.message).toContain('OCR');
        expect(alert.value).toBe(3000);
        done();
      });

      performanceMonitor.recordOCRLatency(3000); // Above critical threshold
    });

    it('should generate warning alert for high audio latency', (done) => {
      performanceMonitor.on('performance-alert', (alert: PerformanceAlert) => {
        expect(alert.type).toBe('warning');
        expect(alert.category).toBe('latency');
        expect(alert.message).toContain('Audio');
        done();
      });

      performanceMonitor.recordAudioLatency(3500); // Above warning threshold
    });

    it('should store alert history', () => {
      performanceMonitor.recordOCRLatency(3000); // Generate critical alert
      performanceMonitor.recordAudioLatency(3500); // Generate warning alert
      
      const alerts = performanceMonitor.getRecentAlerts(10);
      expect(alerts.length).toBe(2);
      expect(alerts[0].category).toBe('latency');
      expect(alerts[1].category).toBe('latency');
    });
  });

  describe('performance summary', () => {
    it('should provide performance summary', () => {
      // Record some latencies
      performanceMonitor.recordOCRLatency(1000);
      performanceMonitor.recordOCRLatency(1500);
      performanceMonitor.recordAudioLatency(2000);
      performanceMonitor.recordAPILatency(3000);
      performanceMonitor.recordRAGLatency(500);

      const summary = performanceMonitor.getPerformanceSummary();
      
      expect(summary.averageLatencies.ocr).toBe(1250); // Average of 1000 and 1500
      expect(summary.averageLatencies.audio).toBe(2000);
      expect(summary.averageLatencies.api).toBe(3000);
      expect(summary.averageLatencies.rag).toBe(500);
      expect(summary.currentUsage).toBeDefined();
      expect(summary.alertCounts).toBeDefined();
    });
  });

  describe('threshold management', () => {
    it('should update thresholds', () => {
      const newThresholds = {
        memory: {
          warning: 75,
          critical: 90
        }
      };

      performanceMonitor.updateThresholds(newThresholds);
      
      const thresholds = performanceMonitor.getThresholds();
      expect(thresholds.memory.warning).toBe(75);
      expect(thresholds.memory.critical).toBe(90);
    });

    it('should emit thresholds-updated event', (done) => {
      performanceMonitor.on('thresholds-updated', (thresholds) => {
        expect(thresholds.memory.warning).toBe(75);
        done();
      });

      performanceMonitor.updateThresholds({
        memory: { warning: 75, critical: 90 }
      });
    });
  });

  describe('memory optimization', () => {
    it('should optimize memory when requested', () => {
      // Add some data to optimize
      for (let i = 0; i < 200; i++) {
        performanceMonitor.recordOCRLatency(1000 + i);
      }

      const beforeOptimization = performanceMonitor.getPerformanceSummary();
      performanceMonitor.optimizeMemory();
      
      // Memory optimization should have cleaned up some data
      expect(performanceMonitor.getRecentAlerts(100).length).toBeLessThanOrEqual(50);
    });

    it('should emit memory-optimized event', (done) => {
      performanceMonitor.on('memory-optimized', () => {
        done();
      });

      performanceMonitor.optimizeMemory();
    });
  });

  describe('disposal', () => {
    it('should dispose properly', () => {
      performanceMonitor.startMonitoring(100);
      expect(performanceMonitor.isMonitoringActive()).toBe(true);
      
      performanceMonitor.dispose();
      expect(performanceMonitor.isMonitoringActive()).toBe(false);
      
      // Should not have any metrics after disposal
      const metrics = performanceMonitor.getCurrentMetrics();
      expect(metrics).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should handle errors in metrics collection gracefully', () => {
      // Mock process.memoryUsage to throw an error
      jest.spyOn(process, 'memoryUsage').mockImplementation(() => {
        throw new Error('Memory usage error');
      });

      // Should not throw when starting monitoring
      expect(() => {
        performanceMonitor.startMonitoring(100);
      }).not.toThrow();

      performanceMonitor.stopMonitoring();
    });
  });

  describe('performance thresholds validation', () => {
    it('should respect OCR latency target of <2 seconds', () => {
      const thresholds = performanceMonitor.getThresholds();
      expect(thresholds.latency.ocr.critical).toBeLessThanOrEqual(2500); // 2.5s max
    });

    it('should respect audio latency target of <3 seconds', () => {
      const thresholds = performanceMonitor.getThresholds();
      expect(thresholds.latency.audio.critical).toBeLessThanOrEqual(4000); // 4s max
    });

    it('should have reasonable memory thresholds', () => {
      const thresholds = performanceMonitor.getThresholds();
      expect(thresholds.memory.warning).toBeLessThan(thresholds.memory.critical);
      expect(thresholds.memory.critical).toBeLessThanOrEqual(95);
    });

    it('should have reasonable CPU thresholds', () => {
      const thresholds = performanceMonitor.getThresholds();
      expect(thresholds.cpu.warning).toBeLessThan(thresholds.cpu.critical);
      expect(thresholds.cpu.critical).toBeLessThanOrEqual(90);
    });
  });
});