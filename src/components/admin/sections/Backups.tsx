import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, Download, Upload, FileJson, HardDrive, Trash2, Play, RefreshCw, AlertTriangle } from 'lucide-react';
import { previewBackupZipClient } from '../../../utils/backupPreviewClient';
import { uploadBackupInChunks, startDiskImport, type ChunkedUploadProgress } from '../../../utils/chunkedUpload';
import { Badge, Button, Card, EmptyState, Modal, PageHeader, ProgressBar, Select, Toggle } from '../ui';
import { formatBytes, formatDateTime } from '../adminApi';
import type { SectionProps } from './types';

interface FileRow { filename: string; size: number; mtime: string }
interface Preview { version?: number; exportedAt?: string; userCount?: number; uploadCount?: number; includeAnalytics?: boolean }

export default function Backups({ api, notify }: SectionProps) {
  const [includeAnalytics, setIncludeAnalytics] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<ChunkedUploadProgress | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [serverBackups, setServerBackups] = useState<FileRow[]>([]);
  const [incoming, setIncoming] = useState<FileRow[]>([]);
  const [selectedIncoming, setSelectedIncoming] = useState('');
  const zipRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const loadLists = useCallback(async () => {
    try {
      const [b, i] = await Promise.all([api.get('/api/admin/backups'), api.get('/api/admin/import-full/incoming')]);
      setServerBackups(b.files || []);
      setIncoming(i.files || []);
      setSelectedIncoming((cur) => cur || i.files?.[0]?.filename || '');
    } catch (e: any) {
      notify('error', e.message);
    }
  }, [api, notify]);

  useEffect(() => { loadLists(); }, [loadLists]);

  const analyticsQuery = includeAnalytics ? '' : '?includeAnalytics=false';

  const guard = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { notify('error', e.message); } finally { setBusy(null); setProgress(null); }
  };

  const exportFull = () => guard('export-full', async () => {
    await api.download(`/api/admin/export-full${analyticsQuery}`, `cry_bios_full_backup_${Date.now()}.zip`);
    notify('success', 'Полный ZIP-бэкап скачан');
  });

  const exportJson = () => guard('export-json', async () => {
    const dump = await api.get(`/api/admin/export-db${analyticsQuery}`);
    const url = URL.createObjectURL(new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cry_bios_database_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('success', 'JSON-экспорт базы выполнен');
  });

  const onZipPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPreview(await previewBackupZipClient(file));
      setPendingFile(file);
    } catch (err: any) {
      notify('error', 'Ошибка предпросмотра: ' + (err.message || 'некорректный формат'));
    }
  };

  const confirmZipImport = () => guard('import-full', async () => {
    if (!pendingFile) return;
    const r = await uploadBackupInChunks(pendingFile, api.password, setProgress);
    notify('success', `Бэкап восстановлен. Пользователей: ${r.userCount}, файлов: ${r.uploadCount}`);
    setPreview(null);
    setPendingFile(null);
    loadLists();
  });

  const importFromDisk = () => guard('import-disk', async () => {
    if (!selectedIncoming) return;
    if (!window.confirm(`Импортировать ${selectedIncoming} с сервера? Текущие данные будут перезаписаны.`)) return;
    const r = await startDiskImport(selectedIncoming, api.password, setProgress);
    notify('success', `Бэкап восстановлен с диска. Пользователей: ${r.userCount}, файлов: ${r.uploadCount}`);
    loadLists();
  });

  const onJsonPicked = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!window.confirm('Импорт JSON полностью перезапишет пользователей, страницы и аналитику. Продолжить?')) return;
    file.text().then((text) => guard('import-json', async () => {
      await api.send('POST', '/api/admin/import-db', { dump: JSON.parse(text) });
      notify('success', 'База данных импортирована');
    })).catch((err) => notify('error', err.message));
  };

  const runNow = () => guard('run', async () => {
    const r = await api.send('POST', '/api/admin/backups/run');
    notify('success', `Создан ${r.filename} (${formatBytes(r.size)})`);
    loadLists();
  });

  const removeBackup = (name: string) => {
    if (!window.confirm(`Удалить ${name} с сервера?`)) return;
    guard(`del-${name}`, async () => {
      await api.send('DELETE', `/api/admin/backups/${encodeURIComponent(name)}`);
      notify('success', `${name} удалён`);
      loadLists();
    });
  };

  const pct = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <>
      <PageHeader title="Бэкапы" description="Полные копии базы и медиафайлов, восстановление и резервные копии на диске сервера." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Экспорт" description="Скачать данные платформы на свой компьютер.">
          <Toggle checked={includeAnalytics} onChange={setIncludeAnalytics} label="Включить аналитику" description="Увеличивает размер бэкапа, но сохраняет историю визитов." />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Button variant="primary" onClick={exportFull} loading={busy === 'export-full'} icon={<Archive className="h-4 w-4" />}>Полный ZIP (БД + медиа)</Button>
            <Button onClick={exportJson} loading={busy === 'export-json'} icon={<FileJson className="h-4 w-4" />}>Только БД (JSON)</Button>
          </div>
        </Card>

        <Card title="Восстановление" description="Импорт перезаписывает текущие данные. Все сессии пользователей будут сброшены.">
          <div className="grid gap-2 sm:grid-cols-2">
            <Button onClick={() => zipRef.current?.click()} loading={busy === 'import-full'} icon={<Upload className="h-4 w-4" />}>Загрузить ZIP</Button>
            <Button onClick={() => jsonRef.current?.click()} loading={busy === 'import-json'} icon={<Upload className="h-4 w-4" />}>Загрузить JSON</Button>
          </div>
          <div className="mt-4 border-t border-white/[0.07] pt-4">
            <p className="mb-2 text-xs text-neutral-400">Большие бэкапы можно положить в каталог <code className="text-neutral-200">data/incoming</code> на сервере и импортировать оттуда.</p>
            <div className="flex gap-2">
              <Select value={selectedIncoming} onChange={(e) => setSelectedIncoming(e.target.value)} disabled={incoming.length === 0} aria-label="Файл на сервере">
                {incoming.length === 0 && <option value="">Файлов нет</option>}
                {incoming.map((f) => <option key={f.filename} value={f.filename}>{f.filename} · {formatBytes(f.size)}</option>)}
              </Select>
              <Button onClick={importFromDisk} loading={busy === 'import-disk'} disabled={!selectedIncoming} icon={<HardDrive className="h-4 w-4" />}>Импорт</Button>
            </div>
            {busy === 'import-disk' && progress && (
              <div className="mt-3 space-y-1.5"><p className="text-xs text-[#00f2ff]">{progress.label}</p></div>
            )}
          </div>
        </Card>
      </div>

      <Card
        className="mt-4"
        title="Бэкапы на сервере"
        description="Плановые копии создаются автоматически (по умолчанию раз в сутки, хранится несколько последних)."
        actions={<>
          <Button size="sm" onClick={loadLists} icon={<RefreshCw className="h-3.5 w-3.5" />} aria-label="Обновить" />
          <Button size="sm" variant="primary" onClick={runNow} loading={busy === 'run'} icon={<Play className="h-3.5 w-3.5" />}>Создать сейчас</Button>
        </>}
      >
        {serverBackups.length === 0 ? <EmptyState>Бэкапов на сервере пока нет.</EmptyState> : (
          <ul className="divide-y divide-white/[0.06]">
            {serverBackups.map((f) => (
              <li key={f.filename} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <div className="truncate text-sm text-neutral-100">{f.filename}</div>
                  <div className="text-xs text-neutral-500">{formatDateTime(f.mtime)} · {formatBytes(f.size)}</div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => guard(`dl-${f.filename}`, () => api.download(`/api/admin/backups/${encodeURIComponent(f.filename)}`, f.filename))} icon={<Download className="h-3.5 w-3.5" />}>Скачать</Button>
                  <Button size="sm" variant="danger" onClick={() => removeBackup(f.filename)} icon={<Trash2 className="h-3.5 w-3.5" />} aria-label={`Удалить ${f.filename}`} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <input ref={zipRef} type="file" accept=".zip,application/zip" className="hidden" onChange={onZipPicked} />
      <input ref={jsonRef} type="file" accept=".json,application/json" className="hidden" onChange={onJsonPicked} />

      <Modal
        open={!!preview}
        title="Предпросмотр бэкапа"
        onClose={() => busy !== 'import-full' && (setPreview(null), setPendingFile(null))}
        footer={<>
          <Button variant="ghost" disabled={busy === 'import-full'} onClick={() => { setPreview(null); setPendingFile(null); }}>Отмена</Button>
          <Button variant="danger" loading={busy === 'import-full'} onClick={confirmZipImport}>Восстановить</Button>
        </>}
      >
        {preview && (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div><dt className="text-[11px] text-neutral-500">Пользователей</dt><dd>{preview.userCount ?? '?'}</dd></div>
              <div><dt className="text-[11px] text-neutral-500">Файлов</dt><dd>{preview.uploadCount ?? '?'}</dd></div>
              <div><dt className="text-[11px] text-neutral-500">Создан</dt><dd>{preview.exportedAt ? formatDateTime(preview.exportedAt) : '?'}</dd></div>
              <div><dt className="text-[11px] text-neutral-500">Аналитика</dt><dd>{preview.includeAnalytics ? <Badge tone="success">есть</Badge> : <Badge>нет</Badge>}</dd></div>
            </dl>
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.06] p-3 text-xs text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              Импорт перезапишет всю базу данных и каталог uploads. Сначала скачайте текущий бэкап.
            </div>
            {busy === 'import-full' && progress && (
              <div className="space-y-2"><p className="text-xs text-[#00f2ff]">{progress.label}</p>{progress.phase === 'upload' && <ProgressBar value={pct} />}</div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
