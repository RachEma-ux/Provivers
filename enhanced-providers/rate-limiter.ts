/**
 * Rate Limiter Implementation
 *
 * Token bucket algorithm for rate limiting API requests.
 * Prevents exceeding provider quotas and manages both request count and token usage.
 *
 * Features:
 * - Dual limits: requests per minute AND tokens per minute
 * - Token bucket algorithm with automatic refill
 * - Graceful handling of quota exhaustion
 * - Burst support for temporary spikes
 * - Token return on actual usage (prevents over-reservation)
 */

import {
  RateLimitConfig,
  RateLimitState,
  RateLimitExceededError,
  AsyncFunction,
} from './types-enhanced';

/**
 * Default rate limit configuration
 */
const DEFAULT_CONFIG: Required<RateLimitConfig> = {
  requestsPerMinute: 60,
  tokensPerMinute: 100000,
  burstSize: 10,
  penaltyMs: 5000,
};

/**
 * Rate Limiter class
 *
 * Implements token bucket algorithm for both request count and token limits
 *
 * Usage:
 * ```typescript
 * const limiter = new RateLimiter({
 *   requestsPerMinute: 60,
 *   tokensPerMinute: 100000
 * }, 1, 'OpenAI');
 *
 * // Acquire permission for request
 * await limiter.acquire(estimatedTokens);
 *
 * // Make API call
 * const response = await apiCall();
 *
 * // Return unused tokens
 * limiter.returnTokens(estimatedTokens - actualTokens);
 * ```
 */
export class RateLimiter {
  private config: Required<RateLimitConfig>;

  // Token buckets
  private requestTokens: number;
  private tokenQuota: number;

  // Timing
  private lastRefill: number = Date.now();
  private penaltyUntil?: number;

  // Statistics
  private pendingRequests: number = 0;
  private rejectedRequests: number = 0;
  private totalRequests: number = 0;
  private totalTokensUsed: number = 0;

  constructor(
    config: RateLimitConfig,
    private providerId: number,
    private providerName: string
  ) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize buckets to full capacity
    this.requestTokens = this.config.requestsPerMinute + this.config.burstSize;
    this.tokenQuota = this.config.tokensPerMinute;
  }

  /**
   * Acquire permission for a request
   * @param estimatedTokens Estimated token usage for this request
   * @returns Promise that resolves when permission is granted
   */
  async acquire(estimatedTokens: number = 1000): Promise<void> {
    this.totalRequests++;
    this.pendingRequests++;

    try {
      // Check if we're in penalty period
      if (this.penaltyUntil && Date.now() < this.penaltyUntil) {
        const waitTime = this.penaltyUntil - Date.now();
        throw this.createRateLimitError(waitTime);
      }

      // Refill buckets based on time elapsed
      this.refill();

      // Check if we have enough tokens
      if (this.requestTokens < 1) {
        const waitTime = this.calculateWaitTime('requests');
        throw this.createRateLimitError(waitTime);
      }

      if (this.tokenQuota < estimatedTokens) {
        const waitTime = this.calculateWaitTime('tokens');
        throw this.createRateLimitError(waitTime);
      }

      // Consume tokens
      this.requestTokens -= 1;
      this.tokenQuota -= estimatedTokens;
      this.totalTokensUsed += estimatedTokens;

      console.log(
        `[RateLimiter] ${this.providerName}: Acquired ` +
        `(requests: ${Math.floor(this.requestTokens)}/${this.config.requestsPerMinute}, ` +
        `tokens: ${Math.floor(this.tokenQuota)}/${this.config.tokensPerMinute})`
      );
    } finally {
      this.pendingRequests--;
    }
  }

  /**
   * Return unused tokens (e.g., when actual usage is less than estimated)
   */
  returnTokens(tokens: number): void {
    if (tokens > 0) {
      this.tokenQuota = Math.min(
        this.tokenQuota + tokens,
        this.config.tokensPerMinute
      );

      console.log(
        `[RateLimiter] ${this.providerName}: Returned ${tokens} tokens ` +
        `(quota: ${Math.floor(this.tokenQuota)}/${this.config.tokensPerMinute})`
      );
    }
  }

  /**
   * Refill token buckets based on elapsed time
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.lastRefill;

    // Refill rate: tokens per millisecond
    const requestRefillRate = this.config.requestsPerMinute / 60000;
    const tokenRefillRate = this.config.tokensPerMinute / 60000;

    // Calculate refill amounts
    const requestRefill = elapsed * requestRefillRate;
    const tokenRefill = elapsed * tokenRefillRate;

    // Refill buckets (with burst allowance for requests)
    const maxRequestTokens = this.config.requestsPerMinute + this.config.burstSize;
    this.requestTokens = Math.min(
      this.requestTokens + requestRefill,
      maxRequestTokens
    );

    this.tokenQuota = Math.min(
      this.tokenQuota + tokenRefill,
      this.config.tokensPerMinute
    );

    this.lastRefill = now;
  }

  /**
   * Calculate wait time until tokens are available
   */
  private calculateWaitTime(type: 'requests' | 'tokens'): number {
    if (type === 'requests') {
      // Time until 1 request token is available
      const tokensNeeded = 1;
      const refillRate = this.config.requestsPerMinute / 60000;
      return Math.ceil(tokensNeeded / refillRate);
    } else {
      // Time until enough tokens are available
      const tokensNeeded = this.config.tokensPerMinute * 0.1; // Wait for 10% refill
      const refillRate = this.config.tokensPerMinute / 60000;
      return Math.ceil(tokensNeeded / refillRate);
    }
  }

  /**
   * Create rate limit exceeded error
   */
  private createRateLimitError(retryAfterMs: number): RateLimitExceededError {
    this.rejectedRequests++;
    this.penaltyUntil = Date.now() + this.config.penaltyMs;

    console.warn(
      `[RateLimiter] ${this.providerName}: Rate limit exceeded. ` +
      `Retry after ${retryAfterMs}ms`
    );

    return new RateLimitExceededError(
      this.providerId,
      this.providerName,
      retryAfterMs
    );
  }

  /**
   * Get current state
   */
  getState(): RateLimitState {
    this.refill(); // Update state before returning

    return {
      requestTokens: this.requestTokens,
      tokenQuota: this.tokenQuota,
      lastRefill: this.lastRefill,
      pendingRequests: this.pendingRequests,
      rejectedRequests: this.rejectedRequests,
    };
  }

  /**
   * Get statistics
   */
  getStats(): {
    totalRequests: number;
    rejectedRequests: number;
    acceptanceRate: number;
    totalTokensUsed: number;
    averageTokensPerRequest: number;
    currentUtilization: {
      requests: number;
      tokens: number;
    };
  } {
    const state = this.getState();
    const acceptanceRate = this.totalRequests > 0
      ? (this.totalRequests - this.rejectedRequests) / this.totalRequests
      : 1;

    const averageTokensPerRequest = this.totalRequests > 0
      ? this.totalTokensUsed / this.totalRequests
      : 0;

    return {
      totalRequests: this.totalRequests,
      rejectedRequests: this.rejectedRequests,
      acceptanceRate,
      totalTokensUsed: this.totalTokensUsed,
      averageTokensPerRequest,
      currentUtilization: {
        requests: 1 - (state.requestTokens / this.config.requestsPerMinute),
        tokens: 1 - (state.tokenQuota / this.config.tokensPerMinute),
      },
    };
  }

  /**
   * Check if rate limiter is available (not in penalty period)
   */
  isAvailable(): boolean {
    if (this.penaltyUntil && Date.now() < this.penaltyUntil) {
      return false;
    }

    this.refill();
    return this.requestTokens >= 1;
  }

  /**
   * Get time until available (0 if available now)
   */
  getTimeUntilAvailable(): number {
    if (this.penaltyUntil && Date.now() < this.penaltyUntil) {
      return this.penaltyUntil - Date.now();
    }

    this.refill();

    if (this.requestTokens >= 1) {
      return 0;
    }

    return this.calculateWaitTime('requests');
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.requestTokens = this.config.requestsPerMinute + this.config.burstSize;
    this.tokenQuota = this.config.tokensPerMinute;
    this.lastRefill = Date.now();
    this.penaltyUntil = undefined;
    this.pendingRequests = 0;
    this.rejectedRequests = 0;
    this.totalRequests = 0;
    this.totalTokensUsed = 0;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}

/**
 * Adaptive Rate Limiter
 *
 * Automatically adjusts rate limits based on API responses
 */
export class AdaptiveRateLimiter extends RateLimiter {
  private adaptiveMultiplier: number = 1.0;

  /**
   * Handle API response to adjust rate limits
   */
  handleResponse(statusCode: number, headers: Record<string, string>): void {
    // Check for rate limit headers
    const remaining = headers['x-ratelimit-remaining'];
    const reset = headers['x-ratelimit-reset'];

    if (remaining !== undefined) {
      const remainingRequests = parseInt(remaining, 10);

      // If we're getting close to limit, slow down
      if (remainingRequests < 5) {
        this.adaptiveMultiplier = 0.5;
        console.warn(
          `[AdaptiveRateLimiter] Slowing down due to low remaining requests: ${remainingRequests}`
        );
      } else {
        this.adaptiveMultiplier = 1.0;
      }
    }

    // Handle 429 Too Many Requests
    if (statusCode === 429) {
      this.adaptiveMultiplier = 0.25; // Drastically reduce rate

      if (reset) {
        const resetTime = parseInt(reset, 10) * 1000;
        const waitTime = resetTime - Date.now();
        console.error(
          `[AdaptiveRateLimiter] 429 received. Waiting ${waitTime}ms until reset.`
        );
      }
    }
  }

  /**
   * Override acquire to apply adaptive multiplier
   */
  async acquire(estimatedTokens: number = 1000): Promise<void> {
    // Apply adaptive multiplier to estimated tokens
    const adjustedTokens = Math.ceil(estimatedTokens / this.adaptiveMultiplier);
    return super.acquire(adjustedTokens);
  }
}

/**
 * Rate Limiter Pool
 *
 * Manages rate limiters for multiple providers
 */
export class RateLimiterPool {
  private limiters = new Map<number, RateLimiter>();

  /**
   * Get or create rate limiter for provider
   */
  getLimiter(
    providerId: number,
    providerName: string,
    config: RateLimitConfig
  ): RateLimiter {
    if (!this.limiters.has(providerId)) {
      this.limiters.set(
        providerId,
        new RateLimiter(config, providerId, providerName)
      );
    }
    return this.limiters.get(providerId)!;
  }

  /**
   * Get all rate limiter stats
   */
  getAllStats(): Map<number, ReturnType<RateLimiter['getStats']>> {
    const stats = new Map();
    for (const [providerId, limiter] of this.limiters) {
      stats.set(providerId, limiter.getStats());
    }
    return stats;
  }

  /**
   * Get all available providers
   */
  getAvailableProviders(): number[] {
    const available: number[] = [];
    for (const [providerId, limiter] of this.limiters) {
      if (limiter.isAvailable()) {
        available.push(providerId);
      }
    }
    return available;
  }

  /**
   * Reset all rate limiters
   */
  resetAll(): void {
    for (const limiter of this.limiters.values()) {
      limiter.reset();
    }
  }
}
