import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { NAME_EFFECT_CATALOG, NAME_EFFECT_GROUPS, getNameEffectEntry } from '../src/utils/nameEffectCatalog';
import { getNameEffectClasses, getNameEffectStyle, getAuraFx, isSparkNameEffect, nameEffectOptions } from '../src/utils/nameEffects';
import { sparksForDistance, SPARKLE_CHARS } from '../src/components/SparkleCanvas';

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8');
// Блоки prefers-reduced-motion только перечисляют классы (animation: none) — определением они не считаются
const cssDefinitions = css.replace(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g, '');

describe('каталог эффектов ника', () => {
  it('id уникальны, группы известны, у каждого есть название и описание', () => {
    const ids = NAME_EFFECT_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of NAME_EFFECT_CATALOG) {
      expect(NAME_EFFECT_GROUPS).toContain(e.group);
      expect(e.label.length).toBeGreaterThan(1);
      expect(e.hint.length).toBeGreaterThan(8);
    }
  });

  it('эффектов стало заметно больше (было 29)', () => {
    expect(NAME_EFFECT_CATALOG.length).toBeGreaterThanOrEqual(55);
  });

  it('каждая группа непустая', () => {
    for (const g of NAME_EFFECT_GROUPS) expect(NAME_EFFECT_CATALOG.some((e) => e.group === g)).toBe(true);
  });

  it('каждый CSS-класс «ne-…» из каталога реально определён в index.css (нет «пустых» эффектов)', () => {
    const tokens = new Set(NAME_EFFECT_CATALOG.flatMap((e) => (e.cls || '').split(/\s+/)).filter((t) => t.startsWith('ne-')));
    expect(tokens.size).toBeGreaterThan(20);
    for (const t of tokens) {
      if (t === 'ne-aura') continue; // аура рисуется canvas, у самого текста стилей нет
      // точное имя класса: `.ne-holo` не должен совпадать с `.ne-holo-broken`
      const defined = new RegExp(`\\.${t}(?![\\w-])`).test(cssDefinitions);
      expect(defined, `класс .${t} не найден в index.css`).toBe(true);
    }
  });

  it('каждая анимация из эффектов ника объявлена в @keyframes', () => {
    const used = new Set([...css.matchAll(/animation:\s*(ne-[a-z0-9-]+)/g)].map((m) => m[1]));
    expect(used.size).toBeGreaterThan(10);
    for (const name of used) expect(new RegExp(`@keyframes ${name}(?![\\w-])`).test(css), `нет @keyframes ${name}`).toBe(true);
  });

  it('typewriter больше не показывает захардкоженную «Э|»: это эффект по буквам с курсором', () => {
    const t = getNameEffectEntry('typewriter')!;
    expect(t.letters).toBe(true);
    expect(t.caret).toBe(true);
  });

  it('старые эффекты сохранились и работают как раньше', () => {
    for (const id of ['none', 'glow', 'neon', 'gradient', 'glitch', 'rainbow', 'shine', 'bounce', 'cyber', 'sparks_blue', 'sparks_gold'] as const) {
      expect(getNameEffectEntry(id), id).toBeDefined();
    }
    expect(getNameEffectClasses('glitch')).toContain('animate-glitch-v2');
    expect(getNameEffectClasses('rainbow')).toContain('animate-rainbow');
    expect(getNameEffectClasses(undefined)).toContain('text-white');
  });
});

describe('цвета и скорость эффектов', () => {
  it('значения по умолчанию берутся из каталога', () => {
    expect(getNameEffectStyle('neon_pink')).toMatchObject({ '--ne-a': '#f472b6' });
    expect(getNameEffectStyle('gradient')).toMatchObject({ '--ne-a': '#c084fc', '--ne-b': '#db2777' });
  });

  it('свой цвет перекрывает цвет по умолчанию', () => {
    expect(getNameEffectStyle('neon', 'x', { color: '#112233' })).toMatchObject({ '--ne-a': '#112233' });
    expect(getNameEffectStyle('gradient', 'x', { color: '#111111', color2: '#222222' })).toMatchObject({ '--ne-a': '#111111', '--ne-b': '#222222' });
  });

  it('второй цвет применяется только у двухцветных эффектов', () => {
    // у neon один цвет: color2 игнорируется (b у него нет)
    expect(getNameEffectStyle('neon', 'x', { color2: '#222222' })).not.toHaveProperty('--ne-b');
  });

  it('мусорные цвета игнорируются', () => {
    expect(getNameEffectStyle('neon', 'x', { color: 'red; background:url(x)' })).toMatchObject({ '--ne-a': '#22d3ee' });
    expect(getNameEffectStyle('neon', 'x', { color: '#12' })).toMatchObject({ '--ne-a': '#22d3ee' });
  });

  it('скорость пишется только у эффектов, которые её поддерживают, и ограничена 0.3..3', () => {
    expect(getNameEffectStyle('neon', 'x', { speed: 2 })).toMatchObject({ '--ne-s': 2 });
    expect(getNameEffectStyle('neon', 'x', { speed: 99 })).toMatchObject({ '--ne-s': 3 });
    expect(getNameEffectStyle('gradient', 'x', { speed: 2 })).not.toHaveProperty('--ne-s');
  });

  it('эффекты с фиксированным видом (хром, голограмма) не принимают цвета', () => {
    const s = getNameEffectStyle('chrome', 'x', { color: '#ff0000', speed: 2 }) as Record<string, unknown> | undefined;
    expect(s).not.toHaveProperty('--ne-a');
    expect(s).toMatchObject({ '--ne-s': 2 });
  });

  it('nameEffectOptions собирает настройки из конфига', () => {
    expect(nameEffectOptions({ nameEffectColor: '#fff000', nameEffectColor2: '#000fff', nameEffectSpeed: 1.5 })).toEqual({ color: '#fff000', color2: '#000fff', speed: 1.5 });
    expect(nameEffectOptions(null)).toEqual({ color: undefined, color2: undefined, speed: undefined });
  });
});

describe('ауры вокруг ника (искры)', () => {
  it('распознаются как искровые, обычные текстовые эффекты — нет', () => {
    for (const id of ['sparks_blue', 'sparks_rainbow', 'stars_aura', 'hearts_aura', 'fire_aura', 'snow_aura'] as const) expect(isSparkNameEffect(id), id).toBe(true);
    for (const id of ['neon', 'gold', 'wave', 'none'] as const) expect(isSparkNameEffect(id), id).toBe(false);
  });

  it('искры используют палитру эффекта, радужные — режим rainbow, свой цвет перекрывает палитру', () => {
    expect(getAuraFx('sparks_cyan')!.palette).toContain('#22d3ee');
    expect(getAuraFx('sparks_rainbow')!.colorMode).toBe('rainbow');
    expect(getAuraFx('sparks_blue', { color: '#ff0000' })!.palette).toEqual(['#ff0000']);
  });

  it('тип частиц и число задаются эффектом; у обычных эффектов ауры нет', () => {
    expect(getAuraFx('fire_aura')!.type).toBe('embers');
    expect(getAuraFx('snow_aura')!.type).toBe('snow');
    expect(getAuraFx('hearts_aura', {}, 17)!.count).toBe(17);
    expect(getAuraFx('neon')).toBeNull();
  });

  it('у аур текст остаётся читаемым: класс аурного эффекта не прячет буквы', () => {
    expect(getNameEffectClasses('sparks_blue')).toContain('text-white');
  });
});

describe('искры за курсором', () => {
  it('число частиц зависит от пройденного расстояния, а не от числа событий', () => {
    expect(sparksForDistance(0, 'medium')).toBe(0);
    expect(sparksForDistance(19, 'medium')).toBe(0);
    expect(sparksForDistance(60, 'medium')).toBe(3);
    expect(sparksForDistance(60, 'high')).toBeGreaterThan(sparksForDistance(60, 'low'));
  });
  it('быстрый курсор не создаёт лавину частиц', () => {
    expect(sparksForDistance(5000, 'high')).toBe(8);
  });
  it('все стили имеют символы (в том числе новые)', () => {
    for (const style of ['stars', 'dots', 'hearts', 'crosses', 'neon', 'snow', 'petals', 'notes', 'bubbles'] as const) {
      expect(SPARKLE_CHARS[style].length, style).toBeGreaterThan(0);
    }
  });
});
