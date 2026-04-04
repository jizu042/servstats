# Minecraft Server Monitor

Monorepo:
- web: React + Vite SPA
- server: Node.js API proxy + chat + stats API
- worker: background collector (writes snapshots to PostgreSQL)

Data layer:
- PostgreSQL: `servers`, `server_samples`, `chat_messages`, `player_sessions`, `app_settings`
- Redis (optional): pub/sub + cache

Implemented APIs:
- `GET /api/status`
- `GET /api/stats/history?host=&port=&hours=24|168`
- `GET /api/chat/messages`
- `POST /api/chat/messages`
- `GET /api/chat/stream` (SSE realtime)
- `GET /api/auth/ely/status`
- `GET /api/auth/ely/start`
- `GET /api/auth/ely/callback` (scaffold)
- `GET /api/me`
- `POST /api/logout`

## Quick start
1. `npm install`
2. Copy env files from examples:
	- `web/.env.example` -> `web/.env`
	- `server/.env.example` -> `server/.env`
	- `worker/.env.example` -> `worker/.env`
3. Run DB migration:
	- `npm --workspace server run migrate`
4. Start web + api:
	- `npm run dev`
5. Start collector (separate terminal):
	- `npm run start:worker`

Frontend runs on `5173`, backend on `8787`.

## Render
- Use [render.yaml](render.yaml) blueprint.
- Services: `mc-monitor-web` (static), `mc-monitor-api` (web), `mc-monitor-collector` (worker), `mc-monitor-postgres` (database), `mc-monitor-redis` (redis).
- Set `ISMCSERVER_TOKEN` manually in Render for API/worker if you want priority source.
- Set `SESSION_SECRET` manually in Render.
- Worker retention is controlled by `STATS_RAW_RETENTION_DAYS`.

### Pre-deploy checklist
- `CORS_ORIGIN=https://<your-web-domain>` on API service.
- `APP_BASE_URL=https://<your-web-domain>` on API service.
- `VITE_API_BASE_URL=https://<your-api-domain>` on web service.
- `SESSION_SECRET` set to a long random value.
- (Optional) Ely OAuth vars set: `ELY_OAUTH_CLIENT_ID`, `ELY_OAUTH_CLIENT_SECRET`, `ELY_OAUTH_REDIRECT_URI`.
- `MONITOR_SERVERS` set on worker (comma-separated `host:port`).
- Run migration once (`npm run migrate` in API service start command is already configured).
