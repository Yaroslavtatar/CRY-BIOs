import { describe, it, expect, vi, afterEach } from 'vitest';
import { runProfileImport } from '../src/import/client';

type Reply = { status?: number; json: unknown } | Error;

/** Ответы выдаются по очереди для каждого вызова fetch; Error имитирует обрыв сети. */
function mockFetch(replies: Reply[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    calls.push({ url, init });
    const r = replies.shift();
    if (!r) throw new Error(`unexpected fetch ${url}`);
    if (r instanceof Error) throw r;
    const status = r.status ?? 200;
    return { ok: status < 400, status, json: async () => r.json } as Response;
  }));
  return calls;
}

afterEach(() => vi.unstubAllGlobals());

describe('runProfileImport', () => {
  const profile = { profile: { source: 'github', sourceLabel: 'GitHub', displayName: 'Octo' }, warnings: [] };

  it('запускает задачу, опрашивает прогресс и возвращает результат', async () => {
    const calls = mockFetch([
      { status: 202, json: { jobId: 'job 1' } },
      { json: { status: 'running', progress: { current: 1, total: 4, label: 'Сохраняю аватар (1/4)…' } } },
      { json: { status: 'done', progress: { current: 4, total: 4, label: '' }, result: profile } },
    ]);
    const progress: Array<[string, number]> = [];
    const r = await runProfileImport('github', 'octocat', { pollMs: 0, onProgress: (l, p) => progress.push([l, p]) });
    expect(r).toEqual(profile);
    expect(progress).toEqual([['Сохраняю аватар (1/4)…', 25]]);
    expect(calls[0].url).toBe('/api/import-profile');
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ provider: 'github', input: 'octocat' });
    expect(calls[1].url).toBe('/api/import-profile/job%201');
  });

  it('показывает текст ошибки, с которой сервер отказал запустить импорт', async () => {
    mockFetch([{ status: 409, json: { error: 'Предыдущий импорт ещё идёт' } }]);
    await expect(runProfileImport('github', 'x', { pollMs: 0 })).rejects.toThrow('Предыдущий импорт ещё идёт');
  });

  it('показывает ошибку, на которой остановилась задача', async () => {
    mockFetch([{ status: 202, json: { jobId: 'j' } }, { json: { status: 'error', error: 'Профиль не найден. Проверьте имя' } }]);
    await expect(runProfileImport('github', 'x', { pollMs: 0 })).rejects.toThrow('Профиль не найден. Проверьте имя');
  });

  it('переживает разовый обрыв при опросе, но не четыре подряд', async () => {
    mockFetch([
      { status: 202, json: { jobId: 'j' } },
      new TypeError('net'),
      { json: { status: 'done', result: profile } },
    ]);
    await expect(runProfileImport('github', 'x', { pollMs: 0 })).resolves.toEqual(profile);

    mockFetch([{ status: 202, json: { jobId: 'j' } }, new TypeError('1'), new TypeError('2'), new TypeError('3'), new TypeError('4')]);
    await expect(runProfileImport('github', 'x', { pollMs: 0 })).rejects.toThrow(/Потеряна связь/);
  });

  it('сообщает, если сервера нет на связи при запуске', async () => {
    mockFetch([new TypeError('offline')]);
    await expect(runProfileImport('github', 'x', { pollMs: 0 })).rejects.toThrow('Нет связи с сервером');
  });

  it('прекращает ожидание по отмене', async () => {
    const ctrl = new AbortController();
    mockFetch([{ status: 202, json: { jobId: 'j' } }]);
    const p = runProfileImport('github', 'x', { pollMs: 50, signal: ctrl.signal });
    ctrl.abort();
    await expect(p).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('не ждёт бесконечно', async () => {
    const running = { json: { status: 'running', progress: { current: 0, total: 0, label: '' } } };
    mockFetch([{ status: 202, json: { jobId: 'j' } }, ...Array.from({ length: 200 }, () => running)]);
    await expect(runProfileImport('github', 'x', { pollMs: 1, timeoutMs: 30 })).rejects.toThrow(/слишком много времени/);
  });
});
