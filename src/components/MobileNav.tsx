/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef } from 'react';
import { Home, Layers, Palette, User } from 'lucide-react';

export interface NavGroup<T extends string = string> {
  id: string;
  label: string;
  tabs: { id: T; label: string }[];
}

const ICONS: Record<string, React.ReactNode> = {
  home: <Home className="w-5 h-5" />,
  build: <Layers className="w-5 h-5" />,
  look: <Palette className="w-5 h-5" />,
  account: <User className="w-5 h-5" />,
};

/** Высота нижней панели без учёта «чёлки»; на неё же ориентируется закреплённая панель сохранения */
export const MOBILE_NAV_HEIGHT = 60;

interface MobileNavProps<T extends string> {
  groups: NavGroup<T>[];
  activeTab: T;
  onSelectTab: (tab: T) => void;
}

/** Нижняя панель разделов для телефона: четыре крупные кнопки в зоне досягаемости большого пальца */
export function MobileBottomNav<T extends string>({ groups, activeTab, onSelectTab }: MobileNavProps<T>) {
  return (
    <nav
      aria-label="Разделы кабинета"
      className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-cb-surface/95 backdrop-blur border-t border-white/10 grid"
      style={{ gridTemplateColumns: `repeat(${groups.length}, minmax(0, 1fr))`, paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {groups.map((g) => {
        const active = g.tabs.some((t) => t.id === activeTab);
        return (
          <button
            key={g.id}
            type="button"
            aria-current={active ? 'page' : undefined}
            onClick={() => { if (!active) onSelectTab(g.tabs[0].id); }}
            style={{ minHeight: MOBILE_NAV_HEIGHT }}
            className={`flex flex-col items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-wide cursor-pointer transition ${active ? 'text-cb-accent' : 'text-neutral-500 active:text-white'}`}
          >
            <span className={`px-4 py-1 rounded-full ${active ? 'bg-cb-accent/15' : ''}`}>{ICONS[g.id]}</span>
            {g.label}
          </button>
        );
      })}
    </nav>
  );
}

/** Подразделы текущей группы: одна прокручиваемая строка, закреплённая под шапкой */
export function MobileSubTabs<T extends string>({ groups, activeTab, onSelectTab }: MobileNavProps<T>) {
  const group = groups.find((g) => g.tabs.some((t) => t.id === activeTab)) ?? groups[0];
  const activeRef = useRef<HTMLButtonElement | null>(null);

  // Активный подраздел всегда виден: при смене группы или раздела прокручиваем строку к нему
  useEffect(() => {
    activeRef.current?.scrollIntoView?.({ inline: 'center', block: 'nearest' });
  }, [activeTab, group?.id]);

  if (!group) return null;
  return (
    <div className="lg:hidden sticky top-0 z-30 bg-cb-bg/95 backdrop-blur border-b border-white/10">
      <div role="tablist" aria-label={group.label} className="flex gap-2 overflow-x-auto px-4 py-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {group.tabs.map((t) => {
          const active = t.id === activeTab;
          return (
            <button
              key={t.id}
              ref={active ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSelectTab(t.id)}
              className={`flex-shrink-0 px-4 min-h-[40px] rounded-full text-[11px] font-bold uppercase tracking-wider cursor-pointer transition ${active ? 'bg-cb-accent text-cb-on-accent' : 'bg-white/5 text-neutral-300 active:bg-white/15'}`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
