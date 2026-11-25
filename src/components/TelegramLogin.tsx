import { useEffect, useState, type FormEvent } from 'react';
import { Send } from 'lucide-react';
import { getStoredRef } from '../referral';

interface Props {
  acceptTerms: boolean;
  setAcceptTerms: (v: boolean) => void;
  onError: (msg: string) => void;
  onSuccess: (data: { username: string; isNew?: boolean }) => void;
  onTwoFactor: (challenge: string) => void;
}

/** Вход и регистрация по одноразовому ключу из Telegram-бота. Не показывается, если бот не настроен. */
export default function TelegramLogin({ acceptTerms, setAcceptTerms, onError, onSuccess, onTwoFactor }: Props) {
  const [cfg, setCfg] = useState<{ enabled: boolean; botUsername: string } | null>(null);
  const [open, setOpen] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [needUsername, setNeedUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/auth/telegram/config')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setCfg(d))
      .catch(() => undefined);
  }, []);

  if (!cfg?.enabled) return null;

  const ref = getStoredRef();
  const botUrl = cfg.botUsername ? `https://t.me/${cfg.botUsername}${ref ? `?start=ref_${ref}` : ''}` : '';

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!keyValue.trim()) return onError('Введите ключ из Telegram');
    onError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/telegram/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: keyValue,
          ...(needUsername ? { username: newUsername, acceptTerms } : {}),
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (body.needUsername) {
        setNeedUsername(true);
        if (!newUsername && body.suggestedUsername) setNewUsername(body.suggestedUsername);
      }
      if (!res.ok) throw new Error(body.error || 'Не удалось войти');
      if (body.needUsername) return; // ждём выбор имени
      if (body.twoFactorRequired) return onTwoFactor(body.challenge);
      onSuccess(body);
    } catch (err: any) {
      onError(err.message || 'Не удалось войти');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = 'w-full bg-black/50 border border-white/15 focus:border-cb-accent/80 focus:outline-none p-3.5 rounded-sm font-mono text-white placeholder-neutral-700';

  return (
    <div className="mt-5 pt-5 border-t border-white/10 font-mono text-xs" data-testid="telegram-login">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-sm border border-white/15 bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-widest text-[10px] cursor-pointer"
        >
          <Send className="w-4 h-4" /> Войти через Telegram
        </button>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <p className="text-[11px] text-neutral-300 font-sans leading-relaxed">
            1. Откройте бота{' '}
            {botUrl ? <a href={botUrl} target="_blank" rel="noopener noreferrer" className="text-cb-accent underline">@{cfg.botUsername}</a> : 'в Telegram'} и нажмите «Старт».<br />
            2. Скопируйте присланный ключ и вставьте сюда. Новый аккаунт создастся автоматически.
          </p>
          <input
            type="text"
            autoComplete="off"
            aria-label="Ключ из Telegram"
            placeholder="ABCDE-FGHJK"
            maxLength={20}
            value={keyValue}
            disabled={needUsername}
            onChange={(e) => setKeyValue(e.target.value)}
            className={`${inputCls} text-center text-lg tracking-[0.2em] uppercase`}
          />
          {needUsername && (
            <>
              <p className="text-[11px] text-neutral-300 font-sans">Аккаунта с этим Telegram ещё нет. Выберите имя профиля:</p>
              <div className="relative">
                <span className="absolute left-3.5 top-3.5 text-neutral-600 font-bold">@</span>
                <input
                  type="text"
                  aria-label="Имя нового профиля"
                  placeholder="cryteam_dev"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className={`${inputCls} pl-8`}
                  autoFocus
                />
              </div>
              <label className="flex items-start gap-2 text-[10px] text-neutral-400 leading-relaxed font-sans cursor-pointer">
                <input type="checkbox" checked={acceptTerms} onChange={(e) => setAcceptTerms(e.target.checked)} className="mt-0.5" />
                <span>
                  Я принимаю <a href="/terms" target="_blank" rel="noopener" className="text-cb-accent underline">Условия использования</a> и <a href="/privacy" target="_blank" rel="noopener" className="text-cb-accent underline">Политику конфиденциальности</a>
                </span>
              </label>
            </>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cb-accent text-cb-on-accent font-black py-3.5 rounded-sm uppercase tracking-widest text-xs hover:bg-cb-accent-hover cursor-pointer disabled:opacity-60"
          >
            {loading ? 'Проверяем…' : needUsername ? 'Создать аккаунт' : 'Войти по ключу'}
          </button>
        </form>
      )}
    </div>
  );
}
