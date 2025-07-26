import { EventEmitter } from 'events';
import * as os from 'os';
import { app } from 'electron';

export interface PerformanceMetrics {
  timestamp: number;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
  process: {
    pid: number;
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    cpuUsage: NodeJS.CpuUsage;
  };
  system: {
    platform: string;
    arch: string;
    version: string;
    freeMemory: number;
    totalMemory: number;
  };
  performance: {
    ocrLatency: number[];
    audioLatency: number[];
    apiLatency: number[];
    ragLatency: number[];
  };
}

export interface PerformanceAlert {
  type: 'warning' | 'critical';
  category: 'memory' | 'cpu' | 'latency' | 'disk';
  message: string;
  value: number;
  threshold: number;
  timestamp: number;
}

export interface PerformanceThresholds {
  memory: {
    warning: number;  // 80%
    critical: number; // 95%
  };
  cpu: {
    warning: number;  // 70%
    critical: number; // 90%
  };
  latency: {
    ocr: {
      warning: number;  // 1.5s
      critical: number; // 2.5s
    };
    audio: {
      warning: number;  // 2.5s
      critical: number; // 4s
    };
    api: {
      warning: number;  // 5s
      critical: number; // 10s
    };
    rag: {
      warning: number;  // 0.8s
      critical: number; // 1.5s
    };
  };
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isMonitoring = false;
  private maxMetricsHistory = 1000; // Keep last 1000 measurements
  private maxAlertsHistory = 100;   // Keep last 100 alerts

  private thresholds: PerformanceThresholds = {
    memory: {
      warning: 80,  // 80%
      critical: 95  // 95%
    },
    cpu: {
      warning: 70,  // 70%
      critical: 90  // 90%
    },
    latency: {
      ocr: {
        warning: 1500,  // 1.5s
        critical: 2500  // 2.5s
      },
      audio: {
        warning: 2500,  // 2.5s
        critical: 4000  // 4s
      },
      api: {
        warning: 5000,  // 5s
        critical: 10000 // 10s
      },
      rag: {
        warning: 800,   // 0.8s
        critical: 1500  // 1.5s
      }
    }
  };

  private performanceHistory = {
    ocrLatency: [] as number[],
    audioLatency: [] as number[],
    apiLatency: [] as number[],
    ragLatency: [] as number[]
  };

  constructor() {
    super();
    this.setupMemoryWarnings();
  }

  public startMonitoring(intervalMs: number = 5000): void {
    if (this.isMonitoring) {
      return;
    }

    this.isMonitoring = true;
    console.log('Starting performance monitoring...');

    // Collect initial baseline
    this.collectMetrics();

    // Start periodic monitoring
    this.monitoringInterval = setInterval(() => {
      this.collectMetrics();
    }, intervalMs);

    // Start cleanup interval (every 5 minutes)
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 5 * 60 * 1000);

    this.emit('monitoring-started');
  }

  public stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    console.log('Stopping performance monitoring...');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.emit('monitoring-stopped');
  }

  private setupMemoryWarnings(): void {
    // Monitor for memory pressure
    if (process.memoryUsage) {
      const checkMemoryPressure = () => {
        const usage = process.memoryUsage();
        const totalSystemMemory = os.totalmem();
        const memoryPercentage = (usage.rss / totalSystemMemory) * 100;

        if (memoryPercentage > this.thresholds.memory.critical) {
          this.createAlert('critical', 'memory', 
            `Critical memory usage: ${memoryPercentage.toFixed(1)}%`, 
            memoryPercentage, this.thresholds.memory.critical);
          
          // Force garbage collection if available
          if (global.gc) {
            global.gc();
          }
        } else if (memoryPercentage > this.thresholds.memory.warning) {
          this.createAlert('warning', 'memory', 
            `High memory usage: ${memoryPercentage.toFixed(1)}%`, 
            memoryPercentage, this.thresholds.memory.warning);
        }
      };

      // Check memory every 30 seconds
      setInterval(checkMemoryPressure, 30000);
    }
  }

  private collectMetrics(): void {
    try {
      const now = Date.now();
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      const systemMemory = {
        free: os.freemem(),
        total: os.totalmem()
      };

      const metrics: PerformanceMetrics = {
        timestamp: now,
        cpu: {
          usage: this.getCPUUsage(),
          loadAverage: os.loadavg()
        },
        memory: {
          used: memUsage.rss,
          total: systemMemory.total,
          percentage: (memUsage.rss / systemMemory.total) * 100,
          heapUsed: memUsage.heapUsed,
          heapTotal: memUsage.heapTotal,
          external: memUsage.external
        },
        process: {
          pid: process.pid,
          uptime: process.uptime(),
          memoryUsage: memUsage,
          cpuUsage: cpuUsage
        },
        system: {
          platform: os.platform(),
          arch: os.arch(),
          version: os.release(),
          freeMemory: systemMemory.free,
          totalMemory: systemMemory.total
        },
        performance: {
          ocrLatency: [...this.performanceHistory.ocrLatency],
          audioLatency: [...this.performanceHistory.audioLatency],
          apiLatency: [...this.performanceHistory.apiLatency],
          ragLatency: [...this.performanceHistory.ragLatency]
        }
      };

      this.metrics.push(metrics);
      this.checkThresholds(metrics);
      this.emit('metrics-collected', metrics);

    } catch (error) {
      console.error('Error collecting performance metrics:', error);
    }
  }

  private getCPUUsage(): number {
    // Simple CPU usage calculation
    const cpus = os.cpus();
    let totalIdle = 0;
    let totalTick = 0;

    for (const cpu of cpus) {
      for (const type in cpu.times) {
        totalTick += cpu.times[type as keyof typeof cpu.times];
      }
      totalIdle += cpu.times.idle;
    }

    return 100 - (totalIdle / totalTick) * 100;
  }

  private checkThresholds(metrics: PerformanceMetrics): void {
    // Check memory thresholds
    if (metrics.memory.percentage > this.thresholds.memory.critical) {
      this.createAlert('critical', 'memory', 
        `Critical memory usage: ${metrics.memory.percentage.toFixed(1)}%`,
        metrics.memory.percentage, this.thresholds.memory.critical);
    } else if (metrics.memory.percentage > this.thresholds.memory.warning) {
      this.createAlert('warning', 'memory', 
        `High memory usage: ${metrics.memory.percentage.toFixed(1)}%`,
        metrics.memory.percentage, this.thresholds.memory.warning);
    }

    // Check CPU thresholds
    if (metrics.cpu.usage > this.thresholds.cpu.critical) {
      this.createAlert('critical', 'cpu', 
        `Critical CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        metrics.cpu.usage, this.thresholds.cpu.critical);
    } else if (metrics.cpu.usage > this.thresholds.cpu.warning) {
      this.createAlert('warning', 'cpu', 
        `High CPU usage: ${metrics.cpu.usage.toFixed(1)}%`,
        metrics.cpu.usage, this.thresholds.cpu.warning);
    }

    // Check latency thresholds
    this.checkLatencyThresholds();
  }

  private checkLatencyThresholds(): void {
    const checkLatency = (
      latencies: number[], 
      thresholds: { warning: number; critical: number }, 
      type: string
    ) => {
      if (latencies.length === 0) return;

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);

      if (maxLatency > thresholds.critical) {
        this.createAlert('critical', 'latency', 
          `Critical ${type} latency: ${maxLatency}ms (avg: ${avgLatency.toFixed(0)}ms)`,
          maxLatency, thresholds.critical);
      } else if (avgLatency > thresholds.warning) {
        this.createAlert('warning', 'latency', 
          `High ${type} latency: avg ${avgLatency.toFixed(0)}ms`,
          avgLatency, thresholds.warning);
      }
    };

    checkLatency(this.performanceHistory.ocrLatency, this.thresholds.latency.ocr, 'OCR');
    checkLatency(this.performanceHistory.audioLatency, this.thresholds.latency.audio, 'Audio');
    checkLatency(this.performanceHistory.apiLatency, this.thresholds.latency.api, 'API');
    checkLatency(this.performanceHistory.ragLatency, this.thresholds.latency.rag, 'RAG');
  }

  private createAlert(
    type: 'warning' | 'critical',
    category: 'memory' | 'cpu' | 'latency' | 'disk',
    message: string,
    value: number,
    threshold: number
  ): void {
    const alert: PerformanceAlert = {
      type,
      category,
      message,
      value,
      threshold,
      timestamp: Date.now()
    };

    this.alerts.push(alert);
    console.warn(`Performance Alert [${type.toUpperCase()}]: ${message}`);
    this.emit('performance-alert', alert);

    // Trigger automatic optimizations for critical alerts
    if (type === 'critical') {
      this.triggerOptimizations(category);
    }
  }

  private triggerOptimizations(category: string): void {
    switch (category) {
      case 'memory':
        this.optimizeMemory();
        break;
      case 'cpu':
        this.optimizeCPU();
        break;
      case 'latency':
        this.optimizeLatency();
        break;
    }
  }

  private optimizeMemory(): void {
    console.log('Triggering memory optimizations...');
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }

    // Clear old performance history
    this.performanceHistory.ocrLatency = this.performanceHistory.ocrLatency.slice(-50);
    this.performanceHistory.audioLatency = this.performanceHistory.audioLatency.slice(-50);
    this.performanceHistory.apiLatency = this.performanceHistory.apiLatency.slice(-50);
    this.performanceHistory.ragLatency = this.performanceHistory.ragLatency.slice(-50);

    // Clear old metrics
    this.metrics = this.metrics.slice(-100);
    this.alerts = this.alerts.slice(-50);

    this.emit('memory-optimized');
  }

  private optimizeCPU(): void {
    console.log('Triggering CPU optimizations...');
    
    // Reduce monitoring frequency temporarily
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = setInterval(() => {
        this.collectMetrics();
      }, 10000); // Reduce to every 10 seconds
    }

    this.emit('cpu-optimized');
  }

  private optimizeLatency(): void {
    console.log('Triggering latency optimizations...');
    
    // This will be handled by individual services
    this.emit('latency-optimization-requested');
  }

  private cleanupOldData(): void {
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Keep only recent alerts
    if (this.alerts.length > this.maxAlertsHistory) {
      this.alerts = this.alerts.slice(-this.maxAlertsHistory);
    }

    // Clean up performance history
    const maxHistorySize = 100;
    this.performanceHistory.ocrLatency = this.performanceHistory.ocrLatency.slice(-maxHistorySize);
    this.performanceHistory.audioLatency = this.performanceHistory.audioLatency.slice(-maxHistorySize);
    this.performanceHistory.apiLatency = this.performanceHistory.apiLatency.slice(-maxHistorySize);
    this.performanceHistory.ragLatency = this.performanceHistory.ragLatency.slice(-maxHistorySize);
  }

  // Public methods for recording performance data
  public recordOCRLatency(latency: number): void {
    this.performanceHistory.ocrLatency.push(latency);
    
    if (latency > this.thresholds.latency.ocr.critical) {
      this.createAlert('critical', 'latency', 
        `OCR operation exceeded critical threshold: ${latency}ms`,
        latency, this.thresholds.latency.ocr.critical);
    } else if (latency > this.thresholds.latency.ocr.warning) {
      this.createAlert('warning', 'latency', 
        `OCR operation exceeded warning threshold: ${latency}ms`,
        latency, this.thresholds.latency.ocr.warning);
    }
  }

  public recordAudioLatency(latency: number): void {
    this.performanceHistory.audioLatency.push(latency);
    
    if (latency > this.thresholds.latency.audio.critical) {
      this.createAlert('critical', 'latency', 
        `Audio processing exceeded critical threshold: ${latency}ms`,
        latency, this.thresholds.latency.audio.critical);
    } else if (latency > this.thresholds.latency.audio.warning) {
      this.createAlert('warning', 'latency', 
        `Audio processing exceeded warning threshold: ${latency}ms`,
        latency, this.thresholds.latency.audio.warning);
    }
  }

  public recordAPILatency(latency: number): void {
    this.performanceHistory.apiLatency.push(latency);
    
    if (latency > this.thresholds.latency.api.critical) {
      this.createAlert('critical', 'latency', 
        `API call exceeded critical threshold: ${latency}ms`,
        latency, this.thresholds.latency.api.critical);
    } else if (latency > this.thresholds.latency.api.warning) {
      this.createAlert('warning', 'latency', 
        `API call exceeded warning threshold: ${latency}ms`,
        latency, this.thresholds.latency.api.warning);
    }
  }

  public recordRAGLatency(latency: number): void {
    this.performanceHistory.ragLatency.push(latency);
    
    if (latency > this.thresholds.latency.rag.critical) {
      this.createAlert('critical', 'latency', 
        `RAG search exceeded critical threshold: ${latency}ms`,
        latency, this.thresholds.latency.rag.critical);
    } else if (latency > this.thresholds.latency.rag.warning) {
      this.createAlert('warning', 'latency', 
        `RAG search exceeded warning threshold: ${latency}ms`,
        latency, this.thresholds.latency.rag.warning);
    }
  }

  // Getters for performance data
  public getCurrentMetrics(): PerformanceMetrics | null {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  public getMetricsHistory(count?: number): PerformanceMetrics[] {
    if (count) {
      return this.metrics.slice(-count);
    }
    return [...this.metrics];
  }

  public getRecentAlerts(count: number = 10): PerformanceAlert[] {
    return this.alerts.slice(-count);
  }

  public getPerformanceSummary(): {
    averageLatencies: {
      ocr: number;
      audio: number;
      api: number;
      rag: number;
    };
    currentUsage: {
      memory: number;
      cpu: number;
    };
    alertCounts: {
      warnings: number;
      critical: number;
    };
  } {
    const current = this.getCurrentMetrics();
    const recentAlerts = this.getRecentAlerts(50);

    const calculateAverage = (arr: number[]) => 
      arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;

    return {
      averageLatencies: {
        ocr: calculateAverage(this.performanceHistory.ocrLatency.slice(-20)),
        audio: calculateAverage(this.performanceHistory.audioLatency.slice(-20)),
        api: calculateAverage(this.performanceHistory.apiLatency.slice(-20)),
        rag: calculateAverage(this.performanceHistory.ragLatency.slice(-20))
      },
      currentUsage: {
        memory: current?.memory.percentage || 0,
        cpu: current?.cpu.usage || 0
      },
      alertCounts: {
        warnings: recentAlerts.filter(a => a.type === 'warning').length,
        critical: recentAlerts.filter(a => a.type === 'critical').length
      }
    };
  }

  public updateThresholds(newThresholds: Partial<PerformanceThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    this.emit('thresholds-updated', this.thresholds);
  }

  public isMonitoringActive(): boolean {
    return this.isMonitoring;
  }

  public dispose(): void {
    this.stopMonitoring();
    this.removeAllListeners();
    this.metrics = [];
    this.alerts = [];
    this.performanceHistory = {
      ocrLatency: [],
      audioLatency: [],
      apiLatency: [],
      ragLatency: []
    };
  }
}