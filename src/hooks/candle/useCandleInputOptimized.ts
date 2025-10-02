/**
 * OPTIMIZED CANDLE INPUT HOOK
 * Enhanced version with memoization, debouncing, and performance optimizations
 */

import { useMemo, useCallback, useEffect, useRef } from 'react';
import { useCandleInputStore } from '@/store/CandleInputStore';
import { CandleInputEngine } from '@/services/candle/CandleInputEngine';
import { CandleFormData } from '@/services/candle/CandleInputCore';
import { TradingSession, CandleData } from '@/types/session';
import { secureLogger } from '@/utils/secureLogger';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

export interface UseCandleInputOptimizedProps {
  session: TradingSession;
  onCandleSaved?: (candle: CandleData) => Promise<void>;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  validationDelay?: number; // Debounce delay for validation (default: 300ms)
}

export interface CandleInputOptimizedState {
  formData: CandleFormData;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isValid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  
  // Actions
  updateField: (field: keyof CandleFormData, value: string) => void;
  saveCandle: (candleIndex: number, candleDateTime: string, previousCandle?: CandleData) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  reset: () => void;
  clearForm: () => void;
}

/**
 * Optimized hook for candle input with performance enhancements
 */
export function useCandleInputOptimized(
  props: UseCandleInputOptimizedProps
): CandleInputOptimizedState {
  const {
    session,
    onCandleSaved,
    onError,
    onSuccess,
    validationDelay = 300
  } = props;

  // Zustand store selectors - optimized with shallow comparison
  const formData = useCandleInputStore(state => state.formData);
  const errors = useCandleInputStore(state => state.errors);
  const isSubmitting = useCandleInputStore(state => state.isSubmitting);
  const isFormValid = useCandleInputStore(state => state.isFormValid);
  
  const setFormData = useCandleInputStore(state => state.setFormData);
  const updateFieldStore = useCandleInputStore(state => state.updateField);
  const setErrors = useCandleInputStore(state => state.setErrors);
  const setSubmitting = useCandleInputStore(state => state.setSubmitting);
  const setFormValid = useCandleInputStore(state => state.setFormValid);
  const setSession = useCandleInputStore(state => state.setSession);
  const clearFormStore = useCandleInputStore(state => state.clearForm);
  const reset = useCandleInputStore(state => state.reset);

  // Engine instance - memoized to avoid recreation
  const engine = useMemo(() => {
    return new CandleInputEngine({
      session,
      onCandleSaved,
      onError,
      onSuccess
    });
  }, [session.id, onCandleSaved, onError, onSuccess]);

  // Update session when it changes
  useEffect(() => {
    setSession(session);
    engine.updateSession(session);
  }, [session, setSession, engine]);

  // Debounced form data for validation
  const debouncedFormData = useDebouncedValue(formData, validationDelay);

  // Memoized validation - only runs when debounced form data changes
  const validationResult = useMemo(() => {
    // Skip validation if form is empty
    const hasAnyData = Object.values(debouncedFormData).some(v => v.trim() !== '');
    if (!hasAnyData) {
      return { isValid: false, errors: [], warnings: [] };
    }

    return engine.validate(debouncedFormData);
  }, [debouncedFormData, engine]);

  // Update errors and validity when validation result changes
  useEffect(() => {
    const errorMap: Record<string, string> = {};
    
    validationResult.errors.forEach(error => {
      errorMap[error.field] = error.message;
    });

    setErrors(errorMap);
    setFormValid(validationResult.isValid);
  }, [validationResult, setErrors, setFormValid]);

  // Optimized field update with immediate store update
  const updateField = useCallback((field: keyof CandleFormData, value: string) => {
    updateFieldStore(field, value);
  }, [updateFieldStore]);

  // Save candle with optimistic updates
  const saveCandle = useCallback(async (
    candleIndex: number,
    candleDateTime: string,
    previousCandle?: CandleData
  ) => {
    try {
      setSubmitting(true);

      const result = await engine.saveCandle(
        formData,
        candleIndex,
        candleDateTime,
        previousCandle
      );

      if (result.success && result.candle) {
        // Auto-fill next candle's open with current close
        setFormData({
          open: result.candle.close.toString(),
          high: '',
          low: '',
          close: '',
          volume: ''
        });
      }
    } catch (error) {
      secureLogger.error('Error in saveCandle', { error });
      if (onError) {
        onError('Ошибка сохранения свечи');
      }
    } finally {
      setSubmitting(false);
    }
  }, [formData, engine, setSubmitting, setFormData, onError]);

  // Undo with optimistic updates
  const undo = useCallback(async () => {
    const result = await engine.undo();
    if (result.success && result.candle) {
      // Optionally restore form data
      secureLogger.info('Undo successful', { candle: result.candle });
    }
  }, [engine]);

  // Redo with optimistic updates
  const redo = useCallback(async () => {
    const result = await engine.redo();
    if (result.success && result.candle) {
      secureLogger.info('Redo successful', { candle: result.candle });
    }
  }, [engine]);

  // Clear form
  const clearForm = useCallback(() => {
    clearFormStore();
  }, [clearFormStore]);

  // Get undo/redo status from engine
  const engineStatus = useMemo(() => engine.getStatus(), [engine]);

  return {
    formData,
    errors,
    isSubmitting,
    isValid: isFormValid,
    canUndo: engineStatus.canUndo,
    canRedo: engineStatus.canRedo,
    
    updateField,
    saveCandle,
    undo,
    redo,
    reset,
    clearForm
  };
}
