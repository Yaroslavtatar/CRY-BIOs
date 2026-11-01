import { describe, it, expect, vi } from 'vitest';
import { createGithubService, normalizeSnapshot, isValidRepo, safeUrl, dockerImageFor, DEFAULT_REPO } from '../src/github';
import { getSocialLinks, validateSocialUrl, SOCIAL_DEFS } from '../src/socials';
import { compactNumber, relativeTime } from '../src/utils/format';

const REPO_JSON = {
  full_name: 'Yaroslavtatar/CRY-BIOs', html_url: 'https://github.com/Yaroslavtatar/CRY-BIOs', description: 'analog guns.lol open-source FREE',
  stargazers_count: 42, forks_count: 7, open_issues_count: 11, license: { spdx_id: 'MIT' }, homepage: 'https://cbios.ru',
  pushed_at: '2026-10-29T07:42:08Z', default_branch: 'main',
};
const RELEASES = [{ tag_name: 'v1.0.0', name: 'First', html_url: 'https://github.com/Yaroslavtatar/CRY-BIOs/releases/tag/v1.0.0', published_at: '2026-06-07T11:29:50Z', draft: false, prerelease: false }];
const CONTRIBUTORS = [
  { login: 'alice', type: 'User', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4', html_url: 'https://github.com/alice', contributions: 60 },
  { login: 'dependabot[bot]', type: 'Bot', avatar_url: 'https://avatars.githubusercontent.com/in/29110', html_url: 'https://github.com/apps/dependabot', contributions: 1 },
  { login: 'bob', type: 'User', avatar_url: 'https://evil.example/a.png', html_url: 'javascript:alert(1)', contributions: 7 },
];
const COMMITS = [
  { sha: '47b48ea1234567', html_url: 'https://github.com/Yaroslavtatar/CRY-BIOs/commit/47b48ea', author: { login: 'alice' }, commit: { message: 'feat: first line\n\nlong body with secrets', author: { name: 'Alice', email: 'alice@secret.mail', date: '2026-10-29T07:42:08Z' } } },
];

function fakeFetch(overrides: Record<string, unknown | (() => never)> = {}) {
  const calls: string[] = [];
  const impl = vi.fn(async (url: string) => {
    calls.push(url);
    const key = url.replace('https://api.github.com/repos/', '').replace(/^[^/]+\/[^/]+/, '').split('?')[0] || '/';
    const table: Record<string, unknown> = { '/': REPO_JSON, '/releases': RELEASES, '/contributors': CONTRIBUTORS, '/commits': COMMITS, ...overrides };
    const v = table[key];
    if (typeof v === 'function') (v as () => never)();
    if (v instanceof Response) return v;
    return new Response(JSON.stringify(v), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  return { impl: impl as unknown as typeof fetch, calls, spy: impl };
}

describe('isValidRepo / safeUrl / dockerImageFor', () => {
  it('принимает только owner/name', () => {
    expect(isValidRepo('Yaroslavtatar/CRY-BIOs')).toBe(true);
    for (const bad of ['', 'owner', 'a/b/c', '../etc/passwd', 'a/..', 'a b/c', 'a/b?x=1', 'a/b#h', undefined, 5, 'a/b\n']) expect(isValidRepo(bad as any), String(bad)).toBe(false);
  });
  it('safeUrl: только https и разрешённые хосты', () => {
    expect(safeUrl('https://github.com/x/y')).toBe('https://github.com/x/y');
    expect(safeUrl('http://github.com/x')).toBeNull();
    expect(safeUrl('javascript:alert(1)')).toBeNull();
    expect(safeUrl('https://github.com.evil.com/x')).toBeNull();
    expect(safeUrl('https://evil.com/github.com')).toBeNull();
    expect(safeUrl(undefined)).toBeNull();
  });
  it('образ ghcr — в нижнем регистре, как публикует docker/metadata-action', () => {
    expect(dockerImageFor('Yaroslavtatar/CRY-BIOs')).toBe('ghcr.io/yaroslavtatar/cry-bios:latest');
  });
});

describe('normalizeSnapshot', () => {
  const snap = normalizeSnapshot({ repo: REPO_JSON, releases: RELEASES, contributors: CONTRIBUTORS, commits: COMMITS }, DEFAULT_REPO);

  it('переносит основные цифры и лицензию', () => {
    expect(snap.repo).toMatchObject({ fullName: 'Yaroslavtatar/CRY-BIOs', stars: 42, forks: 7, openIssues: 11, license: 'MIT', homepage: 'https://cbios.ru', defaultBranch: 'main' });
    expect(snap.dockerImage).toBe('ghcr.io/yaroslavtatar/cry-bios:latest');
  });
  it('боты скрыты, небезопасные ссылки заменены', () => {
    expect(snap.contributors.map((c) => c.login)).toEqual(['alice', 'bob']);
    const bob = snap.contributors[1];
    expect(bob.avatarUrl).toBe(''); // чужой хост аватара отброшен
    expect(bob.url).toBe('https://github.com/bob'); // javascript: заменён ссылкой на профиль
  });
  it('в коммитах — только первая строка и без e-mail', () => {
    expect(snap.recentCommits[0]).toMatchObject({ sha: '47b48ea', message: 'feat: first line', author: 'alice' });
    expect(JSON.stringify(snap)).not.toContain('secret');
  });
  it('релиз; черновики и пререлизы не выбираются, если есть обычный', () => {
    expect(snap.latestRelease).toMatchObject({ tag: 'v1.0.0' });
    const s2 = normalizeSnapshot({ repo: REPO_JSON, releases: [{ ...RELEASES[0], tag_name: 'v2-rc', prerelease: true }, RELEASES[0]] }, DEFAULT_REPO);
    expect(s2.latestRelease!.tag).toBe('v1.0.0');
  });
  it('пустые и битые данные не ломают разбор', () => {
    const s = normalizeSnapshot({ repo: { stargazers_count: 'abc', forks_count: -5, pushed_at: 'мусор', license: { spdx_id: 'NOASSERTION' }, homepage: 'http://insecure' } }, DEFAULT_REPO);
    expect(s.repo).toMatchObject({ stars: 0, forks: 0, pushedAt: null, license: null, homepage: null, fullName: DEFAULT_REPO });
    expect(s.contributors).toEqual([]);
    expect(s.recentCommits).toEqual([]);
    expect(s.latestRelease).toBeNull();
  });
  it('управляющие символы и длинный текст обрезаются', () => {
    const s = normalizeSnapshot({ repo: { ...REPO_JSON, description: 'a\u0000b\n' + 'x'.repeat(500) } }, DEFAULT_REPO);
    expect(s.repo.description.length).toBeLessThanOrEqual(200);
    expect(s.repo.description).not.toMatch(/[\u0000-\u001f]/);
  });
});

describe('createGithubService', () => {
  it('отклоняет некорректное имя репозитория сразу', () => {
    expect(() => createGithubService({ repo: '../../x' })).toThrow();
  });

  it('первый вызов идёт в GitHub, второй в пределах TTL берёт кэш', async () => {
    const f = fakeFetch();
    let t = 1_000_000;
    const svc = createGithubService({ fetchImpl: f.impl, now: () => t });
    const a = await svc.getSnapshot();
    expect(a!.data.repo.stars).toBe(42);
    expect(a!.stale).toBe(false);
    const n = f.spy.mock.calls.length;
    expect(n).toBe(4); // репозиторий, релизы, контрибьюторы, коммиты
    t += 5 * 60_000;
    await svc.getSnapshot();
    expect(f.spy.mock.calls.length).toBe(n);
  });

  it('после TTL обновляет данные', async () => {
    const f = fakeFetch();
    let t = 0;
    const svc = createGithubService({ fetchImpl: f.impl, now: () => t, ttlMs: 1000 });
    await svc.getSnapshot();
    t += 2000;
    await svc.getSnapshot();
    expect(f.spy.mock.calls.length).toBe(8);
  });

  it('одновременные запросы делят один поход в GitHub', async () => {
    const f = fakeFetch();
    const svc = createGithubService({ fetchImpl: f.impl });
    const results = await Promise.all(Array.from({ length: 10 }, () => svc.getSnapshot()));
    expect(f.spy.mock.calls.length).toBe(4);
    expect(new Set(results.map((r) => r!.fetchedAt)).size).toBe(1);
  });

  it('токен уходит только в заголовок Authorization и только на api.github.com', async () => {
    const f = fakeFetch();
    const svc = createGithubService({ fetchImpl: f.impl, token: 'ghp_secret' });
    await svc.getSnapshot();
    for (const [url, init] of f.spy.mock.calls as any[]) {
      expect(url.startsWith('https://api.github.com/repos/Yaroslavtatar/CRY-BIOs')).toBe(true);
      expect(init.headers.Authorization).toBe('Bearer ghp_secret');
    }
    const r = await svc.getSnapshot();
    expect(JSON.stringify(r)).not.toContain('ghp_secret');
  });

  it('GitHub лежит, кэша нет → null, и повторные заходы не долбят API (пауза)', async () => {
    const f = fakeFetch({ '/': new Response('{}', { status: 500 }) });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let t = 0;
    const svc = createGithubService({ fetchImpl: f.impl, now: () => t, failureBackoffMs: 60_000 });
    expect(await svc.getSnapshot()).toBeNull();
    const n = f.spy.mock.calls.length;
    t += 10_000;
    expect(await svc.getSnapshot()).toBeNull();
    expect(f.spy.mock.calls.length).toBe(n);
    t += 60_000; // пауза прошла — пробуем снова
    await svc.getSnapshot();
    expect(f.spy.mock.calls.length).toBeGreaterThan(n);
  });

  it('GitHub упал после успешной загрузки → отдаём последние данные с пометкой stale', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let fail = false;
    const impl = vi.fn(async (url: string) => {
      if (fail) return new Response('{"message":"rate limit"}', { status: 403 });
      return fakeFetch().impl(url as any);
    }) as unknown as typeof fetch;
    let t = 0;
    const svc = createGithubService({ fetchImpl: impl, now: () => t, ttlMs: 1000, failureBackoffMs: 0 });
    expect((await svc.getSnapshot())!.stale).toBe(false);
    fail = true;
    t += 5000;
    const r = await svc.getSnapshot();
    expect(r!.stale).toBe(true);
    expect(r!.data.repo.stars).toBe(42);
  });

  it('слишком старые данные (дольше staleMs) не отдаются', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    let fail = false;
    const impl = vi.fn(async (url: string) => (fail ? new Response('x', { status: 500 }) : fakeFetch().impl(url as any))) as unknown as typeof fetch;
    let t = 0;
    const svc = createGithubService({ fetchImpl: impl, now: () => t, ttlMs: 1000, staleMs: 10_000, failureBackoffMs: 0 });
    await svc.getSnapshot();
    fail = true;
    t += 20_000;
    expect(await svc.getSnapshot()).toBeNull();
  });

  it('если не отвечают второстепенные запросы (релизы, коммиты) — репозиторий всё равно показываем', async () => {
    const f = fakeFetch({ '/releases': new Response('x', { status: 404 }), '/commits': new Response('x', { status: 500 }) });
    const r = await createGithubService({ fetchImpl: f.impl }).getSnapshot();
    expect(r!.data.repo.stars).toBe(42);
    expect(r!.data.latestRelease).toBeNull();
    expect(r!.data.recentCommits).toEqual([]);
    expect(r!.data.contributors).toHaveLength(2);
  });

  it('сетевая ошибка и таймаут не выбрасываются наружу', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const impl = vi.fn(async () => { throw new Error('network down'); }) as unknown as typeof fetch;
    await expect(createGithubService({ fetchImpl: impl }).getSnapshot()).resolves.toBeNull();
  });

  it('другой репозиторий из настроек подставляется в запросы и образ', async () => {
    const f = fakeFetch();
    const svc = createGithubService({ repo: 'someone/Fork', fetchImpl: f.impl });
    await svc.getSnapshot();
    expect(f.calls[0]).toContain('/repos/someone/Fork');
  });
});

describe('соцсети проекта', () => {
  it('без настроек — пусто', () => {
    expect(getSocialLinks({})).toEqual([]);
  });

  it('принимает https-ссылки на нужные домены', () => {
    const links = getSocialLinks({ SOCIAL_TELEGRAM_URL: 'https://t.me/cryteam', SOCIAL_DISCORD_URL: 'https://discord.gg/abc', SOCIAL_YOUTUBE_URL: 'https://www.youtube.com/@x', SOCIAL_X_URL: 'https://x.com/x' });
    expect(links.map((l) => l.id)).toEqual(['telegram', 'discord', 'youtube', 'x']);
  });

  it('отклоняет опасные и чужие ссылки и сообщает о них', () => {
    const warn = vi.fn();
    const links = getSocialLinks({
      SOCIAL_TELEGRAM_URL: 'javascript:alert(1)', SOCIAL_DISCORD_URL: 'http://discord.gg/abc', SOCIAL_YOUTUBE_URL: 'https://evil.com/youtube.com',
      SOCIAL_X_URL: 'https://user:pass@x.com/x', SOCIAL_VK_URL: 'https://vk.com.evil.ru/x', SOCIAL_TIKTOK_URL: 'не ссылка',
    }, warn);
    expect(links).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(6);
  });

  it('пустые значения молча пропускаются (без предупреждений)', () => {
    const warn = vi.fn();
    expect(getSocialLinks({ SOCIAL_TELEGRAM_URL: '', SOCIAL_VK_URL: '   ' }, warn)).toEqual([]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('домен проверяется по точному совпадению, регистр хоста не важен', () => {
    expect(validateSocialUrl(SOCIAL_DEFS[0], 'https://T.ME/cryteam')).toBe('https://t.me/cryteam');
    expect(validateSocialUrl(SOCIAL_DEFS[0], 'https://t.me.evil.com/x')).toBeNull();
  });
});

describe('форматирование', () => {
  it('compactNumber', () => {
    expect(compactNumber(0)).toBe('0');
    expect(compactNumber(999)).toBe('999');
    expect(compactNumber(1234)).toMatch(/1,2\s?тыс/);
    expect(compactNumber(-5)).toBe('0');
    expect(compactNumber(NaN)).toBe('0');
  });

  it('relativeTime по-русски', () => {
    const now = Date.parse('2026-10-30T12:00:00Z');
    expect(relativeTime('2026-10-30T11:59:50Z', now)).toBe('только что');
    expect(relativeTime('2026-10-30T09:00:00Z', now)).toMatch(/3 час/);
    expect(relativeTime('2026-10-27T12:00:00Z', now)).toMatch(/3 дн/);
    expect(relativeTime('2026-06-07T12:00:00Z', now)).toMatch(/мес/);
  });

  it('relativeTime: пустое и битое → пустая строка, без «Invalid Date»', () => {
    expect(relativeTime(null)).toBe('');
    expect(relativeTime('')).toBe('');
    expect(relativeTime('мусор')).toBe('');
  });
});
