import React, { useEffect, useRef } from 'react';
import { SparkleStyle } from '../types';

interface SparkleCanvasProps {
  enabled: boolean;
  entered: boolean;
  style?: SparkleStyle;
  color?: string;
  intensity?: 'low' | 'medium' | 'high';
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  char?: string;
}

const CHARS: Record<SparkleStyle, string[]> = {
  stars: ['✦', '✧', '★', '•'],
  dots: ['•', '·', '●'],
  hearts: ['♥', '♡'],
  crosses: ['+', '×', '✚'],
  neon: ['◆', '◇', '▪'],
};

export default function SparkleCanvas({
  enabled,
  entered,
  style = 'stars',
  color = '#00f2ff',
  intensity = 'medium',
}: SparkleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    if (!enabled || !entered) return;

    const spawnRate = intensity === 'low' ? 0.08 : intensity === 'high' ? 0.35 : 0.18;
    const maxParticles = intensity === 'low' ? 40 : intensity === 'high' ? 120 : 70;

    const onMove = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
      if (Math.random() > spawnRate) return;
      const chars = CHARS[style] || CHARS.stars;
      particlesRef.current.push({
        x: e.clientX + (Math.random() - 0.5) * 20,
        y: e.clientY + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 2,
        vy: -Math.random() * 2 - 0.5,
        life: 1,
        maxLife: 0.4 + Math.random() * 0.5,
        size: 8 + Math.random() * 8,
        char: chars[Math.floor(Math.random() * chars.length)],
      });
      if (particlesRef.current.length > maxParticles) {
        particlesRef.current = particlesRef.current.slice(-maxParticles);
      }
    };

    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, [enabled, entered, style, intensity]);

  useEffect(() => {
    if (!enabled || !entered || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particlesRef.current = particlesRef.current.filter((p) => {
        p.life -= 0.016 / p.maxLife;
        if (p.life <= 0) return false;
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.04;

        const alpha = p.life;
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = color;
        ctx.font = `${p.size}px sans-serif`;
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillText(p.char || '✦', p.x, p.y);
        ctx.restore();
        return true;
      });
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [enabled, entered, color]);

  if (!enabled || !entered) return null;

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[45]"
      aria-hidden
    />
  );
}
