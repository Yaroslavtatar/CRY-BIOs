import React, { useEffect, useMemo, useState } from 'react';
import { FX_CATALOG, FX_PRESETS, DEFAULT_FX, clampSettings, type FxSettings, type FxType, type FxMouseMode, type FxColorMode } from '../fx/engine';
import ParticleField from './ParticleField';
import { PickerShell, SliderRow, Segmented, ToggleRow } from './PickerControls';

interface FxPickerModalProps {
  open: boolean;
  /** Текущие настройки; null — частицы выключены */
  value: FxSettings | null;
  onClose: () => void;
  /** null — выключить частицы */
  onSave: (settings: FxSettings | null) => void;
}

const MOUSE_OPTIONS: { id: FxMouseMode; label: string; title: string }[] = [
  { id: 'off', label: 'Нет', title: 'Курсор не влияет на частицы' },
  { id: 'wind', label: 'Ветер', title: 'Курсор справа — частицы летят вправо, слева — влево' },
  { id: 'repel', label: 'Отталкивать', title: 'Частицы разлетаются от курсора' },
  { id: 'attract', label: 'Притягивать', title: 'Частицы тянутся к курсору' },
];

const COLOR_OPTIONS: { id: FxColorMode; label: string; title: string }[] = [
  { id: 'preset', label: 'Родной', title: 'Естественные цвета этого эффекта' },
  { id: 'custom', label: 'Свой цвет', title: 'Все частицы в оттенках выбранного цвета' },
  { id: 'rainbow', label: 'Радуга', title: 'Каждая частица своего цвета' },
];

function Tile({ type, selected, onSelect }: { type: FxType; selected: boolean; onSelect: () => void }) {
  const preset = FX_PRESETS[type];
  // В крошечной плитке частицы мельче и гуще, иначе эффект не читается
  const settings = useMemo<FxSettings>(() => ({ ...DEFAULT_FX, type, size: 0.5, count: type === 'rain' ? 18 : type === 'bubbles' || type === 'leaves' || type === 'petals' ? 10 : 16 }), [type]);
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={preset.label}
      className={`group relative h-[84px] w-full rounded-md border bg-gradient-to-b from-[#0d0f1a] to-black overflow-hidden transition cursor-pointer text-left ${
        selected ? 'border-[#a855f7] ring-1 ring-[#a855f7]/60' : 'border-white/10 hover:border-white/30'
      }`}
    >
      <ParticleField settings={settings} fps={30} className="absolute inset-0 w-full h-full" />
      <span className="absolute left-0 right-0 bottom-0 px-2 py-1 text-[10px] font-bold text-white bg-gradient-to-t from-black/85 to-transparent flex items-center gap-1">
        <span aria-hidden>{preset.emoji}</span>
        <span className="truncate">{preset.label}</span>
      </span>
    </button>
  );
}

export default function FxPickerModal({ open, value, onClose, onSave }: FxPickerModalProps) {
  const [draft, setDraft] = useState<FxSettings | null>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  if (!open) return null;

  const active = draft ?? { ...DEFAULT_FX };
  const preset = FX_PRESETS[active.type];
  const patch = (p: Partial<FxSettings>) => setDraft(clampSettings({ ...active, ...p }));
  const pick = (type: FxType) => setDraft(clampSettings({ ...(draft ?? DEFAULT_FX), type }));

  const grid = (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
      <button
        type="button"
        onClick={() => setDraft(null)}
        aria-pressed={draft === null}
        className={`h-[84px] rounded-md border flex items-center justify-center text-[11px] font-mono uppercase text-neutral-400 cursor-pointer transition ${
          draft === null ? 'border-[#a855f7] ring-1 ring-[#a855f7]/60 bg-black/60' : 'border-white/10 bg-black/40 hover:border-white/30'
        }`}
      >
        Без частиц
      </button>
      {FX_CATALOG.map((p) => (
        <React.Fragment key={p.id}>
          <Tile type={p.id} selected={draft !== null && draft.type === p.id} onSelect={() => pick(p.id)} />
        </React.Fragment>
      ))}
    </div>
  );

  const side = (
    <>
      <div className="relative h-[210px] rounded-md border border-white/10 bg-gradient-to-b from-[#12141f] to-[#07080d] overflow-hidden flex-shrink-0">
        {draft ? (
          <ParticleField settings={draft} interactive="parent" className="absolute inset-0 w-full h-full" />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-neutral-600 font-mono uppercase">Частицы выключены</div>
        )}
        <span className="absolute bottom-1.5 left-2 text-[9px] text-neutral-600 pointer-events-none">
          {draft && draft.mouse !== 'off' ? 'Подвигайте курсором по окну' : ''}
        </span>
      </div>

      <div>
        <p className="text-sm font-bold text-white">{draft ? `${preset.emoji} ${preset.label}` : 'Без частиц'}</p>
        <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
          {draft ? preset.hint : 'Фон без падающих частиц. Выберите эффект слева.'}
        </p>
      </div>

      {draft && (
        <div className="space-y-3 pt-1">
          <Segmented label="Цвет" value={draft.colorMode} options={COLOR_OPTIONS} onChange={(colorMode) => patch({ colorMode, ...(colorMode === 'custom' && draft.color === DEFAULT_FX.color && preset.palette[0] ? { color: preset.palette[0] } : {}) })} />
          {draft.colorMode === 'custom' && (
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label="Цвет частиц"
                value={/^#[0-9a-f]{6}$/i.test(draft.color) ? draft.color : '#ffffff'}
                onChange={(e) => patch({ color: e.target.value })}
                className="w-9 h-7 bg-transparent border border-white/15 rounded cursor-pointer"
              />
              <span className="text-[10px] font-mono text-neutral-400">{draft.color}</span>
            </div>
          )}

          <SliderRow label="Ветер" value={draft.wind} min={-1} max={1} step={0.05} onChange={(wind) => patch({ wind })}
            leftHint="← влево" rightHint="вправо →" format={(v) => (Math.abs(v) < 0.03 ? 'штиль' : v > 0 ? `→ ${Math.round(v * 100)}%` : `← ${Math.round(-v * 100)}%`)} />
          <Segmented label="Мышка" columns={2} value={draft.mouse} options={MOUSE_OPTIONS} onChange={(mouse) => patch({ mouse })} />
          <p className="text-[9px] text-neutral-600 -mt-2 leading-snug">
            «Ветер»: курсор в правой части экрана — частицы летят вправо, в левой — влево. Работает и в предпросмотре выше.
          </p>

          <SliderRow label="Скорость" value={draft.speed} min={0.3} max={3} step={0.1} onChange={(speed) => patch({ speed })} format={(v) => `×${v.toFixed(1)}`} />
          <SliderRow label="Плотность" value={draft.density} min={0.2} max={2.5} step={0.1} onChange={(density) => patch({ density })} format={(v) => `×${v.toFixed(1)}`} />
          <SliderRow label="Размер" value={draft.size} min={0.5} max={2} step={0.1} onChange={(size) => patch({ size })} format={(v) => `×${v.toFixed(1)}`} />
          <SliderRow label="Покачивание" value={draft.sway} min={0} max={2} step={0.1} onChange={(sway) => patch({ sway })} format={(v) => (v === 0 ? 'нет' : `×${v.toFixed(1)}`)} />
          <ToggleRow label="Обратная гравитация" hint="Снег летит вверх, пузыри — вниз" checked={draft.reverse} onChange={(reverse) => patch({ reverse })} />
        </div>
      )}
    </>
  );

  return <PickerShell title="Частицы на фоне" onClose={onClose} onSave={() => { onSave(draft); onClose(); }} grid={grid} side={side} />;
}
