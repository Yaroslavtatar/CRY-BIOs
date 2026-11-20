/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CanvasDeviceLayout, CanvasFrame } from '../types';
import { clampFrame, MIN_FRAME_H, MIN_FRAME_W, snapValue, stageWidth, type CanvasDevice } from '../canvasLayout';

export type ResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface CanvasEditorProps {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  /** commit=false — промежуточное значение во время жеста, true — жест закончен (запись в историю) */
  onChangeFrame: (id: string, patch: Partial<CanvasFrame>, commit: boolean) => void;
  snap: boolean;
  grid: number;
  showGrid: boolean;
  /** Крупные ручки изменения размера */
  largeHandles?: boolean;
  labelFor: (id: string) => string;
}

interface CanvasStageProps {
  device: CanvasDevice;
  layout: CanvasDeviceLayout;
  renderElement: (id: string) => React.ReactNode;
  editor?: CanvasEditorProps;
  className?: string;
}

interface Gesture {
  kind: 'move' | 'resize';
  id: string;
  handle?: ResizeHandle;
  startX: number;
  startY: number;
  rect: { x: number; y: number; w: number; h: number };
}

const SNAP_THRESHOLD = 6;
const PAD_BOTTOM_VIEW = 64;
const PAD_BOTTOM_EDIT = 220;

const HANDLES: { id: ResizeHandle; style: React.CSSProperties; cursor: string }[] = [
  { id: 'nw', style: { left: 0, top: 0 }, cursor: 'nwse-resize' },
  { id: 'n', style: { left: '50%', top: 0 }, cursor: 'ns-resize' },
  { id: 'ne', style: { left: '100%', top: 0 }, cursor: 'nesw-resize' },
  { id: 'e', style: { left: '100%', top: '50%' }, cursor: 'ew-resize' },
  { id: 'se', style: { left: '100%', top: '100%' }, cursor: 'nwse-resize' },
  { id: 's', style: { left: '50%', top: '100%' }, cursor: 'ns-resize' },
  { id: 'sw', style: { left: 0, top: '100%' }, cursor: 'nesw-resize' },
  { id: 'w', style: { left: 0, top: '50%' }, cursor: 'ew-resize' },
];

function isCoarsePointer(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
}

/**
 * Сцена с абсолютно позиционированными элементами. Логический размер сцены фиксирован
 * (960 для ПК, 390 для телефона) и масштабируется под ширину контейнера, поэтому
 * страница выглядит одинаково везде. С параметром `editor` включается перетаскивание и изменение размеров.
 */
export default function CanvasStage({ device, layout, renderElement, editor, className = '' }: CanvasStageProps) {
  const sw = stageWidth(device);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(sw);
  const [measuredBottom, setMeasuredBottom] = useState<number | null>(null);
  const [guideX, setGuideX] = useState<number | null>(null);
  const elRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const gestureRef = useRef<Gesture | null>(null);
  const coarse = useMemo(isCoarsePointer, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const read = () => setContainerW(el.clientWidth || sw);
    read();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [sw]);

  const maxScale = device === 'mobile' ? 1.6 : 1;
  const scale = Math.max(0.2, Math.min(maxScale, containerW / sw));

  // Свежие значения для обработчиков окна
  const live = useRef({ scale, editor, device, layout });
  live.current = { scale, editor, device, layout };

  const frames = layout.frames;
  const ids = useMemo(() => Object.keys(frames).sort((a, b) => frames[a].z - frames[b].z), [frames]);

  // Нижняя граница реального содержимого — по ней считается высота страницы
  useLayoutEffect(() => {
    let bottom = 0;
    for (const id of ids) {
      const f = frames[id];
      const el = elRefs.current.get(id);
      if (!f || f.hidden || !el) continue;
      bottom = Math.max(bottom, f.y + el.offsetHeight);
    }
    setMeasuredBottom((prev) => (prev === bottom ? prev : bottom));
  });

  const stageH = measuredBottom && measuredBottom > 0
    ? Math.round(measuredBottom + (editor ? PAD_BOTTOM_EDIT : PAD_BOTTOM_VIEW))
    : layout.height;

  const onWindowMove = useCallback((e: PointerEvent) => {
    const g = gestureRef.current;
    const { scale: s, editor: ed, device: dev } = live.current;
    if (!g || !ed) return;
    const dx = (e.clientX - g.startX) / s;
    const dy = (e.clientY - g.startY) / s;
    const stageW = stageWidth(dev);
    const { snap, grid } = ed;
    const r = g.rect;

    if (g.kind === 'move') {
      let x = r.x + dx;
      let y = r.y + dy;
      let guide: number | null = null;
      if (snap) {
        x = snapValue(x, grid, true);
        y = snapValue(y, grid, true);
        const candidates = [0, Math.round((stageW - r.w) / 2), stageW - r.w];
        for (const c of candidates) {
          if (Math.abs(x - c) <= SNAP_THRESHOLD) {
            x = c;
            if (c === candidates[1]) guide = stageW / 2;
            break;
          }
        }
      }
      setGuideX(guide);
      const next = clampFrame({ x, y, w: r.w, z: 0 }, dev);
      ed.onChangeFrame(g.id, { x: Math.round(next.x), y: Math.round(next.y) }, false);
      return;
    }

    // resize
    const hd = g.handle!;
    let L = r.x;
    let T = r.y;
    let R = r.x + r.w;
    let B = r.y + r.h;
    if (hd.includes('w')) L = snapValue(r.x + dx, grid, snap);
    if (hd.includes('e')) R = snapValue(r.x + r.w + dx, grid, snap);
    if (hd.includes('n')) T = snapValue(r.y + dy, grid, snap);
    if (hd.includes('s')) B = snapValue(r.y + r.h + dy, grid, snap);
    if (hd.includes('w')) L = Math.min(L, R - MIN_FRAME_W);
    if (hd.includes('e')) R = Math.max(R, L + MIN_FRAME_W);
    if (hd.includes('n')) T = Math.min(T, B - MIN_FRAME_H);
    if (hd.includes('s')) B = Math.max(B, T + MIN_FRAME_H);
    L = Math.max(0, L);
    R = Math.min(stageW, R);
    T = Math.max(0, T);
    const patch: Partial<CanvasFrame> = { x: Math.round(L), w: Math.round(R - L) };
    if (hd.includes('n') || hd.includes('s')) {
      patch.y = Math.round(T);
      patch.h = Math.round(B - T);
    }
    ed.onChangeFrame(g.id, patch, false);
  }, []);

  const onWindowUp = useCallback(() => {
    const g = gestureRef.current;
    window.removeEventListener('pointermove', onWindowMove);
    window.removeEventListener('pointerup', onWindowUp);
    window.removeEventListener('pointercancel', onWindowUp);
    gestureRef.current = null;
    setGuideX(null);
    if (g) live.current.editor?.onChangeFrame(g.id, {}, true);
  }, [onWindowMove]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', onWindowMove);
    window.removeEventListener('pointerup', onWindowUp);
    window.removeEventListener('pointercancel', onWindowUp);
  }, [onWindowMove, onWindowUp]);

  const beginGesture = (e: React.PointerEvent, id: string, kind: Gesture['kind'], handle?: ResizeHandle) => {
    const f = frames[id];
    const el = elRefs.current.get(id);
    if (!f || !el) return;
    // Если предыдущий жест не закончился (потерянный pointerup), завершаем его до начала нового
    if (gestureRef.current) onWindowUp();
    gestureRef.current = {
      kind,
      id,
      handle,
      startX: e.clientX,
      startY: e.clientY,
      rect: { x: f.x, y: f.y, w: f.w, h: f.h ?? el.offsetHeight },
    };
    window.addEventListener('pointermove', onWindowMove);
    window.addEventListener('pointerup', onWindowUp);
    window.addEventListener('pointercancel', onWindowUp);
  };

  const onFramePointerDown = (e: React.PointerEvent, id: string) => {
    if (!editor) return;
    e.stopPropagation();
    const wasSelected = editor.selectedId === id;
    editor.onSelect(id);
    wrapRef.current?.focus({ preventScroll: true });
    if (frames[id]?.locked) return;
    // На тач-экране первое касание только выбирает элемент, чтобы страницу можно было листать
    if (e.pointerType === 'touch' && !wasSelected) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    beginGesture(e, id, 'move');
  };

  const onHandlePointerDown = (e: React.PointerEvent, id: string, handle: ResizeHandle) => {
    e.stopPropagation();
    e.preventDefault();
    if (frames[id]?.locked) return;
    beginGesture(e, id, 'resize', handle);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!editor || !editor.selectedId) return;
    const f = frames[editor.selectedId];
    if (!f || f.locked) return;
    const step = e.shiftKey ? editor.grid : 1;
    let dx = 0;
    let dy = 0;
    if (e.key === 'ArrowLeft') dx = -step;
    else if (e.key === 'ArrowRight') dx = step;
    else if (e.key === 'ArrowUp') dy = -step;
    else if (e.key === 'ArrowDown') dy = step;
    else if (e.key === 'Escape') {
      editor.onSelect(null);
      return;
    } else return;
    e.preventDefault();
    const next = clampFrame({ ...f, x: f.x + dx, y: f.y + dy }, device);
    editor.onChangeFrame(editor.selectedId, { x: next.x, y: next.y }, true);
  };

  const handleSize = (coarse || editor?.largeHandles ? 28 : 12) / scale;

  return (
    <div
      ref={wrapRef}
      className={`relative w-full outline-none ${className}`}
      style={{ height: stageH * scale }}
      tabIndex={editor ? 0 : undefined}
      onKeyDown={editor ? onKeyDown : undefined}
      onPointerDown={editor ? () => editor.onSelect(null) : undefined}
      data-canvas-device={device}
    >
      <div
        className="absolute top-0"
        style={{
          width: sw,
          height: stageH,
          left: Math.max(0, (containerW - sw * scale) / 2),
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          ...(editor?.showGrid
            ? {
                backgroundImage:
                  'linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)',
                backgroundSize: `${editor.grid}px ${editor.grid}px`,
              }
            : {}),
        }}
      >
        {editor && <div aria-hidden className="absolute inset-y-0 left-0 w-px bg-white/20 pointer-events-none" />}
        {editor && <div aria-hidden className="absolute inset-y-0 right-0 w-px bg-white/20 pointer-events-none" />}
        {guideX !== null && <div aria-hidden className="absolute inset-y-0 w-px bg-cyan-400/80 pointer-events-none z-[2000]" style={{ left: guideX }} />}

        {ids.map((id) => {
          const f = frames[id];
          if (!f || (f.hidden && !editor)) return null;
          const selected = editor?.selectedId === id;
          return (
            <div
              key={id}
              ref={(el) => {
                if (el) elRefs.current.set(id, el);
                else elRefs.current.delete(id);
              }}
              data-canvas-id={id}
              style={{
                position: 'absolute',
                left: f.x,
                top: f.y,
                width: f.w,
                height: f.h,
                zIndex: f.z,
                transform: f.rotate ? `rotate(${f.rotate}deg)` : undefined,
                transformOrigin: 'center',
                opacity: f.hidden ? 0.25 : undefined,
                touchAction: editor ? (selected ? 'none' : 'pan-y') : undefined,
              }}
              onPointerDown={editor ? (e) => onFramePointerDown(e, id) : undefined}
            >
              <div className={`w-full ${f.h !== undefined ? 'h-full' : ''} flex flex-col items-center ${editor ? 'pointer-events-none select-none' : ''}`}>
                {renderElement(id)}
              </div>

              {editor && (
                <>
                  <div
                    aria-hidden
                    className="absolute inset-0"
                    style={{
                      cursor: f.locked ? 'not-allowed' : 'move',
                      outline: selected ? `${2 / scale}px solid #22d3ee` : f.hidden ? `${1 / scale}px dashed rgba(255,255,255,0.4)` : undefined,
                      outlineOffset: 0,
                    }}
                  />
                  {selected && (
                    <div
                      className="absolute left-0 pointer-events-none whitespace-nowrap font-mono font-bold text-black bg-cyan-400 rounded-sm"
                      style={{ bottom: '100%', marginBottom: 4 / scale, fontSize: 11 / scale, padding: `${2 / scale}px ${6 / scale}px` }}
                    >
                      {editor.labelFor(id)}
                      {f.locked ? ' 🔒' : ''}
                    </div>
                  )}
                  {selected && !f.locked &&
                    HANDLES.map((h) => (
                      <div
                        key={h.id}
                        onPointerDown={(e) => onHandlePointerDown(e, id, h.id)}
                        className="absolute bg-white border-cyan-400 rounded-full"
                        style={{
                          ...h.style,
                          width: handleSize,
                          height: handleSize,
                          marginLeft: -handleSize / 2,
                          marginTop: -handleSize / 2,
                          borderWidth: 2 / scale,
                          cursor: h.cursor,
                          touchAction: 'none',
                          zIndex: 3000,
                        }}
                      />
                    ))}
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
