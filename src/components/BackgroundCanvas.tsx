import React, { useEffect, useRef } from 'react';
import { BioConfig } from '../types';

interface BackgroundCanvasProps {
  config: BioConfig;
  entered: boolean;
}

function drawSnow(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  flakes: { x: number; y: number; radius: number; speedY: number; speedX: number; opacity: number }[],
  intensity: 'low' | 'medium' | 'high' = 'medium'
) {
  const mult = intensity === 'low' ? 0.6 : intensity === 'high' ? 1.4 : 1;
  flakes.forEach((sf) => {
    ctx.fillStyle = `rgba(255, 255, 255, ${sf.opacity})`;
    ctx.beginPath();
    ctx.arc(sf.x, sf.y, sf.radius * mult, 0, Math.PI * 2);
    ctx.fill();
    sf.y += sf.speedY * mult;
    sf.x += sf.speedX;
    if (sf.y > height) {
      sf.y = -5;
      sf.x = Math.random() * width;
    }
    if (sf.x > width || sf.x < 0) sf.x = Math.random() * width;
  });
}

export default function BackgroundCanvas({ config, entered }: BackgroundCanvasProps) {
  const bgCanvasRef = useRef<HTMLCanvasElement>(null);
  const snowCanvasRef = useRef<HTMLCanvasElement>(null);

  const animatedBg = ['matrix', 'stars', 'rain', 'particles', 'snow'].includes(config.bgType);

  useEffect(() => {
    if (!entered || !bgCanvasRef.current || !animatedBg) return;

    const canvas = bgCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const effectColor = config.bgEffectColor || config.primaryColor || '#00ffcc';
    const columns = Math.floor(width / 18);
    const matrixDrops = Array(columns).fill(1);
    const matrixChars = '0123456789ABCDEF☣☠⚒⚙';

    const stars = Array.from({ length: 90 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 1.5 + 0.5,
      speed: Math.random() * 0.3 + 0.05,
      alpha: Math.random(),
    }));

    const rainDrops = Array.from({ length: 60 }, () => ({
      x: Math.random() * width,
      y: Math.random() * -height,
      length: Math.random() * 18 + 5,
      speed: Math.random() * 8 + 4,
    }));

    const particles = Array.from({ length: 50 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      size: Math.random() * 2 + 1,
      alpha: Math.random() * 0.5 + 0.2,
    }));

    const snowFlakes = Array.from({ length: 80 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 1,
      speedY: Math.random() * 1.2 + 0.4,
      speedX: Math.random() * 1 - 0.5,
      opacity: Math.random() * 0.6 + 0.4,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);

      if (config.bgType === 'matrix') {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = effectColor;
        ctx.font = '13px monospace';
        for (let i = 0; i < matrixDrops.length; i++) {
          ctx.fillText(matrixChars[Math.floor(Math.random() * matrixChars.length)], i * 18, matrixDrops[i] * 18);
          if (matrixDrops[i] * 18 > height && Math.random() > 0.96) matrixDrops[i] = 0;
          matrixDrops[i]++;
        }
      } else if (config.bgType === 'stars') {
        ctx.fillStyle = config.bgValue || '#0a0910';
        ctx.fillRect(0, 0, width, height);
        stars.forEach((s) => {
          s.alpha += s.speed * 0.05;
          if (s.alpha > 1 || s.alpha < 0) s.speed = -s.speed;
          ctx.fillStyle = `rgba(255,255,255,${Math.max(0.1, Math.min(1, s.alpha))})`;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
          ctx.fill();
          s.x -= 0.15;
          if (s.x < 0) s.x = width;
        });
      } else if (config.bgType === 'rain') {
        ctx.fillStyle = 'rgba(10, 8, 15, 0.45)';
        ctx.fillRect(0, 0, width, height);
        ctx.strokeStyle = effectColor;
        ctx.lineWidth = 1;
        rainDrops.forEach((r) => {
          ctx.beginPath();
          ctx.moveTo(r.x, r.y);
          ctx.lineTo(r.x, r.y + r.length);
          ctx.stroke();
          r.y += r.speed;
          if (r.y > height) {
            r.y = -20;
            r.x = Math.random() * width;
          }
        });
      } else if (config.bgType === 'particles') {
        ctx.fillStyle = 'rgba(10, 8, 15, 0.3)';
        ctx.fillRect(0, 0, width, height);
        particles.forEach((p) => {
          ctx.fillStyle = `${effectColor}${Math.floor(p.alpha * 255).toString(16).padStart(2, '0')}`;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
        });
      } else if (config.bgType === 'snow') {
        ctx.fillStyle = 'rgba(10, 8, 15, 0.45)';
        ctx.fillRect(0, 0, width, height);
        drawSnow(ctx, width, height, snowFlakes, config.snowIntensity || 'medium');
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [entered, config.bgType, config.primaryColor, config.bgEffectColor, config.bgValue, animatedBg]);

  // Snow overlay — independent of bgType
  useEffect(() => {
    if (!entered || !config.snowEffectsEnabled || !snowCanvasRef.current) return;
    if (config.bgType === 'snow') return;

    const canvas = snowCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    const snowFlakes = Array.from({ length: 80 }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 2 + 1,
      speedY: Math.random() * 1.2 + 0.4,
      speedX: Math.random() * 1 - 0.5,
      opacity: Math.random() * 0.6 + 0.4,
    }));

    const draw = () => {
      ctx.clearRect(0, 0, width, height);
      drawSnow(ctx, width, height, snowFlakes, config.snowIntensity || 'medium');
      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [entered, config.snowEffectsEnabled, config.snowIntensity, config.bgType]);

  if (!entered) return null;

  return (
    <>
      {animatedBg && (
        <canvas ref={bgCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-0" />
      )}
      {config.snowEffectsEnabled && config.bgType !== 'snow' && (
        <canvas ref={snowCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none z-[1]" />
      )}
    </>
  );
}
