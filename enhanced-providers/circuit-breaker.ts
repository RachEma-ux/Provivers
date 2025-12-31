/**
 * Circuit Breaker Implementation
 *
 * Prevents cascading failures by stopping requests to failing providers.
 * Implements the classic three-state pattern:
 * - CLOSED: Normal operation, requests flow through
 * - OPEN: Provider is failing, reject requests immediately
 * - HALF_OPEN: Testing if provider has recovered
 *
 * Based on Martin Fowler's Circuit Breaker pattern:
 * https://martinfowler.com/bliki/CircuitBreaker.html
 */

import {
  CircuitBreakerConfig,
  CircuitState,
  CircuitBreakerStats,
  CircuitBreakerError,
  AsyncFunction,
} from './types-enhanced';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<CircuitBreakerConfig> = {
  failureThreshold: 5,
  resetTimeout: 60000, // 1 minute
  successThreshold: 2,
  monitoringPeriod: 60000, // 1 minute
};

/**
 * Circuit Breaker class
 *
 * Usage:
 * ```typescript
 * const breaker = new CircuitBreaker({
 *   failureThreshold: 5,
 *   resetTimeout: 60000
 * }, 1, 'OpenAI');
 *
 * try {
 *   const result = await breaker.execute(async () => {
 *     return await apiCall();
 *   });
 * } catch (error) {
 *   if (error instanceof CircuitBreakerError) {
 *     // Circuit is open, use fallback
 *   }
 * }
 * ```
 */
export class CircuitBreaker {
  private state: CircuitState = 'CLOSED';
  private failureCount: number = 0;
  private successCount: number = 0;
  private lastFailureTime?: number;
  private lastStateChange: number = Date.now();
  private nextAttemptTime?: number;

  // Statistics
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private failures: number[] = []; // Timestamps of failures within monitoring period

  private config: Required<CircuitBreakerConfig>;

  constructor(
    config: CircuitBreakerConfig,
    private providerId: number,
    private providerName: string
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: AsyncFunction<T>): Promise<T> {
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new CircuitBreakerError(this.providerId, this.providerName);
      }
    }

    this.totalRequests++;

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error as Error);
      throw error;
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === 'HALF_OPEN') {
      this.successCount++;

      if (this.successCount >= this.config.successThreshold) {
        this.transitionToClosed();
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(error: Error): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;
    this.totalFailures++;
    this.failures.push(this.lastFailureTime);

    // Clean up old failures outside monitoring period
    this.cleanupOldFailures();

    if (this.state === 'HALF_OPEN') {
      // Any failure in half-open state reopens circuit
      this.transitionToOpen();
    } else if (this.state === 'CLOSED') {
      // Check if we've exceeded failure threshold
      if (this.failureCount >= this.config.failureThreshold) {
        this.transitionToOpen();
      }
    }
  }

  /**
   * Check if we should attempt to reset circuit
   */
  private shouldAttemptReset(): boolean {
    if (!this.nextAttemptTime) {
      return false;
    }
    return Date.now() >= this.nextAttemptTime;
  }

  /**
   * Transition to CLOSED state (normal operation)
   */
  private transitionToClosed(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastStateChange = Date.now();
    this.nextAttemptTime = undefined;

    console.log(
      `[CircuitBreaker] ${this.providerName} (${this.providerId}): CLOSED - Normal operation resumed`
    );
  }

  /**
   * Transition to OPEN state (failing, reject requests)
   */
  private transitionToOpen(): void {
    this.state = 'OPEN';
    this.successCount = 0;
    this.lastStateChange = Date.now();
    this.nextAttemptTime = Date.now() + this.config.resetTimeout;

    console.error(
      `[CircuitBreaker] ${this.providerName} (${this.providerId}): OPEN - ` +
      `Failures: ${this.failureCount}, Will retry at: ${new Date(this.nextAttemptTime).toISOString()}`
    );
  }

  /**
   * Transition to HALF_OPEN state (testing recovery)
   */
  private transitionToHalfOpen(): void {
    this.state = 'HALF_OPEN';
    this.successCount = 0;
    this.failureCount = 0;
    this.lastStateChange = Date.now();

    console.log(
      `[CircuitBreaker] ${this.providerName} (${this.providerId}): HALF_OPEN - Testing recovery`
    );
  }

  /**
   * Remove failures outside the monitoring period
   */
  private cleanupOldFailures(): void {
    const cutoff = Date.now() - this.config.monitoringPeriod;
    this.failures = this.failures.filter(timestamp => timestamp > cutoff);
  }

  /**
   * Get current circuit breaker statistics
   */
  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      lastStateChange: this.lastStateChange,
      totalRequests: this.totalRequests,
      totalFailures: this.totalFailures,
    };
  }

  /**
   * Get current state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Check if circuit is healthy (CLOSED or HALF_OPEN)
   */
  isHealthy(): boolean {
    return this.state === 'CLOSED' || this.state === 'HALF_OPEN';
  }

  /**
   * Force circuit to open (useful for manual intervention)
   */
  forceOpen(): void {
    this.transitionToOpen();
  }

  /**
   * Force circuit to close (useful for manual intervention)
   */
  forceClose(): void {
    this.transitionToClosed();
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = undefined;
    this.lastStateChange = Date.now();
    this.nextAttemptTime = undefined;
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.failures = [];
  }

  /**
   * Get failure rate within monitoring period
   */
  getFailureRate(): number {
    if (this.totalRequests === 0) {
      return 0;
    }
    return this.failures.length / this.totalRequests;
  }

  /**
   * Get time until next retry attempt (if circuit is open)
   */
  getTimeUntilRetry(): number {
    if (this.state !== 'OPEN' || !this.nextAttemptTime) {
      return 0;
    }
    return Math.max(0, this.nextAttemptTime - Date.now());
  }
}

/**
 * Circuit Breaker Manager
 *
 * Manages multiple circuit breakers for different providers
 */
export class CircuitBreakerManager {
  private breakers = new Map<number, CircuitBreaker>();

  /**
   * Get or create circuit breaker for provider
   */
  getBreaker(
    providerId: number,
    providerName: string,
    config: CircuitBreakerConfig
  ): CircuitBreaker {
    if (!this.breakers.has(providerId)) {
      this.breakers.set(
        providerId,
        new CircuitBreaker(config, providerId, providerName)
      );
    }
    return this.breakers.get(providerId)!;
  }

  /**
   * Get all circuit breaker stats
   */
  getAllStats(): Map<number, CircuitBreakerStats> {
    const stats = new Map<number, CircuitBreakerStats>();
    for (const [providerId, breaker] of this.breakers) {
      stats.set(providerId, breaker.getStats());
    }
    return stats;
  }

  /**
   * Get all healthy providers
   */
  getHealthyProviders(): number[] {
    const healthy: number[] = [];
    for (const [providerId, breaker] of this.breakers) {
      if (breaker.isHealthy()) {
        healthy.push(providerId);
      }
    }
    return healthy;
  }

  /**
   * Get all unhealthy providers
   */
  getUnhealthyProviders(): number[] {
    const unhealthy: number[] = [];
    for (const [providerId, breaker] of this.breakers) {
      if (!breaker.isHealthy()) {
        unhealthy.push(providerId);
      }
    }
    return unhealthy;
  }

  /**
   * Reset all circuit breakers
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}
