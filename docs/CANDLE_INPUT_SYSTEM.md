# PROFESSIONAL CANDLE INPUT SYSTEM

## 📚 Обзор

Новая профессиональная система ввода данных свечей с полной валидацией, безопасностью и поддержкой undo/redo.

## 🏗️ Архитектура

```
┌─────────────────────────────────────────────┐
│         React Components (UI)               │
│  - CandleInput.tsx (обновленный)           │
│  - NewCandleInput.tsx (обновленный)        │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│         React Hooks Layer                   │
│  - useCandleInputEngine (новый)            │
│  - useCandleInputLogic (legacy adapter)    │
└────────────────┬────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────┐
│      CandleInputEngine (Orchestration)      │
│  - High-level API                          │
│  - Error handling                          │
│  - Success callbacks                       │
└────────────────┬────────────────────────────┘
                 │
        ┌────────┴────────┐
        ↓                 ↓
┌────────────────┐  ┌─────────────────────┐
│ CandleInputCore│  │ ValidationService   │
│ - Business Logic│  │ - Zod schemas      │
│ - Undo/Redo    │  │ - Business rules   │
└────────┬───────┘  └──────────┬──────────┘
         │                     │
         ↓                     ↓
    ┌────────────────────────────┐
    │    SecurityService         │
    │ - Input sanitization       │
    │ - Rate limiting            │
    │ - XSS protection           │
    └────────────────────────────┘
```

## 🚀 Быстрый старт

### Использование нового хука

```typescript
import { useCandleInputEngine } from '@/services/candle';

function MyComponent() {
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
    session: currentSession,
    onCandleSaved: async (candle) => {
      console.log('Saved:', candle);
    },
    previousCandle: lastCandle
  });

  return (
    <div>
      <input
        value={formData.open}
        onChange={(e) => updateField('open', e.target.value)}
      />
      {errors.open && <span>{errors.open}</span>}
      
      <button 
        onClick={() => save(candleIndex, candleDateTime)}
        disabled={!isValid || isSubmitting}
      >
        Save
      </button>
      
      <button onClick={undo} disabled={!canUndo}>Undo</button>
      <button onClick={redo} disabled={!canRedo}>Redo</button>
    </div>
  );
}
```

### Прямое использование Engine

```typescript
import { createCandleInputEngine } from '@/services/candle';

const engine = createCandleInputEngine({
  session: currentSession,
  onCandleSaved: async (candle) => {
    await api.saveCandle(candle);
  },
  onError: (error) => {
    toast.error(error);
  },
  onSuccess: (message) => {
    toast.success(message);
  }
});

// Validate
const validation = engine.validate(formData);
if (!validation.isValid) {
  console.error(validation.errors);
}

// Save
const result = await engine.saveCandle(
  formData,
  candleIndex,
  candleDateTime,
  previousCandle
);

// Undo/Redo
await engine.undo();
await engine.redo();
```

## 🔒 Безопасность

### Автоматическая защита

1. **Input Sanitization** - автоматическая очистка ввода
2. **Rate Limiting** - защита от спама (100 запросов/мин)
3. **XSS Protection** - защита от cross-site scripting
4. **SQL Injection Prevention** - проверка подозрительных паттернов

```typescript
// Все это происходит автоматически
const sanitized = CandleSecurityService.sanitizeFormData(rawInput);
const securityCheck = CandleSecurityService.performSecurityCheck(data, userId);
```

## ✅ Валидация

### Multi-level Validation

1. **Syntactic** - типы, форматы
2. **Semantic** - бизнес-правила (High >= Open, etc.)
3. **Contextual** - связи между данными
4. **Temporal** - проверка последовательности свечей

### Zod Schemas

```typescript
const CandleFormDataSchema = z.object({
  open: z.string()
    .min(1, 'Цена открытия обязательна')
    .refine(val => !isNaN(parseFloat(val)), 'Должна быть числом')
    .refine(val => parseFloat(val) > 0, 'Должна быть положительной'),
  // ... other fields
}).refine(data => {
  // Business Rule: High >= max(Open, Close)
  const high = parseFloat(data.high);
  const open = parseFloat(data.open);
  const close = parseFloat(data.close);
  return high >= Math.max(open, close);
}, {
  message: 'High должен быть >= max(Open, Close)',
  path: ['high']
});
```

## 🔄 Undo/Redo

```typescript
// Автоматический undo/redo stack
const { canUndo, canRedo, undo, redo } = useCandleInputEngine({ ... });

// Проверка возможности
if (canUndo) {
  await undo(); // Отменить последнюю операцию
}

if (canRedo) {
  await redo(); // Повторить отмененную операцию
}

// Очистка истории
clearHistory();
```

## 📊 Мониторинг

```typescript
const engine = createCandleInputEngine({ ... });

// Статус движка
const status = engine.getStatus();
console.log({
  isReady: status.isReady,
  hasSession: status.hasSession,
  canUndo: status.canUndo,
  canRedo: status.canRedo,
  lastOperation: status.lastOperation,
  operationCount: status.operationCount
});

// Статистика
const stats = engine.getStatistics();
console.log({
  totalOperations: stats.totalOperations,
  lastOperation: stats.lastOperation,
  sessionId: stats.sessionId,
  sessionName: stats.sessionName
});
```

## 🎯 Предупреждения и ошибки

### Validation Warnings

```typescript
const result = engine.validate(formData);

// Errors - критические, блокируют сохранение
result.errors.forEach(error => {
  console.error(`${error.field}: ${error.message}`);
});

// Warnings - не блокируют, но требуют внимания
result.warnings.forEach(warning => {
  console.warn(`${warning.field}: ${warning.message} [${warning.severity}]`);
});
```

### Типы предупреждений

- **Low severity** - информационные (низкий объем)
- **Medium severity** - требуют внимания (маленький спред)
- **High severity** - сильные подозрения (большой спред >5%)

## 🔧 Кастомизация

### Расширение валидации

```typescript
// Добавить свои правила
const CustomSchema = CandleFormDataSchema.refine(data => {
  // Ваша логика
  return myCustomRule(data);
}, {
  message: 'Нарушено кастомное правило',
  path: ['customField']
});
```

### Кастомные колбэки

```typescript
const engine = createCandleInputEngine({
  session: currentSession,
  onCandleSaved: async (candle) => {
    // Ваша логика после сохранения
    await customPostSaveLogic(candle);
  },
  onError: (error) => {
    // Ваша обработка ошибок
    customErrorHandler(error);
  },
  onSuccess: (message) => {
    // Ваша обработка успеха
    customSuccessHandler(message);
  }
});
```

## 📈 Performance

### Оптимизация

1. **Memoization** - автоматическое кеширование
2. **Debouncing** - для real-time валидации
3. **Lazy validation** - валидация по требованию

```typescript
// Валидация отдельного поля (быстро)
const fieldError = engine.validateField('open', value);

// Полная валидация (при submit)
const fullValidation = engine.validate(formData);
```

## 🔄 Миграция с Legacy

### Старый код

```typescript
import { validateFormData } from '@/utils/candleValidation';

const result = validateFormData(data);
```

### Новый код

```typescript
import { CandleValidationService } from '@/services/candle';

const result = CandleValidationService.validateFormData(data);
```

### Адаптер (временно)

```typescript
// Legacy файлы обновлены для использования новых сервисов
// Старый API работает, но рекомендуется переход на новый
import { validateFormData } from '@/utils/candleValidation'; // Работает!
```

## 🧪 Тестирование

```typescript
describe('CandleInputEngine', () => {
  it('validates candle data', () => {
    const result = CandleValidationService.validateFormData({
      open: '1.0850',
      high: '1.0870',
      low: '1.0840',
      close: '1.0860',
      volume: '1000000'
    });
    
    expect(result.isValid).toBe(true);
  });
  
  it('detects invalid OHLC', () => {
    const result = CandleValidationService.validateFormData({
      open: '1.0850',
      high: '1.0840', // High < Open - ошибка!
      low: '1.0840',
      close: '1.0860',
      volume: '1000000'
    });
    
    expect(result.isValid).toBe(false);
    expect(result.errors[0].field).toBe('high');
  });
});
```

## 📝 Best Practices

1. **Всегда используйте новый Engine** для новых компонентов
2. **Не обходите валидацию** - она защищает от ошибок
3. **Обрабатывайте warnings** - они указывают на потенциальные проблемы
4. **Используйте undo/redo** - улучшает UX
5. **Логируйте операции** - упрощает отладку

## 🚨 Troubleshooting

### Проблема: Валидация не срабатывает

```typescript
// Убедитесь, что session передана
const { isValid } = useCandleInputEngine({
  session: currentSession, // Не null!
  // ...
});
```

### Проблема: Undo не работает

```typescript
// Проверьте статус
const status = engine.getStatus();
console.log(status.canUndo); // false? Нет операций для отмены
```

### Проблема: Rate limit ошибка

```typescript
// Подождите 1 минуту или уменьшите частоту запросов
// Лимит: 100 запросов в минуту на session/user
```

## 🎓 Дальнейшие шаги

1. Изучите примеры в `src/components/ui/CandleInput.tsx`
2. Прочитайте комментарии в исходном коде
3. Запустите тесты для понимания работы
4. Создайте свой компонент с новым хуком

---

**Создано**: Phase 1 Improvement Plan  
**Версия**: 1.0.0  
**Статус**: Production Ready ✅
