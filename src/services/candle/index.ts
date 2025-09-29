/**
 * CANDLE INPUT SYSTEM - Public API
 * Unified exports for all candle input functionality
 */

// Engine
export { 
  CandleInputEngine, 
  createCandleInputEngine,
  type CandleInputEngineConfig,
  type EngineStatus 
} from './CandleInputEngine';

// Core
export {
  CandleInputCore,
  type CandleFormData,
  type SaveCandleResult,
  type UndoRedoResult,
  type CandleInputCoreConfig
} from './CandleInputCore';

// Validation
export {
  CandleValidationService,
  CandleFormDataSchema,
  CandleDataSchema,
  type ValidationResult,
  type ValidationError,
  type ValidationWarning
} from './CandleValidationService';

// Security
export {
  CandleSecurityService,
  type SanitizedCandleFormData,
  type SecurityCheckResult
} from './CandleSecurityService';

// Hook
export {
  useCandleInputEngine,
  type UseCandleInputEngineProps,
  type CandleInputEngineState
} from '@/hooks/candle/useCandleInputEngine';
