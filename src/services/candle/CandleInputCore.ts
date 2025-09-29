/**
 * CANDLE INPUT CORE - Central Business Logic
 * Single source of truth for all candle input operations
 */

import { CandleData, TradingSession } from '@/types/session';
import { CandleValidationService, ValidationResult } from './CandleValidationService';
import { CandleSecurityService, SanitizedCandleFormData } from './CandleSecurityService';
import { secureLogger } from '@/utils/secureLogger';

export interface CandleFormData {
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
}

export interface SaveCandleResult {
  success: boolean;
  candle?: CandleData;
  errors?: string[];
}

export interface UndoRedoResult {
  success: boolean;
  candle?: CandleData;
  error?: string;
}

export interface CandleInputCoreConfig {
  session: TradingSession;
  onSave?: (candle: CandleData) => Promise<void>;
  onError?: (error: string) => void;
}

/**
 * Core class for candle input operations
 * Implements Single Responsibility Principle
 */
export class CandleInputCore {
  private session: TradingSession;
  private onSave?: (candle: CandleData) => Promise<void>;
  private onError?: (error: string) => void;
  private undoStack: CandleData[] = [];
  private redoStack: CandleData[] = [];

  constructor(config: CandleInputCoreConfig) {
    this.session = config.session;
    this.onSave = config.onSave;
    this.onError = config.onError;
  }

  /**
   * Validate form data
   */
  validate(data: CandleFormData): ValidationResult {
    try {
      // Security check first
      const identifier = CandleSecurityService.generateIdentifier(this.session.id);
      const securityCheck = CandleSecurityService.performSecurityCheck(data, identifier);

      if (!securityCheck.passed) {
        return {
          isValid: false,
          errors: [{ field: 'security', message: securityCheck.error || 'Security check failed', code: 'SECURITY_ERROR' }],
          warnings: []
        };
      }

      // Validation
      const validationResult = CandleValidationService.validateFormData(securityCheck.sanitizedData);
      
      return validationResult;
    } catch (error) {
      secureLogger.error('Validation error in CandleInputCore', { error });
      return {
        isValid: false,
        errors: [{ field: 'unknown', message: 'Ошибка валидации', code: 'UNKNOWN_ERROR' }],
        warnings: []
      };
    }
  }

  /**
   * Sanitize form data
   */
  sanitize(data: CandleFormData): SanitizedCandleFormData {
    return CandleSecurityService.sanitizeFormData(data);
  }

  /**
   * Convert form data to candle data
   */
  private formDataToCandleData(
    formData: SanitizedCandleFormData,
    candleIndex: number,
    candleDateTime: string
  ): CandleData {
    const open = parseFloat(formData.open);
    const high = parseFloat(formData.high);
    const low = parseFloat(formData.low);
    const close = parseFloat(formData.close);
    const volume = parseFloat(formData.volume);

    const spread = high - low;

    return {
      session_id: this.session.id,
      candle_index: candleIndex,
      open,
      high,
      low,
      close,
      volume,
      candle_datetime: candleDateTime,
      spread,
      created_at: new Date().toISOString()
    };
  }

  /**
   * Save candle data
   */
  async save(
    formData: CandleFormData,
    candleIndex: number,
    candleDateTime: string,
    previousCandle?: CandleData
  ): Promise<SaveCandleResult> {
    try {
      // Step 1: Validate
      const validationResult = this.validate(formData);
      
      if (!validationResult.isValid) {
        const errorMessages = validationResult.errors.map(e => e.message);
        
        if (this.onError) {
          this.onError(errorMessages.join(', '));
        }
        
        return {
          success: false,
          errors: errorMessages
        };
      }

      // Step 2: Sanitize
      const sanitizedData = this.sanitize(formData);

      // Step 3: Convert to CandleData
      const candleData = this.formDataToCandleData(
        sanitizedData,
        candleIndex,
        candleDateTime
      );

      // Step 4: Temporal validation
      if (previousCandle) {
        const temporalWarnings = CandleValidationService.validateCandleSequence(
          candleData,
          previousCandle
        );

        if (temporalWarnings.some(w => w.severity === 'high')) {
          secureLogger.warn('High severity temporal warnings', { warnings: temporalWarnings });
        }
      }

      // Step 5: Final data validation
      const dataValidation = CandleValidationService.validateCandleData(candleData);
      
      if (!dataValidation.isValid) {
        const errorMessages = dataValidation.errors.map(e => e.message);
        return {
          success: false,
          errors: errorMessages
        };
      }

      // Step 6: Save via callback
      if (this.onSave) {
        await this.onSave(candleData);
      }

      // Step 7: Add to undo stack
      this.undoStack.push(candleData);
      this.redoStack = []; // Clear redo stack on new save

      secureLogger.info('Candle saved successfully', {
        sessionId: this.session.id,
        candleIndex,
        spread: candleData.spread
      });

      return {
        success: true,
        candle: candleData
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Ошибка сохранения свечи';
      
      secureLogger.error('Error saving candle', { error, sessionId: this.session.id });
      
      if (this.onError) {
        this.onError(errorMessage);
      }

      return {
        success: false,
        errors: [errorMessage]
      };
    }
  }

  /**
   * Undo last save
   */
  async undo(): Promise<UndoRedoResult> {
    try {
      const lastCandle = this.undoStack.pop();
      
      if (!lastCandle) {
        return {
          success: false,
          error: 'Нет операций для отмены'
        };
      }

      this.redoStack.push(lastCandle);

      secureLogger.info('Undo operation performed', {
        sessionId: this.session.id,
        candleIndex: lastCandle.candle_index
      });

      return {
        success: true,
        candle: lastCandle
      };
    } catch (error) {
      secureLogger.error('Error in undo operation', { error });
      return {
        success: false,
        error: 'Ошибка операции отмены'
      };
    }
  }

  /**
   * Redo last undo
   */
  async redo(): Promise<UndoRedoResult> {
    try {
      const lastUndo = this.redoStack.pop();
      
      if (!lastUndo) {
        return {
          success: false,
          error: 'Нет операций для повтора'
        };
      }

      this.undoStack.push(lastUndo);

      secureLogger.info('Redo operation performed', {
        sessionId: this.session.id,
        candleIndex: lastUndo.candle_index
      });

      return {
        success: true,
        candle: lastUndo
      };
    } catch (error) {
      secureLogger.error('Error in redo operation', { error });
      return {
        success: false,
        error: 'Ошибка операции повтора'
      };
    }
  }

  /**
   * Can undo?
   */
  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  /**
   * Can redo?
   */
  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.undoStack = [];
    this.redoStack = [];
  }

  /**
   * Get validation for field
   */
  validateField(field: string, value: string): string | null {
    const error = CandleValidationService.validateField(field, value);
    return error ? error.message : null;
  }

  /**
   * Update session
   */
  updateSession(session: TradingSession): void {
    this.session = session;
  }
}
