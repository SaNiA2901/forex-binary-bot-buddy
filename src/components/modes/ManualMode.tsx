import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualCharts } from "@/components/sections/ManualCharts";
import { ManualAnalytics } from "@/components/sections/ManualAnalytics";
import { ManualIndicators } from "@/components/sections/ManualIndicators";
import { ManualPatterns } from "@/components/sections/ManualPatterns";
import { ManualPredictions } from "@/components/sections/ManualPredictions";
import { SessionCreator } from "@/components/ui/session/SessionCreator";
import { SessionList } from "@/components/ui/session/SessionList";
import { UnifiedCandleInput } from "@/components/ui/candle/UnifiedCandleInput";
import { useStateManager } from "@/hooks/useStateManager";
import { Database, BarChart3 } from "lucide-react";

interface ManualModeProps {
  pair?: string;
  timeframe?: string;
}

export function ManualMode({ pair = "EUR/USD", timeframe = "1h" }: ManualModeProps = {}) {
  const { 
    currentSession, 
    candles, 
    loadSessions,
    loadSession,
    createSession,
    deleteSession,
    setCurrentSession,
    addCandle
  } = useStateManager();

  // Загружаем сессии при монтировании
  useEffect(() => {
    loadSessions().catch(console.error);
  }, [loadSessions]);

  const handleSessionCreated = async (sessionData: any) => {
    try {
      await createSession(sessionData);
    } catch (error) {
      console.error('Failed to create session:', error);
    }
  };

  const handleSessionSelect = async (session: any) => {
    try {
      await loadSession(session.id);
    } catch (error) {
      console.error('Failed to load session:', error);
    }
  };

  const handleSessionDelete = async (sessionId: string) => {
    try {
      await deleteSession(sessionId);
    } catch (error) {
      console.error('Failed to delete session:', error);
    }
  };

  const handleCandleSaved = async (candleData: any) => {
    if (!currentSession) return;
    
    try {
      await addCandle(candleData);
    } catch (error) {
      console.error('Failed to add candle:', error);
    }
  };

  if (!currentSession) {
    return (
      <div className="space-y-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Ручной режим</h1>
          <p className="text-muted-foreground">
            Создайте сессию и вводите данные OHLCV вручную для анализа
          </p>
        </div>

        <SessionCreator onSessionCreated={handleSessionCreated} />
        <SessionList 
          currentSession={null}
          onSessionSelect={handleSessionSelect}
          onSessionDelete={handleSessionDelete}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Ручной режим</h1>
          <p className="text-muted-foreground">
            Сессия: {currentSession.session_name} • {currentSession.pair} • {currentSession.timeframe}
          </p>
        </div>
        <div className="text-sm text-muted-foreground">
          Свечей: {candles.length}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UnifiedCandleInput 
          session={currentSession}
          candles={candles}
          onCandleSaved={handleCandleSaved}
        />
        <SessionList 
          currentSession={currentSession}
          onSessionSelect={handleSessionSelect}
          onSessionDelete={handleSessionDelete}
        />
      </div>

      <Tabs defaultValue="charts" className="w-full">
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="charts">Графики</TabsTrigger>
          <TabsTrigger value="analytics">Аналитика</TabsTrigger>
          <TabsTrigger value="indicators">Индикаторы</TabsTrigger>
          <TabsTrigger value="patterns">Паттерны</TabsTrigger>
          <TabsTrigger value="predictions">Прогнозы</TabsTrigger>
        </TabsList>

        <TabsContent value="charts" className="space-y-6">
          <ManualCharts pair={currentSession.pair} timeframe={currentSession.timeframe} />
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <ManualAnalytics pair={currentSession.pair} timeframe={currentSession.timeframe} />
        </TabsContent>

        <TabsContent value="indicators" className="space-y-6">
          <ManualIndicators pair={currentSession.pair} timeframe={currentSession.timeframe} />
        </TabsContent>

        <TabsContent value="patterns" className="space-y-6">
          <ManualPatterns pair={currentSession.pair} timeframe={currentSession.timeframe} />
        </TabsContent>

        <TabsContent value="predictions" className="space-y-6">
          <ManualPredictions pair={currentSession.pair} timeframe={currentSession.timeframe} />
        </TabsContent>
      </Tabs>
    </div>
  );
}