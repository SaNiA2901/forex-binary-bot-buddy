import React, { createContext, useContext, useReducer, useCallback, useEffect, ReactNode } from 'react';
import { sessionRepository } from '@/domains/session/infrastructure/SessionRepository';
import { candleRepository } from '@/domains/candle/infrastructure/CandleRepository';
import { predictionRepository } from '@/domains/prediction/infrastructure/PredictionRepository';
import { SessionEntity, CandleEntity, PredictionEntity, ModelPerformance, CreateSessionData, CreateCandleData, UpdateCandleData } from '@/shared/types/interfaces';
import { eventBus, EventFactory } from '@/shared/infrastructure/EventBus';
import { errorHandler } from '@/shared/infrastructure/ErrorHandler';
import { secureLogger } from '@/utils/secureLogger';
import { secureStorage } from '@/utils/secureStorage';

export interface SessionState {
  readonly sessions: SessionEntity[];
  readonly currentSession: SessionEntity | null;
  readonly loading: boolean;
  readonly error: string | null;
}

export interface CandleState {
  readonly candles: CandleEntity[];
  readonly nextIndex: number;
  readonly loading: boolean;
  readonly error: string | null;
}

export interface PredictionState {
  readonly predictions: PredictionEntity[];
  readonly lastPrediction: PredictionEntity | null;
  readonly performance: ModelPerformance;
  readonly loading: boolean;
  readonly error: string | null;
}

export interface UIState {
  readonly activeMode: 'online' | 'manual';
  readonly activeSubsection: string;
  readonly selectedPair: string;
  readonly timeframe: string;
  readonly isConnected: boolean;
  readonly notifications: UINotification[];
}

export interface UINotification {
  readonly id: string;
  readonly type: 'success' | 'warning' | 'error' | 'info';
  readonly title: string;
  readonly message: string;
  readonly timestamp: Date;
  readonly autoHide: boolean;
}

export interface AppState {
  readonly session: SessionState;
  readonly candle: CandleState;
  readonly prediction: PredictionState;
  readonly ui: UIState;
}

interface PredictionConfig {
  readonly model: string;
  readonly confidence: number;
  readonly lookback: number;
}

export type AppAction = 
  | { type: 'SESSION_LOAD_START' }
  | { type: 'SESSION_LOAD_SUCCESS'; payload: SessionEntity[] }
  | { type: 'SESSION_LOAD_ERROR'; payload: string }
  | { type: 'SESSION_SET_CURRENT'; payload: SessionEntity | null }
  | { type: 'SESSION_CREATE_SUCCESS'; payload: SessionEntity }
  | { type: 'SESSION_UPDATE_SUCCESS'; payload: SessionEntity }
  | { type: 'SESSION_DELETE_SUCCESS'; payload: string }
  | { type: 'CANDLE_LOAD_START' }
  | { type: 'CANDLE_LOAD_SUCCESS'; payload: CandleEntity[] }
  | { type: 'CANDLE_LOAD_ERROR'; payload: string }
  | { type: 'CANDLE_ADD_SUCCESS'; payload: CandleEntity }
  | { type: 'CANDLE_UPDATE_SUCCESS'; payload: CandleEntity }
  | { type: 'CANDLE_DELETE_SUCCESS'; payload: string }
  | { type: 'PREDICTION_LOAD_START' }
  | { type: 'PREDICTION_LOAD_SUCCESS'; payload: PredictionEntity[] }
  | { type: 'PREDICTION_LOAD_ERROR'; payload: string }
  | { type: 'PREDICTION_GENERATE_SUCCESS'; payload: PredictionEntity }
  | { type: 'PREDICTION_VALIDATE_SUCCESS'; payload: PredictionEntity }
  | { type: 'PREDICTION_PERFORMANCE_UPDATE'; payload: ModelPerformance }
  | { type: 'UI_SET_MODE'; payload: 'online' | 'manual' }
  | { type: 'UI_SET_SUBSECTION'; payload: string }
  | { type: 'UI_SET_PAIR'; payload: string }
  | { type: 'UI_SET_TIMEFRAME'; payload: string }
  | { type: 'UI_SET_CONNECTION'; payload: boolean }
  | { type: 'UI_ADD_NOTIFICATION'; payload: UINotification }
  | { type: 'UI_REMOVE_NOTIFICATION'; payload: string };

const initialState: AppState = {
  session: {
    sessions: [],
    currentSession: null,
    loading: false,
    error: null
  },
  candle: {
    candles: [],
    nextIndex: 0,
    loading: false,
    error: null
  },
  prediction: {
    predictions: [],
    lastPrediction: null,
    performance: {
      totalPredictions: 0,
      correctPredictions: 0,
      accuracy: 0,
      precisionUp: 0,
      precisionDown: 0,
      recallUp: 0,
      recallDown: 0,
      f1Score: 0,
      sharpeRatio: 0,
      maxDrawdown: 0
    },
    loading: false,
    error: null
  },
  ui: {
    activeMode: 'online',
    activeSubsection: '',
    selectedPair: 'EUR/USD',
    timeframe: '1h',
    isConnected: true,
    notifications: []
  }
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SESSION_LOAD_START':
      return {
        ...state,
        session: { ...state.session, loading: true, error: null }
      };

    case 'SESSION_LOAD_SUCCESS':
      return {
        ...state,
        session: { 
          ...state.session, 
          sessions: action.payload, 
          loading: false, 
          error: null 
        }
      };

    case 'SESSION_LOAD_ERROR':
      return {
        ...state,
        session: { 
          ...state.session, 
          loading: false, 
          error: action.payload 
        }
      };

    case 'SESSION_SET_CURRENT':
      return {
        ...state,
        session: { 
          ...state.session, 
          currentSession: action.payload 
        }
      };

    case 'SESSION_CREATE_SUCCESS':
      return {
        ...state,
        session: {
          ...state.session,
          sessions: [action.payload, ...state.session.sessions]
        }
      };

    case 'CANDLE_LOAD_START':
      return {
        ...state,
        candle: { ...state.candle, loading: true, error: null }
      };

    case 'CANDLE_LOAD_SUCCESS':
      const sortedCandles = [...action.payload].sort(
        (a, b) => a.index.value - b.index.value
      );
      const nextIndex = sortedCandles.length > 0 
        ? Math.max(...sortedCandles.map(c => c.index.value)) + 1 
        : 0;

      return {
        ...state,
        candle: {
          ...state.candle,
          candles: sortedCandles,
          nextIndex,
          loading: false,
          error: null
        }
      };

    case 'CANDLE_ADD_SUCCESS':
      const newCandles = [...state.candle.candles, action.payload].sort(
        (a, b) => a.index.value - b.index.value
      );

      return {
        ...state,
        candle: {
          ...state.candle,
          candles: newCandles,
          nextIndex: action.payload.index.value + 1
        }
      };

    case 'PREDICTION_GENERATE_SUCCESS':
      return {
        ...state,
        prediction: {
          ...state.prediction,
          predictions: [action.payload, ...state.prediction.predictions].slice(0, 100),
          lastPrediction: action.payload
        }
      };

    case 'PREDICTION_PERFORMANCE_UPDATE':
      return {
        ...state,
        prediction: {
          ...state.prediction,
          performance: action.payload
        }
      };

    case 'UI_SET_MODE':
      return {
        ...state,
        ui: { ...state.ui, activeMode: action.payload, activeSubsection: '' }
      };

    case 'UI_SET_SUBSECTION':
      return {
        ...state,
        ui: { ...state.ui, activeSubsection: action.payload }
      };

    case 'UI_SET_PAIR':
      return {
        ...state,
        ui: { ...state.ui, selectedPair: action.payload }
      };

    case 'UI_SET_TIMEFRAME':
      return {
        ...state,
        ui: { ...state.ui, timeframe: action.payload }
      };

    case 'UI_ADD_NOTIFICATION':
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: [action.payload, ...state.ui.notifications].slice(0, 10)
        }
      };

    case 'UI_REMOVE_NOTIFICATION':
      return {
        ...state,
        ui: {
          ...state.ui,
          notifications: state.ui.notifications.filter(n => n.id !== action.payload)
        }
      };

    default:
      return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  actions: AppActions;
}

const AppContext = createContext<AppContextType | null>(null);

interface AppActions {
  loadSessions(): Promise<void>;
  createSession(data: CreateSessionData): Promise<void>;
  loadSession(sessionId: string): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  loadCandles(sessionId: string): Promise<void>;
  addCandle(candleData: CreateCandleData): Promise<void>;
  updateCandle(candleId: string, updates: UpdateCandleData): Promise<void>;
  generatePrediction(candleData: CandleEntity[], config: PredictionConfig): Promise<void>;
  validatePrediction(predictionId: string, outcome: boolean): Promise<void>;
  setActiveMode(mode: 'online' | 'manual'): void;
  setActiveSubsection(subsection: string): void;
  setSelectedPair(pair: string): void;
  setTimeframe(timeframe: string): void;
  showNotification(notification: Omit<UINotification, 'id' | 'timestamp'>): void;
  hideNotification(id: string): void;
}

export interface TypeSafeStoreProviderProps {
  children: ReactNode;
}

export function TypeSafeStoreProvider({ children }: TypeSafeStoreProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const actions: AppActions = {
    async loadSessions() {
      dispatch({ type: 'SESSION_LOAD_START' });
      
      const result = await errorHandler.handleAsync(async () => {
        return await sessionRepository.findAll();
      });

      if (result.success) {
        dispatch({ type: 'SESSION_LOAD_SUCCESS', payload: result.data as any });
      } else {
        dispatch({ type: 'SESSION_LOAD_ERROR', payload: (result as any).error.message });
      }
    },

    async createSession(data: CreateSessionData) {
      const result = await errorHandler.handleAsync(async () => {
        const session = await sessionRepository.create(data);
        await eventBus.publish(EventFactory.sessionCreated(
          session.id.value,
          session.name.value,
          session.pair.symbol,
          session.timeframe.value
        ));
        return session;
      });

      if (result.success) {
        dispatch({ type: 'SESSION_CREATE_SUCCESS', payload: result.data as any });
        dispatch({ type: 'SESSION_SET_CURRENT', payload: result.data as any });
      } else {
        dispatch({ type: 'SESSION_LOAD_ERROR', payload: (result as any).error?.message || 'Unknown error' });
      }
    },

    async loadSession(sessionId: string) {
      const result = await errorHandler.handleAsync(async () => {
        const session = await sessionRepository.findById(sessionId);
        if (!session) throw new Error('Session not found');
        
        const candles = await candleRepository.findBySessionId(sessionId);
        
        await eventBus.publish(EventFactory.sessionLoaded(sessionId, candles.length));
        
        return { session, candles };
      });

      if (result.success) {
        dispatch({ type: 'SESSION_SET_CURRENT', payload: result.data.session });
        dispatch({ type: 'CANDLE_LOAD_SUCCESS', payload: result.data.candles });
      } else {
        dispatch({ type: 'SESSION_LOAD_ERROR', payload: result.error.message });
      }
    },

    async deleteSession(sessionId: string) {
      const result = await errorHandler.handleAsync(async () => {
        await sessionRepository.delete(sessionId);
      });

      if (result.success) {
        dispatch({ type: 'SESSION_DELETE_SUCCESS', payload: sessionId });
      } else {
        dispatch({ type: 'SESSION_LOAD_ERROR', payload: result.error.message });
      }
    },

    async loadCandles(sessionId: string) {
      dispatch({ type: 'CANDLE_LOAD_START' });
      
      const result = await errorHandler.handleAsync(async () => {
        return await candleRepository.findBySessionId(sessionId);
      });

      if (result.success) {
        dispatch({ type: 'CANDLE_LOAD_SUCCESS', payload: result.data });
      } else {
        dispatch({ type: 'CANDLE_LOAD_ERROR', payload: result.error.message });
      }
    },

    async addCandle(candleData: CreateCandleData) {
      const result = await errorHandler.handleAsync(async () => {
        const candle = await candleRepository.create(candleData);
        
        await eventBus.publish(EventFactory.candleAdded(
          candle.sessionId,
          candle.index.value,
          candle.ohlcv.close.value
        ));
        
        return candle;
      });

      if (result.success) {
        dispatch({ type: 'CANDLE_ADD_SUCCESS', payload: result.data });
      } else {
        dispatch({ type: 'CANDLE_LOAD_ERROR', payload: result.error.message });
      }
    },

    async updateCandle(candleId: string, updates: UpdateCandleData) {
      const result = await errorHandler.handleAsync(async () => {
        return await candleRepository.update(candleId, updates);
      });

      if (result.success) {
        dispatch({ type: 'CANDLE_UPDATE_SUCCESS', payload: result.data });
      } else {
        dispatch({ type: 'CANDLE_LOAD_ERROR', payload: result.error.message });
      }
    },

    async generatePrediction(candleData: CandleEntity[], config: PredictionConfig) {
      const result = await errorHandler.handleAsync(async () => {
        const prediction = await predictionRepository.generate(candleData, config);
        
        await eventBus.publish(EventFactory.predictionGenerated(
          prediction.sessionId,
          prediction.candleIndex,
          prediction.direction.value,
          prediction.probability.value,
          prediction.confidence.value
        ));
        
        return prediction;
      });

      if (result.success) {
        dispatch({ type: 'PREDICTION_GENERATE_SUCCESS', payload: result.data });
      } else {
        dispatch({ type: 'PREDICTION_LOAD_ERROR', payload: result.error.message });
      }
    },

    async validatePrediction(predictionId: string, outcome: boolean) {
      const result = await errorHandler.handleAsync(async () => {
        const prediction = await predictionRepository.validate(predictionId, outcome);
        
        await eventBus.publish(EventFactory.predictionValidated(
          predictionId,
          outcome,
          0,
          0
        ));
        
        return prediction;
      });

      if (result.success) {
        dispatch({ type: 'PREDICTION_VALIDATE_SUCCESS', payload: result.data });
      } else {
        dispatch({ type: 'PREDICTION_LOAD_ERROR', payload: result.error.message });
      }
    },

    setActiveMode(mode: 'online' | 'manual') {
      dispatch({ type: 'UI_SET_MODE', payload: mode });
    },

    setActiveSubsection(subsection: string) {
      dispatch({ type: 'UI_SET_SUBSECTION', payload: subsection });
    },

    setSelectedPair(pair: string) {
      dispatch({ type: 'UI_SET_PAIR', payload: pair });
    },

    setTimeframe(timeframe: string) {
      dispatch({ type: 'UI_SET_TIMEFRAME', payload: timeframe });
    },

    showNotification(notification: Omit<UINotification, 'id' | 'timestamp'>) {
      const fullNotification: UINotification = {
        ...notification,
        id: `notification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date()
      };
      dispatch({ type: 'UI_ADD_NOTIFICATION', payload: fullNotification });
    },

    hideNotification(id: string) {
      dispatch({ type: 'UI_REMOVE_NOTIFICATION', payload: id });
    }
  };

  return React.createElement(AppContext.Provider, { value: { state, dispatch, actions } }, children);
}

export function useTypeSafeStore(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useTypeSafeStore must be used within TypeSafeStoreProvider');
  }
  return context;
}

export function useSessionState() {
  const { state } = useTypeSafeStore();
  return state.session;
}

export function useCandleState() {
  const { state } = useTypeSafeStore();
  return state.candle;
}

export function usePredictionState() {
  const { state } = useTypeSafeStore();
  return state.prediction;
}

export function useUIState() {
  const { state } = useTypeSafeStore();
  return state.ui;
}

export function useStoreActions() {
  const { actions } = useTypeSafeStore();
  return actions;
}