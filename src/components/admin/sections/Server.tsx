import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, Trash2, Zap, Eraser, KeyRound, ScrollText, History } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, PageHeader, Select, TextArea, TextInput, Toggle, cx } from '../ui';
import { formatDateTime } from '../adminApi';
import type { SectionProps, SiteSettings } from './types';

interface LogEntry { ts: string; level: 'log' | 'info' | 'warn' | 'error'; message: string }
interface AuditEntry { ts: string; ip: string; action: string }

const LEVEL_TONE: Record<string, string> = { error: 'text-red-300', warn: 'text-amber-300', info: 'text-sky-300', log: 'text-neutral-300' };

export default function Server({ api, notify }: SectionProps) {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [logLevel, setLogLevel] = useState('all');
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [tab, setTab] = useState<'logs' | 'audit'>('logs');

  const loadSettings = useCallback(async () => {
    try {
      const s = await api.get<SiteSettings>('/api/admin/status');
      setSettings(s);
      setMessage(s.maintenanceMessage);
    } catch (e: any) { notify('error', e.message); }
  }, [api, notify]);

  const loadLogs = useCallback(async () => {
    try { setLogs((await api.get(`/api/admin/logs?level=${logLevel}&limit=200`)).entries); }
    catch (e: any) { notify('error', e.message); }
  }, [api, notify, logLevel]);

  const loadAudit = useCallback(async () => {
    try { setAudit((await api.get('/api/admin/audit?limit=100')).entries); }
    catch (e: any) { notify('error', e.message); }
  }, [api, notify]);

  useEffect(() => { loadSettings(); }, [loadSettings]);
  useEffect(() => { loadLogs(); }, [loadLogs]);
  useEffect(() => { loadAudit(); }, [loadAudit]);

  const guard = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e: any) { notify('error', e.message); } finally { setBusy(null); }
  };

  const patch = (key: string, body: Partial<SiteSettings>, okText: string) =>
    guard(key, async () => {
      setSettings(await api.send('POST', '/api/admin/site-settings', body));
      notify('success', okText);
    });

  return (
    <>
      <PageHeader title="Сервер" description="Режимы работы платформы, обслуживание, безопасность, журналы." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Режимы работы">
          {settings && (
            <div className="divide-y divide-white/[0.06]">
              <Toggle
                checked={settings.registrationOpen}
                disabled={busy === 'reg'}
                onChange={(v) => patch('reg', { registrationOpen: v }, v ? 'Регистрация открыта' : 'Регистрация закрыта')}
                label="Открытая регистрация"
                description="Если выключить, новые аккаунты создать нельзя. Существующие пользователи входят как обычно."
              />
              <Toggle
                checked={settings.maintenanceMode}
                disabled={busy === 'maint'}
                onChange={(v) => patch('maint', { maintenanceMode: v }, v ? 'Режим обслуживания включён' : 'Режим обслуживания выключен')}
                label="Режим обслуживания"
                description="Закрывает сохранение профилей и загрузку файлов. Просмотр страниц и вход продолжают работать, на главной показывается плашка."
              />
              <Toggle
                checked={settings.hideAdminPanelLink}
                disabled={busy === 'hide'}
                onChange={(v) => patch('hide', { hideAdminPanelLink: v }, v ? 'Ссылка на админку скрыта' : 'Ссылка на админку видна')}
                label="Скрыть ссылку на админ-панель"
                description="Убирает ссылку из подвала главной. Адрес /admin остаётся рабочим."
              />
              <div className="pt-4">
                <Field label="Сообщение для посетителей" hint="Показывается на главной, пока включён режим обслуживания.">
                  <TextArea value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} rows={2} />
                </Field>
                <Button className="mt-2" size="sm" loading={busy === 'msg'} disabled={!settings || message === settings.maintenanceMessage} onClick={() => patch('msg', { maintenanceMessage: message }, 'Сообщение сохранено')}>Сохранить сообщение</Button>
              </div>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card title="Обслуживание" description="Операции над хранилищем. Выполняются на живом сервере.">
            <div className="grid gap-2">
              <Button icon={<Eraser className="h-4 w-4" />} loading={busy === 'orphans'} onClick={() => window.confirm('Удалить файлы в uploads/, не используемые ни одним профилем?') && guard('orphans', async () => {
                const r = await api.send('POST', '/api/admin/cleanup-orphans');
                notify('success', `Удалено файлов: ${r.deleted} (${r.bytesFreedMb} МБ)`);
              })}>Очистить неиспользуемые файлы</Button>
              <Button icon={<Zap className="h-4 w-4" />} loading={busy === 'optimize'} onClick={() => window.confirm('Переоптимизировать все медиафайлы? Это может занять несколько минут.') && guard('optimize', async () => {
                const r = await api.send('POST', '/api/admin/optimize-media');
                notify('success', `Обработано: ${r.processed}, сэкономлено ${r.savedMb} МБ`);
              })}>Переоптимизировать медиа</Button>
              <Button variant="danger" icon={<Trash2 className="h-4 w-4" />} loading={busy === 'analytics'} onClick={() => window.confirm('Удалить статистику визитов ВСЕХ пользователей? Действие необратимо.') && guard('analytics', async () => {
                const r = await api.send('POST', '/api/admin/analytics/clear', {});
                notify('success', `Удалено записей аналитики: ${r.deleted}`);
              })}>Очистить всю аналитику</Button>
            </div>
          </Card>

          <Card title="Пароль администратора" description="Хранится в виде хэша. После смены используйте новый пароль при следующем входе.">
            <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); guard('pw', async () => {
              await api.send('POST', '/api/admin/change-password', { newPassword });
              setNewPassword('');
              notify('success', 'Пароль администратора изменён. Войдите заново.');
              setTimeout(() => window.location.reload(), 1200);
            }); }}>
              <TextInput type="password" autoComplete="new-password" placeholder="Новый пароль" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} aria-label="Новый пароль администратора" />
              <Button type="submit" variant="primary" loading={busy === 'pw'} disabled={!newPassword} icon={<KeyRound className="h-4 w-4" />}>Сменить</Button>
            </form>
          </Card>
        </div>
      </div>

      <Card
        className="mt-4"
        title={tab === 'logs' ? 'Логи сервера' : 'Журнал действий администратора'}
        description={tab === 'logs' ? 'Последние сообщения процесса (хранятся в памяти, сбрасываются при перезапуске).' : 'Все успешные изменяющие запросы к админке.'}
        actions={<>
          <div className="flex rounded-lg border border-white/10 p-0.5">
            <TabBtn active={tab === 'logs'} onClick={() => setTab('logs')} icon={<ScrollText className="h-3.5 w-3.5" />}>Логи</TabBtn>
            <TabBtn active={tab === 'audit'} onClick={() => setTab('audit')} icon={<History className="h-3.5 w-3.5" />}>Журнал</TabBtn>
          </div>
          {tab === 'logs' && (
            <>
              <Select value={logLevel} onChange={(e) => setLogLevel(e.target.value)} className="!w-auto !py-1.5 text-xs" aria-label="Уровень логов">
                <option value="all">Все уровни</option><option value="error">Ошибки</option><option value="warn">Предупреждения</option><option value="info">Info</option><option value="log">Log</option>
              </Select>
              <Button size="sm" variant="danger" onClick={() => guard('clr', async () => { await api.send('DELETE', '/api/admin/logs'); setLogs([]); })} icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Очистить логи" />
            </>
          )}
          <Button size="sm" onClick={tab === 'logs' ? loadLogs : loadAudit} icon={<RefreshCw className="h-3.5 w-3.5" />} aria-label="Обновить" />
        </>}
      >
        {tab === 'logs' ? (
          logs.length === 0 ? <EmptyState>Сообщений нет.</EmptyState> : (
            <div className="max-h-[420px] overflow-y-auto rounded-xl bg-black/50 p-3 font-mono text-[11.5px] leading-relaxed">
              {logs.map((l, i) => (
                <div key={i} className="flex gap-3 border-b border-white/[0.03] py-1 last:border-0">
                  <span className="shrink-0 text-neutral-600">{new Date(l.ts).toLocaleTimeString('ru-RU')}</span>
                  <span className={cx('w-12 shrink-0 uppercase', LEVEL_TONE[l.level])}>{l.level}</span>
                  <span className="min-w-0 whitespace-pre-wrap break-words text-neutral-300">{l.message}</span>
                </div>
              ))}
            </div>
          )
        ) : audit.length === 0 ? <EmptyState>Журнал пуст.</EmptyState> : (
          <ul className="max-h-[420px] divide-y divide-white/[0.06] overflow-y-auto">
            {audit.map((a, i) => (
              <li key={i} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span className="font-mono text-xs text-neutral-200 break-all">{a.action}</span>
                <span className="flex items-center gap-2 text-xs text-neutral-500"><Badge>{a.ip}</Badge>{formatDateTime(a.ts)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}

function TabBtn({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cx('flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition cursor-pointer', active ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white')}>
      {icon}{children}
    </button>
  );
}
