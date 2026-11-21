/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';

export interface StudioPrefs {
  /** Сторона панели на широких экранах */
  panelSide: 'right' | 'left';
  /** Размер элементов управления: крупные удобнее пальцем */
  controls: 'normal' | 'large';
  /** Показывать сетку по умолчанию */
  showGrid: boolean;
}

export const DEFAULT_STUDIO_PREFS: StudioPrefs = { panelSide: 'right', controls: 'normal', showGrid: true };

/** Готовые стили конструктора: один клик вместо трёх переключателей */
export const STUDIO_PRESETS = [
  { id: 'classic', label: 'Классика', hint: 'Панель справа, сетка включена', prefs: { panelSide: 'right', controls: 'normal', showGrid: true } },
  { id: 'touch', label: 'Для телефона', hint: 'Крупные элементы, без сетки', prefs: { panelSide: 'right', controls: 'large', showGrid: false } },
  { id: 'compact', label: 'Слева', hint: 'Панель слева, как в редакторах', prefs: { panelSide: 'left', controls: 'normal', showGrid: true } },
] as const satisfies readonly { id: string; label: string; hint: string; prefs: StudioPrefs }[];

export type StudioPresetId = (typeof STUDIO_PRESETS)[number]['id'];

/** Какой пресет сейчас выбран; null, если настройки собраны вручную */
export function detectStudioPreset(p: StudioPrefs): StudioPresetId | null {
  const hit = STUDIO_PRESETS.find((x) => x.prefs.panelSide === p.panelSide && x.prefs.controls === p.controls && x.prefs.showGrid === p.showGrid);
  return hit ? hit.id : null;
}

const KEY = 'cb_studio_prefs';
const TOUR_KEY = 'cb_studio_tour_done';
/** Разные части интерфейса читают одни и те же настройки: событие синхронизирует их в одной вкладке */
export const PREFS_EVENT = 'cb-prefs-changed';

export function readStudioPrefs(): StudioPrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_STUDIO_PREFS;
    const p = JSON.parse(raw) as Partial<StudioPrefs>;
    return {
      panelSide: p.panelSide === 'left' ? 'left' : 'right',
      controls: p.controls === 'large' ? 'large' : 'normal',
      showGrid: p.showGrid !== false,
    };
  } catch {
    return DEFAULT_STUDIO_PREFS;
  }
}

export function useStudioPrefs(): [StudioPrefs, (patch: Partial<StudioPrefs>) => void] {
  const [prefs, setPrefs] = useState<StudioPrefs>(readStudioPrefs);
  useEffect(() => {
    const sync = () => setPrefs(readStudioPrefs());
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) sync(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(PREFS_EVENT, sync);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener(PREFS_EVENT, sync);
    };
  }, []);
  const update = useCallback((patch: Partial<StudioPrefs>) => {
    const next = { ...readStudioPrefs(), ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* приватный режим */ }
    setPrefs(next);
    window.dispatchEvent(new Event(PREFS_EVENT));
  }, []);
  return [prefs, update];
}

export function isTourDone(): boolean {
  try { return localStorage.getItem(TOUR_KEY) === '1'; } catch { return true; }
}
export function markTourDone(): void {
  try { localStorage.setItem(TOUR_KEY, '1'); } catch { /* ignore */ }
}
export function resetTour(): void {
  try { localStorage.removeItem(TOUR_KEY); } catch { /* ignore */ }
}
