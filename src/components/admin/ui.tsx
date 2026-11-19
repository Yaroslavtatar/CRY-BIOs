import React, { useEffect } from 'react';
import { X, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';

const cx = (...parts: Array<string | false | null | undefined>) => parts.filter(Boolean).join(' ');

export function Card({ title, description, actions, children, className, padded = true }: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cx('rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-sm', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-5 pt-5">
          <div className="min-w-0">
            {title && <h3 className="text-[15px] font-semibold text-white tracking-tight">{title}</h3>}
            {description && <p className="mt-1 text-xs leading-relaxed text-neutral-400 max-w-prose">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx(padded && 'p-5', (title || actions) && padded && 'pt-4')}>{children}</div>
    </section>
  );
}

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'warning';
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-[#00f2ff] text-black hover:bg-[#33f5ff] shadow-[0_0_0_1px_rgba(0,242,255,0.4),0_8px_24px_-8px_rgba(0,242,255,0.5)]',
  secondary: 'bg-white/[0.06] text-neutral-100 hover:bg-white/[0.1] border border-white/10',
  ghost: 'text-neutral-300 hover:text-white hover:bg-white/[0.06]',
  danger: 'bg-red-500/10 text-red-300 hover:bg-red-500/20 border border-red-500/20',
  warning: 'bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 border border-amber-500/20',
};

export function Button({ variant = 'secondary', size = 'md', loading, icon, children, className, disabled, ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
  icon?: React.ReactNode;
}) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150 select-none cursor-pointer',
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#00f2ff] disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-4 py-2 text-sm',
        VARIANTS[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

export function Badge({ tone = 'neutral', children }: { tone?: 'neutral' | 'accent' | 'success' | 'warning' | 'danger'; children: React.ReactNode }) {
  const tones = {
    neutral: 'bg-white/[0.06] text-neutral-300 border-white/10',
    accent: 'bg-[#00f2ff]/10 text-[#00f2ff] border-[#00f2ff]/20',
    success: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-300 border-amber-500/20',
    danger: 'bg-red-500/10 text-red-300 border-red-500/20',
  };
  return <span className={cx('inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium', tones[tone])}>{children}</span>;
}

export function Toggle({ checked, onChange, disabled, label, description }: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: React.ReactNode;
  description?: React.ReactNode;
}) {
  return (
    <label className={cx('flex items-start justify-between gap-4 py-3', disabled ? 'opacity-60' : 'cursor-pointer')}>
      <span className="min-w-0">
        <span className="block text-sm text-neutral-100">{label}</span>
        {description && <span className="block mt-0.5 text-xs text-neutral-400 leading-relaxed">{description}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors cursor-pointer',
          checked ? 'bg-[#00f2ff]' : 'bg-white/15',
        )}
      >
        <span className={cx('absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform', checked && 'translate-x-5 bg-black')} />
      </button>
    </label>
  );
}

const inputBase =
  'w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm text-white placeholder:text-neutral-500 transition focus:border-[#00f2ff]/60 focus:outline-none focus:ring-2 focus:ring-[#00f2ff]/15';

export function Field({ label, hint, children }: { label: React.ReactNode; hint?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-neutral-300">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-neutral-500">{hint}</span>}
    </label>
  );
}

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...rest }, ref) {
  return <input ref={ref} {...rest} className={cx(inputBase, className)} />;
});

export function TextArea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...rest} className={cx(inputBase, 'resize-y min-h-[84px]', className)} />;
}

export function Select({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={cx(inputBase, 'cursor-pointer', className)}>
      {children}
    </select>
  );
}

export function StatCard({ label, value, hint, icon, tone = 'accent' }: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  tone?: 'accent' | 'success' | 'warning' | 'danger';
}) {
  const tones = { accent: 'text-[#00f2ff] bg-[#00f2ff]/10', success: 'text-emerald-300 bg-emerald-500/10', warning: 'text-amber-300 bg-amber-500/10', danger: 'text-red-300 bg-red-500/10' };
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs text-neutral-400">{label}</span>
        {icon && <span className={cx('flex h-8 w-8 items-center justify-center rounded-lg', tones[tone])}>{icon}</span>}
      </div>
      <div className="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-[11px] text-neutral-500">{hint}</div>}
    </div>
  );
}

export function Modal({ open, title, onClose, children, footer, wide }: {
  open: boolean;
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('relative w-full rounded-2xl border border-white/10 bg-[#0d0d0f] shadow-2xl', wide ? 'max-w-2xl' : 'max-w-md')}>
        <div className="flex items-center justify-between border-b border-white/[0.07] px-5 py-4">
          <h3 className="text-base font-semibold text-white">{title}</h3>
          <button onClick={onClose} aria-label="Закрыть" className="rounded-md p-1 text-neutral-400 hover:bg-white/10 hover:text-white cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.07] px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export interface ToastMsg { id: number; tone: 'success' | 'error' | 'info'; text: string }

export function Toasts({ items, dismiss }: { items: ToastMsg[]; dismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[110] flex w-[min(92vw,380px)] flex-col gap-2">
      {items.map((t) => {
        const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertTriangle : Info;
        const color = t.tone === 'success' ? 'text-emerald-300 border-emerald-500/30' : t.tone === 'error' ? 'text-red-300 border-red-500/30' : 'text-sky-300 border-sky-500/30';
        return (
          <div key={t.id} role="status" className={cx('pointer-events-auto flex items-start gap-3 rounded-xl border bg-[#111113] px-4 py-3 shadow-xl', color)}>
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-sm text-neutral-100 break-words">{t.text}</p>
            <button onClick={() => dismiss(t.id)} aria-label="Скрыть" className="text-neutral-500 hover:text-white cursor-pointer">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">{title}</h1>
        {description && <p className="mt-1 text-sm text-neutral-400 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-white/10 px-4 py-10 text-center text-sm text-neutral-500">{children}</div>;
}

export function ProgressBar({ value, tone = 'accent' }: { value: number; tone?: 'accent' | 'warning' | 'danger' }) {
  const color = tone === 'danger' ? 'bg-red-400' : tone === 'warning' ? 'bg-amber-400' : 'bg-[#00f2ff]';
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

export { cx };
