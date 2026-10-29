import { describe, it, expect } from 'vitest';
import {
  FX_PRESETS, FX_CATALOG, DEFAULT_FX, clampSettings, targetCount, createParticle, stepParticle, nextWind,
  isDead, hexToHsl, pickColor, type FxSettings, type FxEnv,
} from '../src/fx/engine';

// детерминированный ГСЧ (mulberry32) — тесты не зависят от случайности
function rng(seed = 1) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const env = (o: Partial<FxEnv> = {}): FxEnv => ({ w: 1000, h: 600, wind: 0, mouse: null, ...o });
const settings = (o: Partial<FxSettings> = {}): FxSettings => ({ ...DEFAULT_FX, ...o });

describe('каталог частиц', () => {
  it('содержит 12 типов для фона и у каждого есть название, описание и палитра', () => {
    expect(FX_CATALOG).toHaveLength(12);
    for (const p of FX_CATALOG) {
      expect(p.label).toBeTruthy();
      expect(p.hint.length).toBeGreaterThan(10);
      expect(p.palette.length).toBeGreaterThan(0);
      expect(p.size[0]).toBeLessThanOrEqual(p.size[1]);
      expect(p.alpha[0]).toBeLessThanOrEqual(p.alpha[1]);
    }
  });
  it('sparks (аура ника) не попадает в меню выбора фона', () => {
    expect(FX_CATALOG.find((p) => p.id === 'sparks')).toBeUndefined();
    expect(FX_PRESETS.sparks).toBeDefined();
  });
});

describe('clampSettings и targetCount', () => {
  it('ограничивает значения допустимыми диапазонами', () => {
    const c = clampSettings(settings({ density: 99, size: 0, speed: -5, wind: 7, sway: 9 }));
    expect(c.density).toBe(2.5);
    expect(c.size).toBe(0.5); // 0 — валидное число, прижимается к минимуму (не «по умолчанию»)
    expect(c.speed).toBe(0.3);
    expect(c.wind).toBe(1);
    expect(c.sway).toBe(2);
  });
  it('мусорные значения заменяются значениями по умолчанию', () => {
    const c = clampSettings(settings({ density: NaN, size: undefined as any, speed: 'abc' as any, wind: null as any }));
    expect([c.density, c.size, c.speed, c.wind]).toEqual([1, 1, 1, 0]);
  });
  it('количество растёт с плотностью и площадью, но ограничено', () => {
    const p = FX_PRESETS.snow;
    const base = targetCount(p, settings({ density: 1 }), 1280, 720);
    expect(targetCount(p, settings({ density: 2 }), 1280, 720)).toBeGreaterThan(base);
    expect(targetCount(p, settings(), 390, 844)).toBeLessThan(base); // телефон — меньше частиц
    expect(targetCount(p, settings({ density: 2.5 }), 8000, 8000)).toBeLessThanOrEqual(420);
    expect(targetCount(p, settings({ density: 0.2 }), 10, 10)).toBeGreaterThanOrEqual(4);
  });
  it('при reduced-motion частиц вдвое меньше', () => {
    const p = FX_PRESETS.snow;
    expect(targetCount(p, settings(), 1280, 720, true)).toBeLessThan(targetCount(p, settings(), 1280, 720, false));
  });
});

describe('цвет', () => {
  it('hexToHsl: чистые цвета и серый', () => {
    expect(hexToHsl('#ff0000')).toMatchObject({ h: 0, s: 100, l: 50 });
    expect(hexToHsl('#00ff00').h).toBeCloseTo(120);
    expect(hexToHsl('#808080').s).toBe(0);
    expect(hexToHsl('#f00').h).toBe(0);
    expect(hexToHsl('мусор').h).toBe(190); // безопасный дефолт
  });
  it('preset берёт цвет из палитры типа', () => {
    const c = pickColor(FX_PRESETS.snow, settings({ colorMode: 'preset' }), rng());
    expect(FX_PRESETS.snow.palette).toContain(c);
  });
  it('custom даёт оттенки одного тона (не ломает выбранный цвет)', () => {
    const r = rng(3);
    const hues = new Set<number>();
    for (let i = 0; i < 40; i++) {
      const c = pickColor(FX_PRESETS.snow, settings({ colorMode: 'custom', color: '#ff0000' }), r);
      const m = /hsl\((\d+), (\d+)%, (\d+)%\)/.exec(c)!;
      hues.add(Number(m[1]));
      const h = Number(m[1]);
      expect(h <= 8 || h >= 352).toBe(true); // красный ± небольшой разброс
    }
    expect(hues.size).toBeGreaterThan(1);
  });
  it('rainbow даёт разные тона, палитра-override (ауры) имеет приоритет', () => {
    const r = rng(5);
    const hues = new Set(Array.from({ length: 30 }, () => pickColor(FX_PRESETS.snow, settings({ colorMode: 'rainbow' }), r)));
    expect(hues.size).toBeGreaterThan(10);
    expect(pickColor(FX_PRESETS.snow, settings({ palette: ['#123456'] }), r)).toBe('#123456');
  });
});

describe('физика', () => {
  it('снег падает вниз, дождь быстрее снега, пузыри всплывают', () => {
    const e = env();
    const make = (t: keyof typeof FX_PRESETS) => createParticle(FX_PRESETS[t], settings({ type: t }), e, rng(2), true);
    expect(make('snow').vy).toBeGreaterThan(0);
    expect(make('rain').vy).toBeGreaterThan(make('snow').vy * 5);
    expect(make('bubbles').vy).toBeLessThan(0);
    expect(make('embers').vy).toBeLessThan(0);
  });

  it('reverse разворачивает гравитацию', () => {
    const e = env();
    const down = createParticle(FX_PRESETS.snow, settings(), e, rng(2), true);
    const up = createParticle(FX_PRESETS.snow, settings({ reverse: true }), e, rng(2), true);
    expect(down.vy).toBeGreaterThan(0);
    expect(up.vy).toBeLessThan(0);
  });

  it('ветер вправо сносит частицы вправо, влево — влево', () => {
    const run = (wind: number) => {
      const s = settings({ wind });
      const e = env({ wind });
      const p = createParticle(FX_PRESETS.snow, s, e, rng(7), true);
      const x0 = p.x;
      for (let i = 0; i < 200; i++) stepParticle(p, FX_PRESETS.snow, s, e, rng(i), 1);
      return p.x - x0;
    };
    expect(run(1)).toBeGreaterThan(40);
    expect(run(-1)).toBeLessThan(-40);
    expect(Math.abs(run(0))).toBeLessThan(Math.abs(run(1)));
  });

  it('дождь наклоняется по ветру сильнее, чем снег', () => {
    const e = env({ wind: 1 });
    const s = settings({ wind: 1 });
    const rain = createParticle(FX_PRESETS.rain, s, e, rng(4), true);
    const snow = createParticle(FX_PRESETS.snow, s, e, rng(4), true);
    for (let i = 0; i < 100; i++) {
      stepParticle(rain, FX_PRESETS.rain, s, e, rng(i), 1);
      stepParticle(snow, FX_PRESETS.snow, s, e, rng(i), 1);
    }
    expect(rain.vx).toBeGreaterThan(snow.vx * 2);
  });

  it('скорость не зависит от частоты кадров (dt): 2 шага по 0.5 ≈ 1 шаг по 1', () => {
    const s = settings();
    const e = env();
    const a = createParticle(FX_PRESETS.snow, s, e, rng(9), true);
    const b = { ...a };
    stepParticle(a, FX_PRESETS.snow, s, e, rng(1), 1);
    stepParticle(b, FX_PRESETS.snow, s, e, rng(1), 0.5);
    stepParticle(b, FX_PRESETS.snow, s, e, rng(1), 0.5);
    expect(b.y).toBeCloseTo(a.y, 1);
  });

  it('speed ускоряет падение', () => {
    const e = env();
    const slow = createParticle(FX_PRESETS.snow, settings({ speed: 0.5 }), e, rng(2), true);
    const fast = createParticle(FX_PRESETS.snow, settings({ speed: 2 }), e, rng(2), true);
    expect(fast.vy).toBeGreaterThan(slow.vy * 3);
  });

  it('sway=0 убирает покачивание по горизонтали', () => {
    const s = settings({ sway: 0 });
    const e = env();
    const p = createParticle(FX_PRESETS.snow, s, e, rng(2), true);
    const x0 = p.x;
    for (let i = 0; i < 100; i++) stepParticle(p, FX_PRESETS.snow, s, e, rng(i), 1);
    expect(p.x).toBeCloseTo(x0, 5);
  });

  it('мышь: repel отталкивает, attract притягивает', () => {
    const base = createParticle(FX_PRESETS.dust, settings({ type: 'dust' }), env(), rng(2), true);
    base.x = 500; base.y = 300; base.vx = 0; base.vy = 0;
    const mouse = { x: 470, y: 300 }; // слева от частицы
    const test = (mode: 'repel' | 'attract') => {
      const p = { ...base };
      const s = settings({ type: 'dust', mouse: mode });
      stepParticle(p, FX_PRESETS.dust, s, env({ mouse }), () => 0.5, 1);
      return p.vx;
    };
    expect(test('repel')).toBeGreaterThan(0.5);   // толкает вправо (от курсора)
    expect(test('attract')).toBeLessThan(-0.5);    // тянет к курсору
    const far = { ...base };
    stepParticle(far, FX_PRESETS.dust, settings({ type: 'dust', mouse: 'repel' }), env({ mouse: { x: 100, y: 100 } }), () => 0.5, 1);
    expect(Math.abs(far.vx)).toBeLessThan(0.05); // вне радиуса — не реагирует
  });
});

describe('nextWind (ветер по курсору)', () => {
  it('курсор справа → ветер вправо, слева → влево, по центру → штиль', () => {
    const s = settings({ mouse: 'wind' });
    const settle = (mx: number | null) => {
      let w = 0;
      for (let i = 0; i < 300; i++) w = nextWind(w, s, mx, 1000, 1);
      return w;
    };
    expect(settle(950)).toBeGreaterThan(0.8);
    expect(settle(50)).toBeLessThan(-0.8);
    expect(Math.abs(settle(500))).toBeLessThan(0.01);
  });
  it('без режима wind курсор ветер не меняет; базовый ветер сохраняется', () => {
    let w = 0;
    for (let i = 0; i < 300; i++) w = nextWind(w, settings({ mouse: 'off', wind: 0.5 }), 950, 1000, 1);
    expect(w).toBeCloseTo(0.5, 1);
  });
  it('ветер меняется плавно, а не скачком', () => {
    const w1 = nextWind(0, settings({ mouse: 'wind' }), 1000, 1000, 1);
    expect(w1).toBeGreaterThan(0);
    expect(w1).toBeLessThan(0.2);
  });
});

describe('жизненный цикл: пересозданные частицы не умирают при рождении (регрессия: пустые пузыри и сердечки)', () => {
  const types = ['snow', 'rain', 'leaves', 'petals', 'confetti', 'glitter', 'bubbles', 'hearts', 'embers'] as const;
  for (const [w, h] of [[190, 84], [390, 844], [1280, 720]]) {
    for (const type of types) {
      it(`${type} в поле ${w}×${h}: свежая частица жива`, () => {
        const preset = FX_PRESETS[type];
        const s = settings({ type, size: type === 'bubbles' || type === 'hearts' ? 1 : 0.5 });
        const e = env({ w, h });
        const r = rng(11);
        for (let i = 0; i < 200; i++) {
          const p = createParticle(preset, s, e, r, false);
          expect(isDead(p, preset, e), `${type} #${i} y=${p.y.toFixed(0)}`).toBe(false);
        }
      });
    }
  }

  it('поднимающиеся частицы за 10 секунд снова появляются в поле, а не «пропадают навсегда»', () => {
    for (const type of ['bubbles', 'hearts'] as const) {
      const preset = FX_PRESETS[type];
      const s = settings({ type, size: 0.5 });
      const e = env({ w: 190, h: 84 });
      const r = rng(3);
      const ps = Array.from({ length: 12 }, () => createParticle(preset, s, e, r, true));
      let sawVisibleLate = 0;
      for (let f = 0; f < 600; f++) {
        for (let i = 0; i < ps.length; i++) {
          stepParticle(ps[i], preset, s, e, r, 1);
          if (isDead(ps[i], preset, e)) ps[i] = createParticle(preset, s, e, r, false);
        }
        if (f > 400) sawVisibleLate += ps.filter((p) => p.x > 0 && p.x < 190 && p.y > 0 && p.y < 84).length;
      }
      expect(sawVisibleLate, type).toBeGreaterThan(100);
    }
  });
});

describe('жизненный цикл', () => {
  it('частица, упавшая за низ экрана, помечается мёртвой (будет пересоздана сверху)', () => {
    const e = env();
    const p = createParticle(FX_PRESETS.snow, settings(), e, rng(2), true);
    expect(isDead(p, FX_PRESETS.snow, e)).toBe(false);
    p.y = e.h + 200;
    expect(isDead(p, FX_PRESETS.snow, e)).toBe(true);
  });
  it('новые частицы падающих типов рождаются над экраном, поднимающихся — под ним', () => {
    const e = env();
    const snow = createParticle(FX_PRESETS.snow, settings(), e, rng(2), false);
    const bubble = createParticle(FX_PRESETS.bubbles, settings({ type: 'bubbles' }), e, rng(2), false);
    expect(snow.y).toBeLessThan(0);
    expect(bubble.y).toBeGreaterThan(e.h);
  });
  it('частицы с временем жизни гаснут и умирают', () => {
    const e = env();
    const s = settings({ type: 'embers' });
    const p = createParticle(FX_PRESETS.embers, s, e, rng(2), false);
    p.x = 500; p.y = 300;
    for (let i = 0; i < 400 && !isDead(p, FX_PRESETS.embers, e); i++) stepParticle(p, FX_PRESETS.embers, s, e, rng(i), 1);
    expect(isDead(p, FX_PRESETS.embers, e)).toBe(true);
  });
  it('в боксе (ауры ника) частицы рождаются внутри заданного прямоугольника', () => {
    const box = { x: 100, y: 50, w: 200, h: 40 };
    const e = env({ box });
    for (let i = 0; i < 30; i++) {
      const p = createParticle(FX_PRESETS.sparks, settings({ type: 'sparks' }), e, rng(i + 1), false);
      expect(p.x).toBeGreaterThanOrEqual(box.x);
      expect(p.x).toBeLessThanOrEqual(box.x + box.w);
      expect(p.y).toBeGreaterThanOrEqual(box.y);
      expect(p.y).toBeLessThanOrEqual(box.y + box.h);
    }
  });
  it('искры вылетают вверх веером и ветер их не сносит', () => {
    const s = settings({ type: 'sparks', wind: 1 });
    const e = env({ wind: 1 });
    const ps = Array.from({ length: 50 }, (_, i) => createParticle(FX_PRESETS.sparks, s, e, rng(i + 1), false));
    expect(ps.filter((p) => p.vy < 0).length).toBeGreaterThan(40);
    const xs = ps.map((p) => p.vx);
    expect(Math.min(...xs)).toBeLessThan(0);
    expect(Math.max(...xs)).toBeGreaterThan(0);
  });
});
