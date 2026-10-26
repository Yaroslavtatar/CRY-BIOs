/**
 * Прямой Discord OAuth2 (без Cloudflare Worker cbios-edge).
 *
 * Включается, когда заданы DISCORD_CLIENT_ID и DISCORD_CLIENT_SECRET.
 * Если не заданы — модуль передаёт управление старым роутам (Worker-схема продолжает работать).
 *
 * ENV:
 *   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET
 *   DISCORD_REDIRECT_URI  по умолчанию APP_URL + /api/discord/oauth/callback
 *   DISCORD_API_BASE      по умолчанию https://discord.com/api/v10 (можно указать прокси, если Discord недоступен с сервера)
 */
import crypto from 'crypto';

type Req = {
  query: Record<string, unknown>;
  headers: Record<string, unknown>;
};
type Res = {
  status(code: number): Res;
  json(body: unknown): unknown;
  redirect(url: string): unknown;
};
type Next = () => void;
type App = {
  get(path: string, handler: (req: any, res: any, next: Next) => unknown): unknown;
};

export interface DiscordDirectDeps {
  /** Возвращает username по Bearer-токену сессии или null */
  getUsernameFromRequest: (req: any) => string | null;
  getBio: (username: string) => any;
  saveBio: (username: string, bio: any) => void;
}

const STATE_TTL_MS = 10 * 60 * 1000;
const MAX_STATES = 5000;
const REQUEST_TIMEOUT_MS = 10_000;
const states = new Map<string, { username: string; exp: number }>();

function readConfig() {
  const clientId = (process.env.DISCORD_CLIENT_ID || '').trim();
  const clientSecret = (process.env.DISCORD_CLIENT_SECRET || '').trim();
  const appUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  const redirectUri =
    (process.env.DISCORD_REDIRECT_URI || '').trim() ||
    (appUrl ? `${appUrl}/api/discord/oauth/callback` : '');
  const apiBase = (process.env.DISCORD_API_BASE || 'https://discord.com/api/v10').trim().replace(/\/+$/, '');
  return {
    clientId,
    clientSecret,
    appUrl,
    redirectUri,
    apiBase,
    configured: Boolean(clientId && clientSecret && redirectUri),
  };
}

function purgeStates() {
  const now = Date.now();
  for (const [k, v] of states) {
    if (v.exp <= now) states.delete(k);
  }
  while (states.size > MAX_STATES) {
    const first = states.keys().next().value;
    if (first === undefined) break;
    states.delete(first);
  }
}

function createState(username: string): string {
  purgeStates();
  const state = crypto.randomBytes(32).toString('hex');
  states.set(state, { username, exp: Date.now() + STATE_TTL_MS });
  return state;
}

function consumeState(state: string): string | null {
  const entry = states.get(state);
  states.delete(state); // одноразовый
  if (!entry || entry.exp <= Date.now()) return null;
  return entry.username;
}

async function discordFetch(url: string, init: RequestInit): Promise<any> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const text = await r.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* не JSON */
  }
  if (!r.ok) {
    const msg = data?.error_description || data?.message || data?.error || `HTTP ${r.status}`;
    throw new Error(`Discord API: ${msg}`);
  }
  return data;
}

export function registerDiscordDirectOAuth(app: App, deps: DiscordDirectDeps): void {
  const initial = readConfig();
  if (initial.configured) {
    console.log('[discord] прямой OAuth включён, redirect_uri =', initial.redirectUri);
  } else {
    console.log('[discord] DISCORD_CLIENT_ID/SECRET не заданы — используется схема с Worker (CBIOS_EDGE_URL)');
  }

  // 1) Клиент (с Bearer-токеном) получает ссылку и сам делает window.location = url
  app.get('/api/discord/oauth/start', (req: any, res: any, next: Next) => {
    const cfg = readConfig();
    if (!cfg.configured) return next();

    const username = deps.getUsernameFromRequest(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized Session' });

    const state = createState(username);
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      response_type: 'code',
      redirect_uri: cfg.redirectUri,
      scope: 'identify',
      state,
      prompt: 'consent',
    });
    const url = `https://discord.com/oauth2/authorize?${params.toString()}`;

    if (req.query.redirect === '1') return res.redirect(url);
    return res.json({ url, authUrl: url });
  });

  // 2) Discord возвращает пользователя сюда (браузерный редирект, без Bearer — доверяем state)
  app.get('/api/discord/oauth/callback', async (req: any, res: any, next: Next) => {
    const cfg = readConfig();
    if (!cfg.configured) return next();

    const back = (status: string) => res.redirect(`${cfg.appUrl || ''}/dashboard?discord=${status}`);

    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const username = state ? consumeState(state) : null;

    if (!username) return back('invalid_state');
    if (req.query.error || !code) return back('denied');

    try {
      const token = await discordFetch(`${cfg.apiBase}/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          grant_type: 'authorization_code',
          code,
          redirect_uri: cfg.redirectUri,
        }),
      });
      if (!token?.access_token) throw new Error('Discord не вернул access_token');

      const user = await discordFetch(`${cfg.apiBase}/users/@me`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!user?.id) throw new Error('Discord не вернул профиль');

      const bio = deps.getBio(username);
      if (!bio) return back('no_profile');

      bio.discordConnected = true;
      bio.discordId = String(user.id);
      bio.discordUsername = String(user.username || '');
      bio.discordDisplayName = String(user.global_name || user.username || '');
      bio.discordAvatarHash = user.avatar ?? null;
      bio.discordPremiumType = Number(user.premium_type || 0);
      bio.discordPublicFlags = Number(user.public_flags || 0);
      bio.discordLinkedAt = new Date().toISOString();
      deps.saveBio(username, bio);

      // токен намеренно не сохраняем: нужен только профиль (scope identify)
      return back('linked');
    } catch (err: any) {
      console.error('[discord] callback error:', err?.message || err);
      return back('error');
    }
  });
}
