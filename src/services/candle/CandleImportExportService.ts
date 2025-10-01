/**
 * CANDLE IMPORT/EXPORT SERVICE
 * Professional data import/export functionality
 */

import { CandleData } from '@/types/session';
import { secureLogger } from '@/utils/secureLogger';
import { CandleValidationService } from './CandleValidationService';

export type ExportFormat = 'csv' | 'json' | 'xlsx';
export type ImportFormat = 'csv' | 'json';

export interface ImportResult {
  success: boolean;
  candles?: CandleData[];
  errors?: string[];
  warnings?: string[];
  stats?: {
    total: number;
    valid: number;
    invalid: number;
  };
}

export interface ExportOptions {
  format: ExportFormat;
  filename?: string;
  includeHeader?: boolean;
  delimiter?: string;
}

/**
 * Professional Import/Export Service for Candle Data
 */
export class CandleImportExportService {
  /**
   * Export candles to CSV format
   */
  static exportToCSV(
    candles: CandleData[],
    options: { delimiter?: string; includeHeader?: boolean } = {}
  ): string {
    const delimiter = options.delimiter || ',';
    const includeHeader = options.includeHeader !== false;

    const lines: string[] = [];

    // Add header
    if (includeHeader) {
      lines.push([
        'candle_index',
        'candle_datetime',
        'open',
        'high',
        'low',
        'close',
        'volume',
        'spread'
      ].join(delimiter));
    }

    // Add data rows
    candles.forEach(candle => {
      lines.push([
        candle.candle_index,
        candle.candle_datetime,
        candle.open,
        candle.high,
        candle.low,
        candle.close,
        candle.volume,
        candle.spread || ''
      ].join(delimiter));
    });

    return lines.join('\n');
  }

  /**
   * Export candles to JSON format
   */
  static exportToJSON(candles: CandleData[]): string {
    return JSON.stringify(candles, null, 2);
  }

  /**
   * Export candles and trigger download
   */
  static async exportCandles(
    candles: CandleData[],
    options: ExportOptions
  ): Promise<void> {
    try {
      let content: string;
      let mimeType: string;
      let extension: string;

      switch (options.format) {
        case 'csv':
          content = this.exportToCSV(candles, options);
          mimeType = 'text/csv';
          extension = 'csv';
          break;

        case 'json':
          content = this.exportToJSON(candles);
          mimeType = 'application/json';
          extension = 'json';
          break;

        case 'xlsx':
          throw new Error('XLSX export not yet implemented');

        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      // Create blob and download
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      
      const filename = options.filename || `candles_${Date.now()}.${extension}`;
      link.href = url;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      URL.revokeObjectURL(url);

      secureLogger.info('Candles exported successfully', {
        format: options.format,
        count: candles.length,
        filename
      });
    } catch (error) {
      secureLogger.error('Error exporting candles', { error, options });
      throw error;
    }
  }

  /**
   * Parse CSV content to candles
   */
  static parseCSV(
    content: string,
    sessionId: string,
    options: { delimiter?: string; hasHeader?: boolean } = {}
  ): ImportResult {
    const delimiter = options.delimiter || ',';
    const hasHeader = options.hasHeader !== false;

    const lines = content.split('\n').filter(line => line.trim());
    const candles: CandleData[] = [];
    const errors: string[] = [];
    const warnings: string[] = [];

    let startIndex = hasHeader ? 1 : 0;

    for (let i = startIndex; i < lines.length; i++) {
      try {
        const values = lines[i].split(delimiter).map(v => v.trim());

        if (values.length < 7) {
          errors.push(`Строка ${i + 1}: недостаточно полей`);
          continue;
        }

        const candleData: CandleData = {
          session_id: sessionId,
          candle_index: parseInt(values[0]),
          candle_datetime: values[1],
          open: parseFloat(values[2]),
          high: parseFloat(values[3]),
          low: parseFloat(values[4]),
          close: parseFloat(values[5]),
          volume: parseFloat(values[6]),
          spread: values[7] ? parseFloat(values[7]) : undefined
        };

        // Validate
        const validation = CandleValidationService.validateCandleData(candleData);
        
        if (!validation.isValid) {
          errors.push(`Строка ${i + 1}: ${validation.errors.map(e => e.message).join(', ')}`);
          continue;
        }

        if (validation.warnings.length > 0) {
          warnings.push(`Строка ${i + 1}: ${validation.warnings.map(w => w.message).join(', ')}`);
        }

        candles.push(candleData);
      } catch (error) {
        errors.push(`Строка ${i + 1}: ошибка парсинга - ${error instanceof Error ? error.message : 'unknown'}`);
      }
    }

    return {
      success: errors.length === 0,
      candles,
      errors: errors.length > 0 ? errors : undefined,
      warnings: warnings.length > 0 ? warnings : undefined,
      stats: {
        total: lines.length - startIndex,
        valid: candles.length,
        invalid: errors.length
      }
    };
  }

  /**
   * Parse JSON content to candles
   */
  static parseJSON(
    content: string,
    sessionId: string
  ): ImportResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const candles: CandleData[] = [];

    try {
      const data = JSON.parse(content);
      
      if (!Array.isArray(data)) {
        return {
          success: false,
          errors: ['JSON должен содержать массив объектов']
        };
      }

      data.forEach((item, index) => {
        try {
          const candleData: CandleData = {
            session_id: sessionId,
            candle_index: item.candle_index,
            candle_datetime: item.candle_datetime,
            open: parseFloat(item.open),
            high: parseFloat(item.high),
            low: parseFloat(item.low),
            close: parseFloat(item.close),
            volume: parseFloat(item.volume),
            spread: item.spread ? parseFloat(item.spread) : undefined
          };

          // Validate
          const validation = CandleValidationService.validateCandleData(candleData);
          
          if (!validation.isValid) {
            errors.push(`Элемент ${index}: ${validation.errors.map(e => e.message).join(', ')}`);
            return;
          }

          if (validation.warnings.length > 0) {
            warnings.push(`Элемент ${index}: ${validation.warnings.map(w => w.message).join(', ')}`);
          }

          candles.push(candleData);
        } catch (error) {
          errors.push(`Элемент ${index}: ${error instanceof Error ? error.message : 'unknown error'}`);
        }
      });

      return {
        success: errors.length === 0,
        candles,
        errors: errors.length > 0 ? errors : undefined,
        warnings: warnings.length > 0 ? warnings : undefined,
        stats: {
          total: data.length,
          valid: candles.length,
          invalid: errors.length
        }
      };
    } catch (error) {
      return {
        success: false,
        errors: [`Ошибка парсинга JSON: ${error instanceof Error ? error.message : 'unknown'}`]
      };
    }
  }

  /**
   * Import candles from file
   */
  static async importFromFile(
    file: File,
    sessionId: string
  ): Promise<ImportResult> {
    try {
      const content = await file.text();
      
      // Determine format by extension
      const extension = file.name.split('.').pop()?.toLowerCase();
      
      if (extension === 'csv') {
        return this.parseCSV(content, sessionId);
      } else if (extension === 'json') {
        return this.parseJSON(content, sessionId);
      } else {
        return {
          success: false,
          errors: [`Неподдерживаемый формат файла: ${extension}`]
        };
      }
    } catch (error) {
      secureLogger.error('Error importing file', { error, filename: file.name });
      return {
        success: false,
        errors: [`Ошибка чтения файла: ${error instanceof Error ? error.message : 'unknown'}`]
      };
    }
  }

  /**
   * Create template CSV for import
   */
  static createImportTemplate(): string {
    return [
      'candle_index,candle_datetime,open,high,low,close,volume,spread',
      '0,2024-01-01T00:00:00Z,1.0850,1.0870,1.0840,1.0860,1000000,0.0030',
      '1,2024-01-01T00:05:00Z,1.0860,1.0880,1.0850,1.0875,1100000,0.0030',
      '2,2024-01-01T00:10:00Z,1.0875,1.0890,1.0865,1.0880,950000,0.0025'
    ].join('\n');
  }

  /**
   * Download import template
   */
  static downloadTemplate(): void {
    const content = this.createImportTemplate();
    const blob = new Blob([content], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    
    link.href = url;
    link.download = 'candles_import_template.csv';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  }
}
