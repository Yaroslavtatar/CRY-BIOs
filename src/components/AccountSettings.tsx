/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { AtSign, Check, Copy, Download, GraduationCap, KeyRound, Layout, LogOut, Palette, ShieldCheck, ShieldOff } from 'lucide-react';
import { STUDIO_PRESETS, detectStudioPreset, resetTour, useStudioPrefs } from '../studioPrefs';
import { UI_ACCENTS, useUiPrefs } from '../uiPrefs';

interface AccountSettingsProps {
  username: string;
  onRename: () => void;
  onLogout: () => void;
  /** Запустить приветственный мастер заново */
  onRestartOnboarding: () => void;
  /** Вернуть на «Обзор» чек-лист «Первые шаги» */
  onShowChecklist: () => void;
}

const fieldCls =
  'w-full bg-black/50 border border-white/15 focus:border-cb-accent/80 focus:outline-none px-3 py-2.5 rounded-sm font-mono text-xs text-white';
const primaryBtn =
  'px-4 py-2.5 bg-cb-accent text-cb-on-accent text-[10px] font-black uppercase tracking-widest rounded-sm cursor-pointer disabled:opacity-50 hover:bg-cb-accent-hover';
const ghostBtn =
  'px-4 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] text-neutral-200 font-bold uppercase tracking-wider rounded-sm cursor-pointer disabled:opacity-50';
const dangerBtn =
  'px-4 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-[10px] text-red-300 font-bold uppercase tracking-wider rounded-sm cursor-pointer disabled:opacity-50';

async function postJson(url: string, body: unknown): Promise<{ ok: boolean; data: any }> {
  try {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, data };
  } catch {
    return { ok: false, data: { error: 'Нет связи с сервером' } };
  }
}

function Section({ icon, title, hint, children }: { icon: React.ReactNode; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="p-4 bg-white/5 border border-white/10 rounded-sm space-y-4">
      <div>
        <h4 className="text-[11px] font-black uppercase text-cb-accent tracking-widest flex items-center gap-2 font-mono">{icon}{title}</h4>
        {hint && <p className="text-[11px] text-neutral-500 font-sans mt-1 leading-relaxed">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Choice<T extends string>({ value, options, onChange, label }: { value: T; options: readonly { id: T; label: string; hint?: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-1 sm:grid-cols-2 gap-2">
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={value === o.id}
          onClick={() => onChange(o.id)}
          className={`text-left p-3 rounded-sm border cursor-pointer transition ${value === o.id ? 'border-cb-accent bg-cb-accent/10' : 'border-white/10 bg-black/30 hover:border-white/25'}`}
        >
          <span className="block text-[11px] font-black font-mono uppercase text-white">{o.label}</span>
          {o.hint && <span className="block text-[10px] text-neutral-400 font-sans mt-0.5 leading-snug">{o.hint}</span>}
        </button>
      ))}
    </div>
  );
}

// ---------------- Пароль ----------------

function PasswordForm() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!current || !next) { setMsg({ ok: false, text: 'Заполните оба поля' }); return; }
    setBusy(true);
    const r = await postJson('/api/auth/change-password', { currentPassword: current, newPassword: next });
    setBusy(false);
    if (r.ok) { setCurrent(''); setNext(''); setMsg({ ok: true, text: 'Пароль изменён. Остальные сессии завершены.' }); }
    else setMsg({ ok: false, text: r.data?.error || 'Не удалось сменить пароль' });
  };

  return (
    <form onSubmit={submit} className="space-y-2.5">
      <span className="block text-[10px] uppercase tracking-wider font-bold text-neutral-400">Пароль</span>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input type="password" autoComplete="current-password" aria-label="Текущий пароль" placeholder="Текущий пароль" value={current} onChange={(e) => setCurrent(e.target.value)} className={fieldCls} />
        <input type="password" autoComplete="new-password" aria-label="Новый пароль" placeholder="Новый (8+ символов, буквы и цифры)" value={next} onChange={(e) => setNext(e.target.value)} className={fieldCls} />
      </div>
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`text-[11px] font-mono ${msg.ok ? 'text-green-400' : 'text-red-400'}`}>{msg.text}</p>}
      <button type="submit" disabled={busy} className={ghostBtn}>{busy ? 'Сохранение…' : 'Сменить пароль'}</button>
    </form>
  );
}

// ---------------- Двухфакторная защита ----------------

type TfPhase = 'loading' | 'off' | 'password' | 'scan' | 'codes' | 'on' | 'regen' | 'disable';

const groupSecret = (s: string) => s.replace(/(.{4})/g, '$1 ').trim();

export function TwoFactorCard({ username }: { username: string }) {
  const [phase, setPhase] = useState<TfPhase>('loading');
  const [left, setLeft] = useState(0);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [setup, setSetup] = useState<{ secret: string; qr: string } | null>(null);
  const [codes, setCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/account/security');
      if (!res.ok) throw new Error();
      const d = await res.json();
      setLeft(d.recoveryCodesLeft || 0);
      setPhase(d.twoFactorEnabled ? 'on' : 'off');
    } catch {
      setError('Не удалось загрузить состояние защиты');
      setPhase('off');
    }
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const reset = (next: TfPhase) => { setPassword(''); setCode(''); setError(''); setPhase(next); };

  const begin = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await postJson('/api/auth/2fa/setup', { password });
    setBusy(false);
    if (!r.ok) { setError(r.data?.error || 'Не удалось начать настройку'); return; }
    setSetup({ secret: r.data.secret, qr: r.data.qr });
    setPassword(''); setCode('');
    setPhase('scan');
  };

  const confirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await postJson('/api/auth/2fa/enable', { code });
    setBusy(false);
    if (!r.ok) { setError(r.data?.error || 'Неверный код'); return; }
    setCodes(r.data.recoveryCodes || []); setSetup(null); setSaved(false); setCode('');
    setPhase('codes');
  };

  const manage = (kind: 'regen' | 'disable') => async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError('');
    const r = await postJson(kind === 'regen' ? '/api/auth/2fa/recovery-codes' : '/api/auth/2fa/disable', { password, code });
    setBusy(false);
    if (!r.ok) { setError(r.data?.error || 'Не удалось выполнить действие'); return; }
    setPassword(''); setCode('');
    if (kind === 'regen') { setCodes(r.data.recoveryCodes || []); setSaved(false); setPhase('codes'); }
    else { setPhase('off'); }
  };

  const copyCodes = async () => {
    try { await navigator.clipboard.writeText(codes.join('\n')); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* буфер недоступен */ }
  };
  const downloadCodes = () => {
    const text = `CRY BIOS — резервные коды для @${username}\nКаждый код работает один раз. Храните в надёжном месте.\n\n${codes.join('\n')}\n`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const a = document.createElement('a');
    a.href = url; a.download = `cry-bios-recovery-${username}.txt`; a.click();
    URL.revokeObjectURL(url);
  };

  const errorLine = error && <p role="alert" className="text-[11px] text-red-400 font-mono">{error}</p>;

  return (
    <div className="space-y-3" data-testid="two-factor">
      <span className="block text-[10px] uppercase tracking-wider font-bold text-neutral-400">Двухфакторная защита (2FA)</span>

      {phase === 'loading' && <p className="text-[11px] text-neutral-500 font-mono">Загрузка…</p>}

      {phase === 'off' && (
        <>
          <p className="text-[11px] text-neutral-400 font-sans leading-relaxed">
            При входе, помимо пароля, понадобится 6-значный код из приложения-аутентификатора (Google Authenticator, Authy, 1Password, Aegis). Даже если пароль узнают, зайти в аккаунт не получится.
          </p>
          {errorLine}
          <button type="button" onClick={() => reset('password')} className={primaryBtn}><span className="inline-flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />Включить 2FA</span></button>
        </>
      )}

      {phase === 'password' && (
        <form onSubmit={begin} className="space-y-2.5">
          <p className="text-[11px] text-neutral-400 font-sans">Для безопасности подтвердите текущий пароль.</p>
          <input type="password" autoComplete="current-password" aria-label="Текущий пароль" placeholder="Текущий пароль" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldCls} autoFocus />
          {errorLine}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !password} className={primaryBtn}>{busy ? 'Проверяем…' : 'Продолжить'}</button>
            <button type="button" onClick={() => reset('off')} className={ghostBtn}>Отмена</button>
          </div>
        </form>
      )}

      {phase === 'scan' && setup && (
        <form onSubmit={confirm} className="space-y-3">
          <ol className="text-[11px] text-neutral-300 font-sans leading-relaxed list-decimal pl-4 space-y-1">
            <li>Откройте приложение-аутентификатор и добавьте новый аккаунт.</li>
            <li>Отсканируйте QR-код или введите ключ вручную.</li>
            <li>Введите 6-значный код из приложения ниже.</li>
          </ol>
          <div className="flex flex-col sm:flex-row gap-4 items-start">
            <img src={setup.qr} alt="QR-код для приложения-аутентификатора" width={168} height={168} className="bg-white p-1.5 rounded-sm" />
            <div className="space-y-1 min-w-0">
              <span className="block text-[9px] uppercase tracking-wider font-bold text-neutral-500">Ключ для ручного ввода</span>
              <code className="block text-xs text-cb-accent font-mono break-all select-all" data-testid="two-factor-secret">{groupSecret(setup.secret)}</code>
              <span className="block text-[10px] text-neutral-500 font-sans">Тип: по времени (TOTP), 6 цифр, 30 секунд.</span>
            </div>
          </div>
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]*"
            maxLength={7}
            aria-label="Код из приложения"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^\d ]/g, ''))}
            className={`${fieldCls} tracking-[0.4em] text-center text-base`}
            autoFocus
          />
          {errorLine}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || code.replace(/\s/g, '').length !== 6} className={primaryBtn}>{busy ? 'Проверяем…' : 'Подтвердить и включить'}</button>
            <button type="button" onClick={() => { setSetup(null); reset('off'); }} className={ghostBtn}>Отмена</button>
          </div>
        </form>
      )}

      {phase === 'codes' && (
        <div className="space-y-3">
          <p className="text-[11px] text-amber-300 font-sans leading-relaxed">
            Сохраните резервные коды. Если потеряете телефон, войти можно будет только с их помощью. Каждый код работает один раз, и больше мы их не покажем.
          </p>
          <ul className="grid grid-cols-2 gap-1.5 p-3 bg-black/50 border border-white/10 rounded-sm font-mono text-sm text-white" aria-label="Резервные коды">
            {codes.map((c) => <li key={c} className="select-all">{c}</li>)}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={copyCodes} className={ghostBtn}><span className="inline-flex items-center gap-1.5">{copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copied ? 'Скопировано' : 'Копировать'}</span></button>
            <button type="button" onClick={downloadCodes} className={ghostBtn}><span className="inline-flex items-center gap-1.5"><Download className="w-3.5 h-3.5" />Скачать .txt</span></button>
          </div>
          <label className="flex items-center gap-2 text-xs font-sans text-neutral-300 cursor-pointer">
            <input type="checkbox" checked={saved} onChange={(e) => setSaved(e.target.checked)} className="w-4 h-4 accent-cyan-400" />
            Я сохранил(а) коды в надёжном месте
          </label>
          <button type="button" disabled={!saved} onClick={() => { setCodes([]); void refresh(); }} className={primaryBtn}>Готово</button>
        </div>
      )}

      {phase === 'on' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs font-mono text-green-400"><ShieldCheck className="w-4 h-4" />2FA включена</div>
          <p className={`text-[11px] font-sans ${left <= 2 ? 'text-amber-300' : 'text-neutral-400'}`}>
            Резервных кодов осталось: <strong>{left}</strong>{left <= 2 ? '. Создайте новые, пока они не закончились.' : '.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => reset('regen')} className={ghostBtn}>Новые резервные коды</button>
            <button type="button" onClick={() => reset('disable')} className={dangerBtn}><span className="inline-flex items-center gap-1.5"><ShieldOff className="w-3.5 h-3.5" />Отключить 2FA</span></button>
          </div>
        </div>
      )}

      {(phase === 'regen' || phase === 'disable') && (
        <form onSubmit={manage(phase)} className="space-y-2.5">
          <p className="text-[11px] text-neutral-400 font-sans">
            {phase === 'regen' ? 'Старые резервные коды перестанут работать.' : 'Вход снова будет только по паролю.'} Подтвердите пароль и введите код из приложения (или резервный код).
          </p>
          <input type="password" autoComplete="current-password" aria-label="Текущий пароль" placeholder="Текущий пароль" value={password} onChange={(e) => setPassword(e.target.value)} className={fieldCls} autoFocus />
          <input aria-label="Код подтверждения" placeholder="Код из приложения или резервный" value={code} onChange={(e) => setCode(e.target.value)} className={fieldCls} autoComplete="one-time-code" maxLength={32} />
          {errorLine}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !password || !code} className={phase === 'disable' ? dangerBtn : primaryBtn}>{busy ? 'Проверяем…' : phase === 'regen' ? 'Создать новые коды' : 'Отключить'}</button>
            <button type="button" onClick={() => reset('on')} className={ghostBtn}>Отмена</button>
          </div>
        </form>
      )}
    </div>
  );
}

// ---------------- Раздел целиком ----------------

export default function AccountSettings({ username, onRename, onLogout, onRestartOnboarding, onShowChecklist }: AccountSettingsProps) {
  const [ui, setUi] = useUiPrefs();
  const [studio, setStudio] = useStudioPrefs();
  const preset = detectStudioPreset(studio);
  const [note, setNote] = useState('');
  const flash = (t: string) => { setNote(t); setTimeout(() => setNote(''), 2500); };

  return (
    <div className="space-y-5" data-testid="account-settings">
      <div>
        <h3 className="text-sm font-black font-mono text-cb-accent uppercase tracking-widest italic">Настройки</h3>
        <p className="text-xs text-neutral-400 font-sans mt-1 leading-relaxed">Аккаунт, безопасность и внешний вид редактора в одном месте. Стиль интерфейса хранится на этом устройстве.</p>
      </div>

      <Section icon={<AtSign className="w-3.5 h-3.5" />} title="Аккаунт">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="font-mono text-base font-extrabold text-white break-all">@{username}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onRename} className={ghostBtn}>Сменить имя</button>
            <button type="button" onClick={onLogout} className={ghostBtn}><span className="inline-flex items-center gap-1.5"><LogOut className="w-3.5 h-3.5" />Выйти</span></button>
          </div>
        </div>
      </Section>

      <Section icon={<KeyRound className="w-3.5 h-3.5" />} title="Безопасность" hint="Смена пароля завершает все остальные сессии.">
        <PasswordForm />
        <div className="border-t border-white/10 pt-4"><TwoFactorCard username={username} /></div>
      </Section>

      <Section icon={<Palette className="w-3.5 h-3.5" />} title="Стиль редактора профиля" hint="Как выглядит и работает этот кабинет.">
        <div className="space-y-2">
          <span className="block text-[10px] uppercase tracking-wider font-bold text-neutral-400">Набор разделов</span>
          <Choice
            label="Набор разделов"
            value={ui.editorMode}
            onChange={(v) => setUi({ editorMode: v })}
            options={[
              { id: 'simple', label: 'Простой', hint: 'Только основное: профиль, фон, блоки, студия, статистика' },
              { id: 'full', label: 'Полный', hint: 'Все разделы: макет, эффекты, glow, аудио, экспорт' },
            ]}
          />
        </div>
        <div className="space-y-2">
          <span className="block text-[10px] uppercase tracking-wider font-bold text-neutral-400">Предпросмотр на широком экране</span>
          <Choice
            label="Предпросмотр"
            value={ui.preview}
            onChange={(v) => setUi({ preview: v })}
            options={[
              { id: 'side', label: 'Рядом с редактором', hint: 'Видно изменения сразу' },
              { id: 'hidden', label: 'Скрыть', hint: 'Больше места для настроек' },
            ]}
          />
        </div>
        <div className="space-y-2">
          <span className="block text-[10px] uppercase tracking-wider font-bold text-neutral-400">Акцентный цвет кабинета</span>
          <div className="flex flex-wrap gap-2.5 items-center">
            <button type="button" aria-pressed={ui.accent === null} onClick={() => setUi({ accent: null })} className={`px-3 py-2 rounded-sm text-[10px] font-mono uppercase cursor-pointer border ${ui.accent === null ? 'border-cb-accent text-white bg-cb-accent/10' : 'border-white/15 text-neutral-400'}`}>Цвет темы</button>
            {UI_ACCENTS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Акцент ${c}`}
                aria-pressed={ui.accent === c}
                onClick={() => setUi({ accent: c })}
                className={`w-9 h-9 rounded-full border-2 transition ${ui.accent === c ? 'border-white scale-110' : 'border-white/20'}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
          <p className="text-[10px] text-neutral-500 font-sans">Меняется только вид кабинета. Ваша публичная страница не затрагивается.</p>
        </div>
      </Section>

      <Section icon={<Layout className="w-3.5 h-3.5" />} title="Стиль конструктора" hint="Расположение панели и размер элементов в студии. Выберите готовый вариант или настройте по-своему.">
        <Choice
          label="Готовый стиль конструктора"
          value={(preset ?? '') as string}
          onChange={(id) => { const p = STUDIO_PRESETS.find((x) => x.id === id); if (p) setStudio({ ...p.prefs }); }}
          options={STUDIO_PRESETS.map((p) => ({ id: p.id as string, label: p.label, hint: p.hint }))}
        />
        <div className="grid grid-cols-2 gap-2">
          {([['right', 'Панель справа'], ['left', 'Панель слева']] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setStudio({ panelSide: v })} aria-pressed={studio.panelSide === v} className={`py-2.5 rounded-sm text-[10px] font-mono uppercase cursor-pointer ${studio.panelSide === v ? 'bg-cb-accent text-cb-on-accent font-bold' : 'bg-white/5 text-neutral-300'}`}>{l}</button>
          ))}
          {([['normal', 'Обычные кнопки'], ['large', 'Крупные кнопки']] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setStudio({ controls: v })} aria-pressed={studio.controls === v} className={`py-2.5 rounded-sm text-[10px] font-mono uppercase cursor-pointer ${studio.controls === v ? 'bg-cb-accent text-cb-on-accent font-bold' : 'bg-white/5 text-neutral-300'}`}>{l}</button>
          ))}
        </div>
        <label className="flex items-center justify-between text-xs font-mono">
          <span>Показывать сетку</span>
          <input type="checkbox" checked={studio.showGrid} onChange={(e) => setStudio({ showGrid: e.target.checked })} className="w-5 h-5 accent-cyan-400" />
        </label>
      </Section>

      <Section icon={<GraduationCap className="w-3.5 h-3.5" />} title="Обучение">
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRestartOnboarding} className={ghostBtn}>Пройти приветственный мастер заново</button>
          <button type="button" onClick={() => { resetTour(); flash('Подсказки появятся при следующем открытии студии'); }} className={ghostBtn}>Показать подсказки студии заново</button>
          <button type="button" onClick={() => { onShowChecklist(); flash('Чек-лист вернулся на вкладку «Обзор»'); }} className={ghostBtn}>Вернуть чек-лист «Первые шаги»</button>
        </div>
        {note && <p role="status" className="text-[11px] text-green-400 font-mono">{note}</p>}
      </Section>
    </div>
  );
}
