/**
 * CANDLE INDEX SERVICE
 * Fast indexing and search for candle data using Map-based indices
 * Provides O(1) lookups by ID and optimized range queries
 */

import { CandleData } from '@/types/session';
import { secureLogger } from '@/utils/secureLogger';

export interface CandleIndex {
  byId: Map<string, CandleData>;
  bySessionId: Map<string, CandleData[]>;
  byTimestamp: Map<number, CandleData>;
}

/**
 * Service for fast candle indexing and retrieval
 */
export class CandleIndexService {
  private static indices: CandleIndex = {
    byId: new Map(),
    bySessionId: new Map(),
    byTimestamp: new Map()
  };

  /**
   * Build indices from candle array
   */
  static buildIndices(candles: CandleData[]): void {
    const startTime = performance.now();

    // Clear existing indices
    this.clearIndices();

    // Build new indices
    for (const candle of candles) {
      // Index by ID
      if (candle.id) {
        this.indices.byId.set(candle.id, candle);
      }

      // Index by session ID
      if (!this.indices.bySessionId.has(candle.session_id)) {
        this.indices.bySessionId.set(candle.session_id, []);
      }
      this.indices.bySessionId.get(candle.session_id)!.push(candle);

      // Index by timestamp
      const timestamp = new Date(candle.candle_datetime).getTime();
      this.indices.byTimestamp.set(timestamp, candle);
    }

    const endTime = performance.now();
    secureLogger.debug('Indices built', {
      count: candles.length,
      duration: `${(endTime - startTime).toFixed(2)}ms`
    });
  }

  /**
   * Get candle by ID - O(1)
   */
  static getCandleById(id: string): CandleData | undefined {
    return this.indices.byId.get(id);
  }

  /**
   * Get candles by session ID - O(1)
   */
  static getCandlesBySessionId(sessionId: string): CandleData[] {
    return this.indices.bySessionId.get(sessionId) || [];
  }

  /**
   * Get candle by timestamp - O(1)
   */
  static getCandleByTimestamp(timestamp: number): CandleData | undefined {
    return this.indices.byTimestamp.get(timestamp);
  }

  /**
   * Get candles in time range - O(n) but optimized with early exit
   */
  static getCandlesInRange(
    sessionId: string,
    startTime: Date,
    endTime: Date
  ): CandleData[] {
    const sessionCandles = this.getCandlesBySessionId(sessionId);
    const startTimestamp = startTime.getTime();
    const endTimestamp = endTime.getTime();

    return sessionCandles.filter(candle => {
      const timestamp = new Date(candle.candle_datetime).getTime();
      return timestamp >= startTimestamp && timestamp <= endTimestamp;
    });
  }

  /**
   * Get latest N candles for session
   */
  static getLatestCandles(sessionId: string, count: number): CandleData[] {
    const sessionCandles = this.getCandlesBySessionId(sessionId);
    
    // Sort by index descending and take first N
    return sessionCandles
      .sort((a, b) => b.candle_index - a.candle_index)
      .slice(0, count);
  }

  /**
   * Get candles by index range
   */
  static getCandlesByIndexRange(
    sessionId: string,
    startIndex: number,
    endIndex: number
  ): CandleData[] {
    const sessionCandles = this.getCandlesBySessionId(sessionId);
    
    return sessionCandles.filter(candle =>
      candle.candle_index >= startIndex && candle.candle_index <= endIndex
    );
  }

  /**
   * Add single candle to indices
   */
  static addCandle(candle: CandleData): void {
    if (candle.id) {
      this.indices.byId.set(candle.id, candle);
    }

    if (!this.indices.bySessionId.has(candle.session_id)) {
      this.indices.bySessionId.set(candle.session_id, []);
    }
    this.indices.bySessionId.get(candle.session_id)!.push(candle);

    const timestamp = new Date(candle.candle_datetime).getTime();
    this.indices.byTimestamp.set(timestamp, candle);
  }

  /**
   * Remove candle from indices
   */
  static removeCandle(candleId: string): void {
    const candle = this.indices.byId.get(candleId);
    if (!candle) return;

    // Remove from ID index
    this.indices.byId.delete(candleId);

    // Remove from session index
    const sessionCandles = this.indices.bySessionId.get(candle.session_id);
    if (sessionCandles) {
      const index = sessionCandles.findIndex(c => c.id === candleId);
      if (index !== -1) {
        sessionCandles.splice(index, 1);
      }
    }

    // Remove from timestamp index
    const timestamp = new Date(candle.candle_datetime).getTime();
    this.indices.byTimestamp.delete(timestamp);
  }

  /**
   * Clear all indices
   */
  static clearIndices(): void {
    this.indices.byId.clear();
    this.indices.bySessionId.clear();
    this.indices.byTimestamp.clear();
  }

  /**
   * Get index statistics
   */
  static getStatistics(): {
    totalCandles: number;
    sessionsCount: number;
    timestampsCount: number;
  } {
    return {
      totalCandles: this.indices.byId.size,
      sessionsCount: this.indices.bySessionId.size,
      timestampsCount: this.indices.byTimestamp.size
    };
  }
}
