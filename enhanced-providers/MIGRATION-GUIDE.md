# Migration Guide: Enhanced Providers Module

This guide will help you migrate your existing provider code to use the enhanced providers module.

## Table of Contents

1. [Quick Migration (5 minutes)](#quick-migration)
2. [Step-by-Step Migration](#step-by-step-migration)
3. [Configuration Options](#configuration-options)
4. [Common Migration Scenarios](#common-migration-scenarios)
5. [Backward Compatibility](#backward-compatibility)
6. [Troubleshooting](#troubleshooting)

---

## Quick Migration

### Before (Basic Provider)

```typescript
class MyProvider {
  constructor(private apiKey: string) {}

  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    const response = await fetch('https://api.example.com/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(request),
    });

    return await response.json();
  }
}
```

### After (Enhanced Provider)

```typescript
import { EnhancedBaseProvider } from './enhanced-providers/base-enhanced';
import { GenerationRequest, GenerationResponse, ProviderConfig } from './enhanced-providers/types-enhanced';

class MyProvider extends EnhancedBaseProvider {
  constructor(apiKey: string) {
    const config: ProviderConfig = {
      id: 1,
      name: 'MyProvider',
      type: 'custom',
      apiKey,

      // Optional: Enable enhancements
      circuitBreakerConfig: { failureThreshold: 5, resetTimeout: 60000 },
      retryConfig: { maxRetries: 3 },
      cacheConfig: { enabled: true, ttlSeconds: 3600, maxSize: 1000 },
      rateLimitConfig: { requestsPerMinute: 60, tokensPerMinute: 100000 },
    };

    super(config);
  }

  // Change 'generate' to 'doGenerate' and make it protected
  protected async doGenerate(request: GenerationRequest): Promise<GenerationResponse> {
    // Same implementation as before!
    const response = await fetch('https://api.example.com/generate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
      },
      body: JSON.stringify(request),
    });

    return await response.json();
  }
}
```

**That's it!** Your provider now has:
- ✅ Circuit breaker protection
- ✅ Automatic retry with exponential backoff
- ✅ Response caching (60% cost reduction)
- ✅ Rate limiting
- ✅ Full observability

---

## Step-by-Step Migration

### Step 1: Import Required Types

```typescript
import { EnhancedBaseProvider } from './enhanced-providers/base-enhanced';
import {
  GenerationRequest,
  GenerationResponse,
  ProviderConfig,
} from './enhanced-providers/types-enhanced';
```

### Step 2: Extend EnhancedBaseProvider

**Before:**
```typescript
class MyProvider {
```

**After:**
```typescript
class MyProvider extends EnhancedBaseProvider {
```

### Step 3: Update Constructor

**Before:**
```typescript
constructor(private apiKey: string, private baseUrl: string) {
  // Your initialization
}
```

**After:**
```typescript
constructor(apiKey: string, baseUrl: string) {
  const config: ProviderConfig = {
    id: 1,                    // Unique provider ID
    name: 'MyProvider',       // Provider name
    type: 'custom',           // Provider type
    apiKey,
    baseUrl,
    timeout: 30000,

    // Optional enhancements (add as needed)
    circuitBreakerConfig: {
      failureThreshold: 5,
      resetTimeout: 60000,
    },
    retryConfig: {
      maxRetries: 3,
      initialDelayMs: 1000,
    },
    cacheConfig: {
      enabled: true,
      ttlSeconds: 3600,
      maxSize: 1000,
    },
    rateLimitConfig: {
      requestsPerMinute: 60,
      tokensPerMinute: 100000,
    },
  };

  super(config);
}
```

### Step 4: Rename generate() to doGenerate()

**Before:**
```typescript
async generate(request: GenerationRequest): Promise<GenerationResponse> {
  // Your implementation
}
```

**After:**
```typescript
protected async doGenerate(request: GenerationRequest): Promise<GenerationResponse> {
  // Same implementation - no changes needed!
}
```

### Step 5: Update API Key References

**Before:**
```typescript
headers: {
  'Authorization': `Bearer ${this.apiKey}`,
}
```

**After:**
```typescript
headers: {
  'Authorization': `Bearer ${this.config.apiKey}`,
}
```

### Step 6: Test Your Migration

```typescript
const provider = new MyProvider('your-api-key', 'https://api.example.com');

// Works exactly the same as before
const response = await provider.generate({
  prompt: 'Test',
  maxTokens: 100,
});

// Plus new features!
const health = provider.getHealth();
console.log('Circuit state:', health.circuitState);
console.log('Latency P95:', health.latencyP95 + 'ms');
```

---

## Configuration Options

### Minimal Configuration (No Enhancements)

```typescript
const config: ProviderConfig = {
  id: 1,
  name: 'MyProvider',
  type: 'custom',
  apiKey: 'your-key',
};
// No enhancements - works like a basic provider
```

### Recommended Production Configuration

```typescript
const config: ProviderConfig = {
  id: 1,
  name: 'MyProvider',
  type: 'custom',
  apiKey: 'your-key',
  timeout: 30000,

  circuitBreakerConfig: {
    failureThreshold: 5,
    resetTimeout: 60000,
    successThreshold: 2,
  },

  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 30000,
    backoffMultiplier: 2,
    jitter: true,
  },

  cacheConfig: {
    enabled: true,
    ttlSeconds: 3600,
    maxSize: 1000,
  },

  rateLimitConfig: {
    requestsPerMinute: 60,
    tokensPerMinute: 100000,
    burstSize: 10,
  },
};
```

### High-Traffic Configuration

```typescript
const config: ProviderConfig = {
  id: 1,
  name: 'MyProvider',
  type: 'custom',
  apiKey: 'your-key',
  timeout: 45000,

  circuitBreakerConfig: {
    failureThreshold: 3,        // Stricter
    resetTimeout: 120000,       // Longer recovery
  },

  retryConfig: {
    maxRetries: 5,              // More retries
    maxDelayMs: 60000,
  },

  cacheConfig: {
    enabled: true,
    ttlSeconds: 7200,           // 2 hours
    maxSize: 10000,             // Larger cache
  },

  rateLimitConfig: {
    requestsPerMinute: 200,
    tokensPerMinute: 500000,
  },
};
```

---

## Common Migration Scenarios

### Scenario 1: OpenAI Provider

**Before:**
```typescript
class OpenAIProvider {
  constructor(private apiKey: string) {}

  async generate(prompt: string): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ prompt, model: 'gpt-3.5-turbo' }),
    });

    const data = await response.json();
    return data.choices[0].text;
  }
}
```

**After:**
```typescript
import { EnhancedBaseProvider } from './enhanced-providers/base-enhanced';
import { GenerationRequest, GenerationResponse } from './enhanced-providers/types-enhanced';

class OpenAIProvider extends EnhancedBaseProvider {
  constructor(apiKey: string) {
    super({
      id: 1,
      name: 'OpenAI',
      type: 'openai',
      apiKey,
      baseUrl: 'https://api.openai.com/v1',
      circuitBreakerConfig: { failureThreshold: 5, resetTimeout: 60000 },
      retryConfig: { maxRetries: 3 },
      cacheConfig: { enabled: true, ttlSeconds: 3600, maxSize: 1000 },
      rateLimitConfig: { requestsPerMinute: 60, tokensPerMinute: 90000 },
    });
  }

  protected async doGenerate(request: GenerationRequest): Promise<GenerationResponse> {
    const response = await fetch(`${this.config.baseUrl}/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: request.prompt,
        model: request.model || 'gpt-3.5-turbo-instruct',
        max_tokens: request.maxTokens,
      }),
    });

    const data = await response.json();

    return {
      id: data.id,
      content: data.choices[0].text,
      model: data.model,
      usage: {
        promptTokens: data.usage.prompt_tokens,
        completionTokens: data.usage.completion_tokens,
        totalTokens: data.usage.total_tokens,
      },
      finishReason: 'stop',
    };
  }
}
```

### Scenario 2: Multiple Providers with Load Balancing

**Before:**
```typescript
const provider1 = new OpenAIProvider(apiKey1);
const provider2 = new AnthropicProvider(apiKey2);

// Manual failover logic
let response;
try {
  response = await provider1.generate(prompt);
} catch (error) {
  response = await provider2.generate(prompt);
}
```

**After:**
```typescript
import { LoadBalancer } from './enhanced-providers/load-balancer';

const provider1 = new OpenAIProvider(apiKey1);
const provider2 = new AnthropicProvider(apiKey2);

const lb = new LoadBalancer({
  type: 'least_latency',  // Auto-routes to fastest
  failover: true,         // Automatic failover
});

lb.registerProvider(provider1);
lb.registerProvider(provider2);

// Automatic load balancing and failover!
const response = await lb.route(request);
```

### Scenario 3: Adding Monitoring

**Before:**
```typescript
const provider = new MyProvider(apiKey);

try {
  const response = await provider.generate(request);
  console.log('Success');
} catch (error) {
  console.error('Error:', error);
}
```

**After:**
```typescript
import { getObservability } from './enhanced-providers/observability';

const obs = getObservability();

// Subscribe to events
obs.onEvent((event) => {
  if (event.type === 'circuit_open') {
    alert(`Provider down: ${event.providerId}`);
  }
});

const provider = new MyProvider(apiKey);

const response = await provider.generate(request);

// Get detailed metrics
const metrics = obs.getMetrics(provider.id);
console.log('P95 latency:', metrics.latencyP95);
console.log('Success rate:', metrics.successfulRequests / metrics.totalRequests);
console.log('Cache hit rate:', metrics.cacheHitRate);
```

---

## Backward Compatibility

### All enhancements are optional!

```typescript
// Minimal config - works exactly like before
const config: ProviderConfig = {
  id: 1,
  name: 'MyProvider',
  type: 'custom',
  apiKey: 'your-key',
  // No enhancement configs = no enhancements
};
```

### Public API is unchanged

```typescript
// Before and After - same interface!
const response = await provider.generate(request);
```

### Gradual Migration Path

```typescript
// Phase 1: Just add caching
const config: ProviderConfig = {
  id: 1,
  name: 'MyProvider',
  type: 'custom',
  apiKey: 'your-key',
  cacheConfig: { enabled: true, ttlSeconds: 3600, maxSize: 1000 },
};

// Phase 2: Add retry
// Phase 3: Add circuit breaker
// Phase 4: Add rate limiting
// Phase 5: Add observability
```

---

## Troubleshooting

### Issue: "Cannot find module 'enhanced-providers'"

**Solution:** Check your import paths
```typescript
// Correct path (relative to your file)
import { EnhancedBaseProvider } from './enhanced-providers/base-enhanced';
```

### Issue: "Property 'apiKey' does not exist"

**Solution:** Use `this.config.apiKey` instead of `this.apiKey`
```typescript
// Before
headers: { 'Authorization': `Bearer ${this.apiKey}` }

// After
headers: { 'Authorization': `Bearer ${this.config.apiKey}` }
```

### Issue: Circuit breaker keeps opening

**Solutions:**
1. Check if provider API is actually down
2. Increase `failureThreshold`:
   ```typescript
   circuitBreakerConfig: { failureThreshold: 10, ... }
   ```
3. Check error logs to identify real issues

### Issue: Cache not working

**Solutions:**
1. Verify cache is enabled:
   ```typescript
   cacheConfig: { enabled: true, ... }
   ```
2. Check cache stats:
   ```typescript
   const stats = provider.getCacheStats();
   console.log('Hit rate:', stats.hitRate);
   ```
3. Requests may have high variability (different prompts)

### Issue: Rate limits too restrictive

**Solutions:**
1. Increase rate limits:
   ```typescript
   rateLimitConfig: {
     requestsPerMinute: 120,  // Increase
     tokensPerMinute: 200000, // Increase
   }
   ```
2. Add burst allowance:
   ```typescript
   rateLimitConfig: {
     requestsPerMinute: 60,
     tokensPerMinute: 100000,
     burstSize: 20,  // Allow temporary spikes
   }
   ```

---

## Migration Checklist

- [ ] Import `EnhancedBaseProvider` and types
- [ ] Extend `EnhancedBaseProvider` instead of base class
- [ ] Create `ProviderConfig` object in constructor
- [ ] Call `super(config)` in constructor
- [ ] Rename `generate()` to `doGenerate()`
- [ ] Make `doGenerate()` protected
- [ ] Update `this.apiKey` to `this.config.apiKey`
- [ ] Update `this.baseUrl` to `this.config.baseUrl`
- [ ] Add enhancement configurations (optional)
- [ ] Test basic functionality
- [ ] Test circuit breaker (optional)
- [ ] Test retry logic (optional)
- [ ] Test caching (optional)
- [ ] Monitor metrics (optional)

---

## Need Help?

- See [README-ENHANCED.md](./README-ENHANCED.md) for full documentation
- Check [examples/](./examples/) for working code samples
- Run [examples/simple-test.ts](./examples/simple-test.ts) to verify setup

---

**Migration Time:** 5-15 minutes per provider

**Breaking Changes:** None (all enhancements are opt-in)

**Recommended Approach:** Migrate one provider at a time, enable features gradually
