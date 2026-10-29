import type { BioConfig } from '../types';
import { DEFAULT_FX, FX_PRESETS, clampSettings, type FxSettings, type FxType } from './engine';

const LEGACY_SNOW_DENSITY = { low: 0.6, medium: 1, high: 1.6 } as const;

/**
 * Настройки частиц профиля.
 * Новые поля fx* главные; старый переключатель снегопада (snowEffectsEnabled) читается как «снег»,
 * чтобы уже сохранённые профили выглядели как раньше (но с нормальным снегом).
 */
export function fxFromConfig(config: Partial<BioConfig> | null | undefined): FxSettings | null {
  if (!config) return null;
  if (config.fxEnabled === true) {
    const type: FxType = config.fxType && FX_PRESETS[config.fxType] ? config.fxType : 'snow';
    return clampSettings({
      ...DEFAULT_FX,
      type,
      colorMode: config.fxColorMode || 'preset',
      color: config.fxColor || DEFAULT_FX.color,
      density: config.fxDensity ?? 1,
      size: config.fxSize ?? 1,
      speed: config.fxSpeed ?? 1,
      wind: config.fxWind ?? 0,
      sway: config.fxSway ?? 1,
      mouse: config.fxMouse || 'off',
      reverse: !!config.fxReverse,
    });
  }
  if (config.fxEnabled === undefined && config.snowEffectsEnabled) {
    return clampSettings({ ...DEFAULT_FX, type: 'snow', density: LEGACY_SNOW_DENSITY[config.snowIntensity || 'medium'] });
  }
  return null;
}

/** Старые типы фона «снег» и «дождь» рисуются тем же движком (если частицы не включены отдельно). */
export function legacyBgFx(config: Partial<BioConfig> | null | undefined): FxSettings | null {
  if (!config || (config.bgType !== 'snow' && config.bgType !== 'rain')) return null;
  if (config.fxEnabled === true) return null; // частицы уже включены отдельно — не дублируем
  const type: FxType = config.bgType === 'rain' ? 'rain' : 'snow';
  const color = config.bgType === 'rain' ? config.bgEffectColor : undefined;
  return clampSettings({
    ...DEFAULT_FX,
    type,
    colorMode: color ? 'custom' : 'preset',
    color: color || DEFAULT_FX.color,
    density: LEGACY_SNOW_DENSITY[config.snowIntensity || 'medium'],
  });
}

/** Ключ для сравнения настроек (мемоизация/тесты) */
export function fxKey(s: FxSettings | null): string {
  return s ? JSON.stringify(s) : '';
}

/** Патч конфига из настроек (для сохранения из меню выбора) */
export function fxToConfigPatch(s: FxSettings | null): Partial<BioConfig> {
  if (!s) return { fxEnabled: false, snowEffectsEnabled: false };
  return {
    fxEnabled: true,
    snowEffectsEnabled: false, // старый флаг больше не нужен — иначе снег «воскреснет» при выключении fx
    fxType: s.type,
    fxColorMode: s.colorMode,
    fxColor: s.color,
    fxDensity: s.density,
    fxSize: s.size,
    fxSpeed: s.speed,
    fxWind: s.wind,
    fxSway: s.sway,
    fxMouse: s.mouse,
    fxReverse: s.reverse,
  };
}
