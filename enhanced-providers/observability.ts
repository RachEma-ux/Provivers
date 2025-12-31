/**
 * Observability System
 *
 * Production-grade monitoring, metrics, and tracing for providers.
 *
 * Features:
 * - Metrics collection (latency, errors, tokens, costs)
 * - Distributed tracing
 * - Event streaming
 * - Health reporting
 * - Performance analytics
 */

import crypto from 'crypto';
import {
  ObservabilityConfig,
  Metrics,
  Trace,
  ObservabilityEvent,
  MetricExporter,
  CircuitState,
  PercentileStats,
} from './types-enhanced';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<ObservabilityConfig> = {
  enableMetrics: true,
  enableTracing: true,
  traceSampleRate: 1.0,
  metricExporters: [],
};

/**
 * Metric data point
 */
interface DataPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

/**
 * Observability system singleton
 */
class ObservabilitySystem {
  private config: Required<ObservabilityConfig>;

  // Metrics storage (provider ID -> metric name -> data points)
  private metrics = new Map<number, Map<string, DataPoint[]>>();

  // Active traces
  private traces = new Map<string, Trace>();

  // Event listeners
  private eventListeners: Array<(event: ObservabilityEvent) => void> = [];

  // Provider metadata
  private providerNames = new Map<number, string>();

  constructor(config: ObservabilityConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Start a new trace
   */
  startTrace(
    providerId: number,
    operation: string,
    parentSpanId?: string
  ): string {
    if (!this.config.enableTracing) {
      return '';
    }

    // Sample based on configured rate
    if (Math.random() > this.config.traceSampleRate) {
      return '';
    }

    const traceId = this.generateId();
    const spanId = this.generateId();

    const trace: Trace = {
      traceId,
      spanId,
      parentSpanId,
      providerId,
      operation,
      startTime: Date.now(),
      status: 'success',
    };

    this.traces.set(spanId, trace);

    return spanId;
  }

  /**
   * End a trace
   */
  endTrace(spanId: string, error?: Error): void {
    if (!spanId || !this.config.enableTracing) {
      return;
    }

    const trace = this.traces.get(spanId);
    if (!trace) {
      return;
    }

    trace.endTime = Date.now();
    trace.duration = trace.endTime - trace.startTime;
    trace.status = error ? 'error' : 'success';
    trace.error = error;

    console.log(
      `[Trace] ${trace.operation} (${spanId}): ` +
      `${trace.status} in ${trace.duration}ms`
    );

    // Clean up old traces after some time
    setTimeout(() => this.traces.delete(spanId), 60000);
  }

  /**
   * Record a metric
   */
  recordMetric(
    providerId: number,
    metricName: string,
    value: number,
    tags?: Record<string, string>
  ): void {
    if (!this.config.enableMetrics) {
      return;
    }

    if (!this.metrics.has(providerId)) {
      this.metrics.set(providerId, new Map());
    }

    const providerMetrics = this.metrics.get(providerId)!;

    if (!providerMetrics.has(metricName)) {
      providerMetrics.set(metricName, []);
    }

    const dataPoints = providerMetrics.get(metricName)!;
    dataPoints.push({
      timestamp: Date.now(),
      value,
      tags,
    });

    // Keep only last 1000 data points per metric
    if (dataPoints.length > 1000) {
      dataPoints.shift();
    }
  }

  /**
   * Emit an event
   */
  emitEvent(event: ObservabilityEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch (error) {
        console.error('[Observability] Event listener error:', error);
      }
    }
  }

  /**
   * Subscribe to events
   */
  onEvent(listener: (event: ObservabilityEvent) => void): () => void {
    this.eventListeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.eventListeners.indexOf(listener);
      if (index > -1) {
        this.eventListeners.splice(index, 1);
      }
    };
  }

  /**
   * Get metrics for a provider
   */
  getMetrics(
    providerId: number,
    periodStart?: number,
    periodEnd?: number
  ): Metrics {
    const providerMetrics = this.metrics.get(providerId);
    const providerName = this.providerNames.get(providerId) || 'Unknown';

    const now = Date.now();
    const start = periodStart || now - 3600000; // Default: last hour
    const end = periodEnd || now;

    if (!providerMetrics) {
      return this.emptyMetrics(providerId, providerName, start, end);
    }

    // Extract metric values within time period
    const latencies = this.getMetricValues(providerMetrics, 'latency', start, end);
    const totalRequests = this.getMetricSum(providerMetrics, 'request', start, end);
    const successfulRequests = this.getMetricSum(providerMetrics, 'success', start, end);
    const failedRequests = this.getMetricSum(providerMetrics, 'failure', start, end);
    const tokensUsed = this.getMetricSum(providerMetrics, 'tokens', start, end);
    const cacheHits = this.getMetricSum(providerMetrics, 'cache_hit', start, end);
    const cacheMisses = this.getMetricSum(providerMetrics, 'cache_miss', start, end);

    // Calculate percentiles
    const percentiles = this.calculatePercentiles(latencies);

    return {
      providerId,
      providerName,
      totalRequests,
      successfulRequests,
      failedRequests,
      latencyP50: percentiles.p50,
      latencyP95: percentiles.p95,
      latencyP99: percentiles.p99,
      averageLatency: this.average(latencies),
      totalTokensUsed: tokensUsed,
      averageTokensPerRequest: totalRequests > 0 ? tokensUsed / totalRequests : 0,
      estimatedCost: this.estimateCost(tokensUsed),
      costPerToken: 0.00001, // $0.01 per 1000 tokens
      cacheHits,
      cacheMisses,
      cacheHitRate: cacheHits + cacheMisses > 0
        ? cacheHits / (cacheHits + cacheMisses)
        : 0,
      cacheSavings: this.estimateCost(cacheHits * 1000), // Assume avg 1000 tokens saved
      circuitState: 'CLOSED', // This should be updated from circuit breaker
      circuitOpenCount: this.getMetricSum(providerMetrics, 'circuit_open', start, end),
      rateLimitHits: this.getMetricSum(providerMetrics, 'rate_limit', start, end),
      rateLimitRejections: this.getMetricSum(providerMetrics, 'rate_limit_reject', start, end),
      periodStart: start,
      periodEnd: end,
    };
  }

  /**
   * Get aggregated metrics for all providers
   */
  getAllMetrics(periodStart?: number, periodEnd?: number): Map<number, Metrics> {
    const allMetrics = new Map<number, Metrics>();

    for (const providerId of this.metrics.keys()) {
      allMetrics.set(
        providerId,
        this.getMetrics(providerId, periodStart, periodEnd)
      );
    }

    return allMetrics;
  }

  /**
   * Generate health report
   */
  getHealthReport(): {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    providers: Array<{
      id: number;
      name: string;
      status: 'healthy' | 'degraded' | 'unhealthy';
      metrics: Metrics;
      issues: string[];
    }>;
  } {
    const providers = [];
    let healthyCount = 0;
    let degradedCount = 0;
    let unhealthyCount = 0;

    for (const [providerId, providerName] of this.providerNames) {
      const metrics = this.getMetrics(providerId);
      const issues: string[] = [];

      // Check for issues
      if (metrics.circuitState === 'OPEN') {
        issues.push('Circuit breaker is OPEN');
      }

      const errorRate = metrics.totalRequests > 0
        ? metrics.failedRequests / metrics.totalRequests
        : 0;

      if (errorRate > 0.1) {
        issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
      }

      if (metrics.latencyP95 > 5000) {
        issues.push(`High P95 latency: ${metrics.latencyP95}ms`);
      }

      if (metrics.rateLimitRejections > 10) {
        issues.push(`Rate limit rejections: ${metrics.rateLimitRejections}`);
      }

      // Determine status
      let status: 'healthy' | 'degraded' | 'unhealthy';

      if (issues.length === 0) {
        status = 'healthy';
        healthyCount++;
      } else if (issues.length <= 2 && metrics.circuitState !== 'OPEN') {
        status = 'degraded';
        degradedCount++;
      } else {
        status = 'unhealthy';
        unhealthyCount++;
      }

      providers.push({
        id: providerId,
        name: providerName,
        status,
        metrics,
        issues,
      });
    }

    // Determine overall health
    let overall: 'healthy' | 'degraded' | 'unhealthy';

    if (unhealthyCount > 0 || (degradedCount > healthyCount)) {
      overall = 'unhealthy';
    } else if (degradedCount > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return { overall, providers };
  }

  /**
   * Register provider name
   */
  registerProvider(providerId: number, providerName: string): void {
    this.providerNames.set(providerId, providerName);
  }

  /**
   * Export metrics to configured exporters
   */
  async exportMetrics(): Promise<void> {
    const allMetrics = this.getAllMetrics();

    for (const exporter of this.config.metricExporters) {
      try {
        for (const metrics of allMetrics.values()) {
          await exporter.export(metrics);
        }
      } catch (error) {
        console.error('[Observability] Metric export error:', error);
      }
    }
  }

  /**
   * Helper: Get metric values within time range
   */
  private getMetricValues(
    providerMetrics: Map<string, DataPoint[]>,
    metricName: string,
    start: number,
    end: number
  ): number[] {
    const dataPoints = providerMetrics.get(metricName) || [];
    return dataPoints
      .filter(dp => dp.timestamp >= start && dp.timestamp <= end)
      .map(dp => dp.value);
  }

  /**
   * Helper: Get sum of metric values
   */
  private getMetricSum(
    providerMetrics: Map<string, DataPoint[]>,
    metricName: string,
    start: number,
    end: number
  ): number {
    const values = this.getMetricValues(providerMetrics, metricName, start, end);
    return values.reduce((sum, val) => sum + val, 0);
  }

  /**
   * Helper: Calculate percentiles
   */
  private calculatePercentiles(values: number[]): PercentileStats {
    if (values.length === 0) {
      return { p50: 0, p75: 0, p90: 0, p95: 0, p99: 0 };
    }

    const sorted = [...values].sort((a, b) => a - b);

    return {
      p50: this.percentile(sorted, 0.5),
      p75: this.percentile(sorted, 0.75),
      p90: this.percentile(sorted, 0.9),
      p95: this.percentile(sorted, 0.95),
      p99: this.percentile(sorted, 0.99),
    };
  }

  /**
   * Helper: Calculate percentile value
   */
  private percentile(sorted: number[], p: number): number {
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Helper: Calculate average
   */
  private average(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Helper: Estimate cost from tokens
   */
  private estimateCost(tokens: number): number {
    return (tokens / 1000) * 0.01; // $0.01 per 1000 tokens
  }

  /**
   * Helper: Generate unique ID
   */
  private generateId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Helper: Create empty metrics object
   */
  private emptyMetrics(
    providerId: number,
    providerName: string,
    start: number,
    end: number
  ): Metrics {
    return {
      providerId,
      providerName,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      latencyP50: 0,
      latencyP95: 0,
      latencyP99: 0,
      averageLatency: 0,
      totalTokensUsed: 0,
      averageTokensPerRequest: 0,
      estimatedCost: 0,
      costPerToken: 0.00001,
      cacheHits: 0,
      cacheMisses: 0,
      cacheHitRate: 0,
      cacheSavings: 0,
      circuitState: 'CLOSED',
      circuitOpenCount: 0,
      rateLimitHits: 0,
      rateLimitRejections: 0,
      periodStart: start,
      periodEnd: end,
    };
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.metrics.clear();
    this.traces.clear();
  }
}

// Singleton instance
let observabilityInstance: ObservabilitySystem | null = null;

/**
 * Get observability system instance
 */
export function getObservability(config?: ObservabilityConfig): ObservabilitySystem {
  if (!observabilityInstance) {
    observabilityInstance = new ObservabilitySystem(config);
  }
  return observabilityInstance;
}

/**
 * Console metric exporter
 */
export class ConsoleMetricExporter implements MetricExporter {
  async export(metrics: Metrics): Promise<void> {
    console.log('\n=== Provider Metrics ===');
    console.log(`Provider: ${metrics.providerName} (${metrics.providerId})`);
    console.log(`Requests: ${metrics.totalRequests} (Success: ${metrics.successfulRequests}, Failed: ${metrics.failedRequests})`);
    console.log(`Latency: P50=${metrics.latencyP50}ms, P95=${metrics.latencyP95}ms, P99=${metrics.latencyP99}ms`);
    console.log(`Tokens: ${metrics.totalTokensUsed} (Avg: ${metrics.averageTokensPerRequest.toFixed(0)}/request)`);
    console.log(`Cost: $${metrics.estimatedCost.toFixed(4)}`);
    console.log(`Cache: ${metrics.cacheHits} hits, ${metrics.cacheMisses} misses (${(metrics.cacheHitRate * 100).toFixed(1)}%)`);
    console.log(`Circuit: ${metrics.circuitState} (Opens: ${metrics.circuitOpenCount})`);
    console.log('========================\n');
  }
}

/**
 * JSON file metric exporter
 */
export class JSONFileMetricExporter implements MetricExporter {
  constructor(private filePath: string) {}

  async export(metrics: Metrics): Promise<void> {
    const fs = require('fs').promises;
    const data = JSON.stringify(metrics, null, 2);
    await fs.appendFile(this.filePath, data + '\n');
  }
}
