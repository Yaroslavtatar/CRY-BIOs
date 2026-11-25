import crypto from 'crypto';
import { ImportError, type ImportErrorCode, type ImportJobResult } from './types';

export interface ImportJobSnapshot {
  status: 'running' | 'done' | 'error';
  progress: { current: number; total: number; label: string };
  result?: ImportJobResult;
  error?: string;
  errorCode?: ImportErrorCode;
}

interface Job extends ImportJobSnapshot {
  username: string;
}

export interface ImportJobsOptions {
  /** Сколько хранить готовый результат, мс */
  ttlMs?: number;
  idGen?: () => string;
}

/**
 * Фоновые задачи импорта. Клиент получает прогресс обычным опросом: SSE за прокси часто буферизуется,
 * а опрос работает везде. У одного пользователя может идти только один импорт.
 */
export class ImportJobs {
  private readonly jobs = new Map<string, Job>();
  private readonly ttlMs: number;
  private readonly idGen: () => string;

  constructor(opts: ImportJobsOptions = {}) {
    this.ttlMs = opts.ttlMs ?? 15 * 60_000;
    this.idGen = opts.idGen ?? (() => crypto.randomUUID());
  }

  start(username: string, task: (report: (p: ImportJobSnapshot['progress']) => void) => Promise<ImportJobResult>): string {
    for (const j of this.jobs.values()) {
      if (j.username === username && j.status === 'running') {
        throw new ImportError('Предыдущий импорт ещё идёт. Дождитесь его окончания', 'busy');
      }
    }
    const id = this.idGen();
    const job: Job = { username, status: 'running', progress: { current: 0, total: 0, label: 'Запуск…' } };
    this.jobs.set(id, job);

    task((p) => { job.progress = p; })
      .then((result) => { job.status = 'done'; job.result = result; })
      .catch((err: unknown) => {
        job.status = 'error';
        if (err instanceof ImportError) {
          job.error = err.message;
          job.errorCode = err.code;
        } else {
          console.error('[import] unexpected failure', err);
          job.error = 'Не удалось выполнить импорт. Попробуйте ещё раз';
          job.errorCode = 'upstream';
        }
      })
      .finally(() => {
        const timer = setTimeout(() => this.jobs.delete(id), this.ttlMs);
        timer.unref?.();
      });
    return id;
  }

  /** Задача видна только тому, кто её запустил. */
  get(id: string, username: string): ImportJobSnapshot | null {
    const job = this.jobs.get(id);
    if (!job || job.username !== username) return null;
    const { username: _u, ...snapshot } = job;
    return snapshot;
  }
}
