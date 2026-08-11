import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { NameEffect } from '../types';
import { NAME_EFFECT_CATALOG } from '../utils/nameEffectCatalog';
import { getNameEffectClasses, getNameEffectStyle } from '../utils/nameEffects';
import NameSparkOverlay from './NameSparkOverlay';

interface NameEffectPickerModalProps {
  open: boolean;
  value: NameEffect;
  previewText: string;
  onClose: () => void;
  onSave: (effect: NameEffect) => void;
}

function EffectPreviewTile({
  effect,
  label,
  previewText,
  selected,
  onSelect,
}: {
  effect: NameEffect;
  label: string;
  previewText: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const sample = effect === 'typewriter' ? 'CRY' : previewText.slice(0, 8) || 'CRY';

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative h-16 w-full rounded-md border bg-black/60 overflow-hidden transition cursor-pointer ${
        selected ? 'border-[#a855f7] ring-1 ring-[#a855f7]/50' : 'border-white/10 hover:border-white/25'
      }`}
    >
      {effect === 'none' ? (
        <div className="flex h-full items-center justify-center text-neutral-500 text-[10px] font-mono uppercase">
          Нет
        </div>
      ) : (
        <div className="relative flex h-full items-center justify-center px-2">
          <span
            className={`text-[11px] font-bold truncate max-w-full ${getNameEffectClasses(effect, sample)}`}
            style={getNameEffectStyle(effect, sample)}
          >
            {effect === 'typewriter' ? 'Э|' : sample}
          </span>
          <NameSparkOverlay effect={effect} />
        </div>
      )}
      <span className="sr-only">{label}</span>
    </button>
  );
}

export default function NameEffectPickerModal({
  open,
  value,
  previewText,
  onClose,
  onSave,
}: NameEffectPickerModalProps) {
  const [draft, setDraft] = useState<NameEffect>(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  if (!open) return null;

  const selectedEntry = NAME_EFFECT_CATALOG.find(e => e.id === draft);
  const displayText = previewText || 'CRYTEAM';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <h3 className="text-sm font-black font-mono text-white uppercase tracking-wider italic">Эффекты ника</h3>
          <button type="button" onClick={onClose} className="text-neutral-400 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1fr_240px] gap-0">
          <div className="p-4 grid grid-cols-4 gap-2 max-h-[420px] overflow-y-auto">
            {NAME_EFFECT_CATALOG.map((entry) => (
              <div key={entry.id}>
                <EffectPreviewTile
                  effect={entry.id}
                  label={entry.label}
                  previewText={displayText}
                  selected={draft === entry.id}
                  onSelect={() => setDraft(entry.id)}
                />
              </div>
            ))}
          </div>

          <div className="p-4 border-t md:border-t-0 md:border-l border-white/10 bg-black/40 flex flex-col gap-3">
            <div className="flex-1 min-h-[120px] rounded-md border border-white/10 bg-[#111] flex items-center justify-center relative overflow-hidden">
              <div className="relative inline-block px-4 py-2">
                <span
                  className={`text-xl font-bold ${getNameEffectClasses(draft, displayText)}`}
                  style={getNameEffectStyle(draft, displayText)}
                >
                  {displayText}
                </span>
                <NameSparkOverlay effect={draft} />
              </div>
            </div>
            <div>
              <p className="text-sm font-bold text-white">{selectedEntry?.label || 'Без эффекта'}</p>
              <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
                {selectedEntry?.hint || 'Выберите эффект для имени на профиле.'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-white/10">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-white/5 border border-white/10 text-neutral-300 text-xs font-bold uppercase cursor-pointer hover:bg-white/10"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => { onSave(draft); onClose(); }}
            className="px-4 py-2 rounded-md bg-[#7c3aed] hover:bg-[#6d28d9] text-white text-xs font-bold uppercase cursor-pointer"
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}
