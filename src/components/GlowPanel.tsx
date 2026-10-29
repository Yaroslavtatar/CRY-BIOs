import React from 'react';
import type { BioConfig, GlowStyleId, GlowTarget, CardStyle } from '../types';
import { GLOW_STYLES, GLOW_TARGETS, resolveGlow, DEFAULT_GLOW_TARGETS, glowVars, glowClass } from '../glow';
import { CARD_STYLES, resolveCard } from '../card';
import { GLOW_TARGET_LABELS } from '../dashboardLabels';
import { SliderRow, ToggleRow } from './PickerControls';

type Update = <K extends keyof BioConfig>(key: K, value: BioConfig[K]) => void;

const HEX = /^#[0-9a-f]{6}$/i;
const hex = (c: string | undefined, fallback: string) => (c && HEX.test(c) ? c : fallback);

/** Плитка стиля подсветки с живым образцом: круглый «аватар» светится так же, как будет на странице. */
function StyleTile({ id, label, hint, color, color2, size, speed, selected, onSelect }: {
  id: GlowStyleId; label: string; hint: string; color: string; color2: string; size: number; speed: number;
  selected: boolean; onSelect: () => void;
}) {
  const g = { color, color2, style: id, size: Math.min(size, 20), speed, targets: ['avatar'] as GlowTarget[] };
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      title={hint}
      className={`flex flex-col items-center gap-2 py-3 rounded-md border bg-black/50 cursor-pointer transition ${
        selected ? 'border-[#00f2ff] ring-1 ring-[#00f2ff]/50' : 'border-white/10 hover:border-white/30'
      }`}
    >
      <span className={`block w-9 h-9 rounded-full bg-neutral-800 border border-white/10 ${glowClass(g, 'fx')}`} style={glowVars(g)} />
      <span className="text-[10px] font-bold text-neutral-200">{label}</span>
    </button>
  );
}

export function GlowPanel({ config, update }: { config: BioConfig; update: Update }) {
  const g = resolveGlow({ ...config, glowEnabled: true });
  const enabled = !!config.glowEnabled;
  const targets = config.glowTargets ?? DEFAULT_GLOW_TARGETS;
  const style = config.glowStyle || 'soft';
  const color = hex(config.glowColor, g?.color || '#00f2ff');
  const color2 = hex(config.glowColor2, color);
  const size = g?.size ?? 16;
  const speed = g?.speed ?? 1;

  return (
    <div className="space-y-4">
      <ToggleRow
        label="Подсветка профиля"
        hint="Свечение вокруг аватара, ника, бейджей, ссылок и карточки"
        checked={enabled}
        onChange={(v) => update('glowEnabled', v)}
      />

      <div className={enabled ? '' : 'opacity-40 pointer-events-none select-none'} aria-disabled={!enabled}>
        <div className="space-y-4">
          <div>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1.5">Стиль</p>
            <div className="grid grid-cols-3 gap-2">
              {GLOW_STYLES.map((s) => (
                <React.Fragment key={s.id}>
                  <StyleTile
                    {...s}
                    color={color}
                    color2={color2}
                    size={size}
                    speed={speed}
                    selected={style === s.id}
                    onSelect={() => update('glowStyle', s.id)}
                  />
                </React.Fragment>
              ))}
            </div>
            <p className="text-[9px] text-neutral-500 mt-1.5 leading-snug">{GLOW_STYLES.find((s) => s.id === style)?.hint}</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-neutral-500">
              Цвет
              <input type="color" aria-label="Цвет подсветки" value={color} onChange={(e) => update('glowColor', e.target.value)} className="w-9 h-7 bg-transparent border border-white/15 rounded cursor-pointer" />
            </label>
            {style === 'dual' && (
              <label className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold text-neutral-500">
                Второй цвет
                <input type="color" aria-label="Второй цвет подсветки" value={color2} onChange={(e) => update('glowColor2', e.target.value)} className="w-9 h-7 bg-transparent border border-white/15 rounded cursor-pointer" />
              </label>
            )}
            {style === 'rainbow' && <span className="text-[9px] text-neutral-500">Цвет задаёт только исходный оттенок: свечение проходит весь спектр.</span>}
          </div>

          <SliderRow label="Размер свечения" value={size} min={4} max={44} step={1} onChange={(v) => update('glowSize', v)} format={(v) => `${v}px`} />
          {style !== 'soft' && (
            <SliderRow label="Скорость" value={speed} min={0.3} max={3} step={0.1} onChange={(v) => update('glowSpeed', v)} format={(v) => `×${v.toFixed(1)}`} />
          )}

          <div>
            <p className="text-[10px] text-neutral-500 uppercase tracking-wider font-bold mb-1.5">Где светится</p>
            <div className="flex flex-wrap gap-2">
              {GLOW_TARGETS.map((t) => {
                const on = targets.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    aria-pressed={on}
                    onClick={() => update('glowTargets', on ? targets.filter((x) => x !== t) : [...targets, t])}
                    className={`px-2.5 py-1.5 rounded-sm border text-[10px] uppercase font-bold cursor-pointer ${on ? 'bg-[#00f2ff] border-[#00f2ff] text-black' : 'bg-black/40 border-white/10 text-neutral-400'}`}
                  >
                    {GLOW_TARGET_LABELS[t] || t}
                  </button>
                );
              })}
            </div>
            {targets.includes('card') && (config.cardStyle ?? 'none') === 'none' && (
              <p className="text-[9px] text-amber-300/80 mt-1.5 leading-snug">Свечение карточки лучше видно, если включить «Карточку профиля» ниже.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CardPanel({ config, update }: { config: BioConfig; update: Update }) {
  const c = resolveCard(config);
  const surface = c.style !== 'none';
  return (
    <div className="space-y-4 border-t border-white/10 pt-4">
      <div>
        <h4 className="text-[10px] uppercase text-[#00f2ff] font-black">Карточка профиля</h4>
        <p className="text-[9px] text-neutral-500 mt-1 leading-snug">Как на guns.lol: панель вокруг профиля, наклон за курсором и световой блик. Всё по желанию.</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {CARD_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={c.style === s.id}
            title={s.hint}
            onClick={() => update('cardStyle', s.id as CardStyle)}
            className={`py-2 px-2 rounded-md border text-[10px] font-bold cursor-pointer ${c.style === s.id ? 'bg-[#00f2ff]/10 border-[#00f2ff] text-[#00f2ff]' : 'bg-black/40 border-white/10 text-neutral-400 hover:border-white/25'}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {surface && (
        <div className="space-y-3">
          <SliderRow label="Непрозрачность" value={c.opacity} min={0.1} max={0.95} step={0.05} onChange={(v) => update('cardSurfaceOpacity', v)} format={(v) => `${Math.round(v * 100)}%`} />
          <SliderRow label="Размытие фона" value={c.blur} min={0} max={40} step={1} onChange={(v) => update('cardBlur', v)} format={(v) => `${v}px`} />
          <SliderRow label="Скругление" value={c.radius} min={0} max={48} step={1} onChange={(v) => update('cardRadius', v)} format={(v) => `${v}px`} />
          <ToggleRow label="Рамка" checked={c.border} onChange={(v) => update('cardBorder', v)} />
        </div>
      )}

      <div className="space-y-3">
        <ToggleRow label="Наклон за курсором" hint="Карточка поворачивается в 3D, как на guns.lol (только на ПК)" checked={c.tilt} onChange={(v) => update('cardTilt', v)} />
        {c.tilt && (
          <>
            <SliderRow label="Угол наклона" value={c.tiltStrength} min={2} max={20} step={1} onChange={(v) => update('cardTiltStrength', v)} format={(v) => `${v}°`} />
            <ToggleRow label="Приподнимать при наведении" checked={c.lift} onChange={(v) => update('cardLift', v)} />
          </>
        )}
        <ToggleRow label="Световой блик" hint="Мягкий отсвет следует за курсором по карточке" checked={c.glare} onChange={(v) => update('cardGlare', v)} />
      </div>
    </div>
  );
}
