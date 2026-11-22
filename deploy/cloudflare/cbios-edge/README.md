# cbios-edge — Cloudflare Worker

Edge proxy для CRY BIOS: получение HTML со страниц guns.lol (импорт профилей, `src/importHub.ts`).
Discord OAuth и Lanyard-прокси удалены: Node-сервер их больше не использует.

## Развёртывание

**Cloudflare Workers (Git):** корень `deploy/cloudflare/cbios-edge`, build command пустая, deploy command `npx wrangler deploy`. Имя проекта должно совпадать с `wrangler.toml` (`cry-bios`).

**Локально:**

```bash
cd deploy/cloudflare/cbios-edge
npm install
wrangler login
wrangler secret put CBIOS_EDGE_SECRET   # такой же, как на Node
npm run deploy
```

### Переменные Node (Coolify)

```env
CBIOS_EDGE_URL=https://your-worker.workers.dev
CBIOS_EDGE_SECRET=<тот же секрет, что в воркере>
```

Если `CBIOS_EDGE_SECRET` в воркере не задан, `/guns/fetch/*` открыт всем. Задайте секрет, иначе любой желающий сможет гонять запросы через ваш воркер.

## Маршруты

| Route | Description |
|-------|-------------|
| `GET /health` | Healthcheck |
| `GET /guns/fetch/:username` | HTML guns.lol (нужен заголовок `x-cbios-edge-secret`, если секрет задан) |
