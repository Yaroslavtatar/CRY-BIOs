import { parseGunsLolHtml } from './gunsImportMap';
import { fetchViaEdge, getEdgeUrl } from './edgeAuth';

export type ImportSource = 'guns_url' | 'guns_html' | 'unknown';

const GUNS_URL_RE = /^https?:\/\/(?:www\.)?guns\.lol\/([a-z0-9_-]+)\/?$/i;

export function detectImportSource(input: string): { source: ImportSource; username?: string } {
  const trimmed = input.trim();
  if (!trimmed) return { source: 'unknown' };

  const urlMatch = trimmed.match(GUNS_URL_RE);
  if (urlMatch) {
    return { source: 'guns_url', username: urlMatch[1].toLowerCase() };
  }

  if (trimmed.includes('<html') || trimmed.includes('__NEXT_DATA__') || trimmed.includes('guns.lol')) {
    return { source: 'guns_html' };
  }

  return { source: 'unknown' };
}

export async function fetchGunsHtml(input: string): Promise<{ html: string; username?: string }> {
  const detected = detectImportSource(input);

  if (detected.source === 'guns_html') {
    return { html: input.trim() };
  }

  if (detected.source === 'guns_url' && detected.username) {
    const direct = await fetch(`https://guns.lol/${detected.username}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CRY-BIOS/1.0)',
        Accept: 'text/html',
      },
    });
    if (direct.ok) {
      return { html: await direct.text(), username: detected.username };
    }

    const edgeUrl = getEdgeUrl();
    if (edgeUrl) {
      const res = await fetchViaEdge(`/guns/fetch/${detected.username}`);
      const data = await res.json() as { success?: boolean; html?: string; error?: string };
      if (res.ok && data.html) {
        return { html: data.html, username: detected.username };
      }
    }

    throw new Error(
      `guns.lol HTTP ${direct.status}. Вставьте HTML страницы вручную (Ctrl+U → Copy).`,
    );
  }

  throw new Error('Вставьте ссылку https://guns.lol/username или HTML страницы (Ctrl+U → Copy).');
}

export async function parseImportInput(input: string) {
  const { html, username } = await fetchGunsHtml(input);
  return parseGunsLolHtml(html, username);
}
