const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, body: string) => {
    if (body[0] === '#') {
      const code = body[1].toLowerCase() === 'x' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m;
    }
    return NAMED[body.toLowerCase()] ?? m;
  });
}

/** Значения <meta property|name="..." content="..."> в нижнем регистре ключей. */
export function readMetaTags(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  const tagRe = /<meta\b[^>]*>/gi;
  for (const tag of html.match(tagRe) ?? []) {
    const key = /(?:property|name)\s*=\s*"([^"]+)"/i.exec(tag)?.[1] ?? /(?:property|name)\s*=\s*'([^']+)'/i.exec(tag)?.[1];
    const content = /content\s*=\s*"([^"]*)"/i.exec(tag)?.[1] ?? /content\s*=\s*'([^']*)'/i.exec(tag)?.[1];
    if (key && content !== undefined && !(key.toLowerCase() in out)) out[key.toLowerCase()] = decodeEntities(content);
  }
  return out;
}

export function looksLikeHtml(input: string): boolean {
  return /<\s*(?:!doctype|html|head|body|script|meta|div)\b/i.test(input) || input.includes('__NEXT_DATA__');
}
