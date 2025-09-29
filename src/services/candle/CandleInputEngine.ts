/**
 * CANDLE INPUT ENGINE - Orchestration Layer
 * Main entry point for all candle input operations
 * Coordinates Core, Validation, and Security services
 */

import { CandleData, TradingSession } from '@/types/session';
import { CandleInputCore, CandleFormData, SaveCandleResult, UndoRedoResult } from './CandleInputCore';
import { ValidationResult } from './CandleValidationService';
import { secureLogger } from '@/utils/secureLogger';

export interface CandleInputEngineConfig {
  session: TradingSession;
  onCandleSaved?: (candle: CandleData) => Promise<void>;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
}

export interface EngineStatus {
  isReady: boolean;
  hasSession: boolean;
  canUndo: boolean;
  canRedo: boolean;
  lastOperation?: string;
  operationCount: number;
}

/**
 * Main Engine for Candle Input
 * Provides high-level API for candle management
 */
export class CandleInputEngine {
  private core: CandleInputCore;
  private config: CandleInputEngineConfig;
  private operationCount = 0;
  private lastOperation?: string;

  constructor(config: CandleInputEngineConfig) {
    this.config = config;
    this.core = new CandleInputCore({
      session: config.session,
      onSave: config.onCandleSaved,
      onError: config.onError
    });

    secureLogger.info('CandleInputEngine initialized', {
      sessionId: config.session.id,
      sessionName: config.session.session_name
    });
  }

  /**
   * Validate candle form data
   */
  validate(data: CandleFormData): ValidationResult {
    this.lastOperation = 'validate';
    return this.core.validate(data);
  }

  /**
   * Save candle with full validation and security checks
   */
  async saveCandle(
    formData: CandleFormData,
    candleIndex: number,
    candleDateTime: string,
    previousCandle?: CandleData
  ): Promise<SaveCandleResult> {
    try {
      this.lastOperation = 'save';
      this.operationCount++;

      secureLogger.info('Saving candle', {
        sessionId: this.config.session.id,
        candleIndex,
        operationCount: this.operationCount
      });

      const result = await this.core.save(
        formData,
        candleIndex,
        candleDateTime,
        previousCandle
      );

      if (result.success && this.config.onSuccess) {
        this.config.onSuccess('Свеча успешно сохранена');
      }

      return result;
    } catch (error) {
      secureLogger.error('Error in saveCandle', { error });
      
      if (this.config.onError) {
        this.config.onError('Ошибка сохранения свечи');
      }

      return {
        success: false,
        errors: ['Критическая ошибка при сохранении']
      };
    }
  }

  /**
   * Undo last save operation
   */
  async undo(): Promise<UndoRedoResult> {
    try {
      this.lastOperation = 'undo';
      this.operationCount++;

      const result = await this.core.undo();

      if (result.success && this.config.onSuccess) {
        this.config.onSuccess('Операция отменена');
      } else if (!result.success && this.config.onError) {
        this.config.onError(result.error || 'Ошибка отмены');
      }

      return result;
    } catch (error) {
      secureLogger.error('Error in undo', { error });
      return {
        success: false,
        error: 'Критическая ошибка при отмене'
      };
    }
  }

  /**
   * Redo last undo operation
   */
  async redo(): Promise<UndoRedoResult> {
    try {
      this.lastOperation = 'redo';
      this.operationCount++;

      const result = await this.core.redo();

      if (result.success && this.config.onSuccess) {
        this.config.onSuccess('Операция повторена');
      } else if (!result.success && this.config.onError) {
        this.config.onError(result.error || 'Ошибка повтора');
      }

      return result;
    } catch (error) {
      secureLogger.error('Error in redo', { error });
      return {
        success: false,
        error: 'Критическая ошибка при повторе'
      };
    }
  }

  /**
   * Validate individual field
   */
  validateField(field: string, value: string): string | null {
    return this.core.validateField(field, value);
  }

  /**
   * Get engine status
   */
  getStatus(): EngineStatus {
    return {
      isReady: true,
      hasSession: !!this.config.session,
      canUndo: this.core.canUndo(),
      canRedo: this.core.canRedo(),
      lastOperation: this.lastOperation,
      operationCount: this.operationCount
    };
  }

  /**
   * Update session
   */
  updateSession(session: TradingSession): void {
    this.config.session = session;
    this.core.updateSession(session);
    
    secureLogger.info('Session updated', {
      sessionId: session.id,
      sessionName: session.session_name
    });
  }

  /**
   * Clear history
   */
  clearHistory(): void {
    this.core.clearHistory();
    this.operationCount = 0;
    this.lastOperation = undefined;
    
    secureLogger.info('Engine history cleared');
  }

  /**
   * Reset engine
   */
  reset(): void {
    this.clearHistory();
    secureLogger.info('Engine reset');
  }

  /**
   * Get statistics
   */
  getStatistics(): {
    totalOperations: number;
    lastOperation?: string;
    sessionId: string;
    sessionName: string;
  } {
    return {
      totalOperations: this.operationCount,
      lastOperation: this.lastOperation,
      sessionId: this.config.session.id,
      sessionName: this.config.session.session_name
    };
  }

  /**
   * Check if engine is ready for operations
   */
  isReady(): boolean {
    return !!this.config.session && !!this.config.session.id;
  }
}

// Factory function for easy creation
export function createCandleInputEngine(
  config: CandleInputEngineConfig
): CandleInputEngine {
  return new CandleInputEngine(config);
}
