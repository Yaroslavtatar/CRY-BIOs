import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, ArrowDown, Copy, Trash2, Plus, Eye, EyeOff, Save, RotateCcw, Monitor, Smartphone, GripVertical, Undo2, Settings2, ExternalLink } from 'lucide-react';
import LandingPage from '../../LandingPage';
import {
  BLOCK_META, BLOCK_TYPES, FEATURE_ICONS, createBlock, newBlockId, sanitizeHomeLayout,
  type HomeBlock, type HomeBlockType, type HomeLayout,
} from '../../../homeLayout';
import { Badge, Button, Card, Field, Modal, Select, TextArea, TextInput, Toggle, cx } from '../ui';
import type { SectionProps } from './types';

const noop = () => {};

export default function HomeBuilder({ api, notify }: SectionProps) {
  const [layout, setLayout] = useState<HomeLayout | null>(null);
  const [saved, setSaved] = useState('');
  const [selectedId, setSelectedId] = useState<string | 'settings' | null>('settings');
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const history = useRef<string[]>([]);

  useEffect(() => {
    api.get('/api/admin/home-layout')
      .then((data) => {
        const clean = sanitizeHomeLayout(data);
        setLayout(clean);
        setSaved(JSON.stringify(clean));
      })
      .catch((e) => notify('error', e.message));
  }, [api, notify]);

  const dirty = layout ? JSON.stringify(layout) !== saved : false;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = useCallback((fn: (l: HomeLayout) => HomeLayout) => {
    setLayout((cur) => {
      if (!cur) return cur;
      history.current.push(JSON.stringify(cur));
      if (history.current.length > 50) history.current.shift();
      return fn(cur);
    });
  }, []);

  const undo = () => {
    const prev = history.current.pop();
    if (prev) setLayout(JSON.parse(prev));
  };

  const patchBlock = (id: string, props: Partial<HomeBlock['props']>) =>
    update((l) => ({ ...l, blocks: l.blocks.map((b) => (b.id === id ? { ...b, props: { ...b.props, ...props } } : b)) }));

  const move = (id: string, delta: number) =>
    update((l) => {
      const i = l.blocks.findIndex((b) => b.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= l.blocks.length) return l;
      const blocks = [...l.blocks];
      [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
      return { ...l, blocks };
    });

  const dropOn = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    update((l) => {
      const from = l.blocks.findIndex((b) => b.id === dragId);
      const to = l.blocks.findIndex((b) => b.id === targetId);
      if (from < 0 || to < 0) return l;
      const blocks = [...l.blocks];
      const [item] = blocks.splice(from, 1);
      blocks.splice(to, 0, item);
      return { ...l, blocks };
    });
  };

  const toggle = (id: string) => update((l) => ({ ...l, blocks: l.blocks.map((b) => (b.id === id ? { ...b, enabled: !b.enabled } : b)) }));

  const duplicate = (id: string) =>
    update((l) => {
      const i = l.blocks.findIndex((b) => b.id === id);
      if (i < 0 || BLOCK_META[l.blocks[i].type].unique) return l;
      const copy: HomeBlock = { ...l.blocks[i], id: newBlockId(), props: JSON.parse(JSON.stringify(l.blocks[i].props)) };
      const blocks = [...l.blocks];
      blocks.splice(i + 1, 0, copy);
      setSelectedId(copy.id);
      return { ...l, blocks };
    });

  const remove = (id: string) => {
    update((l) => ({ ...l, blocks: l.blocks.filter((b) => b.id !== id) }));
    setSelectedId((cur) => (cur === id ? null : cur));
  };

  const add = (type: HomeBlockType) => {
    const block = createBlock(type);
    update((l) => ({ ...l, blocks: [...l.blocks, block] }));
    setSelectedId(block.id);
    setAdding(false);
  };

  const save = async () => {
    if (!layout) return;
    setSaving(true);
    try {
      const res = sanitizeHomeLayout(await api.send('PUT', '/api/admin/home-layout', layout));
      setLayout(res);
      setSaved(JSON.stringify(res));
      history.current = [];
      notify('success', 'Главная страница опубликована');
    } catch (e: any) {
      notify('error', e.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!window.confirm('Сбросить главную к стандартному виду? Все ваши блоки будут потеряны.')) return;
    try {
      const res = sanitizeHomeLayout(await api.send('POST', '/api/admin/home-layout/reset'));
      setLayout(res);
      setSaved(JSON.stringify(res));
      history.current = [];
      notify('success', 'Главная сброшена к стандартной');
    } catch (e: any) { notify('error', e.message); }
  };

  const usedUnique = useMemo(() => new Set((layout?.blocks ?? []).filter((b) => BLOCK_META[b.type].unique).map((b) => b.type)), [layout]);
  const selected = layout?.blocks.find((b) => b.id === selectedId) ?? null;

  if (!layout) return <div className="h-64 animate-pulse rounded-2xl bg-white/[0.03]" />;

  return (
    <div className="-mx-4 -my-6 flex h-[calc(100vh-0px)] min-h-[640px] flex-col sm:-mx-8">
      {/* верхняя панель конструктора */}
      <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.07] bg-[#0a0a0c]/90 px-4 py-3 backdrop-blur sm:px-8">
        <div className="mr-auto">
          <h1 className="text-lg font-semibold tracking-tight text-white">Конструктор главной</h1>
          <p className="text-xs text-neutral-500">{dirty ? 'Есть неопубликованные изменения' : layout.updatedAt ? 'Все изменения опубликованы' : 'Используется стандартный макет'}</p>
        </div>
        <div className="flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="Устройство предпросмотра">
          <button onClick={() => setDevice('desktop')} aria-pressed={device === 'desktop'} className={cx('rounded-md p-1.5 cursor-pointer', device === 'desktop' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white')} title="Компьютер"><Monitor className="h-4 w-4" /></button>
          <button onClick={() => setDevice('mobile')} aria-pressed={device === 'mobile'} className={cx('rounded-md p-1.5 cursor-pointer', device === 'mobile' ? 'bg-white/10 text-white' : 'text-neutral-500 hover:text-white')} title="Телефон"><Smartphone className="h-4 w-4" /></button>
        </div>
        <Button size="sm" variant="ghost" onClick={undo} icon={<Undo2 className="h-3.5 w-3.5" />}>Отменить</Button>
        <Button size="sm" variant="ghost" onClick={reset} icon={<RotateCcw className="h-3.5 w-3.5" />}>Сбросить</Button>
        <a href="/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-neutral-300 hover:bg-white/[0.06] hover:text-white"><ExternalLink className="h-3.5 w-3.5" />Открыть сайт</a>
        <Button variant="primary" size="sm" onClick={save} loading={saving} disabled={!dirty} icon={<Save className="h-3.5 w-3.5" />}>Опубликовать</Button>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[300px_minmax(0,1fr)_340px]">
        {/* список блоков */}
        <aside className="min-h-0 overflow-y-auto border-b border-white/[0.07] p-4 lg:border-b-0 lg:border-r">
          <button
            onClick={() => setSelectedId('settings')}
            className={cx('mb-3 flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-sm cursor-pointer', selectedId === 'settings' ? 'border-[#00f2ff]/40 bg-[#00f2ff]/[0.06] text-white' : 'border-white/[0.07] text-neutral-300 hover:bg-white/[0.04]')}
          >
            <Settings2 className="h-4 w-4 text-[#00f2ff]" /> Шапка и подвал
          </button>
          <ul className="space-y-2">
            {layout.blocks.map((b, i) => (
              <li
                key={b.id}
                draggable
                onDragStart={() => setDragId(b.id)}
                onDragEnd={() => { setDragId(null); setOverId(null); }}
                onDragOver={(e) => { e.preventDefault(); setOverId(b.id); }}
                onDrop={(e) => { e.preventDefault(); dropOn(b.id); setOverId(null); }}
                className={cx('rounded-xl border transition', selectedId === b.id ? 'border-[#00f2ff]/40 bg-[#00f2ff]/[0.06]' : 'border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.04]', overId === b.id && dragId !== b.id && 'ring-2 ring-[#00f2ff]/50', dragId === b.id && 'opacity-40')}
              >
                <div className="flex items-center gap-1 pr-1.5">
                  <span className="cursor-grab px-1.5 py-3 text-neutral-600" aria-hidden><GripVertical className="h-4 w-4" /></span>
                  <button onClick={() => setSelectedId(b.id)} className="min-w-0 flex-1 py-2.5 text-left cursor-pointer">
                    <span className={cx('block truncate text-sm', b.enabled ? 'text-white' : 'text-neutral-500 line-through')}>{BLOCK_META[b.type].label}</span>
                    <span className="block truncate text-[11px] text-neutral-500">{BLOCK_META[b.type].description}</span>
                  </button>
                  <div className="flex shrink-0">
                    <MiniBtn label="Выше" disabled={i === 0} onClick={() => move(b.id, -1)}><ArrowUp className="h-3.5 w-3.5" /></MiniBtn>
                    <MiniBtn label="Ниже" disabled={i === layout.blocks.length - 1} onClick={() => move(b.id, 1)}><ArrowDown className="h-3.5 w-3.5" /></MiniBtn>
                    <MiniBtn label={b.enabled ? 'Скрыть' : 'Показать'} onClick={() => toggle(b.id)}>{b.enabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}</MiniBtn>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          <Button className="mt-3 w-full" onClick={() => setAdding(true)} icon={<Plus className="h-4 w-4" />}>Добавить блок</Button>
        </aside>

        {/* живой предпросмотр */}
        <main className="min-h-0 overflow-auto bg-[#050505] p-4">
          <ScaledPreview width={device === 'mobile' ? 390 : 1280}>
            <LandingPage layout={layout} onNavigateToDashboard={noop} onViewProfile={noop} />
          </ScaledPreview>
        </main>

        {/* свойства */}
        <aside className="min-h-0 overflow-y-auto border-t border-white/[0.07] p-4 lg:border-l lg:border-t-0">
          {selectedId === 'settings' && (
            <Card title="Шапка и подвал" padded>
              <div className="space-y-4">
                <Field label="Название сайта"><TextInput value={layout.settings.siteName} maxLength={40} onChange={(e) => update((l) => ({ ...l, settings: { ...l.settings, siteName: e.target.value } }))} /></Field>
                <Field label="Подзаголовок под названием"><TextInput value={layout.settings.tagline} maxLength={120} onChange={(e) => update((l) => ({ ...l, settings: { ...l.settings, tagline: e.target.value } }))} /></Field>
                <Toggle checked={layout.settings.showHeaderGithub} onChange={(v) => update((l) => ({ ...l, settings: { ...l.settings, showHeaderGithub: v } }))} label="Кнопка GitHub в шапке" />
                <Toggle checked={layout.settings.showFooterInstall} onChange={(v) => update((l) => ({ ...l, settings: { ...l.settings, showFooterInstall: v } }))} label="Команда установки в подвале" />
                <Field label="Примечание в подвале"><TextArea rows={2} maxLength={200} value={layout.settings.footerNote} onChange={(e) => update((l) => ({ ...l, settings: { ...l.settings, footerNote: e.target.value } }))} /></Field>
              </div>
            </Card>
          )}
          {selected && (
            <Card
              title={<span className="flex items-center gap-2">{BLOCK_META[selected.type].label}{!selected.enabled && <Badge tone="warning">скрыт</Badge>}</span>}
              actions={<>
                {!BLOCK_META[selected.type].unique && <Button size="sm" variant="ghost" onClick={() => duplicate(selected.id)} icon={<Copy className="h-3.5 w-3.5" />} aria-label="Дублировать" />}
                <Button size="sm" variant="danger" onClick={() => remove(selected.id)} icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Удалить блок" />
              </>}
            >
              <BlockEditor block={selected} patch={(props) => patchBlock(selected.id, props)} />
            </Card>
          )}
          {!selected && selectedId !== 'settings' && <p className="px-2 py-8 text-center text-sm text-neutral-500">Выберите блок слева, чтобы изменить его содержимое.</p>}
        </aside>
      </div>

      <Modal open={adding} title="Добавить блок" onClose={() => setAdding(false)} wide>
        <div className="grid gap-2 sm:grid-cols-2">
          {BLOCK_TYPES.map((t) => {
            const disabled = BLOCK_META[t].unique && usedUnique.has(t);
            return (
              <button key={t} disabled={disabled} onClick={() => add(t)} className="rounded-xl border border-white/[0.07] p-3 text-left transition hover:border-[#00f2ff]/40 hover:bg-[#00f2ff]/[0.05] disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer">
                <span className="block text-sm font-medium text-white">{BLOCK_META[t].label}</span>
                <span className="block text-xs text-neutral-500">{disabled ? 'Уже добавлен' : BLOCK_META[t].description}</span>
              </button>
            );
          })}
        </div>
      </Modal>
    </div>
  );
}

/** Рисует страницу в виртуальном окне фиксированной ширины и масштабирует его под доступное место. */
function ScaledPreview({ width, children }: { width: number; children: React.ReactNode }) {
  const outer = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ scale: 0.4, height: 600 });

  useEffect(() => {
    const measure = () => {
      if (!outer.current || !inner.current) return;
      const scale = Math.min(1, outer.current.clientWidth / width);
      setBox({ scale, height: inner.current.scrollHeight * scale });
    };
    measure();
    const ro = new ResizeObserver(measure);
    if (outer.current) ro.observe(outer.current);
    if (inner.current) ro.observe(inner.current);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={outer} className="mx-auto w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-2xl" style={{ maxWidth: width, height: box.height }}>
      <div ref={inner} inert className="pointer-events-none origin-top-left select-none" style={{ width, transform: `scale(${box.scale})` }} aria-hidden>
        {children}
      </div>
    </div>
  );
}

function MiniBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return <button type="button" title={label} aria-label={label} disabled={disabled} onClick={onClick} className="rounded-md p-1.5 text-neutral-500 transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer">{children}</button>;
}

function BlockEditor({ block, patch }: { block: HomeBlock; patch: (p: HomeBlock['props']) => void }) {
  const p = block.props;
  const text = (key: keyof HomeBlock['props'], label: string, max = 120, area = false) => (
    <Field label={label}>
      {area
        ? <TextArea rows={4} maxLength={max} value={(p[key] as string) ?? ''} onChange={(e) => patch({ [key]: e.target.value })} />
        : <TextInput maxLength={max} value={(p[key] as string) ?? ''} onChange={(e) => patch({ [key]: e.target.value })} />}
    </Field>
  );

  switch (block.type) {
    case 'announcement':
      return <div className="space-y-4">
        {text('text', 'Текст', 300, true)}
        <Field label="Вид"><Select value={p.level ?? 'info'} onChange={(e) => patch({ level: e.target.value as any })}><option value="info">Информация</option><option value="success">Успех</option><option value="warning">Предупреждение</option></Select></Field>
        {text('linkLabel', 'Текст ссылки', 60)}
        <Field label="Адрес ссылки" hint="https://…, /путь или #якорь"><TextInput value={p.linkUrl ?? ''} onChange={(e) => patch({ linkUrl: e.target.value })} /></Field>
        <p className="text-[11px] text-neutral-500">Плашка показывается над шапкой, если стоит в начале списка.</p>
      </div>;
    case 'hero':
      return <div className="space-y-4">
        {text('badge', 'Бейдж над заголовком', 100)}
        {text('titleLine1', 'Заголовок, строка 1', 60)}
        {text('titleAccent', 'Заголовок, акцентная строка', 60)}
        {text('description', 'Описание', 900, true)}
        {text('primaryLabel', 'Главная кнопка', 60)}
        <Toggle checked={p.showSecondary !== false} onChange={(v) => patch({ showSecondary: v })} label="Вторая кнопка" />
        {p.showSecondary !== false && text('secondaryLabel', 'Текст второй кнопки', 60)}
      </div>;
    case 'stats':
      return <div className="space-y-4">
        <Toggle checked={!!p.useCustomStats} onChange={(v) => patch({ useCustomStats: v })} label="Свои цифры" description="Выключено — показываются автоматические данные (профили, GitHub, лицензия)." />
        {p.useCustomStats && <>
          {(p.stats ?? []).map((item, i) => (
            <div key={i} className="flex items-end gap-2">
              <Field label="Подпись"><TextInput value={item.label} maxLength={40} onChange={(e) => patch({ stats: p.stats!.map((s, k) => (k === i ? { ...s, label: e.target.value } : s)) })} /></Field>
              <Field label="Значение"><TextInput value={item.value} maxLength={30} onChange={(e) => patch({ stats: p.stats!.map((s, k) => (k === i ? { ...s, value: e.target.value } : s)) })} /></Field>
              <Button size="sm" variant="danger" onClick={() => patch({ stats: p.stats!.filter((_, k) => k !== i) })} icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Удалить" className="mb-0.5" />
            </div>
          ))}
          {(p.stats?.length ?? 0) < 6 && <Button size="sm" onClick={() => patch({ stats: [...(p.stats ?? []), { label: 'Новая', value: '0' }] })} icon={<Plus className="h-3.5 w-3.5" />}>Добавить цифру</Button>}
        </>}
      </div>;
    case 'features':
      return <div className="space-y-4">
        {text('title', 'Заголовок', 120)}
        {text('subtitle', 'Подзаголовок', 400, true)}
        {(p.features ?? []).map((f, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-white/[0.07] p-3">
            <div className="flex gap-2">
              <Select value={f.icon} onChange={(e) => patch({ features: p.features!.map((x, k) => (k === i ? { ...x, icon: e.target.value as any } : x)) })} className="!w-28" aria-label="Иконка">{FEATURE_ICONS.map((ic) => <option key={ic} value={ic}>{ic}</option>)}</Select>
              <TextInput value={f.title} maxLength={80} placeholder="Заголовок" onChange={(e) => patch({ features: p.features!.map((x, k) => (k === i ? { ...x, title: e.target.value } : x)) })} />
              <Button size="sm" variant="danger" onClick={() => patch({ features: p.features!.filter((_, k) => k !== i) })} icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Удалить карточку" />
            </div>
            <TextArea rows={3} maxLength={400} value={f.text} placeholder="Описание" onChange={(e) => patch({ features: p.features!.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)) })} />
          </div>
        ))}
        {(p.features?.length ?? 0) < 12 && <Button size="sm" onClick={() => patch({ features: [...(p.features ?? []), { icon: 'sparkles', title: 'Новое преимущество', text: '' }] })} icon={<Plus className="h-3.5 w-3.5" />}>Добавить карточку</Button>}
      </div>;
    case 'profiles':
      return <div className="space-y-4">
        {text('title', 'Заголовок', 120)}
        {text('subtitle', 'Подзаголовок', 400, true)}
        <Field label="Сколько профилей показывать"><TextInput type="number" min={1} max={100} value={p.limit ?? 30} onChange={(e) => patch({ limit: Math.min(100, Math.max(1, Number(e.target.value) || 1)) })} /></Field>
      </div>;
    case 'text':
      return <div className="space-y-4">
        {text('title', 'Заголовок', 120)}
        {text('body', 'Текст', 4000, true)}
        <Field label="Выравнивание"><Select value={p.align ?? 'left'} onChange={(e) => patch({ align: e.target.value as any })}><option value="left">По левому краю</option><option value="center">По центру</option></Select></Field>
        <p className="text-[11px] text-neutral-500">Только обычный текст. Пустая строка начинает новый абзац.</p>
      </div>;
    case 'cta':
      return <div className="space-y-4">
        {text('title', 'Заголовок', 120)}
        {text('text', 'Описание', 400, true)}
        {text('buttonLabel', 'Текст кнопки', 60)}
        <Field label="Адрес кнопки" hint="/dashboard, https://… или #якорь"><TextInput value={p.buttonUrl ?? ''} onChange={(e) => patch({ buttonUrl: e.target.value })} /></Field>
      </div>;
    case 'faq':
      return <div className="space-y-4">
        {text('title', 'Заголовок', 120)}
        {(p.faq ?? []).map((f, i) => (
          <div key={i} className="space-y-2 rounded-xl border border-white/[0.07] p-3">
            <div className="flex gap-2">
              <TextInput value={f.q} maxLength={200} placeholder="Вопрос" onChange={(e) => patch({ faq: p.faq!.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)) })} />
              <Button size="sm" variant="danger" onClick={() => patch({ faq: p.faq!.filter((_, k) => k !== i) })} icon={<Trash2 className="h-3.5 w-3.5" />} aria-label="Удалить вопрос" />
            </div>
            <TextArea rows={3} maxLength={1200} value={f.a} placeholder="Ответ" onChange={(e) => patch({ faq: p.faq!.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)) })} />
          </div>
        ))}
        {(p.faq?.length ?? 0) < 12 && <Button size="sm" onClick={() => patch({ faq: [...(p.faq ?? []), { q: 'Новый вопрос', a: '' }] })} icon={<Plus className="h-3.5 w-3.5" />}>Добавить вопрос</Button>}
      </div>;
    case 'opensource':
    case 'installer':
      return <p className="text-sm text-neutral-400">Этот блок заполняется автоматически ({block.type === 'opensource' ? 'данные GitHub' : 'скрипт установки и docker-compose'}). Можно переместить, скрыть или удалить.</p>;
  }
}
