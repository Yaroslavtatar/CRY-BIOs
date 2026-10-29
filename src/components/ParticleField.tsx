import React, { useEffect, useRef } from 'react';
import {
  FX_PRESETS, clampSettings, createParticle, stepParticle, isDead, nextWind, targetCount, pickColor,
  type FxSettings, type Particle, type FxEnv,
} from '../fx/engine';
import { drawParticle } from '../fx/draw';

interface ParticleFieldProps {
  settings: FxSettings;
  className?: string;
  style?: React.CSSProperties;
  /** Ограничение частоты кадров (мини-превью в меню) */
  fps?: number;
  /** Откуда брать курсор: окно, родительский элемент или не отслеживать */
  interactive?: 'window' | 'parent' | 'none';
  /** Рождать частицы внутри прямоугольника, отступая от краёв поля (ауры вокруг ника) */
  boxInset?: { x: number; y: number };
}

/**
 * Живое поле частиц на canvas. Размер берётся из реального размера элемента (а не окна браузера) и
 * учитывает devicePixelRatio, поэтому картинка чёткая и не растягивается, в том числе в предпросмотре.
 * Изменение настроек подхватывается на лету без перезапуска анимации.
 */
export default function ParticleField({ settings, className = '', style, fps, interactive = 'none', boxInset }: ParticleFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const settingsRef = useRef(settings);
  const boxRef = useRef(boxInset);
  settingsRef.current = settings;
  boxRef.current = boxInset;

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    const rng = Math.random;
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    let w = 0;
    let h = 0;
    let particles: Particle[] = [];
    let wind = settingsRef.current.wind;
    let mouse: { x: number; y: number } | null = null;
    let raf = 0;
    let last = 0;
    let lastDraw = 0;
    let visible = true;
    let typeKey = '';
    let colorKey = '';
    let shapeKey = '';

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = Math.max(1, Math.round(rect.width));
      h = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const makeEnv = (): FxEnv => {
      const b = boxRef.current;
      return {
        w, h, wind, mouse, reducedMotion,
        box: b ? { x: b.x, y: b.y, w: Math.max(2, w - b.x * 2), h: Math.max(2, h - b.y * 2) } : undefined,
      };
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      if (!visible || w === 0) return;
      if (fps && now - lastDraw < 1000 / fps - 2) return;
      const dt = Math.min(2.5, Math.max(0, (now - (last || now)) / 16.667));
      last = now;
      lastDraw = now;

      const s = clampSettings(settingsRef.current);
      const preset = FX_PRESETS[s.type] ?? FX_PRESETS.snow;
      const speedK = reducedMotion ? 0.5 : 1;
      const eff = reducedMotion ? { ...s, speed: s.speed * speedK } : s;

      // Смена типа/размера/скорости/направления — частицы создаются заново; смена цвета — перекрашиваются на месте
      const tk = s.type;
      const sk = `${s.size}|${s.speed}|${s.reverse}|${s.sway}`;
      const ck = `${s.colorMode}|${s.color}|${(s.palette || []).join(',')}`;
      if (tk !== typeKey || sk !== shapeKey) {
        particles = [];
        typeKey = tk;
        shapeKey = sk;
        colorKey = ck;
      } else if (ck !== colorKey) {
        colorKey = ck;
        for (const p of particles) p.color = pickColor(preset, s, rng);
      }

      wind = nextWind(wind, s, mouse ? mouse.x : null, w, dt);
      const env = makeEnv();

      const want = targetCount(preset, s, w, h, reducedMotion);
      while (particles.length < want) particles.push(createParticle(preset, eff, env, rng, true));
      if (particles.length > want) particles.length = want;

      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = preset.additive ? 'lighter' : 'source-over';
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];
        stepParticle(p, preset, eff, env, rng, dt);
        if (isDead(p, preset, env)) {
          particles[i] = createParticle(preset, eff, env, rng, false);
          continue;
        }
        drawParticle(ctx, p, preset);
      }
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    resize();
    raf = requestAnimationFrame(frame);

    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(canvas);
    const io = typeof IntersectionObserver !== 'undefined'
      ? new IntersectionObserver(([e]) => { visible = e.isIntersecting; }, { threshold: 0 })
      : null;
    io?.observe(canvas);

    const toLocal = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect();
      mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
    };
    const clear = () => { mouse = null; };
    const target: EventTarget | null = interactive === 'window' ? window : interactive === 'parent' ? canvas.parentElement : null;
    target?.addEventListener('pointermove', toLocal as EventListener);
    if (interactive === 'window') document.addEventListener('mouseleave', clear);
    else target?.addEventListener('pointerleave', clear);

    return () => {
      cancelAnimationFrame(raf);
      ro?.disconnect();
      io?.disconnect();
      target?.removeEventListener('pointermove', toLocal as EventListener);
      document.removeEventListener('mouseleave', clear);
      target?.removeEventListener('pointerleave', clear);
    };
  }, [interactive, fps]);

  return <canvas ref={canvasRef} className={`pointer-events-none ${className}`} style={style} aria-hidden />;
}
