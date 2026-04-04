-- Index for fast uptime streak calculation (walk backwards from latest online samples)
CREATE INDEX IF NOT EXISTS idx_server_samples_server_ts_online
  ON server_samples(server_id, ts DESC, online);

-- Index for player sessions lookup by nick
CREATE INDEX IF NOT EXISTS idx_player_sessions_nick
  ON player_sessions(server_id, nick, started_at DESC);

-- Index for ended_at = NULL (open sessions)
CREATE INDEX IF NOT EXISTS idx_player_sessions_open
  ON player_sessions(server_id, ended_at)
  WHERE ended_at IS NULL;
