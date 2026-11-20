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

const KEY = 'cb_studio_prefs';
const TOUR_KEY = 'cb_studio_tour_done';

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
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setPrefs(readStudioPrefs()); };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const update = useCallback((patch: Partial<StudioPrefs>) => {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* приватный режим */ }
      return next;
    });
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
