import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerDiscord, type DiscordDeps } from '../src/discord';

type Handler = (req: any, res: any, next: () => void) => unknown;

function makeApp() {
  const routes = new Map<string, Handler>();
  return {
    routes,
    get: (p: string, h: Handler) => void routes.set(`GET ${p}`, h),
    post: (p: string, h: Handler) => void routes.set(`POST ${p}`, h),
  };
}

function makeRes() {
  const res: any = { statusCode: 200, body: undefined, redirectedTo: undefined };
  res.status = (c: number) => ((res.statusCode = c), res);
  res.json = (b: unknown) => ((res.body = b), res);
  res.redirect = (u: string) => ((res.redirectedTo = u), res);
  return res;
}

const ID = '123456789012345678';

function setup(overrides: Partial<DiscordDeps> = {}) {
  const bios: Record<string, any> = { alice: { username: 'alice' }, bob: { username: 'bob' } };
  const states = new Map<string, string>();
  const deps: DiscordDeps = {
    getUsernameFromRequest: (req) => req.user ?? null,
    getBio: (u) => bios[u] ?? null,
    saveBio: (u, b) => void (bios[u] = b),
    getAllBios: () => Object.values(bios),
    createOAuthState: (u) => {
      const s = `state-${states.size + 1}`;
      states.set(s, u);
      return s;
    },
    consumeOAuthState: (s) => {
      const u = states.get(s) ?? null;
      states.delete(s);
      return u;
    },
    ...overrides,
  };
  const app = makeApp();
  registerDiscord(app, deps);
  return { app, bios, states };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const ENV_KEYS = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'APP_URL', 'DISCORD_REDIRECT_URI', 'LANYARD_API_BASE'];

describe('Discord integration', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) saved[k] = process.env[k];
    process.env.DISCORD_CLIENT_ID = 'cid';
    process.env.DISCORD_CLIENT_SECRET = 'secret';
    process.env.APP_URL = 'https://cbios.test';
    delete process.env.DISCORD_REDIRECT_URI;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  describe('oauth/start', () => {
    it('503, если OAuth не настроен', () => {
      delete process.env.DISCORD_CLIENT_SECRET;
      const { app } = setup();
      const res = makeRes();
      app.routes.get('GET /api/discord/oauth/start')!({ query: {}, user: 'alice' }, res, () => {});
      expect(res.statusCode).toBe(503);
    });

    it('401 без сессии', () => {
      const { app } = setup();
      const res = makeRes();
      app.routes.get('GET /api/discord/oauth/start')!({ query: {} }, res, () => {});
      expect(res.statusCode).toBe(401);
    });

    it('отдаёт ссылку с client_id, redirect_uri и state', () => {
      const { app, states } = setup();
      const res = makeRes();
      app.routes.get('GET /api/discord/oauth/start')!({ query: {}, user: 'alice' }, res, () => {});
      const url = new URL(res.body.url);
      expect(url.origin + url.pathname).toBe('https://discord.com/oauth2/authorize');
      expect(url.searchParams.get('client_id')).toBe('cid');
      expect(url.searchParams.get('redirect_uri')).toBe('https://cbios.test/api/discord/oauth/callback');
      expect(url.searchParams.get('scope')).toBe('identify');
      expect(states.get(url.searchParams.get('state')!)).toBe('alice');
    });
  });

  describe('oauth/callback', () => {
    const call = (app: ReturnType<typeof makeApp>, query: Record<string, string>) => {
      const res = makeRes();
      return Promise.resolve(app.routes.get('GET /api/discord/oauth/callback')!({ query }, res, () => {})).then(() => res);
    };

    it('invalid_state при неизвестном state', async () => {
      const { app } = setup();
      const res = await call(app, { state: 'nope', code: 'c' });
      expect(res.redirectedTo).toBe('https://cbios.test/dashboard?discord=invalid_state');
    });

    it('state одноразовый', async () => {
      const { app, states } = setup();
      states.set('s1', 'alice');
      await call(app, { state: 's1', error: 'access_denied' });
      const res = await call(app, { state: 's1', code: 'c' });
      expect(res.redirectedTo).toMatch(/invalid_state$/);
    });

    it('denied, если пользователь отказал', async () => {
      const { app, states } = setup();
      states.set('s1', 'alice');
      const res = await call(app, { state: 's1', error: 'access_denied' });
      expect(res.redirectedTo).toMatch(/denied$/);
    });

    it('привязывает профиль и не сохраняет токен', async () => {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(
          jsonResponse({ id: ID, username: 'ali', global_name: 'Alice', avatar: 'hash', premium_type: 2, public_flags: 64 }),
        );
      const { app, bios, states } = setup();
      states.set('s1', 'alice');

      const res = await call(app, { state: 's1', code: 'abc' });

      expect(res.redirectedTo).toBe('https://cbios.test/dashboard?discord=linked');
      expect(bios.alice).toMatchObject({
        discordConnected: true,
        discordId: ID,
        discordUsername: 'ali',
        discordDisplayName: 'Alice',
        discordAvatarHash: 'hash',
        discordPremiumType: 2,
        discordPublicFlags: 64,
      });
      expect(JSON.stringify(bios.alice)).not.toContain('tok');
      expect(fetchMock).toHaveBeenCalledTimes(2);
      const tokenBody = (fetchMock.mock.calls[0][1] as RequestInit).body as URLSearchParams;
      expect(tokenBody.get('grant_type')).toBe('authorization_code');
      expect(tokenBody.get('code')).toBe('abc');
    });

    it('already_linked, если Discord уже привязан к другому био', async () => {
      vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(jsonResponse({ access_token: 'tok' }))
        .mockResolvedValueOnce(jsonResponse({ id: ID, username: 'x' }));
      const { app, bios, states } = setup();
      bios.bob.discordId = ID;
      states.set('s1', 'alice');

      const res = await call(app, { state: 's1', code: 'abc' });

      expect(res.redirectedTo).toMatch(/already_linked$/);
      expect(bios.alice.discordId).toBeUndefined();
    });

    it('error, если Discord вернул ошибку', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(jsonResponse({ error_description: 'bad code' }, 400));
      const { app, states } = setup();
      states.set('s1', 'alice');
      const res = await call(app, { state: 's1', code: 'abc' });
      expect(res.redirectedTo).toMatch(/error$/);
    });
  });

  describe('disconnect', () => {
    it('401 без сессии', () => {
      const { app } = setup();
      const res = makeRes();
      app.routes.get('POST /api/discord/disconnect')!({}, res, () => {});
      expect(res.statusCode).toBe(401);
    });

    it('очищает все discord-поля', () => {
      const { app, bios } = setup();
      Object.assign(bios.alice, { discordConnected: true, discordId: ID, discordUsername: 'ali' });
      const res = makeRes();
      app.routes.get('POST /api/discord/disconnect')!({ user: 'alice' }, res, () => {});
      expect(res.body).toEqual({ success: true });
      expect(bios.alice.discordConnected).toBe(false);
      expect(bios.alice.discordId).toBeUndefined();
      expect(bios.alice.discordUsername).toBeUndefined();
    });
  });

  describe('presence', () => {
    const get = (app: ReturnType<typeof makeApp>, userId: string) => {
      const res = makeRes();
      return Promise.resolve(app.routes.get('GET /api/discord/:userId')!({ params: { userId } }, res, () => {})).then(() => res);
    };

    it('400 на невалидный ID', async () => {
      const { app } = setup();
      expect((await get(app, 'abc')).statusCode).toBe(400);
    });

    it('404 для непривязанного аккаунта и без запросов в Lanyard', async () => {
      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const { app } = setup();
      expect((await get(app, '999999999999999999')).statusCode).toBe(404);
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('мерджит бейджи в ответ Lanyard и кэширует результат', async () => {
      const fetchMock = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(jsonResponse({ success: true, data: { discord_user: { id: '700000000000000001' }, discord_status: 'online' } }));
      const { app, bios } = setup();
      Object.assign(bios.alice, { discordConnected: true, discordId: '700000000000000001', discordPremiumType: 2 });

      const first = await get(app, '700000000000000001');
      const second = await get(app, '700000000000000001');

      expect(first.body.data.discord_status).toBe('online');
      expect(first.body.data.discord_user.badges.map((b: any) => b.id)).toEqual(['nitro']);
      expect(second.body).toEqual(first.body);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('падает назад на данные OAuth, если Lanyard недоступен', async () => {
      vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
      const { app, bios } = setup();
      Object.assign(bios.alice, { discordConnected: true, discordId: '700000000000000002', discordUsername: 'ali' });

      const res = await get(app, '700000000000000002');

      expect(res.statusCode).toBe(200);
      expect(res.body.data.discord_status).toBe('offline');
      expect(res.body.data.discord_user.username).toBe('ali');
    });
  });
});
