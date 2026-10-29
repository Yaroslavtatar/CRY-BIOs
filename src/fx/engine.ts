/**
 * Движок частиц: чистая физика без DOM и canvas (поэтому покрыт unit-тестами).
 * Рисует частицы src/fx/draw.ts, а крутит их компонент ParticleField.
 *
 * Единицы: пиксели CSS и «кадры при 60 fps» — шаг по времени dt нормирован (dt = 1 на 60 fps),
 * поэтому скорость одинакова на мониторах 60/120/144 Гц.
 */

export type FxType =
  | 'snow' | 'rain' | 'leaves' | 'petals' | 'fireflies' | 'embers'
  | 'bubbles' | 'confetti' | 'hearts' | 'stars' | 'dust' | 'glitter'
  | 'sparks'; // sparks — только для аур вокруг ника, в каталог фона не входит

export type FxMouseMode = 'off' | 'wind' | 'repel' | 'attract';
export type FxColorMode = 'preset' | 'custom' | 'rainbow';
export type FxShape = 'flake' | 'streak' | 'leaf' | 'petal' | 'glow' | 'bubble' | 'confetti' | 'heart' | 'star' | 'glitter' | 'spark';

export interface FxSettings {
  type: FxType;
  colorMode: FxColorMode;
  color: string;
  /** 0.2–2.5, множитель количества */
  density: number;
  /** 0.5–2, множитель размера */
  size: number;
  /** 0.3–3, множитель скорости */
  speed: number;
  /** −1 (влево) … 1 (вправо) */
  wind: number;
  /** 0–2, покачивание из стороны в сторону */
  sway: number;
  mouse: FxMouseMode;
  /** Развернуть гравитацию: снег летит вверх, пузыри — вниз */
  reverse: boolean;
  /** Не из конфига: своя палитра (ауры ника) */
  palette?: string[];
  /** Не из конфига: точное число частиц (у маленьких аур площадь почти нулевая) */
  count?: number;
}

export const DEFAULT_FX: FxSettings = {
  type: 'snow',
  colorMode: 'preset',
  color: '#ffffff',
  density: 1,
  size: 1,
  speed: 1,
  wind: 0,
  sway: 1,
  mouse: 'off',
  reverse: false,
};

export interface FxPreset {
  id: FxType;
  label: string;
  hint: string;
  emoji: string;
  shape: FxShape;
  palette: string[];
  /** Частиц на экране 1280×720 при density = 1 */
  baseCount: number;
  /** Размер в px при глубине 1 */
  size: [number, number];
  /** px/кадр. > 0 — вниз, < 0 — вверх (до применения speed/reverse) */
  fall: [number, number];
  /** Насколько частица подвержена ветру (капли ≈ 4, пузыри ≈ 0.4) */
  windFactor: number;
  /** Амплитуда покачивания, px/кадр */
  sway: number;
  swayFreq: [number, number];
  spin: number;
  alpha: [number, number];
  /** Масштабировать размер/скорость/прозрачность по глубине (параллакс) */
  depth: boolean;
  /** Время жизни в кадрах; без него частица живёт, пока не покинет экран */
  life?: [number, number];
  /** Хаотичное блуждание (светлячки, пыль) */
  wander?: number;
  /** Вращение «в 3D»: лист/лепесток/конфетти переворачиваются */
  flip?: boolean;
  additive?: boolean;
  /** Где рождаются частицы при пересоздании */
  spawn: 'top' | 'bottom' | 'anywhere';
}

export const FX_PRESETS: Record<FxType, FxPreset> = {
  snow: {
    id: 'snow', label: 'Снег', emoji: '❄️', shape: 'flake',
    hint: 'Мягкие хлопья разной глубины: дальние мелкие и бледные, ближние крупные и быстрые. Плавно покачиваются.',
    palette: ['#ffffff', '#f1f5f9', '#e0f2fe', '#dbeafe'],
    baseCount: 170, size: [2.4, 7], fall: [0.4, 1.1], windFactor: 1.1, sway: 0.35, swayFreq: [0.008, 0.026],
    spin: 0.004, alpha: [0.5, 1], depth: true, spawn: 'top',
  },
  rain: {
    id: 'rain', label: 'Дождь', emoji: '🌧️', shape: 'streak',
    hint: 'Косые капли: наклон следует за ветром, дальние капли тоньше и тусклее.',
    palette: ['#bae6fd', '#93c5fd', '#a5b4fc', '#cbd5e1'],
    baseCount: 190, size: [1.0, 2.0], fall: [12, 20], windFactor: 5, sway: 0, swayFreq: [0, 0],
    spin: 0, alpha: [0.4, 0.9], depth: true, spawn: 'top',
  },
  leaves: {
    id: 'leaves', label: 'Листья', emoji: '🍂', shape: 'leaf',
    hint: 'Осенние листья кружатся и переворачиваются в воздухе.',
    palette: ['#ea580c', '#f97316', '#f59e0b', '#d97706', '#c2410c', '#84cc16', '#facc15'],
    baseCount: 40, size: [22, 40], fall: [0.7, 1.5], windFactor: 2.2, sway: 1.1, swayFreq: [0.012, 0.03],
    spin: 0.035, alpha: [0.7, 1], depth: true, flip: true, spawn: 'top',
  },
  petals: {
    id: 'petals', label: 'Лепестки', emoji: '🌸', shape: 'petal',
    hint: 'Лепестки сакуры плавно планируют и переворачиваются.',
    palette: ['#fbcfe8', '#f9a8d4', '#f472b6', '#fda4af', '#fecdd3'],
    baseCount: 52, size: [13, 24], fall: [0.55, 1.25], windFactor: 2.0, sway: 0.9, swayFreq: [0.012, 0.03],
    spin: 0.03, alpha: [0.65, 1], depth: true, flip: true, spawn: 'top',
  },
  fireflies: {
    id: 'fireflies', label: 'Светлячки', emoji: '✨', shape: 'glow',
    hint: 'Мерцающие огоньки лениво блуждают по экрану.',
    palette: ['#fde047', '#bef264', '#a3e635', '#fef08a'],
    baseCount: 46, size: [3.5, 8], fall: [-0.05, 0.05], windFactor: 0.5, sway: 0.2, swayFreq: [0.01, 0.03],
    spin: 0, alpha: [0.5, 1], depth: true, life: [300, 900], wander: 0.05, additive: true, spawn: 'anywhere',
  },
  embers: {
    id: 'embers', label: 'Искры огня', emoji: '🔥', shape: 'glow',
    hint: 'Горячие угольки поднимаются снизу, остывают и гаснут.',
    palette: ['#fb923c', '#f97316', '#ef4444', '#fbbf24', '#fde68a'],
    baseCount: 70, size: [2.2, 5.5], fall: [-2.2, -0.7], windFactor: 1.4, sway: 0.5, swayFreq: [0.02, 0.05],
    spin: 0, alpha: [0.7, 1], depth: true, life: [90, 220], additive: true, spawn: 'bottom',
  },
  bubbles: {
    id: 'bubbles', label: 'Пузыри', emoji: '🫧', shape: 'bubble',
    hint: 'Прозрачные пузырьки с бликами всплывают вверх.',
    palette: ['#bae6fd', '#a5f3fc', '#e0f2fe', '#c4b5fd', '#fbcfe8'],
    baseCount: 34, size: [12, 44], fall: [-1.2, -0.35], windFactor: 0.5, sway: 0.55, swayFreq: [0.01, 0.025],
    spin: 0, alpha: [0.45, 0.85], depth: true, spawn: 'bottom',
  },
  confetti: {
    id: 'confetti', label: 'Конфетти', emoji: '🎉', shape: 'confetti',
    hint: 'Разноцветные бумажки кружатся и переливаются на лету.',
    palette: ['#f43f5e', '#f59e0b', '#22c55e', '#38bdf8', '#a855f7', '#facc15', '#ec4899'],
    baseCount: 80, size: [8, 15], fall: [1.2, 2.8], windFactor: 1.5, sway: 0.7, swayFreq: [0.02, 0.05],
    spin: 0.08, alpha: [0.85, 1], depth: true, flip: true, spawn: 'top',
  },
  hearts: {
    id: 'hearts', label: 'Сердечки', emoji: '💖', shape: 'heart',
    hint: 'Сердечки мягко поднимаются вверх, покачиваясь.',
    palette: ['#f43f5e', '#fb7185', '#ec4899', '#f9a8d4', '#fda4af'],
    baseCount: 30, size: [15, 32], fall: [-1.1, -0.45], windFactor: 0.8, sway: 0.6, swayFreq: [0.01, 0.025],
    spin: 0.01, alpha: [0.55, 0.95], depth: true, spawn: 'bottom',
  },
  stars: {
    id: 'stars', label: 'Звёзды', emoji: '⭐', shape: 'star',
    hint: 'Мерцающие четырёхлучевые звёзды медленно дрейфуют.',
    palette: ['#ffffff', '#fef9c3', '#bfdbfe', '#e9d5ff'],
    baseCount: 70, size: [4, 11], fall: [0.01, 0.1], windFactor: 0.6, sway: 0.08, swayFreq: [0.01, 0.02],
    spin: 0, alpha: [0.4, 1], depth: true, life: [500, 1400], additive: true, spawn: 'anywhere',
  },
  dust: {
    id: 'dust', label: 'Пыль', emoji: '🌫️', shape: 'glow',
    hint: 'Мелкая пыль в луче света: еле заметная, живая.',
    palette: ['#ffffff', '#fef3c7', '#e0f2fe'],
    baseCount: 110, size: [1.4, 3.4], fall: [-0.18, 0.06], windFactor: 0.9, sway: 0.15, swayFreq: [0.005, 0.015],
    spin: 0, alpha: [0.12, 0.45], depth: true, life: [400, 1000], wander: 0.025, additive: true, spawn: 'anywhere',
  },
  glitter: {
    id: 'glitter', label: 'Блёстки', emoji: '💎', shape: 'glitter',
    hint: 'Крошечные бриллианты вспыхивают и медленно опускаются.',
    palette: ['#ffffff', '#fde68a', '#f0abfc', '#7dd3fc', '#fda4af'],
    baseCount: 80, size: [3, 7.5], fall: [0.25, 0.85], windFactor: 1.0, sway: 0.3, swayFreq: [0.01, 0.03],
    spin: 0.05, alpha: [0.5, 1], depth: true, additive: true, spawn: 'top',
  },
  sparks: {
    id: 'sparks', label: 'Искры', emoji: '⚡', shape: 'spark',
    hint: 'Яркие вылетающие искры с хвостом.',
    palette: ['#fde68a', '#fbbf24', '#fb923c', '#ffffff'],
    baseCount: 26, size: [1.2, 2.6], fall: [-1.6, -0.2], windFactor: 0.6, sway: 0, swayFreq: [0, 0],
    spin: 0, alpha: [0.8, 1], depth: false, life: [22, 55], additive: true, spawn: 'bottom',
  },
};

/** Типы, которые показываем в меню выбора фона */
export const FX_CATALOG: FxPreset[] = (
  ['snow', 'rain', 'leaves', 'petals', 'fireflies', 'embers', 'bubbles', 'confetti', 'hearts', 'stars', 'dust', 'glitter'] as FxType[]
).map((id) => FX_PRESETS[id]);

export interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  size: number;
  /** Глубина 0.3–1: 1 — ближняя частица */
  z: number;
  rot: number; spin: number;
  phase: number; freq: number;
  alpha: number; baseAlpha: number;
  color: string;
  life: number; maxLife: number;
  /** Вариант формы (форма лепестка, число лучей…) */
  variant: number;
  flip: number; flipSpeed: number;
}

export type Rng = () => number;

export interface FxEnv {
  w: number;
  h: number;
  /** Текущий (сглаженный) ветер: настройка + реакция на мышь */
  wind: number;
  /** Позиция мыши в координатах поля, null — нет курсора */
  mouse: { x: number; y: number } | null;
  /** Если задан — частицы рождаются внутри этого прямоугольника (ауры ника) */
  box?: { x: number; y: number; w: number; h: number };
  reducedMotion?: boolean;
}

const clamp = (n: number, a: number, b: number) => Math.min(b, Math.max(a, n));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const between = (r: Rng, [a, b]: [number, number]) => lerp(a, b, r());

const finite = (n: unknown, fallback: number) => (Number.isFinite(Number(n)) && n !== '' && n !== null ? Number(n) : fallback);

export function clampSettings(s: FxSettings): FxSettings {
  return {
    ...s,
    density: clamp(finite(s.density, 1), 0.2, 2.5),
    size: clamp(finite(s.size, 1), 0.5, 2),
    speed: clamp(finite(s.speed, 1), 0.3, 3),
    wind: clamp(finite(s.wind, 0), -1, 1),
    sway: clamp(finite(s.sway, 1), 0, 2),
  };
}

/** Количество частиц: растёт с площадью поля и плотностью, но ограничено, чтобы не тормозить телефоны. */
export function targetCount(preset: FxPreset, s: FxSettings, w: number, h: number, reducedMotion = false): number {
  if (s.count !== undefined) return clamp(Math.round(s.count * (reducedMotion ? 0.5 : 1)), 1, 120);
  const areaK = clamp((w * h) / (1280 * 720), 0.03, 2);
  const n = preset.baseCount * s.density * areaK * (reducedMotion ? 0.5 : 1);
  return clamp(Math.round(n), 4, 420);
}

/* ---------- цвет ---------- */

export function hexToHsl(hex: string): { h: number; s: number; l: number } {
  let c = hex.trim().replace('#', '');
  if (c.length === 3) c = c.split('').map((x) => x + x).join('');
  const n = parseInt(c.slice(0, 6), 16);
  if (!Number.isFinite(n) || c.length < 6) return { h: 190, s: 100, l: 50 };
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s: s * 100, l: l * 100 };
}

export function pickColor(preset: FxPreset, s: FxSettings, r: Rng): string {
  if (s.palette && s.palette.length) return s.palette[Math.floor(r() * s.palette.length)];
  if (s.colorMode === 'rainbow') return `hsl(${Math.floor(r() * 360)}, 85%, 66%)`;
  if (s.colorMode === 'custom') {
    const { h, s: sat, l } = hexToHsl(s.color);
    // Оттенки одного цвета: чуть меняем яркость и тон, чтобы поле не было плоским
    const light = clamp(l + (r() - 0.5) * 22, 12, 94);
    const hue = (h + (r() - 0.5) * 14 + 360) % 360;
    return `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`;
  }
  return preset.palette[Math.floor(r() * preset.palette.length)];
}

/* ---------- рождение и шаг ---------- */

export function createParticle(preset: FxPreset, s: FxSettings, env: FxEnv, r: Rng, initial: boolean): Particle {
  const { w, h } = env;
  const z = preset.depth ? lerp(0.45, 1, r()) : 1;
  const dir = s.reverse ? -1 : 1;
  const fall = between(r, preset.fall) * dir;
  const size = between(r, preset.size) * s.size * (preset.depth ? lerp(0.6, 1, z) : 1);
  const hasLife = Boolean(preset.life);
  const maxLife = hasLife ? between(r, preset.life!) : 0;

  let x: number, y: number;
  if (env.box) {
    // Ауры ника: рождаемся внутри текста
    x = env.box.x + r() * env.box.w;
    y = env.box.y + r() * env.box.h;
  } else if (initial) {
    x = r() * w;
    y = r() * h;
  } else {
    // Ветер сносит частицы вбок, поэтому рождаем их «с наветренной стороны» шире экрана
    const windPush = Math.abs(env.wind) * preset.windFactor * 0.25;
    const spread = w * (1 + windPush);
    x = r() * spread - (env.wind > 0 ? w * windPush : 0);
    const where = preset.spawn;
    if (where === 'anywhere') {
      x = r() * w;
      y = r() * h;
    } else if ((where === 'top' && !s.reverse) || (where === 'bottom' && s.reverse)) {
      y = -size * 2 - r() * h * 0.15;
    } else {
      y = h + size * 2 + r() * h * 0.15;
    }
  }

  const baseAlpha = lerp(preset.alpha[0], preset.alpha[1], r()) * (preset.depth ? lerp(0.65, 1, z) : 1);
  const p: Particle = {
    x, y,
    vx: 0,
    vy: fall * s.speed * (preset.depth ? lerp(0.6, 1.15, z) : 1),
    size, z,
    rot: r() * Math.PI * 2,
    spin: (r() - 0.5) * 2 * preset.spin * s.speed,
    phase: r() * Math.PI * 2,
    freq: between(r, preset.swayFreq) * s.speed,
    alpha: baseAlpha, baseAlpha,
    color: pickColor(preset, s, r),
    life: initial && hasLife ? maxLife * r() : maxLife,
    maxLife,
    variant: r(),
    flip: r() * Math.PI * 2,
    flipSpeed: (0.03 + r() * 0.07) * s.speed,
  };

  if (preset.shape === 'spark') {
    // Искра вылетает из точки веером вверх и в стороны
    const a = -Math.PI / 2 + (r() - 0.5) * Math.PI * 1.2;
    const sp = (0.8 + r() * 2.4) * s.speed;
    p.vx = Math.cos(a) * sp;
    p.vy = Math.sin(a) * sp;
  }
  return p;
}

/** Ветер, сглаженный во времени (порывы), с учётом режима «ветер по курсору». */
export function nextWind(current: number, s: FxSettings, mouseX: number | null, w: number, dt: number): number {
  let target = s.wind;
  if (s.mouse === 'wind' && mouseX !== null && w > 0) {
    // курсор справа → ветер вправо, слева → влево, по центру — штиль (+ базовый ветер)
    target = clamp(s.wind + (mouseX / w - 0.5) * 2 * 1.1, -1.6, 1.6);
  }
  return current + (target - current) * clamp(0.045 * dt, 0, 1);
}

const MOUSE_RADIUS = 130;

export function stepParticle(p: Particle, preset: FxPreset, s: FxSettings, env: FxEnv, r: Rng, dt: number): void {
  const calm = env.reducedMotion ? 0.4 : 1;
  const k = dt * calm;

  // ветер: скорость плавно подтягивается к ветровому сносу (инерция → порывы выглядят естественно)
  const windDepth = preset.depth ? lerp(0.45, 1, p.z) : 1;
  if (preset.shape !== 'spark') {
    const vxTarget = env.wind * preset.windFactor * windDepth * s.speed;
    p.vx += (vxTarget - p.vx) * clamp(0.05 * dt, 0, 1);
  }

  p.phase += p.freq * k;
  const swayX = preset.sway ? Math.sin(p.phase) * preset.sway * s.sway * (preset.depth ? lerp(0.6, 1, p.z) : 1) : 0;

  if (preset.wander) {
    p.vx += (r() - 0.5) * preset.wander * k;
    p.vy += (r() - 0.5) * preset.wander * k;
    p.vx = clamp(p.vx, -0.6, 0.6);
    p.vy = clamp(p.vy, -0.6, 0.6);
  }

  if (preset.shape === 'spark') {
    p.vy += 0.035 * k; // искры слегка тянет вниз
    p.vx *= 1 - 0.012 * k;
  }

  // мышь: отталкивать/притягивать частицы рядом с курсором
  if (env.mouse && (s.mouse === 'repel' || s.mouse === 'attract')) {
    const dx = p.x - env.mouse.x;
    const dy = p.y - env.mouse.y;
    const d = Math.hypot(dx, dy);
    if (d < MOUSE_RADIUS && d > 0.001) {
      const f = (1 - d / MOUSE_RADIUS) ** 2 * 2.4 * (s.mouse === 'repel' ? 1 : -1);
      p.vx += (dx / d) * f * k;
      p.vy += (dy / d) * f * k;
    }
  }

  p.x += (p.vx + swayX) * k;
  p.y += p.vy * k;
  p.rot += p.spin * k;
  p.flip += p.flipSpeed * k;

  if (preset.life) {
    p.life -= k;
    const t = p.life / p.maxLife; // 1 → 0
    // Плавное появление и затухание
    const fade = Math.min(1, t * 5, (1 - t) * 6 + 0.0001);
    p.alpha = p.baseAlpha * clamp(fade, 0, 1);
  }
}

export function isDead(p: Particle, preset: FxPreset, env: FxEnv): boolean {
  if (preset.life && p.life <= 0) return true;
  // Запас одинаков сверху и снизу и включает зону рождения (до size*2 + 15% высоты за краем поля):
  // раньше снизу он был 24px, и частицы, рождающиеся под полем (пузыри, сердечки), умирали, не успев появиться.
  const m = Math.max(24, p.size * 3) + env.h * 0.25;
  if (env.box) return preset.life ? false : p.y < -m || p.y > env.h + m;
  return p.y < -m || p.y > env.h + m || p.x < -m - env.w * 0.4 || p.x > env.w + m + env.w * 0.4;
}
