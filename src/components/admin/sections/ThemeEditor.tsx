import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Upload, Copy, Image as ImageIcon, Type, Palette, Sparkles, Code2, FolderOpen, Shapes } from 'lucide-react';
import {
  COLOR_LABELS, MAX_CUSTOM_CSS, MAX_EXTRA_VARS, THEME_PRESETS, sanitizeFamily,
  type CustomFont, type Theme, type ThemeColors,
} from '../../../theme';
import { Badge, Button, Field, Select, TextArea, TextInput, Toggle, cx } from '../ui';
import { formatBytes } from '../adminApi';
import type { AdminApi } from '../adminApi';

interface Asset { name: string; url: string; kind: 'font' | 'image'; size: number }

type Tab = 'colors' | 'background' | 'fonts' | 'effects' | 'css' | 'files';
const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'colors', label: 'Цвета', icon: Palette },
  { id: 'background', label: 'Фон', icon: ImageIcon },
  { id: 'fonts', label: 'Шрифты', icon: Type },
  { id: 'effects', label: 'Форма', icon: Shapes },
  { id: 'css', label: 'CSS', icon: Code2 },
  { id: 'files', label: 'Файлы', icon: FolderOpen },
];

interface Props {
  theme: Theme;
  /** функция изменения темы; включает тему автоматически при любой правке */
  edit: (fn: (t: Theme) => Theme) => void;
  setEnabled: (v: boolean) => void;
  api: AdminApi;
  notify: (tone: 'success' | 'error' | 'info', text: string) => void;
}

const HEX6 = /^#[0-9a-fA-F]{6}$/;

function ColorField({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <span className="mb-1 block text-xs font-medium text-neutral-300">{label}</span>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label}: выбор цвета`}
          value={HEX6.test(value) ? value : '#000000'}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border border-white/10 bg-black/40 p-1"
        />
        <TextInput value={value} onChange={(e) => onChange(e.target.value)} spellCheck={false} aria-label={label} className="font-mono text-xs" />
      </div>
      {hint && <span className="mt-1 block text-[11px] text-neutral-500">{hint}</span>}
    </div>
  );
}

export default function ThemeEditor({ theme, edit, setEnabled, api, notify }: Props) {
  const [tab, setTab] = useState<Tab>('colors');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingKind = useRef<'font' | 'image' | 'any'>('any');
  const onUploaded = useRef<((a: Asset) => void) | null>(null);

  const loadAssets = useCallback(async () => {
    try { setAssets((await api.get('/api/admin/theme/assets')).files); } catch (e: any) { notify('error', e.message); }
  }, [api, notify]);
  useEffect(() => { loadAssets(); }, [loadAssets]);

  const pick = (kind: 'font' | 'image' | 'any', cb?: (a: Asset) => void) => {
    pendingKind.current = kind;
    onUploaded.current = cb ?? null;
    fileRef.current?.click();
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    try {
      const res = await api.upload<Asset & { success: boolean }>('/api/admin/theme/asset', file);
      if (pendingKind.current !== 'any' && res.kind !== pendingKind.current) {
        await api.send('DELETE', `/api/admin/theme/asset/${res.name}`);
        throw new Error(pendingKind.current === 'font' ? 'Нужен файл шрифта (woff2, woff, ttf, otf)' : 'Нужна картинка (png, jpg, webp, gif, avif)');
      }
      notify('success', 'Файл загружен');
      onUploaded.current?.({ name: res.name, url: res.url, kind: res.kind, size: res.size });
      loadAssets();
    } catch (err: any) {
      notify('error', err.message);
    } finally {
      setUploading(false);
    }
  };

  const removeAsset = async (a: Asset) => {
    if (!window.confirm(`Удалить файл ${a.name}? Если он используется в теме, шрифт или фон перестанут загружаться.`)) return;
    try { await api.send('DELETE', `/api/admin/theme/asset/${a.name}`); loadAssets(); } catch (e: any) { notify('error', e.message); }
  };

  const setColor = (key: keyof ThemeColors, v: string) => edit((t) => ({ ...t, colors: { ...t.colors, [key]: v } }));
  const bg = theme.background;
  const setBg = (patch: Partial<Theme['background']>) => edit((t) => ({ ...t, background: { ...t.background, ...patch } }));
  const setFonts = (patch: Partial<Theme['fonts']>) => edit((t) => ({ ...t, fonts: { ...t.fonts, ...patch } }));
  const setFx = (patch: Partial<Theme['effects']>) => edit((t) => ({ ...t, effects: { ...t.effects, ...patch } }));
  const fontImages = assets.filter((a) => a.kind === 'image');
  const fontFamilies = [...theme.fonts.custom.map((f) => f.family), ...theme.fonts.google.map((g) => g.name)];

  return (
    <div className="space-y-4">
      <Toggle
        checked={theme.enabled}
        onChange={setEnabled}
        label="Использовать свою тему"
        description="Выключено — сайт выглядит стандартно. Админка всегда остаётся в стандартном оформлении."
      />

      <div role="tablist" aria-label="Разделы темы" className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 p-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cx('flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition cursor-pointer', tab === id ? 'bg-white/10 text-white' : 'text-neutral-400 hover:text-white')}>
            <Icon className="h-3.5 w-3.5" />{label}
          </button>
        ))}
      </div>

      {tab === 'colors' && (
        <div className="space-y-5">
          <div>
            <span className="mb-2 block text-xs font-medium text-neutral-300">Готовые палитры</span>
            <div className="flex flex-wrap gap-2">
              {THEME_PRESETS.map((p) => (
                <button key={p.id} onClick={() => edit((t) => ({ ...t, colors: { ...t.colors, ...p.colors } }))} className="flex items-center gap-2 rounded-lg border border-white/10 px-2.5 py-1.5 text-xs text-neutral-200 transition hover:border-[#00f2ff]/50 hover:bg-white/[0.04] cursor-pointer">
                  <span className="flex -space-x-1">
                    {[p.colors.accent, p.colors.bg, p.colors.surface, p.colors.text].map((c, i) => <span key={i} className="h-3.5 w-3.5 rounded-full border border-white/20" style={{ background: c }} />)}
                  </span>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {(Object.keys(COLOR_LABELS) as (keyof ThemeColors)[]).map((k) => (
              <React.Fragment key={k}>
                <ColorField label={COLOR_LABELS[k].label} hint={COLOR_LABELS[k].hint} value={theme.colors[k]} onChange={(v) => setColor(k, v)} />
              </React.Fragment>
            ))}
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-500">Оттенки серого, красного, зелёного и жёлтого, рамки и полупрозрачные слои считаются автоматически от этих цветов. Любой другой цвет можно переопределить ниже.</p>

          <div className="border-t border-white/[0.07] pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-300">Дополнительные переменные ({theme.extraVars.length}/{MAX_EXTRA_VARS})</span>
              <Button size="sm" disabled={theme.extraVars.length >= MAX_EXTRA_VARS} onClick={() => edit((t) => ({ ...t, extraVars: [...t.extraVars, { name: '--color-sky-400', value: '#38bdf8' }] }))} icon={<Plus className="h-3.5 w-3.5" />}>Добавить</Button>
            </div>
            <p className="mb-3 text-[11px] leading-relaxed text-neutral-500">Любая CSS-переменная: например <code className="text-neutral-300">--color-sky-400</code> меняет весь «sky-400» Tailwind на сайте, <code className="text-neutral-300">--cb-accent</code> — акцент.</p>
            <div className="space-y-2">
              {theme.extraVars.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <TextInput value={v.name} spellCheck={false} aria-label="Имя переменной" className="font-mono text-xs" onChange={(e) => edit((t) => ({ ...t, extraVars: t.extraVars.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) }))} />
                  <TextInput value={v.value} spellCheck={false} aria-label="Значение" className="font-mono text-xs" onChange={(e) => edit((t) => ({ ...t, extraVars: t.extraVars.map((x, k) => (k === i ? { ...x, value: e.target.value } : x)) }))} />
                  <Button size="sm" variant="danger" aria-label="Удалить переменную" onClick={() => edit((t) => ({ ...t, extraVars: t.extraVars.filter((_, k) => k !== i) }))} icon={<Trash2 className="h-3.5 w-3.5" />} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {tab === 'background' && (
        <div className="space-y-4">
          <Field label="Тип фона">
            <Select value={bg.type} onChange={(e) => setBg({ type: e.target.value as Theme['background']['type'] })}>
              <option value="color">Сплошной цвет («Фон страницы»)</option>
              <option value="gradient">Градиент</option>
              <option value="image">Картинка</option>
              <option value="css">Своё значение CSS background</option>
            </Select>
          </Field>
          {bg.type === 'gradient' && (
            <div className="grid grid-cols-2 gap-3">
              <ColorField label="Начало" value={bg.from} onChange={(v) => setBg({ from: v })} />
              <ColorField label="Конец" value={bg.to} onChange={(v) => setBg({ to: v })} />
              <Field label={`Угол: ${bg.angle}°`}><input type="range" min={0} max={360} value={bg.angle} onChange={(e) => setBg({ angle: Number(e.target.value) })} className="w-full accent-[#00f2ff]" /></Field>
              <Toggle checked={bg.fixed} onChange={(v) => setBg({ fixed: v })} label="Не прокручивать" />
            </div>
          )}
          {bg.type === 'image' && (
            <div className="space-y-3">
              <Field label="Адрес картинки" hint="Загрузите файл или вставьте https://… ссылку.">
                <div className="flex gap-2">
                  <TextInput value={bg.imageUrl} onChange={(e) => setBg({ imageUrl: e.target.value })} placeholder="/theme-assets/… или https://…" spellCheck={false} />
                  <Button onClick={() => pick('image', (a) => setBg({ imageUrl: a.url }))} loading={uploading} icon={<Upload className="h-4 w-4" />}>Файл</Button>
                </div>
              </Field>
              {fontImages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {fontImages.slice(0, 8).map((a) => (
                    <button key={a.name} onClick={() => setBg({ imageUrl: a.url })} title={a.name} className={cx('h-14 w-14 overflow-hidden rounded-lg border cursor-pointer', bg.imageUrl === a.url ? 'border-[#00f2ff]' : 'border-white/10')}>
                      <img src={a.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Масштаб"><Select value={bg.size} onChange={(e) => setBg({ size: e.target.value as Theme['background']['size'] })}><option value="cover">Заполнить</option><option value="contain">Вписать</option><option value="auto">Как есть</option></Select></Field>
                <Field label={`Затемнение: ${bg.dim}%`}><input type="range" min={0} max={90} value={bg.dim} onChange={(e) => setBg({ dim: Number(e.target.value) })} className="w-full accent-[#00f2ff]" /></Field>
              </div>
              <Toggle checked={bg.fixed} onChange={(v) => setBg({ fixed: v })} label="Не прокручивать вместе со страницей" />
            </div>
          )}
          {bg.type === 'css' && (
            <Field label="Значение background" hint="Например: radial-gradient(circle at 30% 20%, #3b0764, #050505) или url(/theme-assets/…). Допустимы только https-адреса и загруженные файлы.">
              <TextArea rows={4} value={bg.css} onChange={(e) => setBg({ css: e.target.value })} spellCheck={false} className="font-mono text-xs" />
            </Field>
          )}
        </div>
      )}

      {tab === 'fonts' && (
        <div className="space-y-5">
          <datalist id="cb-font-families">{fontFamilies.map((f) => <option key={f} value={f} />)}</datalist>
          {(['heading', 'body', 'mono'] as const).map((k) => (
            <React.Fragment key={k}>
              <Field label={{ heading: 'Шрифт заголовков', body: 'Основной шрифт', mono: 'Моноширинный шрифт (кнопки, подписи)' }[k]} hint={k === 'body' ? 'Пусто — стандартный. Укажите имя загруженного или Google-шрифта.' : undefined}>
                <TextInput list="cb-font-families" value={theme.fonts[k]} placeholder="по умолчанию" onChange={(e) => setFonts({ [k]: sanitizeFamily(e.target.value) } as any)} />
              </Field>
            </React.Fragment>
          ))}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Базовый размер, px" hint="Пусто — 16">
              <TextInput type="number" min={12} max={22} value={theme.fonts.baseSize ?? ''} onChange={(e) => setFonts({ baseSize: e.target.value === '' ? null : Number(e.target.value) })} />
            </Field>
            <Toggle checked={theme.fonts.plainHeadings} onChange={(v) => setFonts({ plainHeadings: v })} label="Обычные заголовки" description="Без капса и курсива" />
          </div>

          <div className="border-t border-white/[0.07] pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-300">Свои шрифты ({theme.fonts.custom.length}/12)</span>
              <Button size="sm" loading={uploading} disabled={theme.fonts.custom.length >= 12} icon={<Upload className="h-3.5 w-3.5" />} onClick={() => pick('font', (a) => {
                edit((t) => ({ ...t, fonts: { ...t.fonts, custom: [...t.fonts.custom, { id: `f${Date.now().toString(36)}`, family: `Custom ${t.fonts.custom.length + 1}`, url: a.url, weight: 400, style: 'normal' } as CustomFont] } }));
              })}>Загрузить</Button>
            </div>
            <p className="mb-3 text-[11px] text-neutral-500">woff2, woff, ttf или otf, до 8 МБ. Дайте шрифту имя и впишите его в поля выше.</p>
            <div className="space-y-2">
              {theme.fonts.custom.map((f, i) => (
                <div key={f.id} className="grid grid-cols-[1fr_84px_92px_auto] items-center gap-2">
                  <TextInput value={f.family} aria-label="Имя шрифта" onChange={(e) => edit((t) => ({ ...t, fonts: { ...t.fonts, custom: t.fonts.custom.map((x, k) => (k === i ? { ...x, family: sanitizeFamily(e.target.value) } : x)) } }))} />
                  <Select value={f.weight} aria-label="Насыщенность" onChange={(e) => edit((t) => ({ ...t, fonts: { ...t.fonts, custom: t.fonts.custom.map((x, k) => (k === i ? { ...x, weight: Number(e.target.value) } : x)) } }))}>
                    {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => <option key={w} value={w}>{w}</option>)}
                  </Select>
                  <Select value={f.style} aria-label="Начертание" onChange={(e) => edit((t) => ({ ...t, fonts: { ...t.fonts, custom: t.fonts.custom.map((x, k) => (k === i ? { ...x, style: e.target.value as 'normal' | 'italic' } : x)) } }))}>
                    <option value="normal">обычный</option><option value="italic">курсив</option>
                  </Select>
                  <Button size="sm" variant="danger" aria-label="Убрать шрифт" onClick={() => edit((t) => ({ ...t, fonts: { ...t.fonts, custom: t.fonts.custom.filter((_, k) => k !== i) } }))} icon={<Trash2 className="h-3.5 w-3.5" />} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-white/[0.07] pt-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-medium text-neutral-300">Google Fonts ({theme.fonts.google.length}/6)</span>
              <Button size="sm" disabled={theme.fonts.google.length >= 6} onClick={() => edit((t) => ({ ...t, fonts: { ...t.fonts, google: [...t.fonts.google, { name: 'Roboto', weights: '400;700' }] } }))} icon={<Plus className="h-3.5 w-3.5" />}>Добавить</Button>
            </div>
            <div className="space-y-2">
              {theme.fonts.google.map((g, i) => (
                <div key={i} className="grid grid-cols-[1fr_120px_auto] items-center gap-2">
                  <TextInput value={g.name} aria-label="Название шрифта Google" onChange={(e) => edit((t) => ({ ...t, fonts: { ...t.fonts, google: t.fonts.google.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)) } }))} />
                  <TextInput value={g.weights} aria-label="Насыщенности" placeholder="400;700" onChange={(e) => edit((t) => ({ ...t, fonts: { ...t.fonts, google: t.fonts.google.map((x, k) => (k === i ? { ...x, weights: e.target.value } : x)) } }))} />
                  <Button size="sm" variant="danger" aria-label="Убрать" onClick={() => edit((t) => ({ ...t, fonts: { ...t.fonts, google: t.fonts.google.filter((_, k) => k !== i) } }))} icon={<Trash2 className="h-3.5 w-3.5" />} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-neutral-500">Название должно точно совпадать с каталогом Google Fonts. Насыщенности — только те, что есть у шрифта.</p>
          </div>
        </div>
      )}

      {tab === 'effects' && (
        <div className="space-y-4">
          <div>
            <Toggle checked={theme.shape.radius !== null} onChange={(v) => edit((t) => ({ ...t, shape: { radius: v ? 4 : null } }))} label="Свои скругления" description="Пусто — стандартные (почти прямоугольные)" />
            {theme.shape.radius !== null && (
              <Field label={`Радиус: ${theme.shape.radius}px`}><input type="range" min={0} max={40} value={theme.shape.radius} onChange={(e) => edit((t) => ({ ...t, shape: { radius: Number(e.target.value) } }))} className="w-full accent-[#00f2ff]" /></Field>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Слой поверх страницы">
              <Select value={theme.effects.overlay} onChange={(e) => setFx({ overlay: e.target.value as any })}>
                <option value="none">Нет</option><option value="grid">Сетка</option><option value="noise">Зерно</option><option value="scanlines">Линии ЭЛТ</option><option value="aurora">Северное сияние</option>
              </Select>
            </Field>
            <Field label="Появление блоков">
              <Select value={theme.effects.entrance} onChange={(e) => setFx({ entrance: e.target.value as any })}>
                <option value="none">Нет</option><option value="fade">Проявление</option><option value="fade-up">Снизу вверх</option><option value="zoom">Приближение</option><option value="slide">Слева</option>
              </Select>
            </Field>
            <Field label="Карточки при наведении">
              <Select value={theme.effects.hover} onChange={(e) => setFx({ hover: e.target.value as any })}>
                <option value="none">Нет</option><option value="lift">Приподнять</option><option value="glow">Свечение</option><option value="scale">Увеличить</option>
              </Select>
            </Field>
            <Field label={`Скорость анимаций: ×${theme.effects.speed}`}><input type="range" min={0.25} max={3} step={0.25} value={theme.effects.speed} onChange={(e) => setFx({ speed: Number(e.target.value) })} className="w-full accent-[#00f2ff]" /></Field>
          </div>
          <Field label={`Свечение кнопок: ${theme.effects.glow}px`}><input type="range" min={0} max={60} value={theme.effects.glow} onChange={(e) => setFx({ glow: Number(e.target.value) })} className="w-full accent-[#00f2ff]" /></Field>
          <Toggle checked={theme.effects.smoothScroll} onChange={(v) => setFx({ smoothScroll: v })} label="Плавная прокрутка" />
          <Toggle checked={theme.effects.scrollbar} onChange={(v) => setFx({ scrollbar: v })} label="Полоса прокрутки и выделение в цвет акцента" />
          <p className="text-[11px] text-neutral-500">Анимации отключаются у посетителей, у которых включено «уменьшить движение» в системе.</p>
        </div>
      )}

      {tab === 'css' && (
        <div className="space-y-3">
          <p className="text-xs leading-relaxed text-neutral-400">Любой CSS, без ограничений: он подключается последним и перекрывает всё остальное. Админка этим CSS не затрагивается.</p>
          <TextArea
            rows={18}
            value={theme.customCss}
            spellCheck={false}
            maxLength={MAX_CUSTOM_CSS}
            onChange={(e) => edit((t) => ({ ...t, customCss: e.target.value }))}
            className="font-mono text-xs leading-relaxed"
            placeholder={'.cb-root { /* корневой контейнер страниц */ }\n.bg-cb-accent { border-radius: 999px; }\nh1 { letter-spacing: -0.04em; }'}
            aria-label="Свой CSS"
          />
          <div className="flex items-center justify-between text-[11px] text-neutral-500">
            <span>Переменные: <code className="text-neutral-300">--cb-accent --cb-bg --cb-surface --cb-text --cb-muted</code></span>
            <span>{theme.customCss.length} / {MAX_CUSTOM_CSS}</span>
          </div>
          <p className="text-[11px] leading-relaxed text-neutral-500">
            Внешние файлы подключаются через <code className="text-neutral-300">@import url(https://…)</code>; на боевом сервере политика безопасности разрешает стили только с этого сайта и fonts.googleapis.com. Скрипты (JS) тема не поддерживает.
          </p>
        </div>
      )}

      {tab === 'files' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-neutral-400">Загруженные файлы темы</span>
            <Button size="sm" loading={uploading} icon={<Upload className="h-3.5 w-3.5" />} onClick={() => pick('any')}>Загрузить</Button>
          </div>
          {assets.length === 0 ? <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-xs text-neutral-500">Файлов пока нет.</p> : (
            <ul className="divide-y divide-white/[0.06]">
              {assets.map((a) => (
                <li key={a.name} className="flex items-center gap-3 py-2.5">
                  {a.kind === 'image' ? <img src={a.url} alt="" className="h-10 w-10 rounded-md border border-white/10 object-cover" /> : <span className="flex h-10 w-10 items-center justify-center rounded-md border border-white/10 text-sm font-semibold">Aa</span>}
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-mono text-xs text-neutral-200">{a.name}</div>
                    <div className="text-[11px] text-neutral-500">{formatBytes(a.size)} <Badge>{a.kind === 'font' ? 'шрифт' : 'картинка'}</Badge></div>
                  </div>
                  <Button size="sm" variant="ghost" aria-label="Скопировать адрес" onClick={() => { navigator.clipboard?.writeText(a.url); notify('info', `Скопировано: ${a.url}`); }} icon={<Copy className="h-3.5 w-3.5" />} />
                  <Button size="sm" variant="danger" aria-label="Удалить файл" onClick={() => removeAsset(a)} icon={<Trash2 className="h-3.5 w-3.5" />} />
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-neutral-500">Адрес файла можно использовать в своём CSS: <code className="text-neutral-300">url(/theme-assets/…)</code>.</p>
        </div>
      )}

      <input ref={fileRef} type="file" accept=".woff2,.woff,.ttf,.otf,.png,.jpg,.jpeg,.webp,.gif,.avif" className="hidden" onChange={onFile} />
    </div>
  );
}
