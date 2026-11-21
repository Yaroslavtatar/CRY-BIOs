/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Check, ChevronRight, X } from 'lucide-react';

export interface FirstStepItem {
  id: string;
  title: string;
  hint: string;
  done: boolean;
  /** Подпись кнопки перехода */
  action: string;
  onAction: () => void;
}

interface FirstStepsProps {
  items: FirstStepItem[];
  onHide: () => void;
}

/** Чек-лист «Первые шаги»: что сделать на новой странице, с переходом в нужное место в один клик */
export default function FirstSteps({ items, onHide }: FirstStepsProps) {
  const doneCount = items.filter((i) => i.done).length;
  const pct = items.length ? Math.round((doneCount / items.length) * 100) : 0;
  const next = items.find((i) => !i.done);

  return (
    <section className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-3" aria-label="Первые шаги" data-testid="first-steps">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-[11px] font-black uppercase text-cb-accent tracking-widest font-mono">Первые шаги</h4>
          <p className="text-[11px] text-neutral-400 font-sans mt-0.5">
            {doneCount === items.length ? 'Всё готово — страница настроена.' : `Выполнено ${doneCount} из ${items.length}`}
          </p>
        </div>
        <button type="button" onClick={onHide} aria-label="Скрыть чек-лист" className="p-1 text-neutral-500 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
      </div>

      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full bg-cb-accent transition-all" style={{ width: `${pct}%` }} />
      </div>

      <ul className="space-y-1.5">
        {items.map((it) => {
          const isNext = next?.id === it.id;
          return (
            <li key={it.id} className={`flex items-center gap-3 p-2.5 rounded-sm border ${isNext ? 'border-cb-accent/50 bg-cb-accent/5' : 'border-white/5 bg-black/20'}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${it.done ? 'bg-cb-accent text-cb-on-accent' : 'border border-white/25'}`} aria-hidden="true">
                {it.done && <Check className="w-3 h-3" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className={`block text-xs font-bold ${it.done ? 'text-neutral-500 line-through' : 'text-white'}`}>{it.title}<span className="sr-only">{it.done ? ' — выполнено' : ''}</span></span>
                {!it.done && <span className="block text-[10px] text-neutral-400 font-sans leading-snug">{it.hint}</span>}
              </span>
              {!it.done && (
                <button type="button" onClick={it.onAction} className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-sm text-[9px] font-black uppercase tracking-wider cursor-pointer ${isNext ? 'bg-cb-accent text-cb-on-accent' : 'bg-white/10 text-neutral-200 hover:bg-white/20'}`}>
                  {it.action}<ChevronRight className="w-3 h-3" />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
