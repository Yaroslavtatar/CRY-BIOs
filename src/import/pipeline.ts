import { rehostImportMedia } from '../rehostMedia';
import { runImport, type ImportContext } from './index';
import type { ImportJobResult, ImportedProfile } from './types';

export interface ImportPipelineDeps {
  uploadsDir: string;
  tmpDir: string;
  dataDir: string;
  ctx?: ImportContext;
  /** Подмена в тестах */
  rehost?: typeof rehostImportMedia;
}

export type ImportProgress = { current: number; total: number; label: string };

const MEDIA_NAMES: Record<string, string> = {
  avatarUrl: 'аватар',
  bgValue: 'фон',
  audioUrl: 'музыку',
  customCursorUrl: 'курсор',
};

function mediaName(key: string): string {
  if (key.startsWith('playlist-')) return `трек ${Number(key.split('-')[1]) + 1}`;
  return MEDIA_NAMES[key] ?? 'файл';
}

const isRemote = (v: unknown): v is string => typeof v === 'string' && /^https?:\/\//i.test(v);

/** Ссылки, которые после сохранения остались внешними: файл не удалось перенести на наш сервер. */
export function collectUnhostedMedia(p: ImportedProfile): string[] {
  const out: string[] = [];
  if (isRemote(p.avatarUrl)) out.push('аватар');
  if (isRemote(p.bgValue) && (p.bgType === 'image' || p.bgType === 'video')) out.push('фон');
  if (isRemote(p.audioUrl)) out.push('музыку');
  if (isRemote(p.customCursorUrl)) out.push('курсор');
  p.playlist?.forEach((t, i) => { if (isRemote(t.url)) out.push(`трек ${i + 1}`); });
  return out;
}

export async function importProfile(
  providerId: unknown,
  input: unknown,
  deps: ImportPipelineDeps,
  report: (p: ImportProgress) => void = () => {},
): Promise<ImportJobResult> {
  report({ current: 0, total: 0, label: 'Читаю профиль…' });
  const parsed = await runImport(providerId, input, deps.ctx);

  const rehost = deps.rehost ?? rehostImportMedia;
  const hosted = await rehost(
    {
      avatarUrl: parsed.avatarUrl,
      bgType: parsed.bgType,
      bgValue: parsed.bgValue,
      audioUrl: parsed.audioUrl,
      customCursorUrl: parsed.customCursorUrl,
      playlist: parsed.playlist,
    },
    deps.uploadsDir,
    deps.tmpDir,
    (current, total, key) => report({ current, total, label: `Сохраняю ${mediaName(key)} (${current}/${total})…` }),
    deps.dataDir,
  );

  const profile: ImportedProfile = { ...parsed };
  for (const key of ['avatarUrl', 'bgValue', 'audioUrl', 'customCursorUrl'] as const) {
    if (parsed[key] !== undefined && hosted[key] !== undefined) (profile as any)[key] = hosted[key];
  }
  if (hosted.playlist) profile.playlist = hosted.playlist as ImportedProfile['playlist'];

  const unhosted = collectUnhostedMedia(profile);
  const warnings = unhosted.length
    ? [`Не удалось сохранить на сервере: ${unhosted.join(', ')}. Пока они подгружаются с сайта-источника и могут пропасть.`]
    : [];
  if (profile.notes) warnings.unshift(...profile.notes);
  return { profile, warnings };
}

