-- ===================================================
-- МИГРАЦИЯ: Создание таблиц для трейдинговых сессий
-- ===================================================

-- 1. Таблица трейдинговых сессий
CREATE TABLE IF NOT EXISTS public.trading_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_name TEXT NOT NULL CHECK (char_length(session_name) >= 3 AND char_length(session_name) <= 100),
  pair TEXT NOT NULL CHECK (char_length(pair) >= 3 AND char_length(pair) <= 20),
  timeframe TEXT NOT NULL CHECK (timeframe IN ('1m', '5m', '15m', '30m', '1h', '4h', '1d', '1w')),
  start_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  current_candle_index INTEGER NOT NULL DEFAULT 0 CHECK (current_candle_index >= 0),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. Таблица свечей
CREATE TABLE IF NOT EXISTS public.candle_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES public.trading_sessions(id) ON DELETE CASCADE,
  candle_index INTEGER NOT NULL CHECK (candle_index >= 0),
  open NUMERIC(20, 8) NOT NULL CHECK (open > 0),
  high NUMERIC(20, 8) NOT NULL CHECK (high > 0),
  low NUMERIC(20, 8) NOT NULL CHECK (low > 0),
  close NUMERIC(20, 8) NOT NULL CHECK (close > 0),
  volume NUMERIC(20, 8) NOT NULL DEFAULT 0 CHECK (volume >= 0),
  candle_datetime TIMESTAMP WITH TIME ZONE NOT NULL,
  spread NUMERIC(20, 8) CHECK (spread >= 0),
  prediction_direction TEXT CHECK (prediction_direction IN ('UP', 'DOWN', 'NEUTRAL')),
  prediction_probability NUMERIC(5, 4) CHECK (prediction_probability >= 0 AND prediction_probability <= 1),
  prediction_confidence NUMERIC(5, 4) CHECK (prediction_confidence >= 0 AND prediction_confidence <= 1),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE(session_id, candle_index)
);

-- 3. Индексы для оптимизации
CREATE INDEX IF NOT EXISTS idx_trading_sessions_user_id ON public.trading_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_pair ON public.trading_sessions(pair);
CREATE INDEX IF NOT EXISTS idx_trading_sessions_created_at ON public.trading_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_candle_data_session_id ON public.candle_data(session_id);
CREATE INDEX IF NOT EXISTS idx_candle_data_candle_index ON public.candle_data(session_id, candle_index);
CREATE INDEX IF NOT EXISTS idx_candle_data_datetime ON public.candle_data(candle_datetime);

-- 4. Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Триггеры для обновления timestamps
DROP TRIGGER IF EXISTS update_trading_sessions_updated_at ON public.trading_sessions;
CREATE TRIGGER update_trading_sessions_updated_at
  BEFORE UPDATE ON public.trading_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Функция для валидации OHLC данных
CREATE OR REPLACE FUNCTION public.validate_ohlc_data()
RETURNS TRIGGER AS $$
BEGIN
  -- Проверяем что high >= low
  IF NEW.high < NEW.low THEN
    RAISE EXCEPTION 'High price cannot be less than low price';
  END IF;
  
  -- Проверяем что open и close находятся между high и low
  IF NEW.open > NEW.high OR NEW.open < NEW.low THEN
    RAISE EXCEPTION 'Open price must be between high and low';
  END IF;
  
  IF NEW.close > NEW.high OR NEW.close < NEW.low THEN
    RAISE EXCEPTION 'Close price must be between high and low';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 7. Триггер для валидации OHLC
DROP TRIGGER IF EXISTS validate_ohlc_before_insert ON public.candle_data;
CREATE TRIGGER validate_ohlc_before_insert
  BEFORE INSERT OR UPDATE ON public.candle_data
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_ohlc_data();

-- 8. Enable Row Level Security
ALTER TABLE public.trading_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candle_data ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies для trading_sessions
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.trading_sessions;
CREATE POLICY "Users can view their own sessions"
  ON public.trading_sessions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own sessions" ON public.trading_sessions;
CREATE POLICY "Users can create their own sessions"
  ON public.trading_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own sessions" ON public.trading_sessions;
CREATE POLICY "Users can update their own sessions"
  ON public.trading_sessions FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own sessions" ON public.trading_sessions;
CREATE POLICY "Users can delete their own sessions"
  ON public.trading_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- 10. RLS Policies для candle_data
DROP POLICY IF EXISTS "Users can view candles from their sessions" ON public.candle_data;
CREATE POLICY "Users can view candles from their sessions"
  ON public.candle_data FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.trading_sessions
      WHERE trading_sessions.id = candle_data.session_id
      AND trading_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert candles to their sessions" ON public.candle_data;
CREATE POLICY "Users can insert candles to their sessions"
  ON public.candle_data FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.trading_sessions
      WHERE trading_sessions.id = candle_data.session_id
      AND trading_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update candles in their sessions" ON public.candle_data;
CREATE POLICY "Users can update candles in their sessions"
  ON public.candle_data FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.trading_sessions
      WHERE trading_sessions.id = candle_data.session_id
      AND trading_sessions.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete candles from their sessions" ON public.candle_data;
CREATE POLICY "Users can delete candles from their sessions"
  ON public.candle_data FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.trading_sessions
      WHERE trading_sessions.id = candle_data.session_id
      AND trading_sessions.user_id = auth.uid()
    )
  );

-- 11. Комментарии для документации
COMMENT ON TABLE public.trading_sessions IS 'Торговые сессии пользователей с настройками и метаданными';
COMMENT ON TABLE public.candle_data IS 'Данные свечей для каждой торговой сессии с OHLCV и прогнозами';
COMMENT ON COLUMN public.trading_sessions.current_candle_index IS 'Текущий индекс свечи в сессии (автоматически обновляется)';
COMMENT ON COLUMN public.candle_data.candle_index IS 'Порядковый номер свечи в рамках сессии';
COMMENT ON FUNCTION public.validate_ohlc_data() IS 'Проверяет корректность OHLC данных перед сохранением';