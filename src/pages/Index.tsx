import { useState, useEffect, lazy, Suspense } from "react";
import { ModernLayout } from "@/components/layout/ModernLayout";
import { OnlineMode } from "@/components/modes/OnlineMode";
import { ManualMode } from "@/components/modes/ManualMode";
import { isPreviewEnvironment } from "@/utils/previewOptimization";

// Lazy load heavy components for preview optimization
const PreviewOptimizedDashboard = lazy(() => 
  import("@/components/ui/enhanced/PreviewOptimizedDashboard").then(m => ({ default: m.PreviewOptimizedDashboard }))
);

// Подразделы для онлайн режима
import { OnlineCharts } from "@/components/sections/OnlineCharts";
import { OnlineAnalytics } from "@/components/sections/OnlineAnalytics";
import { OnlineIndicators } from "@/components/sections/OnlineIndicators";
import { OnlinePatterns } from "@/components/sections/OnlinePatterns";
import { OnlinePredictions } from "@/components/sections/OnlinePredictions";
import { OnlineSources } from "@/components/sections/OnlineSources";

// Настройки
import { SettingsPage } from "@/components/sections/SettingsPage";

export default function Index() {
  const [activeMode, setActiveMode] = useState("online");
  const [activeSubsection, setActiveSubsection] = useState("");
  const [selectedPair, setSelectedPair] = useState("EUR/USD");
  const [timeframe, setTimeframe] = useState("1h");
  const isPreview = isPreviewEnvironment();

  // Инициализация из localStorage
  useEffect(() => {
    try {
      const savedMode = localStorage.getItem('active-mode') || 'online';
      const savedSubsection = localStorage.getItem('active-subsection') || '';
      setActiveMode(savedMode);
      setActiveSubsection(savedSubsection);
    } catch {
      // Значения по умолчанию уже установлены
    }
  }, []);

  // Слушаем события навигации из sidebar
  useEffect(() => {
    const handleNavigationChange = (event: CustomEvent) => {
      const { mode, subsection } = event.detail;
      setActiveMode(mode);
      setActiveSubsection(subsection);
    };

    window.addEventListener('navigation-change', handleNavigationChange as EventListener);
    return () => {
      window.removeEventListener('navigation-change', handleNavigationChange as EventListener);
    };
  }, []);

  // Обновляем localStorage при изменении
  useEffect(() => {
    try {
      localStorage.setItem('active-mode', activeMode);
      localStorage.setItem('active-subsection', activeSubsection);
    } catch {
      // Игнорируем ошибки сохранения
    }
  }, [activeMode, activeSubsection]);

  // Обработчик переключения режимов через табы
  const handleModeChange = (mode: string) => {
    setActiveMode(mode);
    setActiveSubsection("");
    try {
      localStorage.setItem('active-mode', mode);
      localStorage.setItem('active-subsection', '');
    } catch {
      // Игнорируем ошибки сохранения
    }
  };

  // Функция для рендера активного контента
  const renderActiveContent = () => {
    // В Preview режиме показываем оптимизированную версию
    if (isPreview && !activeSubsection) {
      return (
        <Suspense fallback={<div className="text-center p-12">Загрузка...</div>}>
          <PreviewOptimizedDashboard />
        </Suspense>
      );
    }

    // Если выбраны настройки
    if (activeSubsection === "settings") {
      return <SettingsPage />;
    }

    // Подразделы онлайн режима
    if (activeMode === "online") {
      switch (activeSubsection) {
        case "charts":
          return <OnlineCharts pair={selectedPair} timeframe={timeframe} />;
        case "analytics":
          return <OnlineAnalytics pair={selectedPair} timeframe={timeframe} />;
        case "indicators":
          return <OnlineIndicators pair={selectedPair} timeframe={timeframe} />;
        case "patterns":
          return <OnlinePatterns pair={selectedPair} timeframe={timeframe} />;
        case "predictions":
          return <OnlinePredictions pair={selectedPair} timeframe={timeframe} />;
        case "sources":
          return <OnlineSources />;
        default:
          return <OnlineMode />;
      }
    }

    // Ручной режим с подразделами
    if (activeMode === "manual") {
      return <ManualMode pair={selectedPair} timeframe={timeframe} subsection={activeSubsection} />;
    }

    return <OnlineMode />;
  };

  return (
    <ModernLayout
      selectedPair={selectedPair}
      onPairChange={setSelectedPair}
      timeframe={timeframe}
      onTimeframeChange={setTimeframe}
    >
      {renderActiveContent()}
    </ModernLayout>
  );
}