import fs from 'fs';
import path from 'path';
import {
  DEFAULT_LEGAL,
  legalContentChanged,
  normalizeLegal,
  todayIso,
  type LegalSettings,
} from './legalConfig';

function filePath(dataDir: string): string {
  return path.join(dataDir, 'legal_settings.json');
}

export function getLegalSettings(dataDir: string): LegalSettings {
  const file = filePath(dataDir);
  if (!fs.existsSync(file)) return { ...DEFAULT_LEGAL };
  try {
    return normalizeLegal(JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<LegalSettings>);
  } catch {
    return { ...DEFAULT_LEGAL };
  }
}

export type LegalPatchResult =
  | { ok: true; settings: LegalSettings }
  | { ok: false; error: string };

/**
 * Применяет частичное обновление. Некорректный e-mail или дата отклоняются с ошибкой.
 * Если изменился текст документов, а дата редакции не передана, она ставится на сегодня.
 */
export function updateLegalSettings(dataDir: string, patch: Partial<LegalSettings>): LegalPatchResult {
  const current = getLegalSettings(dataDir);

  for (const key of ['operatorContact', 'abuseContact'] as const) {
    if (key in patch && typeof patch[key] === 'string' && patch[key]!.trim()) {
      if (!/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]{2,}$/.test(patch[key]!.trim()) || patch[key]!.trim().length > 120) {
        return { ok: false, error: `${key}: укажите корректный e-mail` };
      }
    }
  }
  if ('lastUpdated' in patch && patch.lastUpdated !== undefined) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(patch.lastUpdated)) || Number.isNaN(Date.parse(String(patch.lastUpdated)))) {
      return { ok: false, error: 'lastUpdated: дата в формате ГГГГ-ММ-ДД' };
    }
  }

  const merged = normalizeLegal({ ...current, ...patch });
  if (!('lastUpdated' in patch) && legalContentChanged(current, merged)) {
    merged.lastUpdated = todayIso();
  }
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = `${filePath(dataDir)}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(merged, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath(dataDir));
  return { ok: true, settings: merged };
}
