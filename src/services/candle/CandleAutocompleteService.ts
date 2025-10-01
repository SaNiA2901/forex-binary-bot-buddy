/**
 * CANDLE AUTOCOMPLETE SERVICE
 * Smart field autocomplete based on previous candles and market patterns
 */

import { CandleData } from '@/types/session';
import { secureLogger } from '@/utils/secureLogger';

export interface AutocompleteOption {
  value: string;
  label: string;
  confidence: number; // 0-100
  reason: string;
}

/**
 * Smart Autocomplete Service for Candle Input
 */
export class CandleAutocompleteService {
  /**
   * Get autocomplete suggestions for Open field
   */
  static getSuggestionsForOpen(
    previousCandles: CandleData[]
  ): AutocompleteOption[] {
    const suggestions: AutocompleteOption[] = [];

    if (previousCandles.length === 0) return suggestions;

    const lastCandle = previousCandles[previousCandles.length - 1];

    // Suggestion 1: Previous close (most common)
    suggestions.push({
      value: lastCandle.close.toFixed(5),
      label: `${lastCandle.close.toFixed(5)} (Закрытие предыдущей)`,
      confidence: 90,
      reason: 'Открытие обычно равно закрытию предыдущей свечи'
    });

    // Suggestion 2: With small gap (if there's a pattern)
    if (previousCandles.length >= 3) {
      const gaps = [];
      for (let i = 1; i < Math.min(previousCandles.length, 10); i++) {
        const gap = previousCandles[i].open - previousCandles[i - 1].close;
        gaps.push(gap);
      }
      const avgGap = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
      
      if (Math.abs(avgGap) > 0.00001) {
        const openWithGap = lastCandle.close + avgGap;
        suggestions.push({
          value: openWithGap.toFixed(5),
          label: `${openWithGap.toFixed(5)} (С учетом среднего гэпа)`,
          confidence: 60,
          reason: `Средний гэп: ${avgGap > 0 ? '+' : ''}${avgGap.toFixed(5)}`
        });
      }
    }

    return suggestions;
  }

  /**
   * Get autocomplete suggestions for High field
   */
  static getSuggestionsForHigh(
    formData: { open?: string; low?: string; close?: string },
    previousCandles: CandleData[]
  ): AutocompleteOption[] {
    const suggestions: AutocompleteOption[] = [];

    const open = formData.open ? parseFloat(formData.open) : null;
    const low = formData.low ? parseFloat(formData.low) : null;
    const close = formData.close ? parseFloat(formData.close) : null;

    // Calculate minimum high based on existing fields
    const minHigh = Math.max(
      open || 0,
      low || 0,
      close || 0
    );

    if (minHigh > 0) {
      suggestions.push({
        value: minHigh.toFixed(5),
        label: `${minHigh.toFixed(5)} (Минимально допустимое)`,
        confidence: 80,
        reason: 'High должен быть >= Open, Low, Close'
      });
    }

    // Suggest based on average range
    if (previousCandles.length >= 20) {
      const avgRange = previousCandles.slice(-20).reduce((sum, c) => {
        return sum + (c.high - c.low);
      }, 0) / 20;

      if (open && low) {
        const suggestedHigh = Math.max(open, low) + avgRange;
        suggestions.push({
          value: suggestedHigh.toFixed(5),
          label: `${suggestedHigh.toFixed(5)} (На основе среднего диапазона)`,
          confidence: 70,
          reason: `Средний диапазон: ${avgRange.toFixed(5)}`
        });
      }
    }

    return suggestions;
  }

  /**
   * Get autocomplete suggestions for Low field
   */
  static getSuggestionsForLow(
    formData: { open?: string; high?: string; close?: string },
    previousCandles: CandleData[]
  ): AutocompleteOption[] {
    const suggestions: AutocompleteOption[] = [];

    const open = formData.open ? parseFloat(formData.open) : null;
    const high = formData.high ? parseFloat(formData.high) : null;
    const close = formData.close ? parseFloat(formData.close) : null;

    // Calculate maximum low based on existing fields
    const maxLow = Math.min(
      ...[open, high, close].filter(v => v !== null) as number[]
    );

    if (maxLow > 0) {
      suggestions.push({
        value: maxLow.toFixed(5),
        label: `${maxLow.toFixed(5)} (Максимально допустимое)`,
        confidence: 80,
        reason: 'Low должен быть <= Open, High, Close'
      });
    }

    // Suggest based on average range
    if (previousCandles.length >= 20 && high) {
      const avgRange = previousCandles.slice(-20).reduce((sum, c) => {
        return sum + (c.high - c.low);
      }, 0) / 20;

      const suggestedLow = high - avgRange;
      suggestions.push({
        value: suggestedLow.toFixed(5),
        label: `${suggestedLow.toFixed(5)} (На основе среднего диапазона)`,
        confidence: 70,
        reason: `Средний диапазон: ${avgRange.toFixed(5)}`
      });
    }

    return suggestions;
  }

  /**
   * Get autocomplete suggestions for Close field
   */
  static getSuggestionsForClose(
    formData: { open?: string; high?: string; low?: string },
    previousCandles: CandleData[]
  ): AutocompleteOption[] {
    const suggestions: AutocompleteOption[] = [];

    const open = formData.open ? parseFloat(formData.open) : null;
    const high = formData.high ? parseFloat(formData.high) : null;
    const low = formData.low ? parseFloat(formData.low) : null;

    // Suggest close = open (doji)
    if (open && high && low) {
      suggestions.push({
        value: open.toFixed(5),
        label: `${open.toFixed(5)} (Доджи)`,
        confidence: 50,
        reason: 'Close = Open (нейтральная свеча)'
      });

      // Suggest bullish close
      const bullishClose = open + (high - low) * 0.7;
      suggestions.push({
        value: bullishClose.toFixed(5),
        label: `${bullishClose.toFixed(5)} (Бычья свеча)`,
        confidence: 60,
        reason: 'Закрытие около максимума'
      });

      // Suggest bearish close
      const bearishClose = open - (high - low) * 0.7;
      suggestions.push({
        value: bearishClose.toFixed(5),
        label: `${bearishClose.toFixed(5)} (Медвежья свеча)`,
        confidence: 60,
        reason: 'Закрытие около минимума'
      });
    }

    // Suggest based on trend
    if (previousCandles.length >= 5) {
      const last5 = previousCandles.slice(-5);
      const bullishCount = last5.filter(c => c.close > c.open).length;
      
      if (open && high && low) {
        if (bullishCount >= 4) {
          // Strong bullish trend
          const trendClose = open + (high - open) * 0.8;
          suggestions.push({
            value: trendClose.toFixed(5),
            label: `${trendClose.toFixed(5)} (Продолжение тренда)`,
            confidence: 75,
            reason: 'Сильный восходящий тренд'
          });
        } else if (bullishCount <= 1) {
          // Strong bearish trend
          const trendClose = open - (open - low) * 0.8;
          suggestions.push({
            value: trendClose.toFixed(5),
            label: `${trendClose.toFixed(5)} (Продолжение тренда)`,
            confidence: 75,
            reason: 'Сильный нисходящий тренд'
          });
        }
      }
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get autocomplete suggestions for Volume field
   */
  static getSuggestionsForVolume(
    previousCandles: CandleData[]
  ): AutocompleteOption[] {
    const suggestions: AutocompleteOption[] = [];

    if (previousCandles.length === 0) return suggestions;

    const lastCandle = previousCandles[previousCandles.length - 1];

    // Suggestion 1: Previous volume
    suggestions.push({
      value: lastCandle.volume.toString(),
      label: `${lastCandle.volume.toLocaleString()} (Предыдущий объем)`,
      confidence: 70,
      reason: 'Объем предыдущей свечи'
    });

    // Suggestion 2: Average volume
    if (previousCandles.length >= 20) {
      const avgVolume = Math.round(
        previousCandles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20
      );
      suggestions.push({
        value: avgVolume.toString(),
        label: `${avgVolume.toLocaleString()} (Средний объем)`,
        confidence: 85,
        reason: 'Средний объем за 20 свечей'
      });
    }

    // Suggestion 3: Median volume (more stable)
    if (previousCandles.length >= 10) {
      const volumes = previousCandles.slice(-10).map(c => c.volume).sort((a, b) => a - b);
      const medianVolume = volumes[Math.floor(volumes.length / 2)];
      suggestions.push({
        value: medianVolume.toString(),
        label: `${medianVolume.toLocaleString()} (Медианный объем)`,
        confidence: 80,
        reason: 'Медианный объем за 10 свечей'
      });
    }

    return suggestions.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Get all suggestions for a field
   */
  static getSuggestions(
    field: 'open' | 'high' | 'low' | 'close' | 'volume',
    formData: Partial<Record<string, string>>,
    previousCandles: CandleData[]
  ): AutocompleteOption[] {
    try {
      switch (field) {
        case 'open':
          return this.getSuggestionsForOpen(previousCandles);
        case 'high':
          return this.getSuggestionsForHigh(formData as any, previousCandles);
        case 'low':
          return this.getSuggestionsForLow(formData as any, previousCandles);
        case 'close':
          return this.getSuggestionsForClose(formData as any, previousCandles);
        case 'volume':
          return this.getSuggestionsForVolume(previousCandles);
        default:
          return [];
      }
    } catch (error) {
      secureLogger.error('Error getting autocomplete suggestions', { error, field });
      return [];
    }
  }

  /**
   * Auto-fill all fields intelligently
   */
  static autoFillAllFields(
    previousCandles: CandleData[]
  ): Record<'open' | 'high' | 'low' | 'close' | 'volume', string> | null {
    if (previousCandles.length === 0) return null;

    try {
      const lastCandle = previousCandles[previousCandles.length - 1];
      
      // Calculate average range
      const avgRange = previousCandles.length >= 20
        ? previousCandles.slice(-20).reduce((sum, c) => sum + (c.high - c.low), 0) / 20
        : lastCandle.high - lastCandle.low;

      // Calculate average volume
      const avgVolume = previousCandles.length >= 20
        ? Math.round(previousCandles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20)
        : lastCandle.volume;

      // Determine trend
      const last5 = previousCandles.slice(-5);
      const bullishCount = last5.filter(c => c.close > c.open).length;
      const isBullish = bullishCount >= 3;

      // Generate realistic candle
      const open = lastCandle.close;
      const high = open + avgRange * 0.7;
      const low = open - avgRange * 0.3;
      const close = isBullish 
        ? open + avgRange * 0.5
        : open - avgRange * 0.5;

      return {
        open: open.toFixed(5),
        high: Math.max(open, high, close).toFixed(5),
        low: Math.min(open, low, close).toFixed(5),
        close: close.toFixed(5),
        volume: avgVolume.toString()
      };
    } catch (error) {
      secureLogger.error('Error in autoFillAllFields', { error });
      return null;
    }
  }
}
