/**
 * UNIFIED CANDLE INPUT COMPONENT
 * Professional candle input with new Engine integration
 */

import { useMemo, memo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  CandlestickChart, 
  AlertTriangle, 
  CheckCircle, 
  Undo2, 
  Redo2,
  Trash2,
  Save,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { TradingSession, CandleData } from '@/types/session';
import { useCandleInputEngine } from '@/hooks/candle/useCandleInputEngine';
import { calculateCandleDateTime } from '@/utils/dateTimeUtils';
import { cn } from '@/lib/utils';

interface UnifiedCandleInputProps {
  session: TradingSession;
  candles: CandleData[];
  onCandleSaved: (candle: CandleData) => Promise<void>;
  onCandleDeleted?: () => Promise<void>;
}

export const UnifiedCandleInput = memo(({ 
  session,
  candles,
  onCandleSaved,
  onCandleDeleted
}: UnifiedCandleInputProps) => {
  // Calculate next candle info
  const nextCandleIndex = useMemo(
    () => Math.max(session.current_candle_index + 1, candles.length),
    [session.current_candle_index, candles.length]
  );

  const nextCandleTime = useMemo(() => {
    try {
      return calculateCandleDateTime(
        session.start_date,
        session.start_time,
        session.timeframe,
        nextCandleIndex
      );
    } catch (error) {
      console.error('Error calculating next candle time:', error);
      return '';
    }
  }, [session, nextCandleIndex]);

  const previousCandle = useMemo(() => {
    if (candles.length === 0) return undefined;
    return candles.reduce((latest, current) => 
      current.candle_index > latest.candle_index ? current : latest
    );
  }, [candles]);

  // Use new engine hook
  const {
    formData,
    errors,
    isValid,
    isSubmitting,
    canUndo,
    canRedo,
    updateField,
    save,
    undo,
    redo,
    reset
  } = useCandleInputEngine({
    session,
    onCandleSaved,
    previousCandle
  });

  // Handle save
  const handleSave = useCallback(async () => {
    const result = await save(nextCandleIndex, nextCandleTime);
    if (result.success) {
      reset();
    }
  }, [save, nextCandleIndex, nextCandleTime, reset]);

  // Determine candle type for visual feedback
  const candleType = useMemo(() => {
    const open = parseFloat(formData.open);
    const close = parseFloat(formData.close);
    if (isNaN(open) || isNaN(close)) return null;
    return close > open ? 'bullish' : close < open ? 'bearish' : 'doji';
  }, [formData.open, formData.close]);

  // Field configurations for cleaner rendering
  const fields = [
    { 
      name: 'open' as const, 
      label: 'Open (Открытие)', 
      placeholder: '1.0850',
      icon: <TrendingUp className="h-4 w-4" />
    },
    { 
      name: 'high' as const, 
      label: 'High (Максимум)', 
      placeholder: '1.0870',
      icon: <TrendingUp className="h-4 w-4 text-success" />
    },
    { 
      name: 'low' as const, 
      label: 'Low (Минимум)', 
      placeholder: '1.0840',
      icon: <TrendingDown className="h-4 w-4 text-danger" />
    },
    { 
      name: 'close' as const, 
      label: 'Close (Закрытие)', 
      placeholder: '1.0860',
      icon: <TrendingDown className="h-4 w-4" />
    }
  ];

  return (
    <Card className="trading-card shadow-lg">
      <CardHeader className="space-y-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CandlestickChart className="h-5 w-5 text-primary" />
            Ввод данных OHLCV
          </CardTitle>
          
          {candleType && (
            <Badge 
              variant={
                candleType === 'bullish' ? 'default' : 
                candleType === 'bearish' ? 'destructive' : 
                'secondary'
              }
              className="animate-fade-in"
            >
              {candleType === 'bullish' ? '🟢 Бычья' : 
               candleType === 'bearish' ? '🔴 Медвежья' : 
               '⚪ Доджи'}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-sm">
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">
              Свеча #{nextCandleIndex}
            </span>
            <span className="text-xs text-muted-foreground">
              {nextCandleTime && new Date(nextCandleTime).toLocaleString('ru-RU')}
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={undo}
              disabled={!canUndo}
              title="Отменить последнюю операцию"
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={redo}
              disabled={!canRedo}
              title="Повторить отмененную операцию"
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* OHLC Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {fields.map(({ name, label, placeholder, icon }) => (
            <div key={name} className="space-y-2">
              <Label 
                htmlFor={name}
                className={cn(
                  "flex items-center justify-between",
                  errors[name] && "text-destructive"
                )}
              >
                <span className="flex items-center gap-2">
                  {icon}
                  {label}
                </span>
                {errors[name] && <AlertTriangle className="h-3 w-3" />}
              </Label>
              <Input
                id={name}
                type="number"
                step="any"
                placeholder={placeholder}
                value={formData[name]}
                onChange={(e) => updateField(name, e.target.value)}
                className={cn(
                  "transition-all",
                  errors[name] && "border-destructive focus-visible:ring-destructive"
                )}
                disabled={isSubmitting}
              />
              {errors[name] && (
                <p className="text-xs text-destructive animate-fade-in">
                  {errors[name]}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Volume Field */}
        <div className="space-y-2">
          <Label 
            htmlFor="volume"
            className={cn(
              "flex items-center justify-between",
              errors.volume && "text-destructive"
            )}
          >
            <span>Volume (Объем)</span>
            {errors.volume && <AlertTriangle className="h-3 w-3" />}
          </Label>
          <Input
            id="volume"
            type="number"
            step="1"
            placeholder="1000000"
            value={formData.volume}
            onChange={(e) => updateField('volume', e.target.value)}
            className={cn(
              "transition-all",
              errors.volume && "border-destructive focus-visible:ring-destructive"
            )}
            disabled={isSubmitting}
          />
          {errors.volume && (
            <p className="text-xs text-destructive animate-fade-in">
              {errors.volume}
            </p>
          )}
        </div>

        {/* Global Errors */}
        {Object.keys(errors).some(key => !['open', 'high', 'low', 'close', 'volume'].includes(key)) && (
          <Alert variant="destructive" className="animate-fade-in">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {Object.entries(errors)
                .filter(([key]) => !['open', 'high', 'low', 'close', 'volume'].includes(key))
                .map(([, value]) => value)
                .join(', ')}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={!isValid || isSubmitting}
            className="flex-1"
            size="lg"
          >
            {isSubmitting ? (
              <>Сохранение...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Сохранить свечу
              </>
            )}
          </Button>

          {previousCandle && onCandleDeleted && (
            <Button
              variant="outline"
              onClick={onCandleDeleted}
              disabled={isSubmitting}
              size="lg"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Удалить последнюю
            </Button>
          )}
        </div>

        {/* Success Indicator */}
        {isValid && !isSubmitting && (
          <Alert className="animate-fade-in border-success/50 bg-success/5">
            <CheckCircle className="h-4 w-4 text-success" />
            <AlertDescription className="text-success">
              Данные корректны. Готовы к сохранению.
            </AlertDescription>
          </Alert>
        )}

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Всего свечей</p>
            <p className="text-2xl font-bold">{candles.length}</p>
          </div>
          
          {previousCandle && (
            <>
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Последняя цена</p>
                <p className="text-2xl font-bold">{previousCandle.close.toFixed(5)}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Спред</p>
                <p className="text-2xl font-bold">
                  {previousCandle.spread?.toFixed(5) || '—'}
                </p>
              </div>
              
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">Объем</p>
                <p className="text-2xl font-bold">
                  {previousCandle.volume.toLocaleString()}
                </p>
              </div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
});

UnifiedCandleInput.displayName = 'UnifiedCandleInput';
