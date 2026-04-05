# ВАЖНО: Как увидеть изменения

## Проблема
Вы видите старую версию сайта из-за кэша браузера.

## Решение

### Вариант 1: Очистить кэш (Рекомендуется)
1. Нажмите `Ctrl + Shift + Delete`
2. Выберите "Кэшированные изображения и файлы"
3. Нажмите "Удалить данные"
4. Обновите страницу (`F5`)

### Вариант 2: Hard Refresh
1. Нажмите `Ctrl + F5` (или `Ctrl + Shift + R`)
2. Это принудительно загрузит новую версию

### Вариант 3: Режим инкогнито
1. Нажмите `Ctrl + Shift + N` (Chrome) или `Ctrl + Shift + P` (Firefox)
2. Откройте сайт в новом окне

### Вариант 4: Проверить деплой на Render
1. Откройте https://dashboard.render.com
2. Найдите сервис `mc-monitor-web`
3. Проверьте, что последний деплой завершился успешно
4. Посмотрите на время последнего деплоя

## Что было исправлено (в коде):

### 1. Аватар в сайдбаре
**Файл**: `web/src/App.jsx`
- Добавлена обработка ошибок загрузки
- Фоллбэк на иконку 👤

### 2. 3D скины для пиратских аккаунтов
**Файл**: `web/src/components/PlayerModal.jsx`
- 5 источников: Ely.by → Minotar → Crafatar → MC-Heads → Steve
- Логирование в консоль (F12)

### 3. Клик на аватар в чате
**Файл**: `web/src/components/PlayerFace.jsx`
- Добавлен параметр `onClick`
- Курсор меняется на pointer

### 4. Uptime из БД
**Файлы**: `server/src/index.js`, `web/src/hooks/useServerMonitor.js`
- Удалено использование localStorage
- Все данные из БД

## Проверка изменений

### В консоли браузера (F12):
Откройте консоль и кликните на ник в чате. Вы должны увидеть:
```
[PlayerModal] Trying to load skin from Ely.by: https://...
[PlayerModal] Failed to load from Ely.by: ...
[PlayerModal] Trying to load skin from Minotar: https://...
[PlayerModal] Successfully loaded skin from Minotar
```

### Проверка версии:
1. Откройте DevTools (F12)
2. Вкладка Network
3. Обновите страницу (F5)
4. Найдите файл `index-*.js`
5. Проверьте размер: должен быть ~1022 KB

## Если изменения всё ещё не видны:

### Проверьте Render:
```bash
# Последний коммит на GitHub
git log -1 --oneline
# Должно быть: c992cfb fix: improve 3D skin loading...
```

### Дождитесь деплоя:
Render может деплоить 2-5 минут после push. Проверьте статус деплоя в Dashboard.

## ВАЖНО: База данных!

Даже после деплоя нужно исправить БД:
```bash
# Render Dashboard → PostgreSQL → Shell
psql $DATABASE_URL

# Выполнить SQL из server/sql/000_reset.sql
```

Без исправления БД будут ошибки CORS 502 и uptime не будет работать.
