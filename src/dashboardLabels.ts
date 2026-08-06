export const GLOW_TARGET_LABELS: Record<string, string> = {
  avatar: 'Аватар',
  username: 'Имя',
  location: 'Локация',
  badges: 'Бейджи',
  links: 'Ссылки',
  card: 'Карточка',
};

export const LOCATION_STYLE_LABELS: Record<string, { label: string; hint: string }> = {
  minimal: { label: 'Минимальный', hint: 'Иконка и текст без рамки.' },
  pill: { label: 'Капсула', hint: 'Текст в полупрозрачной рамке.' },
  glow: { label: 'Свечение', hint: 'Текст с мягким свечением.' },
  geo_pulse: { label: 'Пульс гео', hint: 'Пульсирующая иконка и подчёркивание.' },
};

export const LAYOUT_SECTION_LABELS: Record<string, string> = {
  avatar: 'Аватар',
  username: 'Имя пользователя',
  location: 'Город / локация',
  badges: 'Значки / бейджи',
  discord: 'Статус Discord',
  bio: 'Описание профиля',
  blocks: 'Дополнительные блоки',
  player: 'Музыкальный плеер',
};

export const EXTRA_TOGGLE_LABELS: Record<string, { label: string; hint: string }> = {
  showViewsCounter: { label: 'Счётчик просмотров', hint: 'Показывает число визитов на странице.' },
  showUid: { label: 'Показать UID', hint: 'Уникальный номер профиля.' },
  monochromeMode: { label: 'Ч/Б режим', hint: 'Вся страница в оттенках серого.' },
  parallaxEnabled: { label: 'Наклон карточки', hint: 'Карточка слегка наклоняется при движении мыши.' },
  avatarGlowEnabled: { label: 'Свечение аватара', hint: 'Светящаяся рамка вокруг фото.' },
  linkHoverGlow: { label: 'Свечение ссылок', hint: 'Ссылки подсвечиваются при наведении.' },
};

export const LOCATION_ICON_LABELS: Record<string, string> = {
  pin: 'Метка',
  globe: 'Глобус',
  map: 'Карта',
};

export const GLOW_INTENSITY_LABELS: Record<string, string> = {
  low: 'Слабое',
  medium: 'Среднее',
  high: 'Сильное',
};

export const LAYOUT_MODE_LABELS: Record<string, string> = {
  default: 'Стандартный',
  compact: 'Компактный (мобильный)',
  sleek: 'Стильный (guns.lol)',
};

export const VERIFIED_BADGE_LABELS: Record<string, string> = {
  inline: 'Галочка рядом с именем',
  chip: 'Бейдж-чип',
  ring: 'Кольцо на аватаре',
  none: 'Скрыть',
};

export const AUDIO_PLAYER_LABELS: Record<string, string> = {
  hidden: 'Без интерфейса',
  minimal: 'Минимальная полоска',
  inline: 'Внутри layout',
  floating: 'Плавающий уголок',
};

export const TEXTBOX_STYLE_LABELS: Record<string, string> = {
  standard: 'Обычный блок',
  glow: 'Со свечением',
  marquee: 'Бегущая строка',
};
