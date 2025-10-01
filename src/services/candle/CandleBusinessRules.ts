/**
 * CANDLE BUSINESS RULES SERVICE
 * Advanced business logic validation for candle data
 */

import { CandleData } from '@/types/session';
import { secureLogger } from '@/utils/secureLogger';

export interface BusinessRuleViolation {
  rule: string;
  severity: 'info' | 'warning' | 'error';
  message: string;
  suggestion?: string;
}

export interface BusinessRuleContext {
  previousCandles?: CandleData[];
  sessionInfo?: {
    asset: string;
    timeframe: string;
  };
}

/**
 * Professional Business Rules Engine for Candle Validation
 */
export class CandleBusinessRules {
  /**
   * Check for abnormal price gaps
   */
  static checkPriceGap(
    currentCandle: Partial<CandleData>,
    previousCandle?: CandleData
  ): BusinessRuleViolation | null {
    if (!previousCandle) return null;

    const currentOpen = parseFloat(String(currentCandle.open));
    const prevClose = previousCandle.close;

    if (isNaN(currentOpen) || !prevClose) return null;

    const gap = Math.abs(currentOpen - prevClose);
    const gapPercent = (gap / prevClose) * 100;

    // Gap > 1% is suspicious
    if (gapPercent > 1) {
      return {
        rule: 'PRICE_GAP',
        severity: gapPercent > 3 ? 'error' : 'warning',
        message: `Большой ценовой разрыв: ${gapPercent.toFixed(2)}%`,
        suggestion: 'Проверьте правильность данных или наличие гэпа на рынке'
      };
    }

    return null;
  }

  /**
   * Check for abnormal volatility
   */
  static checkVolatility(
    currentCandle: Partial<CandleData>,
    previousCandles?: CandleData[]
  ): BusinessRuleViolation | null {
    if (!previousCandles || previousCandles.length < 20) return null;

    const high = parseFloat(String(currentCandle.high));
    const low = parseFloat(String(currentCandle.low));
    const open = parseFloat(String(currentCandle.open));

    if (isNaN(high) || isNaN(low) || isNaN(open)) return null;

    const currentRange = high - low;
    const currentRangePercent = (currentRange / open) * 100;

    // Calculate average range from previous candles
    const avgRange = previousCandles.slice(-20).reduce((sum, candle) => {
      return sum + (candle.high - candle.low);
    }, 0) / 20;

    const avgRangePercent = (avgRange / open) * 100;

    // Current range > 3x average is abnormal
    if (currentRangePercent > avgRangePercent * 3) {
      return {
        rule: 'ABNORMAL_VOLATILITY',
        severity: 'warning',
        message: `Аномальная волатильность: ${currentRangePercent.toFixed(2)}% (норма: ${avgRangePercent.toFixed(2)}%)`,
        suggestion: 'Возможна новость или важное событие на рынке'
      };
    }

    return null;
  }

  /**
   * Check for abnormal volume
   */
  static checkVolume(
    currentCandle: Partial<CandleData>,
    previousCandles?: CandleData[]
  ): BusinessRuleViolation | null {
    if (!previousCandles || previousCandles.length < 20) return null;

    const volume = parseFloat(String(currentCandle.volume));
    if (isNaN(volume) || volume === 0) return null;

    // Calculate average volume
    const avgVolume = previousCandles.slice(-20).reduce((sum, candle) => {
      return sum + candle.volume;
    }, 0) / 20;

    // Volume > 5x average is suspicious
    if (volume > avgVolume * 5) {
      return {
        rule: 'ABNORMAL_VOLUME',
        severity: 'warning',
        message: `Аномальный объем: ${(volume / avgVolume).toFixed(1)}x от среднего`,
        suggestion: 'Проверьте данные или наличие важных событий'
      };
    }

    // Volume < 0.1x average is also suspicious
    if (volume < avgVolume * 0.1 && avgVolume > 0) {
      return {
        rule: 'LOW_VOLUME',
        severity: 'info',
        message: `Низкий объем: ${(volume / avgVolume * 100).toFixed(0)}% от среднего`,
        suggestion: 'Возможно низкая ликвидность в это время'
      };
    }

    return null;
  }

  /**
   * Check for suspicious price patterns (possible data errors)
   */
  static checkSuspiciousPattern(
    currentCandle: Partial<CandleData>
  ): BusinessRuleViolation | null {
    const open = parseFloat(String(currentCandle.open));
    const high = parseFloat(String(currentCandle.high));
    const low = parseFloat(String(currentCandle.low));
    const close = parseFloat(String(currentCandle.close));

    if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close)) return null;

    // Check if all prices are identical (except for valid doji)
    if (open === high && high === low && low === close) {
      return {
        rule: 'FLAT_CANDLE',
        severity: 'warning',
        message: 'Все цены идентичны',
        suggestion: 'Проверьте правильность данных'
      };
    }

    // Check for extremely small body relative to wick
    const body = Math.abs(close - open);
    const upperWick = high - Math.max(open, close);
    const lowerWick = Math.min(open, close) - low;
    const totalRange = high - low;

    if (totalRange > 0 && body / totalRange < 0.01) {
      const wickRatio = (upperWick + lowerWick) / totalRange;
      if (wickRatio > 0.95) {
        return {
          rule: 'EXTREME_WICK',
          severity: 'info',
          message: 'Экстремально длинные тени свечи',
          suggestion: 'Возможен разворотный паттерн или аномалия данных'
        };
      }
    }

    return null;
  }

  /**
   * Check for round numbers (psychological levels)
   */
  static checkRoundNumbers(
    currentCandle: Partial<CandleData>
  ): BusinessRuleViolation | null {
    const close = parseFloat(String(currentCandle.close));
    if (isNaN(close)) return null;

    // Check if close is very close to round number
    const roundValue = Math.round(close * 100) / 100;
    const diff = Math.abs(close - roundValue);

    if (diff < 0.0001) {
      return {
        rule: 'ROUND_NUMBER',
        severity: 'info',
        message: `Цена закрытия на круглом уровне: ${close.toFixed(4)}`,
        suggestion: 'Возможно сопротивление/поддержка на этом уровне'
      };
    }

    return null;
  }

  /**
   * Check for trend continuation
   */
  static checkTrendContinuation(
    currentCandle: Partial<CandleData>,
    previousCandles?: CandleData[]
  ): BusinessRuleViolation | null {
    if (!previousCandles || previousCandles.length < 5) return null;

    const close = parseFloat(String(currentCandle.close));
    if (isNaN(close)) return null;

    // Check if last 5 candles are all bullish or bearish
    const last5Candles = previousCandles.slice(-5);
    const allBullish = last5Candles.every(c => c.close > c.open);
    const allBearish = last5Candles.every(c => c.close < c.open);

    if (allBullish || allBearish) {
      return {
        rule: 'STRONG_TREND',
        severity: 'info',
        message: `Сильный ${allBullish ? 'восходящий' : 'нисходящий'} тренд`,
        suggestion: 'Тренд может продолжиться или произойти коррекция'
      };
    }

    return null;
  }

  /**
   * Run all business rules
   */
  static validateBusinessRules(
    currentCandle: Partial<CandleData>,
    context?: BusinessRuleContext
  ): BusinessRuleViolation[] {
    const violations: BusinessRuleViolation[] = [];

    try {
      // Get previous candle (last one if available)
      const previousCandle = context?.previousCandles?.length 
        ? context.previousCandles[context.previousCandles.length - 1]
        : undefined;

      // Run all checks
      const checks = [
        this.checkPriceGap(currentCandle, previousCandle),
        this.checkVolatility(currentCandle, context?.previousCandles),
        this.checkVolume(currentCandle, context?.previousCandles),
        this.checkSuspiciousPattern(currentCandle),
        this.checkRoundNumbers(currentCandle),
        this.checkTrendContinuation(currentCandle, context?.previousCandles)
      ];

      // Filter out null results
      checks.forEach(check => {
        if (check) violations.push(check);
      });

      secureLogger.info('Business rules validation completed', {
        violationsCount: violations.length,
        hasErrors: violations.some(v => v.severity === 'error'),
        hasWarnings: violations.some(v => v.severity === 'warning')
      });

    } catch (error) {
      secureLogger.error('Error in business rules validation', { error });
    }

    return violations;
  }

  /**
   * Get smart suggestions based on previous candles
   */
  static getSmartSuggestions(
    field: 'open' | 'high' | 'low' | 'close' | 'volume',
    previousCandles?: CandleData[]
  ): { value: number; reason: string } | null {
    if (!previousCandles || previousCandles.length === 0) return null;

    const lastCandle = previousCandles[previousCandles.length - 1];

    switch (field) {
      case 'open':
        // Open typically equals previous close
        return {
          value: lastCandle.close,
          reason: 'Открытие обычно = закрытию предыдущей свечи'
        };

      case 'volume':
        // Suggest average volume
        if (previousCandles.length >= 20) {
          const avgVolume = previousCandles.slice(-20).reduce((sum, c) => sum + c.volume, 0) / 20;
          return {
            value: Math.round(avgVolume),
            reason: 'Средний объем за последние 20 свечей'
          };
        }
        return {
          value: lastCandle.volume,
          reason: 'Объем предыдущей свечи'
        };

      case 'high':
      case 'low':
      case 'close':
        // For these fields, we can suggest based on recent price action
        const avgPrice = previousCandles.slice(-5).reduce((sum, c) => sum + c.close, 0) / Math.min(5, previousCandles.length);
        return {
          value: avgPrice,
          reason: 'Средняя цена закрытия последних свечей'
        };

      default:
        return null;
    }
  }
}
