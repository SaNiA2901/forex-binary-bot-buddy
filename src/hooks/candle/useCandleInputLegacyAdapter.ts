/**
 * LEGACY ADAPTER HOOK
 * Provides backward compatibility for old useCandleInputLogic interface
 */

import { useMemo } from 'react';
import { TradingSession, CandleData } from '@/types/session';
import { useCandleInputEngine } from './useCandleInputEngine';

interface UseCandleInputLegacyProps {
  currentSession: TradingSession | null;
  onCandleSaved?: (candleData: CandleData) => Promise<void>;
}

/**
 * Legacy adapter hook that maintains the old interface
 * while using the new Engine underneath
 */
export const useCandleInputLegacyAdapter = ({
  currentSession,
  onCandleSaved
}: UseCandleInputLegacyProps) => {
  const {
    formData,
    errors,
    isSubmitting,
    isValid,
    updateField,
    save,
    reset,
    undo
  } = useCandleInputEngine({
    session: currentSession,
    onCandleSaved
  });

  // Convert errors object to old format
  const convertedErrors = useMemo(() => {
    const converted: Record<string, string> = {};
    Object.entries(errors).forEach(([key, value]) => {
      if (value) converted[key] = value;
    });
    return converted;
  }, [errors]);

  // Legacy interface mapping
  return {
    formData,
    errors: convertedErrors,
    formErrors: convertedErrors, // Alternative name
    isSubmitting,
    formSubmitting: isSubmitting,
    isFormValid: isValid,
    isValid,
    
    // Actions with legacy names
    handleInputChange: updateField,
    updateField,
    
    handleFormSubmit: async (candleIndex: number) => {
      // Calculate next candle time (simplified)
      const candleDateTime = new Date().toISOString();
      const result = await save(candleIndex, candleDateTime);
      return result.candle;
    },
    
    handleSave: save,
    resetForm: reset,
    reset,
    
    validateForm: () => ({ isValid }),
    
    // Undo functionality
    handleDeleteLast: undo,
    
    // Computed values
    nextCandleIndex: 0, // Will be provided by parent
    candles: [] as CandleData[], // Will be provided by parent
    lastCandle: null as CandleData | null // Will be computed by parent
  };
};

/**
 * @deprecated Use useCandleInputEngine directly for new code
 * This hook is for backward compatibility only
 */
export const useCandleInputLogic = useCandleInputLegacyAdapter;