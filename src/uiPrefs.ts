/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState, type CSSProperties } from 'react';
import { PREFS_EVENT } from './studioPrefs';

/** Стиль кабинета и редактора профиля. Хранится на устройстве: на телефоне и на ПК удобно по-разному. */
export interface UiPrefs {
  /** simple: только основное; full: все разделы */
  editorMode: 'simple' | 'full';
  /** Живой предпросмотр рядом с редактором на широких экранах */
  preview: 'side' | 'hidden';
  /** Свой акцентный цвет кабинета (#rrggbb) или null — цвет темы платформы */
  accent: string | null;
}

export const DEFAULT_UI_PREFS: UiPrefs = { editorMode: 'full', preview: 'side', accent: null };

/** Разделы, которые остаются в простом режиме */
export const SIMPLE_TABS = ['overview', 'analytics', 'studio', 'blocks', 'background', 'profile', 'settings'] as const;

export const UI_ACCENTS = ['#00f2ff', '#8a2be2', '#f43f5e', '#f59e0b', '#22c55e', '#ec4899', '#3b82f6'] as const;

const KEY = 'cb_ui_prefs';
const HEX = /^#[0-9a-f]{6}$/i;

export function readUiPrefs(): UiPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_UI_PREFS;
    const p = JSON.parse(raw) as Partial<UiPrefs>;
    return {
      editorMode: p.editorMode === 'simple' ? 'simple' : 'full',
      preview: p.preview === 'hidden' ? 'hidden' : 'side',
      accent: typeof p.accent === 'string' && HEX.test(p.accent) ? p.accent.toLowerCase() : null,
    };
  } catch {
    return DEFAULT_UI_PREFS;
  }
}

export function useUiPrefs(): [UiPrefs, (patch: Partial<UiPrefs>) => void] {
  const [prefs, setPrefs] = useState<UiPrefs>(readUiPrefs);
  useEffect(() => {
    const sync = () => setPrefs(readUiPrefs());
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(PREFS_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PREFS_EVENT, sync);
    };
  }, []);
  const update = useCallback((patch: Partial<UiPrefs>) => {
    const next = { ...readUiPrefs(), ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* приватный режим */ }
    setPrefs(next);
    window.dispatchEvent(new Event(PREFS_EVENT));
  }, []);
  return [prefs, update];
}

function lum(hex: string): number {
  const ch = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/** CSS-переменные акцента для корня кабинета: цвет, наведение и читаемый цвет текста на нём */
export function accentStyle(accent: string | null): CSSProperties | undefined {
  if (!accent || !HEX.test(accent)) return undefined;
  const mix = (i: number) => Math.round(parseInt(accent.slice(i, i + 2), 16) * 0.85 + 255 * 0.15).toString(16).padStart(2, '0');
  const hover = `#${mix(1)}${mix(3)}${mix(5)}`;
  const on = lum(accent) > 0.4 ? '#000000' : '#ffffff';
  return { '--cb-accent': accent, '--cb-accent-hover': hover, '--cb-on-accent': on } as CSSProperties;
}

// --- онбординг и чек-лист: прогресс хранится по имени пользователя ---

const pendingKey = (u: string) => `cb_onboarding_pending:${u}`;
const checklistKey = (u: string) => `cb_checklist_hidden:${u}`;

/** Мастер ждёт прохождения: ставится при регистрации и снимается, когда человек закончил или пропустил */
export function setOnboardingPending(username: string, pending: boolean): void {
  try {
    if (pending) localStorage.setItem(pendingKey(username), '1');
    else localStorage.removeItem(pendingKey(username));
  } catch { /* ignore */ }
}
export function isOnboardingPending(username: string): boolean {
  try { return localStorage.getItem(pendingKey(username)) === '1'; } catch { return false; }
}
export function isChecklistHidden(username: string): boolean {
  try { return localStorage.getItem(checklistKey(username)) === '1'; } catch { return false; }
}
export function setChecklistHidden(username: string, hidden: boolean): void {
  try {
    if (hidden) localStorage.setItem(checklistKey(username), '1');
    else localStorage.removeItem(checklistKey(username));
  } catch { /* ignore */ }
}
