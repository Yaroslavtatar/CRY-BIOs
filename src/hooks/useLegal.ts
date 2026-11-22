import { useEffect, useState } from 'react';
import { DEFAULT_LEGAL, normalizeLegal, type LegalSettings } from '../legalConfig';

let cache: LegalSettings | null = null;

/** Юридические данные оператора с сервера; до ответа (и при ошибке) — значения по умолчанию. */
export function useLegal(): LegalSettings {
  const [legal, setLegal] = useState<LegalSettings>(cache ?? DEFAULT_LEGAL);

  useEffect(() => {
    if (cache || typeof fetch !== 'function') return;
    let alive = true;
    fetch('/api/legal')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!data || typeof data !== 'object') return;
        cache = normalizeLegal(data);
        if (alive) setLegal(cache);
      })
      .catch(() => { /* остаются значения по умолчанию */ });
    return () => { alive = false; };
  }, []);

  return legal;
}

/** Только для тестов */
export function resetLegalCache() { cache = null; }
