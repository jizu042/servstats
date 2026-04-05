-- Fix schema inconsistencies
-- This migration ensures all tables and columns exist properly

-- Ensure servers table exists with all columns
CREATE TABLE IF NOT EXISTS servers (
  id SERIAL PRIMARY KEY,
  host TEXT NOT NULL,
  port INTEGER NOT NULL DEFAULT 25565,
  label TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(host, port)
);

-- Ensure server_samples table exists with all columns
CREATE TABLE IF NOT EXISTS server_samples (
  id BIGSERIAL PRIMARY KEY,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  online BOOLEAN NOT NULL,
  players_online INTEGER NOT NULL DEFAULT 0,
  players_max INTEGER NOT NULL DEFAULT 0,
  ping_ms INTEGER,
  source TEXT NOT NULL DEFAULT 'unknown'
);

-- Ensure chat_messages table exists with all columns
CREATE TABLE IF NOT EXISTS chat_messages (
  id BIGSERIAL PRIMARY KEY,
  nick TEXT NOT NULL,
  text TEXT NOT NULL,
  ts TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_verified BOOLEAN DEFAULT FALSE
);

-- Ensure player_sessions table exists with all columns
CREATE TABLE IF NOT EXISTS player_sessions (
  id BIGSERIAL PRIMARY KEY,
  server_id INTEGER NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  nick TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure app_settings table exists
CREATE TABLE IF NOT EXISTS app_settings (
  id SERIAL PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_server_samples_server_ts ON server_samples(server_id, ts DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_ts ON chat_messages(ts DESC);
CREATE INDEX IF NOT EXISTS idx_player_sessions_server_nick ON player_sessions(server_id, nick, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_server_samples_server_ts_online ON server_samples(server_id, ts DESC, online);
CREATE INDEX IF NOT EXISTS idx_player_sessions_nick ON player_sessions(server_id, nick, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_player_sessions_open ON player_sessions(server_id, ended_at) WHERE ended_at IS NULL;
