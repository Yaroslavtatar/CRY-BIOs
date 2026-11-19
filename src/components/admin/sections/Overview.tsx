import React, { useCallback, useEffect, useState } from 'react';
import { Users, Eye, Activity, HardDrive, Database, ShieldAlert, Cpu, Clock, RefreshCw, Layout, Server as ServerIcon } from 'lucide-react';
import { Badge, Button, Card, PageHeader, ProgressBar, StatCard } from '../ui';
import { formatBytes, formatDateTime, formatUptime } from '../adminApi';
import type { SectionProps, SiteSettings } from './types';

interface Overview {
  counts: {
    users: number; banned: number; bios: number; visitsTotal: number; visits24h: number; visits7d: number;
    topProfiles: { username: string; visits: number }[];
  };
  system: {
    nodeVersion: string; platform: string; uptimeSec: number; env: string; rssMb: number; heapUsedMb: number; heapTotalMb: number;
    loadAvg: number[]; cpuCount: number; systemTotalMemMb: number; systemFreeMemMb: number; disk: { totalGb: number; freeGb: number } | null;
  };
  storage: { uploadsBytes: number; uploadsFiles: number; dbBytes: number; lastBackupAt: string | null; lastBackupSize?: number | null };
  health: { status: 'ok' | 'degraded' | 'error'; checks: Record<string, boolean> };
  settings: SiteSettings;
}

const CHECK_LABELS: Record<string, string> = {
  sqlite: 'SQLite отвечает',
  dataDir: 'Каталог data доступен для записи',
  dbFile: 'Файл базы данных найден',
  uploadsDir: 'Каталог uploads найден',
};

export default function Overview({ api, notify, goTo }: SectionProps & { goTo: (page: string) => void }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await api.get<Overview>('/api/admin/overview'));
    } catch (e: any) {
      notify('error', e.message);
    } finally {
      setLoading(false);
    }
  }, [api, notify]);

  useEffect(() => {
    load();
    const t = setInterval(load, 30000);
    return () => clearInterval(t);
  }, [load]);

  const memPct = data ? Math.round(((data.system.systemTotalMemMb - data.system.systemFreeMemMb) / data.system.systemTotalMemMb) * 100) : 0;
  const diskPct = data?.system.disk ? Math.round(((data.system.disk.totalGb - data.system.disk.freeGb) / data.system.disk.totalGb) * 100) : 0;

  return (
    <>
      <PageHeader
        title="Обзор"
        description="Состояние сервера и платформы. Данные обновляются каждые 30 секунд."
        actions={<Button size="sm" onClick={load} loading={loading} icon={<RefreshCw className="h-3.5 w-3.5" />}>Обновить</Button>}
      />

      {data && (data.settings.maintenanceMode || !data.settings.registrationOpen) && (
        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-sm text-amber-200">
          <ShieldAlert className="h-4 w-4" />
          {data.settings.maintenanceMode && <span>Включён режим обслуживания.</span>}
          {!data.settings.registrationOpen && <span>Регистрация закрыта.</span>}
          <button onClick={() => goTo('server')} className="ml-auto text-xs underline underline-offset-2 hover:text-white cursor-pointer">Изменить</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Пользователей" value={data?.counts.users ?? '—'} hint={data ? `заблокировано: ${data.counts.banned}` : undefined} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Визитов за 24 ч" value={data?.counts.visits24h ?? '—'} hint={data ? `за 7 дней: ${data.counts.visits7d}` : undefined} icon={<Eye className="h-4 w-4" />} tone="success" />
        <StatCard label="Всего визитов" value={data?.counts.visitsTotal ?? '—'} hint={data ? `страниц: ${data.counts.bios}` : undefined} icon={<Activity className="h-4 w-4" />} />
        <StatCard label="Аптайм" value={data ? formatUptime(data.system.uptimeSec) : '—'} hint={data ? `${data.system.nodeVersion} · ${data.system.env}` : undefined} icon={<Clock className="h-4 w-4" />} tone="warning" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Ресурсы сервера" className="lg:col-span-2">
          {data ? (
            <div className="space-y-5">
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5"><Cpu className="h-3.5 w-3.5" /> Память системы</span>
                  <span>{data.system.systemTotalMemMb - data.system.systemFreeMemMb} / {data.system.systemTotalMemMb} МБ</span>
                </div>
                <ProgressBar value={memPct} tone={memPct > 90 ? 'danger' : memPct > 75 ? 'warning' : 'accent'} />
              </div>
              <div>
                <div className="mb-1.5 flex justify-between text-xs text-neutral-400">
                  <span className="flex items-center gap-1.5"><HardDrive className="h-3.5 w-3.5" /> Диск с данными</span>
                  <span>{data.system.disk ? `свободно ${data.system.disk.freeGb} из ${data.system.disk.totalGb} ГБ` : 'недоступно'}</span>
                </div>
                <ProgressBar value={diskPct} tone={diskPct > 90 ? 'danger' : diskPct > 75 ? 'warning' : 'accent'} />
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
                <div><dt className="text-[11px] text-neutral-500">Процесс (RSS)</dt><dd className="text-neutral-100">{data.system.rssMb} МБ</dd></div>
                <div><dt className="text-[11px] text-neutral-500">Heap</dt><dd className="text-neutral-100">{data.system.heapUsedMb} / {data.system.heapTotalMb} МБ</dd></div>
                <div><dt className="text-[11px] text-neutral-500">Нагрузка (1/5/15)</dt><dd className="text-neutral-100">{data.system.loadAvg.join(' · ')}</dd></div>
                <div><dt className="text-[11px] text-neutral-500">Ядер CPU</dt><dd className="text-neutral-100">{data.system.cpuCount}</dd></div>
              </dl>
            </div>
          ) : <div className="h-32 animate-pulse rounded-xl bg-white/[0.03]" />}
        </Card>

        <Card title="Проверка здоровья" actions={data && <Badge tone={data.health.status === 'ok' ? 'success' : data.health.status === 'degraded' ? 'warning' : 'danger'}>{data.health.status === 'ok' ? 'Всё в порядке' : data.health.status === 'degraded' ? 'Есть проблемы' : 'Ошибка'}</Badge>}>
          <ul className="space-y-2.5">
            {data && Object.entries(data.health.checks).map(([k, ok]) => (
              <li key={k} className="flex items-center gap-2.5 text-sm">
                <span className={`h-2 w-2 rounded-full ${ok ? 'bg-emerald-400' : 'bg-red-400'}`} />
                <span className="text-neutral-200">{CHECK_LABELS[k] ?? k}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card title="Хранилище">
          {data && (
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between"><dt className="flex items-center gap-2 text-neutral-400"><HardDrive className="h-4 w-4" />Загрузки</dt><dd>{formatBytes(data.storage.uploadsBytes)} · {data.storage.uploadsFiles} файлов</dd></div>
              <div className="flex justify-between"><dt className="flex items-center gap-2 text-neutral-400"><Database className="h-4 w-4" />База данных</dt><dd>{formatBytes(data.storage.dbBytes)}</dd></div>
              <div className="flex justify-between"><dt className="text-neutral-400">Последний бэкап</dt><dd>{formatDateTime(data.storage.lastBackupAt)}</dd></div>
            </dl>
          )}
        </Card>

        <Card title="Топ профилей по визитам">
          {data && data.counts.topProfiles.length > 0 ? (
            <ol className="space-y-2">
              {data.counts.topProfiles.map((p, i) => (
                <li key={p.username} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2.5"><span className="w-4 text-xs text-neutral-500">{i + 1}</span><a href={`/${p.username}`} target="_blank" rel="noopener noreferrer" className="text-neutral-100 hover:text-[#00f2ff]">@{p.username}</a></span>
                  <span className="tabular-nums text-neutral-400">{p.visits}</span>
                </li>
              ))}
            </ol>
          ) : <p className="text-sm text-neutral-500">Пока нет данных о визитах.</p>}
        </Card>

        <Card title="Быстрые действия">
          <div className="grid gap-2">
            <Button onClick={() => goTo('home')} icon={<Layout className="h-4 w-4" />} variant="primary">Конструктор главной</Button>
            <Button onClick={() => goTo('users')} icon={<Users className="h-4 w-4" />}>Пользователи</Button>
            <Button onClick={() => goTo('server')} icon={<ServerIcon className="h-4 w-4" />}>Управление сервером</Button>
          </div>
        </Card>
      </div>
    </>
  );
}
