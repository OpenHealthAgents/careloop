import { createHash } from "crypto";

/**
 * ============================================================================
 * SAFE IN-MEMORY AI CACHE WITH TTL & CONTENT FINGERPRINTING
 * ============================================================================
 * Caches model outputs safely for identical minimized operational contexts:
 * - Eliminates redundant LLM calls
 * - 0 tokens and < 2ms latency on cache hits
 * - Multi-tenant isolation enforced in cache keys
 * - In-memory LRU-like eviction with TTL
 * ============================================================================
 */

export interface CacheEntry<T> {
  value: T;
  cachedAt: number;
  expiresAt: number;
  tokensSaved: number;
  operation: string;
}

export interface CacheStats {
  hits: number;
  misses: number;
  totalRequests: number;
  hitRate: number;
  tokensSaved: number;
  estimatedCostSavingsDollars: number;
  entriesCount: number;
}

export class SafeAICache {
  private readonly cache = new Map<string, CacheEntry<unknown>>();
  private hits = 0;
  private misses = 0;
  private tokensSaved = 0;
  private readonly defaultTtlMs: number;
  private readonly maxEntries: number;

  constructor(options?: { defaultTtlMs?: number; maxEntries?: number }) {
    this.defaultTtlMs = options?.defaultTtlMs ?? 60 * 60 * 1000; // 1 hour default
    this.maxEntries = options?.maxEntries ?? 1000;
  }

  public computeKey(tenantId: string, operation: string, payload: unknown): string {
    const serialized = JSON.stringify(payload, Object.keys(payload ?? {}).sort());
    const hash = createHash("sha256").update(serialized).digest("hex");
    return `${tenantId}:${operation}:${hash}`;
  }

  public get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      this.misses += 1;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.misses += 1;
      return null;
    }

    this.hits += 1;
    this.tokensSaved += entry.tokensSaved;
    return entry.value;
  }

  public set<T>(key: string, value: T, operation: string, tokensEstimate = 1200, ttlMs?: number): void {
    if (this.cache.size >= this.maxEntries) {
      // Evict oldest entries
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) this.cache.delete(oldestKey);
    }

    const now = Date.now();
    this.cache.set(key, {
      value,
      cachedAt: now,
      expiresAt: now + (ttlMs ?? this.defaultTtlMs),
      tokensSaved: tokensEstimate,
      operation,
    });
  }

  public invalidate(key: string): boolean {
    return this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.tokensSaved = 0;
  }

  public getStats(): CacheStats {
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? Number((this.hits / totalRequests).toFixed(4)) : 0;
    // Estimated at $0.0015 per 1k tokens average
    const estimatedCostSavingsDollars = Number(((this.tokensSaved / 1000) * 0.0015).toFixed(4));

    return {
      hits: this.hits,
      misses: this.misses,
      totalRequests,
      hitRate,
      tokensSaved: this.tokensSaved,
      estimatedCostSavingsDollars,
      entriesCount: this.cache.size,
    };
  }
}

export const safeAICache = new SafeAICache();
