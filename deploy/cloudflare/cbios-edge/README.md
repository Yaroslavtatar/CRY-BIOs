# cbios-edge — Cloudflare Worker

Edge proxy for CRY BIOS: Discord OAuth, Lanyard presence, guns.lol HTML fetch.

## Setup

### 1. Discord Developer Portal

1. Create application at https://discord.com/developers/applications
2. OAuth2 → Redirects: `https://<your-worker>.workers.dev/oauth/callback`
3. Copy **Client ID** and **Client Secret**

### 2. Deploy Worker

```bash
cd deploy/cloudflare/cbios-edge
npm install
wrangler login
wrangler secret put DISCORD_CLIENT_ID
wrangler secret put DISCORD_CLIENT_SECRET
wrangler secret put DISCORD_REDIRECT_URI    # https://xxx.workers.dev/oauth/callback
wrangler secret put CBIOS_WEBHOOK_SECRET   # same as Node CBIOS_EDGE_SECRET
wrangler secret put CBIOS_APP_URL           # https://cbios.ru
wrangler secret put CBIOS_NODE_WEBHOOK_URL  # https://cbios.ru/api/discord/oauth/webhook
npm run deploy
```

### 3. Node env (Coolify)

```env
CBIOS_EDGE_URL=https://your-worker.workers.dev
CBIOS_EDGE_SECRET=<same as CBIOS_WEBHOOK_SECRET>
DISCORD_CLIENT_ID=<discord app id>
```

## Routes

| Route | Description |
|-------|-------------|
| `GET /health` | Healthcheck |
| `GET /oauth/start?state=...` | Redirect to Discord OAuth |
| `GET /oauth/callback` | OAuth callback → Node webhook |
| `GET /lanyard/:userId` | Lanyard API proxy (60s cache) |
| `GET /guns/fetch/:username` | Fetch guns.lol HTML from edge |
