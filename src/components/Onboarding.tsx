/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowLeft, ArrowRight, LayoutTemplate, Sparkles } from 'lucide-react';
import type { BioConfig } from '../types';

interface OnboardingProps {
  username: string;
  config: BioConfig;
  onChange: (config: BioConfig) => void;
  /** Сохранить настройки на сервере */
  onSave: () => void;
  onOpenStudio: () => void;
  onClose: () => void;
}

const ACCENTS = ['#8a2be2', '#22d3ee', '#f43f5e', '#f59e0b', '#22c55e', '#ec4899', '#3b82f6', '#ffffff'];

const fieldCls =
  'w-full bg-black/50 border border-white/15 focus:border-cb-accent/80 focus:outline-none px-3 py-2.5 rounded-sm font-mono text-sm text-white';

const STEPS = ['Добро пожаловать', 'О вас', 'Стиль', 'Конструктор'] as const;

/** Мастер первого входа: имя и описание, цвет, затем открытие свободного конструктора */
export default function Onboarding({ username, config, onChange, onSave, onOpenStudio, onClose }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const last = step === STEPS.length - 1;

  const finish = (openStudio: boolean) => {
    onSave();
    onClose();
    if (openStudio) onOpenStudio();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center p-3 sm:p-6 bg-black/75" role="dialog" aria-label="Первоначальная настройка">
      <div className="w-full max-w-md bg-cb-surface border border-cb-accent/40 rounded-sm shadow-2xl max-h-[92dvh] overflow-y-auto">
        <div className="flex gap-1 p-4 pb-0">
          {STEPS.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-cb-accent' : 'bg-white/10'}`} />
          ))}
        </div>

        <div className="p-5 space-y-4">
          <div className="text-[9px] font-mono font-bold uppercase tracking-widest text-cb-accent">Шаг {step + 1} из {STEPS.length} · {STEPS[step]}</div>

          {step === 0 && (
            <div className="space-y-3">
              <h2 className="text-xl font-black flex items-center gap-2"><Sparkles className="w-5 h-5 text-cb-accent" />Привет, @{username}!</h2>
              <p className="text-sm text-neutral-300 font-sans leading-relaxed">
                За минуту настроим вашу страницу: имя, описание и цвет. Потом откроем конструктор, где всё можно двигать как угодно — с компьютера и с телефона. Всё можно изменить позже.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <label className="block space-y-1">
                <span className="block text-[10px] uppercase tracking-wider font-bold text-neutral-400">Как вас показывать</span>
                <input className={fieldCls} maxLength={40} value={config.displayName} onChange={(e) => onChange({ ...config, displayName: e.target.value })} />
              </label>
              <label className="block space-y-1">
                <span className="block text-[10px] uppercase tracking-wider font-bold text-neutral-400">Коротко о себе</span>
                <textarea className={`${fieldCls} min-h-[84px]`} maxLength={300} value={config.bio} onChange={(e) => onChange({ ...config, bio: e.target.value })} />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <span className="block text-[10px] uppercase tracking-wider font-bold text-neutral-400">Главный цвет страницы</span>
              <div className="flex flex-wrap gap-2.5">
                {ACCENTS.map((c) => {
                  const active = config.primaryColor.toLowerCase() === c;
                  return (
                    <button
                      key={c}
                      type="button"
                      aria-label={`Цвет ${c}`}
                      aria-pressed={active}
                      onClick={() => onChange({ ...config, primaryColor: c, glowColor: c })}
                      className={`w-11 h-11 rounded-full border-2 ${active ? 'border-white scale-110' : 'border-white/20'} transition`}
                      style={{ backgroundColor: c }}
                    />
                  );
                })}
              </div>
              <p className="text-[11px] text-neutral-500 font-sans">Остальное — фон, шрифты, эффекты — настраивается в разделе «Оформление».</p>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3">
              <h2 className="text-lg font-black flex items-center gap-2"><LayoutTemplate className="w-5 h-5 text-cb-accent" />Соберите страницу сами</h2>
              <p className="text-sm text-neutral-300 font-sans leading-relaxed">
                В Студии аватар, ник и блоки двигаются и растягиваются свободно. Для телефона можно сделать отдельную раскладку.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 p-4 pt-0">
          {step === 0 ? (
            <button type="button" onClick={() => finish(false)} className="px-2 py-3 text-[10px] font-mono uppercase text-neutral-500 hover:text-white">Пропустить</button>
          ) : (
            <button type="button" onClick={() => setStep(step - 1)} className="inline-flex items-center gap-1 px-2 py-3 text-[10px] font-mono uppercase text-neutral-400 hover:text-white"><ArrowLeft className="w-3.5 h-3.5" />Назад</button>
          )}
          {last ? (
            <div className="flex gap-2">
              <button type="button" onClick={() => finish(false)} className="px-3 py-3 text-[10px] font-mono uppercase text-neutral-300 bg-white/5 rounded-sm">Позже</button>
              <button type="button" onClick={() => finish(true)} className="px-4 py-3 bg-cb-accent text-cb-on-accent text-[10px] font-black uppercase tracking-widest rounded-sm">Открыть студию</button>
            </div>
          ) : (
            <button type="button" onClick={() => setStep(step + 1)} className="inline-flex items-center gap-1.5 px-4 py-3 bg-cb-accent text-cb-on-accent text-[10px] font-black uppercase tracking-widest rounded-sm">Дальше<ArrowRight className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>
    </div>
  );
}
