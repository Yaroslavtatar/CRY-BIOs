import { describe, it, expect } from 'vitest';
import { normalizePlayerPos, playerPositionStyle, posFromPointer, DEFAULT_PLAYER_POS } from '../src/playerPosition';

describe('normalizePlayerPos', () => {
  it('подставляет значение по умолчанию для пустых и мусорных данных', () => {
    expect(normalizePlayerPos(undefined)).toEqual(DEFAULT_PLAYER_POS);
    expect(normalizePlayerPos({ x: NaN, y: 'abc' as any })).toEqual(DEFAULT_PLAYER_POS);
  });

  it('ограничивает 0..100', () => {
    expect(normalizePlayerPos({ x: -20, y: 250 })).toEqual({ x: 0, y: 100 });
  });
});

describe('playerPositionStyle', () => {
  it('якорит плеер долей свободного места: left=x%, translate=-x%', () => {
    expect(playerPositionStyle({ x: 25, y: 80 })).toEqual({
      left: '25%',
      top: '80%',
      transform: 'translate(-25%, -80%)',
    });
  });

  it('крайние значения не выводят плеер за экран (0 → у края, 100 → у противоположного)', () => {
    expect(playerPositionStyle({ x: 0, y: 0 }).transform).toBe('translate(-0%, -0%)');
    expect(playerPositionStyle({ x: 100, y: 100 }).transform).toBe('translate(-100%, -100%)');
  });
});

describe('posFromPointer', () => {
  const g = {
    layer: { left: 100, top: 50, width: 800, height: 600 },
    size: { width: 200, height: 60 },
    grab: { x: 20, y: 10 },
  };

  it('считает долю свободного места (ширина слоя минус ширина плеера)', () => {
    // левый край плеера = 100+300 = 400 → (400-100)/(800-200) = 50%
    expect(posFromPointer(420, 50 + 270 + 10, g)).toEqual({ x: 50, y: 50 });
  });

  it('ограничивает за пределами слоя', () => {
    expect(posFromPointer(-500, -500, g)).toEqual({ x: 0, y: 0 });
    expect(posFromPointer(5000, 5000, g)).toEqual({ x: 100, y: 100 });
  });

  it('не делит на ноль, если плеер шире слоя', () => {
    const tight = { ...g, size: { width: 800, height: 600 } };
    expect(posFromPointer(300, 300, tight)).toEqual({ x: 50, y: 50 });
  });
});
