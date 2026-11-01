/**
 * Данные репозитория с GitHub для главной страницы.
 * Запросы идут с сервера (а не из браузера посетителя): так не упираемся в лимит 60 запросов/час на IP,
 * можно использовать токен (он никогда не уходит клиенту) и кэшировать ответ для всех посетителей.
 */

export const DEFAULT_REPO = 'Yaroslavtatar/CRY-BIOs';

export interface GithubContributor {
  login: string;
  avatarUrl: string;
  url: string;
  contributions: number;
}

export interface GithubCommit {
  sha: string;
  message: string;
  url: string;
  author: string;
  date: string;
}

export interface GithubSnapshot {
  repo: {
    fullName: string;
    url: string;
    description: string;
    stars: number;
    forks: number;
    openIssues: number;
    license: string | null;
    homepage: string | null;
    pushedAt: string | null;
    defaultBranch: string;
  };
  latestRelease: { tag: string; name: string; url: string; publishedAt: string | null } | null;
  contributors: GithubContributor[];
  recentCommits: GithubCommit[];
  /** Образ из ghcr.io, который публикует docker.yml (имя репозитория в нижнем регистре) */
  dockerImage: string;
}

export interface GithubResult {
  data: GithubSnapshot;
  /** Время получения данных с GitHub (ISO) */
  fetchedAt: string;
  /** GitHub не ответил, отдаём последние известные данные */
  stale: boolean;
}

const REPO_RE = /^[A-Za-z0-9_.-]{1,100}\/[A-Za-z0-9_.-]{1,100}$/;

/** owner/name без лишнего: защита от подстановки произвольных путей в запрос к API */
export function isValidRepo(value: unknown): value is string {
  return typeof value === 'string' && REPO_RE.test(value) && !value.includes('..');
}

export function dockerImageFor(repo: string): string {
  return `ghcr.io/${repo.toLowerCase()}:latest`;
}

const GITHUB_HOSTS = new Set(['github.com', 'www.github.com']);
const AVATAR_HOSTS = new Set(['avatars.githubusercontent.com', 'github.com']);

/** Пропускает только https-ссылки на разрешённые хосты: данные внешнего сервиса не должны давать произвольные ссылки в разметке */
export function safeUrl(value: unknown, hosts: Set<string> = GITHUB_HOSTS): string | null {
  if (typeof value !== 'string') return null;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && hosts.has(u.hostname) ? u.toString() : null;
  } catch {
    return null;
  }
}

const text = (v: unknown, max: number, ellipsis = false) => {
  if (typeof v !== 'string') return '';
  const clean = v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
  return ellipsis && clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean.slice(0, max);
};
const count = (v: unknown) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : 0);
const isoOrNull = (v: unknown) => (typeof v === 'string' && !Number.isNaN(Date.parse(v)) ? v : null);

export interface RawGithub {
  repo: any;
  releases?: any;
  contributors?: any;
  commits?: any;
}

/** Приводит ответы API к компактной безопасной структуре (без e-mail, ботов и непроверенных ссылок). */
export function normalizeSnapshot(raw: RawGithub, repoName: string): GithubSnapshot {
  const r = raw.repo || {};
  const fullName = isValidRepo(r.full_name) ? r.full_name : repoName;
  const release = Array.isArray(raw.releases) ? raw.releases.find((x: any) => x && !x.draft && !x.prerelease) ?? raw.releases[0] : null;
  const releaseUrl = release ? safeUrl(release.html_url) : null;

  const contributors: GithubContributor[] = (Array.isArray(raw.contributors) ? raw.contributors : [])
    .filter((c: any) => c && c.type === 'User' && typeof c.login === 'string' && !c.login.endsWith('[bot]'))
    .map((c: any) => ({
      login: text(c.login, 60),
      avatarUrl: safeUrl(c.avatar_url, AVATAR_HOSTS) || '',
      url: safeUrl(c.html_url) || `https://github.com/${encodeURIComponent(text(c.login, 60))}`,
      contributions: count(c.contributions),
    }))
    .filter((c: GithubContributor) => c.login)
    .slice(0, 12);

  const recentCommits: GithubCommit[] = (Array.isArray(raw.commits) ? raw.commits : [])
    .map((c: any) => ({
      sha: text(c?.sha, 40).slice(0, 7),
      // только первая строка сообщения; e-mail автора не берём
      message: text(String(c?.commit?.message || '').split('\n')[0], 110, true),
      url: safeUrl(c?.html_url) || '',
      author: text(c?.author?.login || c?.commit?.author?.name, 60),
      date: isoOrNull(c?.commit?.author?.date) || '',
    }))
    .filter((c: GithubCommit) => c.sha && c.message && c.url)
    .slice(0, 5);

  return {
    repo: {
      fullName,
      url: safeUrl(r.html_url) || `https://github.com/${fullName}`,
      description: text(r.description, 200),
      stars: count(r.stargazers_count),
      forks: count(r.forks_count),
      openIssues: count(r.open_issues_count),
      license: r.license?.spdx_id && r.license.spdx_id !== 'NOASSERTION' ? text(r.license.spdx_id, 30) : null,
      homepage: typeof r.homepage === 'string' && /^https:\/\//.test(r.homepage) ? text(r.homepage, 200) : null,
      pushedAt: isoOrNull(r.pushed_at),
      defaultBranch: text(r.default_branch, 60) || 'main',
    },
    latestRelease: release && releaseUrl && release.tag_name
      ? { tag: text(release.tag_name, 60), name: text(release.name || release.tag_name, 100), url: releaseUrl, publishedAt: isoOrNull(release.published_at) }
      : null,
    contributors,
    recentCommits,
    dockerImage: dockerImageFor(fullName),
  };
}

export interface GithubServiceOptions {
  repo?: string;
  token?: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
  /** Сколько данные считаются свежими, мс (по умолчанию 10 мин) */
  ttlMs?: number;
  /** Сколько можно отдавать устаревшие данные, если GitHub недоступен, мс (по умолчанию 24 ч) */
  staleMs?: number;
  /** Пауза после неудачи без кэша, мс: не долбим GitHub при каждом заходе (по умолчанию 60 с) */
  failureBackoffMs?: number;
  timeoutMs?: number;
}

export interface GithubService {
  repo: string;
  getSnapshot(): Promise<GithubResult | null>;
}

export function createGithubService(opts: GithubServiceOptions = {}): GithubService {
  const repo = opts.repo ?? DEFAULT_REPO;
  if (!isValidRepo(repo)) throw new Error(`Некорректный GITHUB_REPO: ${String(repo)}`);
  const fetchImpl = opts.fetchImpl ?? fetch;
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? 10 * 60_000;
  const staleMs = opts.staleMs ?? 24 * 60 * 60_000;
  const backoff = opts.failureBackoffMs ?? 60_000;
  const timeout = opts.timeoutMs ?? 6_000;

  let cached: { data: GithubSnapshot; at: number } | null = null;
  let lastFailureAt: number | null = null;
  let inflight: Promise<GithubResult | null> | null = null;

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'cry-bios-landing',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;

  const api = async (path: string) => {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, { headers, signal: AbortSignal.timeout(timeout) });
    if (!res.ok) throw new Error(`GitHub API ${path || '/'}: HTTP ${res.status}`);
    return res.json();
  };

  const result = (): GithubResult | null => {
    if (!cached) return null;
    const age = now() - cached.at;
    return { data: cached.data, fetchedAt: new Date(cached.at).toISOString(), stale: age > ttl };
  };

  const refresh = async (): Promise<GithubResult | null> => {
    try {
      // Репозиторий обязателен; релизы, контрибьюторы и коммиты — приятное дополнение
      const [repoRes, releases, contributors, commits] = await Promise.allSettled([
        api(''), api('/releases?per_page=3'), api('/contributors?per_page=15'), api('/commits?per_page=5'),
      ]);
      if (repoRes.status === 'rejected') throw repoRes.reason;
      const pick = (p: PromiseSettledResult<any>) => (p.status === 'fulfilled' ? p.value : undefined);
      cached = {
        data: normalizeSnapshot({ repo: repoRes.value, releases: pick(releases), contributors: pick(contributors), commits: pick(commits) }, repo),
        at: now(),
      };
      lastFailureAt = null;
    } catch (err) {
      lastFailureAt = now();
      console.warn('[github] не удалось обновить данные:', err instanceof Error ? err.message : err);
    }
    // при ошибке отдаём старые данные, если они не слишком старые
    if (cached && now() - cached.at <= staleMs) return result();
    return null;
  };

  return {
    repo,
    async getSnapshot() {
      if (cached && now() - cached.at <= ttl) return result();
      if (!cached && lastFailureAt !== null && now() - lastFailureAt < backoff) return null;
      if (cached && lastFailureAt !== null && now() - lastFailureAt < backoff) return now() - cached.at <= staleMs ? result() : null;
      // одновременные запросы делят один поход в GitHub
      inflight ??= refresh().finally(() => { inflight = null; });
      return inflight;
    },
  };
}
