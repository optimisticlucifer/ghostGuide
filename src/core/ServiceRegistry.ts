/**
 * Service Registry Pattern Implementation
 * 
 * This class manages service dependencies and provides a centralized
 * way to register, initialize, and retrieve services.
 */

import { GlobalRAGService } from '../services/GlobalRAGService';
import { ChatService } from '../services/ChatService';
import { AudioService } from '../services/AudioService';
import { RAGService } from '../services/RAGService';
import { OCRService } from '../services/OCRService';
import { CaptureService } from '../services/CaptureService';
import { ConfigurationManager } from '../services/ConfigurationManager';
import { PromptLibraryService } from '../services/PromptLibraryService';
import { SessionManager } from '../services/SessionManager';
import { ScreenSharingDetectionService } from '../services/ScreenSharingDetectionService';
import { WindowManager } from '../services/WindowManager';

export type ServiceName = 
  | 'globalRagService'
  | 'chatService'
  | 'audioService'
  | 'ragService'
  | 'ocrService'
  | 'captureService'
  | 'configurationManager'
  | 'promptLibraryService'
  | 'sessionManager'
  | 'screenSharingDetectionService'
  | 'windowManager';

export type ServiceType = 
  | GlobalRAGService
  | ChatService
  | AudioService
  | RAGService
  | OCRService
  | CaptureService
  | ConfigurationManager
  | PromptLibraryService
  | SessionManager
  | ScreenSharingDetectionService
  | WindowManager;

export interface ServiceDescriptor<T extends ServiceType = ServiceType> {
  name: ServiceName;
  factory: () => T;
  dependencies?: ServiceName[];
  singleton?: boolean;
  initialized?: boolean;
}

export interface ServiceRegistryConfig {
  debug?: boolean;
  logger?: (message: string) => void;
}

export class ServiceRegistry {
  private services = new Map<ServiceName, ServiceType>();
  private descriptors = new Map<ServiceName, ServiceDescriptor>();
  private initializing = new Set<ServiceName>();
  private config: ServiceRegistryConfig;

  constructor(config: ServiceRegistryConfig = {}) {
    this.config = {
      debug: false,
      logger: console.log,
      ...config
    };
  }

  /**
   * Register a service with its dependencies
   */
  register<T extends ServiceType>(descriptor: ServiceDescriptor<T>): void {
    this.log(`📝 [REGISTRY] Registering service: ${descriptor.name}`);
    
    if (this.descriptors.has(descriptor.name)) {
      throw new Error(`Service ${descriptor.name} is already registered`);
    }

    this.descriptors.set(descriptor.name, descriptor as ServiceDescriptor);
  }

  /**
   * Get a service instance, initializing it if necessary
   */
  get<T extends ServiceType>(name: ServiceName): T {
    this.log(`🔍 [REGISTRY] Getting service: ${name}`);
    
    // Return cached instance if it exists
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    // Get service descriptor
    const descriptor = this.descriptors.get(name);
    if (!descriptor) {
      throw new Error(`Service ${name} is not registered`);
    }

    // Check for circular dependencies
    if (this.initializing.has(name)) {
      throw new Error(`Circular dependency detected for service ${name}`);
    }

    try {
      this.initializing.add(name);
      
      // Initialize dependencies first
      if (descriptor.dependencies) {
        for (const depName of descriptor.dependencies) {
          this.get(depName);
        }
      }

      // Create service instance
      this.log(`🏭 [REGISTRY] Creating service instance: ${name}`);
      const instance = descriptor.factory();
      
      // Cache if singleton (default behavior)
      if (descriptor.singleton !== false) {
        this.services.set(name, instance);
      }

      this.log(`✅ [REGISTRY] Service created: ${name}`);
      return instance as T;
    } finally {
      this.initializing.delete(name);
    }
  }

  /**
   * Initialize all registered services
   */
  async initializeAll(): Promise<void> {
    this.log('🚀 [REGISTRY] Initializing all services...');
    
    const serviceNames = Array.from(this.descriptors.keys());
    const results = await Promise.allSettled(
      serviceNames.map(async (name) => {
        try {
          const service = this.get(name);
          
          // Call initialize method if it exists
          if (service && typeof (service as any).initialize === 'function') {
            await (service as any).initialize();
            this.log(`✅ [REGISTRY] Initialized service: ${name}`);
          }
          
          return { name, success: true };
        } catch (error) {
          this.log(`❌ [REGISTRY] Failed to initialize service ${name}: ${(error as Error).message}`);
          return { name, success: false, error };
        }
      })
    );

    // Report initialization results
    const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success).length;
    const failed = results.length - successful;
    
    this.log(`📊 [REGISTRY] Initialization complete: ${successful} successful, ${failed} failed`);
    
    if (failed > 0) {
      const failedServices = results
        .filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success))
        .map(r => r.status === 'fulfilled' ? (r.value as any).name : 'unknown');
      
      this.log(`⚠️ [REGISTRY] Failed services: ${failedServices.join(', ')}`);
    }
  }

  /**
   * Check if a service is registered
   */
  has(name: ServiceName): boolean {
    return this.descriptors.has(name);
  }

  /**
   * Get all registered service names
   */
  getRegisteredServices(): ServiceName[] {
    return Array.from(this.descriptors.keys());
  }

  /**
   * Clear all services (for testing)
   */
  clear(): void {
    this.log('🧹 [REGISTRY] Clearing all services');
    this.services.clear();
    this.descriptors.clear();
    this.initializing.clear();
  }

  /**
   * Get service dependency graph
   */
  getDependencyGraph(): Record<ServiceName, ServiceName[]> {
    const graph: Record<ServiceName, ServiceName[]> = {};
    
    for (const [name, descriptor] of this.descriptors) {
      graph[name] = descriptor.dependencies || [];
    }
    
    return graph;
  }

  /**
   * Validate dependency graph for cycles
   */
  validateDependencies(): { isValid: boolean; cycles: ServiceName[][] } {
    const visited = new Set<ServiceName>();
    const recursionStack = new Set<ServiceName>();
    const cycles: ServiceName[][] = [];
    
    const dfs = (node: ServiceName, path: ServiceName[]): void => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        cycles.push([...path.slice(cycleStart), node]);
        return;
      }
      
      if (visited.has(node)) {
        return;
      }
      
      visited.add(node);
      recursionStack.add(node);
      
      const descriptor = this.descriptors.get(node);
      if (descriptor && descriptor.dependencies) {
        for (const dep of descriptor.dependencies) {
          dfs(dep, [...path, node]);
        }
      }
      
      recursionStack.delete(node);
    };
    
    for (const serviceName of this.descriptors.keys()) {
      if (!visited.has(serviceName)) {
        dfs(serviceName, []);
      }
    }
    
    return {
      isValid: cycles.length === 0,
      cycles
    };
  }

  /**
   * Setup default service registry with all application services
   */
  static createDefault(config: ServiceRegistryConfig = {}): ServiceRegistry {
    const registry = new ServiceRegistry(config);

    // Register core services without dependencies
    registry.register({
      name: 'configurationManager',
      factory: () => new ConfigurationManager(),
      singleton: true
    });

    registry.register({
      name: 'ocrService',
      factory: () => new OCRService(),
      singleton: true
    });

    registry.register({
      name: 'captureService',
      factory: () => new CaptureService(),
      singleton: true
    });

    registry.register({
      name: 'audioService',
      factory: () => new AudioService(),
      singleton: true
    });

    registry.register({
      name: 'ragService',
      factory: () => new RAGService(),
      singleton: true
    });

    registry.register({
      name: 'globalRagService',
      factory: () => new GlobalRAGService(),
      singleton: true
    });

    registry.register({
      name: 'sessionManager',
      factory: () => new SessionManager(),
      singleton: true
    });

    registry.register({
      name: 'windowManager',
      factory: () => new WindowManager(),
      singleton: true
    });

    // Register services with dependencies
    registry.register({
      name: 'promptLibraryService',
      factory: () => {
        const service = new PromptLibraryService();
        const configManager = registry.get<ConfigurationManager>('configurationManager');
        service.setConfigurationManager(configManager);
        return service;
      },
      dependencies: ['configurationManager'],
      singleton: true
    });

    registry.register({
      name: 'chatService',
      factory: () => new ChatService(
        registry.get<ConfigurationManager>('configurationManager'),
        registry.get<PromptLibraryService>('promptLibraryService'),
        registry.get<SessionManager>('sessionManager'),
        registry.get<RAGService>('ragService')
      ),
      dependencies: ['configurationManager', 'promptLibraryService', 'sessionManager', 'ragService'],
      singleton: true
    });

    // Screen sharing service is created on-demand, not registered here
    
    return registry;
  }

  private log(message: string): void {
    if (this.config.debug && this.config.logger) {
      this.config.logger(message);
    }
  }
}
