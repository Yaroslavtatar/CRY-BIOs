import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, RefreshCw, BadgeCheck, Ban, KeyRound, Pencil, Trash2, Download, Upload, ExternalLink, LogOut, FileSpreadsheet, ShieldCheck } from 'lucide-react';
import { getThumbUrl } from '../../../utils/media';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, Select, TextInput } from '../ui';
import type { AdminUser, SectionProps } from './types';

type Filter = 'all' | 'verified' | 'banned' | 'active';
type Sort = 'name' | 'visits';
type Dialog =
  | { kind: 'rename' | 'password' | 'delete' | 'ban'; user: AdminUser }
  | { kind: 'bulk-delete' | 'bulk-ban' }
  | null;

export default function Users({ api, notify }: SectionProps) {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<Sort>('name');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<Dialog>(null);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const importTarget = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await api.get<AdminUser[]>('/api/admin/users'));
      setSelected(new Set());
    } catch (e: any) {
      notify('error', e.message);
    } finally {
      setLoading(false);
    }
  }, [api, notify]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = users.filter((u) => {
      if (q && !u.username.toLowerCase().includes(q) && !u.displayName.toLowerCase().includes(q)) return false;
      if (filter === 'verified') return u.verified;
      if (filter === 'banned') return u.banned;
      if (filter === 'active') return !u.banned;
      return true;
    });
    return [...list].sort((a, b) => (sort === 'visits' ? b.visitsCount - a.visitsCount : a.username.localeCompare(b.username)));
  }, [users, query, filter, sort]);

  const allSelected = visible.length > 0 && visible.every((u) => selected.has(u.username));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(visible.map((u) => u.username)));
  const toggleOne = (name: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(name) ? next.delete(name) : next.add(name);
    return next;
  });

  const run = async (fn: () => Promise<string | void>) => {
    setBusy(true);
    try {
      const msg = await fn();
      if (msg) notify('success', msg);
      setDialog(null);
      setInput('');
      await load();
    } catch (e: any) {
      notify('error', e.message);
    } finally {
      setBusy(false);
    }
  };

  const bulk = (action: string, reason?: string) =>
    run(async () => {
      const res = await api.send('POST', '/api/admin/users/bulk', { action, usernames: [...selected], reason });
      return `Готово: обработано ${res.processed} из ${selected.size}`;
    });

  const exportCsv = () => {
    const rows = [['username', 'displayName', 'verified', 'banned', 'visits'], ...visible.map((u) => [u.username, u.displayName, u.verified, u.banned, u.visitsCount])];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `cry_bios_users_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportUser = (u: AdminUser) =>
    api.download(`/api/admin/export-user/${u.username}`, `cry_bios_user_${u.username}_${Date.now()}.zip`)
      .then(() => notify('success', `@${u.username} экспортирован`))
      .catch((e) => notify('error', e.message));

  const onImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const target = importTarget.current;
    e.target.value = '';
    if (!file || !target) return;
    const overwrite = window.confirm(`Импортировать бэкап для @${target}? ОК — перезаписать, если пользователь существует.`);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('overwrite', String(overwrite));
      const res = await fetch(`/api/admin/import-user/${target}`, { method: 'POST', headers: { 'x-admin-password': encodeURIComponent(api.password) }, body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Ошибка импорта');
      notify('success', `@${target} импортирован`);
      load();
    } catch (err: any) {
      notify('error', err.message);
    }
  };

  const single = dialog && 'user' in dialog ? dialog.user : null;

  return (
    <>
      <PageHeader
        title="Пользователи"
        description="Поиск, модерация и массовые действия. Блокировка закрывает все сессии и скрывает профиль с публичных страниц."
        actions={
          <>
            <Button size="sm" onClick={exportCsv} icon={<FileSpreadsheet className="h-3.5 w-3.5" />}>CSV</Button>
            <Button size="sm" onClick={load} loading={loading} icon={<RefreshCw className="h-3.5 w-3.5" />}>Обновить</Button>
          </>
        }
      />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] p-4">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <TextInput value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по логину или имени" className="pl-9" aria-label="Поиск" />
          </div>
          <Select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="!w-auto" aria-label="Фильтр">
            <option value="all">Все ({users.length})</option>
            <option value="active">Активные</option>
            <option value="verified">Верифицированные</option>
            <option value="banned">Заблокированные</option>
          </Select>
          <Select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="!w-auto" aria-label="Сортировка">
            <option value="name">По имени</option>
            <option value="visits">По визитам</option>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#00f2ff]/20 bg-[#00f2ff]/[0.05] px-4 py-3">
            <span className="mr-2 text-sm text-[#00f2ff]">Выбрано: {selected.size}</span>
            <Button size="sm" onClick={() => bulk('verify')} icon={<BadgeCheck className="h-3.5 w-3.5" />}>Верифицировать</Button>
            <Button size="sm" onClick={() => bulk('unverify')}>Снять галочку</Button>
            <Button size="sm" onClick={() => bulk('reset-sessions')} icon={<LogOut className="h-3.5 w-3.5" />}>Сбросить сессии</Button>
            <Button size="sm" variant="warning" onClick={() => setDialog({ kind: 'bulk-ban' })} icon={<Ban className="h-3.5 w-3.5" />}>Заблокировать</Button>
            <Button size="sm" onClick={() => bulk('unban')} icon={<ShieldCheck className="h-3.5 w-3.5" />}>Разблокировать</Button>
            <Button size="sm" variant="danger" onClick={() => setDialog({ kind: 'bulk-delete' })} icon={<Trash2 className="h-3.5 w-3.5" />}>Удалить</Button>
          </div>
        )}

        {visible.length === 0 ? (
          <div className="p-4"><EmptyState>{loading ? 'Загрузка…' : 'Никого не найдено'}</EmptyState></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.07] text-left text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="w-10 py-3 pl-4"><input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Выбрать всех" className="h-4 w-4 cursor-pointer accent-[#00f2ff]" /></th>
                  <th className="py-3 font-medium">Пользователь</th>
                  <th className="py-3 font-medium">Статус</th>
                  <th className="py-3 text-right font-medium">Визиты</th>
                  <th className="py-3 pr-4 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((u) => (
                  <tr key={u.username} className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02]">
                    <td className="py-3 pl-4"><input type="checkbox" checked={selected.has(u.username)} onChange={() => toggleOne(u.username)} aria-label={`Выбрать ${u.username}`} className="h-4 w-4 cursor-pointer accent-[#00f2ff]" /></td>
                    <td className="py-3">
                      <div className="flex items-center gap-3">
                        {u.avatarUrl ? (
                          <img src={getThumbUrl(u.avatarUrl)} alt="" referrerPolicy="no-referrer" loading="lazy" className="h-9 w-9 rounded-full border border-white/10 object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xs uppercase">{u.username.slice(0, 2)}</span>
                        )}
                        <div className="min-w-0">
                          <div className="truncate font-medium text-white">@{u.username}</div>
                          <div className="truncate text-xs text-neutral-500">{u.displayName}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-1.5">
                        {u.verified && <Badge tone="accent">Верифицирован</Badge>}
                        {u.banned && <Badge tone="danger" >Заблокирован</Badge>}
                        {!u.verified && !u.banned && <Badge>Активен</Badge>}
                      </div>
                      {u.banned && u.banReason && <div className="mt-1 max-w-[220px] truncate text-[11px] text-neutral-500" title={u.banReason}>{u.banReason}</div>}
                    </td>
                    <td className="py-3 text-right tabular-nums text-neutral-300">{u.visitsCount}</td>
                    <td className="py-3 pr-4">
                      <div className="flex justify-end gap-0.5">
                        <IconBtn title="Открыть профиль" href={`/${u.username}`}><ExternalLink className="h-4 w-4" /></IconBtn>
                        <IconBtn title={u.verified ? 'Снять галочку' : 'Верифицировать'} onClick={() => run(async () => { const r = await api.send('POST', `/api/admin/toggle-verify/${u.username}`); return r.verified ? `@${u.username} верифицирован` : `У @${u.username} снята галочка`; })}><BadgeCheck className={`h-4 w-4 ${u.verified ? 'text-[#00f2ff]' : ''}`} /></IconBtn>
                        <IconBtn title={u.banned ? 'Разблокировать' : 'Заблокировать'} onClick={() => (u.banned ? run(async () => { await api.send('POST', `/api/admin/user/${u.username}/ban`, { banned: false }); return `@${u.username} разблокирован`; }) : setDialog({ kind: 'ban', user: u }))}><Ban className={`h-4 w-4 ${u.banned ? 'text-red-300' : ''}`} /></IconBtn>
                        <IconBtn title="Сбросить сессии" onClick={() => run(async () => { await api.send('POST', `/api/admin/user/${u.username}/reset-sessions`); return `Сессии @${u.username} сброшены`; })}><LogOut className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Сменить пароль" onClick={() => { setInput(''); setDialog({ kind: 'password', user: u }); }}><KeyRound className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Переименовать" onClick={() => { setInput(u.username); setDialog({ kind: 'rename', user: u }); }}><Pencil className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Экспорт ZIP" onClick={() => exportUser(u)}><Download className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Импорт ZIP" onClick={() => { importTarget.current = u.username; importRef.current?.click(); }}><Upload className="h-4 w-4" /></IconBtn>
                        <IconBtn title="Удалить" danger onClick={() => setDialog({ kind: 'delete', user: u })}><Trash2 className="h-4 w-4" /></IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <input ref={importRef} type="file" accept=".zip,application/zip" className="hidden" onChange={onImportFile} />

      <Modal
        open={dialog?.kind === 'rename'}
        title={`Переименовать @${single?.username}`}
        onClose={() => setDialog(null)}
        footer={<><Button onClick={() => setDialog(null)} variant="ghost">Отмена</Button><Button variant="primary" loading={busy} onClick={() => run(async () => { await api.send('POST', '/api/admin/rename-user', { oldUsername: single!.username, newUsername: input.trim().toLowerCase() }); return `@${single!.username} → @${input.trim().toLowerCase()}`; })}>Сохранить</Button></>}
      >
        <Field label="Новый адрес" hint="3–15 символов: латиница, цифры, _ и -"><TextInput value={input} onChange={(e) => setInput(e.target.value)} autoFocus /></Field>
      </Modal>

      <Modal
        open={dialog?.kind === 'password'}
        title={`Новый пароль для @${single?.username}`}
        onClose={() => setDialog(null)}
        footer={<><Button onClick={() => setDialog(null)} variant="ghost">Отмена</Button><Button variant="primary" loading={busy} onClick={() => run(async () => { const r = await api.send('POST', '/api/admin/change-user-password', { username: single!.username, newPassword: input }); return r.message; })}>Сменить</Button></>}
      >
        <Field label="Пароль" hint="Все активные сессии пользователя будут сброшены."><TextInput type="password" autoComplete="new-password" value={input} onChange={(e) => setInput(e.target.value)} autoFocus /></Field>
      </Modal>

      <Modal
        open={dialog?.kind === 'ban' || dialog?.kind === 'bulk-ban'}
        title={dialog?.kind === 'bulk-ban' ? `Заблокировать выбранных (${selected.size})` : `Заблокировать @${single?.username}`}
        onClose={() => setDialog(null)}
        footer={<><Button onClick={() => setDialog(null)} variant="ghost">Отмена</Button><Button variant="warning" loading={busy} onClick={() => dialog?.kind === 'bulk-ban' ? bulk('ban', input) : run(async () => { await api.send('POST', `/api/admin/user/${single!.username}/ban`, { banned: true, reason: input }); return `@${single!.username} заблокирован`; })}>Заблокировать</Button></>}
      >
        <Field label="Причина (необязательно)" hint="Видна только администраторам."><TextInput value={input} onChange={(e) => setInput(e.target.value)} maxLength={200} autoFocus /></Field>
      </Modal>

      <Modal
        open={dialog?.kind === 'delete' || dialog?.kind === 'bulk-delete'}
        title="Удалить без возможности восстановления?"
        onClose={() => setDialog(null)}
        footer={<><Button onClick={() => setDialog(null)} variant="ghost">Отмена</Button><Button variant="danger" loading={busy} onClick={() => dialog?.kind === 'bulk-delete' ? bulk('delete') : run(async () => { await api.send('DELETE', `/api/admin/user/${single!.username}`); return `@${single!.username} удалён`; })}>Удалить</Button></>}
      >
        <p className="text-sm text-neutral-300">
          {dialog?.kind === 'bulk-delete' ? `Будут удалены аккаунты (${selected.size}), страницы и статистика.` : `Аккаунт @${single?.username}, его страница и статистика будут удалены.`} Сделайте бэкап заранее, если не уверены.
        </p>
      </Modal>
    </>
  );
}

function IconBtn({ title, onClick, href, danger, children }: { title: string; onClick?: () => void; href?: string; danger?: boolean; children: React.ReactNode }) {
  const cls = `rounded-md p-1.5 transition cursor-pointer ${danger ? 'text-neutral-500 hover:bg-red-500/10 hover:text-red-300' : 'text-neutral-500 hover:bg-white/10 hover:text-white'}`;
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" title={title} aria-label={title} className={cls}>{children}</a>
  ) : (
    <button type="button" title={title} aria-label={title} onClick={onClick} className={cls}>{children}</button>
  );
}
