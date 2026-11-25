import { buildSocialLinks, cleanImportText } from '../socialDetect';
import { readMetaTags } from '../html';
import { safeFetchText } from '../safeFetch';
import { ImportError, type ImportedProfile } from '../types';
import type { ImportContext } from '../context';
import { TELEGRAM_CDN_HOST_RE } from '../mediaHosts';

const USERNAME_RE = /^[a-z][a-z0-9_]{4,31}$/i;

export function extractTelegramUsername(input: string): string | null {
  const v = input.trim();
  const m = /^(?:https?:\/\/)?(?:www\.)?(?:t\.me|telegram\.me)\/(?:s\/)?([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(v);
  const candidate = (m ? m[1] : v.replace(/^@/, '')).trim();
  return USERNAME_RE.test(candidate) ? candidate : null;
}

export function parseTelegramHtml(html: string, username: string): ImportedProfile {
  const meta = readMetaTags(html);
  const title = cleanImportText(meta['og:title'], 64);
  const description = cleanImportText(meta['og:description'], 300);
  const image = meta['og:image'];

  // У закрытых профилей и несуществующих имён Telegram отдаёт заглушку «Telegram: Contact @name»
  const isStub = !title || /^telegram\s*:/i.test(title) || /^you can contact @/i.test(description);
  const notes: string[] = [];
  const profile: ImportedProfile = {
    source: 'telegram',
    sourceLabel: 'Telegram',
    sourceUsername: username,
    socialsList: buildSocialLinks([{ url: `https://t.me/${username}`, type: 'telegram' }], 'telegram'),
  };

  if (isStub) {
    notes.push('У этого аккаунта нет публичного профиля, поэтому добавлена только ссылка на Telegram.');
  } else {
    profile.displayName = title;
    if (description) profile.bio = description;
    if (image) {
      try {
        const u = new URL(image);
        if (u.protocol === 'https:' && TELEGRAM_CDN_HOST_RE.test(u.hostname)) profile.avatarUrl = u.toString();
      } catch {
        /* аватар необязателен */
      }
    }
  }
  if (notes.length) profile.notes = notes;
  return profile;
}

export async function importTelegram(input: string, ctx: ImportContext): Promise<ImportedProfile> {
  const username = extractTelegramUsername(input);
  if (!username) throw new ImportError('Укажите имя вида @username (от 5 символов) или ссылку t.me/username', 'bad_input');

  const html = await safeFetchText(`https://t.me/${username}`, {
    allowHost: (h) => h === 't.me',
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CRY-BIOS-Import/2.0)', Accept: 'text/html' },
    fetchImpl: ctx.fetchImpl,
    maxBytes: 1024 * 1024,
  });
  return parseTelegramHtml(html, username);
}
