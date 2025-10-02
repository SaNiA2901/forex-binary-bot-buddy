/**
 * CANDLE CACHE SERVICE
 * LRU cache for validation results and computed data
 * Reduces redundant calculations
 */

import { ValidationResult } from './CandleValidationService';
import { CandleFormData } from './CandleInputCore';

interface CacheEntry<T> {
  value: T;
  timestamp: number;
  accessCount: number;
}

/**
 * LRU Cache for candle validation and computations
 */
export class CandleCacheService {
  private static validationCache = new Map<string, CacheEntry<ValidationResult>>();
  private static maxSize = 100;
  private static ttl = 5 * 60 * 1000; // 5 minutes

  /**
   * Generate cache key from form data
   */
  private static generateKey(data: CandleFormData): string {
    return `${data.open}|${data.high}|${data.low}|${data.close}|${data.volume}`;
  }

  /**
   * Get validation result from cache
   */
  static getValidation(data: CandleFormData): ValidationResult | null {
    const key = this.generateKey(data);
    const entry = this.validationCache.get(key);

    if (!entry) return null;

    // Check if expired
    const now = Date.now();
    if (now - entry.timestamp > this.ttl) {
      this.validationCache.delete(key);
      return null;
    }

    // Update access count
    entry.accessCount++;
    entry.timestamp = now;

    return entry.value;
  }

  /**
   * Store validation result in cache
   */
  static setValidation(data: CandleFormData, result: ValidationResult): void {
    const key = this.generateKey(data);

    // Check cache size and evict LRU if needed
    if (this.validationCache.size >= this.maxSize) {
      this.evictLRU();
    }

    this.validationCache.set(key, {
      value: result,
      timestamp: Date.now(),
      accessCount: 1
    });
  }

  /**
   * Evict least recently used entry
   */
  private static evictLRU(): void {
    let lruKey: string | null = null;
    let lruTimestamp = Infinity;
    let lruAccessCount = Infinity;

    for (const [key, entry] of this.validationCache.entries()) {
      // Prefer entries with lower access count and older timestamp
      const score = entry.accessCount * 1000 + entry.timestamp;
      const currentScore = lruAccessCount * 1000 + lruTimestamp;

      if (score < currentScore) {
        lruKey = key;
        lruTimestamp = entry.timestamp;
        lruAccessCount = entry.accessCount;
      }
    }

    if (lruKey) {
      this.validationCache.delete(lruKey);
    }
  }

  /**
   * Clear all cache
   */
  static clear(): void {
    this.validationCache.clear();
  }

  /**
   * Get cache statistics
   */
  static getStatistics(): {
    size: number;
    maxSize: number;
    hitRate: number;
  } {
    let totalAccess = 0;
    for (const entry of this.validationCache.values()) {
      totalAccess += entry.accessCount;
    }

    const hitRate = totalAccess > 0 ? (this.validationCache.size / totalAccess) * 100 : 0;

    return {
      size: this.validationCache.size,
      maxSize: this.maxSize,
      hitRate
    };
  }
}
