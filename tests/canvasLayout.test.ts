import { describe, it, expect } from 'vitest';
import {
  alignFrame,
  autoLayoutFrames,
  clampFrame,
  computeStageHeight,
  DESKTOP_W,
  listElements,
  MOBILE_W,
  reconcileDevice,
  reorderZ,
  sanitizeCanvas,
  snapValue,
} from '../src/canvasLayout';
import { guardProfilePayload } from '../src/profileGuard';
import type { BioConfig, BlockConfig, CanvasFrame } from '../src/types';

const block = (id: string, type: BlockConfig['type'], enabled = true): BlockConfig => ({ id, type, title: id, enabled });

const baseConfig = (patch: Partial<BioConfig> = {}): BioConfig =>
  ({
    username: 'u',
    displayName: 'U',
    bio: 'hello',
    avatarUrl: '',
    verified: false,
    customBadge: 'USER',
    sparkles: false,
    blocks: [block('a', 'socials'), block('b', 'textbox'), block('off', 'quote', false)],
    ...patch,
  }) as BioConfig;

describe('listElements', () => {
  it('берёт включённые блоки и секции в порядке layout', () => {
    const ids = listElements(baseConfig()).map((e) => e.id);
    expect(ids).toEqual(['avatar', 'username', 'bio', 'block:a', 'block:b']);
  });

  it('не показывает локацию и discord без данных', () => {
    const ids = listElements(baseConfig({ locationEnabled: true, locationText: '  ' })).map((e) => e.id);
    expect(ids).not.toContain('location');
    expect(ids).not.toContain('discord');
  });
});

describe('autoLayoutFrames', () => {
  it('расставляет колонкой сверху вниз без пересечений по y', () => {
    const frames = autoLayoutFrames(baseConfig(), 'desktop');
    const ys = Object.values(frames).map((f) => f.y);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
    expect(new Set(ys).size).toBe(ys.length);
  });

  it('центрирует колонку на экране устройства', () => {
    const d = autoLayoutFrames(baseConfig(), 'desktop')['username'];
    expect(d.x * 2 + d.w).toBe(DESKTOP_W);
    const m = autoLayoutFrames(baseConfig(), 'mobile')['username'];
    expect(m.x * 2 + m.w).toBe(MOBILE_W);
  });
});

describe('reconcileDevice', () => {
  it('без сохранённой раскладки собирает автоматически', () => {
    const layout = reconcileDevice(baseConfig(), 'mobile');
    expect(Object.keys(layout.frames)).toHaveLength(5);
    expect(layout.height).toBeGreaterThanOrEqual(480);
  });

  it('новые блоки добавляются под остальными, удалённые пропадают', () => {
    const cfg = baseConfig();
    const stored = reconcileDevice(cfg, 'desktop');
    const withStored = { ...cfg, canvas: { enabled: true, snap: true, grid: 8, desktop: stored } };
    const next = {
      ...withStored,
      blocks: [block('a', 'socials'), block('n', 'html')],
    };
    const result = reconcileDevice(next, 'desktop');
    expect(result.frames['block:b']).toBeUndefined();
    const maxOldBottom = Math.max(...['block:a', 'avatar', 'username', 'bio'].map((id) => result.frames[id].y));
    expect(result.frames['block:n'].y).toBeGreaterThan(maxOldBottom);
  });

  it('сохраняет пользовательские позиции', () => {
    const cfg = baseConfig();
    const stored = reconcileDevice(cfg, 'desktop');
    stored.frames['avatar'] = { ...stored.frames['avatar'], x: 7, y: 9 };
    const out = reconcileDevice({ ...cfg, canvas: { enabled: true, snap: true, grid: 8, desktop: stored } }, 'desktop');
    expect(out.frames['avatar']).toMatchObject({ x: 7, y: 9 });
  });
});

describe('геометрия', () => {
  it('snapValue привязывает к сетке и отключается', () => {
    expect(snapValue(13, 8, true)).toBe(16);
    expect(snapValue(13.4, 8, false)).toBe(13);
  });

  it('clampFrame держит рамку внутри экрана', () => {
    const f = clampFrame({ x: -50, y: -10, w: 2000, z: 1 }, 'mobile');
    expect(f).toMatchObject({ x: 0, y: 0, w: MOBILE_W });
    const g = clampFrame({ x: 380, y: 5, w: 100, z: 1 }, 'mobile');
    expect(g.x + g.w).toBeLessThanOrEqual(MOBILE_W);
  });

  it('alignFrame выравнивает по краям и центру', () => {
    const f: CanvasFrame = { x: 50, y: 0, w: 100, z: 1 };
    expect(alignFrame(f, 'mobile', 'left').x).toBe(0);
    expect(alignFrame(f, 'mobile', 'right').x).toBe(MOBILE_W - 100);
    expect(alignFrame(f, 'mobile', 'center').x).toBe(Math.round((MOBILE_W - 100) / 2));
  });

  it('computeStageHeight не меньше минимума и учитывает скрытые', () => {
    const frames: Record<string, CanvasFrame> = {
      a: { x: 0, y: 1000, w: 10, h: 100, z: 1 },
      b: { x: 0, y: 5000, w: 10, h: 100, z: 2, hidden: true },
    };
    expect(computeStageHeight(frames, () => 50)).toBe(1164);
    expect(computeStageHeight({}, () => 50)).toBe(480);
  });
});

describe('reorderZ', () => {
  const frames = (): Record<string, CanvasFrame> => ({
    a: { x: 0, y: 0, w: 10, z: 1 },
    b: { x: 0, y: 0, w: 10, z: 2 },
    c: { x: 0, y: 0, w: 10, z: 3 },
  });

  it('front/back/up/down', () => {
    expect(reorderZ(frames(), 'a', 'front').a.z).toBe(3);
    expect(reorderZ(frames(), 'c', 'back').c.z).toBe(1);
    expect(reorderZ(frames(), 'a', 'up').a.z).toBe(2);
    expect(reorderZ(frames(), 'c', 'down').c.z).toBe(2);
  });

  it('нормализует z в 1..N и игнорирует неизвестный id', () => {
    const f = frames();
    expect(reorderZ(f, 'zzz', 'front')).toBe(f);
    const out = reorderZ({ a: { x: 0, y: 0, w: 1, z: 50 }, b: { x: 0, y: 0, w: 1, z: 900 } }, 'a', 'front');
    expect(Object.values(out).map((v) => v.z).sort()).toEqual([1, 2]);
  });
});

describe('sanitizeCanvas', () => {
  it('отбрасывает не-объекты', () => {
    expect(sanitizeCanvas(null)).toBeUndefined();
    expect(sanitizeCanvas('x')).toBeUndefined();
    expect(sanitizeCanvas([])).toBeUndefined();
  });

  it('ограничивает числа и чистит мусорные ключи', () => {
    const out = sanitizeCanvas({
      enabled: 'yes',
      snap: false,
      grid: 9999,
      desktop: {
        height: 999999,
        frames: {
          avatar: { x: 1e9, y: -1e9, w: 1, h: 99999, z: -5, rotate: 720, hidden: true, extra: '<script>' },
          '__proto__': { x: 1, y: 1, w: 100, z: 1 },
          'bad key!': { x: 1, y: 1, w: 100, z: 1 },
          nan: { x: NaN, y: 1, w: 100, z: 1 },
        },
      },
    })!;
    expect(out.enabled).toBe(false);
    expect(out.snap).toBe(false);
    expect(out.grid).toBe(64);
    expect(out.desktop!.height).toBe(8000);
    expect(Object.keys(out.desktop!.frames)).toEqual(['avatar']);
    expect(out.desktop!.frames.avatar).toEqual({ x: 2000, y: -500, w: 8, h: 4000, z: 0, rotate: 360, hidden: true });
    expect((out.desktop!.frames.avatar as any).extra).toBeUndefined();
  });

  it('ограничивает число рамок', () => {
    const frames: Record<string, unknown> = {};
    for (let i = 0; i < 500; i++) frames[`block:${i}`] = { x: 0, y: 0, w: 50, z: 1 };
    const out = sanitizeCanvas({ enabled: true, desktop: { height: 500, frames } })!;
    expect(Object.keys(out.desktop!.frames).length).toBe(200);
  });
});

describe('guardProfilePayload + canvas', () => {
  it('санитизирует canvas и убирает невалидный', () => {
    const p: any = { canvas: { enabled: true, grid: 1, desktop: { height: 600, frames: { avatar: { x: 0, y: 0, w: 100, z: 1 } } } } };
    expect(guardProfilePayload(p, null).ok).toBe(true);
    expect(p.canvas.grid).toBe(4);
    const q: any = { canvas: 'oops' };
    guardProfilePayload(q, null);
    expect('canvas' in q).toBe(false);
  });
});
