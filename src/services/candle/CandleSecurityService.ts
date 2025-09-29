/**
 * PROFESSIONAL CANDLE SECURITY SERVICE
 * Input sanitization, XSS protection, and rate limiting
 */

import { secureLogger } from '@/utils/secureLogger';

export interface SanitizedCandleFormData {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface SecurityCheckResult {
  passed: boolean;
  reason?: string;
  threat?: string;
}

export class CandleSecurityService {
  private static readonly RATE_LIMIT_WINDOW = 60000; // 1 minute
  private static readonly MAX_REQUESTS_PER_WINDOW = 100;
  private static rateLimitMap = new Map<string, { count: number; resetTime: number }>();

  /**
   * Sanitize numeric input - remove all non-numeric characters except decimal point
   */
  static sanitizeNumericInput(value: string): string {
    if (typeof value !== 'string') {
      secureLogger.warn('Non-string value provided to sanitizeNumericInput', { value });
      return '';
    }

    // Remove all non-numeric characters except dot and minus
    let sanitized = value.replace(/[^0-9.-]/g, '');

    // Handle multiple dots - keep only first one
    const parts = sanitized.split('.');
    if (parts.length > 2) {
      sanitized = parts[0] + '.' + parts.slice(1).join('');
    }

    // Handle multiple minus signs - keep only leading one
    const minusCount = (sanitized.match(/-/g) || []).length;
    if (minusCount > 1) {
      const hasLeadingMinus = sanitized.startsWith('-');
      sanitized = sanitized.replace(/-/g, '');
      if (hasLeadingMinus) {
        sanitized = '-' + sanitized;
      }
    }

    // Remove minus if not at start
    if (sanitized.includes('-') && !sanitized.startsWith('-')) {
      sanitized = sanitized.replace(/-/g, '');
    }

    // Limit decimal places to 8
    if (sanitized.includes('.')) {
      const [integer, decimal] = sanitized.split('.');
      sanitized = integer + '.' + decimal.slice(0, 8);
    }

    // Prevent overflow - limit total length
    if (sanitized.length > 20) {
      sanitized = sanitized.slice(0, 20);
    }

    return sanitized;
  }

  /**
   * Sanitize form data - comprehensive cleaning
   */
  static sanitizeFormData(data: unknown): SanitizedCandleFormData {
    if (typeof data !== 'object' || data === null) {
      secureLogger.error('Invalid form data provided', { data });
      throw new Error('Invalid form data structure');
    }

    const formData = data as Record<string, any>;

    return {
      open: this.sanitizeNumericInput(String(formData.open || '')),
      high: this.sanitizeNumericInput(String(formData.high || '')),
      low: this.sanitizeNumericInput(String(formData.low || '')),
      close: this.sanitizeNumericInput(String(formData.close || '')),
      volume: this.sanitizeNumericInput(String(formData.volume || ''))
    };
  }

  /**
   * Check for suspicious patterns in input
   */
  static checkForSuspiciousPatterns(data: SanitizedCandleFormData): SecurityCheckResult {
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+=/i,
      /data:text\/html/i,
      /vbscript:/i,
      /<iframe/i,
      /<object/i,
      /<embed/i,
      /SELECT.*FROM/i,
      /UNION.*SELECT/i,
      /DROP.*TABLE/i,
      /INSERT.*INTO/i,
      /DELETE.*FROM/i,
      /UPDATE.*SET/i,
    ];

    const dataString = JSON.stringify(data).toLowerCase();

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(dataString)) {
        secureLogger.warn('Suspicious pattern detected in candle input', {
          pattern: pattern.source,
          data: dataString.slice(0, 100)
        });

        return {
          passed: false,
          reason: 'Suspicious pattern detected',
          threat: pattern.source
        };
      }
    }

    return { passed: true };
  }

  /**
   * Rate limiting check
   */
  static checkRateLimit(identifier: string): SecurityCheckResult {
    const now = Date.now();
    const window = this.rateLimitMap.get(identifier);

    if (!window || now > window.resetTime) {
      this.rateLimitMap.set(identifier, {
        count: 1,
        resetTime: now + this.RATE_LIMIT_WINDOW
      });
      return { passed: true };
    }

    if (window.count >= this.MAX_REQUESTS_PER_WINDOW) {
      secureLogger.warn('Rate limit exceeded', {
        identifier,
        count: window.count,
        limit: this.MAX_REQUESTS_PER_WINDOW
      });

      return {
        passed: false,
        reason: 'Rate limit exceeded',
        threat: 'RATE_LIMIT'
      };
    }

    window.count++;
    return { passed: true };
  }

  /**
   * Validate numeric ranges for security
   */
  static validateNumericRanges(data: SanitizedCandleFormData): SecurityCheckResult {
    const fields = ['open', 'high', 'low', 'close', 'volume'] as const;

    for (const field of fields) {
      const value = parseFloat(data[field]);

      if (!isFinite(value)) {
        return {
          passed: false,
          reason: `Invalid ${field} value: not finite`,
          threat: 'INVALID_NUMBER'
        };
      }

      if (value < 0) {
        return {
          passed: false,
          reason: `Invalid ${field} value: negative`,
          threat: 'NEGATIVE_VALUE'
        };
      }

      if (value > Number.MAX_SAFE_INTEGER) {
        return {
          passed: false,
          reason: `Invalid ${field} value: overflow`,
          threat: 'NUMBER_OVERFLOW'
        };
      }

      // Check for NaN hidden in string
      if (isNaN(value)) {
        return {
          passed: false,
          reason: `Invalid ${field} value: NaN`,
          threat: 'NAN_VALUE'
        };
      }
    }

    return { passed: true };
  }

  /**
   * Comprehensive security check
   */
  static performSecurityCheck(
    data: unknown,
    identifier: string
  ): { passed: boolean; sanitizedData?: SanitizedCandleFormData; error?: string } {
    try {
      // Step 1: Rate limiting
      const rateLimitCheck = this.checkRateLimit(identifier);
      if (!rateLimitCheck.passed) {
        return {
          passed: false,
          error: 'Превышен лимит запросов. Пожалуйста, подождите.'
        };
      }

      // Step 2: Sanitize input
      const sanitizedData = this.sanitizeFormData(data);

      // Step 3: Check for suspicious patterns
      const suspiciousCheck = this.checkForSuspiciousPatterns(sanitizedData);
      if (!suspiciousCheck.passed) {
        return {
          passed: false,
          error: 'Обнаружены подозрительные данные. Операция отклонена.'
        };
      }

      // Step 4: Validate numeric ranges
      const rangeCheck = this.validateNumericRanges(sanitizedData);
      if (!rangeCheck.passed) {
        return {
          passed: false,
          error: `Некорректные числовые значения: ${rangeCheck.reason}`
        };
      }

      return {
        passed: true,
        sanitizedData
      };
    } catch (error) {
      secureLogger.error('Security check failed', { error });
      return {
        passed: false,
        error: 'Ошибка проверки безопасности'
      };
    }
  }

  /**
   * Clean up old rate limit entries
   */
  static cleanupRateLimitMap(): void {
    const now = Date.now();
    for (const [key, value] of this.rateLimitMap.entries()) {
      if (now > value.resetTime) {
        this.rateLimitMap.delete(key);
      }
    }
  }

  /**
   * Escape HTML to prevent XSS
   */
  static escapeHtml(unsafe: string): string {
    const map: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      '\'': '&#x27;',
      '/': '&#x2F;',
    };

    return String(unsafe).replace(/[&<>"'/]/g, s => map[s]);
  }

  /**
   * Generate unique identifier for rate limiting
   */
  static generateIdentifier(sessionId: string, userId?: string): string {
    const baseId = userId || sessionId || 'anonymous';
    return `candle_input_${baseId}`;
  }
}

// Auto cleanup every 5 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    CandleSecurityService.cleanupRateLimitMap();
  }, 5 * 60 * 1000);
}
