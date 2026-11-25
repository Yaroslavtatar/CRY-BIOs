/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, Download, Github, Link2, Loader2, Send, Sparkles } from 'lucide-react';
import type { BioConfig } from '../types';
import { IMPORT_PROVIDERS, IMPORT_SECTION_LABELS, getImportProvider, type ImportProviderId, type ImportSection } from '../import/catalog';
import { applyImportedProfile } from '../import/apply';
import { runProfileImport } from '../import/client';
import { detectImportProvider } from '../import/detect';
import { describeImportedProfile } from '../import/sections';
import type { ImportJobResult } from '../import/types';

interface ImportMenuProps {
  config: BioConfig;
  /** Родитель кладёт новый конфиг в редактор; сохранение остаётся за пользователем */
  onApply: (next: BioConfig) => void;
}

const PROVIDER_ICONS: Record<ImportProviderId, React.ReactNode> = {
  guns: <Sparkles className="w-5 h-5" aria-hidden />,
  linktree: <Link2 className="w-5 h-5" aria-hidden />,
  telegram: <Send className="w-5 h-5" aria-hidden />,
  github: <Github className="w-5 h-5" aria-hidden />,
};

const fieldCls =
  'w-full bg-black/50 border border-white/15 focus:border-cb-accent/80 focus:outline-none px-3 py-3 rounded-sm font-mono text-xs text-white placeholder-neutral-600';
const primaryBtn =
  'min-h-11 px-5 py-2.5 bg-cb-accent text-cb-on-accent text-[10px] font-black uppercase tracking-widest rounded-sm cursor-pointer disabled:opacity-50 hover:bg-cb-accent-hover';
const ghostBtn =
  'min-h-11 px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-neutral-200 font-bold uppercase tracking-wider rounded-sm cursor-pointer disabled:opacity-50';

type Phase = 'idle' | 'running' | 'preview' | 'applied';

export default function ImportMenu({ config, onApply }: ImportMenuProps) {
  const [providerId, setProviderId] = useState<ImportProviderId | null>(null);
  const [input, setInput] = useState('');
  const [pasteHtml, setPasteHtml] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ label: '', pct: 0 });
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportJobResult | null>(null);
  const [selected, setSelected] = useState<Set<ImportSection>>(new Set());
  const [doneNote, setDoneNote] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const provider = providerId ? getImportProvider(providerId) : undefined;
  const suggested = useMemo(() => {
    const d = detectImportProvider(input);
    return d && d !== providerId ? getImportProvider(d) : undefined;
  }, [input, providerId]);

  const summaries = useMemo(
    () => (result && provider ? describeImportedProfile(result.profile, provider.sections) : []),
    [result, provider],
  );

  const reset = () => {
    abortRef.current?.abort();
    setPhase('idle');
    setResult(null);
    setError('');
    setProgress({ label: '', pct: 0 });
    setSelected(new Set());
  };

  const choose = (id: ImportProviderId) => {
    reset();
    setProviderId(id);
    setInput('');
    setPasteHtml(false);
    setDoneNote('');
  };

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!provider) return;
    if (!input.trim()) { setError('Введите ссылку или имя профиля'); return; }

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setError('');
    setPhase('running');
    setProgress({ label: 'Запуск импорта…', pct: 0 });
    try {
      const r = await runProfileImport(provider.id, input.trim(), {
        signal: ctrl.signal,
        onProgress: (label, pct) => setProgress({ label: label || 'Работаю…', pct }),
      });
      const found = describeImportedProfile(r.profile, provider.sections).filter((s) => s.found);
      if (!found.length) {
        setError('На этой странице не нашлось данных для переноса.');
        setPhase('idle');
        return;
      }
      setResult(r);
      setSelected(new Set(found.map((s) => s.id)));
      setPhase('preview');
    } catch (err: any) {
      if (err?.name === 'AbortError') return;
      setError(err?.message || 'Ошибка импорта');
      setPhase('idle');
    }
  };

  const toggle = (id: ImportSection) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const apply = () => {
    if (!result) return;
    const { config: next, applied } = applyImportedProfile(config, result.profile, [...selected]);
    onApply(next);
    setDoneNote(applied.length ? `Применено: ${applied.join('; ')}.` : 'Ничего не изменилось.');
    setPhase('applied');
    setResult(null);
  };

  return (
    <section className="p-4 sm:p-5 bg-white/5 border border-white/10 rounded-sm space-y-4" data-testid="import-menu" aria-labelledby="import-title">
      <div className="flex items-start gap-3">
        <Download className="w-5 h-5 text-cb-accent mt-0.5 flex-shrink-0" aria-hidden />
        <div>
          <h3 id="import-title" className="text-sm font-black font-mono uppercase tracking-wider text-white">Импорт профиля</h3>
          <p className="text-[11px] text-neutral-400 font-sans mt-1 leading-relaxed">
            Перенесите оформление и ссылки с другой платформы. Перед применением вы выберете, что именно взять.
          </p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Платформа для импорта" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        {IMPORT_PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="radio"
            aria-checked={providerId === p.id}
            onClick={() => choose(p.id)}
            disabled={phase === 'running'}
            className={`text-left min-h-24 p-3 rounded-sm border cursor-pointer transition disabled:opacity-50 ${providerId === p.id ? 'border-cb-accent bg-cb-accent/10' : 'border-white/10 bg-black/30 hover:border-white/25'}`}
          >
            <span className="flex items-center gap-2 text-white">{PROVIDER_ICONS[p.id]}<span className="text-[11px] font-black font-mono uppercase">{p.label}</span></span>
            <span className="block text-[10px] text-neutral-400 font-sans mt-1.5 leading-snug">{p.tagline}</span>
          </button>
        ))}
      </div>

      {provider && phase !== 'preview' && phase !== 'applied' && (
        <form onSubmit={start} className="space-y-3">
          <label className="block text-[10px] uppercase tracking-wider font-bold text-neutral-400" htmlFor="import-input">
            {pasteHtml ? 'HTML страницы' : provider.inputLabel}
          </label>
          {pasteHtml ? (
            <textarea id="import-input" rows={6} value={input} onChange={(e) => setInput(e.target.value)} disabled={phase === 'running'} placeholder="<html>…" className={fieldCls} />
          ) : (
            <input id="import-input" type="text" inputMode="url" autoComplete="off" autoCapitalize="off" spellCheck={false} value={input} onChange={(e) => setInput(e.target.value)} disabled={phase === 'running'} placeholder={provider.placeholder} className={fieldCls} />
          )}

          {suggested && (
            <p className="text-[11px] text-amber-300 font-sans">
              Похоже на ссылку {suggested.label}.{' '}
              <button type="button" onClick={() => choose(suggested.id)} className="underline cursor-pointer">Переключить платформу</button>
            </p>
          )}

          {provider.htmlFallback && (
            <div className="space-y-1">
              <button type="button" onClick={() => { setPasteHtml((v) => !v); setInput(''); }} className="text-[11px] text-cb-accent underline cursor-pointer">
                {pasteHtml ? 'Вернуться к ссылке' : 'Не загружается? Вставить HTML вручную'}
              </button>
              {pasteHtml && provider.htmlHint && <p className="text-[11px] text-neutral-500 font-sans leading-relaxed">{provider.htmlHint}</p>}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button type="submit" disabled={phase === 'running'} className={primaryBtn}>
              {phase === 'running' ? <span className="inline-flex items-center gap-2"><Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />Импортирую…</span> : 'Импортировать'}
            </button>
            {phase === 'running' && <button type="button" onClick={reset} className={ghostBtn}>Отмена</button>}
          </div>

          {phase === 'running' && (
            <div role="status" aria-live="polite" className="space-y-1.5">
              <div className="h-1 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-cb-accent/70 transition-all" style={{ width: `${progress.pct}%` }} /></div>
              <p className="text-[11px] text-neutral-400 font-mono">{progress.label}</p>
            </div>
          )}
        </form>
      )}

      {error && (
        <p role="alert" className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 text-red-300 rounded-sm text-[11px] font-sans leading-snug">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden /><span>{error}</span>
        </p>
      )}

      {phase === 'preview' && result && (
        <div className="space-y-3 p-3.5 bg-black/40 border border-cb-accent/25 rounded-sm" data-testid="import-preview">
          <div className="flex items-center gap-3">
            {result.profile.avatarUrl && <img src={result.profile.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover border border-white/15" referrerPolicy="no-referrer" />}
            <div className="min-w-0">
              <p className="text-xs font-black font-mono text-white truncate">{result.profile.displayName || result.profile.sourceUsername || 'Профиль'}</p>
              <p className="text-[10px] text-neutral-500 font-mono">из {result.profile.sourceLabel}</p>
            </div>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-[10px] uppercase tracking-wider font-bold text-neutral-400 mb-1">Что перенести</legend>
            {summaries.map((s) => (
              <label key={s.id} className={`flex items-center gap-3 min-h-11 px-3 rounded-sm border ${s.found ? 'border-white/10 bg-white/5 cursor-pointer' : 'border-white/5 opacity-50'}`}>
                <input type="checkbox" className="w-5 h-5 accent-cyan-400" checked={selected.has(s.id)} disabled={!s.found} onChange={() => toggle(s.id)} />
                <span className="text-xs font-mono text-white">{IMPORT_SECTION_LABELS[s.id]}</span>
                <span className="ml-auto text-[10px] text-neutral-400 font-sans text-right">{s.found ? s.detail : 'нет данных'}</span>
              </label>
            ))}
          </fieldset>

          {result.warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-[11px] text-amber-300 font-sans leading-snug"><AlertTriangle className="w-4 h-4 flex-shrink-0" aria-hidden /><span>{w}</span></p>
          ))}
          <p className="text-[10px] text-neutral-500 font-sans">Ссылки добавляются к вашим: существующие не удаляются и не дублируются. Изменения попадут в профиль после «Сохранить».</p>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={apply} disabled={selected.size === 0} className={primaryBtn}>Применить к профилю</button>
            <button type="button" onClick={reset} className={ghostBtn}>Отмена</button>
          </div>
        </div>
      )}

      {phase === 'applied' && (
        <div role="status" className="space-y-3 p-3.5 bg-emerald-500/10 border border-emerald-500/20 rounded-sm">
          <p className="flex items-start gap-2 text-[11px] text-emerald-300 font-sans leading-snug"><Check className="w-4 h-4 flex-shrink-0" aria-hidden /><span>{doneNote} Нажмите «Сохранить», чтобы изменения появились на странице.</span></p>
          <button type="button" onClick={() => { reset(); setProviderId(null); setInput(''); }} className={ghostBtn}>Импортировать ещё</button>
        </div>
      )}
    </section>
  );
}
