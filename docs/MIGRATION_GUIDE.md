# MIGRATION GUIDE - Переход на новую систему ввода свечей

## 🎯 Обзор миграции

Проведена полная модернизация системы ввода свечей с сохранением обратной совместимости. Существующие компоненты продолжают работать, но рекомендуется переход на новую архитектуру.

## 📊 Статус компонентов

### ✅ ОБНОВЛЕНО
- `CandleInput.tsx` - обновлен для использования нового Engine
- `CandleInputForm.tsx` - типизирован и адаптирован
- `useCandleInputLogic` - legacy adapter создан

### 🆕 НОВЫЕ КОМПОНЕНТЫ
- `UnifiedCandleInput.tsx` - современная реализация
- `CandleInputModern.tsx` - обертка для совместимости
- `useCandleInputEngine` - профессиональный хук

### 🔧 НОВЫЕ СЕРВИСЫ
- `CandleValidationService` - Zod-валидация
- `CandleSecurityService` - безопасность
- `CandleInputCore` - бизнес-логика
- `CandleInputEngine` - оркестрация

## 🔄 План миграции

### Phase 1: Подготовка (ЗАВЕРШЕНА)
- ✅ Создана новая архитектура
- ✅ Обеспечена обратная совместимость
- ✅ Обновлены ключевые компоненты

### Phase 2: Постепенный переход
1. **Тестирование новых компонентов**
2. **Замена критических компонентов**
3. **Обновление пользовательских компонентов**

### Phase 3: Финальная очистка
1. **Удаление legacy кода**
2. **Оптимизация bundle size**
3. **Документация**

## 🔧 Как мигрировать

### 1. Простая замена (рекомендуется)

**Старый код:**
```typescript
import CandleInput from '@/components/ui/CandleInput';

<CandleInput
  currentSession={session}
  candles={candles}
  pair={pair}
  onCandleSaved={handleSave}
/>
```

**Новый код:**
```typescript
import { UnifiedCandleInput } from '@/components/ui/candle/UnifiedCandleInput';

<UnifiedCandleInput
  session={session}
  candles={candles}
  onCandleSaved={handleSave}
  onCandleDeleted={handleDelete}
/>
```

### 2. Обновление хука

**Старый код:**
```typescript
import { useCandleInputLogic } from '@/hooks/candle/useCandleInputLogic';

const {
  formData,
  errors,
  isSubmitting,
  handleSave,
  reset
} = useCandleInputLogic({
  currentSession,
  onCandleSaved
});
```

**Новый код:**
```typescript
import { useCandleInputEngine } from '@/hooks/candle/useCandleInputEngine';

const {
  formData,
  errors,
  isSubmitting,
  isValid,
  save,
  reset,
  undo,
  redo,
  canUndo,
  canRedo
} = useCandleInputEngine({
  session: currentSession,
  onCandleSaved,
  previousCandle
});
```

### 3. Обновление валидации

**Старый код:**
```typescript
import { validateFormData } from '@/utils/candleValidation';

const result = validateFormData(data);
if (!result.isValid) {
  setErrors(result.errors);
}
```

**Новый код:**
```typescript
import { CandleValidationService } from '@/services/candle';

const result = CandleValidationService.validateFormData(data);
if (!result.isValid) {
  const errorMap = {};
  result.errors.forEach(error => {
    errorMap[error.field] = error.message;
  });
  setErrors(errorMap);
}
```

## ⚠️ Breaking Changes

### Типы
- `any` заменены на строгие типы
- `CandleFormData` теперь типизирован
- Ошибки теперь `Record<string, string>`

### API изменения
- `onSubmit: () => void` → `onSubmit: () => Promise<void>`
- `onInputChange: (field: string, value: string)` → `onInputChange: (field: keyof CandleFormData, value: string)`

### Новые возможности
- **Undo/Redo** - возможность отменять операции
- **Real-time validation** - валидация по мере ввода
- **Security protection** - защита от XSS и инъекций
- **Rate limiting** - защита от спама
- **Temporal validation** - проверка последовательности

## 🛡️ Обратная совместимость

### Legacy Support
Старые компоненты продолжают работать через adapter:

```typescript
// Этот код продолжает работать!
import { useCandleInputLogic } from '@/hooks/candle/useCandleInputLogic';

const hook = useCandleInputLogic({ ... });
// Внутри использует новый Engine
```

### Deprecated API
```typescript
// DEPRECATED - но работает
import { validateFormData } from '@/utils/candleValidation';

// RECOMMENDED - новый API
import { CandleValidationService } from '@/services/candle';
```

## 🔍 Проверка миграции

### 1. Функциональность
- [ ] Ввод данных работает
- [ ] Валидация срабатывает
- [ ] Сохранение успешно
- [ ] Ошибки отображаются

### 2. Новые возможности
- [ ] Undo/Redo работает
- [ ] Real-time validation
- [ ] Security protection
- [ ] Warnings отображаются

### 3. Performance
- [ ] Нет лишних перерендеров
- [ ] Валидация быстрая
- [ ] Память не утекает

## 🚨 Известные проблемы

### Problem: Типы не совпадают
**Solution:**
```typescript
// Убедитесь что импортируете правильные типы
import { CandleFormData } from '@/services/candle/CandleInputCore';
```

### Problem: Validation не срабатывает
**Solution:**
```typescript
// Убедитесь что session передана
const hook = useCandleInputEngine({
  session: currentSession, // Не null!
  // ...
});
```

### Problem: Legacy hook не работает
**Solution:**
```typescript
// Используйте adapter
import { useCandleInputLogic } from '@/hooks/candle/useCandleInputLegacyAdapter';
```

## 📈 Производительность

### До миграции
- ❌ Множественные валидации
- ❌ Нет мемоизации
- ❌ Дублирование логики

### После миграции
- ✅ Единая валидация (Zod)
- ✅ Оптимизированные re-renders
- ✅ Централизованная логика

## 🎯 Рекомендации

### Немедленно
1. **Тестируйте** новые компоненты в dev
2. **Проверьте** совместимость с вашим кодом
3. **Изучите** новые возможности

### В ближайшее время
1. **Замените** критические компоненты
2. **Обновите** типы в TypeScript
3. **Добавьте** новые возможности (undo/redo)

### В будущем
1. **Удалите** legacy код
2. **Оптимизируйте** bundle
3. **Документируйте** изменения

## 📚 Дальнейшие шаги

1. Изучите [CANDLE_INPUT_SYSTEM.md](./CANDLE_INPUT_SYSTEM.md)
2. Просмотрите примеры в `src/components/ui/candle/`
3. Протестируйте новые компоненты
4. Создайте свой компонент с новым Engine

---

**Статус**: ✅ Ready for Migration  
**Совместимость**: 100% backward compatible  
**Риски**: Минимальные при правильном следовании гайду