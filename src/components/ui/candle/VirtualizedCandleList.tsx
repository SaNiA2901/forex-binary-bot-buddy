/**
 * VIRTUALIZED CANDLE LIST
 * High-performance list component for displaying large numbers of candles
 * Uses windowing technique to render only visible items
 */

import React, { useMemo } from 'react';
// @ts-ignore - react-window has typing issues
import { FixedSizeList } from 'react-window';
import { CandleData } from '@/types/session';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { format } from 'date-fns';

interface VirtualizedCandleListProps {
  candles: CandleData[];
  height?: number;
  itemHeight?: number;
  onCandleClick?: (candle: CandleData) => void;
}

interface CandleRowProps {
  index: number;
  style: React.CSSProperties;
  data: {
    candles: CandleData[];
    onCandleClick?: (candle: CandleData) => void;
  };
}

const CandleRow: React.FC<CandleRowProps> = ({ index, style, data }) => {
  const { candles, onCandleClick } = data;
  const candle = candles[index];

  if (!candle) return null;

  const direction = candle.close > candle.open ? 'bullish' : 
                   candle.close < candle.open ? 'bearish' : 'doji';
  
  const priceChange = candle.close - candle.open;
  const priceChangePercent = (priceChange / candle.open) * 100;

  return (
    <div style={style}>
      <Card
        className="mx-2 my-1 p-3 cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => onCandleClick?.(candle)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${
              direction === 'bullish' ? 'bg-green-500/10' :
              direction === 'bearish' ? 'bg-red-500/10' : 'bg-muted'
            }`}>
              {direction === 'bullish' && <TrendingUp className="h-4 w-4 text-green-500" />}
              {direction === 'bearish' && <TrendingDown className="h-4 w-4 text-red-500" />}
              {direction === 'doji' && <Minus className="h-4 w-4 text-muted-foreground" />}
            </div>
            
            <div>
              <div className="font-semibold">
                Свеча #{candle.candle_index}
              </div>
              <div className="text-xs text-muted-foreground">
                {format(new Date(candle.candle_datetime), 'dd.MM.yyyy HH:mm')}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="font-mono text-sm">
                O: {candle.open.toFixed(5)} → C: {candle.close.toFixed(5)}
              </div>
              <div className="text-xs text-muted-foreground font-mono">
                H: {candle.high.toFixed(5)} | L: {candle.low.toFixed(5)}
              </div>
            </div>

            <Badge variant={direction === 'bullish' ? 'default' : direction === 'bearish' ? 'destructive' : 'secondary'}>
              {priceChangePercent > 0 ? '+' : ''}{priceChangePercent.toFixed(2)}%
            </Badge>
          </div>
        </div>
      </Card>
    </div>
  );
};

export const VirtualizedCandleList: React.FC<VirtualizedCandleListProps> = ({
  candles,
  height = 600,
  itemHeight = 80,
  onCandleClick
}) => {
  // Memoize the item data to prevent unnecessary re-renders
  const itemData = useMemo(() => ({
    candles,
    onCandleClick
  }), [candles, onCandleClick]);

  if (candles.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">Нет свечей для отображения</p>
      </Card>
    );
  }

  return (
    <FixedSizeList
      height={height}
      itemCount={candles.length}
      itemSize={itemHeight}
      width="100%"
      itemData={itemData}
    >
      {CandleRow}
    </FixedSizeList>
  );
};
