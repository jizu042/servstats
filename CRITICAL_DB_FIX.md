# 🚨 КРИТИЧНО: БАЗА ДАННЫХ ИМЕЕТ НЕПРАВИЛЬНУЮ СХЕМУ!

## Проблема

Ваша база данных содержит **СТАРУЮ СХЕМУ** от другого проекта:
- Таблица `chat_messages` имеет колонки `user_id`, `username`, `message`
- Таблица `player_sessions` имеет колонку `server_address`

**НО** код ожидает:
- `chat_messages`: колонки `nick`, `text`, `ts`, `is_verified`
- `player_sessions`: колонки `server_id`, `nick`, `started_at`, `ended_at`

## Ошибки в логах:

```
ERROR: column "user_id" does not exist
ERROR: column "server_address" does not exist
```

## РЕШЕНИЕ (ОБЯЗАТЕЛЬНО ВЫПОЛНИТЬ):

### Шаг 1: Откройте Render Dashboard
https://dashboard.render.com

### Шаг 2: Найдите PostgreSQL сервис
`mc-monitor-postgres` (или как называется ваш PostgreSQL)

### Шаг 3: Откройте Shell
Нажмите кнопку "Shell" в правом верхнем углу

### Шаг 4: Подключитесь к БД
```bash
psql $DATABASE_URL
```

### Шаг 5: Скопируйте и выполните SQL

Откройте файл `RESET_DB_NOW.sql` в репозитории и скопируйте **ВЕСЬ** SQL код.

Или скопируйте отсюда:

```sql
-- ПОЛНЫЙ СБРОС
DROP TABLE IF EXISTS player_sessions CASCADE;
DROP TABLE IF EXISTS server_samples CASCADE;
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS servers CASCADE;

-- Создать правильную схему
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

CREATE TABLE chat_messages (
  id BIGSERIAL PRIMARY KEY,
  nick TEXT NOT NULL,
  text TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT FALSE
);

CREATE TABLE player_sessions (
  id BIGSERIAL PRIMARY KEY,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  nick TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX idx_server_samples_server_ts ON server_samples(server_id, ts DESC);
CREATE INDEX idx_server_samples_server_ts_online ON server_samples(server_id, ts DESC, online);
CREATE INDEX idx_chat_messages_ts ON chat_messages(ts DESC);
CREATE INDEX idx_player_sessions_server_nick ON player_sessions(server_id, nick, started_at DESC);
CREATE INDEX idx_player_sessions_nick ON player_sessions(server_id, nick, started_at DESC);
CREATE INDEX idx_player_sessions_open ON player_sessions(server_id, ended_at) WHERE ended_at IS NULL;
```

### Шаг 6: Выйдите из psql
```
\q
```

### Шаг 7: Перезапустите сервисы
В Render Dashboard:
1. Найдите `mc-monitor-api` → Manual Deploy → Deploy latest commit
2. Найдите `mc-monitor-collector` (worker) → Manual Deploy → Deploy latest commit

### Шаг 8: Подождите 5 минут
Worker начнёт собирать данные каждые 5 минут.

## После этого ВСЁ ЗАРАБОТАЕТ!

- ✅ Чат будет работать
- ✅ Uptime будет отображаться
- ✅ Статистика будет собираться
- ✅ История игроков будет заполняться
- ✅ Скины будут показываться

## Почему это произошло?

Вы использовали БД от другого проекта или старую схему. Код ожидает определённые колонки, которых нет в текущей БД.

## ⚠️ ВАЖНО

Это удалит все данные, но **БЕЗ ЭТОГО НИЧЕГО НЕ БУДЕТ РАБОТАТЬ**.

После сброса данные начнут собираться заново.
