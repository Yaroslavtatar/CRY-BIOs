import type { AudioPlayerPos } from './types';

export const DEFAULT_PLAYER_POS: AudioPlayerPos = { x: 50, y: 94 };

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

export function normalizePlayerPos(pos: Partial<AudioPlayerPos> | null | undefined): AudioPlayerPos {
  const x = Number(pos?.x);
  const y = Number(pos?.y);
  return {
    x: Number.isFinite(x) ? clamp(x, 0, 100) : DEFAULT_PLAYER_POS.x,
    y: Number.isFinite(y) ? clamp(y, 0, 100) : DEFAULT_PLAYER_POS.y,
  };
}

/**
 * Позиция выражена как «доля свободного места»: left = x%, translateX = -x%.
 * Благодаря этому плеер при любых значениях 0..100 целиком остаётся на экране
 * и на узких телефонах не вылезает за край, даже если координаты выбраны на широком экране.
 */
export function playerPositionStyle(pos: Partial<AudioPlayerPos> | null | undefined) {
  const { x, y } = normalizePlayerPos(pos);
  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(-${x}%, -${y}%)`,
  } as const;
}

export interface DragGeometry {
  /** Прямоугольник слоя (контейнера), в котором двигаем */
  layer: { left: number; top: number; width: number; height: number };
  /** Размер плеера */
  size: { width: number; height: number };
  /** Где внутри плеера схватили (px от его левого/верхнего края) */
  grab: { x: number; y: number };
}

/** Координаты указателя → позиция в процентах свободного места, с ограничением 0..100. */
export function posFromPointer(clientX: number, clientY: number, g: DragGeometry): AudioPlayerPos {
  const freeW = g.layer.width - g.size.width;
  const freeH = g.layer.height - g.size.height;
  const left = clientX - g.grab.x - g.layer.left;
  const top = clientY - g.grab.y - g.layer.top;
  const round = (n: number) => Math.round(n * 10) / 10;
  return {
    x: freeW > 0 ? round(clamp((left / freeW) * 100, 0, 100)) : 50,
    y: freeH > 0 ? round(clamp((top / freeH) * 100, 0, 100)) : 50,
  };
}
