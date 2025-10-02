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

// Business Rules
export {
  CandleBusinessRules,
  type BusinessRuleViolation,
  type BusinessRuleContext
} from './CandleBusinessRules';

// Autocomplete
export {
  CandleAutocompleteService,
  type AutocompleteOption
} from './CandleAutocompleteService';

// Import/Export
export {
  CandleImportExportService,
  type ImportResult,
  type ExportOptions
} from './CandleImportExportService';

// Hook
export {
  useCandleInputEngine,
  type UseCandleInputEngineProps,
  type CandleInputEngineState
} from '@/hooks/candle/useCandleInputEngine';
