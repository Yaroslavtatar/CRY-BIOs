export const DEFAULT_CHUNK_MB = 4;
export const DEFAULT_MAX_BACKUP_MB = 2048;

export function getClientChunkBytes(): number {
  return DEFAULT_CHUNK_MB * 1024 * 1024;
}

export interface ImportJobStatusResponse {
  jobId: string;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: string;
  error?: string;
  userCount?: number;
  uploadCount?: number;
}

export interface ChunkedUploadProgress {
  phase: 'upload' | 'import';
  current: number;
  total: number;
  label: string;
}

function adminHeaders(adminPassword: string): HeadersInit {
  return { 'x-admin-password': encodeURIComponent(adminPassword) };
}

async function parseErrorResponse(res: Response): Promise<string> {
  let message = `HTTP ${res.status}`;
  try {
    const data = await res.json();
    message = data.error || message;
  } catch {
    if (res.status === 404) {
      message =
        'Сервер без chunked import — задеployьте последнюю версию CRY BIOS из main и перезапустите контейнер.';
    } else if (res.status === 502 || res.status === 504) {
      message =
        '502/504 от прокси (Traefik/Cloudflare). Варианты: 1) scp backup.zip → data/incoming/ → «Импорт с сервера»; 2) Cloudflare → DNS only (серое облако) для cbios.ru; 3) обновите Traefik labels (deploy/coolify/LABELS_PASTE.txt).';
    }
  }
  return message;
}

async function fetchWithRetry(
  url: string,
  init: RequestInit,
  retries = 4,
): Promise<Response> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (res.ok || res.status === 400 || res.status === 401 || res.status === 404) {
        return res;
      }
      if (res.status === 502 || res.status === 503 || res.status === 504) {
        lastError = new Error(await parseErrorResponse(res));
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return res;
    } catch (err: any) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
    }
  }
  throw lastError || new Error('Network error');
}

export async function pollImportJob(
  jobId: string,
  adminPassword: string,
  onProgress?: (status: ImportJobStatusResponse) => void,
  intervalMs = 2000,
): Promise<{ userCount: number; uploadCount: number }> {
  while (true) {
    const res = await fetch(`/api/admin/import-full/status/${jobId}`, {
      headers: adminHeaders(adminPassword),
    });
    if (!res.ok) {
      throw new Error(await parseErrorResponse(res));
    }
    const status = (await res.json()) as ImportJobStatusResponse;
    onProgress?.(status);
    if (status.status === 'done') {
      return {
        userCount: status.userCount ?? 0,
        uploadCount: status.uploadCount ?? 0,
      };
    }
    if (status.status === 'error') {
      throw new Error(status.error || 'Import failed');
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

export async function uploadBackupInChunks(
  file: File,
  adminPassword: string,
  onProgress?: (progress: ChunkedUploadProgress) => void,
): Promise<{ userCount: number; uploadCount: number }> {
  const chunkSize = getClientChunkBytes();
  const totalChunks = Math.ceil(file.size / chunkSize);

  onProgress?.({
    phase: 'upload',
    current: 0,
    total: totalChunks,
    label: 'Инициализация загрузки...',
  });

  const initRes = await fetchWithRetry('/api/admin/import-full/init', {
    method: 'POST',
    headers: {
      ...adminHeaders(adminPassword),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      filename: file.name,
      totalSize: file.size,
      totalChunks,
    }),
  });
  if (!initRes.ok) {
    throw new Error(await parseErrorResponse(initRes));
  }
  const initData = await initRes.json();
  const uploadId = initData.uploadId as string;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * chunkSize;
    const end = Math.min(start + chunkSize, file.size);
    const blob = file.slice(start, end);
    const formData = new FormData();
    formData.append('uploadId', uploadId);
    formData.append('index', String(i));
    formData.append('chunk', blob, `chunk-${i}.part`);

    const chunkRes = await fetchWithRetry('/api/admin/import-full/chunk', {
      method: 'POST',
      headers: adminHeaders(adminPassword),
      body: formData,
    });
    if (!chunkRes.ok) {
      throw new Error(await parseErrorResponse(chunkRes));
    }

    onProgress?.({
      phase: 'upload',
      current: i + 1,
      total: totalChunks,
      label: `Загрузка ${i + 1}/${totalChunks}...`,
    });
  }

  onProgress?.({
    phase: 'import',
    current: 0,
    total: 1,
    label: 'Сборка архива и запуск импорта...',
  });

  const finishRes = await fetchWithRetry('/api/admin/import-full/finish', {
    method: 'POST',
    headers: {
      ...adminHeaders(adminPassword),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ uploadId }),
  });
  if (!finishRes.ok) {
    throw new Error(await parseErrorResponse(finishRes));
  }
  const finishData = await finishRes.json();
  const jobId = finishData.jobId as string;

  return pollImportJob(jobId, adminPassword, (status) => {
    onProgress?.({
      phase: 'import',
      current: status.status === 'done' ? 1 : 0,
      total: 1,
      label: status.progress || 'Импорт...',
    });
  });
}

export async function startDiskImport(
  filename: string,
  adminPassword: string,
  onProgress?: (progress: ChunkedUploadProgress) => void,
): Promise<{ userCount: number; uploadCount: number }> {
  onProgress?.({
    phase: 'import',
    current: 0,
    total: 1,
    label: 'Запуск импорта с диска...',
  });

  const res = await fetch('/api/admin/import-full/from-disk', {
    method: 'POST',
    headers: {
      ...adminHeaders(adminPassword),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ filename }),
  });
  if (!res.ok) {
    throw new Error(await parseErrorResponse(res));
  }
  const data = await res.json();
  const jobId = data.jobId as string;

  return pollImportJob(jobId, adminPassword, (status) => {
    onProgress?.({
      phase: 'import',
      current: status.status === 'done' ? 1 : 0,
      total: 1,
      label: status.progress || 'Импорт...',
    });
  });
}
