import { buildSocialLinks, cleanImportText } from '../socialDetect';
import { readMetaTags } from '../html';
import { safeFetchText } from '../safeFetch';
import { ImportError, type ImportedProfile } from '../types';
import type { ImportContext } from '../context';
import { LINKTREE_IMAGE_HOSTS } from '../mediaHosts';

const NAME_RE = /^[a-z0-9._-]{1,40}$/i;

export function extractLinktreeName(input: string): string | null {
  const v = input.trim();
  const m = /^(?:https?:\/\/)?(?:www\.)?linktr\.ee\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(v);
  const candidate = (m ? m[1] : v.replace(/^@/, '')).trim();
  return NAME_RE.test(candidate) ? candidate : null;
}

function readNextData(html: string): any | null {
  const m = /<script[^>]*\bid=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

function safeImage(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' && LINKTREE_IMAGE_HOSTS.includes(u.hostname.toLowerCase()) ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function parseLinktreeHtml(html: string, fallbackName = ''): ImportedProfile {
  const data = readNextData(html);
  const pageProps = data?.props?.pageProps ?? {};
  const account = pageProps.account ?? pageProps;

  const linkEntries: Array<{ url: unknown; type?: unknown; label?: unknown }> = [];
  const socials = pageProps.socialLinks ?? account.socialLinks;
  if (Array.isArray(socials)) for (const s of socials) if (s && typeof s === 'object') linkEntries.push({ url: s.url, type: s.type });
  const links = pageProps.links ?? account.links;
  if (Array.isArray(links)) {
    for (const l of links) {
      if (!l || typeof l !== 'object') continue;
      if (String(l.type ?? '').toUpperCase() === 'HEADER' || l.locked === true) continue;
      linkEntries.push({ url: l.url, label: l.title });
    }
  }

  let displayName = cleanImportText(account.pageTitle, 50);
  let bio = cleanImportText(account.description, 300);
  let avatarUrl = safeImage(account.profilePictureUrl);
  const username = cleanImportText(account.username, 40) || fallbackName;

  // Запасной путь: Open Graph, если структура страницы изменилась
  if (!displayName && !bio && linkEntries.length === 0) {
    const meta = readMetaTags(html);
    displayName = cleanImportText((meta['og:title'] ?? '').replace(/\s*[|•-]\s*linktree\s*$/i, '').replace(/^@/, ''), 50);
    bio = cleanImportText(meta['og:description'], 300);
    avatarUrl = avatarUrl ?? safeImage(meta['og:image']);
  }

  const socialsList = buildSocialLinks(linkEntries, 'linktree');
  if (!displayName && !bio && !avatarUrl && socialsList.length === 0) {
    throw new ImportError('Не удалось прочитать страницу Linktree. Вставьте HTML страницы вручную', 'parse');
  }

  return {
    source: 'linktree',
    sourceLabel: 'Linktree',
    sourceUsername: username || undefined,
    displayName: displayName || username || undefined,
    bio: bio || undefined,
    avatarUrl,
    socialsList,
  };
}

export async function importLinktree(input: string, ctx: ImportContext, isHtml: boolean): Promise<ImportedProfile> {
  if (isHtml) return parseLinktreeHtml(input);
  const name = extractLinktreeName(input);
  if (!name) throw new ImportError('Укажите имя вида username или ссылку linktr.ee/username', 'bad_input');

  const html = await safeFetchText(`https://linktr.ee/${encodeURIComponent(name)}`, {
    allowHost: (h) => h === 'linktr.ee',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CRY-BIOS-Import/2.0)', Accept: 'text/html' },
    fetchImpl: ctx.fetchImpl,
  });
  return parseLinktreeHtml(html, name);
}
