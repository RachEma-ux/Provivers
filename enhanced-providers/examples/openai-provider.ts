/**
 * Example: OpenAI Provider Implementation
 *
 * Demonstrates how to extend EnhancedBaseProvider for OpenAI API
 */

import { EnhancedBaseProvider } from '../base-enhanced';
import { GenerationRequest, GenerationResponse, ProviderConfig } from '../types-enhanced';

export class OpenAIProvider extends EnhancedBaseProvider {
  constructor(apiKey: string) {
    const config: ProviderConfig = {
      id: 1,
      name: 'OpenAI',
      type: 'openai',
      apiKey,
      baseUrl: 'https://api.openai.com/v1',
      timeout: 30000,

      // Enable all enhancements with production-grade settings
      circuitBreakerConfig: {
        failureThreshold: 5,
        resetTimeout: 60000,
        successThreshold: 2,
        monitoringPeriod: 60000,
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
        tokensPerMinute: 90000, // OpenAI's default for tier 1
        burstSize: 10,
      },
    };

    super(config);
  }

  /**
   * Implement the actual API call
   */
  protected async doGenerate(request: GenerationRequest): Promise<GenerationResponse> {
    const response = await fetch(`${this.config.baseUrl}/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model || 'gpt-3.5-turbo-instruct',
        prompt: request.prompt,
        max_tokens: request.maxTokens || 1000,
        temperature: request.temperature || 0.7,
        top_p: request.topP || 1,
      }),
      signal: AbortSignal.timeout(this.config.timeout || 30000),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error (${response.status}): ${error}`);
    }

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
      finishReason: this.mapFinishReason(data.choices[0].finish_reason),
    };
  }

  /**
   * Map OpenAI finish reasons to our standard format
   */
  private mapFinishReason(reason: string): 'stop' | 'length' | 'content_filter' | 'error' {
    switch (reason) {
      case 'stop':
        return 'stop';
      case 'length':
        return 'length';
      case 'content_filter':
        return 'content_filter';
      default:
        return 'error';
    }
  }
}
