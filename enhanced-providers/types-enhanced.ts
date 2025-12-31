/**
 * Enhanced Types for Providers Module
 *
 * Extends the base provider types with advanced features:
 * - Circuit breaker configuration
 * - Retry policies
 * - Caching strategies
 * - Rate limiting
 * - Load balancing
 * - Observability
 */

// ============================================================================
// Base Types (assuming these exist in your current implementation)
// ============================================================================

export interface GenerationRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  stream?: boolean;
  metadata?: Record<string, any>;
}

export interface GenerationResponse {
  id: string;
  content: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  finishReason: 'stop' | 'length' | 'content_filter' | 'error';
  metadata?: Record<string, any>;
}

export interface ProviderConfig {
  id: number;
  name: string;
  type: 'openai' | 'anthropic' | 'google' | 'custom';
  apiKey: string;
  baseUrl?: string;
  timeout?: number;

  // Enhanced configurations (all optional)
  circuitBreakerConfig?: CircuitBreakerConfig;
  retryConfig?: RetryConfig;
  cacheConfig?: CacheConfig;
  rateLimitConfig?: RateLimitConfig;
}

// ============================================================================
// Circuit Breaker Types
// ============================================================================

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;

  /** Time in ms to wait before attempting recovery (half-open state) */
  resetTimeout: number;

  /** Number of successful requests needed to close circuit from half-open */
  successThreshold?: number;

  /** Time window in ms for tracking failures */
  monitoringPeriod?: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerStats {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime?: number;
  lastStateChange: number;
  totalRequests: number;
  totalFailures: number;
}

// ============================================================================
// Retry Types
// ============================================================================

export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxRetries: number;

  /** Initial delay in ms before first retry */
  initialDelayMs?: number;

  /** Maximum delay in ms between retries */
  maxDelayMs?: number;

  /** Multiplier for exponential backoff */
  backoffMultiplier?: number;

  /** Add random jitter to prevent thundering herd */
  jitter?: boolean;

  /** Custom function to determine if error is retryable */
  retryableErrors?: (error: Error) => boolean;
}

export interface RetryStats {
  attemptNumber: number;
  totalAttempts: number;
  nextDelayMs: number;
  error?: Error;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheConfig {
  /** Enable/disable caching */
  enabled: boolean;

  /** Time-to-live in seconds */
  ttlSeconds: number;

  /** Maximum number of cached items */
  maxSize: number;

  /** Key prefix for cache entries */
  keyPrefix?: string;

  /** Compress cache entries (for large responses) */
  compress?: boolean;

  /** Custom cache key generator */
  keyGenerator?: (request: GenerationRequest) => string;
}

export interface CacheEntry<T> {
  key: string;
  value: T;
  timestamp: number;
  expiresAt: number;
  hits: number;
  size: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
  evictions: number;
  totalSavings: number; // Estimated cost savings
}

// ============================================================================
// Rate Limiter Types
// ============================================================================

export interface RateLimitConfig {
  /** Maximum requests per minute */
  requestsPerMinute: number;

  /** Maximum tokens per minute */
  tokensPerMinute: number;

  /** Burst allowance (allows temporary spikes) */
  burstSize?: number;

  /** Penalty time in ms when limit exceeded */
  penaltyMs?: number;
}

export interface RateLimitState {
  requestTokens: number;
  tokenQuota: number;
  lastRefill: number;
  pendingRequests: number;
  rejectedRequests: number;
}

export interface RateLimitError extends Error {
  retryAfterMs: number;
  limit: number;
  current: number;
}

// ============================================================================
// Load Balancer Types
// ============================================================================

export type LoadBalancingStrategy =
  | 'round_robin'     // Simple round-robin distribution
  | 'weighted'        // Weight-based distribution
  | 'least_latency'   // Route to fastest provider
  | 'least_cost'      // Route to cheapest provider
  | 'health_based';   // Route based on health/circuit state

export interface LoadBalancerConfig {
  type: LoadBalancingStrategy;

  /** Weights for each provider (for weighted strategy) */
  weights?: Map<number, number>;

  /** Enable automatic failover */
  failover?: boolean;

  /** Max failover attempts before giving up */
  maxFailoverAttempts?: number;
}

export interface ProviderHealth {
  providerId: number;
  isHealthy: boolean;
  circuitState: CircuitState;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errorRate: number;
  lastHealthCheck: number;
}

export interface RoutingDecision {
  providerId: number;
  reason: string;
  alternativeProviders: number[];
}

// ============================================================================
// Observability Types
// ============================================================================

export interface ObservabilityConfig {
  /** Enable metrics collection */
  enableMetrics?: boolean;

  /** Enable distributed tracing */
  enableTracing?: boolean;

  /** Sample rate for traces (0-1) */
  traceSampleRate?: number;

  /** Custom metric exporters */
  metricExporters?: MetricExporter[];
}

export interface MetricExporter {
  export(metrics: Metrics): Promise<void>;
}

export interface Metrics {
  providerId: number;
  providerName: string;

  // Request metrics
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;

  // Latency metrics (in ms)
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  averageLatency: number;

  // Token metrics
  totalTokensUsed: number;
  averageTokensPerRequest: number;

  // Cost metrics
  estimatedCost: number;
  costPerToken: number;

  // Cache metrics
  cacheHits: number;
  cacheMisses: number;
  cacheHitRate: number;
  cacheSavings: number;

  // Circuit breaker metrics
  circuitState: CircuitState;
  circuitOpenCount: number;

  // Rate limit metrics
  rateLimitHits: number;
  rateLimitRejections: number;

  // Time window
  periodStart: number;
  periodEnd: number;
}

export interface Trace {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  providerId: number;
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  status: 'success' | 'error';
  error?: Error;
  metadata?: Record<string, any>;
}

export interface ObservabilityEvent {
  type: 'request_start' | 'request_end' | 'cache_hit' | 'cache_miss' |
        'circuit_open' | 'circuit_close' | 'retry_attempt' | 'rate_limit_hit' |
        'failover' | 'error';
  providerId: number;
  timestamp: number;
  data?: any;
  traceId?: string;
}

// ============================================================================
// Provider Performance Types
// ============================================================================

export interface ProviderPerformance {
  providerId: number;

  // Historical performance
  successRate: number;
  averageLatency: number;
  p95Latency: number;

  // Cost efficiency
  averageCost: number;
  costPerSuccessfulRequest: number;

  // Reliability
  uptime: number;
  mtbf: number; // Mean time between failures
  mttr: number; // Mean time to recovery

  // Current state
  isAvailable: boolean;
  currentLoad: number;
}

// ============================================================================
// Error Types
// ============================================================================

export class ProviderError extends Error {
  constructor(
    message: string,
    public providerId: number,
    public providerName: string,
    public originalError?: Error,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class CircuitBreakerError extends ProviderError {
  constructor(providerId: number, providerName: string) {
    super(
      `Circuit breaker is OPEN for provider ${providerName}`,
      providerId,
      providerName,
      undefined,
      false
    );
    this.name = 'CircuitBreakerError';
  }
}

export class RateLimitExceededError extends ProviderError {
  constructor(
    providerId: number,
    providerName: string,
    public retryAfterMs: number
  ) {
    super(
      `Rate limit exceeded for provider ${providerName}. Retry after ${retryAfterMs}ms`,
      providerId,
      providerName,
      undefined,
      true
    );
    this.name = 'RateLimitExceededError';
  }
}

export class AllProvidersFailedError extends Error {
  constructor(
    public attemptedProviders: number[],
    public errors: Map<number, Error>
  ) {
    super(`All providers failed. Attempted: ${attemptedProviders.join(', ')}`);
    this.name = 'AllProvidersFailedError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export type AsyncFunction<T> = () => Promise<T>;

export interface TimeWindow {
  start: number;
  end: number;
  duration: number;
}

export interface PercentileStats {
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
}
