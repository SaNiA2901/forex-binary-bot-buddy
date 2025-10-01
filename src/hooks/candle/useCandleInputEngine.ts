/**
 * PROFESSIONAL HOOK FOR CANDLE INPUT ENGINE
 * React integration for CandleInputEngine
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { TradingSession, CandleData } from '@/types/session';
import { CandleInputEngine, createCandleInputEngine } from '@/services/candle/CandleInputEngine';
import { CandleFormData, SaveCandleResult } from '@/services/candle/CandleInputCore';
import { ValidationResult } from '@/services/candle/CandleValidationService';
import { CandleBusinessRules, BusinessRuleViolation } from '@/services/candle/CandleBusinessRules';
import { CandleAutocompleteService, AutocompleteOption } from '@/services/candle/CandleAutocompleteService';
import { useToast } from '@/hooks/use-toast';

export interface UseCandleInputEngineProps {
  session: TradingSession | null;
  onCandleSaved?: (candle: CandleData) => Promise<void>;
  previousCandle?: CandleData;
}

export interface CandleInputEngineState {
  formData: CandleFormData;
  errors: Record<string, string>;
  isSubmitting: boolean;
  isValid: boolean;
  canUndo: boolean;
  canRedo: boolean;
  businessViolations: BusinessRuleViolation[];
  updateField: (field: keyof CandleFormData, value: string) => void;
  updateFormData: (data: Partial<CandleFormData>) => void;
  validateForm: () => ValidationResult;
  save: (candleIndex: number, candleDateTime: string) => Promise<SaveCandleResult>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  reset: () => void;
  clearHistory: () => void;
  autocomplete: (field: keyof CandleFormData) => AutocompleteOption[];
  autoFillAll: () => void;
}

export function useCandleInputEngine({
  session,
  onCandleSaved,
  previousCandle
}: UseCandleInputEngineProps): CandleInputEngineState {
  const { toast } = useToast();
  
  // Form state
  const [formData, setFormData] = useState<CandleFormData>({
    open: '',
    high: '',
    low: '',
    close: '',
    volume: ''
  });
  
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [businessViolations, setBusinessViolations] = useState<BusinessRuleViolation[]>([]);
  const previousCandlesRef = useRef<CandleData[]>([]);

  // Create engine instance
  const engine = useMemo(() => {
    if (!session) return null;

    return createCandleInputEngine({
      session,
      onCandleSaved,
      onError: (error) => {
        toast({
          title: 'Ошибка',
          description: error,
          variant: 'destructive'
        });
      },
      onSuccess: (message) => {
        toast({
          title: 'Успешно',
          description: message,
        });
      }
    });
  }, [session?.id, onCandleSaved]);

  useEffect(() => {
    if (previousCandle && !formData.open && !isSubmitting) {
      setFormData(prev => ({ ...prev, open: previousCandle.close.toString() }));
    }
    if (previousCandle) {
      previousCandlesRef.current = [...previousCandlesRef.current.slice(-49), previousCandle];
    }
  }, [previousCandle, formData.open, isSubmitting]);

  /**
   * Update single field with real-time validation
   */
  const updateField = useCallback((field: keyof CandleFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[field];
      return newErrors;
    });

    if (engine && value.trim()) {
      const fieldError = engine.validateField(field, value);
      if (fieldError) {
        setErrors(prev => ({ ...prev, [field]: fieldError }));
      }
    }

    // Business rules validation
    const currentCandle = { ...formData, [field]: value };
    const violations = CandleBusinessRules.validateBusinessRules(
      currentCandle as any,
      { previousCandles: previousCandlesRef.current }
    );
    setBusinessViolations(violations);
  }, [engine, formData]);

  /**
   * Update multiple fields at once
   */
  const updateFormData = useCallback((data: Partial<CandleFormData>) => {
    setFormData(prev => ({
      ...prev,
      ...data
    }));
  }, []);

  /**
   * Validate entire form
   */
  const validateForm = useCallback((): ValidationResult => {
    if (!engine) {
      return {
        isValid: false,
        errors: [{ field: 'session', message: 'Нет активной сессии', code: 'NO_SESSION' }],
        warnings: []
      };
    }

    const result = engine.validate(formData);

    // Update errors state
    const errorMap: Record<string, string> = {};
    result.errors.forEach(error => {
      errorMap[error.field] = error.message;
    });
    setErrors(errorMap);

    return result;
  }, [engine, formData]);

  /**
   * Save candle
   */
  const save = useCallback(async (
    candleIndex: number,
    candleDateTime: string
  ): Promise<SaveCandleResult> => {
    if (!engine) {
      toast({
        title: 'Ошибка',
        description: 'Нет активной сессии',
        variant: 'destructive'
      });
      return { success: false, errors: ['Нет активной сессии'] };
    }

    setIsSubmitting(true);

    try {
      const result = await engine.saveCandle(
        formData,
        candleIndex,
        candleDateTime,
        previousCandle
      );

      if (result.success) {
        // Reset form on success
        setFormData({
          open: result.candle?.close.toString() || '',
          high: '',
          low: '',
          close: '',
          volume: ''
        });
        setErrors({});
      } else {
        // Show errors
        const errorMap: Record<string, string> = {};
        result.errors?.forEach((error, index) => {
          errorMap[`error_${index}`] = error;
        });
        setErrors(errorMap);
      }

      return result;
    } catch (error) {
      toast({
        title: 'Критическая ошибка',
        description: 'Не удалось сохранить свечу',
        variant: 'destructive'
      });
      return { success: false, errors: ['Критическая ошибка'] };
    } finally {
      setIsSubmitting(false);
    }
  }, [engine, formData, previousCandle, toast]);

  /**
   * Undo last operation
   */
  const undo = useCallback(async () => {
    if (!engine) return;

    const result = await engine.undo();
    if (result.success && result.candle) {
      // Restore form with undone candle data
      setFormData({
        open: result.candle.open.toString(),
        high: result.candle.high.toString(),
        low: result.candle.low.toString(),
        close: result.candle.close.toString(),
        volume: result.candle.volume.toString()
      });
    }
  }, [engine]);

  /**
   * Redo last undone operation
   */
  const redo = useCallback(async () => {
    if (!engine) return;

    await engine.redo();
  }, [engine]);

  /**
   * Reset form
   */
  const reset = useCallback(() => {
    setFormData({
      open: previousCandle?.close.toString() || '',
      high: '',
      low: '',
      close: '',
      volume: ''
    });
    setErrors({});
  }, [previousCandle?.close]);

  /**
   * Clear history
   */
  const clearHistory = useCallback(() => {
    if (!engine) return;
    engine.clearHistory();
  }, [engine]);

  const isValid = useMemo(() => {
    const hasNoErrors = Object.keys(errors).length === 0;
    const hasAllFields = formData.open && formData.high && formData.low && formData.close && formData.volume;
    const hasNoCriticalViolations = !businessViolations.some(v => v.severity === 'error');
    return hasNoErrors && hasAllFields && hasNoCriticalViolations;
  }, [errors, formData, businessViolations]);

  // Get undo/redo status
  const status = useMemo(() => {
    if (!engine) return { canUndo: false, canRedo: false };
    return engine.getStatus();
  }, [engine, formData, isSubmitting]); // Re-check after operations

  const getAutocomplete = useCallback((field: keyof CandleFormData) => {
    const formDataRecord: Partial<Record<string, string>> = {
      open: formData.open,
      high: formData.high,
      low: formData.low,
      close: formData.close,
      volume: formData.volume
    };
    return CandleAutocompleteService.getSuggestions(field, formDataRecord, previousCandlesRef.current);
  }, [formData]);

  const autoFillAll = useCallback(() => {
    const autoFilled = CandleAutocompleteService.autoFillAllFields(previousCandlesRef.current);
    if (autoFilled) {
      setFormData(autoFilled);
      toast({ title: 'Автозаполнение', description: 'Все поля заполнены' });
    }
  }, [toast]);

  return {
    formData,
    errors,
    isSubmitting,
    isValid,
    canUndo: status.canUndo,
    canRedo: status.canRedo,
    businessViolations,
    updateField,
    updateFormData,
    validateForm,
    save,
    undo,
    redo,
    reset,
    clearHistory,
    autocomplete: getAutocomplete,
    autoFillAll
  };
}
