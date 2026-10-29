import React, { useEffect, useRef } from 'react';
import { SparkleStyle } from '../types';

interface SparkleCanvasProps {
  enabled: boolean;
  entered: boolean;
  style?: SparkleStyle;
  color?: string;
  intensity?: 'low' | 'medium' | 'high';
}

interface Spark {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  char: string;
  spin: number; rot: number;
}

export const SPARKLE_CHARS: Record<SparkleStyle, string[]> = {
  stars: ['✦', '✧', '★', '✶'],
  dots: ['•', '·', '●'],
  hearts: ['♥', '♡', '❤'],
  crosses: ['+', '×', '✚'],
  neon: ['◆', '◇', '▪'],
  snow: ['❄', '❅', '❆', '•'],
  petals: ['✿', '❀', '✾'],
  notes: ['♪', '♫', '♬'],
  bubbles: ['○', '◌', '◯'],
};

/** Шаг между частицами вдоль пути курсора, px */
export const SPARKLE_SPACING = { low: 34, medium: 20, high: 11 } as const;
const MAX = { low: 50, medium: 90, high: 150 } as const;

/** Сколько частиц родить на отрезке пути — по пройденному расстоянию (быстрый курсор не оставляет «дыр»). */
export function sparksForDistance(dist: number, intensity: 'low' | 'medium' | 'high' = 'medium', cap = 8): number {
  return Math.min(cap, Math.floor(dist / SPARKLE_SPACING[intensity]));
}

/**
 * След из искр за курсором/пальцем. Работает на pointer-событиях (мышь + тач), чёткий на retina-экранах,
 * а положение считается относительно самого холста — поэтому в предпросмотре дашборда не «течёт» на весь экран.
 */
export default function SparkleCanvas({ enabled, entered, style = 'stars', color = '#00f2ff', intensity = 'medium' }: SparkleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!enabled || !entered || !canvas || !ctx) return;

    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    const chars = SPARKLE_CHARS[style] || SPARKLE_CHARS.stars;
    let w = 0, h = 0;
    let sparks: Spark[] = [];
    let last: { x: number; y: number } | null = null;
    let raf = 0;
    let prev = 0;

    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = r.width; h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);

    const emit = (x: number, y: number) => {
      sparks.push({
        x: x + (Math.random() - 0.5) * 14,
        y: y + (Math.random() - 0.5) * 14,
        vx: (Math.random() - 0.5) * 1.6,
        vy: -0.3 - Math.random() * 1.1,
        life: 1,
        maxLife: 38 + Math.random() * 40, // кадры
        size: 9 + Math.random() * 10,
        char: chars[Math.floor(Math.random() * chars.length)],
        spin: (Math.random() - 0.5) * 0.12,
        rot: Math.random() * Math.PI,
      });
      const cap = MAX[intensity];
      if (sparks.length > cap) sparks = sparks.slice(-cap);
    };

    const onMove = (e: PointerEvent) => {
      if (reduced) return;
      const r = canvas.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      if (!last) { last = { x, y }; emit(x, y); return; }
      const dx = x - last.x, dy = y - last.y;
      const n = sparksForDistance(Math.hypot(dx, dy), intensity);
      for (let i = 1; i <= n; i++) emit(last.x + (dx * i) / n, last.y + (dy * i) / n);
      if (n > 0) last = { x, y };
    };
    const onLeave = () => { last = null; };

    const draw = (now: number) => {
      raf = requestAnimationFrame(draw);
      const dt = Math.min(2.5, Math.max(0, (now - (prev || now)) / 16.667));
      prev = now;
      ctx.clearRect(0, 0, w, h);
      sparks = sparks.filter((s) => s.life > 0);
      for (const s of sparks) {
        s.life -= dt / s.maxLife;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 0.02 * dt;
        s.rot += s.spin * dt;
        const a = Math.max(0, s.life);
        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.rotate(s.rot);
        ctx.globalAlpha = a;
        ctx.font = `${s.size * (0.6 + 0.4 * a)}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = color;
        ctx.fillText(s.char, 0, 0);
        ctx.restore();
      }
    };
    raf = requestAnimationFrame(draw);

    window.addEventListener('pointermove', onMove);
    document.addEventListener('mouseleave', onLeave);
    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      window.removeEventListener('pointermove', onMove);
      document.removeEventListener('mouseleave', onLeave);
    };
  }, [enabled, entered, style, color, intensity]);

  if (!enabled || !entered) return null;
  return <canvas ref={canvasRef} className="fixed inset-0 w-full h-full pointer-events-none z-[45]" aria-hidden />;
}
