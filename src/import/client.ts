import type { ImportProviderId } from './catalog';
import type { ImportJobResult } from './types';

export interface RunImportOptions {
  signal?: AbortSignal;
  onProgress?: (label: string, pct: number) => void;
  pollMs?: number;
  /** Сколько ждать результата целиком, мс */
  timeoutMs?: number;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new DOMException('Aborted', 'AbortError'));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });

async function readJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** Запускает импорт на сервере и опрашивает его, пока не будет результат. Бросает Error с понятным текстом. */
export async function runProfileImport(provider: ImportProviderId, input: string, opts: RunImportOptions = {}): Promise<ImportJobResult> {
  const { signal, onProgress, pollMs = 700, timeoutMs = 3 * 60_000 } = opts;

  let start: Response;
  try {
    start = await fetch('/api/import-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, input }),
      signal,
    });
  } catch (e: any) {
    if (e?.name === 'AbortError') throw e;
    throw new Error('Нет связи с сервером');
  }
  const started = await readJson(start);
  if (!start.ok) throw new Error(started.error || 'Не удалось запустить импорт');

  const jobId = String(started.jobId);
  const deadline = Date.now() + timeoutMs;
  let failures = 0;

  while (Date.now() < deadline) {
    await sleep(pollMs, signal);
    let res: Response;
    try {
      res = await fetch(`/api/import-profile/${encodeURIComponent(jobId)}`, { signal });
    } catch (e: any) {
      if (e?.name === 'AbortError') throw e;
      if (++failures >= 4) throw new Error('Потеряна связь с сервером во время импорта');
      continue;
    }
    failures = 0;
    const job = await readJson(res);
    if (!res.ok) throw new Error(job.error || 'Импорт не найден');

    if (job.status === 'done') return job.result as ImportJobResult;
    if (job.status === 'error') throw new Error(job.error || 'Импорт не удался');
    const { current = 0, total = 0, label = '' } = job.progress ?? {};
    onProgress?.(String(label), total ? Math.round((current / total) * 100) : 0);
  }
  throw new Error('Импорт занял слишком много времени. Попробуйте ещё раз');
}
