import { parseGunsLolHtml } from '../../gunsImportMap';
import { fetchViaEdge, getEdgeUrl } from '../../edgeAuth';
import { safeFetchText } from '../safeFetch';
import { ImportError, type ImportedProfile } from '../types';
import type { ImportContext } from '../context';

const NAME_RE = /^[a-z0-9_-]{1,32}$/i;

export function extractGunsName(input: string): string | null {
  const v = input.trim();
  const m = /^(?:https?:\/\/)?(?:www\.)?guns\.lol\/([^/?#\s]+)\/?(?:[?#].*)?$/i.exec(v);
  const candidate = (m ? m[1] : v.replace(/^@/, '')).trim();
  return NAME_RE.test(candidate) ? candidate.toLowerCase() : null;
}

export function mapGunsHtml(html: string, name?: string): ImportedProfile {
  const { verified: _ignored, ...parsed } = parseGunsLolHtml(html, name ?? '');
  return { ...parsed, source: 'guns', sourceLabel: 'guns.lol', sourceUsername: name };
}

async function fetchGunsPage(name: string, ctx: ImportContext): Promise<string> {
  try {
    return await safeFetchText(`https://guns.lol/${name}`, {
      allowHost: (h) => h === 'guns.lol' || h === 'www.guns.lol',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CRY-BIOS/2.0)', Accept: 'text/html' },
      fetchImpl: ctx.fetchImpl,
    });
  } catch (err) {
    // guns.lol часто закрыт для датацентров. Если настроен edge-воркер, пробуем через него.
    if (err instanceof ImportError && err.code === 'not_found') throw err;
    if (getEdgeUrl()) {
      try {
        const res = await fetchViaEdge(`/guns/fetch/${name}`);
        const data = (await res.json()) as { html?: string };
        if (res.ok && typeof data.html === 'string' && data.html) return data.html;
      } catch {
        /* сообщим об исходной ошибке */
      }
    }
    if (err instanceof ImportError && (err.code === 'blocked' || err.code === 'upstream' || err.code === 'rate_limited')) {
      throw new ImportError(`${err.message}. Откройте страницу в браузере и вставьте её HTML вручную`, err.code);
    }
    throw err;
  }
}

export async function importGuns(input: string, ctx: ImportContext, isHtml: boolean): Promise<ImportedProfile> {
  if (isHtml) return mapGunsHtml(input);
  const name = extractGunsName(input);
  if (!name) throw new ImportError('Укажите имя вида username или ссылку guns.lol/username', 'bad_input');
  return mapGunsHtml(await fetchGunsPage(name, ctx), name);
}
