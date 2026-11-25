import { describe, it, expect, vi, afterEach } from 'vitest';
import { applyImportedProfile, mergeLinks } from '../src/import/apply';
import { IMPORT_PROVIDERS, getImportProvider } from '../src/import/catalog';
import { detectImportProvider } from '../src/import/detect';
import { ImportJobs } from '../src/import/jobs';
import { isImportMediaHost } from '../src/import/mediaHosts';
import { collectUnhostedMedia, importProfile } from '../src/import/pipeline';
import { runImport } from '../src/import';
import { extractGithubLogin, importGithub, mapGithubUser } from '../src/import/providers/github';
import { extractGunsName, importGuns } from '../src/import/providers/guns';
import { extractLinktreeName, parseLinktreeHtml } from '../src/import/providers/linktree';
import { extractTelegramUsername, importTelegram, parseTelegramHtml } from '../src/import/providers/telegram';
import { safeFetchText } from '../src/import/safeFetch';
import { describeImportedProfile } from '../src/import/sections';
import { buildSocialLinks, linkKey, platformFromUrl, sanitizeImportUrl } from '../src/import/socialDetect';
import { ImportError, type ImportedProfile } from '../src/import/types';
import type { BioConfig, BlockConfig } from '../src/types';

const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/html', ...headers } });

const stubFetch = (handler: (url: string, init?: RequestInit) => Response | Promise<Response>) =>
  vi.fn(async (url: any, init?: RequestInit) => handler(String(url), init)) as unknown as typeof fetch;

const makeConfig = (patch: Partial<BioConfig> = {}): BioConfig =>
  ({
    username: 'alice', displayName: 'Alice', bio: 'my bio', avatarUrl: '/uploads/old.webp',
    bgType: 'color', bgValue: '#000000', primaryColor: '#ffffff', audioUrl: '', audioTitle: '', audioArtist: '',
    audioSourceMode: 'single', playlist: [], badges: [], verified: false,
    blocks: [{ id: 'socials-1', type: 'socials', title: 'Links', enabled: true, socialsList: [{ id: 's1', platform: 'github', url: 'https://github.com/alice' }] }],
    ...patch,
  }) as unknown as BioConfig;

afterEach(() => { vi.useRealTimers(); });

describe('socialDetect', () => {
  it('пропускает только http(s) и mailto', () => {
    expect(sanitizeImportUrl('javascript:alert(1)')).toBeNull();
    expect(sanitizeImportUrl('data:text/html,<script>')).toBeNull();
    expect(sanitizeImportUrl('  JaVaScRiPt:alert(1)')).toBeNull();
    expect(sanitizeImportUrl('java\nscript:alert(1)')).toBeNull();
    expect(sanitizeImportUrl('ftp://example.com/file')).toBeNull();
    expect(sanitizeImportUrl('https://user:pw@example.com')).toBeNull();
    expect(sanitizeImportUrl('localhost')).toBeNull();
    expect(sanitizeImportUrl('mailto:me@example.com')).toBe('mailto:me@example.com');
    expect(sanitizeImportUrl('alice.dev')).toBe('https://alice.dev/');
    expect(sanitizeImportUrl('x'.repeat(600))).toBeNull();
  });

  it('определяет платформу по домену и поддомену', () => {
    expect(platformFromUrl('https://t.me/alice')).toBe('telegram');
    expect(platformFromUrl('https://m.vk.com/alice')).toBe('vk');
    expect(platformFromUrl('https://x.com/alice')).toBe('twitter');
    expect(platformFromUrl('https://notgithub.com/alice')).toBe('website');
    expect(platformFromUrl('https://evil.com/github.com')).toBe('website');
    expect(platformFromUrl('mailto:a@b.co')).toBe('email');
  });

  it('убирает дубли, плохие ссылки и режет по лимиту', () => {
    const list = buildSocialLinks(
      [
        { url: 'https://alice.dev', label: 'Site' },
        { url: 'https://www.alice.dev/' },
        { url: 'javascript:alert(1)' },
        { url: 'https://github.com/alice', type: 'GITHUB' },
      ],
      'p',
    );
    expect(list.map((l) => l.url)).toEqual(['https://alice.dev/', 'https://github.com/alice']);
    expect(list[0]).toMatchObject({ id: 'p-1', platform: 'website', label: 'Site' });
    const many = buildSocialLinks(Array.from({ length: 50 }, (_, i) => ({ url: `https://site${i}.com` })), 'm', 30);
    expect(many).toHaveLength(30);
  });

  it('ключ ссылки не зависит от схемы, www, слеша и регистра', () => {
    expect(linkKey('https://www.Alice.dev/Path/')).toBe(linkKey('http://alice.dev/path'));
  });
});

describe('safeFetchText', () => {
  const opts = { allowHost: (h: string) => h === 'good.example' };

  it('не ходит на чужие хосты, http, порты и учётные данные', async () => {
    const f = stubFetch(() => html('x'));
    for (const url of ['https://evil.example/', 'http://good.example/', 'https://good.example:8443/', 'https://u:p@good.example/', 'https://127.0.0.1/', 'https://169.254.169.254/latest/meta-data']) {
      await expect(safeFetchText(url, { ...opts, fetchImpl: f })).rejects.toMatchObject({ code: 'blocked' });
    }
    expect(f).not.toHaveBeenCalled();
  });

  it('следует редиректу только внутри разрешённых хостов', async () => {
    const f = stubFetch((url) => (url.endsWith('/a') ? new Response(null, { status: 302, headers: { location: '/b' } }) : html('ok')));
    await expect(safeFetchText('https://good.example/a', { ...opts, fetchImpl: f })).resolves.toBe('ok');

    const evil = stubFetch(() => new Response(null, { status: 302, headers: { location: 'https://169.254.169.254/' } }));
    await expect(safeFetchText('https://good.example/a', { ...opts, fetchImpl: evil })).rejects.toMatchObject({ code: 'blocked' });
    expect(evil).toHaveBeenCalledTimes(1);
  });

  it('обрывает бесконечные редиректы', async () => {
    const loop = stubFetch(() => new Response(null, { status: 302, headers: { location: '/again' } }));
    await expect(safeFetchText('https://good.example/', { ...opts, fetchImpl: loop })).rejects.toBeInstanceOf(ImportError);
    expect(loop).toHaveBeenCalledTimes(4);
  });

  it('ограничивает размер ответа и по заголовку, и на лету', async () => {
    const byHeader = stubFetch(() => html('x', 200, { 'content-length': '999999' }));
    await expect(safeFetchText('https://good.example/', { ...opts, maxBytes: 1000, fetchImpl: byHeader })).rejects.toMatchObject({ code: 'too_large' });
    const streamed = stubFetch(() => html('x'.repeat(5000)));
    await expect(safeFetchText('https://good.example/', { ...opts, maxBytes: 1000, fetchImpl: streamed })).rejects.toMatchObject({ code: 'too_large' });
  });

  it('переводит HTTP-статусы в понятные коды', async () => {
    const code = async (status: number) =>
      safeFetchText('https://good.example/', { ...opts, fetchImpl: stubFetch(() => html('', status)) }).catch((e: ImportError) => e.code);
    expect(await code(404)).toBe('not_found');
    expect(await code(403)).toBe('blocked');
    expect(await code(429)).toBe('rate_limited');
    expect(await code(500)).toBe('upstream');
    const down = stubFetch(() => { throw new TypeError('fetch failed'); });
    await expect(safeFetchText('https://good.example/', { ...opts, fetchImpl: down })).rejects.toMatchObject({ code: 'upstream' });
  });
});

describe('GitHub', () => {
  it('понимает логин в разных видах', () => {
    expect(extractGithubLogin('octocat')).toBe('octocat');
    expect(extractGithubLogin('@octocat')).toBe('octocat');
    expect(extractGithubLogin('https://github.com/octocat/')).toBe('octocat');
    expect(extractGithubLogin('github.com/octocat?tab=repositories')).toBe('octocat');
    expect(extractGithubLogin('-bad')).toBeNull();
    expect(extractGithubLogin('a'.repeat(40))).toBeNull();
    expect(extractGithubLogin('https://evil.com/octocat')).toBeNull();
  });

  const user = {
    login: 'octocat', name: 'The Octocat', bio: 'Hi there', avatar_url: 'https://avatars.githubusercontent.com/u/583231?v=4',
    html_url: 'https://github.com/octocat', blog: 'octo.dev', twitter_username: 'octo_cat', location: 'San Francisco',
  };

  it('собирает профиль: имя, описание, аватар, город, ссылки', () => {
    const p = mapGithubUser(user);
    expect(p).toMatchObject({ source: 'github', displayName: 'The Octocat', bio: 'Hi there', locationEnabled: true, locationText: 'San Francisco' });
    expect(p.avatarUrl).toBe('https://avatars.githubusercontent.com/u/583231?v=4&s=512');
    expect(p.socialsList?.map((l) => [l.platform, l.url])).toEqual([
      ['github', 'https://github.com/octocat'], ['website', 'https://octo.dev/'], ['twitter', 'https://x.com/octo_cat'],
    ]);
  });

  it('отбрасывает аватар с постороннего хоста и подставляет логин вместо пустого имени', () => {
    const p = mapGithubUser({ ...user, name: null, avatar_url: 'https://evil.example/a.png', blog: 'javascript:alert(1)' });
    expect(p.avatarUrl).toBeUndefined();
    expect(p.displayName).toBe('octocat');
    expect(p.socialsList).toHaveLength(2);
  });

  it('ходит только на api.github.com и передаёт токен, если он есть', async () => {
    const f = vi.fn(async () => new Response(JSON.stringify(user), { status: 200 })) as unknown as typeof fetch;
    await importGithub('octocat', { fetchImpl: f, githubToken: 'tok' });
    const [url, init] = (f as any).mock.calls[0];
    expect(url).toBe('https://api.github.com/users/octocat');
    expect(init.headers.Authorization).toBe('Bearer tok');
    await expect(importGithub('???', { fetchImpl: f })).rejects.toMatchObject({ code: 'bad_input' });
    await expect(importGithub('ghost', { fetchImpl: stubFetch(() => html('', 404)) })).rejects.toMatchObject({ code: 'not_found' });
    await expect(importGithub('ghost', { fetchImpl: stubFetch(() => html('<html>', 200)) })).rejects.toMatchObject({ code: 'parse' });
  });
});

describe('Telegram', () => {
  it('понимает имя в разных видах', () => {
    expect(extractTelegramUsername('@durov')).toBe('durov');
    expect(extractTelegramUsername('https://t.me/durov')).toBe('durov');
    expect(extractTelegramUsername('t.me/s/durov?before=5')).toBe('durov');
    expect(extractTelegramUsername('https://t.me/+AbCdEfGh12')).toBeNull();
    expect(extractTelegramUsername('abc')).toBeNull();
    expect(extractTelegramUsername('1invalid')).toBeNull();
  });

  const page = (title: string, desc: string, image = '') =>
    `<html><head><meta property="og:title" content="${title}"><meta property="og:description" content="${desc}">${image ? `<meta property="og:image" content="${image}">` : ''}</head></html>`;

  it('читает имя, описание и аватар, раскодирует сущности', () => {
    const p = parseTelegramHtml(page('Pavel &amp; Co', 'It&#39;s &quot;me&quot;', 'https://cdn5.cdn-telegram.org/file/a.jpg'), 'durov');
    expect(p).toMatchObject({ displayName: 'Pavel & Co', bio: `It's "me"`, avatarUrl: 'https://cdn5.cdn-telegram.org/file/a.jpg' });
    expect(p.socialsList).toEqual([{ id: 'telegram-1', platform: 'telegram', url: 'https://t.me/durov' }]);
    expect(p.notes).toBeUndefined();
  });

  it('у закрытого профиля берёт только ссылку и предупреждает', () => {
    const p = parseTelegramHtml(page('Telegram: Contact @someuser', 'You can contact @someuser right away.'), 'someuser');
    expect(p.displayName).toBeUndefined();
    expect(p.bio).toBeUndefined();
    expect(p.socialsList).toHaveLength(1);
    expect(p.notes?.[0]).toMatch(/нет публичного профиля/);
  });

  it('не принимает аватар с чужого хоста', () => {
    expect(parseTelegramHtml(page('Bob', 'x', 'https://evil.example/a.jpg'), 'bobby').avatarUrl).toBeUndefined();
  });

  it('грузит только t.me', async () => {
    const f = vi.fn(async () => html(page('Bob', 'x'))) as unknown as typeof fetch;
    await importTelegram('@bobby', { fetchImpl: f });
    expect((f as any).mock.calls[0][0]).toBe('https://t.me/bobby');
    await expect(importTelegram('abc', {})).rejects.toMatchObject({ code: 'bad_input' });
  });
});

describe('Linktree', () => {
  const nextData = (data: unknown) => `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(data)}</script></html>`;
  const data = {
    props: { pageProps: {
      account: { pageTitle: 'Alice', description: 'hi', profilePictureUrl: 'https://ugc.production.linktr.ee/x.jpeg', username: 'alice' },
      socialLinks: [{ type: 'INSTAGRAM', url: 'https://instagram.com/alice' }],
      links: [
        { type: 'CLASSIC', title: 'My site', url: 'https://alice.dev' },
        { type: 'HEADER', title: 'Section' },
        { type: 'CLASSIC', title: 'Locked', url: 'https://secret.example.com', locked: true },
        { type: 'CLASSIC', title: 'Bad', url: 'javascript:alert(1)' },
        { type: 'CLASSIC', title: 'Dup', url: 'https://alice.dev/' },
      ],
    } },
  };

  it('понимает имя в разных видах', () => {
    expect(extractLinktreeName('https://linktr.ee/alice')).toBe('alice');
    expect(extractLinktreeName('linktr.ee/alice?utm=1')).toBe('alice');
    expect(extractLinktreeName('@alice')).toBe('alice');
    expect(extractLinktreeName('https://evil.com/alice')).toBeNull();
  });

  it('читает профиль и ссылки, пропуская заголовки, закрытые и опасные', () => {
    const p = parseLinktreeHtml(nextData(data), 'alice');
    expect(p).toMatchObject({ source: 'linktree', displayName: 'Alice', bio: 'hi', avatarUrl: 'https://ugc.production.linktr.ee/x.jpeg' });
    expect(p.socialsList?.map((l) => [l.platform, l.url, l.label])).toEqual([
      ['instagram', 'https://instagram.com/alice', undefined],
      ['website', 'https://alice.dev/', 'My site'],
    ]);
  });

  it('не принимает аватар с чужого хоста', () => {
    const d = structuredClone(data);
    d.props.pageProps.account.profilePictureUrl = 'https://evil.example/x.jpg';
    expect(parseLinktreeHtml(nextData(d)).avatarUrl).toBeUndefined();
  });

  it('при смене структуры страницы падает назад на Open Graph', () => {
    const p = parseLinktreeHtml('<meta property="og:title" content="@alice | Linktree"><meta property="og:description" content="About">', 'alice');
    expect(p).toMatchObject({ displayName: 'alice', bio: 'About' });
  });

  it('понятно сообщает, если страницу не удалось прочитать', () => {
    expect(() => parseLinktreeHtml('<html><body>nothing</body></html>')).toThrowError(ImportError);
    expect(() => parseLinktreeHtml('<script id="__NEXT_DATA__">{broken')).toThrowError(/вручную/);
  });
});

describe('guns.lol', () => {
  it('понимает имя в разных видах', () => {
    expect(extractGunsName('https://guns.lol/Alice/')).toBe('alice');
    expect(extractGunsName('guns.lol/alice')).toBe('alice');
    expect(extractGunsName('@alice')).toBe('alice');
    expect(extractGunsName('https://evil.com/alice')).toBeNull();
  });

  it('404 даёт «не найден», блокировка подсказывает вставить HTML', async () => {
    await expect(importGuns('ghost', { fetchImpl: stubFetch(() => html('', 404)) }, false)).rejects.toMatchObject({ code: 'not_found' });
    const err = await importGuns('alice', { fetchImpl: stubFetch(() => html('', 403)) }, false).catch((e) => e);
    expect(err).toMatchObject({ code: 'blocked' });
    expect(err.message).toMatch(/HTML/);
  });
});

describe('runImport', () => {
  it('проверяет платформу и ввод', async () => {
    await expect(runImport('nope', 'x')).rejects.toMatchObject({ code: 'bad_input' });
    await expect(runImport(undefined, 'x')).rejects.toMatchObject({ code: 'bad_input' });
    await expect(runImport('github', '   ')).rejects.toMatchObject({ code: 'bad_input' });
    await expect(runImport('github', 42)).rejects.toMatchObject({ code: 'bad_input' });
    await expect(runImport('github', 'a'.repeat(400))).rejects.toMatchObject({ code: 'bad_input' });
    await expect(runImport('linktree', `<html>${'x'.repeat(2_000_001)}`)).rejects.toMatchObject({ code: 'bad_input' });
    await expect(runImport('linktree', 'a'.repeat(400))).rejects.toMatchObject({ code: 'bad_input' });
  });

  it('распознаёт вставленный HTML только там, где он поддерживается', async () => {
    const tree = `<html><script id="__NEXT_DATA__">${JSON.stringify({ props: { pageProps: { account: { pageTitle: 'Zed' } } } })}</script></html>`;
    await expect(runImport('linktree', tree)).resolves.toMatchObject({ displayName: 'Zed' });
    // GitHub не принимает HTML: длинный ввод отвергается, а не разбирается
    await expect(runImport('github', tree)).rejects.toMatchObject({ code: 'bad_input' });
  });

  it('каталог и сервер знают одни и те же платформы', () => {
    expect(IMPORT_PROVIDERS.map((p) => p.id).sort()).toEqual(['github', 'guns', 'linktree', 'telegram']);
    expect(getImportProvider('telegram')?.htmlFallback).toBe(false);
    expect(getImportProvider('nope')).toBeUndefined();
  });
});

describe('detectImportProvider', () => {
  it('подсказывает платформу по ссылке', () => {
    expect(detectImportProvider('https://linktr.ee/alice')).toBe('linktree');
    expect(detectImportProvider('https://t.me/alice')).toBe('telegram');
    expect(detectImportProvider('github.com/alice')).toBe('github');
    expect(detectImportProvider('https://guns.lol/alice')).toBe('guns');
    expect(detectImportProvider('alice')).toBeNull();
    expect(detectImportProvider('')).toBeNull();
  });
});

describe('ImportJobs', () => {
  const result = { profile: { source: 'github', sourceLabel: 'GitHub' } as ImportedProfile, warnings: [] };

  it('доводит задачу до результата и показывает прогресс', async () => {
    const jobs = new ImportJobs({ idGen: () => 'j1' });
    let finish!: () => void;
    const id = jobs.start('alice', (report) => { report({ current: 1, total: 2, label: 'step' }); return new Promise((r) => { finish = () => r(result); }); });
    expect(jobs.get(id, 'alice')).toMatchObject({ status: 'running', progress: { label: 'step' } });
    finish();
    await vi.waitFor(() => expect(jobs.get(id, 'alice')?.status).toBe('done'));
    expect(jobs.get(id, 'alice')?.result).toBe(result);
  });

  it('прячет задачу от других пользователей', async () => {
    const jobs = new ImportJobs({ idGen: () => 'j1' });
    jobs.start('alice', async () => result);
    expect(jobs.get('j1', 'bob')).toBeNull();
    expect(jobs.get('nope', 'alice')).toBeNull();
  });

  it('не запускает второй импорт, пока идёт первый', async () => {
    let n = 0;
    const jobs = new ImportJobs({ idGen: () => `j${++n}` });
    let finish!: () => void;
    jobs.start('alice', () => new Promise((r) => { finish = () => r(result); }));
    expect(() => jobs.start('alice', async () => result)).toThrowError(expect.objectContaining({ code: 'busy' }));
    expect(() => jobs.start('bob', async () => result)).not.toThrow();
    finish();
    await vi.waitFor(() => expect(jobs.get('j1', 'alice')?.status).toBe('done'));
    expect(() => jobs.start('alice', async () => result)).not.toThrow();
  });

  it('передаёт понятные ошибки и скрывает неожиданные', async () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    const jobs = new ImportJobs({ idGen: (() => { let n = 0; return () => `j${++n}`; })() });
    jobs.start('a', async () => { throw new ImportError('Профиль не найден', 'not_found'); });
    jobs.start('b', async () => { throw new Error('ECONNRESET at /srv/secret/path'); });
    await vi.waitFor(() => expect(jobs.get('j2', 'b')?.status).toBe('error'));
    expect(jobs.get('j1', 'a')).toMatchObject({ error: 'Профиль не найден', errorCode: 'not_found' });
    expect(jobs.get('j2', 'b')?.error).not.toMatch(/secret/);
    quiet.mockRestore();
  });

  it('удаляет готовые задачи по истечении срока', async () => {
    vi.useFakeTimers();
    const jobs = new ImportJobs({ ttlMs: 1000, idGen: () => 'j1' });
    jobs.start('alice', async () => result);
    await vi.advanceTimersByTimeAsync(10);
    expect(jobs.get('j1', 'alice')?.status).toBe('done');
    await vi.advanceTimersByTimeAsync(1100);
    expect(jobs.get('j1', 'alice')).toBeNull();
  });
});

describe('importProfile (пайплайн)', () => {
  const user = { login: 'octocat', name: 'Octo', avatar_url: 'https://avatars.githubusercontent.com/u/1?v=4', html_url: 'https://github.com/octocat' };
  const fetchImpl = stubFetch(() => new Response(JSON.stringify(user), { status: 200 }));
  const deps = { uploadsDir: 'u', tmpDir: 't', dataDir: 'd', ctx: { fetchImpl } };

  it('подставляет сохранённые на сервере медиа и не предупреждает', async () => {
    const rehost = vi.fn(async (data: any, _u: string, _t: string, onProgress?: any) => {
      onProgress?.(1, 1, 'avatarUrl');
      return { ...data, avatarUrl: '/uploads/a.webp' };
    });
    const seen: string[] = [];
    const r = await importProfile('github', 'octocat', { ...deps, rehost }, (p) => seen.push(p.label));
    expect(r.profile.avatarUrl).toBe('/uploads/a.webp');
    expect(r.warnings).toEqual([]);
    expect(seen).toContain('Сохраняю аватар (1/1)…');
  });

  it('предупреждает, если медиа осталось внешней ссылкой', async () => {
    const rehost = vi.fn(async (data: any) => data);
    const r = await importProfile('github', 'octocat', { ...deps, rehost });
    expect(r.warnings[0]).toMatch(/аватар/);
  });

  it('переносит заметки источника в предупреждения', async () => {
    const stub = `<meta property="og:title" content="Telegram: Contact @bobby">`;
    const r = await importProfile('telegram', '@bobby', { ...deps, ctx: { fetchImpl: stubFetch(() => html(stub)) }, rehost: async (d) => d });
    expect(r.warnings[0]).toMatch(/нет публичного профиля/);
  });

  it('collectUnhostedMedia не считает цветовой фон ссылкой', () => {
    expect(collectUnhostedMedia({ bgType: 'color', bgValue: '#fff' } as ImportedProfile)).toEqual([]);
    expect(collectUnhostedMedia({ bgType: 'video', bgValue: 'https://x.test/v.mp4', playlist: [{ id: '1', url: 'https://x.test/a.mp3', title: '', artist: '' }] } as ImportedProfile)).toEqual(['фон', 'трек 1']);
  });
});

describe('mediaHosts', () => {
  it('разрешает известные CDN аватарок и больше ничего', () => {
    expect(isImportMediaHost('avatars.githubusercontent.com')).toBe(true);
    expect(isImportMediaHost('cdn5.cdn-telegram.org')).toBe(true);
    expect(isImportMediaHost('cdn4.telesco.pe')).toBe(true);
    expect(isImportMediaHost('ugc.production.linktr.ee')).toBe(true);
    expect(isImportMediaHost('evil.cdn-telegram.org.attacker.com')).toBe(false);
    expect(isImportMediaHost('attacker.com')).toBe(false);
    expect(isImportMediaHost('127.0.0.1')).toBe(false);
  });
});

describe('describeImportedProfile', () => {
  const profile = { source: 'github', sourceLabel: 'GitHub', displayName: 'A', socialsList: [{ id: '1', platform: 'github', url: 'https://github.com/a' }] } as ImportedProfile;

  it('показывает только то, что платформа умеет отдавать, плюс найденное', () => {
    const s = describeImportedProfile(profile, ['identity', 'links']);
    expect(s.map((x) => x.id)).toEqual(['identity', 'links']);
    expect(s[1]).toMatchObject({ found: true, detail: '1 ссылка' });
    const withMusic = describeImportedProfile({ ...profile, playlist: [{ id: '1', url: '/a.mp3', title: 't', artist: 'a' }] } as ImportedProfile, ['identity', 'links']);
    expect(withMusic.find((x) => x.id === 'music')).toMatchObject({ found: true, detail: '1 трек' });
  });

  it('не считает verified/staff бейджи импортируемыми', () => {
    const s = describeImportedProfile({ ...profile, badges: [{ id: 'b', type: 'verified' }, { id: 'c', type: 'staff' }] } as unknown as ImportedProfile, ['badges']);
    expect(s.find((x) => x.id === 'badges')).toMatchObject({ found: false, detail: '' });
    const withVip = describeImportedProfile({ ...profile, badges: [{ id: 'b', type: 'verified' }, { id: 'd', type: 'vip' }] } as unknown as ImportedProfile, ['badges']);
    expect(withVip.find((x) => x.id === 'badges')).toMatchObject({ found: true, detail: '1 бейдж' });
  });
});

describe('applyImportedProfile', () => {
  const imported = (patch: Partial<ImportedProfile> = {}): ImportedProfile =>
    ({ source: 'guns', sourceLabel: 'guns.lol', ...patch }) as ImportedProfile;

  it('применяет только отмеченные разделы', () => {
    const p = imported({ displayName: 'New', bio: 'new bio', primaryColor: '#ff0000', socialsList: [{ id: 'g-1', platform: 'website', url: 'https://new.dev/' }] });
    const { config, applied } = applyImportedProfile(makeConfig(), p, ['identity']);
    expect(config.displayName).toBe('New');
    expect(config.primaryColor).toBe('#ffffff');
    expect(config.blocks[0].socialsList).toHaveLength(1);
    expect(applied).toEqual(['Имя, описание, аватар']);
  });

  it('пустые значения источника ничего не затирают', () => {
    const { config } = applyImportedProfile(makeConfig(), imported({ displayName: '', bio: '', avatarUrl: '' }), ['identity', 'design']);
    expect(config).toMatchObject({ displayName: 'Alice', bio: 'my bio', avatarUrl: '/uploads/old.webp' });
  });

  it('не меняет исходный конфиг', () => {
    const base = makeConfig();
    const snapshot = JSON.stringify(base);
    applyImportedProfile(base, imported({ displayName: 'X', socialsList: [{ id: 'g-1', platform: 'website', url: 'https://x.dev/' }] }), ['identity', 'links']);
    expect(JSON.stringify(base)).toBe(snapshot);
  });

  it('добавляет ссылки к существующим без дублей и коллизий id', () => {
    const incoming = [
      { id: 's1', platform: 'github', url: 'https://github.com/alice/' },
      { id: 's1', platform: 'twitter', url: 'https://x.com/alice' },
    ] as any;
    const { config, applied } = applyImportedProfile(makeConfig(), imported({ socialsList: incoming }), ['links']);
    const list = config.blocks[0].socialsList!;
    expect(list.map((l) => l.url)).toEqual(['https://github.com/alice', 'https://x.com/alice']);
    expect(new Set(list.map((l) => l.id)).size).toBe(list.length);
    expect(applied).toEqual(['Ссылки и соцсети: добавлено 1']);
  });

  it('создаёт блок ссылок, если его не было, и соблюдает лимит', () => {
    const blocks: BlockConfig[] = [{ id: 'imported-socs', type: 'textbox', title: 't', enabled: true }];
    const many = Array.from({ length: 60 }, (_, i) => ({ id: `m-${i}`, platform: 'website', url: `https://s${i}.dev/` })) as any;
    const { blocks: out, added } = mergeLinks(blocks, many);
    const created = out.find((b) => b.type === 'socials')!;
    expect(created.id).toBe('imported-socs-2');
    expect(created.socialsList).toHaveLength(40);
    expect(added).toBe(40);
  });

  it('фон меняется только парой тип+значение', () => {
    const only = applyImportedProfile(makeConfig(), imported({ bgValue: 'https://x.test/b.png' }), ['design']);
    expect(only.config.bgType).toBe('color');
    expect(only.config.bgValue).toBe('#000000');
    const both = applyImportedProfile(makeConfig(), imported({ bgType: 'image', bgValue: '/uploads/b.webp' }), ['design']);
    expect(both.config).toMatchObject({ bgType: 'image', bgValue: '/uploads/b.webp' });
  });

  it('музыка: плейлист и первый трек, включает звук', () => {
    const pl = [{ id: '1', url: '/uploads/a.mp3', title: 'Song', artist: 'Band' }, { id: '2', url: '/uploads/b.mp3', title: 'Two', artist: 'Band' }];
    const { config } = applyImportedProfile(makeConfig(), imported({ audioUrl: '/uploads/a.mp3', playlist: pl }), ['music']);
    expect(config).toMatchObject({ audioUrl: '/uploads/a.mp3', audioTitle: 'Song', audioArtist: 'Band', audioSourceMode: 'playlist', audioEnabled: true });
  });

  it('бейджи verified и staff не импортируются', () => {
    const badges = [{ id: '1', type: 'verified' }, { id: '2', type: 'staff' }, { id: '3', type: 'vip' }] as any;
    const { config } = applyImportedProfile(makeConfig(), imported({ badges }), ['badges']);
    expect(config.badges.map((b) => b.type)).toEqual(['vip']);
  });

  it('город включает показ локации', () => {
    const { config } = applyImportedProfile(makeConfig(), imported({ locationText: 'Berlin' }), ['identity']);
    expect(config).toMatchObject({ locationText: 'Berlin', locationEnabled: true });
  });
});
