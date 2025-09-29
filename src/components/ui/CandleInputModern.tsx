/**
 * MODERN CANDLE INPUT - Next Generation Component
 * Professional implementation with new Engine
 */

import { memo } from 'react';
import { TradingSession, CandleData } from '@/types/session';
import { UnifiedCandleInput } from './candle/UnifiedCandleInput';

interface CandleInputModernProps {
  currentSession: TradingSession;
  candles: CandleData[];
  onCandleSaved: (candleData: CandleData) => Promise<void>;
  onCandleDeleted?: () => Promise<void>;
}

/**
 * Modern Candle Input Component
 * Wrapper around UnifiedCandleInput for backward compatibility
 */
export const CandleInputModern = memo(({ 
  currentSession,
  candles,
  onCandleSaved,
  onCandleDeleted
}: CandleInputModernProps) => {
  return (
    <UnifiedCandleInput
      session={currentSession}
      candles={candles}
      onCandleSaved={onCandleSaved}
      onCandleDeleted={onCandleDeleted}
    />
  );
});

CandleInputModern.displayName = 'CandleInputModern';

export default CandleInputModern;