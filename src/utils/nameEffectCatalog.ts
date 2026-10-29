import type { NameEffect } from '../types';
import type { FxType } from '../fx/engine';

export interface NameEffectAura {
  type: FxType;
  /** Палитра ауры; без неё — родные цвета типа частиц */
  palette?: string[];
  rainbow?: boolean;
}

export interface NameEffectEntry {
  id: NameEffect;
  label: string;
  group: string;
  hint: string;
  /** CSS-класс эффекта на переменных --ne-a/--ne-b/--ne-s (поддерживает свои цвета и скорость) */
  cls?: string;
  /** Цвета по умолчанию */
  a?: string;
  b?: string;
  /** Сколько цветов можно менять: 0 — нисколько, 1 — основной, 2 — основной и второй */
  colors?: 0 | 1 | 2;
  /** Умеет ли эффект менять скорость */
  speed?: boolean;
  /** Эффект работает по буквам (каждая буква — свой <span>) */
  letters?: boolean;
  /** Печатная машинка: к буквам добавляется мигающий курсор */
  caret?: boolean;
  /** Частицы вокруг имени */
  aura?: NameEffectAura;
}

export const NAME_EFFECT_GROUPS = ['Базовые', 'Неон', 'Градиенты', 'Металл и свет', 'Анимации', 'По буквам', 'Искры и ауры'] as const;

const SPARKS = (palette: string[]): NameEffectAura => ({ type: 'sparks', palette });

export const NAME_EFFECT_CATALOG: NameEffectEntry[] = [
  // ---------- Базовые
  { id: 'none', label: 'Без эффекта', group: 'Базовые', hint: 'Обычный белый текст без анимации.' },
  { id: 'glow', label: 'Мягкое свечение', group: 'Базовые', hint: 'Имя слегка светится, как неоновая вывеска.', cls: 'ne-glow', a: '#ffffff', colors: 1 },
  { id: 'stroke', label: 'Контур', group: 'Базовые', hint: 'Пустые буквы с обводкой.', cls: 'ne-stroke', a: '#ffffff', colors: 1 },
  { id: 'shadow_3d', label: '3D-тень', group: 'Базовые', hint: 'Объёмный текст с цветной ступенчатой тенью.', cls: 'ne-shadow3d', a: '#00f2ff', b: '#0066aa', colors: 2 },
  { id: 'underline_glow', label: 'Подчёркивание', group: 'Базовые', hint: 'Светящаяся линия под именем.', cls: 'ne-underline', a: '#00f2ff', colors: 1 },

  // ---------- Неон
  { id: 'neon', label: 'Неон (бирюзовый)', group: 'Неон', hint: 'Пульсирующее неоновое свечение вокруг имени.', cls: 'ne-neon', a: '#22d3ee', colors: 1, speed: true },
  { id: 'neon_red', label: 'Неон (красный)', group: 'Неон', hint: 'Красное неоновое свечение.', cls: 'ne-neon', a: '#f87171', colors: 1, speed: true },
  { id: 'neon_blue', label: 'Неон (синий)', group: 'Неон', hint: 'Синее неоновое свечение.', cls: 'ne-neon', a: '#60a5fa', colors: 1, speed: true },
  { id: 'neon_pink', label: 'Неон (розовый)', group: 'Неон', hint: 'Яркий розовый неон.', cls: 'ne-neon', a: '#f472b6', colors: 1, speed: true },
  { id: 'neon_green', label: 'Неон (зелёный)', group: 'Неон', hint: 'Кислотно-зелёный неон.', cls: 'ne-neon', a: '#4ade80', colors: 1, speed: true },
  { id: 'neon_purple', label: 'Неон (фиолетовый)', group: 'Неон', hint: 'Глубокий фиолетовый неон.', cls: 'ne-neon', a: '#c084fc', colors: 1, speed: true },
  { id: 'neon_gold', label: 'Неон (золотой)', group: 'Неон', hint: 'Тёплое янтарное свечение.', cls: 'ne-neon', a: '#fbbf24', colors: 1, speed: true },
  { id: 'outline_neon', label: 'Неоновый контур', group: 'Неон', hint: 'Пустые буквы, обведённые светящейся линией.', cls: 'ne-outline-neon', a: '#22d3ee', colors: 1, speed: true },

  // ---------- Градиенты
  { id: 'gradient', label: 'Градиент фиолетово-розовый', group: 'Градиенты', hint: 'Плавный переход от фиолетового к розовому.', cls: 'ne-grad', a: '#c084fc', b: '#db2777', colors: 2 },
  { id: 'gradient_fire', label: 'Огненный градиент', group: 'Градиенты', hint: 'Цвета огня: оранжевый, красный, жёлтый.', cls: 'ne-grad ne-grad-3', a: '#f97316', b: '#eab308', colors: 2 },
  { id: 'gradient_ocean', label: 'Океанский градиент', group: 'Градиенты', hint: 'Оттенки моря: бирюза, синий, голубой.', cls: 'ne-grad ne-grad-3', a: '#2dd4bf', b: '#22d3ee', colors: 2 },
  { id: 'rainbow', label: 'Радуга', group: 'Градиенты', hint: 'Переливающийся радужный текст.' },
  { id: 'sunset', label: 'Закат', group: 'Градиенты', hint: 'Тёплый переход от оранжевого к фиолетовому, плавно перетекает.', cls: 'ne-grad ne-flow ne-sunset', a: '#f97316', b: '#8b5cf6', colors: 2, speed: true },
  { id: 'candy', label: 'Конфетка', group: 'Градиенты', hint: 'Нежный розово-голубой градиент.', cls: 'ne-grad ne-flow', a: '#f9a8d4', b: '#93c5fd', colors: 2, speed: true },
  { id: 'aurora_text', label: 'Северное сияние', group: 'Градиенты', hint: 'Зелёно-бирюзово-фиолетовые переливы, как полярное сияние.', cls: 'ne-grad ne-flow ne-aurora', a: '#34d399', b: '#a78bfa', colors: 2, speed: true },
  { id: 'holo', label: 'Голограмма', group: 'Градиенты', hint: 'Перламутровый переливающийся текст, как голографическая плёнка.', cls: 'ne-holo', speed: true, colors: 0 },

  // ---------- Металл и свет
  { id: 'chrome', label: 'Хром', group: 'Металл и свет', hint: 'Зеркальный металл с бегущим бликом.', cls: 'ne-metal ne-chrome', speed: true, colors: 0 },
  { id: 'gold', label: 'Золото', group: 'Металл и свет', hint: 'Золотые буквы с блеском.', cls: 'ne-metal ne-gold', speed: true, colors: 0 },
  { id: 'ice', label: 'Лёд', group: 'Металл и свет', hint: 'Морозные буквы с холодным сиянием.', cls: 'ne-ice', a: '#7dd3fc', colors: 1 },
  { id: 'synthwave', label: 'Синтвейв', group: 'Металл и свет', hint: 'Розово-голубой градиент в духе ретро-80-х со свечением.', cls: 'ne-synthwave', a: '#f0abfc', b: '#38bdf8', colors: 2 },
  { id: 'fire_text', label: 'Пламя', group: 'Металл и свет', hint: 'Живой огонь: буквы колышутся и мерцают.', cls: 'ne-fire', a: '#f97316', b: '#facc15', colors: 2, speed: true },
  { id: 'shine', label: 'Блик', group: 'Металл и свет', hint: 'По имени пробегает световой блик.' },

  // ---------- Анимации
  { id: 'glitch', label: 'Глитч', group: 'Анимации', hint: 'Лёгкие «сбои», как на старом мониторе.' },
  { id: 'rgb_split', label: 'RGB-сдвиг', group: 'Анимации', hint: 'Хроматическая аберрация: красно-голубое расслоение с редкими «срывами».', cls: 'ne-rgb', a: '#ff0050', b: '#00f0ff', colors: 2, speed: true },
  { id: 'scan', label: 'Сканер', group: 'Анимации', hint: 'Светящаяся линия сканирует буквы сверху вниз.', cls: 'ne-scan', a: '#22d3ee', colors: 1, speed: true },
  { id: 'ghost', label: 'Призрак', group: 'Анимации', hint: 'Имя то тает в тумане, то проявляется.', cls: 'ne-ghost', a: '#c4b5fd', colors: 1, speed: true },
  { id: 'electric', label: 'Электричество', group: 'Анимации', hint: 'Дёргающийся разряд с неоновым ореолом.', cls: 'ne-electric', a: '#60a5fa', colors: 1, speed: true },
  { id: 'toxic', label: 'Токсик', group: 'Анимации', hint: 'Ядовито-зелёное свечение с колыханием.', cls: 'ne-toxic', a: '#84cc16', colors: 1, speed: true },
  { id: 'matrix_text', label: 'Матрица', group: 'Анимации', hint: 'Моноширинные зелёные буквы с мерцанием терминала.', cls: 'ne-matrix', a: '#22c55e', colors: 1, speed: true },
  { id: 'flicker', label: 'Мерцание', group: 'Анимации', hint: 'Плавное мерцание, как у неоновой лампы.' },
  { id: 'shuffle', label: 'Перемешивание', group: 'Анимации', hint: 'Буквы слегка смещаются и «дрожат».' },
  { id: 'fuzzy', label: 'Размытие', group: 'Анимации', hint: 'Лёгкое размытие и искажение текста.' },
  { id: 'bounce', label: 'Подпрыгивание', group: 'Анимации', hint: 'Имя мягко подпрыгивает вверх-вниз.' },
  { id: 'cyber', label: 'Кибер', group: 'Анимации', hint: 'Рваный «хакерский» эффект с широкими буквами.' },
  { id: 'blur_glitch', label: 'Размытый ник', group: 'Анимации', hint: 'Горизонтальный глитч с размытием, как на guns.lol.' },
  { id: 'shift', label: 'Смена', group: 'Анимации', hint: 'Motion blur и смещение букв.' },

  // ---------- По буквам
  { id: 'typewriter', label: 'Печатная машинка', group: 'По буквам', hint: 'Имя печатается по буквам с мигающим курсором и начинается заново.', cls: 'ne-letters ne-type', a: '#ffffff', colors: 1, speed: true, letters: true, caret: true },
  { id: 'wave', label: 'Волна', group: 'По буквам', hint: 'Буквы плавно качаются волной одна за другой.', cls: 'ne-letters ne-wave', a: '#22d3ee', colors: 1, speed: true, letters: true },
  { id: 'cascade', label: 'Каскад', group: 'По буквам', hint: 'Буквы по очереди падают сверху и растворяются.', cls: 'ne-letters ne-cascade', a: '#ffffff', colors: 1, speed: true, letters: true },
  { id: 'jelly', label: 'Желе', group: 'По буквам', hint: 'Буквы пружинят, как желе.', cls: 'ne-letters ne-jelly', a: '#f472b6', colors: 1, speed: true, letters: true },
  { id: 'flip3d', label: '3D-переворот', group: 'По буквам', hint: 'Буквы по очереди переворачиваются в объёме.', cls: 'ne-letters ne-flip', a: '#a78bfa', colors: 1, speed: true, letters: true },

  // ---------- Искры и ауры
  { id: 'sparks_blue', label: 'Синие искры', group: 'Искры и ауры', hint: 'Синие и фиолетовые искры вылетают из имени.', cls: 'ne-aura', aura: SPARKS(['#6366f1', '#818cf8', '#a855f7', '#60a5fa']), colors: 1 },
  { id: 'sparks_cyan', label: 'Бирюзовые искры', group: 'Искры и ауры', hint: 'Холодные бирюзовые искры.', cls: 'ne-aura', aura: SPARKS(['#22d3ee', '#67e8f9', '#06b6d4', '#a5f3fc']), colors: 1 },
  { id: 'sparks_green', label: 'Зелёные искры', group: 'Искры и ауры', hint: 'Салатовые и изумрудные искры.', cls: 'ne-aura', aura: SPARKS(['#4ade80', '#86efac', '#22c55e', '#bef264']), colors: 1 },
  { id: 'sparks_yellow', label: 'Жёлтые искры', group: 'Искры и ауры', hint: 'Жёлто-зелёные искры.', cls: 'ne-aura', aura: SPARKS(['#fbbf24', '#facc15', '#84cc16', '#fde047']), colors: 1 },
  { id: 'sparks_gold', label: 'Золотые искры', group: 'Искры и ауры', hint: 'Золотые искры.', cls: 'ne-aura', aura: SPARKS(['#fbbf24', '#f59e0b', '#fcd34d', '#fde68a']), colors: 1 },
  { id: 'sparks_pink', label: 'Розовые искры', group: 'Искры и ауры', hint: 'Розовые искры.', cls: 'ne-aura', aura: SPARKS(['#ec4899', '#f472b6', '#fb7185', '#fda4af']), colors: 1 },
  { id: 'sparks_purple', label: 'Фиолетовые искры', group: 'Искры и ауры', hint: 'Сиреневые и пурпурные искры.', cls: 'ne-aura', aura: SPARKS(['#a855f7', '#c084fc', '#d946ef', '#e879f9']), colors: 1 },
  { id: 'sparks_red', label: 'Красные искры', group: 'Искры и ауры', hint: 'Красные искры.', cls: 'ne-aura', aura: SPARKS(['#ef4444', '#f87171', '#dc2626', '#fb923c']), colors: 1 },
  { id: 'sparks_white', label: 'Белые искры', group: 'Искры и ауры', hint: 'Серебристые искры.', cls: 'ne-aura', aura: SPARKS(['#ffffff', '#e5e7eb', '#d1d5db', '#f3f4f6']), colors: 1 },
  { id: 'sparks_rainbow', label: 'Радужные искры', group: 'Искры и ауры', hint: 'Каждая искра своего цвета.', cls: 'ne-aura', aura: { type: 'sparks', rainbow: true } },
  { id: 'stars_aura', label: 'Звёздная аура', group: 'Искры и ауры', hint: 'Мерцающие звёзды вокруг имени.', cls: 'ne-aura', aura: { type: 'stars' }, colors: 1 },
  { id: 'hearts_aura', label: 'Сердечки', group: 'Искры и ауры', hint: 'Сердечки поднимаются над именем.', cls: 'ne-aura', aura: { type: 'hearts' }, colors: 1 },
  { id: 'fire_aura', label: 'Огненная аура', group: 'Искры и ауры', hint: 'Угольки поднимаются от имени.', cls: 'ne-aura', aura: { type: 'embers' }, colors: 1 },
  { id: 'snow_aura', label: 'Снежная аура', group: 'Искры и ауры', hint: 'Снежинки кружатся вокруг имени.', cls: 'ne-aura', aura: { type: 'snow' }, colors: 1 },
];

const BY_ID = new Map<NameEffect, NameEffectEntry>(NAME_EFFECT_CATALOG.map((e) => [e.id, e]));

export function getNameEffectEntry(id: NameEffect | undefined): NameEffectEntry | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function getNameEffectHint(id: NameEffect | undefined): string {
  return BY_ID.get(id as NameEffect)?.hint || 'Выберите эффект для имени на профиле.';
}
