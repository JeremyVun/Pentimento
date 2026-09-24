import type { SceneConfig } from './config';
import { drawScene } from './draw';

const MIN_STROKE = 0.008;
const MIN_ALPHA = 0.55;
const RADIAL = { addColorStop() {} };

function alphaOf(v: unknown): number {
  if (typeof v !== 'string' || !v.startsWith('rgba')) return 1;
  const m = v.match(/[\d.]+/g);
  return m && m.length >= 4 ? Number(m[3]) : 1;
}

/**
 * Draws the scene's paint regions: the real scene, with every shape recoloured to the id of the
 * region it belongs to (red channel = id * 16). Glows, faint washes and hairlines are left out,
 * so a region is exactly the shapes that make it up.
 */
export function drawRegions(ctx: CanvasRenderingContext2D, H: number, c: SceneConfig): void {
  let current = 'rgb(0,0,0)';
  const clear = 'rgba(0,0,0,0)';
  const proxy = new Proxy(ctx, {
    get(target, prop) {
      if (prop === 'createRadialGradient') return () => RADIAL;
      if (prop === 'stroke') {
        return () => { if (target.lineWidth >= MIN_STROKE) target.stroke(); };
      }
      const v = Reflect.get(target, prop, target);
      return typeof v === 'function' ? v.bind(target) : v;
    },
    set(target, prop, value) {
      if (prop === 'fillStyle' || prop === 'strokeStyle') {
        const faint = value === RADIAL || alphaOf(value) < MIN_ALPHA;
        (target as unknown as Record<string, unknown>)[prop] = faint ? clear : current;
        return true;
      }
      if (prop === 'globalAlpha') return true;
      return Reflect.set(target, prop, value, target);
    },
  });
  ctx.save();
  ctx.fillStyle = 'rgb(0,0,0)';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.imageSmoothingEnabled = false;
  drawScene(proxy, H, {
    cfg: c,
    t: 0,
    sketch: true,
    woke: {},
    region: (id) => { current = id ? `rgb(${id * 16},0,0)` : clear; },
  });
  ctx.restore();
}
