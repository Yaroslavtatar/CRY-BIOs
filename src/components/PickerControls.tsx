import React from 'react';
import { X } from 'lucide-react';

/** Общая оболочка модальных окон выбора эффекта: сетка слева, предпросмотр и описание справа. */
export function PickerShell({
  title, onClose, onSave, grid, side, saveLabel = 'Сохранить',
}: {
  title: string;
  onClose: () => void;
  onSave: () => void;
  grid: React.ReactNode;
  side: React.ReactNode;
  saveLabel?: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-5xl max-h-[94vh] flex flex-col bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 flex-shrink-0">
          <h3 className="text-sm font-black font-mono text-white uppercase tracking-wider italic">{title}</h3>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 min-h-0 grid grid-cols-1 md:grid-cols-[1fr_320px] overflow-y-auto md:overflow-hidden">
          <div className="p-4 md:overflow-y-auto md:max-h-[68vh]">{grid}</div>
          <div className="p-4 border-t md:border-t-0 md:border-l border-white/10 bg-black/40 flex flex-col gap-3 md:overflow-y-auto md:max-h-[68vh]">
            {side}
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-white/10 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-white/5 border border-white/10 text-neutral-300 text-xs font-bold uppercase cursor-pointer hover:bg-white/10"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-4 py-2 rounded-md bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold uppercase cursor-pointer"
          >
            {saveLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SliderRow({
  label, value, min, max, step, onChange, format, leftHint, rightHint,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  leftHint?: string;
  rightHint?: string;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-[10px] uppercase tracking-wider font-bold text-neutral-500 mb-1">
        <span>{label}</span>
        <span className="text-neutral-300 font-mono normal-case">{format ? format(value) : value}</span>
      </span>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-[#a855f7]"
      />
      {(leftHint || rightHint) && (
        <span className="flex justify-between text-[9px] text-neutral-600 -mt-0.5">
          <span>{leftHint}</span>
          <span>{rightHint}</span>
        </span>
      )}
    </label>
  );
}

export function Segmented<T extends string>({
  label, value, options, onChange, columns,
}: {
  label?: string;
  columns?: number;
  value: T;
  options: { id: T; label: string; title?: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div>
      {label && <p className="text-[10px] uppercase tracking-wider font-bold text-neutral-500 mb-1">{label}</p>}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }} role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            title={o.title}
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={`py-1.5 px-1 rounded-md border text-[10px] font-bold leading-tight cursor-pointer transition ${
              value === o.id ? 'bg-[#a855f7]/20 border-[#a855f7] text-white' : 'bg-white/5 border-white/10 text-neutral-400 hover:border-white/25'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ToggleRow({ label, hint, checked, onChange }: { label: string; hint?: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between gap-3 text-left cursor-pointer group"
    >
      <span>
        <span className="block text-[11px] font-bold text-neutral-200">{label}</span>
        {hint && <span className="block text-[9px] text-neutral-500 leading-snug">{hint}</span>}
      </span>
      <span className={`relative w-9 h-5 rounded-full flex-shrink-0 transition ${checked ? 'bg-[#a855f7]' : 'bg-white/15'}`}>
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
    </button>
  );
}
