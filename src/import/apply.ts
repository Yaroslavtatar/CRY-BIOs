import type { BioConfig, BlockConfig, SocialLink } from '../types';
import type { ImportSection } from './catalog';
import { IMPORT_SECTION_LABELS } from './catalog';
import { DESIGN_FIELDS, MUSIC_FIELDS, hasDesign, hasValue } from './sections';
import { linkKey } from './socialDetect';
import type { ImportedProfile } from './types';

export const MAX_LINKS_IN_BLOCK = 40;

function pick<K extends string>(from: ImportedProfile, keys: readonly K[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = (from as Record<string, unknown>)[k];
    if (hasValue(v)) out[k] = v;
  }
  return out;
}

function uniqueId(base: string, used: Set<string>): string {
  let id = base;
  for (let n = 2; used.has(id); n++) id = `${base}-${n}`;
  used.add(id);
  return id;
}

/** Добавляет только новые ссылки, существующие остаются как есть. Возвращает блоки и число добавленных. */
export function mergeLinks(blocks: BlockConfig[], incoming: SocialLink[]): { blocks: BlockConfig[]; added: number } {
  const next = blocks.map((b) => ({ ...b }));
  let idx = next.findIndex((b) => b.type === 'socials');
  if (idx === -1) {
    const used = new Set(next.map((b) => b.id));
    next.push({ id: uniqueId('imported-socs', used), type: 'socials', title: 'Ссылки', enabled: true, socialsList: [] });
    idx = next.length - 1;
  }
  const list = [...(next[idx].socialsList ?? [])];
  const keys = new Set(list.map((l) => linkKey(l.url)));
  const usedIds = new Set(list.map((l) => l.id));
  let added = 0;
  for (const link of incoming) {
    if (list.length >= MAX_LINKS_IN_BLOCK) break;
    const key = linkKey(link.url);
    if (keys.has(key)) continue;
    keys.add(key);
    list.push({ ...link, id: uniqueId(link.id, usedIds) });
    added++;
  }
  next[idx] = { ...next[idx], socialsList: list };
  return { blocks: next, added };
}

export interface ApplyResult {
  config: BioConfig;
  /** Человекочитаемый итог по каждому применённому разделу */
  applied: string[];
}

/**
 * Применяет к профилю только отмеченные разделы и только те поля, которые источник реально отдал.
 * Пустые значения ничего не затирают.
 */
export function applyImportedProfile(config: BioConfig, imported: ImportedProfile, sections: readonly ImportSection[]): ApplyResult {
  const patch: Record<string, unknown> = {};
  const applied: string[] = [];
  const on = new Set(sections);

  if (on.has('identity')) {
    const identity = pick(imported, ['displayName', 'bio', 'avatarUrl', 'locationText']);
    if (hasValue(imported.locationText)) patch.locationEnabled = true;
    if (Object.keys(identity).length) {
      Object.assign(patch, identity);
      applied.push(IMPORT_SECTION_LABELS.identity);
    }
  }

  let blocks = config.blocks;
  if (on.has('links') && imported.socialsList?.length) {
    const merged = mergeLinks(config.blocks, imported.socialsList);
    blocks = merged.blocks;
    applied.push(`${IMPORT_SECTION_LABELS.links}: добавлено ${merged.added}`);
  }

  if (on.has('design') && hasDesign(imported)) {
    Object.assign(patch, pick(imported, DESIGN_FIELDS));
    if (hasValue(imported.bgType) && hasValue(imported.bgValue)) {
      patch.bgType = imported.bgType;
      patch.bgValue = imported.bgValue;
    }
    applied.push(IMPORT_SECTION_LABELS.design);
  }

  if (on.has('music')) {
    const track = imported.playlist?.[0];
    const hasAudio = hasValue(imported.audioUrl) || !!imported.playlist?.length;
    if (hasAudio) {
      Object.assign(patch, pick(imported, MUSIC_FIELDS));
      if (hasValue(imported.audioUrl)) patch.audioUrl = imported.audioUrl;
      if (imported.playlist?.length) {
        patch.playlist = imported.playlist;
        patch.audioSourceMode = imported.playlist.length > 1 ? 'playlist' : config.audioSourceMode || 'single';
      }
      if (track?.title) patch.audioTitle = track.title;
      if (track?.artist) patch.audioArtist = track.artist;
      if (imported.audioEnabled === undefined) patch.audioEnabled = true;
      applied.push(IMPORT_SECTION_LABELS.music);
    }
  }

  if (on.has('badges')) {
    // verified и staff выдаёт только сервер, импортом их получить нельзя
    const badges = (imported.badges ?? []).filter((b) => b.type !== 'verified' && b.type !== 'staff');
    if (badges.length) {
      patch.badges = badges;
      applied.push(IMPORT_SECTION_LABELS.badges);
    }
  }

  return { config: { ...config, ...patch, blocks } as BioConfig, applied };
}
