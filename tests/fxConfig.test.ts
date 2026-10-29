import { describe, it, expect } from 'vitest';
import { fxFromConfig, fxToConfigPatch, legacyBgFx } from '../src/fx/config';

describe('fxFromConfig', () => {
  it('нет настроек → частиц нет', () => {
    expect(fxFromConfig(null)).toBeNull();
    expect(fxFromConfig({})).toBeNull();
    expect(fxFromConfig({ fxEnabled: false })).toBeNull();
  });

  it('старый снегопад (snowEffectsEnabled) читается как снег с прежней плотностью', () => {
    expect(fxFromConfig({ snowEffectsEnabled: true })).toMatchObject({ type: 'snow', density: 1 });
    expect(fxFromConfig({ snowEffectsEnabled: true, snowIntensity: 'low' })!.density).toBe(0.6);
    expect(fxFromConfig({ snowEffectsEnabled: true, snowIntensity: 'high' })!.density).toBe(1.6);
  });

  it('явный fxEnabled=false выключает даже старый снегопад', () => {
    expect(fxFromConfig({ fxEnabled: false, snowEffectsEnabled: true })).toBeNull();
  });

  it('новые настройки читаются полностью и ограничиваются допустимыми диапазонами', () => {
    const s = fxFromConfig({ fxEnabled: true, fxType: 'leaves', fxColorMode: 'custom', fxColor: '#ff8800', fxDensity: 9, fxSize: 1.5, fxSpeed: 2, fxWind: 5, fxSway: 0, fxMouse: 'wind', fxReverse: true })!;
    expect(s).toMatchObject({ type: 'leaves', colorMode: 'custom', color: '#ff8800', size: 1.5, speed: 2, sway: 0, mouse: 'wind', reverse: true });
    expect(s.density).toBe(2.5);
    expect(s.wind).toBe(1);
  });

  it('неизвестный тип заменяется снегом', () => {
    expect(fxFromConfig({ fxEnabled: true, fxType: 'nonsense' as any })!.type).toBe('snow');
  });
});

describe('fxToConfigPatch', () => {
  it('туда-обратно без потерь', () => {
    const original = fxFromConfig({ fxEnabled: true, fxType: 'petals', fxColorMode: 'rainbow', fxWind: 0.4, fxMouse: 'repel', fxSpeed: 1.2 })!;
    expect(fxFromConfig(fxToConfigPatch(original))).toEqual(original);
  });

  it('выключение гасит и новый, и старый флаг — снег не «воскреснет»', () => {
    const patch = fxToConfigPatch(null);
    expect(patch).toEqual({ fxEnabled: false, snowEffectsEnabled: false });
    expect(fxFromConfig({ snowEffectsEnabled: true, ...patch })).toBeNull();
  });

  it('сохранение выбора отключает старый флаг, чтобы не дублировать частицы', () => {
    const patch = fxToConfigPatch(fxFromConfig({ fxEnabled: true, fxType: 'rain' }));
    expect(patch.snowEffectsEnabled).toBe(false);
    expect(patch.fxEnabled).toBe(true);
  });
});

describe('legacyBgFx (старые фоны «снег» и «дождь»)', () => {
  it('рисуются новым движком', () => {
    expect(legacyBgFx({ bgType: 'snow' })!.type).toBe('snow');
    expect(legacyBgFx({ bgType: 'rain' })!.type).toBe('rain');
  });
  it('цвет дождя берётся из bgEffectColor', () => {
    const rain = legacyBgFx({ bgType: 'rain', bgEffectColor: '#00ff00' })!;
    expect(rain.colorMode).toBe('custom');
    expect(rain.color).toBe('#00ff00');
  });
  it('для остальных фонов — нет; если частицы включены отдельно — не дублируем', () => {
    expect(legacyBgFx({ bgType: 'matrix' })).toBeNull();
    expect(legacyBgFx({ bgType: 'snow', fxEnabled: true })).toBeNull();
    expect(legacyBgFx(null)).toBeNull();
  });
});
