/**
 * BATCH CANDLE INPUT COMPONENT
 * Professional batch/bulk candle input mode
 */

import { useState, useCallback, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Upload, 
  Download, 
  FileText, 
  CheckCircle, 
  AlertTriangle,
  Layers,
  Play
} from 'lucide-react';
import { TradingSession, CandleData } from '@/types/session';
import { CandleImportExportService } from '@/services/candle/CandleImportExportService';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface BatchCandleInputProps {
  session: TradingSession;
  onBatchSaved: (candles: CandleData[]) => Promise<void>;
}

export const BatchCandleInput = memo(({ session, onBatchSaved }: BatchCandleInputProps) => {
  const { toast } = useToast();
  const [textInput, setTextInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<{
    success: boolean;
    stats?: { total: number; valid: number; invalid: number };
    errors?: string[];
    warnings?: string[];
  } | null>(null);

  // Handle file import
  const handleFileImport = useCallback(async (file: File) => {
    setIsProcessing(true);
    setProgress(0);
    
    try {
      const importResult = await CandleImportExportService.importFromFile(file, session.id);
      
      setProgress(50);
      
      if (importResult.success && importResult.candles) {
        await onBatchSaved(importResult.candles);
        setProgress(100);
        
        toast({
          title: 'Импорт успешен',
          description: `Импортировано ${importResult.candles.length} свечей`,
        });
      }
      
      setResult(importResult);
    } catch (error) {
      toast({
        title: 'Ошибка импорта',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [session.id, onBatchSaved, toast]);

  // Handle text input parsing
  const handleTextImport = useCallback(async () => {
    if (!textInput.trim()) {
      toast({
        title: 'Пустой ввод',
        description: 'Введите данные для импорта',
        variant: 'destructive'
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);

    try {
      // Try CSV format first
      const importResult = CandleImportExportService.parseCSV(
        textInput,
        session.id,
        { hasHeader: textInput.includes('candle_index') }
      );

      setProgress(50);

      if (importResult.success && importResult.candles) {
        await onBatchSaved(importResult.candles);
        setProgress(100);
        
        toast({
          title: 'Импорт успешен',
          description: `Обработано ${importResult.candles.length} свечей`,
        });
        
        setTextInput('');
      }

      setResult(importResult);
    } catch (error) {
      toast({
        title: 'Ошибка обработки',
        description: error instanceof Error ? error.message : 'Неизвестная ошибка',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  }, [textInput, session.id, onBatchSaved, toast]);

  // Download template
  const handleDownloadTemplate = useCallback(() => {
    CandleImportExportService.downloadTemplate();
    toast({
      title: 'Шаблон загружен',
      description: 'Откройте файл и заполните данными',
    });
  }, [toast]);

  return (
    <Card className="trading-card">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5 text-primary" />
              Пакетный ввод данных
            </CardTitle>
            <CardDescription className="mt-2">
              Импортируйте несколько свечей одновременно из файла или текста
            </CardDescription>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadTemplate}
          >
            <Download className="h-4 w-4 mr-2" />
            Скачать шаблон
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* File Import */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Импорт из файла</h3>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = '.csv,.json';
                input.onchange = (e) => {
                  const file = (e.target as HTMLInputElement).files?.[0];
                  if (file) handleFileImport(file);
                };
                input.click();
              }}
              disabled={isProcessing}
            >
              <Upload className="h-4 w-4 mr-2" />
              Выбрать файл (CSV, JSON)
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Поддерживаемые форматы: CSV с разделителем запятая, JSON массив
          </p>
        </div>

        {/* Text Import */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Импорт из текста</h3>
          <Textarea
            placeholder="Вставьте данные CSV (с заголовком или без)&#10;Пример:&#10;candle_index,candle_datetime,open,high,low,close,volume&#10;0,2024-01-01T00:00:00Z,1.0850,1.0870,1.0840,1.0860,1000000"
            value={textInput}
            onChange={(e) => setTextInput(e.target.value)}
            disabled={isProcessing}
            rows={8}
            className="font-mono text-xs"
          />
          <Button
            onClick={handleTextImport}
            disabled={isProcessing || !textInput.trim()}
            className="w-full"
          >
            <Play className="h-4 w-4 mr-2" />
            {isProcessing ? 'Обработка...' : 'Импортировать'}
          </Button>
        </div>

        {/* Progress */}
        {isProcessing && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Обработка...</span>
              <span className="font-medium">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-3">
            <Alert variant={result.success ? 'default' : 'destructive'}>
              {result.success ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <AlertTriangle className="h-4 w-4" />
              )}
              <AlertDescription>
                {result.success ? (
                  <div className="space-y-2">
                    <p className="font-medium">Импорт завершен успешно</p>
                    {result.stats && (
                      <div className="flex gap-4 text-sm">
                        <Badge variant="outline">
                          Всего: {result.stats.total}
                        </Badge>
                        <Badge variant="default" className="bg-success">
                          Валидных: {result.stats.valid}
                        </Badge>
                        {result.stats.invalid > 0 && (
                          <Badge variant="destructive">
                            Ошибок: {result.stats.invalid}
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="font-medium">Ошибки при импорте</p>
                    {result.errors && result.errors.length > 0 && (
                      <div className="space-y-1">
                        {result.errors.slice(0, 5).map((error, i) => (
                          <p key={i} className="text-xs">• {error}</p>
                        ))}
                        {result.errors.length > 5 && (
                          <p className="text-xs text-muted-foreground">
                            ... и еще {result.errors.length - 5} ошибок
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </AlertDescription>
            </Alert>

            {/* Warnings */}
            {result.warnings && result.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4 text-warning" />
                <AlertDescription>
                  <p className="font-medium mb-2">Предупреждения</p>
                  <div className="space-y-1">
                    {result.warnings.slice(0, 3).map((warning, i) => (
                      <p key={i} className="text-xs">• {warning}</p>
                    ))}
                    {result.warnings.length > 3 && (
                      <p className="text-xs text-muted-foreground">
                        ... и еще {result.warnings.length - 3} предупреждений
                      </p>
                    )}
                  </div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {/* Info */}
        <Alert>
          <FileText className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium mb-2">Формат данных</p>
            <div className="text-xs space-y-1">
              <p>• CSV: candle_index, candle_datetime, open, high, low, close, volume</p>
              <p>• JSON: массив объектов с теми же полями</p>
              <p>• Дата/время в формате ISO 8601: 2024-01-01T00:00:00Z</p>
            </div>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
});

BatchCandleInput.displayName = 'BatchCandleInput';
