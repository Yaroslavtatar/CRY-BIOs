/**
 * Каталог платформ импорта. Только данные, без серверных зависимостей:
 * его читают и меню в кабинете, и сервер.
 */

export type ImportProviderId = 'guns' | 'linktree' | 'telegram' | 'github';

/** Что именно можно перенести. Пользователь отмечает разделы перед применением. */
export type ImportSection = 'identity' | 'links' | 'design' | 'music' | 'badges';

export interface ImportProviderInfo {
  id: ImportProviderId;
  label: string;
  /** Одна строка на карточке платформы */
  tagline: string;
  inputLabel: string;
  placeholder: string;
  /** Какие разделы платформа вообще умеет отдавать */
  sections: readonly ImportSection[];
  /** Можно ли вставить HTML страницы, если сервер не смог её скачать */
  htmlFallback: boolean;
  htmlHint?: string;
}

export const IMPORT_PROVIDERS: readonly ImportProviderInfo[] = [
  {
    id: 'guns',
    label: 'guns.lol',
    tagline: 'Дизайн, фон, музыка, ссылки и бейджи',
    inputLabel: 'Ссылка или имя на guns.lol',
    placeholder: 'https://guns.lol/username',
    sections: ['identity', 'links', 'design', 'music', 'badges'],
    htmlFallback: true,
    htmlHint: 'Откройте свою страницу на guns.lol, нажмите Ctrl+U, затем Ctrl+A и Ctrl+C и вставьте сюда.',
  },
  {
    id: 'linktree',
    label: 'Linktree',
    tagline: 'Имя, описание, аватар и все ссылки',
    inputLabel: 'Ссылка или имя на Linktree',
    placeholder: 'https://linktr.ee/username',
    sections: ['identity', 'links'],
    htmlFallback: true,
    htmlHint: 'Откройте страницу на linktr.ee, нажмите Ctrl+U, затем Ctrl+A и Ctrl+C и вставьте сюда.',
  },
  {
    id: 'telegram',
    label: 'Telegram',
    tagline: 'Имя, описание и аватар из публичного профиля',
    inputLabel: 'Имя пользователя или ссылка t.me',
    placeholder: '@username',
    sections: ['identity', 'links'],
    htmlFallback: false,
  },
  {
    id: 'github',
    label: 'GitHub',
    tagline: 'Имя, описание, аватар, сайт и соцсети',
    inputLabel: 'Логин или ссылка на GitHub',
    placeholder: 'octocat',
    sections: ['identity', 'links'],
    htmlFallback: false,
  },
];

export const IMPORT_SECTION_LABELS: Record<ImportSection, string> = {
  identity: 'Имя, описание, аватар',
  links: 'Ссылки и соцсети',
  design: 'Оформление',
  music: 'Музыка и плеер',
  badges: 'Бейджи',
};

/** Вставленный HTML страницы может быть большим; обычный ввод — короткая строка. */
export const MAX_IMPORT_HTML_CHARS = 2_000_000;
export const MAX_IMPORT_SHORT_CHARS = 300;

export function getImportProvider(id: string): ImportProviderInfo | undefined {
  return IMPORT_PROVIDERS.find((p) => p.id === id);
}
