#!/usr/bin/env node
import { pool, hasDb } from './db.js'

async function reset() {
  if (!hasDb || !pool) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  console.log('⚠️  WARNING: This will DELETE ALL DATA from the database!')
  console.log('Starting database reset in 3 seconds...')

  await new Promise(resolve => setTimeout(resolve, 3000))

  try {
    const sql = `
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
`

    await pool.query(sql)
    console.log('✅ Database reset complete!')
    console.log('✅ All tables and indexes created successfully')

  } catch (err) {
    console.error('❌ Reset failed:', err.message)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

reset()
