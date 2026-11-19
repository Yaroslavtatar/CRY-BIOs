import { useMemo } from 'react';

export class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export interface AdminApi {
  get<T = any>(path: string): Promise<T>;
  send<T = any>(method: 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T>;
  download(path: string, filename: string): Promise<void>;
  password: string;
}

/** Админ-пароль живёт только в памяти вкладки и уходит в заголовке x-admin-password. */
export function createAdminApi(password: string): AdminApi {
  const headers = (json = false): Record<string, string> => ({
    'x-admin-password': encodeURIComponent(password),
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  });

  async function parse(res: Response) {
    let data: any = null;
    try {
      data = await res.json();
    } catch {
      /* пустой ответ */
    }
    if (!res.ok) throw new AdminApiError(data?.error || `Ошибка запроса (HTTP ${res.status})`, res.status);
    return data;
  }

  return {
    password,
    get: async (path) => parse(await fetch(path, { headers: headers() })),
    send: async (method, path, body) =>
      parse(await fetch(path, { method, headers: headers(body !== undefined), body: body !== undefined ? JSON.stringify(body) : undefined })),
    download: async (path, filename) => {
      const res = await fetch(path, { headers: headers() });
      if (!res.ok) await parse(res);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    },
  };
}

export function useAdminApi(password: string): AdminApi {
  return useMemo(() => createAdminApi(password), [password]);
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(2)} ГБ`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} МБ`;
  return `${Math.max(0, Math.round(bytes / 1024))} КБ`;
}

export function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d > 0) return `${d} д ${h} ч`;
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
}
