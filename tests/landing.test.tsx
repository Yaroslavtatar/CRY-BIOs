// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import LandingPage from '../src/components/LandingPage';
import OpenSourceSection from '../src/components/landing/OpenSourceSection';
import SocialRow from '../src/components/landing/SocialRow';
import { isVersionTag } from '../src/utils/format';
import { normalizeSnapshot, type GithubSnapshot } from '../src/github';
import type { GithubState } from '../src/hooks/useGithub';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

const snapshot = (over: Partial<GithubSnapshot['repo']> = {}, extra: Partial<GithubSnapshot> = {}): GithubSnapshot => ({
  repo: {
    fullName: 'Yaroslavtatar/CRY-BIOs', url: 'https://github.com/Yaroslavtatar/CRY-BIOs', description: 'open-source bio pages',
    stars: 1234, forks: 56, openIssues: 11, license: 'MIT', homepage: 'https://cbios.ru', pushedAt: new Date(Date.now() - 3 * 86400_000).toISOString(), defaultBranch: 'main', ...over,
  },
  latestRelease: { tag: 'v1.4.0', name: 'v1.4.0', url: 'https://github.com/Yaroslavtatar/CRY-BIOs/releases/tag/v1.4.0', publishedAt: null },
  contributors: [
    { login: 'alice', avatarUrl: 'https://avatars.githubusercontent.com/u/1', url: 'https://github.com/alice', contributions: 60 },
    { login: 'bob', avatarUrl: '', url: 'https://github.com/bob', contributions: 7 },
  ],
  recentCommits: [{ sha: '47b48ea', message: 'feat: new thing', url: 'https://github.com/Yaroslavtatar/CRY-BIOs/commit/47b48ea', author: 'alice', date: new Date(Date.now() - 2 * 86400_000).toISOString() }],
  dockerImage: 'ghcr.io/yaroslavtatar/cry-bios:latest',
  ...extra,
});

const ready = (s = snapshot(), stale = false): GithubState => ({ status: 'ready', data: s, stale, fetchedAt: new Date().toISOString() });

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (window as any).matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  (globalThis as any).IntersectionObserver ??= class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  Element.prototype.scrollIntoView = vi.fn();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});
afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  vi.restoreAllMocks();
});

const render = (el: React.ReactElement) => act(async () => root.render(el));
const links = () => [...container.querySelectorAll('a')] as HTMLAnchorElement[];
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 30)); });

function mockApi(github: unknown, githubStatus = 200) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input: any) => {
    const url = typeof input === 'string' ? input : input.url;
    if (url === '/api/github') {
      return new Response(JSON.stringify(github), { status: githubStatus, headers: { 'Content-Type': 'application/json' } });
    }
    if (url === '/api/all-bios') return new Response(JSON.stringify([{ username: 'alice', displayName: 'Alice' }, { username: 'bob', displayName: 'Bob' }]), { status: 200 });
    return new Response('{}', { status: 200 });
  });
}

describe('OpenSourceSection', () => {
  it('показывает данные репозитория: имя, звёзды, форки, issues, лицензию', async () => {
    await render(<OpenSourceSection github={ready()} />);
    const text = container.textContent!;
    expect(text).toContain('Yaroslavtatar/CRY-BIOs');
    expect(text).toMatch(/1,2\s?тыс/); // 1234 звезды
    expect(text).toContain('56');
    expect(text).toContain('11');
    expect(text).toContain('MIT');
    expect(text).toContain('open-source bio pages');
    expect(text).toContain('v1.4.0');
    expect(text).toMatch(/3 дн/); // «обновлено 3 дня назад»
  });

  it('все ссылки внешние, безопасные (https, noopener) и ведут на нужные страницы репозитория', async () => {
    await render(<OpenSourceSection github={ready()} />);
    for (const a of links()) {
      expect(a.href.startsWith('https://'), a.href).toBe(true);
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
    }
    const hrefs = links().map((a) => a.href);
    expect(hrefs).toContain('https://github.com/Yaroslavtatar/CRY-BIOs/fork');
    expect(hrefs).toContain('https://github.com/Yaroslavtatar/CRY-BIOs/stargazers');
    expect(hrefs.some((h) => h.includes('/issues/new?template=bug_report.md'))).toBe(true);
    expect(hrefs.some((h) => h.includes('/issues/new?template=feature_request.md'))).toBe(true);
  });

  it('контрибьюторы и последние изменения', async () => {
    await render(<OpenSourceSection github={ready()} />);
    expect(container.querySelector('a[title^="alice"]')).not.toBeNull();
    expect(container.textContent).toContain('feat: new thing');
    expect(container.textContent).toContain('47b48ea');
  });

  it('аватар без картинки или с ошибкой загрузки заменяется инициалами, а не alt-текстом', async () => {
    await render(<OpenSourceSection github={ready()} />);
    const bob = container.querySelector('a[title^="bob"]')!;
    expect(bob.querySelector('img')).toBeNull();
    expect(bob.textContent).toBe('bo');
    const img = container.querySelector('a[title^="alice"] img') as HTMLImageElement;
    expect(img).not.toBeNull();
    await act(async () => { img.dispatchEvent(new Event('error')); });
    expect(container.querySelector('a[title^="alice"] img')).toBeNull();
    expect(container.querySelector('a[title^="alice"]')!.textContent).toBe('al');
  });

  it('загрузка: скелетон, без цифр и «NaN»', async () => {
    await render(<OpenSourceSection github={{ status: 'loading' }} />);
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/NaN|undefined/);
  });

  it('GitHub недоступен: честное сообщение, рабочие ссылки на репозиторий и никаких выдуманных цифр', async () => {
    await render(<OpenSourceSection github={{ status: 'unavailable' }} />);
    expect(container.textContent).toContain('Данные GitHub сейчас недоступны');
    expect(container.textContent).not.toMatch(/NaN|undefined/);
    expect(container.textContent).not.toContain('Звёзды');
    expect(links().some((a) => a.href === 'https://github.com/Yaroslavtatar/CRY-BIOs/fork')).toBe(true);
  });

  it('устаревшие данные помечаются', async () => {
    await render(<OpenSourceSection github={ready(snapshot(), true)} />);
    expect(container.textContent).toContain('последние сохранённые данные');
    await render(<OpenSourceSection github={ready(snapshot(), false)} />);
    expect(container.textContent).not.toContain('последние сохранённые данные');
  });

  it('релиз с названием не-версии («ВАУ») не показывается плашкой', async () => {
    await render(<OpenSourceSection github={ready(snapshot(), false)} />);
    expect(container.textContent).toContain('v1.4.0');
    const odd = snapshot({}, { latestRelease: { tag: 'ВАУ', name: 'Build', url: 'https://github.com/Yaroslavtatar/CRY-BIOs/releases/tag/x', publishedAt: null } });
    await render(<OpenSourceSection github={ready(odd)} />);
    expect(container.textContent).not.toContain('ВАУ');
  });

  it('строка git clone копируется в буфер', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    await render(<OpenSourceSection github={ready()} />);
    expect(container.textContent).toContain('git clone https://github.com/Yaroslavtatar/CRY-BIOs.git');
    await act(async () => (container.querySelector('[aria-label="Скопировать команду"]') as HTMLElement).click());
    expect(writeText).toHaveBeenCalledWith('git clone https://github.com/Yaroslavtatar/CRY-BIOs.git');
  });
});

describe('isVersionTag', () => {
  it('версии принимаются, слова — нет', () => {
    for (const ok of ['v1.2.3', '1.0', '2.0.0-beta.1', 'v10', '1.2.3.4']) expect(isVersionTag(ok), ok).toBe(true);
    for (const bad of ['ВАУ', 'latest', 'release', '', 'v', 'main', null, undefined]) expect(isVersionTag(bad as any), String(bad)).toBe(false);
  });
});

describe('SocialRow', () => {
  it('GitHub всегда, остальные — только настроенные', async () => {
    await render(<SocialRow githubUrl="https://github.com/o/r" socials={[{ id: 'telegram', url: 'https://t.me/x' }, { id: 'discord', url: 'https://discord.gg/y' }]} />);
    expect(links().map((a) => a.getAttribute('aria-label'))).toEqual(['GitHub', 'Telegram', 'Discord']);
    expect(links().every((a) => a.rel.includes('noopener') && a.target === '_blank')).toBe(true);
    expect(container.querySelectorAll('svg').length).toBe(3); // у каждой соцсети своя иконка
  });
  it('без настроек — только GitHub; без GitHub и соцсетей — ничего', async () => {
    await render(<SocialRow githubUrl="https://github.com/o/r" />);
    expect(links()).toHaveLength(1);
    await render(<SocialRow />);
    expect(container.innerHTML).toBe('');
  });
  it('иконки есть у всех 8 поддерживаемых соцсетей', async () => {
    const all = ['telegram', 'discord', 'youtube', 'x', 'tiktok', 'vk', 'instagram', 'twitch'] as const;
    await render(<SocialRow socials={all.map((id) => ({ id, url: `https://example.com/${id}` }))} />);
    expect(container.querySelectorAll('svg').length).toBe(8);
  });
});

describe('LandingPage с данными GitHub', () => {
  const page = (socials?: any[]) => <LandingPage onNavigateToDashboard={() => {}} onViewProfile={() => {}} platformConfig={{ appUrl: 'https://cbios.test', baseDomain: 'cbios.test', socials } as any} />;

  it('звёзды в шапке, в hero и в статистике; лицензия реальная', async () => {
    mockApi({ enabled: true, data: snapshot(), stale: false, fetchedAt: new Date().toISOString() });
    await render(page());
    await flush();
    const header = container.querySelector('#header_github_link')!;
    expect(header.textContent).toMatch(/1,2\s?тыс/);
    expect(container.textContent).toMatch(/★ 1,2\s?тыс/);
    expect(container.textContent).toContain('Лицензия');
  });

  it('выдуманная статистика («Запросов», формула профилей × 128) убрана; число профилей реальное', async () => {
    mockApi({ enabled: true, data: snapshot(), stale: false, fetchedAt: new Date().toISOString() });
    await render(page());
    await flush();
    expect(container.textContent).not.toContain('Запросов');
    expect(container.textContent).not.toMatch(/Просмотры/);
    expect(container.textContent).not.toContain('v1.2.0-STABLE');
    expect(container.textContent).toContain('2 Активных'); // ровно столько профилей вернул сервер
  });

  it('образ Docker берётся из репозитория, а не зашитый «cryteam»', async () => {
    mockApi({ enabled: true, data: snapshot(), stale: false, fetchedAt: new Date().toISOString() });
    await render(page());
    await flush();
    expect(container.textContent).toContain('image: ghcr.io/yaroslavtatar/cry-bios:latest');
    expect(container.textContent).not.toContain('ghcr.io/cryteam');
  });

  it('до ответа GitHub и при его недоступности образ — правильный запасной, а не cryteam', async () => {
    mockApi({ enabled: true, error: 'x' }, 503);
    await render(page());
    await flush();
    expect(container.textContent).toContain('image: ghcr.io/yaroslavtatar/cry-bios:latest');
    expect(container.textContent).toContain('Данные GitHub сейчас недоступны');
    expect(container.textContent).not.toMatch(/NaN|undefined/);
  });

  it('версия в футере: настоящая версия-тег, иначе ветка@коммит', async () => {
    mockApi({ enabled: true, data: snapshot(), stale: false, fetchedAt: '' });
    await render(page());
    await flush();
    expect(container.querySelector('footer')!.textContent).toContain('v1.4.0');
    const odd = snapshot({}, { latestRelease: { tag: 'ВАУ', name: 'x', url: 'https://github.com/Yaroslavtatar/CRY-BIOs/releases/tag/x', publishedAt: null } });
    mockApi({ enabled: true, data: odd, stale: false, fetchedAt: '' });
    await act(async () => root.unmount());
    root = createRoot(container);
    await render(page());
    await flush();
    const footer = container.querySelector('footer')!.textContent!;
    expect(footer).toContain('main@47b48ea');
    expect(footer).not.toContain('ВАУ');
  });

  it('соцсети из настроек сервера показываются в футере', async () => {
    mockApi({ enabled: true, data: snapshot(), stale: false, fetchedAt: '' });
    await render(page([{ id: 'telegram', url: 'https://t.me/cryteam' }]));
    await flush();
    const footerLinks = [...container.querySelectorAll('footer a')].map((a) => a.getAttribute('aria-label'));
    expect(footerLinks).toContain('Telegram');
    expect(footerLinks).toContain('GitHub');
  });

  it('GITHUB_REPO=off: нет блока, ссылок на репозиторий и звёзд', async () => {
    mockApi({ enabled: false });
    await render(page());
    await flush();
    expect(container.querySelector('#opensource')).toBeNull();
    expect(container.querySelector('#header_github_link')).toBeNull();
    expect(links().some((a) => a.href.includes('github.com'))).toBe(false);
    expect(container.textContent).not.toMatch(/NaN|undefined/);
  });
});

describe('нормализатор → интерфейс (сквозной случай на «сыром» ответе GitHub)', () => {
  it('вредные данные не попадают в разметку', async () => {
    const snap = normalizeSnapshot({
      repo: { full_name: 'a/b', html_url: 'https://github.com/a/b', description: '<img src=x onerror=alert(1)>', stargazers_count: 3 },
      contributors: [{ login: 'evil', type: 'User', avatar_url: 'https://evil.example/x.png', html_url: 'javascript:alert(1)', contributions: 1 }],
      commits: [{ sha: 'abcdef1234', html_url: 'https://evil.example/c', commit: { message: 'x', author: { date: '2026-01-01T00:00:00Z' } } }],
    }, 'a/b');
    await render(<OpenSourceSection github={ready(snap)} />);
    expect(container.querySelector('img[src*="evil"]')).toBeNull();
    expect(container.querySelector('img[onerror]')).toBeNull();
    expect(links().some((a) => a.href.startsWith('javascript:'))).toBe(false);
    expect(links().some((a) => a.href.includes('evil.example'))).toBe(false);
    expect(container.textContent).toContain('<img src=x onerror=alert(1)>'); // текст экранируется React, а не исполняется
  });
});
