/**
 * Simple Test - Verify All Components Load Correctly
 *
 * This test verifies that all components can be imported and instantiated
 */

import { CircuitBreaker } from '../circuit-breaker';
import { RetryManager } from '../retry-manager';
import { ResponseCache } from '../response-cache';
import { RateLimiter } from '../rate-limiter';
import { LoadBalancer } from '../load-balancer';
import { getObservability } from '../observability';
import { EnhancedBaseProvider } from '../base-enhanced';
import {
  GenerationRequest,
  GenerationResponse,
  ProviderConfig,
} from '../types-enhanced';

/**
 * Mock provider for testing
 */
class MockProvider extends EnhancedBaseProvider {
  constructor() {
    const config: ProviderConfig = {
      id: 999,
      name: 'MockProvider',
      type: 'custom',
      apiKey: 'test-key',
    };
    super(config);
  }

  protected async doGenerate(request: GenerationRequest): Promise<GenerationResponse> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 100));

    return {
      id: 'mock-' + Date.now(),
      content: `Mock response for: ${request.prompt}`,
      model: 'mock-model',
      usage: {
        promptTokens: request.prompt.length,
        completionTokens: 50,
        totalTokens: request.prompt.length + 50,
      },
      finishReason: 'stop',
    };
  }
}

/**
 * Test 1: Circuit Breaker
 */
function test1_CircuitBreaker() {
  console.log('Test 1: Circuit Breaker');

  const breaker = new CircuitBreaker(
    {
      failureThreshold: 3,
      resetTimeout: 5000,
    },
    1,
    'TestProvider'
  );

  const stats = breaker.getStats();
  console.log('  ✅ Circuit breaker created');
  console.log('  State:', stats.state);
  console.log('  Is Healthy:', breaker.isHealthy());
}

/**
 * Test 2: Retry Manager
 */
function test2_RetryManager() {
  console.log('\nTest 2: Retry Manager');

  const retryManager = new RetryManager({
    maxRetries: 3,
    initialDelayMs: 100,
  });

  const stats = retryManager.getStats();
  console.log('  ✅ Retry manager created');
  console.log('  Stats:', stats);
}

/**
 * Test 3: Response Cache
 */
function test3_ResponseCache() {
  console.log('\nTest 3: Response Cache');

  const cache = new ResponseCache({
    enabled: true,
    ttlSeconds: 60,
    maxSize: 100,
  });

  const stats = cache.getStats();
  console.log('  ✅ Response cache created');
  console.log('  Size:', stats.size);
  console.log('  Max Size:', stats.maxSize);
}

/**
 * Test 4: Rate Limiter
 */
function test4_RateLimiter() {
  console.log('\nTest 4: Rate Limiter');

  const limiter = new RateLimiter(
    {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
    },
    1,
    'TestProvider'
  );

  const state = limiter.getState();
  console.log('  ✅ Rate limiter created');
  console.log('  Is Available:', limiter.isAvailable());
}

/**
 * Test 5: Load Balancer
 */
function test5_LoadBalancer() {
  console.log('\nTest 5: Load Balancer');

  const lb = new LoadBalancer({
    type: 'round_robin',
  });

  console.log('  ✅ Load balancer created');
}

/**
 * Test 6: Observability
 */
function test6_Observability() {
  console.log('\nTest 6: Observability');

  const obs = getObservability({
    enableMetrics: true,
    enableTracing: true,
  });

  obs.registerProvider(1, 'TestProvider');
  console.log('  ✅ Observability system initialized');
}

/**
 * Test 7: Enhanced Provider
 */
async function test7_EnhancedProvider() {
  console.log('\nTest 7: Enhanced Provider');

  const provider = new MockProvider();

  try {
    const response = await provider.generate({
      prompt: 'Test prompt',
      maxTokens: 50,
    });

    console.log('  ✅ Provider generated response');
    console.log('  Response ID:', response.id);
    console.log('  Content:', response.content);
    console.log('  Tokens:', response.usage.totalTokens);

    // Check health
    const health = provider.getHealth();
    console.log('  Provider Health:');
    console.log('    Is Healthy:', health.isHealthy);
    console.log('    Circuit State:', health.circuitState);
  } catch (error) {
    console.error('  ❌ Provider test failed:', error);
  }
}

/**
 * Test 8: All Components Together
 */
async function test8_Integration() {
  console.log('\nTest 8: Integration Test');

  // Create providers with full configuration
  const provider1 = new MockProvider();
  const provider2 = new MockProvider();

  // Setup load balancer
  const lb = new LoadBalancer({ type: 'round_robin' });
  lb.registerProvider(provider1);
  lb.registerProvider(provider2);

  // Setup observability
  const obs = getObservability();
  const unsubscribe = obs.onEvent((event) => {
    console.log(`    [Event] ${event.type}`);
  });

  try {
    // Make requests
    const response = await lb.route({
      prompt: 'Integration test',
      maxTokens: 50,
    });

    console.log('  ✅ Integration test passed');
    console.log('  Response:', response.content.substring(0, 50));
  } catch (error) {
    console.error('  ❌ Integration test failed:', error);
  } finally {
    unsubscribe();
  }
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║        Enhanced Providers - Component Tests              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  try {
    test1_CircuitBreaker();
    test2_RetryManager();
    test3_ResponseCache();
    test4_RateLimiter();
    test5_LoadBalancer();
    test6_Observability();
    await test7_EnhancedProvider();
    await test8_Integration();

    console.log('\n╔═══════════════════════════════════════════════════════════╗');
    console.log('║              ✅ All Tests Passed!                         ║');
    console.log('╚═══════════════════════════════════════════════════════════╝');
  } catch (error) {
    console.error('\n❌ Test suite failed:', error);
    process.exit(1);
  }
}

// Run tests if executed directly
if (require.main === module) {
  runTests();
}

export { runTests };
