import type { GunsImportResult } from '../gunsImportMap';
import type { ImportProviderId } from './catalog';

/**
 * Единый результат импорта с любой платформы. Все поля необязательные:
 * источник заполняет только то, что у него есть, остальное в профиле не трогаем.
 */
export type ImportedProfile = Partial<Omit<GunsImportResult, 'verified'>> & {
  source: ImportProviderId;
  sourceLabel: string;
  sourceUsername?: string;
  /** Что стоит знать до применения (например, профиль закрыт и взята только ссылка) */
  notes?: string[];
};

export interface ImportJobResult {
  profile: ImportedProfile;
  /** Предупреждения, которые не остановили импорт (медиа не сохранились на сервере и т. п.) */
  warnings: string[];
}

export type ImportErrorCode = 'bad_input' | 'not_found' | 'blocked' | 'rate_limited' | 'too_large' | 'upstream' | 'parse' | 'busy';

export class ImportError extends Error {
  constructor(message: string, public readonly code: ImportErrorCode = 'upstream') {
    super(message);
    this.name = 'ImportError';
  }
}
