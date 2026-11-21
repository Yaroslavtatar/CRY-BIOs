/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import {
  AlignHorizontalJustifyCenter,
  AlignHorizontalJustifyEnd,
  AlignHorizontalJustifyStart,
  BringToFront,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Grid3x3,
  Layers,
  Loader2,
  Lock,
  Monitor,
  Plus,
  Redo2,
  RotateCcw,
  Save,
  SendToBack,
  SlidersHorizontal,
  Smartphone,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import BioPage from './BioPage';
import type { CanvasEditorProps } from './CanvasStage';
import { BLOCK_TYPES, createDefaultBlock } from '../blockDefaults';
import {
  alignFrame,
  clampFrame,
  listElements,
  reconcileDevice,
  reorderZ,
  resetDeviceLayout,
  withDeviceLayout,
  type AlignMode,
  type CanvasDevice,
  type ZMode,
} from '../canvasLayout';
import type { BioConfig, BlockConfig, CanvasFrame } from '../types';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { isTourDone, markTourDone, resetTour, useStudioPrefs } from '../studioPrefs';

interface CanvasStudioProps {
  config: BioConfig;
  username: string;
  onChange: (config: BioConfig) => void;
  onClose: () => void;
  onSave: () => void;
  saveStatus: 'idle' | 'saving' | 'success' | 'error';
}

type PanelTab = 'elements' | 'props' | 'page';

const TOUR = [
  { title: 'Это ваша страница', text: 'Каждый элемент — аватар, ник, блоки — можно двигать куда угодно. Коснитесь элемента, чтобы выбрать его.' },
  { title: 'Двигайте и растягивайте', text: 'Тяните выбранный элемент пальцем или мышью, за кружки по краям меняйте размер. На телефоне первое касание выбирает, второе — двигает; страница при этом листается.' },
  { title: 'ПК и телефон отдельно', text: 'Переключатель вверху меняет вид. Раскладка телефона собирается сама, а если подвинуть элементы в режиме «Телефон» — станет вашей собственной.' },
  { title: 'Панель внизу', text: 'Во вкладке «Элементы» добавляйте блоки, скрывайте и блокируйте их. «Свойства» — точные координаты и текст, «Страница» — сетка и стиль студии. Не забудьте нажать «Сохранить».' },
];

const HISTORY_LIMIT = 100;
const COALESCE_MS = 1000;

const iconBtn =
  'inline-flex items-center justify-center w-11 h-11 lg:w-9 lg:h-9 [.studio-large_&]:w-12 [.studio-large_&]:h-12 [.studio-large_&]:lg:w-12 [.studio-large_&]:lg:h-12 rounded-sm bg-white/5 text-neutral-300 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:pointer-events-none transition shrink-0';
const fieldCls =
  'w-full bg-black/50 border border-white/15 focus:border-cb-accent/80 focus:outline-none px-2 py-1.5 rounded-sm font-mono text-xs text-white';

function NumberField({ label, value, placeholder, onChange, min, max, step = 1 }: {
  label: string;
  value: number | undefined;
  placeholder?: string;
  onChange: (v: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <label className="block">
      <span className="block text-[9px] uppercase tracking-wider font-bold text-neutral-500 mb-1">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        className={fieldCls}
        value={value === undefined ? '' : Math.round(value)}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        onChange={(e) => {
          const raw = e.target.value;
          if (raw === '') return onChange(undefined);
          const n = Number(raw);
          if (Number.isFinite(n)) onChange(n);
        }}
      />
    </label>
  );
}

export default function CanvasStudio({ config, username, onChange, onClose, onSave, saveStatus }: CanvasStudioProps) {
  const isDesktopViewport = useMediaQuery('(min-width: 1024px)');
  const [device, setDevice] = useState<CanvasDevice>(() => (typeof window !== 'undefined' && window.innerWidth >= 1024 ? 'desktop' : 'mobile'));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tab, setTab] = useState<PanelTab>('elements');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [prefs, setPrefs] = useStudioPrefs();
  const showGrid = prefs.showGrid;
  const [tourStep, setTourStep] = useState<number | null>(() => (isTourDone() ? null : 0));
  const big = prefs.controls === 'large';
  const scrollRef = useRef<HTMLDivElement>(null);

  // ── история ──
  const configRef = useRef(config);
  configRef.current = config;
  const past = useRef<BioConfig[]>([]);
  const future = useRef<BioConfig[]>([]);
  const gestureBase = useRef<BioConfig | null>(null);
  const coalesce = useRef<{ key: string; t: number } | null>(null);
  const [, bump] = useReducer((n: number) => n + 1, 0);

  const pushHistory = useCallback((base: BioConfig) => {
    past.current.push(base);
    if (past.current.length > HISTORY_LIMIT) past.current.shift();
    future.current = [];
    bump();
  }, []);

  const applyLive = useCallback((next: BioConfig) => {
    if (!gestureBase.current) gestureBase.current = configRef.current;
    configRef.current = next;
    onChange(next);
  }, [onChange]);

  const finishGesture = useCallback(() => {
    const base = gestureBase.current;
    gestureBase.current = null;
    if (base && base !== configRef.current) pushHistory(base);
  }, [pushHistory]);

  /** Обычное изменение с записью в историю; одинаковые key в пределах секунды сливаются в один шаг */
  const commit = useCallback((next: BioConfig, key?: string) => {
    const now = Date.now();
    const c = coalesce.current;
    if (!(key && c && c.key === key && now - c.t < COALESCE_MS)) pushHistory(configRef.current);
    coalesce.current = key ? { key, t: now } : null;
    configRef.current = next;
    onChange(next);
  }, [onChange, pushHistory]);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (!prev) return;
    future.current.push(configRef.current);
    coalesce.current = null;
    configRef.current = prev;
    onChange(prev);
    bump();
  }, [onChange]);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (!next) return;
    past.current.push(configRef.current);
    coalesce.current = null;
    configRef.current = next;
    onChange(next);
    bump();
  }, [onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')) return;
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
      else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redo(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // ── данные ──
  const elements = useMemo(() => listElements(config), [config]);
  const labels = useMemo(() => new Map(elements.map((e) => [e.id, e.label])), [elements]);
  const layout = useMemo(() => reconcileDevice(config, device), [config, device]);
  const canvas = config.canvas;
  const snap = canvas?.snap !== false;
  const grid = canvas?.grid ?? 8;
  const selected = selectedId ? layout.frames[selectedId] : undefined;
  const selectedElement = selectedId ? elements.find((e) => e.id === selectedId) : undefined;

  useEffect(() => {
    if (selectedId && !layout.frames[selectedId]) setSelectedId(null);
  }, [selectedId, layout]);

  const buildNext = useCallback((cfg: BioConfig, id: string, mutate: (f: CanvasFrame) => CanvasFrame): BioConfig => {
    const l = reconcileDevice(cfg, device);
    const cur = l.frames[id];
    if (!cur) return cfg;
    const nf = clampFrame(mutate(cur), device);
    return withDeviceLayout(cfg, device, { ...l, frames: { ...l.frames, [id]: nf } });
  }, [device]);

  const onChangeFrame = useCallback((id: string, patch: Partial<CanvasFrame>, isCommit: boolean) => {
    const cfg = configRef.current;
    const empty = Object.keys(patch).length === 0;
    if (!isCommit) {
      applyLive(buildNext(cfg, id, (f) => ({ ...f, ...patch })));
      return;
    }
    if (gestureBase.current) {
      if (!empty) applyLive(buildNext(cfg, id, (f) => ({ ...f, ...patch })));
      finishGesture();
      return;
    }
    if (empty) return;
    commit(buildNext(cfg, id, (f) => ({ ...f, ...patch })), `frame:${id}`);
  }, [applyLive, buildNext, commit, finishGesture]);

  const setFrame = (id: string, mutate: (f: CanvasFrame) => CanvasFrame, key?: string) => {
    commit(buildNext(configRef.current, id, mutate), key ?? `frame:${id}`);
  };

  const doAlign = (mode: AlignMode) => selectedId && setFrame(selectedId, (f) => alignFrame(f, device, mode), `align:${selectedId}`);

  const doZ = (mode: ZMode) => {
    if (!selectedId) return;
    const cfg = configRef.current;
    const l = reconcileDevice(cfg, device);
    commit(withDeviceLayout(cfg, device, { ...l, frames: reorderZ(l.frames, selectedId, mode) }));
  };

  const updateBlock = (blockId: string, patch: Partial<BlockConfig>, key: string) => {
    const cfg = configRef.current;
    commit({ ...cfg, blocks: cfg.blocks.map((b) => (b.id === blockId ? { ...b, ...patch } : b)) }, key);
  };

  const addBlock = (type: BlockConfig['type']) => {
    const cfg = configRef.current;
    const block = createDefaultBlock(type);
    commit({ ...cfg, blocks: [...cfg.blocks, block] });
    const id = `block:${block.id}`;
    setSelectedId(id);
    setTab('props');
    requestAnimationFrame(() => requestAnimationFrame(() => {
      scrollRef.current?.querySelector(`[data-canvas-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }));
  };

  const deleteSelectedBlock = () => {
    if (!selectedElement?.block) return;
    const cfg = configRef.current;
    commit({ ...cfg, blocks: cfg.blocks.filter((b) => b.id !== selectedElement.block!.id) });
    setSelectedId(null);
  };

  const setCanvasOption = (patch: Partial<NonNullable<BioConfig['canvas']>>) => {
    const cfg = configRef.current;
    if (!cfg.canvas) return;
    commit({ ...cfg, canvas: { ...cfg.canvas, ...patch } }, 'canvas-opt');
  };

  const selectFromList = (id: string) => {
    setSelectedId(id);
    setTab('props');
    scrollRef.current?.querySelector(`[data-canvas-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  };

  const editor: CanvasEditorProps = useMemo(() => ({
    selectedId,
    onSelect: setSelectedId,
    onChangeFrame,
    snap,
    grid,
    showGrid,
    largeHandles: big,
    labelFor: (id: string) => labels.get(id) ?? id,
  }), [selectedId, onChangeFrame, snap, grid, showGrid, big, labels]);

  const previewConfig = useMemo(
    () => ({ ...config, mobileOptimized: device === 'mobile' ? true : config.mobileOptimized }),
    [config, device],
  );

  const panelOpen = isDesktopViewport || sheetOpen;
  const selLabel = selectedId ? labels.get(selectedId) ?? selectedId : null;

  // ── панели ──
  const renderQuickContent = () => {
    const b = selectedElement?.block;
    if (b) {
      const k = (f: string) => `blk:${b.id}:${f}`;
      return (
        <div className="space-y-2">
          <span className="block text-[9px] uppercase tracking-wider font-bold text-neutral-500">Содержимое</span>
          {b.type === 'textbox' && (
            <textarea className={`${fieldCls} min-h-[72px]`} value={b.textboxContent ?? ''} onChange={(e) => updateBlock(b.id, { textboxContent: e.target.value }, k('t'))} />
          )}
          {b.type === 'quote' && (
            <>
              <textarea className={`${fieldCls} min-h-[72px]`} value={b.quoteText ?? ''} onChange={(e) => updateBlock(b.id, { quoteText: e.target.value }, k('q'))} />
              <input className={fieldCls} placeholder="Автор" value={b.quoteAuthor ?? ''} onChange={(e) => updateBlock(b.id, { quoteAuthor: e.target.value }, k('a'))} />
            </>
          )}
          {b.type === 'image' && (
            <input className={fieldCls} placeholder="https://… ссылка на картинку" value={b.imageUrl ?? ''} onChange={(e) => updateBlock(b.id, { imageUrl: e.target.value }, k('i'))} />
          )}
          {b.type === 'embed' && (
            <input className={fieldCls} placeholder="https://… ссылка" value={b.embedUrl ?? ''} onChange={(e) => updateBlock(b.id, { embedUrl: e.target.value }, k('e'))} />
          )}
          {b.type === 'status_api' && (
            <input className={fieldCls} placeholder="Текст статуса" value={b.statusCustomText ?? ''} onChange={(e) => updateBlock(b.id, { statusCustomText: e.target.value }, k('s'))} />
          )}
          {b.type === 'html' && (
            <textarea className={`${fieldCls} min-h-[96px]`} value={b.htmlContent ?? ''} onChange={(e) => updateBlock(b.id, { htmlContent: e.target.value }, k('h'))} />
          )}
          {(b.type === 'socials' || b.type === 'views_counter') && (
            <p className="text-[10px] text-neutral-500 font-sans leading-snug">
              {b.type === 'socials' ? 'Ссылки редактируются во вкладке «Блоки» панели управления.' : 'У этого блока нет текстовых настроек.'}
            </p>
          )}
        </div>
      );
    }
    if (selectedId === 'username') {
      return (
        <label className="block space-y-1">
          <span className="block text-[9px] uppercase tracking-wider font-bold text-neutral-500">Отображаемое имя</span>
          <input className={fieldCls} value={config.displayName} onChange={(e) => commit({ ...configRef.current, displayName: e.target.value }, 'displayName')} />
        </label>
      );
    }
    if (selectedId === 'bio') {
      return (
        <label className="block space-y-1">
          <span className="block text-[9px] uppercase tracking-wider font-bold text-neutral-500">О себе</span>
          <textarea className={`${fieldCls} min-h-[72px]`} value={config.bio} onChange={(e) => commit({ ...configRef.current, bio: e.target.value }, 'bio')} />
        </label>
      );
    }
    if (selectedId === 'location') {
      return (
        <label className="block space-y-1">
          <span className="block text-[9px] uppercase tracking-wider font-bold text-neutral-500">Локация</span>
          <input className={fieldCls} value={config.locationText ?? ''} onChange={(e) => commit({ ...configRef.current, locationText: e.target.value }, 'location')} />
        </label>
      );
    }
    return null;
  };

  const renderProps = () => {
    if (!selectedId || !selected) {
      return <p className="text-[11px] text-neutral-500 font-sans leading-relaxed">Выберите элемент на странице или в списке — здесь появятся его размер, положение и слои.</p>;
    }
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <NumberField label="X" value={selected.x} onChange={(v) => v !== undefined && setFrame(selectedId, (f) => ({ ...f, x: v }), `x:${selectedId}`)} />
          <NumberField label="Y" value={selected.y} onChange={(v) => v !== undefined && setFrame(selectedId, (f) => ({ ...f, y: v }), `y:${selectedId}`)} />
          <NumberField label="Ширина" value={selected.w} min={24} onChange={(v) => v !== undefined && setFrame(selectedId, (f) => ({ ...f, w: v }), `w:${selectedId}`)} />
          <NumberField
            label="Высота"
            value={selected.h}
            placeholder="авто"
            min={16}
            onChange={(v) => setFrame(selectedId, (f) => {
              if (v === undefined) {
                const { h: _h, ...rest } = f;
                return rest;
              }
              return { ...f, h: v };
            }, `h:${selectedId}`)}
          />
        </div>
        <label className="block">
          <span className="flex justify-between text-[9px] uppercase tracking-wider font-bold text-neutral-500 mb-1">
            <span>Поворот</span>
            <span className="text-neutral-400">{selected.rotate ?? 0}°</span>
          </span>
          <input
            type="range"
            min={-180}
            max={180}
            step={1}
            value={selected.rotate ?? 0}
            onChange={(e) => setFrame(selectedId, (f) => ({ ...f, rotate: Number(e.target.value) }), `rot:${selectedId}`)}
            className="w-full accent-cyan-400"
          />
        </label>
        {renderQuickContent()}
      </div>
    );
  };

  const renderElements = () => (
    <div className="space-y-4">
      <div className="space-y-1">
        {elements.map((el) => {
          const f = layout.frames[el.id];
          const active = selectedId === el.id;
          return (
            <div key={el.id} className={`flex items-center gap-1 rounded-sm border ${active ? 'border-cb-accent/70 bg-cb-accent/10' : 'border-white/10 bg-black/30'}`}>
              <button type="button" onClick={() => selectFromList(el.id)} className="flex-1 min-w-0 text-left px-2.5 py-2 text-xs font-mono truncate">
                {el.label}
                {el.kind === 'block' && <span className="ml-1.5 text-[9px] text-neutral-500 uppercase">блок</span>}
              </button>
              <button
                type="button"
                aria-label={f?.hidden ? 'Показать' : 'Скрыть'}
                onClick={() => setFrame(el.id, (fr) => ({ ...fr, hidden: !fr.hidden }), `hide:${el.id}`)}
                className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-white"
              >
                {f?.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                type="button"
                aria-label={f?.locked ? 'Разблокировать' : 'Заблокировать'}
                onClick={() => setFrame(el.id, (fr) => ({ ...fr, locked: !fr.locked }), `lock:${el.id}`)}
                className={`w-9 h-9 flex items-center justify-center hover:text-white ${f?.locked ? 'text-cb-accent' : 'text-neutral-600'}`}
              >
                <Lock className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
      <div>
        <span className="block text-[9px] uppercase tracking-wider font-bold text-cb-accent mb-2">Добавить блок</span>
        <div className="flex flex-wrap gap-1.5">
          {BLOCK_TYPES.map((b) => (
            <button
              key={b.type}
              type="button"
              onClick={() => addBlock(b.type)}
              className="inline-flex items-center gap-1 px-2.5 py-2 bg-white/5 hover:bg-cb-accent hover:text-cb-on-accent rounded-sm text-[10px] font-bold font-mono uppercase tracking-wider transition"
            >
              <Plus className="w-3 h-3" />
              {b.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderPage = () => (
    <div className="space-y-4">
      <label className="flex items-center justify-between gap-3 text-xs font-mono">
        <span>Привязка к сетке</span>
        <input type="checkbox" checked={snap} onChange={(e) => setCanvasOption({ snap: e.target.checked })} className="w-5 h-5 accent-cyan-400" />
      </label>
      <label className="flex items-center justify-between gap-3 text-xs font-mono">
        <span>Показывать сетку</span>
        <input type="checkbox" checked={showGrid} onChange={(e) => setPrefs({ showGrid: e.target.checked })} className="w-5 h-5 accent-cyan-400" />
      </label>
      <label className="flex items-center justify-between gap-3 text-xs font-mono">
        <span>Шаг сетки</span>
        <select className={`${fieldCls} !w-24`} value={grid} onChange={(e) => setCanvasOption({ grid: Number(e.target.value) })}>
          {[4, 8, 10, 16, 20, 32].map((g) => <option key={g} value={g}>{g}px</option>)}
        </select>
      </label>
      <div className="space-y-2 pt-1">
        <span className="block text-[9px] uppercase tracking-wider font-bold text-cb-accent">Стиль студии</span>
        <div className="grid grid-cols-2 gap-1.5">
          {([['right', 'Панель справа'], ['left', 'Панель слева']] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setPrefs({ panelSide: v })} aria-pressed={prefs.panelSide === v} className={`py-2 rounded-sm text-[10px] font-mono uppercase ${prefs.panelSide === v ? 'bg-cb-accent text-cb-on-accent font-bold' : 'bg-white/5 text-neutral-300'}`}>{l}</button>
          ))}
          {([['normal', 'Обычные кнопки'], ['large', 'Крупные кнопки']] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setPrefs({ controls: v })} aria-pressed={prefs.controls === v} className={`py-2 rounded-sm text-[10px] font-mono uppercase ${prefs.controls === v ? 'bg-cb-accent text-cb-on-accent font-bold' : 'bg-white/5 text-neutral-300'}`}>{l}</button>
          ))}
        </div>
        <button type="button" onClick={() => { resetTour(); setTourStep(0); }} className="w-full py-2 rounded-sm bg-white/5 hover:bg-white/10 text-[10px] font-mono uppercase tracking-wider">Показать подсказки заново</button>
      </div>
      <div className="p-3 rounded-sm bg-white/5 border border-white/10 text-[11px] text-neutral-400 font-sans leading-relaxed">
        Раскладка телефона: <b className="text-white">{canvas?.mobile ? 'настроена вручную' : 'собирается автоматически'}</b>.
        Переключитесь на «Телефон» вверху и подвиньте элементы — она станет отдельной.
      </div>
      <button
        type="button"
        onClick={() => commit(resetDeviceLayout(configRef.current, device))}
        className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-sm bg-white/5 hover:bg-white/10 text-xs font-mono uppercase tracking-wider"
      >
        <RotateCcw className="w-4 h-4" />
        Сбросить раскладку: {device === 'mobile' ? 'телефон' : 'ПК'}
      </button>
      <button
        type="button"
        onClick={() => {
          const cfg = configRef.current;
          if (!cfg.canvas) return;
          commit({ ...cfg, canvas: { ...cfg.canvas, enabled: false } });
          onClose();
        }}
        className="w-full py-2.5 rounded-sm border border-red-500/40 text-red-300 hover:bg-red-500/10 text-xs font-mono uppercase tracking-wider"
      >
        Вернуть обычную раскладку
      </button>
    </div>
  );

  const tabs: { id: PanelTab; label: string; icon: React.ReactNode }[] = [
    { id: 'elements', label: 'Элементы', icon: <Layers className="w-4 h-4" /> },
    { id: 'props', label: 'Свойства', icon: <SlidersHorizontal className="w-4 h-4" /> },
    { id: 'page', label: 'Страница', icon: <Grid3x3 className="w-4 h-4" /> },
  ];

  return (
    <div className={`fixed inset-0 z-[120] flex flex-col bg-[#07070b] text-white h-[100dvh] ${big ? 'studio-large' : ''}`} role="dialog" aria-label="Студия конструктора">
      {/* верхняя панель */}
      <div className="shrink-0 h-14 px-2 sm:px-4 flex items-center gap-1.5 sm:gap-2 bg-cb-surface border-b border-white/10">
        <button type="button" onClick={onClose} className={iconBtn} aria-label="Закрыть студию"><X className="w-4 h-4" /></button>
        <div className="flex gap-1 bg-black/40 p-1 rounded-sm border border-white/10">
          <button type="button" onClick={() => setDevice('desktop')} aria-pressed={device === 'desktop'} className={`inline-flex items-center gap-1.5 px-3 min-h-[40px] lg:min-h-0 lg:px-2.5 lg:py-1.5 text-[10px] uppercase font-bold rounded-sm ${device === 'desktop' ? 'bg-cb-accent text-cb-on-accent' : 'text-neutral-400'}`}>
            <Monitor className="w-3.5 h-3.5" /><span className="hidden sm:inline">ПК</span>
          </button>
          <button type="button" onClick={() => setDevice('mobile')} aria-pressed={device === 'mobile'} className={`inline-flex items-center gap-1.5 px-3 min-h-[40px] lg:min-h-0 lg:px-2.5 lg:py-1.5 text-[10px] uppercase font-bold rounded-sm ${device === 'mobile' ? 'bg-cb-accent text-cb-on-accent' : 'text-neutral-400'}`}>
            <Smartphone className="w-3.5 h-3.5" /><span className="hidden sm:inline">Телефон</span>
          </button>
        </div>
        <div className="flex-1" />
        <button type="button" onClick={undo} disabled={past.current.length === 0} className={iconBtn} aria-label="Отменить"><Undo2 className="w-4 h-4" /></button>
        <button type="button" onClick={redo} disabled={future.current.length === 0} className={iconBtn} aria-label="Повторить"><Redo2 className="w-4 h-4" /></button>
        <button
          type="button"
          onClick={onSave}
          disabled={saveStatus === 'saving'}
          className="inline-flex items-center gap-1.5 px-3 h-11 lg:h-9 rounded-sm bg-cb-accent text-cb-on-accent text-[10px] font-black uppercase tracking-widest disabled:opacity-60"
        >
          {saveStatus === 'saving' ? <Loader2 className="w-4 h-4 animate-spin" /> : saveStatus === 'success' ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
          <span>{saveStatus === 'success' ? 'Сохранено' : saveStatus === 'error' ? 'Ошибка' : 'Сохранить'}</span>
        </button>
      </div>

      <div className={`flex-1 min-h-0 flex flex-col ${prefs.panelSide === 'left' ? 'lg:flex-row-reverse' : 'lg:flex-row'}`}>
        {/* холст */}
        <div ref={scrollRef} className="cb-no-touch flex-1 min-h-0 overflow-auto bg-[#040407]">
          <div
            className={device === 'mobile' ? 'mx-auto w-full max-w-[390px] lg:my-4 lg:border lg:border-white/10 lg:rounded-[1.5rem] lg:overflow-hidden lg:shadow-2xl' : 'w-full'}
            style={{ transform: 'translateZ(0)' }}
          >
            <BioPage
              username={username}
              onExit={() => {}}
              forceMobile={device === 'mobile'}
              previewConfig={previewConfig}
              canvasEditor={editor}
            />
          </div>
        </div>

        {/* панель: справа на ПК, шторка снизу на телефоне */}
        <div className={`shrink-0 flex flex-col bg-cb-surface border-t lg:border-t-0 border-white/10 lg:w-[340px] ${prefs.panelSide === 'left' ? 'lg:border-r' : 'lg:border-l'} ${sheetOpen ? 'h-[46dvh] lg:h-auto' : ''}`}>
          {selectedId && (
            <div className="shrink-0 flex items-center gap-1 px-2 py-1.5 border-b border-white/10 overflow-x-auto">
              <span className="px-2 text-[10px] font-mono font-bold text-cb-accent uppercase truncate max-w-[84px]">{selLabel}</span>
              <button type="button" className={iconBtn} aria-label="По левому краю" onClick={() => doAlign('left')}><AlignHorizontalJustifyStart className="w-4 h-4" /></button>
              <button type="button" className={iconBtn} aria-label="По центру" onClick={() => doAlign('center')}><AlignHorizontalJustifyCenter className="w-4 h-4" /></button>
              <button type="button" className={iconBtn} aria-label="По правому краю" onClick={() => doAlign('right')}><AlignHorizontalJustifyEnd className="w-4 h-4" /></button>
              <button type="button" className={iconBtn} aria-label="На передний план" onClick={() => doZ('front')}><BringToFront className="w-4 h-4" /></button>
              <button type="button" className={iconBtn} aria-label="На задний план" onClick={() => doZ('back')}><SendToBack className="w-4 h-4" /></button>
              <button
                type="button"
                className={`${iconBtn} ${selected?.locked ? '!text-cb-accent' : ''}`}
                aria-label={selected?.locked ? 'Разблокировать' : 'Заблокировать'}
                onClick={() => selectedId && setFrame(selectedId, (f) => ({ ...f, locked: !f.locked }), `lock:${selectedId}`)}
              >
                <Lock className="w-4 h-4" />
              </button>
              <button
                type="button"
                className={iconBtn}
                aria-label={selected?.hidden ? 'Показать' : 'Скрыть'}
                onClick={() => selectedId && setFrame(selectedId, (f) => ({ ...f, hidden: !f.hidden }), `hide:${selectedId}`)}
              >
                {selected?.hidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              {selectedElement?.block && (
                <button type="button" className={`${iconBtn} !text-red-300`} aria-label="Удалить блок" onClick={deleteSelectedBlock}><Trash2 className="w-4 h-4" /></button>
              )}
            </div>
          )}

          <div className="shrink-0 flex items-center border-b border-white/10">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => { setTab(t.id); setSheetOpen(true); }}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 py-3 text-[10px] font-bold font-mono uppercase tracking-wider border-b-2 ${tab === t.id ? 'border-cb-accent text-white' : 'border-transparent text-neutral-500'}`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
            <button type="button" onClick={() => setSheetOpen((v) => !v)} className="lg:hidden w-11 h-11 flex items-center justify-center text-neutral-400" aria-label={sheetOpen ? 'Свернуть панель' : 'Развернуть панель'}>
              {sheetOpen ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
            </button>
          </div>

          {panelOpen && (
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
              {tab === 'elements' && renderElements()}
              {tab === 'props' && renderProps()}
              {tab === 'page' && renderPage()}
            </div>
          )}
        </div>
      </div>

      {tourStep !== null && (
        <div className="absolute inset-0 z-[10] flex items-end sm:items-center justify-center p-4 bg-black/60" role="alertdialog" aria-label="Подсказки">
          <div className="w-full max-w-sm bg-cb-surface border border-cb-accent/40 rounded-sm p-5 space-y-3">
            <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-cb-accent">Шаг {tourStep + 1} из {TOUR.length}</div>
            <h4 className="text-base font-black">{TOUR[tourStep].title}</h4>
            <p className="text-xs text-neutral-300 font-sans leading-relaxed">{TOUR[tourStep].text}</p>
            <div className="flex items-center justify-between gap-2 pt-1">
              <button type="button" onClick={() => { markTourDone(); setTourStep(null); }} className="text-[10px] font-mono uppercase text-neutral-500 hover:text-white px-2 py-2">Пропустить</button>
              <button
                type="button"
                onClick={() => {
                  if (tourStep >= TOUR.length - 1) { markTourDone(); setTourStep(null); } else setTourStep(tourStep + 1);
                }}
                className="px-4 py-2.5 bg-cb-accent text-cb-on-accent text-[10px] font-black uppercase tracking-widest rounded-sm"
              >
                {tourStep >= TOUR.length - 1 ? 'Начать' : 'Дальше'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
