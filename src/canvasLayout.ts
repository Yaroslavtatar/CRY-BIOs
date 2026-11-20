/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Чистая логика свободного конструктора страницы: модель раскладки, авто-расстановка,
 * привязка к сетке, слои и серверная валидация. Без React и DOM — легко тестировать.
 */

import type { BioConfig, BlockConfig, CanvasDeviceLayout, CanvasFrame, CanvasLayout } from './types';

export type CanvasDevice = 'desktop' | 'mobile';

export const DESKTOP_W = 960;
export const MOBILE_W = 390;
export const MIN_FRAME_W = 24;
export const MIN_FRAME_H = 16;
export const DEFAULT_GRID = 8;
export const MIN_STAGE_H = 480;
const STAGE_PAD_BOTTOM = 64;
const GAP = 16;
const MAX_FRAMES = 200;

export const stageWidth = (device: CanvasDevice): number => (device === 'mobile' ? MOBILE_W : DESKTOP_W);

export type CanvasElementKind = 'section' | 'block';

export interface CanvasElement {
  id: string;
  label: string;
  kind: CanvasElementKind;
  block?: BlockConfig;
}

const SECTION_LABELS: Record<string, string> = {
  avatar: 'Аватар',
  username: 'Ник',
  location: 'Локация',
  discord: 'Discord',
  bio: 'О себе',
  player: 'Плеер',
};

const BLOCK_LABELS: Record<BlockConfig['type'], string> = {
  socials: 'Соцсети',
  html: 'HTML',
  status_api: 'Статус',
  views_counter: 'Просмотры',
  textbox: 'Текст',
  quote: 'Цитата',
  image: 'Картинка',
  embed: 'Встраивание',
};

export const blockElementId = (block: Pick<BlockConfig, 'id'>): string => `block:${block.id}`;

const DEFAULT_SECTION_ORDER = ['avatar', 'username', 'location', 'badges', 'discord', 'bio', 'blocks', 'player'];

/** Какие элементы сейчас есть на странице (в порядке обычной раскладки). Совпадает с правилами показа в BioPage. */
export function listElements(config: BioConfig): CanvasElement[] {
  const out: CanvasElement[] = [];
  const order = config.layout && config.layout.length ? config.layout : DEFAULT_SECTION_ORDER;
  for (const section of order) {
    switch (section) {
      case 'avatar':
      case 'username':
        out.push({ id: section, label: SECTION_LABELS[section], kind: 'section' });
        break;
      case 'location':
        if (config.locationEnabled && config.locationText?.trim()) out.push({ id: 'location', label: SECTION_LABELS.location, kind: 'section' });
        break;
      case 'discord':
        if (config.discordConnected && config.discordId) out.push({ id: 'discord', label: SECTION_LABELS.discord, kind: 'section' });
        break;
      case 'bio':
        if (config.bio?.trim()) out.push({ id: 'bio', label: SECTION_LABELS.bio, kind: 'section' });
        break;
      case 'player':
        if (config.audioEnabled && config.audioPlayerMode === 'inline') out.push({ id: 'player', label: SECTION_LABELS.player, kind: 'section' });
        break;
      case 'blocks':
        for (const b of config.blocks || []) {
          if (!b.enabled) continue;
          out.push({ id: blockElementId(b), label: b.title?.trim() || BLOCK_LABELS[b.type] || 'Блок', kind: 'block', block: b });
        }
        break;
      default:
        break;
    }
  }
  return out;
}

/** Ориентировочная высота элемента (для авто-расстановки; реальная высота определяется содержимым) */
export function estimateHeight(el: CanvasElement, device: CanvasDevice): number {
  if (el.kind === 'section') {
    switch (el.id) {
      case 'avatar': return device === 'mobile' ? 88 : 104;
      case 'username': return device === 'mobile' ? 44 : 56;
      case 'location': return 28;
      case 'discord': return 120;
      case 'bio': return 64;
      case 'player': return 56;
      default: return 48;
    }
  }
  const b = el.block;
  switch (b?.type) {
    case 'socials': return 52;
    case 'html': return 120;
    case 'status_api': return 44;
    case 'views_counter': return 32;
    case 'textbox': return 56;
    case 'quote': return 88;
    case 'image': return b.imageHeight && b.imageHeight > 0 ? b.imageHeight : 180;
    case 'embed': return 200;
    default: return 56;
  }
}

function defaultWidth(el: CanvasElement, device: CanvasDevice): number {
  const full = device === 'mobile' ? MOBILE_W - 32 : 480;
  if (el.kind === 'section' && el.id === 'avatar') return device === 'mobile' ? 88 : 104;
  return full;
}

function centeredX(w: number, device: CanvasDevice): number {
  return Math.round((stageWidth(device) - w) / 2);
}

/** Авто-расстановка колонкой по центру (как обычная страница) */
export function autoLayoutFrames(config: BioConfig, device: CanvasDevice): Record<string, CanvasFrame> {
  const frames: Record<string, CanvasFrame> = {};
  let y = 40;
  let z = 1;
  for (const el of listElements(config)) {
    const w = defaultWidth(el, device);
    const est = estimateHeight(el, device);
    const frame: CanvasFrame = { x: centeredX(w, device), y, w, z: z++ };
    if (el.kind === 'block' && (el.block?.type === 'image' || el.block?.type === 'embed')) frame.h = est;
    frames[el.id] = frame;
    y += est + GAP;
  }
  return frames;
}

/** Нижняя граница по рамкам (для элементов без h берётся оценка) */
function framesBottom(frames: Record<string, CanvasFrame>, estimate: (id: string) => number): number {
  let bottom = 0;
  for (const [id, f] of Object.entries(frames)) {
    if (f.hidden) continue;
    bottom = Math.max(bottom, f.y + (f.h ?? estimate(id)));
  }
  return bottom;
}

export function computeStageHeight(frames: Record<string, CanvasFrame>, estimate: (id: string) => number): number {
  return Math.max(MIN_STAGE_H, Math.round(framesBottom(frames, estimate) + STAGE_PAD_BOTTOM));
}

/**
 * Рамки устройства, приведённые в соответствие с текущими элементами:
 * удалённые элементы пропадают, новые добавляются под всем остальным.
 * Если раскладка устройства не задана — собирается автоматически.
 */
export function reconcileDevice(config: BioConfig, device: CanvasDevice): CanvasDeviceLayout {
  const elements = listElements(config);
  const byId = new Map(elements.map((e) => [e.id, e]));
  const estimate = (id: string) => {
    const el = byId.get(id);
    return el ? estimateHeight(el, device) : 48;
  };
  const stored = config.canvas?.[device];
  if (!stored) {
    const frames = autoLayoutFrames(config, device);
    return { height: computeStageHeight(frames, estimate), frames };
  }
  const frames: Record<string, CanvasFrame> = {};
  for (const el of elements) {
    if (stored.frames[el.id]) frames[el.id] = { ...stored.frames[el.id] };
  }
  let bottom = framesBottom(frames, estimate);
  let z = Object.values(frames).reduce((m, f) => Math.max(m, f.z), 0);
  for (const el of elements) {
    if (frames[el.id]) continue;
    const w = defaultWidth(el, device);
    const est = estimateHeight(el, device);
    const y = Math.round(bottom + (bottom > 0 ? GAP : 40));
    frames[el.id] = { x: centeredX(w, device), y, w, z: ++z };
    bottom = y + est;
  }
  return { height: Math.max(stored.height, computeStageHeight(frames, estimate)), frames };
}

/** Полная раскладка с заполненными значениями по умолчанию */
export function resolveCanvas(config: BioConfig): Required<Pick<CanvasLayout, 'enabled' | 'snap' | 'grid'>> & { desktop: CanvasDeviceLayout; mobile: CanvasDeviceLayout; mobileCustom: boolean } {
  const c = config.canvas;
  return {
    enabled: c?.enabled === true,
    snap: c?.snap !== false,
    grid: clampInt(c?.grid ?? DEFAULT_GRID, 4, 64),
    desktop: reconcileDevice(config, 'desktop'),
    mobile: reconcileDevice(config, 'mobile'),
    mobileCustom: !!c?.mobile,
  };
}

function clampInt(v: number, min: number, max: number): number {
  const n = Math.round(Number.isFinite(v) ? v : min);
  return Math.min(max, Math.max(min, n));
}

export function snapValue(v: number, grid: number, on: boolean): number {
  if (!on || grid <= 0) return Math.round(v);
  return Math.round(v / grid) * grid;
}

/** Держит рамку внутри экрана устройства по горизонтали и не выше верха страницы */
export function clampFrame(f: CanvasFrame, device: CanvasDevice): CanvasFrame {
  const sw = stageWidth(device);
  const w = Math.min(sw, Math.max(MIN_FRAME_W, f.w));
  const h = f.h === undefined ? undefined : Math.max(MIN_FRAME_H, f.h);
  const x = Math.min(sw - w, Math.max(0, f.x));
  const y = Math.max(0, f.y);
  return { ...f, x, y, w, ...(h === undefined ? {} : { h }) };
}

export type AlignMode = 'left' | 'center' | 'right';

export function alignFrame(f: CanvasFrame, device: CanvasDevice, mode: AlignMode): CanvasFrame {
  const sw = stageWidth(device);
  const x = mode === 'left' ? 0 : mode === 'right' ? sw - f.w : Math.round((sw - f.w) / 2);
  return clampFrame({ ...f, x }, device);
}

export type ZMode = 'front' | 'back' | 'up' | 'down';

/** Меняет порядок слоёв и нормализует z в 1..N */
export function reorderZ(frames: Record<string, CanvasFrame>, id: string, mode: ZMode): Record<string, CanvasFrame> {
  const ids = Object.keys(frames).sort((a, b) => frames[a].z - frames[b].z || a.localeCompare(b));
  const i = ids.indexOf(id);
  if (i === -1) return frames;
  ids.splice(i, 1);
  let to: number;
  if (mode === 'front') to = ids.length;
  else if (mode === 'back') to = 0;
  else if (mode === 'up') to = Math.min(ids.length, i + 1);
  else to = Math.max(0, i - 1);
  ids.splice(to, 0, id);
  const next: Record<string, CanvasFrame> = {};
  ids.forEach((k, idx) => {
    next[k] = { ...frames[k], z: idx + 1 };
  });
  return next;
}

/** Вставляет раскладку устройства в конфиг, не мутируя исходный */
export function withDeviceLayout(config: BioConfig, device: CanvasDevice, layout: CanvasDeviceLayout): BioConfig {
  const base: CanvasLayout = config.canvas ?? { enabled: false, snap: true, grid: DEFAULT_GRID };
  // фиксируем и вторую раскладку, чтобы она не «поплыла» после добавления блоков
  return { ...config, canvas: { ...base, [device]: layout } };
}

// ─────────────── Серверная валидация ───────────────

const ID_RE = /^[a-zA-Z0-9:_.-]{1,80}$/;

function num(v: unknown, min: number, max: number): number | undefined {
  if (typeof v !== 'number' || !Number.isFinite(v)) return undefined;
  return Math.min(max, Math.max(min, v));
}

function sanitizeFrame(raw: unknown): CanvasFrame | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const x = num(r.x, -500, 2000);
  const y = num(r.y, -500, 8000);
  const w = num(r.w, 8, 2000);
  if (x === undefined || y === undefined || w === undefined) return null;
  const frame: CanvasFrame = { x: Math.round(x), y: Math.round(y), w: Math.round(w), z: Math.round(num(r.z, 0, 1000) ?? 1) };
  const h = num(r.h, 4, 4000);
  if (h !== undefined) frame.h = Math.round(h);
  const rotate = num(r.rotate, -360, 360);
  if (rotate !== undefined && rotate !== 0) frame.rotate = Math.round(rotate);
  if (r.hidden === true) frame.hidden = true;
  if (r.locked === true) frame.locked = true;
  return frame;
}

function sanitizeDevice(raw: unknown): CanvasDeviceLayout | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const r = raw as Record<string, unknown>;
  const framesRaw = r.frames;
  if (!framesRaw || typeof framesRaw !== 'object' || Array.isArray(framesRaw)) return undefined;
  const frames: Record<string, CanvasFrame> = {};
  let count = 0;
  for (const [key, value] of Object.entries(framesRaw as Record<string, unknown>)) {
    if (count >= MAX_FRAMES) break;
    if (!ID_RE.test(key)) continue;
    const f = sanitizeFrame(value);
    if (!f) continue;
    frames[key] = f;
    count++;
  }
  return { height: Math.round(num(r.height, 200, 8000) ?? MIN_STAGE_H), frames };
}

/** Приводит клиентский canvas к безопасному виду; undefined — убрать поле */
export function sanitizeCanvas(raw: unknown): CanvasLayout | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const r = raw as Record<string, unknown>;
  const out: CanvasLayout = {
    enabled: r.enabled === true,
    snap: r.snap !== false,
    grid: clampInt(typeof r.grid === 'number' ? r.grid : DEFAULT_GRID, 4, 64),
  };
  const desktop = sanitizeDevice(r.desktop);
  const mobile = sanitizeDevice(r.mobile);
  if (desktop) out.desktop = desktop;
  if (mobile) out.mobile = mobile;
  return out;
}

/** Включает свободный режим; раскладка ПК фиксируется по текущей странице, телефон остаётся автоматическим */
export function enableCanvas(config: BioConfig): BioConfig {
  const base: CanvasLayout = config.canvas ?? { enabled: true, snap: true, grid: DEFAULT_GRID };
  return { ...config, canvas: { ...base, enabled: true, desktop: base.desktop ?? reconcileDevice(config, 'desktop') } };
}

/** Сбрасывает раскладку устройства к автоматической */
export function resetDeviceLayout(config: BioConfig, device: CanvasDevice): BioConfig {
  if (!config.canvas) return config;
  const { [device]: _removed, ...rest } = config.canvas;
  return { ...config, canvas: { ...rest, enabled: config.canvas.enabled, snap: config.canvas.snap, grid: config.canvas.grid } };
}
