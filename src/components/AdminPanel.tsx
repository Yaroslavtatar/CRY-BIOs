import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LayoutDashboard, Users as UsersIcon, Layout, Archive, Server as ServerIcon, LogOut, ArrowLeft, Shield, Menu, X, Loader2 } from 'lucide-react';
import { useAdminApi } from './admin/adminApi';
import { Button, Field, TextInput, Toasts, cx, type ToastMsg } from './admin/ui';
import Overview from './admin/sections/Overview';
import Users from './admin/sections/Users';
import HomeBuilder from './admin/sections/HomeBuilder';
import Backups from './admin/sections/Backups';
import Server from './admin/sections/Server';

interface AdminPanelProps {
  onExit: () => void;
}

type Page = 'overview' | 'users' | 'home' | 'backups' | 'server';

const NAV: { id: Page; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Обзор', icon: LayoutDashboard },
  { id: 'home', label: 'Конструктор главной', icon: Layout },
  { id: 'users', label: 'Пользователи', icon: UsersIcon },
  { id: 'backups', label: 'Бэкапы', icon: Archive },
  { id: 'server', label: 'Сервер', icon: ServerIcon },
];

const PAGE_IDS = new Set<string>(NAV.map((n) => n.id));

function pageFromHash(): Page {
  const h = window.location.hash.replace(/^#\/?/, '').replace(/^admin\/?/, '');
  return PAGE_IDS.has(h) ? (h as Page) : 'overview';
}

export default function AdminPanel({ onExit }: AdminPanelProps) {
  const [password, setPassword] = useState('');
  const [authed, setAuthed] = useState(false);
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [page, setPage] = useState<Page>(() => (typeof window === 'undefined' ? 'overview' : pageFromHash()));
  const [menuOpen, setMenuOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toastId = useRef(0);

  // Админ-пароль живёт только в памяти вкладки; старые копии из storage удаляем.
  useEffect(() => {
    try {
      localStorage.removeItem('admin_password');
      sessionStorage.removeItem('admin_password');
    } catch { /* storage недоступен */ }
  }, []);

  const api = useAdminApi(password);

  const notify = useCallback((tone: ToastMsg['tone'], text: string) => {
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-3), { id, tone, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 7000 : 4000);
  }, []);

  const goTo = useCallback((next: string) => {
    if (!PAGE_IDS.has(next)) return;
    setPage(next as Page);
    setMenuOpen(false);
    try { window.history.replaceState(null, '', `/admin#${next}`); } catch { /* ignore */ }
  }, []);

  const login = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setAuthError('Введите пароль администратора');
      return;
    }
    setAuthLoading(true);
    setAuthError('');
    try {
      const res = await fetch('/api/admin/verify', { headers: { 'x-admin-password': encodeURIComponent(password) } });
      if (res.status === 429) throw new Error('Слишком много неудачных попыток. Попробуйте позже.');
      if (!res.ok) throw new Error('Неверный пароль администратора');
      setAuthed(true);
    } catch (err: any) {
      setAuthError(err.message || 'Ошибка авторизации');
      setAuthed(false);
    } finally {
      setAuthLoading(false);
    }
  };

  const logout = () => {
    setPassword('');
    setAuthed(false);
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-[#09090b] font-sans text-white antialiased selection:bg-[#00f2ff]/30">
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
        <div className="absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-[#00f2ff]/[0.05] blur-[140px]" />
        <div className="absolute -bottom-40 -right-40 h-[520px] w-[520px] rounded-full bg-violet-500/[0.05] blur-[140px]" />
      </div>
      <div className="relative">{children}</div>
      <Toasts items={toasts} dismiss={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </div>
  );

  if (!authed) {
    return shell(
      <div className="flex min-h-screen items-center justify-center p-4">
        <form onSubmit={login} className="w-full max-w-sm space-y-6 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-7 shadow-2xl backdrop-blur">
          <div className="text-center">
            <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#00f2ff]/10 text-[#00f2ff]"><Shield className="h-6 w-6" /></span>
            <h1 className="text-xl font-semibold tracking-tight">Вход в админ-панель</h1>
            <p className="mt-1 text-sm text-neutral-400">CRY BIOS · управление платформой</p>
          </div>
          <Field label="Пароль администратора">
            <TextInput type="password" autoComplete="current-password" autoFocus value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </Field>
          {authError && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-300">{authError}</p>}
          <Button type="submit" variant="primary" className="w-full" loading={authLoading}>Войти</Button>
          <button type="button" onClick={onExit} className="mx-auto flex items-center gap-1.5 text-xs text-neutral-500 hover:text-white cursor-pointer"><ArrowLeft className="h-3.5 w-3.5" />На главную</button>
        </form>
      </div>,
    );
  }

  const sectionProps = { api, notify };
  const wide = page === 'home';

  return shell(
    <div className="flex min-h-screen">
      {/* боковое меню */}
      <aside className={cx(
        'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/[0.07] bg-[#0b0b0e]/95 p-4 backdrop-blur transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0',
        menuOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="mb-6 flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#00f2ff] text-lg font-black text-black">C</span>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight">CRY BIOS</div>
              <div className="text-[11px] text-neutral-500">Админ-панель</div>
            </div>
          </div>
          <button className="rounded-md p-1 text-neutral-400 hover:bg-white/10 lg:hidden cursor-pointer" onClick={() => setMenuOpen(false)} aria-label="Закрыть меню"><X className="h-4 w-4" /></button>
        </div>
        <nav className="flex-1 space-y-1" aria-label="Разделы админки">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => goTo(id)}
              aria-current={page === id ? 'page' : undefined}
              className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition cursor-pointer', page === id ? 'bg-[#00f2ff]/10 text-[#00f2ff]' : 'text-neutral-400 hover:bg-white/[0.05] hover:text-white')}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </nav>
        <div className="space-y-1 border-t border-white/[0.07] pt-3">
          <button onClick={onExit} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-neutral-400 transition hover:bg-white/[0.05] hover:text-white cursor-pointer"><ArrowLeft className="h-4 w-4" />На сайт</button>
          <button onClick={logout} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-red-300/80 transition hover:bg-red-500/10 hover:text-red-300 cursor-pointer"><LogOut className="h-4 w-4" />Выйти</button>
        </div>
      </aside>
      {menuOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setMenuOpen(false)} />}

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-white/[0.07] bg-[#09090b]/80 px-4 py-3 backdrop-blur lg:hidden">
          <button onClick={() => setMenuOpen(true)} className="rounded-md p-1.5 text-neutral-300 hover:bg-white/10 cursor-pointer" aria-label="Открыть меню"><Menu className="h-5 w-5" /></button>
          <span className="text-sm font-medium">{NAV.find((n) => n.id === page)?.label}</span>
        </header>
        <main className={cx(wide ? 'px-4 py-6 sm:px-8' : 'mx-auto max-w-6xl px-4 py-6 sm:px-8 sm:py-8')}>
          <React.Suspense fallback={<Loader2 className="mx-auto mt-20 h-6 w-6 animate-spin text-neutral-500" />}>
            {page === 'overview' && <Overview {...sectionProps} goTo={goTo} />}
            {page === 'home' && <HomeBuilder {...sectionProps} />}
            {page === 'users' && <Users {...sectionProps} />}
            {page === 'backups' && <Backups {...sectionProps} />}
            {page === 'server' && <Server {...sectionProps} />}
          </React.Suspense>
        </main>
      </div>
    </div>,
  );
}
