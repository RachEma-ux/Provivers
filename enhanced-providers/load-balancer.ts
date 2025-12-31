/**
 * Load Balancer Implementation
 *
 * Intelligently distributes requests across multiple providers.
 *
 * Strategies:
 * - Round Robin: Simple sequential distribution
 * - Weighted: Distribution based on provider weights
 * - Least Latency: Route to fastest provider
 * - Least Cost: Route to cheapest provider
 * - Health-Based: Route only to healthy providers
 *
 * Features:
 * - Automatic failover on provider failure
 * - Real-time health tracking
 * - Performance metrics
 * - Cost optimization
 */

import {
  LoadBalancingStrategy,
  LoadBalancerConfig,
  ProviderHealth,
  RoutingDecision,
  GenerationRequest,
  GenerationResponse,
  AllProvidersFailedError,
  CircuitState,
} from './types-enhanced';

/**
 * Provider interface for load balancer
 */
interface IProvider {
  id: number;
  name: string;
  generate(request: GenerationRequest): Promise<GenerationResponse>;
  getHealth(): ProviderHealth;
  isHealthy(): boolean;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<LoadBalancerConfig> = {
  type: 'round_robin',
  weights: new Map(),
  failover: true,
  maxFailoverAttempts: 3,
};

/**
 * Load Balancer class
 *
 * Usage:
 * ```typescript
 * const lb = new LoadBalancer({
 *   type: 'least_latency',
 *   failover: true
 * });
 *
 * lb.registerProvider(openaiProvider);
 * lb.registerProvider(anthropicProvider);
 *
 * const response = await lb.route(request);
 * ```
 */
export class LoadBalancer {
  private config: Required<LoadBalancerConfig>;
  private providers: Map<number, IProvider> = new Map();

  // Round-robin state
  private currentIndex: number = 0;

  // Performance tracking
  private latencies: Map<number, number[]> = new Map();
  private costs: Map<number, number[]> = new Map();
  private requestCounts: Map<number, number> = new Map();

  constructor(config: LoadBalancerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Register a provider with the load balancer
   */
  registerProvider(provider: IProvider): void {
    this.providers.set(provider.id, provider);
    this.latencies.set(provider.id, []);
    this.costs.set(provider.id, []);
    this.requestCounts.set(provider.id, 0);

    console.log(
      `[LoadBalancer] Registered provider: ${provider.name} (${provider.id})`
    );
  }

  /**
   * Unregister a provider
   */
  unregisterProvider(providerId: number): void {
    this.providers.delete(providerId);
    this.latencies.delete(providerId);
    this.costs.delete(providerId);
    this.requestCounts.delete(providerId);

    console.log(`[LoadBalancer] Unregistered provider: ${providerId}`);
  }

  /**
   * Route request to appropriate provider
   */
  async route(request: GenerationRequest): Promise<GenerationResponse> {
    const attempts: Map<number, Error> = new Map();
    let attemptCount = 0;

    while (attemptCount < this.config.maxFailoverAttempts) {
      try {
        // Select provider based on strategy
        const decision = this.selectProvider(Array.from(attempts.keys()));

        if (!decision) {
          throw new AllProvidersFailedError(
            Array.from(this.providers.keys()),
            attempts
          );
        }

        const provider = this.providers.get(decision.providerId)!;

        console.log(
          `[LoadBalancer] Routing to ${provider.name} (${provider.id}): ${decision.reason}`
        );

        // Execute request with timing
        const startTime = Date.now();
        const response = await provider.generate(request);
        const latency = Date.now() - startTime;

        // Track metrics
        this.trackMetrics(provider.id, latency, response);

        return response;
      } catch (error) {
        attemptCount++;
        const providerId = this.providers.values().next().value?.id;
        if (providerId) {
          attempts.set(providerId, error as Error);
        }

        if (!this.config.failover || attemptCount >= this.config.maxFailoverAttempts) {
          throw error;
        }

        console.warn(
          `[LoadBalancer] Provider failed, attempting failover ` +
          `(${attemptCount}/${this.config.maxFailoverAttempts})`
        );
      }
    }

    throw new AllProvidersFailedError(
      Array.from(this.providers.keys()),
      attempts
    );
  }

  /**
   * Select provider based on configured strategy
   */
  private selectProvider(excludeProviders: number[]): RoutingDecision | null {
    const availableProviders = this.getAvailableProviders(excludeProviders);

    if (availableProviders.length === 0) {
      return null;
    }

    switch (this.config.type) {
      case 'round_robin':
        return this.selectRoundRobin(availableProviders);

      case 'weighted':
        return this.selectWeighted(availableProviders);

      case 'least_latency':
        return this.selectLeastLatency(availableProviders);

      case 'least_cost':
        return this.selectLeastCost(availableProviders);

      case 'health_based':
        return this.selectHealthBased(availableProviders);

      default:
        return this.selectRoundRobin(availableProviders);
    }
  }

  /**
   * Get available (healthy) providers
   */
  private getAvailableProviders(exclude: number[]): IProvider[] {
    return Array.from(this.providers.values()).filter(
      provider => !exclude.includes(provider.id) && provider.isHealthy()
    );
  }

  /**
   * Round-robin selection
   */
  private selectRoundRobin(providers: IProvider[]): RoutingDecision {
    const provider = providers[this.currentIndex % providers.length];
    this.currentIndex = (this.currentIndex + 1) % providers.length;

    return {
      providerId: provider.id,
      reason: 'round_robin',
      alternativeProviders: providers
        .filter(p => p.id !== provider.id)
        .map(p => p.id),
    };
  }

  /**
   * Weighted selection
   */
  private selectWeighted(providers: IProvider[]): RoutingDecision {
    // Calculate total weight
    let totalWeight = 0;
    const weights: Array<{ provider: IProvider; weight: number }> = [];

    for (const provider of providers) {
      const weight = this.config.weights.get(provider.id) || 1;
      totalWeight += weight;
      weights.push({ provider, weight });
    }

    // Random selection based on weights
    let random = Math.random() * totalWeight;

    for (const { provider, weight } of weights) {
      random -= weight;
      if (random <= 0) {
        return {
          providerId: provider.id,
          reason: `weighted (weight: ${weight})`,
          alternativeProviders: providers
            .filter(p => p.id !== provider.id)
            .map(p => p.id),
        };
      }
    }

    // Fallback to first provider
    return {
      providerId: providers[0].id,
      reason: 'weighted (fallback)',
      alternativeProviders: providers.slice(1).map(p => p.id),
    };
  }

  /**
   * Least latency selection
   */
  private selectLeastLatency(providers: IProvider[]): RoutingDecision {
    let bestProvider = providers[0];
    let bestLatency = this.getAverageLatency(bestProvider.id);

    for (const provider of providers.slice(1)) {
      const latency = this.getAverageLatency(provider.id);
      if (latency < bestLatency) {
        bestProvider = provider;
        bestLatency = latency;
      }
    }

    return {
      providerId: bestProvider.id,
      reason: `least_latency (${Math.round(bestLatency)}ms)`,
      alternativeProviders: providers
        .filter(p => p.id !== bestProvider.id)
        .map(p => p.id),
    };
  }

  /**
   * Least cost selection
   */
  private selectLeastCost(providers: IProvider[]): RoutingDecision {
    let bestProvider = providers[0];
    let bestCost = this.getAverageCost(bestProvider.id);

    for (const provider of providers.slice(1)) {
      const cost = this.getAverageCost(provider.id);
      if (cost < bestCost) {
        bestProvider = provider;
        bestCost = cost;
      }
    }

    return {
      providerId: bestProvider.id,
      reason: `least_cost ($${bestCost.toFixed(4)})`,
      alternativeProviders: providers
        .filter(p => p.id !== bestProvider.id)
        .map(p => p.id),
    };
  }

  /**
   * Health-based selection
   */
  private selectHealthBased(providers: IProvider[]): RoutingDecision {
    // Score providers based on health metrics
    const scores = providers.map(provider => {
      const health = provider.getHealth();

      // Score components (0-1, higher is better)
      const circuitScore = health.circuitState === 'CLOSED' ? 1.0 : 0.0;
      const latencyScore = 1.0 - Math.min(health.latencyP95 / 10000, 1.0);
      const errorScore = 1.0 - health.errorRate;

      // Weighted average
      const totalScore =
        circuitScore * 0.5 +
        latencyScore * 0.3 +
        errorScore * 0.2;

      return { provider, score: totalScore, health };
    });

    // Sort by score (descending)
    scores.sort((a, b) => b.score - a.score);

    const best = scores[0];

    return {
      providerId: best.provider.id,
      reason: `health_based (score: ${best.score.toFixed(2)})`,
      alternativeProviders: scores.slice(1).map(s => s.provider.id),
    };
  }

  /**
   * Track metrics for a provider
   */
  private trackMetrics(
    providerId: number,
    latency: number,
    response: GenerationResponse
  ): void {
    // Track latency (keep last 100 samples)
    const latencyArray = this.latencies.get(providerId) || [];
    latencyArray.push(latency);
    if (latencyArray.length > 100) {
      latencyArray.shift();
    }
    this.latencies.set(providerId, latencyArray);

    // Estimate cost (this is a simplified estimate)
    const cost = this.estimateCost(response);
    const costArray = this.costs.get(providerId) || [];
    costArray.push(cost);
    if (costArray.length > 100) {
      costArray.shift();
    }
    this.costs.set(providerId, costArray);

    // Track request count
    const count = this.requestCounts.get(providerId) || 0;
    this.requestCounts.set(providerId, count + 1);
  }

  /**
   * Estimate cost of a response (simplified)
   */
  private estimateCost(response: GenerationResponse): number {
    // Simple cost estimation: $0.01 per 1000 tokens
    return (response.usage.totalTokens / 1000) * 0.01;
  }

  /**
   * Get average latency for a provider
   */
  private getAverageLatency(providerId: number): number {
    const latencies = this.latencies.get(providerId) || [];
    if (latencies.length === 0) {
      return Infinity; // Penalize providers with no history
    }

    return latencies.reduce((sum, lat) => sum + lat, 0) / latencies.length;
  }

  /**
   * Get average cost for a provider
   */
  private getAverageCost(providerId: number): number {
    const costs = this.costs.get(providerId) || [];
    if (costs.length === 0) {
      return Infinity; // Penalize providers with no history
    }

    return costs.reduce((sum, cost) => sum + cost, 0) / costs.length;
  }

  /**
   * Get statistics for all providers
   */
  getStats(): Map<number, {
    requestCount: number;
    averageLatency: number;
    averageCost: number;
    health: ProviderHealth;
  }> {
    const stats = new Map();

    for (const [providerId, provider] of this.providers) {
      stats.set(providerId, {
        requestCount: this.requestCounts.get(providerId) || 0,
        averageLatency: this.getAverageLatency(providerId),
        averageCost: this.getAverageCost(providerId),
        health: provider.getHealth(),
      });
    }

    return stats;
  }

  /**
   * Get distribution of requests across providers
   */
  getDistribution(): Map<number, number> {
    const total = Array.from(this.requestCounts.values()).reduce(
      (sum, count) => sum + count,
      0
    );

    const distribution = new Map<number, number>();

    for (const [providerId, count] of this.requestCounts) {
      distribution.set(providerId, total > 0 ? count / total : 0);
    }

    return distribution;
  }

  /**
   * Reset all statistics
   */
  resetStats(): void {
    for (const providerId of this.providers.keys()) {
      this.latencies.set(providerId, []);
      this.costs.set(providerId, []);
      this.requestCounts.set(providerId, 0);
    }
    this.currentIndex = 0;
  }

  /**
   * Update load balancing strategy
   */
  updateStrategy(strategy: LoadBalancingStrategy): void {
    this.config.type = strategy;
    console.log(`[LoadBalancer] Strategy updated to: ${strategy}`);
  }

  /**
   * Set provider weight (for weighted strategy)
   */
  setWeight(providerId: number, weight: number): void {
    this.config.weights.set(providerId, weight);
    console.log(
      `[LoadBalancer] Set weight for provider ${providerId}: ${weight}`
    );
  }
}

/**
 * Smart Load Balancer
 *
 * Automatically switches strategies based on conditions
 */
export class SmartLoadBalancer extends LoadBalancer {
  private strategyHistory: LoadBalancingStrategy[] = [];

  async route(request: GenerationRequest): Promise<GenerationResponse> {
    // Analyze current conditions
    const healthyProviders = this.getHealthyProviderCount();

    // Switch strategy based on conditions
    if (healthyProviders <= 1) {
      this.updateStrategy('round_robin'); // Simple when few providers
    } else if (this.isHighLoad()) {
      this.updateStrategy('least_latency'); // Optimize latency under load
    } else if (this.isCostSensitive()) {
      this.updateStrategy('least_cost'); // Optimize cost when possible
    } else {
      this.updateStrategy('health_based'); // Default to health-based
    }

    return super.route(request);
  }

  private getHealthyProviderCount(): number {
    const stats = this.getStats();
    let count = 0;

    for (const stat of stats.values()) {
      if (stat.health.isHealthy) {
        count++;
      }
    }

    return count;
  }

  private isHighLoad(): boolean {
    const stats = this.getStats();
    let totalRequests = 0;

    for (const stat of stats.values()) {
      totalRequests += stat.requestCount;
    }

    // Consider high load if more than 100 requests tracked
    return totalRequests > 100;
  }

  private isCostSensitive(): boolean {
    const stats = this.getStats();
    let totalCost = 0;
    let count = 0;

    for (const stat of stats.values()) {
      totalCost += stat.averageCost;
      count++;
    }

    const averageCost = count > 0 ? totalCost / count : 0;

    // Cost sensitive if average cost is high (>$0.05 per request)
    return averageCost > 0.05;
  }
}
