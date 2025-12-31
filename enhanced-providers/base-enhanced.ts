/**
 * Enhanced Base Provider
 *
 * Base class for all providers with built-in enhancements:
 * - Circuit breaker protection
 * - Automatic retry with exponential backoff
 * - Response caching
 * - Rate limiting
 * - Full observability
 *
 * Usage:
 * ```typescript
 * class MyProvider extends EnhancedBaseProvider {
 *   protected async doGenerate(request: GenerationRequest): Promise<GenerationResponse> {
 *     // Your implementation (circuit breaker, retry, cache handled automatically)
 *     return await this.callAPI(request);
 *   }
 * }
 * ```
 */

import {
  ProviderConfig,
  GenerationRequest,
  GenerationResponse,
  ProviderHealth,
  CircuitState,
} from './types-enhanced';

import { CircuitBreaker } from './circuit-breaker';
import { RetryManager } from './retry-manager';
import { ResponseCache } from './response-cache';
import { RateLimiter } from './rate-limiter';
import { getObservability } from './observability';

/**
 * Enhanced Base Provider class
 *
 * Extend this class instead of BaseProvider to get all enhancements
 */
export abstract class EnhancedBaseProvider {
  protected config: ProviderConfig;

  // Enhancement components
  private circuitBreaker?: CircuitBreaker;
  private retryManager?: RetryManager;
  private cache?: ResponseCache;
  private rateLimiter?: RateLimiter;

  // Observability
  private observability = getObservability();

  // Statistics
  private latencies: number[] = [];
  private errors: number[] = [];

  constructor(config: ProviderConfig) {
    this.config = config;

    // Initialize components based on configuration
    this.initializeComponents();

    // Register with observability
    this.observability.registerProvider(config.id, config.name);
  }

  /**
   * Initialize enhancement components
   */
  private initializeComponents(): void {
    // Circuit Breaker
    if (this.config.circuitBreakerConfig) {
      this.circuitBreaker = new CircuitBreaker(
        this.config.circuitBreakerConfig,
        this.config.id,
        this.config.name
      );
    }

    // Retry Manager
    if (this.config.retryConfig) {
      this.retryManager = new RetryManager(this.config.retryConfig);
    }

    // Response Cache
    if (this.config.cacheConfig) {
      this.cache = new ResponseCache(this.config.cacheConfig);
    }

    // Rate Limiter
    if (this.config.rateLimitConfig) {
      this.rateLimiter = new RateLimiter(
        this.config.rateLimitConfig,
        this.config.id,
        this.config.name
      );
    }
  }

  /**
   * Main generate method with all enhancements
   */
  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    const spanId = this.observability.startTrace(
      this.config.id,
      'generate'
    );

    const startTime = Date.now();

    try {
      // Emit request start event
      this.observability.emitEvent({
        type: 'request_start',
        providerId: this.config.id,
        timestamp: Date.now(),
        traceId: spanId,
      });

      // Record request metric
      this.observability.recordMetric(this.config.id, 'request', 1);

      // Check cache first
      if (this.cache) {
        const cached = this.cache.get(request);
        if (cached) {
          this.observability.recordMetric(this.config.id, 'cache_hit', 1);
          this.observability.emitEvent({
            type: 'cache_hit',
            providerId: this.config.id,
            timestamp: Date.now(),
            traceId: spanId,
          });

          this.observability.endTrace(spanId);
          return cached;
        } else {
          this.observability.recordMetric(this.config.id, 'cache_miss', 1);
          this.observability.emitEvent({
            type: 'cache_miss',
            providerId: this.config.id,
            timestamp: Date.now(),
            traceId: spanId,
          });
        }
      }

      // Rate limiting
      if (this.rateLimiter) {
        const estimatedTokens = request.maxTokens || 1000;
        await this.rateLimiter.acquire(estimatedTokens);
      }

      // Execute with circuit breaker and retry
      const response = await this.executeWithEnhancements(request, spanId);

      // Update cache
      if (this.cache) {
        this.cache.set(request, response);
      }

      // Return unused tokens to rate limiter
      if (this.rateLimiter && request.maxTokens) {
        const unusedTokens = request.maxTokens - response.usage.completionTokens;
        if (unusedTokens > 0) {
          this.rateLimiter.returnTokens(unusedTokens);
        }
      }

      // Track metrics
      const latency = Date.now() - startTime;
      this.trackSuccess(latency, response);

      // Record metrics
      this.observability.recordMetric(this.config.id, 'success', 1);
      this.observability.recordMetric(this.config.id, 'latency', latency);
      this.observability.recordMetric(this.config.id, 'tokens', response.usage.totalTokens);

      this.observability.emitEvent({
        type: 'request_end',
        providerId: this.config.id,
        timestamp: Date.now(),
        data: { latency, tokens: response.usage.totalTokens },
        traceId: spanId,
      });

      this.observability.endTrace(spanId);
      return response;

    } catch (error) {
      // Track error
      this.trackError(error as Error);

      // Record error metrics
      this.observability.recordMetric(this.config.id, 'failure', 1);
      this.observability.emitEvent({
        type: 'error',
        providerId: this.config.id,
        timestamp: Date.now(),
        data: { error: (error as Error).message },
        traceId: spanId,
      });

      this.observability.endTrace(spanId, error as Error);
      throw error;
    }
  }

  /**
   * Execute with circuit breaker and retry
   */
  private async executeWithEnhancements(
    request: GenerationRequest,
    spanId: string
  ): Promise<GenerationResponse> {
    // Wrapper function for retry and circuit breaker
    const executeFunction = async () => {
      return await this.doGenerate(request);
    };

    // Apply circuit breaker if configured
    let executeFn = executeFunction;
    if (this.circuitBreaker) {
      executeFn = async () => {
        return await this.circuitBreaker!.execute(executeFunction);
      };
    }

    // Apply retry if configured
    if (this.retryManager) {
      return await this.retryManager.execute(executeFn, {
        providerId: this.config.id,
        providerName: this.config.name,
      });
    }

    return await executeFn();
  }

  /**
   * Abstract method to be implemented by subclasses
   * This is where the actual API call happens
   */
  protected abstract doGenerate(
    request: GenerationRequest
  ): Promise<GenerationResponse>;

  /**
   * Track successful request
   */
  private trackSuccess(latency: number, response: GenerationResponse): void {
    this.latencies.push(latency);

    // Keep only last 100 latencies
    if (this.latencies.length > 100) {
      this.latencies.shift();
    }
  }

  /**
   * Track error
   */
  private trackError(error: Error): void {
    this.errors.push(Date.now());

    // Keep only errors from last hour
    const oneHourAgo = Date.now() - 3600000;
    this.errors = this.errors.filter(timestamp => timestamp > oneHourAgo);
  }

  /**
   * Calculate percentile
   */
  private percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Get provider health
   */
  getHealth(): ProviderHealth {
    const sortedLatencies = [...this.latencies].sort((a, b) => a - b);

    const totalRequests = this.latencies.length;
    const errorRate = totalRequests > 0
      ? this.errors.length / totalRequests
      : 0;

    return {
      providerId: this.config.id,
      isHealthy: this.isHealthy(),
      circuitState: this.circuitBreaker?.getState() || 'CLOSED',
      latencyP50: this.percentile(sortedLatencies, 0.5),
      latencyP95: this.percentile(sortedLatencies, 0.95),
      latencyP99: this.percentile(sortedLatencies, 0.99),
      errorRate,
      lastHealthCheck: Date.now(),
    };
  }

  /**
   * Check if provider is healthy
   */
  isHealthy(): boolean {
    // Provider is healthy if circuit is not open
    if (this.circuitBreaker && this.circuitBreaker.getState() === 'OPEN') {
      return false;
    }

    // Provider is healthy if rate limiter is available
    if (this.rateLimiter && !this.rateLimiter.isAvailable()) {
      return false;
    }

    return true;
  }

  /**
   * Get provider ID
   */
  get id(): number {
    return this.config.id;
  }

  /**
   * Get provider name
   */
  get name(): string {
    return this.config.name;
  }

  /**
   * Get provider type
   */
  get type(): string {
    return this.config.type;
  }

  /**
   * Get circuit breaker stats (if enabled)
   */
  getCircuitBreakerStats() {
    return this.circuitBreaker?.getStats();
  }

  /**
   * Get retry stats (if enabled)
   */
  getRetryStats() {
    return this.retryManager?.getStats();
  }

  /**
   * Get cache stats (if enabled)
   */
  getCacheStats() {
    return this.cache?.getStats();
  }

  /**
   * Get rate limiter stats (if enabled)
   */
  getRateLimiterStats() {
    return this.rateLimiter?.getStats();
  }

  /**
   * Force circuit breaker open (for testing/maintenance)
   */
  forceCircuitOpen(): void {
    if (this.circuitBreaker) {
      this.circuitBreaker.forceOpen();
      this.observability.emitEvent({
        type: 'circuit_open',
        providerId: this.config.id,
        timestamp: Date.now(),
        data: { forced: true },
      });
    }
  }

  /**
   * Force circuit breaker closed (for testing/maintenance)
   */
  forceCircuitClose(): void {
    if (this.circuitBreaker) {
      this.circuitBreaker.forceClose();
      this.observability.emitEvent({
        type: 'circuit_close',
        providerId: this.config.id,
        timestamp: Date.now(),
        data: { forced: true },
      });
    }
  }

  /**
   * Clear cache (if enabled)
   */
  clearCache(): void {
    if (this.cache) {
      this.cache.clear();
    }
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    this.latencies = [];
    this.errors = [];

    if (this.circuitBreaker) {
      this.circuitBreaker.reset();
    }

    if (this.retryManager) {
      this.retryManager.resetStats();
    }

    if (this.cache) {
      this.cache.resetStats();
    }

    if (this.rateLimiter) {
      this.rateLimiter.reset();
    }
  }
}

/**
 * Example implementation showing how to extend EnhancedBaseProvider
 */
export class ExampleProvider extends EnhancedBaseProvider {
  /**
   * Implement the actual API call logic
   */
  protected async doGenerate(
    request: GenerationRequest
  ): Promise<GenerationResponse> {
    // This is where you'd make your actual API call
    // Example:
    // const response = await fetch(this.config.baseUrl + '/generate', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${this.config.apiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(request),
    // });
    //
    // return await response.json();

    // Placeholder implementation
    return {
      id: 'example-' + Date.now(),
      content: 'This is an example response',
      model: request.model || 'example-model',
      usage: {
        promptTokens: request.prompt.length,
        completionTokens: 100,
        totalTokens: request.prompt.length + 100,
      },
      finishReason: 'stop',
    };
  }
}
