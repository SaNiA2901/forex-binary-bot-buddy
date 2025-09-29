/**
 * PROFESSIONAL CANDLE VALIDATION SERVICE
 * Zod-based comprehensive validation with business rules
 */

import { z } from 'zod';

// ============= VALIDATION SCHEMAS =============

export const CandleFormDataSchema = z.object({
  open: z.string()
    .min(1, 'Цена открытия обязательна')
    .refine(val => !isNaN(parseFloat(val)), 'Цена открытия должна быть числом')
    .refine(val => parseFloat(val) > 0, 'Цена открытия должна быть положительной')
    .refine(val => parseFloat(val) < 1000000, 'Цена открытия слишком большая'),
  
  high: z.string()
    .min(1, 'Максимальная цена обязательна')
    .refine(val => !isNaN(parseFloat(val)), 'Максимальная цена должна быть числом')
    .refine(val => parseFloat(val) > 0, 'Максимальная цена должна быть положительной')
    .refine(val => parseFloat(val) < 1000000, 'Максимальная цена слишком большая'),
  
  low: z.string()
    .min(1, 'Минимальная цена обязательна')
    .refine(val => !isNaN(parseFloat(val)), 'Минимальная цена должна быть числом')
    .refine(val => parseFloat(val) > 0, 'Минимальная цена должна быть положительной')
    .refine(val => parseFloat(val) < 1000000, 'Минимальная цена слишком большая'),
  
  close: z.string()
    .min(1, 'Цена закрытия обязательна')
    .refine(val => !isNaN(parseFloat(val)), 'Цена закрытия должна быть числом')
    .refine(val => parseFloat(val) > 0, 'Цена закрытия должна быть положительной')
    .refine(val => parseFloat(val) < 1000000, 'Цена закрытия слишком большая'),
  
  volume: z.string()
    .min(1, 'Объем обязателен')
    .refine(val => !isNaN(parseFloat(val)), 'Объем должен быть числом')
    .refine(val => parseFloat(val) > 0, 'Объем должен быть больше нуля')
    .refine(val => parseFloat(val) < 999999999, 'Объем слишком большой')
    .refine(val => Number.isInteger(parseFloat(val)), 'Объем должен быть целым числом')
}).refine(data => {
  // Business Rule 1: High >= max(Open, Close)
  const open = parseFloat(data.open);
  const high = parseFloat(data.high);
  const close = parseFloat(data.close);
  return high >= Math.max(open, close);
}, {
  message: 'Максимальная цена должна быть >= max(Open, Close)',
  path: ['high']
}).refine(data => {
  // Business Rule 2: Low <= min(Open, Close)
  const open = parseFloat(data.open);
  const low = parseFloat(data.low);
  const close = parseFloat(data.close);
  return low <= Math.min(open, close);
}, {
  message: 'Минимальная цена должна быть <= min(Open, Close)',
  path: ['low']
}).refine(data => {
  // Business Rule 3: High >= Low
  const high = parseFloat(data.high);
  const low = parseFloat(data.low);
  return high >= low;
}, {
  message: 'Максимальная цена должна быть >= минимальной',
  path: ['high']
}).refine(data => {
  // Business Rule 4: Spread validation (не более 10%)
  const high = parseFloat(data.high);
  const low = parseFloat(data.low);
  const avgPrice = (high + low) / 2;
  const spreadPercent = ((high - low) / avgPrice) * 100;
  return spreadPercent <= 10;
}, {
  message: 'Спред свечи превышает 10% - проверьте корректность данных',
  path: ['high']
});

export const CandleDataSchema = z.object({
  session_id: z.string().uuid('Некорректный ID сессии'),
  candle_index: z.number().int().nonnegative('Индекс свечи должен быть неотрицательным'),
  open: z.number().positive().finite(),
  high: z.number().positive().finite(),
  low: z.number().positive().finite(),
  close: z.number().positive().finite(),
  volume: z.number().positive().int().finite(),
  candle_datetime: z.string().datetime('Некорректная дата и время свечи'),
  spread: z.number().nonnegative().optional(),
  prediction_direction: z.enum(['UP', 'DOWN', 'NEUTRAL']).optional(),
  prediction_probability: z.number().min(0).max(1).optional(),
  prediction_confidence: z.number().min(0).max(100).optional(),
}).refine(data => {
  return data.high >= Math.max(data.open, data.close) && data.high >= data.low;
}, {
  message: 'Нарушение правил OHLC: High должен быть максимальным'
}).refine(data => {
  return data.low <= Math.min(data.open, data.close) && data.low <= data.high;
}, {
  message: 'Нарушение правил OHLC: Low должен быть минимальным'
});

// ============= VALIDATION RESULTS =============

export interface ValidationResult<T = unknown> {
  isValid: boolean;
  data?: T;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
}

// ============= VALIDATION SERVICE =============

export class CandleValidationService {
  /**
   * Validate form data with comprehensive checks
   */
  static validateFormData(data: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const result = CandleFormDataSchema.safeParse(data);
      
      if (!result.success) {
        result.error.errors.forEach(err => {
          errors.push({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          });
        });
      }

      // Additional warnings
      if (result.success) {
        const parsed = result.data;
        const high = parseFloat(parsed.high);
        const low = parseFloat(parsed.low);
        const volume = parseFloat(parsed.volume);
        const avgPrice = (high + low) / 2;
        const spread = high - low;
        const spreadPercent = (spread / avgPrice) * 100;

        // Warning: Very small spread
        if (spreadPercent < 0.01) {
          warnings.push({
            field: 'spread',
            message: 'Очень маленький спред - возможно ошибка в данных',
            severity: 'medium'
          });
        }

        // Warning: Low volume
        if (volume < 1000) {
          warnings.push({
            field: 'volume',
            message: 'Низкий объем торгов - проверьте корректность',
            severity: 'low'
          });
        }

        // Warning: High spread
        if (spreadPercent > 5) {
          warnings.push({
            field: 'spread',
            message: `Большой спред (${spreadPercent.toFixed(2)}%)`,
            severity: 'high'
          });
        }
      }

      return {
        isValid: errors.length === 0,
        data: result.success ? result.data : undefined,
        errors,
        warnings
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'unknown',
          message: 'Критическая ошибка валидации',
          code: 'CRITICAL_ERROR'
        }],
        warnings
      };
    }
  }

  /**
   * Validate complete candle data
   */
  static validateCandleData(data: unknown): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    try {
      const result = CandleDataSchema.safeParse(data);
      
      if (!result.success) {
        result.error.errors.forEach(err => {
          errors.push({
            field: err.path.join('.'),
            message: err.message,
            code: err.code
          });
        });
      }

      return {
        isValid: errors.length === 0,
        data: result.success ? result.data : undefined,
        errors,
        warnings
      };
    } catch (error) {
      return {
        isValid: false,
        errors: [{
          field: 'unknown',
          message: 'Критическая ошибка валидации данных свечи',
          code: 'CRITICAL_ERROR'
        }],
        warnings
      };
    }
  }

  /**
   * Validate field individually
   */
  static validateField(field: string, value: string): ValidationError | null {
    const schema = (CandleFormDataSchema as any).shape[field];
    if (!schema) return null;

    const result = schema.safeParse(value);
    if (!result.success) {
      return {
        field,
        message: result.error.errors[0]?.message || 'Ошибка валидации',
        code: result.error.errors[0]?.code || 'UNKNOWN'
      };
    }

    return null;
  }

  /**
   * Check if values are within acceptable trading ranges
   */
  static validateTradingRanges(data: {
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    // Check for suspicious patterns
    const bodySize = Math.abs(data.close - data.open);
    const wickSize = data.high - data.low;
    
    if (bodySize === 0 && wickSize === 0) {
      warnings.push({
        field: 'candle',
        message: 'Свеча без движения - возможно ошибка данных',
        severity: 'high'
      });
    }

    if (wickSize > 0 && bodySize / wickSize < 0.05) {
      warnings.push({
        field: 'candle',
        message: 'Длинные тени при маленьком теле - проверьте данные',
        severity: 'low'
      });
    }

    return warnings;
  }

  /**
   * Validate candle against previous candle (temporal validation)
   */
  static validateCandleSequence(
    currentCandle: { open: number; close: number; high: number; low: number },
    previousCandle?: { open: number; close: number; high: number; low: number }
  ): ValidationWarning[] {
    const warnings: ValidationWarning[] = [];

    if (!previousCandle) return warnings;

    // Check for gap
    const gap = Math.abs(currentCandle.open - previousCandle.close);
    const avgPrice = (previousCandle.close + currentCandle.open) / 2;
    const gapPercent = (gap / avgPrice) * 100;

    if (gapPercent > 1) {
      warnings.push({
        field: 'open',
        message: `Большой гэп между свечами (${gapPercent.toFixed(2)}%)`,
        severity: 'medium'
      });
    }

    // Check for unusual price jumps
    const priceChange = Math.abs(currentCandle.close - previousCandle.close);
    const changePercent = (priceChange / previousCandle.close) * 100;

    if (changePercent > 5) {
      warnings.push({
        field: 'close',
        message: `Большое изменение цены (${changePercent.toFixed(2)}%)`,
        severity: 'high'
      });
    }

    return warnings;
  }
}
