/**
 * Response Cache Implementation
 *
 * Intelligent caching system for API responses to reduce costs and latency.
 *
 * Features:
 * - LRU (Least Recently Used) eviction policy
 * - TTL (Time To Live) based expiration
 * - SHA-256 hashed cache keys
 * - Automatic size management
 * - Cache statistics and monitoring
 * - Optional compression for large responses
 */

import crypto from 'crypto';
import {
  CacheConfig,
  CacheEntry,
  CacheStats,
  GenerationRequest,
  GenerationResponse,
} from './types-enhanced';

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: Required<Omit<CacheConfig, 'keyGenerator'>> & {
  keyGenerator: (request: GenerationRequest) => string;
} = {
  enabled: true,
  ttlSeconds: 3600, // 1 hour
  maxSize: 1000,
  keyPrefix: 'cache:',
  compress: false,
  keyGenerator: defaultKeyGenerator,
};

/**
 * Default cache key generator
 * Creates a deterministic hash from request parameters
 */
function defaultKeyGenerator(request: GenerationRequest): string {
  const normalized = {
    prompt: request.prompt,
    model: request.model || 'default',
    maxTokens: request.maxTokens || 1000,
    temperature: request.temperature || 1.0,
    topP: request.topP || 1.0,
    // Exclude stream and metadata from cache key
  };

  const hash = crypto
    .createHash('sha256')
    .update(JSON.stringify(normalized))
    .digest('hex');

  return hash.substring(0, 16); // Use first 16 chars for brevity
}

/**
 * LRU Cache Node (for doubly-linked list)
 */
class CacheNode<T> {
  constructor(
    public key: string,
    public entry: CacheEntry<T>,
    public prev: CacheNode<T> | null = null,
    public next: CacheNode<T> | null = null
  ) {}
}

/**
 * Response Cache class
 *
 * Implements LRU cache with TTL expiration
 *
 * Usage:
 * ```typescript
 * const cache = new ResponseCache({
 *   ttlSeconds: 3600,
 *   maxSize: 1000
 * });
 *
 * // Try to get from cache
 * const cached = cache.get(request);
 * if (cached) {
 *   return cached;
 * }
 *
 * // On cache miss, fetch and store
 * const response = await fetchFromAPI(request);
 * cache.set(request, response);
 * ```
 */
export class ResponseCache {
  private config: Required<Omit<CacheConfig, 'keyGenerator'>> & {
    keyGenerator: (request: GenerationRequest) => string;
  };

  // Cache storage
  private cache = new Map<string, CacheNode<GenerationResponse>>();

  // LRU doubly-linked list (head = most recent, tail = least recent)
  private head: CacheNode<GenerationResponse> | null = null;
  private tail: CacheNode<GenerationResponse> | null = null;

  // Statistics
  private hits: number = 0;
  private misses: number = 0;
  private evictions: number = 0;
  private totalSavings: number = 0; // Estimated token savings

  constructor(config: CacheConfig) {
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      keyGenerator: config.keyGenerator || DEFAULT_CONFIG.keyGenerator,
    };
  }

  /**
   * Get cached response if available and not expired
   */
  get(request: GenerationRequest): GenerationResponse | null {
    if (!this.config.enabled) {
      return null;
    }

    const key = this.generateKey(request);
    const node = this.cache.get(key);

    if (!node) {
      this.misses++;
      return null;
    }

    // Check if entry is expired
    if (Date.now() > node.entry.expiresAt) {
      this.remove(key);
      this.misses++;
      return null;
    }

    // Cache hit! Move to head (most recently used)
    this.moveToHead(node);
    node.entry.hits++;
    this.hits++;

    // Track savings
    this.totalSavings += node.entry.value.usage.totalTokens;

    console.log(
      `[Cache] HIT: ${key} (hits: ${node.entry.hits}, age: ${Math.round((Date.now() - node.entry.timestamp) / 1000)}s)`
    );

    return node.entry.value;
  }

  /**
   * Store response in cache
   */
  set(request: GenerationRequest, response: GenerationResponse): void {
    if (!this.config.enabled) {
      return;
    }

    const key = this.generateKey(request);

    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.remove(key);
    }

    // Create new cache entry
    const entry: CacheEntry<GenerationResponse> = {
      key,
      value: response,
      timestamp: Date.now(),
      expiresAt: Date.now() + this.config.ttlSeconds * 1000,
      hits: 0,
      size: this.estimateSize(response),
    };

    const node = new CacheNode(key, entry);

    // Add to cache
    this.cache.set(key, node);
    this.addToHead(node);

    // Evict if over capacity
    if (this.cache.size > this.config.maxSize) {
      this.evictLRU();
    }

    console.log(
      `[Cache] SET: ${key} (size: ${this.cache.size}/${this.config.maxSize}, ` +
      `expires in: ${this.config.ttlSeconds}s)`
    );
  }

  /**
   * Generate cache key from request
   */
  private generateKey(request: GenerationRequest): string {
    const baseKey = this.config.keyGenerator(request);
    return `${this.config.keyPrefix}${baseKey}`;
  }

  /**
   * Estimate size of cached response (in bytes)
   */
  private estimateSize(response: GenerationResponse): number {
    return JSON.stringify(response).length;
  }

  /**
   * Move node to head of LRU list (most recently used)
   */
  private moveToHead(node: CacheNode<GenerationResponse>): void {
    if (node === this.head) {
      return;
    }

    // Remove from current position
    this.removeFromList(node);

    // Add to head
    this.addToHead(node);
  }

  /**
   * Add node to head of LRU list
   */
  private addToHead(node: CacheNode<GenerationResponse>): void {
    node.next = this.head;
    node.prev = null;

    if (this.head) {
      this.head.prev = node;
    }

    this.head = node;

    if (!this.tail) {
      this.tail = node;
    }
  }

  /**
   * Remove node from LRU list
   */
  private removeFromList(node: CacheNode<GenerationResponse>): void {
    if (node.prev) {
      node.prev.next = node.next;
    } else {
      this.head = node.next;
    }

    if (node.next) {
      node.next.prev = node.prev;
    } else {
      this.tail = node.prev;
    }
  }

  /**
   * Remove entry from cache
   */
  private remove(key: string): void {
    const node = this.cache.get(key);
    if (!node) {
      return;
    }

    this.removeFromList(node);
    this.cache.delete(key);
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    if (!this.tail) {
      return;
    }

    console.log(
      `[Cache] EVICT: ${this.tail.entry.key} (hits: ${this.tail.entry.hits}, ` +
      `age: ${Math.round((Date.now() - this.tail.entry.timestamp) / 1000)}s)`
    );

    this.remove(this.tail.entry.key);
    this.evictions++;
  }

  /**
   * Clear all expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let cleared = 0;

    for (const [key, node] of this.cache) {
      if (now > node.entry.expiresAt) {
        this.remove(key);
        cleared++;
      }
    }

    if (cleared > 0) {
      console.log(`[Cache] Cleared ${cleared} expired entries`);
    }

    return cleared;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
    console.log('[Cache] All entries cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.hits + this.misses;
    const hitRate = total > 0 ? this.hits / total : 0;

    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.size,
      maxSize: this.config.maxSize,
      hitRate,
      evictions: this.evictions,
      totalSavings: this.totalSavings,
    };
  }

  /**
   * Reset statistics
   */
  resetStats(): void {
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
    this.totalSavings = 0;
  }

  /**
   * Get all cache keys
   */
  getKeys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache entry details
   */
  getEntry(key: string): CacheEntry<GenerationResponse> | null {
    const node = this.cache.get(key);
    return node ? node.entry : null;
  }

  /**
   * Check if cache contains key
   */
  has(request: GenerationRequest): boolean {
    const key = this.generateKey(request);
    return this.cache.has(key);
  }

  /**
   * Get cache utilization (0-1)
   */
  getUtilization(): number {
    return this.cache.size / this.config.maxSize;
  }

  /**
   * Get average hits per entry
   */
  getAverageHits(): number {
    if (this.cache.size === 0) {
      return 0;
    }

    let totalHits = 0;
    for (const node of this.cache.values()) {
      totalHits += node.entry.hits;
    }

    return totalHits / this.cache.size;
  }

  /**
   * Get cache effectiveness score (0-1)
   * Based on hit rate and utilization
   */
  getEffectiveness(): number {
    const stats = this.getStats();
    const utilization = this.getUtilization();

    // Weighted score: 70% hit rate, 30% utilization
    return stats.hitRate * 0.7 + utilization * 0.3;
  }
}

/**
 * Multi-level cache
 *
 * Implements L1 (fast, small) and L2 (slower, larger) cache levels
 */
export class MultiLevelCache {
  private l1: ResponseCache;
  private l2: ResponseCache;

  constructor(
    l1Config: CacheConfig,
    l2Config: CacheConfig
  ) {
    this.l1 = new ResponseCache(l1Config);
    this.l2 = new ResponseCache(l2Config);
  }

  /**
   * Get from cache (checks L1 then L2)
   */
  get(request: GenerationRequest): GenerationResponse | null {
    // Try L1 first
    let result = this.l1.get(request);
    if (result) {
      return result;
    }

    // Try L2
    result = this.l2.get(request);
    if (result) {
      // Promote to L1
      this.l1.set(request, result);
      return result;
    }

    return null;
  }

  /**
   * Set in both cache levels
   */
  set(request: GenerationRequest, response: GenerationResponse): void {
    this.l1.set(request, response);
    this.l2.set(request, response);
  }

  /**
   * Get combined statistics
   */
  getStats(): { l1: CacheStats; l2: CacheStats; combined: CacheStats } {
    const l1Stats = this.l1.getStats();
    const l2Stats = this.l2.getStats();

    const combined: CacheStats = {
      hits: l1Stats.hits + l2Stats.hits,
      misses: l2Stats.misses, // Only count L2 misses as true misses
      size: l1Stats.size + l2Stats.size,
      maxSize: l1Stats.maxSize + l2Stats.maxSize,
      hitRate: (l1Stats.hits + l2Stats.hits) / (l1Stats.hits + l2Stats.hits + l2Stats.misses),
      evictions: l1Stats.evictions + l2Stats.evictions,
      totalSavings: l1Stats.totalSavings + l2Stats.totalSavings,
    };

    return { l1: l1Stats, l2: l2Stats, combined };
  }

  /**
   * Clear all cache levels
   */
  clear(): void {
    this.l1.clear();
    this.l2.clear();
  }
}
