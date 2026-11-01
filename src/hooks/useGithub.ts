import { useEffect, useState } from 'react';
import type { GithubSnapshot } from '../github';

export type GithubState =
  | { status: 'loading' }
  | { status: 'ready'; data: GithubSnapshot; stale: boolean; fetchedAt: string }
  | { status: 'unavailable' }
  | { status: 'disabled' };

/** Данные репозитория с нашего сервера (/api/github). Сам GitHub из браузера не дёргаем. */
export function useGithub(): GithubState {
  const [state, setState] = useState<GithubState>({ status: 'loading' });

  useEffect(() => {
    const ctrl = new AbortController();
    fetch('/api/github', { signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (body && body.enabled === false) return setState({ status: 'disabled' });
        if (!res.ok || !body?.data?.repo) return setState({ status: 'unavailable' });
        setState({ status: 'ready', data: body.data, stale: !!body.stale, fetchedAt: String(body.fetchedAt || '') });
      })
      .catch((err) => {
        if (err?.name !== 'AbortError') setState({ status: 'unavailable' });
      });
    return () => ctrl.abort();
  }, []);

  return state;
}
