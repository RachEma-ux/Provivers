/**
 * Example: Anthropic (Claude) Provider Implementation
 *
 * Demonstrates how to extend EnhancedBaseProvider for Anthropic API
 */

import { EnhancedBaseProvider } from '../base-enhanced';
import { GenerationRequest, GenerationResponse, ProviderConfig } from '../types-enhanced';

export class AnthropicProvider extends EnhancedBaseProvider {
  constructor(apiKey: string) {
    const config: ProviderConfig = {
      id: 2,
      name: 'Anthropic',
      type: 'anthropic',
      apiKey,
      baseUrl: 'https://api.anthropic.com/v1',
      timeout: 30000,

      // Anthropic-specific configuration
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
        // Custom key generator for Claude (exclude temperature from cache key for better hit rate)
        keyGenerator: (request) => {
          return `${request.prompt}-${request.model}-${request.maxTokens}`;
        },
      },

      rateLimitConfig: {
        requestsPerMinute: 50,
        tokensPerMinute: 100000,
        burstSize: 5,
      },
    };

    super(config);
  }

  /**
   * Implement the actual API call for Anthropic
   */
  protected async doGenerate(request: GenerationRequest): Promise<GenerationResponse> {
    const response = await fetch(`${this.config.baseUrl}/messages`, {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model || 'claude-3-sonnet-20240229',
        messages: [
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 1.0,
        top_p: request.topP || 1.0,
      }),
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error (${response.status}): ${error}`);
    }

    const data = await response.json();

    // Extract text content from response
    const content = data.content[0]?.text || '';

    return {
      id: data.id,
      content,
      model: data.model,
      usage: {
        promptTokens: data.usage.input_tokens,
        completionTokens: data.usage.output_tokens,
        totalTokens: data.usage.input_tokens + data.usage.output_tokens,
      },
      finishReason: this.mapFinishReason(data.stop_reason),
    };
  }

  /**
   * Map Anthropic stop reasons to our standard format
   */
  private mapFinishReason(reason: string): 'stop' | 'length' | 'content_filter' | 'error' {
    switch (reason) {
      case 'end_turn':
        return 'stop';
      case 'max_tokens':
        return 'length';
      case 'stop_sequence':
        return 'stop';
      default:
        return 'error';
    }
  }
}
