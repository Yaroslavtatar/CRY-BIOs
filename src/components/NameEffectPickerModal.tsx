import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { NameEffect } from '../types';
import { NAME_EFFECT_CATALOG, NAME_EFFECT_GROUPS, getNameEffectEntry, type NameEffectEntry } from '../utils/nameEffectCatalog';
import { getNameEffectClasses, getNameEffectStyle, type NameEffectOptions } from '../utils/nameEffects';
import NameSparkOverlay from './NameSparkOverlay';
import NameText from './NameText';
import { PickerShell, SliderRow } from './PickerControls';

export interface NameEffectSelection {
  effect: NameEffect;
  color?: string;
  color2?: string;
  speed?: number;
}

interface NameEffectPickerModalProps {
  open: boolean;
  value: NameEffect;
  options?: NameEffectOptions;
  previewText: string;
  onClose: () => void;
  onSave: (selection: NameEffectSelection) => void;
}

/** Имя с эффектом: единое место, где собираются классы, переменные, буквы и ауры */
export function EffectName({
  effect, text, options, size = 'text-[13px]', fps,
}: {
  effect: NameEffect;
  text: string;
  options?: NameEffectOptions;
  size?: string;
  fps?: number;
}) {
  return (
    <span className="relative inline-block isolate max-w-full">
      <NameSparkOverlay effect={effect} textLength={text.length} options={options} fps={fps} />
      <span
        className={`relative z-10 font-bold whitespace-nowrap ${size} ${getNameEffectClasses(effect, text)}`}
        style={getNameEffectStyle(effect, text, options)}
      >
        <NameText effect={effect} text={text} />
      </span>
    </span>
  );
}

function Tile({ entry, sample, selected, onSelect }: { entry: NameEffectEntry; sample: string; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      aria-label={entry.label}
      title={entry.hint}
      className={`relative h-[84px] w-full rounded-md border bg-black/60 overflow-hidden transition cursor-pointer flex flex-col items-center justify-center ${
        selected ? 'border-[#a855f7] ring-1 ring-[#a855f7]/60' : 'border-white/10 hover:border-white/30'
      }`}
    >
      <span className="flex-1 flex items-center justify-center px-2 max-w-full pt-1">
        {entry.id === 'none' ? (
          <span className="text-neutral-500 text-[10px] font-mono uppercase">Нет</span>
        ) : (
          <EffectName effect={entry.id} text={sample} fps={24} />
        )}
      </span>
      <span className="w-full px-1.5 pb-1.5 text-[9px] text-neutral-500 truncate text-center">{entry.label}</span>
    </button>
  );
}

export default function NameEffectPickerModal({ open, value, options, previewText, onClose, onSave }: NameEffectPickerModalProps) {
  const [effect, setEffect] = useState<NameEffect>(value);
  const [color, setColor] = useState<string | undefined>(options?.color);
  const [color2, setColor2] = useState<string | undefined>(options?.color2);
  const [speed, setSpeed] = useState<number>(options?.speed ?? 1);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setEffect(value);
      setColor(options?.color);
      setColor2(options?.color2);
      setSpeed(options?.speed ?? 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  const sample = useMemo(() => (previewText || 'CRYTEAM').slice(0, 9), [previewText]);

  if (!open) return null;

  const entry = getNameEffectEntry(effect);
  const draftOptions: NameEffectOptions = { color, color2, speed };
  const select = (id: NameEffect) => {
    setEffect(id);
    // у нового эффекта свои цвета по умолчанию — старые настройки не переносим
    setColor(undefined);
    setColor2(undefined);
    setSpeed(1);
  };
  const colorsAllowed = entry?.colors ?? 0;
  const hex = (c: string | undefined, fallback: string) => (c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback);
  const customized = color !== undefined || color2 !== undefined || speed !== 1;

  const jump = (group: string) => gridRef.current?.querySelector(`[data-group="${group}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const grid = (
    <div ref={gridRef}>
      <div className="flex flex-wrap gap-1.5 mb-3 sticky top-0 z-20 bg-[#0a0a0a]/95 backdrop-blur py-1 -mt-1">
        {NAME_EFFECT_GROUPS.map((g) => (
          <button
            key={g}
            type="button"
            onClick={() => jump(g)}
            className="px-2.5 py-1 rounded-full border border-white/10 bg-white/5 hover:border-[#a855f7]/60 text-[10px] font-bold text-neutral-300 cursor-pointer"
          >
            {g}
          </button>
        ))}
      </div>
      {NAME_EFFECT_GROUPS.map((group) => {
        const items = NAME_EFFECT_CATALOG.filter((e) => e.group === group);
        return (
          <section key={group} data-group={group} className="mb-5 scroll-mt-12">
            <h4 className="text-[10px] uppercase tracking-widest font-black text-neutral-500 mb-2">
              {group} <span className="text-neutral-700">· {items.length}</span>
            </h4>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {items.map((e) => (
                <React.Fragment key={e.id}>
                  <Tile entry={e} sample={e.id === 'typewriter' ? 'CRY' : sample} selected={effect === e.id} onSelect={() => select(e.id)} />
                </React.Fragment>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );

  const side = (
    <>
      <div className="relative h-[150px] rounded-md border border-white/10 bg-gradient-to-b from-[#16161d] to-[#08080b] flex items-center justify-center overflow-hidden flex-shrink-0 px-4">
        {effect === 'none' ? (
          <span className="text-white font-bold text-3xl drop-shadow-md">{sample}</span>
        ) : (
          <React.Fragment key={`${effect}-${color}-${color2}`}>
            <EffectName effect={effect} text={sample} options={draftOptions} size="text-[34px]" />
          </React.Fragment>
        )}
      </div>
      <div>
        <p className="text-sm font-bold text-white">{entry?.label || 'Без эффекта'}</p>
        <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">{entry?.hint || 'Обычный белый текст без анимации.'}</p>
      </div>

      {effect !== 'none' && (
        <div className="space-y-3 pt-1">
          {colorsAllowed >= 1 && (
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-neutral-500">
                {colorsAllowed >= 2 ? 'Цвет 1' : 'Цвет'}
                <input
                  type="color"
                  aria-label="Основной цвет"
                  value={hex(color, entry?.a || (entry?.aura?.palette?.[0] ?? '#ffffff'))}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-9 h-7 bg-transparent border border-white/15 rounded cursor-pointer"
                />
              </label>
              {colorsAllowed >= 2 && (
                <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-neutral-500">
                  Цвет 2
                  <input
                    type="color"
                    aria-label="Второй цвет"
                    value={hex(color2, entry?.b || '#ffffff')}
                    onChange={(e) => setColor2(e.target.value)}
                    className="w-9 h-7 bg-transparent border border-white/15 rounded cursor-pointer"
                  />
                </label>
              )}
            </div>
          )}
          {entry?.speed && (
            <SliderRow label="Скорость" value={speed} min={0.3} max={3} step={0.1} onChange={setSpeed} format={(v) => `×${v.toFixed(1)}`} />
          )}
          {colorsAllowed === 0 && !entry?.speed && (
            <p className="text-[10px] text-neutral-600">У этого эффекта фиксированный вид.</p>
          )}
          {customized && (
            <button
              type="button"
              onClick={() => { setColor(undefined); setColor2(undefined); setSpeed(1); }}
              className="text-[10px] font-black uppercase text-[#a855f7] hover:underline cursor-pointer"
            >
              Сбросить настройки
            </button>
          )}
        </div>
      )}
    </>
  );

  return (
    <PickerShell
      title="Эффекты ника"
      onClose={onClose}
      onSave={() => { onSave({ effect, color, color2, speed: speed === 1 ? undefined : speed }); onClose(); }}
      grid={grid}
      side={side}
    />
  );
}
