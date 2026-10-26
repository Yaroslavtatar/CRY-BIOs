/**
 * Discord-интеграция CRY BIOs в одном месте:
 *   GET  /api/discord/oauth/start     — ссылка на авторизацию (нужен Bearer-токен сессии)
 *   GET  /api/discord/oauth/callback  — возврат из Discord, привязка профиля к био
 *   POST /api/discord/disconnect      — отвязка
 *   GET  /api/discord/:userId         — presence (Lanyard) + бейджи; только для привязанных аккаунтов
 *
 * ENV:
 *   DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET   — обязательны для OAuth
 *   DISCORD_REDIRECT_URI                       — по умолчанию APP_URL + /api/discord/oauth/callback
 *   DISCORD_API_BASE                           — по умолчанию https://discord.com/api/v10 (прокси, если Discord недоступен с сервера)
 *   LANYARD_API_BASE                           — по умолчанию https://api.lanyard.rest/v1
 *
 * OAuth state хранится в БД (переживает рестарт, одноразовый, TTL 10 мин). Токены Discord не сохраняются.
 */
import {
  decodeDiscordBadges,
  mergeBadgesIntoLanyardUser,
  staticDiscordPresenceFromBio,
} from './discordBadges';

export interface DiscordDeps {
  getUsernameFromRequest: (req: any) => string | null;
  getBio: (username: string) => any;
  saveBio: (username: string, bio: any) => void;
  getAllBios: () => any[];
  createOAuthState: (username: string) => string;
  consumeOAuthState: (state: string) => string | null;
}

type Next = () => void;
type App = {
  get(path: string, ...handlers: Array<(req: any, res: any, next: Next) => unknown>): unknown;
  post(path: string, ...handlers: Array<(req: any, res: any, next: Next) => unknown>): unknown;
};

const REQUEST_TIMEOUT_MS = 8_000;
const PRESENCE_TTL_MS = 15_000;
const PRESENCE_CACHE_MAX = 500;
const SNOWFLAKE_RE = /^\d{17,20}$/;

function config() {
  const clientId = (process.env.DISCORD_CLIENT_ID || '').trim();
  const clientSecret = (process.env.DISCORD_CLIENT_SECRET || '').trim();
  const appUrl = (process.env.APP_URL || '').trim().replace(/\/+$/, '');
  const redirectUri =
    (process.env.DISCORD_REDIRECT_URI || '').trim() ||
    (appUrl ? `${appUrl}/api/discord/oauth/callback` : '');
  const apiBase = (process.env.DISCORD_API_BASE || 'https://discord.com/api/v10').trim().replace(/\/+$/, '');
  const lanyardBase = (process.env.LANYARD_API_BASE || 'https://api.lanyard.rest/v1').trim().replace(/\/+$/, '');
  return {
    clientId,
    clientSecret,
    appUrl,
    redirectUri,
    apiBase,
    lanyardBase,
    configured: Boolean(clientId && clientSecret && redirectUri),
  };
}

async function fetchJson(url: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; data: any }> {
  const r = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  const text = await r.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* не JSON */
  }
  return { ok: r.ok, status: r.status, data };
}

async function discordRequest(url: string, init: RequestInit): Promise<any> {
  const { ok, status, data } = await fetchJson(url, init);
  if (!ok) {
    const msg = data?.error_description || data?.message || data?.error || `HTTP ${status}`;
    throw new Error(`Discord API: ${msg}`);
  }
  return data;
}

const presenceCache = new Map<string, { exp: number; body: unknown }>();

function cachePresence(id: string, body: unknown) {
  if (presenceCache.size >= PRESENCE_CACHE_MAX) {
    const first = presenceCache.keys().next().value;
    if (first !== undefined) presenceCache.delete(first);
  }
  presenceCache.set(id, { exp: Date.now() + PRESENCE_TTL_MS, body });
}

const DISCORD_FIELDS = [
  'discordConnected',
  'discordId',
  'discordUsername',
  'discordDisplayName',
  'discordAvatarHash',
  'discordPremiumType',
  'discordPublicFlags',
  'discordLinkedAt',
] as const;

export function registerDiscord(app: App, deps: DiscordDeps): void {
  const initial = config();
  console.log(
    initial.configured
      ? `[discord] OAuth включён, redirect_uri = ${initial.redirectUri}`
      : '[discord] OAuth выключен: задайте DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET и APP_URL (или DISCORD_REDIRECT_URI)',
  );

  app.get('/api/discord/oauth/start', (req, res) => {
    const cfg = config();
    if (!cfg.configured) {
      return res.status(503).json({ error: 'Discord OAuth не настроен на сервере' });
    }
    const username = deps.getUsernameFromRequest(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized Session' });

    const state = deps.createOAuthState(username);
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
    return res.json({ url });
  });

  // Браузерный редирект из Discord: Bearer нет, доверяем одноразовому state.
  app.get('/api/discord/oauth/callback', async (req, res) => {
    const cfg = config();
    const back = (status: string) => res.redirect(`${cfg.appUrl}/dashboard?discord=${status}`);
    if (!cfg.configured) return back('error');

    const state = typeof req.query.state === 'string' ? req.query.state : '';
    const code = typeof req.query.code === 'string' ? req.query.code : '';
    const username = state ? deps.consumeOAuthState(state) : null;

    if (!username) return back('invalid_state');
    if (req.query.error || !code) return back('denied');

    try {
      const token = await discordRequest(`${cfg.apiBase}/oauth2/token`, {
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

      const user = await discordRequest(`${cfg.apiBase}/users/@me`, {
        headers: { Authorization: `Bearer ${token.access_token}` },
      });
      if (!user?.id) throw new Error('Discord не вернул профиль');
      const discordId = String(user.id);

      // Один Discord-аккаунт — одно био (иначе можно выдать себя за чужой профиль)
      const taken = deps.getAllBios().find((b) => b.discordId === discordId && b.username !== username);
      if (taken) return back('already_linked');

      const bio = deps.getBio(username);
      if (!bio) return back('no_profile');

      bio.discordConnected = true;
      bio.discordId = discordId;
      bio.discordUsername = String(user.username || '');
      bio.discordDisplayName = String(user.global_name || user.username || '');
      bio.discordAvatarHash = user.avatar ?? null;
      bio.discordPremiumType = Number(user.premium_type || 0);
      bio.discordPublicFlags = Number(user.public_flags || 0);
      bio.discordLinkedAt = new Date().toISOString();
      deps.saveBio(username, bio);
      presenceCache.delete(discordId);

      return back('linked');
    } catch (err: any) {
      console.error('[discord] callback error:', err?.message || err);
      return back('error');
    }
  });

  app.post('/api/discord/disconnect', (req, res) => {
    const username = deps.getUsernameFromRequest(req);
    if (!username) return res.status(401).json({ error: 'Unauthorized Session' });

    const bio = deps.getBio(username);
    if (!bio) return res.status(404).json({ error: 'Bio not found' });

    if (bio.discordId) presenceCache.delete(bio.discordId);
    for (const f of DISCORD_FIELDS) bio[f] = undefined;
    bio.discordConnected = false;
    deps.saveBio(username, bio);
    return res.json({ success: true });
  });

  // Presence отдаём только для привязанных аккаунтов — сервер не должен быть открытым прокси к Lanyard.
  app.get('/api/discord/:userId', async (req, res) => {
    const { userId } = req.params;
    if (!SNOWFLAKE_RE.test(userId)) return res.status(400).json({ error: 'Invalid Discord user ID' });

    const cached = presenceCache.get(userId);
    if (cached && cached.exp > Date.now()) return res.json(cached.body);

    const bio = deps.getAllBios().find((b) => b.discordId === userId && b.discordConnected);
    if (!bio) return res.status(404).json({ success: false, error: 'Discord presence unavailable' });

    const cfg = config();
    try {
      const r = await fetchJson(`${cfg.lanyardBase}/users/${userId}`);
      if (r.ok && r.data?.data?.discord_user) {
        const body = {
          ...r.data,
          data: mergeBadgesIntoLanyardUser(r.data.data, bio.discordPublicFlags, bio.discordPremiumType),
        };
        cachePresence(userId, body);
        return res.json(body);
      }
    } catch (err: any) {
      console.warn('[discord] lanyard недоступен:', err?.message || err);
    }

    // Пользователь не в Lanyard-сервере или Lanyard лежит — отдаём то, что знаем из OAuth
    const fallback = staticDiscordPresenceFromBio(bio);
    if (!fallback) return res.status(404).json({ success: false, error: 'Discord presence unavailable' });
    cachePresence(userId, fallback);
    return res.json(fallback);
  });
}

export { decodeDiscordBadges };
