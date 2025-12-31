/**
 * Retry Manager Implementation
 *
 * Provides intelligent retry logic with exponential backoff and jitter.
 * Handles transient failures gracefully with configurable retry policies.
 *
 * Features:
 * - Exponential backoff to avoid overwhelming failing services
 * - Jitter to prevent thundering herd problem
 * - Configurable retry conditions
 * - Detailed retry statistics
 */

import { RetryConfig, RetryStats, AsyncFunction } from './types-enhanced';

/**
 * Default retry configuration
 */
const DEFAULT_CONFIG: Required<Omit<RetryConfig, 'retryableErrors'>> & {
  retryableErrors: (error: Error) => boolean;
} = {
  maxRetries: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
  jitter: true,
  retryableErrors: isDefaultRetryableError,
};

/**
 * Default function to determine if an error is retryable
 */
function isDefaultRetryableError(error: Error): boolean {
  const retryablePatterns = [
    /timeout/i,
    /ETIMEDOUT/i,
    /ECONNRESET/i,
    /ECONNREFUSED/i,
    /ENOTFOUND/i,
    /network/i,
    /socket hang up/i,
    /rate limit/i,
    /429/,
    /500/,
    /502/,
    /503/,
    /504/,
  ];

  const errorMessage = error.message || error.toString();
  return retryablePatterns.some(pattern => pattern.test(errorMessage));
}

/**
 * Retry Manager class
 *
 * Usage:
 * ```typescript
 * const retryManager = new RetryManager({
 *   maxRetries: 3,
 *   initialDelayMs: 1000
 * });
 *
 * const result = await retryManager.execute(async () => {
 *   return await riskyOperation();
 * });
 * ```
 */
export class RetryManager {
  private config: Required<Omit<RetryConfig, 'retryableErrors'>> & {
    retryableErrors: (error: Error) => boolean;
  };

  // Statistics
  private totalAttempts: number = 0;
  private totalRetries: number = 0;
  private successfulRetries: number = 0;
  private failedRetries: number = 0;

  constructor(config: RetryConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      retryableErrors: config.retryableErrors || DEFAULT_CONFIG.retryableErrors,
    };
  }

  /**
   * Execute a function with retry logic
   */
  async execute<T>(
    fn: AsyncFunction<T>,
    context?: { providerId?: number; providerName?: string }
  ): Promise<T> {
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt <= this.config.maxRetries) {
      this.totalAttempts++;

      try {
        const result = await fn();

        // Success!
        if (attempt > 0) {
          this.successfulRetries++;
          console.log(
            `[RetryManager] ${context?.providerName || 'Provider'}: ` +
            `Succeeded on attempt ${attempt + 1}/${this.config.maxRetries + 1}`
          );
        }

        return result;
      } catch (error) {
        lastError = error as Error;

        // Check if error is retryable
        if (!this.config.retryableErrors(lastError)) {
          console.log(
            `[RetryManager] ${context?.providerName || 'Provider'}: ` +
            `Error is not retryable: ${lastError.message}`
          );
          throw lastError;
        }

        // Check if we have retries left
        if (attempt >= this.config.maxRetries) {
          this.failedRetries++;
          console.error(
            `[RetryManager] ${context?.providerName || 'Provider'}: ` +
            `All ${this.config.maxRetries} retries exhausted. Last error: ${lastError.message}`
          );
          throw lastError;
        }

        // Calculate delay for next retry
        const delay = this.calculateDelay(attempt);
        this.totalRetries++;

        console.log(
          `[RetryManager] ${context?.providerName || 'Provider'}: ` +
          `Attempt ${attempt + 1} failed: ${lastError.message}. ` +
          `Retrying in ${delay}ms... (${attempt + 1}/${this.config.maxRetries} retries)`
        );

        // Wait before retrying
        await this.sleep(delay);

        attempt++;
      }
    }

    // This should never be reached, but TypeScript needs it
    throw lastError || new Error('Retry failed with unknown error');
  }

  /**
   * Calculate delay for next retry with exponential backoff and jitter
   */
  private calculateDelay(attempt: number): number {
    // Exponential backoff: initialDelay * (multiplier ^ attempt)
    let delay = this.config.initialDelayMs * Math.pow(this.config.backoffMultiplier, attempt);

    // Cap at maximum delay
    delay = Math.min(delay, this.config.maxDelayMs);

    // Add jitter if enabled (randomize ±25%)
    if (this.config.jitter) {
      const jitterRange = delay * 0.25;
      const jitter = Math.random() * jitterRange * 2 - jitterRange;
      delay = delay + jitter;
    }

    return Math.round(delay);
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get retry statistics
   */
  getStats(): {
    totalAttempts: number;
    totalRetries: number;
    successfulRetries: number;
    failedRetries: number;
    retryRate: number;
    successRate: number;
  } {
    const retryRate = this.totalAttempts > 0
      ? this.totalRetries / this.totalAttempts
      : 0;

    const successRate = this.totalRetries > 0
      ? this.successfulRetries / this.totalRetries
      : 0;

    return {
      totalAttempts: this.totalAttempts,
      totalRetries: this.totalRetries,
      successfulRetries: this.successfulRetries,
      failedRetries: this.failedRetries,
      retryRate,
      successRate,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.totalAttempts = 0;
    this.totalRetries = 0;
    this.successfulRetries = 0;
    this.failedRetries = 0;
  }

  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = {
      ...this.config,
      ...config,
      retryableErrors: config.retryableErrors || this.config.retryableErrors,
    };
  }
}

/**
 * Retry with timeout
 *
 * Combines retry logic with a timeout to prevent indefinite hanging
 */
export class RetryWithTimeout extends RetryManager {
  constructor(
    config: RetryConfig,
    private timeoutMs: number = 30000
  ) {
    super(config);
  }

  /**
   * Execute with timeout
   */
  async execute<T>(
    fn: AsyncFunction<T>,
    context?: { providerId?: number; providerName?: string }
  ): Promise<T> {
    return Promise.race([
      super.execute(fn, context),
      this.createTimeout(),
    ]);
  }

  /**
   * Create timeout promise
   */
  private createTimeout(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });
  }
}

/**
 * Retry strategies for common scenarios
 */
export const RetryStrategies = {
  /**
   * Aggressive retry for critical operations
   */
  AGGRESSIVE: {
    maxRetries: 5,
    initialDelayMs: 500,
    maxDelayMs: 10000,
    backoffMultiplier: 1.5,
    jitter: true,
  } as RetryConfig,

  /**
   * Conservative retry for cost-sensitive operations
   */
  CONSERVATIVE: {
    maxRetries: 2,
    initialDelayMs: 2000,
    maxDelayMs: 30000,
    backoffMultiplier: 3,
    jitter: true,
  } as RetryConfig,

  /**
   * Fast retry for time-sensitive operations
   */
  FAST: {
    maxRetries: 3,
    initialDelayMs: 100,
    maxDelayMs: 5000,
    backoffMultiplier: 2,
    jitter: true,
  } as RetryConfig,

  /**
   * Balanced retry for general use
   */
  BALANCED: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true,
  } as RetryConfig,

  /**
   * No retry - fail fast
   */
  NO_RETRY: {
    maxRetries: 0,
    initialDelayMs: 0,
    maxDelayMs: 0,
    backoffMultiplier: 1,
    jitter: false,
  } as RetryConfig,
};

/**
 * Utility function to create retry manager with preset strategy
 */
export function createRetryManager(
  strategy: keyof typeof RetryStrategies = 'BALANCED'
): RetryManager {
  return new RetryManager(RetryStrategies[strategy]);
}

/**
 * Decorator for automatic retry on methods
 *
 * Usage:
 * ```typescript
 * class MyClass {
 *   @Retryable({ maxRetries: 3 })
 *   async myMethod() {
 *     // Method will automatically retry on failure
 *   }
 * }
 * ```
 */
export function Retryable(config: RetryConfig = RetryStrategies.BALANCED) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const retryManager = new RetryManager(config);

    descriptor.value = async function (...args: any[]) {
      return retryManager.execute(async () => {
        return await originalMethod.apply(this, args);
      });
    };

    return descriptor;
  };
}
