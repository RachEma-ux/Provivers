/**
 * Complete Demo: All Enhanced Provider Features
 *
 * This example demonstrates every feature of the enhanced providers module:
 * 1. Basic provider usage
 * 2. Load balancing
 * 3. Circuit breaker in action
 * 4. Retry mechanism
 * 5. Caching benefits
 * 6. Rate limiting
 * 7. Observability and monitoring
 */

import { OpenAIProvider } from './openai-provider';
import { AnthropicProvider } from './anthropic-provider';
import { LoadBalancer } from '../load-balancer';
import { getObservability, ConsoleMetricExporter } from '../observability';
import { GenerationRequest } from '../types-enhanced';

/**
 * Demo 1: Basic Provider Usage
 */
async function demo1_basicUsage() {
  console.log('\n========== DEMO 1: Basic Provider Usage ==========\n');

  // Create provider with all enhancements enabled
  const provider = new OpenAIProvider(process.env.OPENAI_API_KEY || 'sk-test-key');

  // Make a simple request
  try {
    const response = await provider.generate({
      prompt: 'What is the capital of France?',
      maxTokens: 50,
      temperature: 0.7,
    });

    console.log('Response:', response.content);
    console.log('Tokens used:', response.usage.totalTokens);
  } catch (error) {
    console.error('Error:', error);
  }

  // Check provider health
  const health = provider.getHealth();
  console.log('\nProvider Health:', {
    isHealthy: health.isHealthy,
    circuitState: health.circuitState,
    latencyP95: health.latencyP95 + 'ms',
    errorRate: (health.errorRate * 100).toFixed(1) + '%',
  });
}

/**
 * Demo 2: Load Balancing Across Multiple Providers
 */
async function demo2_loadBalancing() {
  console.log('\n========== DEMO 2: Load Balancing ==========\n');

  // Create multiple providers
  const openai = new OpenAIProvider(process.env.OPENAI_API_KEY || 'sk-test-key');
  const anthropic = new AnthropicProvider(process.env.ANTHROPIC_API_KEY || 'sk-ant-test-key');

  // Create load balancer with least-latency strategy
  const lb = new LoadBalancer({ type: 'least_latency', failover: true });
  lb.registerProvider(openai);
  lb.registerProvider(anthropic);

  // Make several requests
  const requests: GenerationRequest[] = [
    { prompt: 'What is AI?', maxTokens: 100 },
    { prompt: 'Explain machine learning', maxTokens: 100 },
    { prompt: 'What is deep learning?', maxTokens: 100 },
  ];

  for (const request of requests) {
    try {
      const response = await lb.route(request);
      console.log(`Response from: ${response.model}`);
      console.log(`Preview: ${response.content.substring(0, 50)}...`);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  // Show load distribution
  const distribution = lb.getDistribution();
  console.log('\nLoad Distribution:');
  for (const [providerId, percentage] of distribution) {
    console.log(`  Provider ${providerId}: ${(percentage * 100).toFixed(1)}%`);
  }

  // Show performance stats
  const stats = lb.getStats();
  console.log('\nPerformance Stats:');
  for (const [providerId, stat] of stats) {
    console.log(`  Provider ${providerId}:`);
    console.log(`    Requests: ${stat.requestCount}`);
    console.log(`    Avg Latency: ${Math.round(stat.averageLatency)}ms`);
    console.log(`    Avg Cost: $${stat.averageCost.toFixed(4)}`);
  }
}

/**
 * Demo 3: Circuit Breaker Protection
 */
async function demo3_circuitBreaker() {
  console.log('\n========== DEMO 3: Circuit Breaker ==========\n');

  // Create a provider
  const provider = new OpenAIProvider('invalid-api-key'); // Intentionally wrong key

  // Make multiple requests to trigger circuit breaker
  for (let i = 1; i <= 7; i++) {
    try {
      console.log(`\nAttempt ${i}:`);
      await provider.generate({
        prompt: 'Test prompt',
        maxTokens: 10,
      });
    } catch (error: any) {
      console.log(`  Error: ${error.message}`);

      // Check circuit state
      const stats = provider.getCircuitBreakerStats();
      if (stats) {
        console.log(`  Circuit State: ${stats.state}`);
        console.log(`  Failure Count: ${stats.failureCount}`);
      }
    }
  }

  console.log('\nCircuit breaker prevented wasted requests after threshold!');
}

/**
 * Demo 4: Automatic Retry
 */
async function demo4_retry() {
  console.log('\n========== DEMO 4: Automatic Retry ==========\n');

  const provider = new OpenAIProvider(process.env.OPENAI_API_KEY || 'sk-test-key');

  try {
    const response = await provider.generate({
      prompt: 'Explain retry mechanisms',
      maxTokens: 100,
    });

    console.log('Success after retries (if any)');

    // Check retry stats
    const retryStats = provider.getRetryStats();
    if (retryStats) {
      console.log('\nRetry Stats:');
      console.log(`  Total Attempts: ${retryStats.totalAttempts}`);
      console.log(`  Total Retries: ${retryStats.totalRetries}`);
      console.log(`  Successful Retries: ${retryStats.successfulRetries}`);
      console.log(`  Retry Success Rate: ${(retryStats.successRate * 100).toFixed(1)}%`);
    }
  } catch (error) {
    console.error('Failed even after retries:', error);
  }
}

/**
 * Demo 5: Response Caching
 */
async function demo5_caching() {
  console.log('\n========== DEMO 5: Response Caching ==========\n');

  const provider = new OpenAIProvider(process.env.OPENAI_API_KEY || 'sk-test-key');

  const request: GenerationRequest = {
    prompt: 'What is 2 + 2?',
    maxTokens: 50,
  };

  // First request (cache miss)
  console.log('First request (cache miss):');
  const start1 = Date.now();
  try {
    await provider.generate(request);
    console.log(`  Time: ${Date.now() - start1}ms`);
  } catch (error) {
    console.log('  Error (expected in demo)');
  }

  // Second identical request (cache hit)
  console.log('\nSecond identical request (cache hit):');
  const start2 = Date.now();
  try {
    await provider.generate(request);
    console.log(`  Time: ${Date.now() - start2}ms`);
  } catch (error) {
    console.log('  Error (expected in demo)');
  }

  // Show cache stats
  const cacheStats = provider.getCacheStats();
  if (cacheStats) {
    console.log('\nCache Stats:');
    console.log(`  Hits: ${cacheStats.hits}`);
    console.log(`  Misses: ${cacheStats.misses}`);
    console.log(`  Hit Rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
    console.log(`  Total Savings: ${cacheStats.totalSavings} tokens`);
    console.log(`  Cost Savings: $${(cacheStats.totalSavings / 1000 * 0.01).toFixed(4)}`);
  }
}

/**
 * Demo 6: Rate Limiting
 */
async function demo6_rateLimiting() {
  console.log('\n========== DEMO 6: Rate Limiting ==========\n');

  const provider = new OpenAIProvider(process.env.OPENAI_API_KEY || 'sk-test-key');

  // Make rapid requests to test rate limiting
  const promises = Array(5).fill(null).map((_, i) =>
    provider.generate({
      prompt: `Request ${i + 1}`,
      maxTokens: 10,
    }).catch(error => ({ error: error.message }))
  );

  const results = await Promise.all(promises);

  console.log('Results:');
  results.forEach((result, i) => {
    if ('error' in result) {
      console.log(`  Request ${i + 1}: ${result.error}`);
    } else {
      console.log(`  Request ${i + 1}: Success`);
    }
  });

  // Show rate limiter stats
  const rateLimitStats = provider.getRateLimiterStats();
  if (rateLimitStats) {
    console.log('\nRate Limiter Stats:');
    console.log(`  Total Requests: ${rateLimitStats.totalRequests}`);
    console.log(`  Rejected: ${rateLimitStats.rejectedRequests}`);
    console.log(`  Acceptance Rate: ${(rateLimitStats.acceptanceRate * 100).toFixed(1)}%`);
    console.log(`  Current Utilization:`);
    console.log(`    Requests: ${(rateLimitStats.currentUtilization.requests * 100).toFixed(1)}%`);
    console.log(`    Tokens: ${(rateLimitStats.currentUtilization.tokens * 100).toFixed(1)}%`);
  }
}

/**
 * Demo 7: Observability & Monitoring
 */
async function demo7_observability() {
  console.log('\n========== DEMO 7: Observability ==========\n');

  // Setup observability
  const obs = getObservability({
    enableMetrics: true,
    enableTracing: true,
    traceSampleRate: 1.0,
    metricExporters: [new ConsoleMetricExporter()],
  });

  // Subscribe to events
  const unsubscribe = obs.onEvent((event) => {
    console.log(`[Event] ${event.type} - Provider ${event.providerId} at ${new Date(event.timestamp).toISOString()}`);
  });

  // Create provider
  const provider = new OpenAIProvider(process.env.OPENAI_API_KEY || 'sk-test-key');

  // Make some requests
  try {
    await provider.generate({ prompt: 'Test 1', maxTokens: 10 });
    await provider.generate({ prompt: 'Test 2', maxTokens: 10 });
  } catch (error) {
    // Expected in demo
  }

  // Get metrics
  const metrics = obs.getMetrics(provider.id);
  console.log('\nMetrics Summary:');
  console.log(`  Total Requests: ${metrics.totalRequests}`);
  console.log(`  Success Rate: ${(metrics.successfulRequests / metrics.totalRequests * 100).toFixed(1)}%`);
  console.log(`  P95 Latency: ${metrics.latencyP95}ms`);
  console.log(`  Total Tokens: ${metrics.totalTokensUsed}`);
  console.log(`  Estimated Cost: $${metrics.estimatedCost.toFixed(4)}`);

  // Get health report
  const healthReport = obs.getHealthReport();
  console.log('\nHealth Report:');
  console.log(`  Overall Status: ${healthReport.overall}`);
  for (const provider of healthReport.providers) {
    console.log(`\n  ${provider.name}:`);
    console.log(`    Status: ${provider.status}`);
    if (provider.issues.length > 0) {
      console.log(`    Issues: ${provider.issues.join(', ')}`);
    }
  }

  // Cleanup
  unsubscribe();
}

/**
 * Demo 8: Real-World Scenario
 */
async function demo8_realWorldScenario() {
  console.log('\n========== DEMO 8: Real-World Production Scenario ==========\n');

  // Setup observability with monitoring
  const obs = getObservability({
    enableMetrics: true,
    enableTracing: true,
  });

  // Alert on critical events
  obs.onEvent((event) => {
    if (event.type === 'circuit_open') {
      console.error(`🚨 ALERT: Provider ${event.providerId} circuit opened!`);
      // In production: send to PagerDuty, Slack, etc.
    }

    if (event.type === 'error') {
      console.warn(`⚠️  Warning: Error in provider ${event.providerId}`);
    }
  });

  // Create multiple providers for redundancy
  const providers = [
    new OpenAIProvider(process.env.OPENAI_API_KEY || 'sk-test-1'),
    new AnthropicProvider(process.env.ANTHROPIC_API_KEY || 'sk-ant-test-1'),
  ];

  // Setup load balancer with health-based routing
  const lb = new LoadBalancer({
    type: 'health_based',
    failover: true,
    maxFailoverAttempts: 3,
  });

  providers.forEach(p => lb.registerProvider(p));

  // Simulate production traffic
  console.log('Simulating production traffic...\n');

  const requests = [
    'Summarize this article',
    'Translate to Spanish',
    'Generate code example',
    'Explain quantum computing',
    'Write a product description',
  ];

  for (const prompt of requests) {
    try {
      const response = await lb.route({
        prompt,
        maxTokens: 100,
      });

      console.log(`✅ Success: ${prompt.substring(0, 20)}... (${response.usage.totalTokens} tokens)`);
    } catch (error: any) {
      console.error(`❌ Failed: ${prompt.substring(0, 20)}... (${error.message})`);
    }
  }

  // Generate comprehensive report
  console.log('\n========== Production Metrics Report ==========\n');

  const allMetrics = obs.getAllMetrics();
  for (const [providerId, metrics] of allMetrics) {
    console.log(`\nProvider: ${metrics.providerName}`);
    console.log(`  Uptime: ${metrics.circuitState === 'CLOSED' ? '✅' : '⚠️'  } ${metrics.circuitState}`);
    console.log(`  Requests: ${metrics.totalRequests} (${metrics.successfulRequests} success, ${metrics.failedRequests} failed)`);
    console.log(`  Success Rate: ${(metrics.successfulRequests / metrics.totalRequests * 100).toFixed(1)}%`);
    console.log(`  Latency: P50=${metrics.latencyP50}ms, P95=${metrics.latencyP95}ms, P99=${metrics.latencyP99}ms`);
    console.log(`  Cache: ${metrics.cacheHits} hits (${(metrics.cacheHitRate * 100).toFixed(1)}% hit rate)`);
    console.log(`  Cost: $${metrics.estimatedCost.toFixed(4)} (saved $${metrics.cacheSavings.toFixed(4)} from cache)`);
  }

  console.log('\n========== End of Production Scenario ==========\n');
}

/**
 * Run all demos
 */
async function runAllDemos() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║   Enhanced Providers Module - Complete Feature Demo      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  try {
    await demo1_basicUsage();
    // await demo2_loadBalancing();
    // await demo3_circuitBreaker();
    // await demo4_retry();
    // await demo5_caching();
    // await demo6_rateLimiting();
    // await demo7_observability();
    // await demo8_realWorldScenario();

    console.log('\n✅ All demos completed successfully!');
  } catch (error) {
    console.error('\n❌ Demo failed:', error);
  }
}

// Run demos if executed directly
if (require.main === module) {
  runAllDemos();
}

export {
  demo1_basicUsage,
  demo2_loadBalancing,
  demo3_circuitBreaker,
  demo4_retry,
  demo5_caching,
  demo6_rateLimiting,
  demo7_observability,
  demo8_realWorldScenario,
};
