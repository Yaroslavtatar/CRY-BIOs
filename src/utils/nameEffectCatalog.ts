import type { NameEffect } from '../types';

export interface NameEffectEntry {
  id: NameEffect;
  label: string;
  group: string;
  hint: string;
}

export const NAME_EFFECT_GROUPS = ['Базовые', 'Неон', 'Градиенты', 'Анимации'] as const;

export const NAME_EFFECT_CATALOG: NameEffectEntry[] = [
  { id: 'none', label: 'Без эффекта', group: 'Базовые', hint: 'Обычный белый текст без анимации.' },
  { id: 'glow', label: 'Мягкое свечение', group: 'Базовые', hint: 'Имя слегка светится, как неоновая вывеска.' },
  { id: 'stroke', label: 'Контур', group: 'Базовые', hint: 'Пустые буквы с белой обводкой.' },
  { id: 'shadow_3d', label: '3D-тень', group: 'Базовые', hint: 'Объёмный текст с цветной тенью.' },
  { id: 'underline_glow', label: 'Подчёркивание', group: 'Базовые', hint: 'Светящаяся линия под именем.' },
  { id: 'neon', label: 'Неон (бирюзовый)', group: 'Неон', hint: 'Пульсирующее неоновое свечение вокруг имени.' },
  { id: 'neon_red', label: 'Неон (красный)', group: 'Неон', hint: 'Красное неоновое свечение.' },
  { id: 'neon_blue', label: 'Неон (синий)', group: 'Неон', hint: 'Синее неоновое свечение.' },
  { id: 'gradient', label: 'Градиент фиолетово-розовый', group: 'Градиенты', hint: 'Плавный переход от фиолетового к розовому.' },
  { id: 'gradient_fire', label: 'Огненный градиент', group: 'Градиенты', hint: 'Цвета огня: оранжевый, красный, жёлтый.' },
  { id: 'gradient_ocean', label: 'Океанский градиент', group: 'Градиенты', hint: 'Оттенки моря: бирюза, синий, голубой.' },
  { id: 'rainbow', label: 'Радуга', group: 'Градиенты', hint: 'Переливающийся радужный текст.' },
  { id: 'shine', label: 'Блик', group: 'Анимации', hint: 'По имени пробегает световой блик.' },
  { id: 'glitch', label: 'Глитч', group: 'Анимации', hint: 'Лёгкие «сбои», как на старом мониторе.' },
  { id: 'flicker', label: 'Мерцание', group: 'Анимации', hint: 'Плавное мерцание, как у неоновой лампы.' },
  { id: 'typewriter', label: 'Печатная машинка', group: 'Анимации', hint: 'Имя печатается по буквам с мигающим курсором.' },
  { id: 'shuffle', label: 'Перемешивание', group: 'Анимации', hint: 'Буквы слегка смещаются и «дрожат».' },
  { id: 'fuzzy', label: 'Размытие', group: 'Анимации', hint: 'Лёгкое размытие и искажение текста.' },
  { id: 'bounce', label: 'Подпрыгивание', group: 'Анимации', hint: 'Имя мягко подпрыгивает вверх-вниз.' },
  { id: 'cyber', label: 'Кибер', group: 'Анимации', hint: 'Рваный «хакерский» эффект с широкими буквами.' },
];

export function getNameEffectHint(id: NameEffect | undefined): string {
  return NAME_EFFECT_CATALOG.find(e => e.id === id)?.hint || 'Выберите эффект для имени на профиле.';
}
