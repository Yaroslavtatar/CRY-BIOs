import { IMPORT_PROVIDERS, MAX_IMPORT_HTML_CHARS, MAX_IMPORT_SHORT_CHARS, getImportProvider } from './catalog';
import type { ImportContext } from './context';
import { looksLikeHtml } from './html';
import { importGithub } from './providers/github';
import { importGuns } from './providers/guns';
import { importLinktree } from './providers/linktree';
import { importTelegram } from './providers/telegram';
import { ImportError, type ImportedProfile } from './types';

export type { ImportContext } from './context';

/** Единая точка входа: выбранная платформа + то, что вставил пользователь. */
export async function runImport(providerId: unknown, rawInput: unknown, ctx: ImportContext = {}): Promise<ImportedProfile> {
  const provider = typeof providerId === 'string' ? getImportProvider(providerId) : undefined;
  if (!provider) {
    throw new ImportError(`Выберите платформу: ${IMPORT_PROVIDERS.map((p) => p.label).join(', ')}`, 'bad_input');
  }
  if (typeof rawInput !== 'string' || !rawInput.trim()) {
    throw new ImportError('Введите ссылку или имя профиля', 'bad_input');
  }
  const input = rawInput.trim();
  const isHtml = provider.htmlFallback && looksLikeHtml(input);

  if (isHtml ? input.length > MAX_IMPORT_HTML_CHARS : input.length > MAX_IMPORT_SHORT_CHARS) {
    throw new ImportError(
      provider.htmlFallback ? 'Слишком длинный ввод. Вставьте ссылку или HTML страницы' : 'Слишком длинный ввод. Укажите имя или ссылку',
      'bad_input',
    );
  }

  switch (provider.id) {
    case 'guns': return importGuns(input, ctx, isHtml);
    case 'linktree': return importLinktree(input, ctx, isHtml);
    case 'telegram': return importTelegram(input, ctx);
    case 'github': return importGithub(input, ctx);
  }
}
