import { describe, it, expect } from 'vitest';
import { resolveCard, cardSurfaceStyle, tiltFromPointer, cardGlareStyle, TILT_REST } from '../src/card';
import { resolveGlow, glowAppliesTo, glowVars, glowClass, glowInlineStyle, DEFAULT_GLOW_TARGETS, GLOW_STYLES } from '../src/glow';

describe('resolveGlow', () => {
  it('выключена, если ни glowEnabled, ни avatarGlowEnabled', () => {
    expect(resolveGlow({})).toBeNull();
    expect(resolveGlow(null)).toBeNull();
    expect(resolveGlow({ glowEnabled: false })).toBeNull();
  });

  it('значения по умолчанию совпадают со старым поведением (medium = 16px, ровное)', () => {
    const g = resolveGlow({ glowEnabled: true, glowColor: '#ff0000' })!;
    expect(g.size).toBe(16);
    expect(g.style).toBe('soft');
    expect(g.color).toBe('#ff0000');
    expect(g.color2).toBe('#ff0000'); // без второго цвета — тот же
    expect(g.targets).toEqual(DEFAULT_GLOW_TARGETS);
  });

  it('читает старую силу glowIntensity: low=8, high=28', () => {
    expect(resolveGlow({ glowEnabled: true, glowIntensity: 'low' })!.size).toBe(8);
    expect(resolveGlow({ glowEnabled: true, glowIntensity: 'high' })!.size).toBe(28);
  });

  it('новый glowSize главнее glowIntensity и ограничен 4..44', () => {
    expect(resolveGlow({ glowEnabled: true, glowIntensity: 'high', glowSize: 20 })!.size).toBe(20);
    expect(resolveGlow({ glowEnabled: true, glowSize: 999 })!.size).toBe(44);
    expect(resolveGlow({ glowEnabled: true, glowSize: 1 })!.size).toBe(4);
  });

  it('avatarGlowEnabled без общего свечения подсвечивает только аватар', () => {
    const g = resolveGlow({ avatarGlowEnabled: true })!;
    expect(g.targets).toEqual(['avatar']);
    expect(glowAppliesTo(g, 'avatar')).toBe(true);
    expect(glowAppliesTo(g, 'username')).toBe(false);
  });

  it('цвет: glowColor → primaryColor → бирюзовый; мусор отбрасывается', () => {
    expect(resolveGlow({ glowEnabled: true, primaryColor: '#123456' })!.color).toBe('#123456');
    expect(resolveGlow({ glowEnabled: true, glowColor: 'red', primaryColor: '#123456' })!.color).toBe('#123456');
    expect(resolveGlow({ glowEnabled: true })!.color).toBe('#00f2ff');
  });

  it('скорость ограничена 0.3..3', () => {
    expect(resolveGlow({ glowEnabled: true, glowSpeed: 50 })!.speed).toBe(3);
    expect(resolveGlow({ glowEnabled: true, glowSpeed: 0 })!.speed).toBe(0.3);
  });

  it('цели из glowTargets, включая «ссылки», «бейджи», «локация» и «карточка»', () => {
    const g = resolveGlow({ glowEnabled: true, glowTargets: ['links', 'badges', 'location', 'card'] })!;
    for (const t of ['links', 'badges', 'location', 'card'] as const) expect(glowAppliesTo(g, t)).toBe(true);
    expect(glowAppliesTo(g, 'avatar')).toBe(false);
  });
});

describe('glow → CSS', () => {
  const g = resolveGlow({ glowEnabled: true, glowColor: '#00ff00', glowColor2: '#ff00ff', glowSize: 20, glowSpeed: 2, glowStyle: 'dual' })!;
  it('переменные несут оба цвета, радиус и скорость', () => {
    const v = glowVars(g) as Record<string, unknown>;
    expect(v['--gl-c1']).toBe('#00ff00');
    expect(v['--gl-c2']).toBe('#ff00ff');
    expect(v['--gl-base']).toBe('20px');
    expect(v['--gl-v']).toBe(2);
  });
  it('классы: вид + стиль анимации', () => {
    expect(glowClass(g, 'fx')).toBe('gl gl-fx gl-s-dual');
    expect(glowClass(g, 'box')).toBe('gl gl-box gl-s-dual');
    expect(glowClass(g, 'links')).toBe('gl gl-links gl-s-dual');
  });
  it('кольцо аватара берёт цвет из переменной (анимируется вместе со стилем)', () => {
    expect(glowInlineStyle(g, 'avatar')).toEqual({ border: '2px solid var(--gl-c)' });
    expect(glowInlineStyle(g, 'username')).toEqual({});
    expect(glowInlineStyle(null, 'avatar')).toEqual({});
  });
  it('каталог стилей: 6 вариантов с уникальными id', () => {
    expect(GLOW_STYLES.map((s) => s.id)).toEqual(['soft', 'pulse', 'breathe', 'flicker', 'rainbow', 'dual']);
  });
});

describe('карточка (как guns.lol)', () => {
  it('по умолчанию выключена: ничего не меняет во внешнем виде', () => {
    const c = resolveCard({});
    expect(c.style).toBe('none');
    expect(c.tilt).toBe(false);
    expect(c.glare).toBe(false);
    expect(cardSurfaceStyle(c)).toEqual({});
  });

  it('значения ограничены допустимыми диапазонами', () => {
    const c = resolveCard({ cardSurfaceOpacity: 5, cardBlur: 999, cardRadius: -4, cardTiltStrength: 100 });
    expect([c.opacity, c.blur, c.radius, c.tiltStrength]).toEqual([0.95, 40, 0, 20]);
  });

  it('стекло: полупрозрачный фон, blur и рамка', () => {
    const s = cardSurfaceStyle(resolveCard({ cardStyle: 'glass', cardBlur: 20, cardRadius: 30 }));
    expect(s.backdropFilter).toContain('blur(20px)');
    expect(s.borderRadius).toBe(30);
    expect(s.border).toContain('1px solid');
    expect(String(s.background)).toMatch(/^rgba\(255, 255, 255,/);
  });

  it('cardBorder=false убирает рамку', () => {
    expect(cardSurfaceStyle(resolveCard({ cardStyle: 'glass', cardBorder: false })).border).toBeUndefined();
  });

  it('плотная — тёмный фон с заданной непрозрачностью; контур — прозрачный с рамкой цвета акцента', () => {
    expect(String(cardSurfaceStyle(resolveCard({ cardStyle: 'solid', cardSurfaceOpacity: 0.8 })).background)).toContain('0.800');
    const o = cardSurfaceStyle(resolveCard({ cardStyle: 'outline' }), '#ff0000');
    expect(o.background).toBe('transparent');
    expect(o.border).toBe('1px solid #ff000066');
  });

  it('без карточки, но с бликом — скругление нужно только блику', () => {
    expect(cardSurfaceStyle(resolveCard({ cardGlare: true, cardRadius: 16 }))).toEqual({ borderRadius: 16 });
  });
});

describe('tiltFromPointer', () => {
  const rect = { left: 100, top: 100, width: 400, height: 200 };
  it('курсор в центре — карточка ровная', () => {
    expect(tiltFromPointer(300, 200, rect, 10)).toEqual({ rx: 0, ry: 0, gx: 50, gy: 50 });
  });
  it('у правого края rotateY положителен, у левого отрицателен', () => {
    expect(tiltFromPointer(500, 200, rect, 10).ry).toBe(10);
    expect(tiltFromPointer(100, 200, rect, 10).ry).toBe(-10);
  });
  it('у нижнего края rotateX отрицателен, у верхнего положителен', () => {
    expect(tiltFromPointer(300, 300, rect, 10).rx).toBe(-10);
    expect(tiltFromPointer(300, 100, rect, 10).rx).toBe(10);
  });
  it('угол пропорционален силе', () => {
    expect(tiltFromPointer(500, 200, rect, 4).ry).toBe(4);
    expect(tiltFromPointer(400, 200, rect, 20).ry).toBe(10);
  });
  it('за пределами карточки угол не превышает силу, блик остаётся в 0..100', () => {
    const t = tiltFromPointer(9999, -9999, rect, 8);
    expect(t.ry).toBe(8);
    expect(t.rx).toBe(8);
    expect(t.gx).toBe(100);
    expect(t.gy).toBe(0);
  });
  it('нулевой размер не даёт NaN', () => {
    expect(tiltFromPointer(5, 5, { left: 0, top: 0, width: 0, height: 0 }, 9)).toEqual(TILT_REST);
  });
  it('блик следует за курсором и гаснет, когда курсора нет', () => {
    const on = cardGlareStyle({ rx: 0, ry: 0, gx: 30, gy: 70 }, 24, true);
    expect(String(on.background)).toContain('30% 70%');
    expect(on.opacity).toBe(1);
    expect(cardGlareStyle(TILT_REST, 24, false).opacity).toBe(0);
  });
});
