import { useEffect, useRef } from 'react';
import type { NameEffect } from '../types';

const SPARK_EFFECTS = new Set<NameEffect>([
  'sparks_blue',
  'sparks_yellow',
  'sparks_pink',
  'sparks_red',
  'sparks_white',
  'sparks_gold',
]);

const SPARK_PALETTES: Record<string, string[]> = {
  sparks_blue: ['#6366f1', '#818cf8', '#a855f7', '#60a5fa'],
  sparks_yellow: ['#fbbf24', '#facc15', '#84cc16', '#fde047'],
  sparks_pink: ['#ec4899', '#f472b6', '#fb7185', '#fda4af'],
  sparks_red: ['#ef4444', '#f87171', '#dc2626', '#fb923c'],
  sparks_white: ['#ffffff', '#e5e7eb', '#d1d5db', '#f3f4f6'],
  sparks_gold: ['#fbbf24', '#f59e0b', '#fcd34d', '#fde68a'],
};

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
}

interface NameSparkOverlayProps {
  effect?: NameEffect;
  className?: string;
}

export function isSparkNameEffect(effect?: NameEffect): boolean {
  return !!effect && SPARK_EFFECTS.has(effect);
}

export default function NameSparkOverlay({ effect, className = '' }: NameSparkOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!effect || !SPARK_EFFECTS.has(effect)) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const palette = SPARK_PALETTES[effect] || SPARK_PALETTES.sparks_blue;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId = 0;
    let particles: Particle[] = [];
    let width = 0;
    let height = 0;

    const resize = () => {
      const rect = container.getBoundingClientRect();
      width = Math.max(rect.width + 40, 80);
      height = Math.max(rect.height + 30, 48);
      canvas.width = width * devicePixelRatio;
      canvas.height = height * devicePixelRatio;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    };

    const spawnParticle = (): Particle => {
      const maxLife = reducedMotion ? 999 : 40 + Math.random() * 50;
      return {
        x: width * (0.15 + Math.random() * 0.7),
        y: height * (0.55 + Math.random() * 0.35),
        vx: (Math.random() - 0.5) * (reducedMotion ? 0.1 : 0.6),
        vy: -0.3 - Math.random() * (reducedMotion ? 0.2 : 0.8),
        size: 1 + Math.random() * 2.5,
        color: palette[Math.floor(Math.random() * palette.length)],
        life: maxLife,
        maxLife,
      };
    };

    const targetCount = reducedMotion ? 18 : 38;
    particles = Array.from({ length: targetCount }, spawnParticle);

    const tick = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        if (!reducedMotion) {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.015;
          p.life -= 1;
        }

        const alpha = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = alpha * 0.85;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        if (p.life <= 0 || p.y < -4 || p.x < -8 || p.x > width + 8) {
          particles[i] = spawnParticle();
        }
      }

      ctx.globalAlpha = 1;
      animationId = requestAnimationFrame(tick);
    };

    resize();
    tick();

    const observer = new ResizeObserver(resize);
    observer.observe(container);

    return () => {
      cancelAnimationFrame(animationId);
      observer.disconnect();
    };
  }, [effect]);

  if (!effect || !SPARK_EFFECTS.has(effect)) return null;

  return (
    <div
      ref={containerRef}
      className={`pointer-events-none absolute inset-0 -z-10 overflow-visible ${className}`}
      aria-hidden
    >
      <canvas
        ref={canvasRef}
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      />
    </div>
  );
}
