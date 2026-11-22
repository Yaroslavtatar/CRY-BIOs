/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import type { BlockConfig } from './types';

export const BLOCK_TYPES: { type: BlockConfig['type']; label: string }[] = [
  { type: 'socials', label: 'Сетка ссылок' },
  { type: 'textbox', label: 'Текст' },
  { type: 'quote', label: 'Цитата' },
  { type: 'image', label: 'Изображение' },
  { type: 'embed', label: 'Медиа-плеер' },
  { type: 'status_api', label: 'Статус Discord' },
  { type: 'views_counter', label: 'Просмотры' },
  { type: 'html', label: 'Свой HTML' },
];

const rid = () => Math.random().toString();

/** Новый блок со значениями по умолчанию (используется в дашборде и в студии конструктора) */
export function createDefaultBlock(type: BlockConfig['type']): BlockConfig {
  const base = { id: rid(), type, enabled: true };
  switch (type) {
    case 'socials':
      return {
        ...base,
        title: 'Social networks',
        socialsList: [{ id: rid(), platform: 'discord', url: 'https://discord.gg/', useBrandColor: true }],
      };
    case 'html':
      return {
        ...base,
        title: 'Custom code embed',
        htmlContent: '<div style="color: #00ffcc; text-align: center;">🔥 Custom coding layout sandbox active!</div>',
      };
    case 'textbox':
      return {
        ...base,
        title: 'Notice Board',
        textboxContent: 'Write some scrolling announcement or details here.',
        textboxStyle: 'standard',
      };
    case 'quote':
      return {
        ...base,
        title: 'Inspiring quotes',
        quoteText: 'Think open-source, write performant code.',
        quoteAuthor: 'GunsOpen',
      };
    case 'status_api':
      return {
        ...base,
        title: 'Status widget',
        statusCustomText: '🎮 Coding in Dark Mode',
        statusProvider: 'custom',
      };
    case 'views_counter':
      return { ...base, title: 'Page view stats monitor' };
    case 'image':
      return {
        ...base,
        title: 'Featured Image',
        imageUrl: '/default-image.svg',
        imageAlt: 'Abstract Design',
        imageHeight: 200,
        imageFit: 'cover',
      };
    case 'embed':
      return {
        ...base,
        title: 'Custom Embed Media',
        embedType: 'youtube',
        embedUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      };
    default:
      return { ...base, title: 'Block' } as BlockConfig;
  }
}
