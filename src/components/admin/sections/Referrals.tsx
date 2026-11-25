import { useCallback, useEffect, useState } from 'react';
import { Copy, Link2, Plus, Trash2, Send, ExternalLink, Users as UsersIcon } from 'lucide-react';
import { Badge, Button, Card, EmptyState, Field, Modal, PageHeader, StatCard, TextInput, Toggle } from '../ui';
import type { SectionProps } from './types';

interface LinkStats {
  code: string;
  name: string;
  note: string;
  statsToken: string;
  active: boolean;
  createdAt: string;
  clicks: number;
  signups: number;
  signups24h: number;
  signups7d: number;
  telegramSignups: number;
  conversion: number | null;
}

interface Overview {
  links: LinkStats[];
  telegram: { enabled: boolean; botUsername: string; linked: number; registeredViaTelegram: number; pendingKeys: number };
}

interface Signup { username: string; source: 'web' | 'telegram'; createdAt: string }

export default function Referrals({ api, notify }: SectionProps) {
  const [data, setData] = useState<Overview | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState<LinkStats | null>(null);
  const [signups, setSignups] = useState<{ total: number; items: Signup[] } | null>(null);

  const load = useCallback(async () => {
    try { setData(await api.get<Overview>('/api/admin/referrals')); }
    catch (e: any) { notify('error', e.message); }
  }, [api, notify]);

  useEffect(() => { load(); }, [load]);

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const siteLink = (code: string) => `${origin}/?ref=${code}`;
  const botLink = (code: string) => (data?.telegram.botUsername ? `https://t.me/${data.telegram.botUsername}?start=ref_${code}` : '');
  const statsLink = (token: string) => `${origin}/ref-stats/${token}`;

  const copy = async (text: string, what: string) => {
    try { await navigator.clipboard.writeText(text); notify('success', `${what} скопирована`); }
    catch { notify('error', 'Не удалось скопировать — выделите и скопируйте вручную'); }
  };

  const create = async () => {
    setSaving(true);
    try {
      await api.send('POST', '/api/admin/referrals', { name: form.name, code: form.code || undefined, note: form.note });
      setCreateOpen(false);
      setForm({ name: '', code: '', note: '' });
      notify('success', 'Ссылка создана');
      load();
    } catch (e: any) { notify('error', e.message); }
    finally { setSaving(false); }
  };

  const toggleActive = async (l: LinkStats, active: boolean) => {
    try { await api.send('PUT', `/api/admin/referrals/${l.code}`, { active }); load(); }
    catch (e: any) { notify('error', e.message); }
  };

  const remove = async (l: LinkStats) => {
    if (!window.confirm(`Удалить ссылку «${l.name}»? Счётчик переходов будет стёрт, регистрации останутся в базе.`)) return;
    try { await api.send('DELETE', `/api/admin/referrals/${l.code}`); setDetail(null); load(); }
    catch (e: any) { notify('error', e.message); }
  };

  const openDetail = async (l: LinkStats) => {
    setDetail(l);
    setSignups(null);
    try { setSignups(await api.get(`/api/admin/referrals/${l.code}/signups?limit=200`)); }
    catch (e: any) { notify('error', e.message); }
  };

  const totals = (data?.links ?? []).reduce((a, l) => ({ clicks: a.clicks + l.clicks, signups: a.signups + l.signups }), { clicks: 0, signups: 0 });

  return (
    <>
      <PageHeader
        title="Рефералы"
        description="Отдельная ссылка на каждого рекламщика или кампанию: видно переходы, регистрации и конверсию."
        actions={<Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setCreateOpen(true)}>Новая ссылка</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Ссылок" value={data?.links.length ?? '—'} icon={<Link2 className="h-4 w-4" />} />
        <StatCard label="Переходов" value={data ? totals.clicks : '—'} />
        <StatCard label="Регистраций по ссылкам" value={data ? totals.signups : '—'} icon={<UsersIcon className="h-4 w-4" />} tone="success" />
        <StatCard
          label="Telegram-вход"
          value={data ? (data.telegram.enabled ? 'включён' : 'выключен') : '—'}
          hint={data?.telegram.enabled ? `привязано: ${data.telegram.linked}, создано через бота: ${data.telegram.registeredViaTelegram}` : 'задайте TELEGRAM_BOT_TOKEN в окружении сервера'}
          icon={<Send className="h-4 w-4" />}
          tone={data?.telegram.enabled ? 'success' : 'warning'}
        />
      </div>

      {data && data.links.length === 0 ? (
        <EmptyState>Ссылок пока нет. Создайте первую и отдайте рекламщику.</EmptyState>
      ) : (
        <div className="space-y-3">
          {data?.links.map((l) => (
            <div key={l.code}><Card padded>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold text-white">{l.name}</h3>
                    <Badge tone={l.active ? 'success' : 'neutral'}>{l.active ? 'активна' : 'отключена'}</Badge>
                    <Badge>{l.code}</Badge>
                  </div>
                  {l.note && <p className="mt-1 text-xs text-neutral-400">{l.note}</p>}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => openDetail(l)}>Регистрации</Button>
                  <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => remove(l)} aria-label="Удалить" />
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-5">
                {[
                  ['Переходы', l.clicks],
                  ['Регистрации', l.signups],
                  ['За 24 ч', l.signups24h],
                  ['За 7 дн', l.signups7d],
                  ['Конверсия', l.conversion === null ? '—' : `${l.conversion}%`],
                ].map(([label, v]) => (
                  <div key={label as string} className="rounded-lg bg-white/[0.04] px-2 py-2">
                    <div className="text-lg font-semibold text-white tabular-nums">{v}</div>
                    <div className="text-[11px] text-neutral-500">{label}</div>
                  </div>
                ))}
              </div>
              {l.telegramSignups > 0 && <p className="mt-2 text-[11px] text-neutral-500">из них через Telegram-бота: {l.telegramSignups}</p>}

              <div className="mt-3 space-y-2">
                <LinkRow label="Ссылка на сайт" url={siteLink(l.code)} onCopy={copy} />
                {botLink(l.code) && <LinkRow label="Ссылка на бота" url={botLink(l.code)} onCopy={copy} />}
                <LinkRow label="Статистика для рекламщика" url={statsLink(l.statsToken)} onCopy={copy} open />
              </div>

              <div className="mt-2 border-t border-white/[0.06] pt-1">
                <Toggle label="Ссылка активна" description="Отключённая ссылка не считает переходы и регистрации" checked={l.active} onChange={(v) => toggleActive(l, v)} />
              </div>
            </Card></div>
          ))}
        </div>
      )}

      <Modal
        open={createOpen}
        title="Новая реферальная ссылка"
        onClose={() => setCreateOpen(false)}
        footer={<><Button onClick={() => setCreateOpen(false)}>Отмена</Button><Button variant="primary" loading={saving} disabled={!form.name.trim()} onClick={create}>Создать</Button></>}
      >
        <div className="space-y-4">
          <Field label="Название" hint="Имя рекламщика или кампании — видно только вам и ему на странице статистики.">
            <TextInput value={form.name} maxLength={80} placeholder="Например: Вася, канал @crypto" onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
          </Field>
          <Field label="Код ссылки" hint="3–32 символа: a-z, 0-9, _ или -. Пусто — сгенерируется случайный.">
            <TextInput value={form.code} maxLength={32} placeholder="vasya" onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} />
          </Field>
          <Field label="Заметка" hint="Необязательно: условия, бюджет, где размещена реклама.">
            <TextInput value={form.note} maxLength={300} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          </Field>
        </div>
      </Modal>

      <Modal open={!!detail} title={detail ? `Регистрации: ${detail.name}` : ''} onClose={() => setDetail(null)} wide>
        {!signups ? (
          <p className="text-sm text-neutral-400">Загрузка…</p>
        ) : signups.items.length === 0 ? (
          <p className="text-sm text-neutral-400">Пока никто не зарегистрировался.</p>
        ) : (
          <>
            <p className="mb-3 text-xs text-neutral-400">Всего: {signups.total}{signups.total > signups.items.length ? `, показаны последние ${signups.items.length}` : ''}</p>
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs text-neutral-500"><th className="py-1.5">Пользователь</th><th>Способ</th><th>Дата</th></tr></thead>
              <tbody>
                {signups.items.map((s) => (
                  <tr key={s.username} className="border-t border-white/[0.06]">
                    <td className="py-1.5"><a href={`/${s.username}`} target="_blank" rel="noopener noreferrer" className="text-[#00f2ff] hover:underline">@{s.username}</a></td>
                    <td>{s.source === 'telegram' ? 'Telegram' : 'Форма'}</td>
                    <td className="text-neutral-400">{new Date(s.createdAt).toLocaleString('ru-RU')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Modal>
    </>
  );
}

function LinkRow({ label, url, onCopy, open }: { label: string; url: string; onCopy: (t: string, w: string) => void; open?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-40 shrink-0 text-[11px] text-neutral-500">{label}</span>
      <input readOnly value={url} onFocus={(e) => e.currentTarget.select()} className="min-w-0 flex-1 rounded-md border border-white/10 bg-black/40 px-2 py-1 text-xs text-neutral-200" />
      <Button size="sm" icon={<Copy className="h-3.5 w-3.5" />} onClick={() => onCopy(url, label)} aria-label={`Копировать: ${label}`} />
      {open && <a href={url} target="_blank" rel="noopener noreferrer" className="text-neutral-400 hover:text-white" aria-label="Открыть"><ExternalLink className="h-4 w-4" /></a>}
    </div>
  );
}
