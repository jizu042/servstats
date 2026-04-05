# Инструкция по исправлению базы данных

## Проблема
База данных в несогласованном состоянии - таблицы существуют, но с неправильной структурой колонок.

## Решение

### Вариант 1: Через Render Dashboard (Рекомендуется)

1. Зайдите в Render Dashboard: https://dashboard.render.com
2. Найдите ваш PostgreSQL сервис `mc-monitor-postgres`
3. Перейдите в раздел "Shell"
4. Выполните команду для подключения к БД:
   ```bash
   psql $DATABASE_URL
   ```

5. Скопируйте и выполните этот SQL скрипт:

```sql
-- Drop all tables
DROP TABLE IF EXISTS player_sessions CASCADE;
DROP TABLE IF EXISTS server_samples CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS servers CASCADE;

-- Create servers table
CREATE TABLE servers (
  id SERIAL PRIMARY KEY,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 25565,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(host, port)
);

-- Create server_samples table
CREATE TABLE server_samples (
  id BIGSERIAL PRIMARY KEY,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  online BOOLEAN NOT NULL,
  players_online INTEGER NOT NULL DEFAULT 0,
  players_max INTEGER NOT NULL DEFAULT 0,
  ping_ms INTEGER,
  source TEXT NOT NULL DEFAULT 'unknown'
);

-- Create chat_messages table
CREATE TABLE chat_messages (
  id BIGSERIAL PRIMARY KEY,
  nick TEXT NOT NULL,
  text TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT FALSE
);

-- Create player_sessions table
CREATE TABLE player_sessions (
  id BIGSERIAL PRIMARY KEY,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  nick TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create app_settings table
CREATE TABLE app_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_server_samples_server_ts ON server_samples(server_id, ts DESC);
CREATE INDEX idx_server_samples_server_ts_online ON server_samples(server_id, ts DESC, online);
CREATE INDEX idx_chat_messages_ts ON chat_messages(ts DESC);
CREATE INDEX idx_player_sessions_server_nick ON player_sessions(server_id, nick, started_at DESC);
CREATE INDEX idx_player_sessions_nick ON player_sessions(server_id, nick, started_at DESC);
CREATE INDEX idx_player_sessions_open ON player_sessions(server_id, ended_at) WHERE ended_at IS NULL;
```

6. Выйдите из psql: `\q`

7. Перезапустите API сервис в Render Dashboard

### Вариант 2: Через API Shell в Render

1. Зайдите в Render Dashboard
2. Найдите ваш API сервис `mc-monitor-api`
3. Перейдите в раздел "Shell"
4. Выполните команду:
   ```bash
   npm run reset-db
   ```

5. Подождите 3 секунды (скрипт автоматически выполнится)

6. Перезапустите сервис

### Вариант 3: Локально (если есть доступ к DATABASE_URL)

```bash
# В корне проекта
npm --workspace server run reset-db
```

## После сброса БД

1. Перезапустите все сервисы:
   - API (mc-monitor-api)
   - Worker (mc-monitor-collector)

2. Проверьте логи API сервиса - должно быть:
   ```
   mc-monitor-api listening on 10000
   ```

3. Откройте сайт и проверьте, что:
   - Нет ошибок CORS
   - Чат загружается
   - Статистика отображается
   - Вкладка "Подробности" работает

## Важно!

⚠️ **Этот процесс удалит ВСЕ данные из базы:**
- Историю сообщений чата
- Историю игроков
- Статистику сервера

После сброса данные начнут собираться заново.

## Если проблема остаётся

Проверьте переменные окружения в Render:
- `DATABASE_URL` должен быть установлен
- `MONITOR_SERVERS` должен содержать адрес вашего сервера (например: `play.hypixel.net:25565`)

## Альтернатива: Пересоздать БД

Если ничего не помогает:

1. В Render Dashboard удалите PostgreSQL сервис
2. Создайте новый PostgreSQL сервис
3. Обновите `DATABASE_URL` во всех сервисах (API, Worker)
4. Перезапустите сервисы
