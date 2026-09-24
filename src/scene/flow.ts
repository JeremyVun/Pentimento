import type { SceneConfig } from './config';
import { A, WALL_Y, gardenRight, riverBanks } from './geometry';

/**
 * Encodes how brush strokes behave in each region. R,G: drift direction and speed (0.5 = still).
 * B: preferred stroke angle, where 0 means "follow the edges in the scene".
 */
export function drawFlow(ctx: CanvasRenderingContext2D, H: number, c: SceneConfig): void {
  const enc = (dx: number, dy: number, angle: number | null) => {
    const r = Math.round(128 + Math.max(-1, Math.min(1, dx)) * 127);
    const g = Math.round(128 + Math.max(-1, Math.min(1, dy)) * 127);
    const b = angle === null ? 0 : Math.max(2, Math.round((angle / Math.PI + 0.5) * 255));
    return `rgb(${r},${g},${b})`;
  };
  ctx.save();
  ctx.setTransform(H, 0, 0, H, 0, 0);
  ctx.fillStyle = enc(0, 0, null);
  ctx.fillRect(-0.1, -0.1, A + 0.2, 1.2);

  const wind = c.wind;
  ctx.fillStyle = enc(0.35 * wind + 0.08, 0, c.window ? null : -0.12);
  ctx.fillRect(-0.1, -0.1, A + 0.2, 0.47);

  const flood = !!c.flood;
  const { left, right } = riverBanks(flood);
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (const p of left) ctx.lineTo(p[0], p[1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
  const k = flood ? 1 : 0.55;
  ctx.fillStyle = enc(0.35 * k, 0.9 * k, 0.02);
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(-0.1, WALL_Y + 0.02);
  for (let y = WALL_Y + 0.02; y <= 1.1; y += 0.04) ctx.lineTo(gardenRight(y), y);
  ctx.lineTo(-0.1, 1.1);
  ctx.closePath();
  ctx.fillStyle = enc(0.02 * wind, 0, c.snow ? 0.08 : -1.35);
  ctx.fill();

  if (c.window) {
    ctx.fillStyle = enc(0, 0, null);
    ctx.fillRect(-0.1, 0.86, A + 0.2, 0.3);
  }
  ctx.restore();
}
