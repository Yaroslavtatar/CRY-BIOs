import type { FxPreset, Particle } from './engine';

/**
 * Отрисовка частиц на canvas 2D. Мягкие «светящиеся» точки рисуются из заранее подготовленных спрайтов
 * (drawImage быстрее, чем создавать радиальный градиент на каждую частицу в каждом кадре).
 */

const sprites = new Map<string, HTMLCanvasElement>();
const SPRITE = 64;

/** Мягкий круг цвета `color`: плотное ядро и плавный спад к краю */
function glowSprite(color: string, core: number): HTMLCanvasElement {
  const key = `${color}|${core}`;
  const hit = sprites.get(key);
  if (hit) return hit;
  const c = document.createElement('canvas');
  c.width = c.height = SPRITE;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(SPRITE / 2, SPRITE / 2, 0, SPRITE / 2, SPRITE / 2, SPRITE / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(core, 'rgba(255,255,255,0.75)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, SPRITE, SPRITE);
  // перекрашиваем: источник-в-приёмник сохраняет прозрачность градиента и красит в любой CSS-цвет
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = color;
  g.fillRect(0, 0, SPRITE, SPRITE);
  if (sprites.size > 600) sprites.clear();
  sprites.set(key, c);
  return c;
}

function drawGlow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number, core = 0.25) {
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.drawImage(glowSprite(color, core), x - r, y - r, r * 2, r * 2);
}

function starPath(ctx: CanvasRenderingContext2D, R: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const rad = i % 2 === 0 ? R : R * inner;
    const a = (i * Math.PI) / 4 - Math.PI / 2;
    const px = Math.cos(a) * rad;
    const py = Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle, preset: FxPreset): void {
  const a = p.alpha;
  if (a <= 0.01) return;

  switch (preset.shape) {
    case 'flake': {
      const r = p.size;
      if (p.variant < 0.08) {
        // расфокусированные «боке»-хлопья на переднем плане: крупные, почти прозрачные
        drawGlow(ctx, p.x, p.y, r * 3.2, p.color, a * 0.22, 0.05);
        break;
      }
      // белое плотное ядро + мягкий ореол: так хлопья читаются как снег, а не как серые точки
      drawGlow(ctx, p.x, p.y, r * 1.7, p.color, a * 0.55, 0.1);
      drawGlow(ctx, p.x, p.y, r * 0.95, '#ffffff', Math.min(1, a * (p.z > 0.7 ? 1.15 : 0.85)), 0.55);
      if (p.size > 4.2 && p.variant > 0.72) {
        // редкие крупные хлопья — шестилучевой кристалл
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.globalAlpha = a * 0.8;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 0.8;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const ang = (i * Math.PI) / 3;
          const ex = Math.cos(ang) * r * 1.9;
          const ey = Math.sin(ang) * r * 1.9;
          ctx.moveTo(0, 0);
          ctx.lineTo(ex, ey);
          // боковые лучики
          const bx = Math.cos(ang) * r * 1.2;
          const by = Math.sin(ang) * r * 1.2;
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(ang + 0.9) * r * 0.55, by + Math.sin(ang + 0.9) * r * 0.55);
          ctx.moveTo(bx, by);
          ctx.lineTo(bx + Math.cos(ang - 0.9) * r * 0.55, by + Math.sin(ang - 0.9) * r * 0.55);
        }
        ctx.stroke();
        ctx.restore();
      }
      break;
    }
    case 'streak': {
      ctx.globalAlpha = a;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 1.7, p.y - p.vy * 1.7);
      ctx.stroke();
      break;
    }
    case 'leaf': {
      const s = p.size / 2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.3 + 0.7 * Math.abs(Math.cos(p.flip)));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.2);
      ctx.bezierCurveTo(s * 1.1, -s * 0.6, s * 0.9, s * 0.7, 0, s * 1.2);
      ctx.bezierCurveTo(-s * 0.9, s * 0.7, -s * 1.1, -s * 0.6, 0, -s * 1.2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.14)';
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.2);
      ctx.bezierCurveTo(s * 1.1, -s * 0.6, s * 0.9, s * 0.7, 0, s * 1.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(0, -s * 1.2);
      ctx.lineTo(0, s * 1.5);
      ctx.stroke();
      ctx.restore();
      break;
    }
    case 'petal': {
      const s = p.size / 2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(p.flip)));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, s * 1.1);
      ctx.bezierCurveTo(s * 1.15, s * 0.3, s * 0.85, -s * 1.0, 0, -s * 0.65);
      ctx.bezierCurveTo(-s * 0.85, -s * 1.0, -s * 1.15, s * 0.3, 0, s * 1.1);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      ctx.beginPath();
      ctx.ellipse(0, -s * 0.1, s * 0.28, s * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'glow': {
      // светлячки пульсируют, угольки мерцают
      const pulse = preset.id === 'fireflies' ? 0.65 + 0.35 * Math.sin(p.phase * 5) : preset.id === 'embers' ? 0.8 + 0.2 * Math.sin(p.phase * 9) : 1;
      const shrink = preset.id === 'embers' && p.maxLife ? 0.45 + 0.55 * Math.max(0, p.life / p.maxLife) : 1;
      const r = p.size * (preset.id === 'dust' ? 1.8 : 3.2) * shrink;
      drawGlow(ctx, p.x, p.y, r, p.color, a * 0.55 * pulse, 0.12);
      drawGlow(ctx, p.x, p.y, r * 0.42, '#ffffff', a * 0.9 * pulse, 0.5);
      break;
    }
    case 'bubble': {
      const r = p.size / 2;
      ctx.globalAlpha = a * 0.16;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = a * 0.85;
      ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, r * 0.08);
      ctx.stroke();
      ctx.globalAlpha = a * 0.85;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(p.x - r * 0.38, p.y - r * 0.4, r * 0.22, r * 0.13, -0.7, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'confetti': {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.cos(p.flip));
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size * 0.28, p.size, p.size * 0.56);
      ctx.restore();
      break;
    }
    case 'heart': {
      const s = p.size / 2;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.sin(p.phase) * 0.25);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.95);
      ctx.bezierCurveTo(-s * 1.4, s * 0.1, -s * 0.8, -s * 1.0, 0, -s * 0.35);
      ctx.bezierCurveTo(s * 0.8, -s * 1.0, s * 1.4, s * 0.1, 0, s * 0.95);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.beginPath();
      ctx.ellipse(-s * 0.45, -s * 0.2, s * 0.18, s * 0.3, -0.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'star': {
      const tw = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(p.phase * 7));
      drawGlow(ctx, p.x, p.y, p.size * 2.4, p.color, a * tw * 0.35, 0.1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.globalAlpha = a * tw;
      ctx.fillStyle = p.color;
      starPath(ctx, p.size * 1.2, 0.2);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'glitter': {
      // резкая вспышка, когда грань «ловит свет»
      const tw = Math.pow(Math.abs(Math.sin(p.flip * 1.7)), 5);
      drawGlow(ctx, p.x, p.y, p.size * 2.2, p.color, a * (0.12 + tw * 0.5), 0.15);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = a * (0.3 + tw * 0.7);
      ctx.fillStyle = p.color;
      starPath(ctx, p.size * (0.8 + tw * 0.9), 0.18);
      ctx.fill();
      ctx.restore();
      break;
    }
    case 'spark': {
      const len = 3.4;
      const tx = p.x - p.vx * len;
      const ty = p.y - p.vy * len;
      const g = ctx.createLinearGradient(p.x, p.y, tx, ty);
      g.addColorStop(0, p.color);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.globalAlpha = a;
      ctx.strokeStyle = g;
      ctx.lineWidth = p.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      drawGlow(ctx, p.x, p.y, p.size * 3.6, p.color, a * 0.8, 0.2);
      drawGlow(ctx, p.x, p.y, p.size * 1.2, '#ffffff', a, 0.5);
      break;
    }
  }
}
