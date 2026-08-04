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

  const animatedBg = ['matrix', 'stars', 'rain', 'particles', 'snow', 'aurora', 'plasma', 'dither'].includes(config.bgType);

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

    let auroraPhase = 0;
    let plasmaTime = 0;

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
      } else if (config.bgType === 'aurora') {
        auroraPhase += 0.008;
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, `hsla(${(auroraPhase * 40) % 360}, 70%, 45%, 0.35)`);
        grad.addColorStop(0.5, `${effectColor}55`);
        grad.addColorStop(1, `hsla(${(auroraPhase * 40 + 120) % 360}, 70%, 45%, 0.35)`);
        ctx.fillStyle = 'rgba(5, 4, 10, 0.85)';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = grad;
        ctx.fillRect(0, height * 0.2, width, height * 0.6);
      } else if (config.bgType === 'plasma') {
        plasmaTime += 0.02;
        const intensity = config.bgEffectIntensity || 1;
        const img = ctx.createImageData(Math.ceil(width / 4), Math.ceil(height / 4));
        for (let i = 0; i < img.data.length; i += 4) {
          const x = (i / 4) % img.width;
          const y = Math.floor(i / 4 / img.width);
          const v =
            Math.sin(x * 0.05 + plasmaTime) +
            Math.sin(y * 0.05 + plasmaTime * 1.3) +
            Math.sin((x + y) * 0.03 + plasmaTime * 0.7);
          const c = Math.floor(((v + 3) / 6) * 180 * intensity);
          img.data[i] = c * 0.2;
          img.data[i + 1] = c * 0.8;
          img.data[i + 2] = c;
          img.data[i + 3] = 90;
        }
        ctx.putImageData(img, 0, 0);
        ctx.drawImage(canvas, 0, 0, width / 4, height / 4, 0, 0, width, height);
      } else if (config.bgType === 'dither') {
        ctx.fillStyle = config.bgValue || '#0a0910';
        ctx.fillRect(0, 0, width, height);
        const step = 4;
        for (let y = 0; y < height; y += step) {
          for (let x = 0; x < width; x += step) {
            const dither = ((x + y) / step) % 2 === 0 ? 0.08 : 0.03;
            ctx.fillStyle = `${effectColor}${Math.floor(dither * 255).toString(16).padStart(2, '0')}`;
            ctx.fillRect(x, y, step, step);
          }
        }
      }

      animId = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
    };
  }, [entered, config.bgType, config.primaryColor, config.bgEffectColor, config.bgEffectIntensity, config.bgValue, animatedBg]);

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
