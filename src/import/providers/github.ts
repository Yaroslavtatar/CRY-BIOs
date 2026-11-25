import { buildSocialLinks, cleanImportText } from '../socialDetect';
import { safeFetchText } from '../safeFetch';
import { ImportError, type ImportedProfile } from '../types';
import type { ImportContext } from '../context';
import { GITHUB_AVATAR_HOSTS } from '../mediaHosts';

const LOGIN_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

export function extractGithubLogin(input: string): string | null {
  const v = input.trim();
  const m = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(v);
  const candidate = (m ? m[1] : v.replace(/^@/, '')).trim();
  return LOGIN_RE.test(candidate) ? candidate : null;
}

export function mapGithubUser(json: any): ImportedProfile {
  const login = cleanImportText(json?.login, 39);
  if (!login) throw new ImportError('GitHub вернул неожиданный ответ', 'parse');

  let avatarUrl: string | undefined;
  if (typeof json.avatar_url === 'string') {
    try {
      const u = new URL(json.avatar_url);
      if (u.protocol === 'https:' && GITHUB_AVATAR_HOSTS.includes(u.hostname.toLowerCase())) {
        u.searchParams.set('s', '512');
        avatarUrl = u.toString();
      }
    } catch {
      /* аватар необязателен */
    }
  }

  const links: Array<{ url: unknown; type?: unknown; label?: unknown }> = [
    { url: typeof json.html_url === 'string' ? json.html_url : `https://github.com/${login}`, type: 'github' },
  ];
  if (typeof json.blog === 'string' && json.blog.trim()) links.push({ url: json.blog.trim(), label: 'Сайт' });
  if (typeof json.twitter_username === 'string' && /^[A-Za-z0-9_]{1,15}$/.test(json.twitter_username)) {
    links.push({ url: `https://x.com/${json.twitter_username}`, type: 'twitter' });
  }

  const location = cleanImportText(json.location, 60);
  return {
    source: 'github',
    sourceLabel: 'GitHub',
    sourceUsername: login,
    displayName: cleanImportText(json.name, 50) || login,
    bio: cleanImportText(json.bio, 300),
    avatarUrl,
    ...(location ? { locationEnabled: true, locationText: location } : {}),
    socialsList: buildSocialLinks(links, 'github'),
  };
}

export async function importGithub(input: string, ctx: ImportContext): Promise<ImportedProfile> {
  const login = extractGithubLogin(input);
  if (!login) throw new ImportError('Укажите логин GitHub или ссылку вида github.com/username', 'bad_input');

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'cry-bios-import',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (ctx.githubToken) headers.Authorization = `Bearer ${ctx.githubToken}`;

  const text = await safeFetchText(`https://api.github.com/users/${encodeURIComponent(login)}`, {
    allowHost: (h) => h === 'api.github.com',
    headers,
    fetchImpl: ctx.fetchImpl,
    maxBytes: 256 * 1024,
  });
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ImportError('GitHub вернул неожиданный ответ', 'parse');
  }
  return mapGithubUser(json);
}

