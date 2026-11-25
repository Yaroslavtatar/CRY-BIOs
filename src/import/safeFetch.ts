import { ImportError } from './types';

export interface SafeFetchOptions {
  /** Точное решение по hostname. Проверяется на каждом шаге редиректа. */
  allowHost: (host: string) => boolean;
  maxBytes?: number;
  timeoutMs?: number;
  maxRedirects?: number;
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

const DEFAULT_MAX_BYTES = 3 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 12_000;

function checkUrl(raw: string, allowHost: SafeFetchOptions['allowHost']): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new ImportError('Некорректная ссылка', 'bad_input');
  }
  const host = u.hostname.toLowerCase();
  if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !allowHost(host)) {
    throw new ImportError('Эта ссылка не поддерживается для импорта', 'blocked');
  }
  return u;
}

async function readCapped(res: Response, maxBytes: number): Promise<string> {
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > maxBytes) throw new ImportError('Страница слишком большая для импорта', 'too_large');

  const reader = res.body?.getReader?.();
  if (!reader) {
    const text = await res.text();
    if (text.length > maxBytes) throw new ImportError('Страница слишком большая для импорта', 'too_large');
    return text;
  }
  const decoder = new TextDecoder();
  let received = 0;
  let out = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new ImportError('Страница слишком большая для импорта', 'too_large');
    }
    out += decoder.decode(value, { stream: true });
  }
  return out + decoder.decode();
}

/**
 * Скачивает текст (HTML/JSON) только с разрешённых https-хостов.
 * Редиректы идут вручную и каждый раз проходят проверку хоста, размер ответа ограничен на лету.
 */
export async function safeFetchText(url: string, opts: SafeFetchOptions): Promise<string> {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const maxRedirects = opts.maxRedirects ?? 3;
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES;
  const signal = AbortSignal.timeout(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  let current = checkUrl(url, opts.allowHost);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    let res: Response;
    try {
      res = await fetchImpl(current.toString(), { redirect: 'manual', signal, headers: opts.headers });
    } catch {
      throw new ImportError('Источник не отвечает. Попробуйте позже', 'upstream');
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location');
      if (!location) throw new ImportError('Источник вернул некорректный редирект', 'upstream');
      current = checkUrl(new URL(location, current).toString(), opts.allowHost);
      continue;
    }
    if (res.status === 404 || res.status === 410) throw new ImportError('Профиль не найден. Проверьте имя', 'not_found');
    if (res.status === 429) throw new ImportError('Источник временно ограничил запросы. Попробуйте позже', 'rate_limited');
    if (res.status === 401 || res.status === 403) throw new ImportError('Источник закрыл доступ для сервера', 'blocked');
    if (!res.ok) throw new ImportError(`Источник ответил ошибкой (HTTP ${res.status})`, 'upstream');

    return readCapped(res, maxBytes);
  }
  throw new ImportError('Слишком много перенаправлений', 'upstream');
}
