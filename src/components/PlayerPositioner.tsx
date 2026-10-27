import React, { useRef, useState } from 'react';
import { AudioPlayerPos } from '../types';
import { normalizePlayerPos, playerPositionStyle, posFromPointer } from '../playerPosition';

interface PlayerPositionerProps {
  pos?: AudioPlayerPos;
  /** Если задан — плеер можно перетаскивать (режим редактора), результат отдаётся при отпускании */
  onMove?: (pos: AudioPlayerPos) => void;
  children: React.ReactNode;
}

const DRAG_THRESHOLD_PX = 4;

/**
 * Слой на весь экран (fixed inset-0), внутри которого плеер стоит в заданном месте.
 * Слой не перехватывает клики; плеер — перехватывает. В редакторе плеер двигается мышкой/пальцем,
 * а клики по кнопкам внутри остаются рабочими (клик после перетаскивания подавляется).
 */
export default function PlayerPositioner({ pos, onMove, children }: PlayerPositionerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const itemRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ startX: number; startY: number; grabX: number; grabY: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  const [live, setLive] = useState<AudioPlayerPos | null>(null);
  const editable = Boolean(onMove);

  const current = live ?? normalizePlayerPos(pos);

  const geometry = (grab: { x: number; y: number }) => {
    const layer = layerRef.current!.getBoundingClientRect();
    const item = itemRef.current!.getBoundingClientRect();
    return {
      layer: { left: layer.left, top: layer.top, width: layer.width, height: layer.height },
      size: { width: item.width, height: item.height },
      grab,
    };
  };

  const onPointerDown = (e: React.PointerEvent) => {
    justDragged.current = false;
    if (!editable || (e.pointerType === 'mouse' && e.button !== 0)) return;
    const item = itemRef.current!.getBoundingClientRect();
    // Захват указателя НЕ ставим сейчас: иначе click уйдёт на контейнер и кнопки плеера перестанут нажиматься
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      grabX: e.clientX - item.left,
      grabY: e.clientY - item.top,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved) {
      if (Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX) return;
      d.moved = true;
      itemRef.current!.setPointerCapture(e.pointerId); // начали тянуть — теперь можно захватить
    }
    setLive(posFromPointer(e.clientX, e.clientY, geometry({ x: d.grabX, y: d.grabY })));
  };

  const finish = (e: React.PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (itemRef.current?.hasPointerCapture(e.pointerId)) itemRef.current.releasePointerCapture(e.pointerId);
    if (d.moved) {
      // click приходит уже после pointerup — помечаем; флаг снимает сам подавленный click,
      // следующий pointerdown или keydown (без таймеров: от тайминга браузера ничего не зависит)
      justDragged.current = true;
      if (e.type !== 'pointercancel') {
        onMove?.(posFromPointer(e.clientX, e.clientY, geometry({ x: d.grabX, y: d.grabY })));
      }
    }
    setLive(null);
  };

  // Клик, завершающий перетаскивание, не должен нажимать кнопки плеера
  const suppressClickAfterDrag = (e: React.MouseEvent) => {
    if (justDragged.current) {
      justDragged.current = false;
      e.stopPropagation();
      e.preventDefault();
    }
  };

  return (
    <div ref={layerRef} className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={itemRef}
        className={`absolute pointer-events-auto max-w-[calc(100%-0.5rem)] ${editable ? 'cursor-grab active:cursor-grabbing touch-none select-none ring-1 ring-dashed ring-[#00f2ff]/50 rounded-xl' : ''}`}
        style={playerPositionStyle(current)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finish}
        onPointerCancel={finish}
        onClickCapture={suppressClickAfterDrag}
        onKeyDownCapture={() => { justDragged.current = false; }}
        data-testid="player-positioner"
        title={editable ? 'Перетащите плеер' : undefined}
      >
        {children}
      </div>
    </div>
  );
}
