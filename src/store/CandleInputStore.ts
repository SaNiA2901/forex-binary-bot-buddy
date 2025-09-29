/**
 * UNIFIED CANDLE INPUT STATE MANAGER
 * Zustand-based centralized state for candle input operations
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { CandleData, TradingSession } from '@/types/session';
import { CandleFormData } from '@/services/candle/CandleInputCore';
import { secureLogger } from '@/utils/secureLogger';

export interface CandleInputState {
  // Current form state
  formData: CandleFormData;
  errors: Record<string, string>;
  isSubmitting: boolean;
  
  // Session context
  currentSession: TradingSession | null;
  candles: CandleData[];
  
  // Operation history
  operationHistory: CandleOperation[];
  currentOperationIndex: number;
  
  // UI state
  isFormValid: boolean;
  lastSavedCandle: CandleData | null;
  
  // Actions
  setFormData: (data: CandleFormData) => void;
  updateField: (field: keyof CandleFormData, value: string) => void;
  setErrors: (errors: Record<string, string>) => void;
  setSubmitting: (isSubmitting: boolean) => void;
  
  setSession: (session: TradingSession | null) => void;
  setCandles: (candles: CandleData[]) => void;
  addCandle: (candle: CandleData) => void;
  removeCandle: (candleId: string) => void;
  
  recordOperation: (operation: CandleOperation) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  
  setFormValid: (isValid: boolean) => void;
  setLastSavedCandle: (candle: CandleData | null) => void;
  
  reset: () => void;
  clearForm: () => void;
}

export interface CandleOperation {
  type: 'add' | 'remove' | 'update';
  candle: CandleData;
  timestamp: number;
  sessionId: string;
}

const initialFormData: CandleFormData = {
  open: '',
  high: '',
  low: '',
  close: '',
  volume: ''
};

const initialState = {
  formData: initialFormData,
  errors: {},
  isSubmitting: false,
  currentSession: null,
  candles: [],
  operationHistory: [],
  currentOperationIndex: -1,
  isFormValid: false,
  lastSavedCandle: null,
};

export const useCandleInputStore = create<CandleInputState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Form data actions
        setFormData: (data: CandleFormData) => {
          set({ formData: data });
          secureLogger.debug('Form data updated', { data });
        },

        updateField: (field: keyof CandleFormData, value: string) => {
          set((state) => ({
            formData: {
              ...state.formData,
              [field]: value
            },
            // Clear error for this field
            errors: {
              ...state.errors,
              [field]: undefined
            }
          }));
        },

        setErrors: (errors: Record<string, string>) => {
          set({ errors });
        },

        setSubmitting: (isSubmitting: boolean) => {
          set({ isSubmitting });
        },

        // Session actions
        setSession: (session: TradingSession | null) => {
          set({ 
            currentSession: session,
            candles: [] // Clear candles when session changes
          });
          secureLogger.info('Session changed', { 
            sessionId: session?.id,
            sessionName: session?.session_name 
          });
        },

        setCandles: (candles: CandleData[]) => {
          set({ candles });
        },

        addCandle: (candle: CandleData) => {
          const state = get();
          
          set({ 
            candles: [...state.candles, candle],
            lastSavedCandle: candle,
            formData: {
              ...initialFormData,
              open: candle.close.toString() // Auto-fill next open
            }
          });

          // Record operation
          state.recordOperation({
            type: 'add',
            candle,
            timestamp: Date.now(),
            sessionId: candle.session_id
          });

          secureLogger.info('Candle added', {
            candleIndex: candle.candle_index,
            sessionId: candle.session_id
          });
        },

        removeCandle: (candleId: string) => {
          const state = get();
          const candle = state.candles.find(c => c.id === candleId);
          
          if (!candle) return;

          set({ 
            candles: state.candles.filter(c => c.id !== candleId)
          });

          // Record operation
          state.recordOperation({
            type: 'remove',
            candle,
            timestamp: Date.now(),
            sessionId: candle.session_id
          });

          secureLogger.info('Candle removed', {
            candleId,
            sessionId: candle.session_id
          });
        },

        // History actions
        recordOperation: (operation: CandleOperation) => {
          set((state) => {
            // Remove all operations after current index (if we're in the middle of history)
            const newHistory = state.operationHistory.slice(0, state.currentOperationIndex + 1);
            newHistory.push(operation);

            // Limit history to 50 operations
            if (newHistory.length > 50) {
              newHistory.shift();
            }

            return {
              operationHistory: newHistory,
              currentOperationIndex: newHistory.length - 1
            };
          });
        },

        canUndo: () => {
          const state = get();
          return state.currentOperationIndex >= 0;
        },

        canRedo: () => {
          const state = get();
          return state.currentOperationIndex < state.operationHistory.length - 1;
        },

        // UI state actions
        setFormValid: (isValid: boolean) => {
          set({ isFormValid: isValid });
        },

        setLastSavedCandle: (candle: CandleData | null) => {
          set({ lastSavedCandle: candle });
        },

        // Reset actions
        reset: () => {
          set(initialState);
          secureLogger.info('Candle input store reset');
        },

        clearForm: () => {
          set({ 
            formData: initialFormData,
            errors: {},
            isFormValid: false
          });
        }
      }),
      {
        name: 'candle-input-storage',
        partialize: (state) => ({
          // Only persist form data and last saved candle
          formData: state.formData,
          lastSavedCandle: state.lastSavedCandle
        })
      }
    ),
    {
      name: 'CandleInputStore',
      enabled: process.env.NODE_ENV === 'development'
    }
  )
);

// Selectors for optimized access
export const selectFormData = (state: CandleInputState) => state.formData;
export const selectErrors = (state: CandleInputState) => state.errors;
export const selectIsSubmitting = (state: CandleInputState) => state.isSubmitting;
export const selectCurrentSession = (state: CandleInputState) => state.currentSession;
export const selectCandles = (state: CandleInputState) => state.candles;
export const selectIsFormValid = (state: CandleInputState) => state.isFormValid;
export const selectLastSavedCandle = (state: CandleInputState) => state.lastSavedCandle;
export const selectCanUndo = (state: CandleInputState) => state.canUndo();
export const selectCanRedo = (state: CandleInputState) => state.canRedo();
