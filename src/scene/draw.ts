import { SceneConfig, Palette } from './config';
import { A, BRIDGE, FIG_BASE, REGION, WALL_Y, WILLOW_BASE, gardenRight, riverBanks, riverSpan } from './geometry';
import {
  Pt, circle, clamp, css, ellipse, hash, hex, lerp, mixHex, mixRGB, mulberry, poly, shade, smooth, withAlpha, xAtY,
} from './util';
import { drawBirds, drawBridgeFigures, drawGardenFigures, drawRiverFigures, drawTrain, drawWeather, drawWindow, ferryX } from './actors';

export interface Frame {
  cfg: SceneConfig;
  t: number;
  sketch: boolean;
  /** Seconds since each subject woke, or undefined if it hasn't. */
  woke: Record<string, number | undefined>;
  /** Set only when drawing the region map: called with the region each element belongs to. */
  region?: (id: number) => void;
}

export function drawScene(ctx: CanvasRenderingContext2D, H: number, f: Frame): void {
  ctx.save();
  ctx.setTransform(H, 0, 0, H, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const c = f.cfg;

  const R = f.region ?? (() => {});
  R(REGION.sky);
  sky(ctx, f);
  clouds(ctx, f);
  R(REGION.hills);
  hills(ctx, c.pal, c);
  drawTrain(ctx, f);
  R(REGION.fields);
  farBank(ctx, c.pal, c);
  R(REGION.rightBank);
  rightLand(ctx, f);
  R(REGION.town);
  town(ctx, f);
  R(REGION.nearBank);
  nearBank(ctx, f);
  R(REGION.river);
  river(ctx, f);
  if (c.mist && !f.sketch) mist(ctx, f, 0.5, 0.64);
  R(REGION.bridge);
  bridge(ctx, f);
  R(REGION.river);
  ferry(ctx, f);
  drawRiverFigures(ctx, f);
  R(REGION.none);
  reeds(ctx, f);
  R(REGION.willow);
  willow(ctx, f);
  R(REGION.garden);
  garden(ctx, f);
  R(REGION.fig);
  fig(ctx, f);
  R(REGION.garden);
  drawGardenFigures(ctx, f);
  if (c.clouds.kind === 'cumulus' && !f.sketch) cloudShadows(ctx, f);
  if (c.mist && !f.sketch) mist(ctx, f, 0.68, 0.74);
  drawBirds(ctx, f);
  drawWeather(ctx, f);
  R(REGION.window);
  if (c.window) drawWindow(ctx, f);
  ctx.restore();
}

export function lightningFlash(t: number): number {
  const a = (t / 7.3 + 0.35) % 1;
  const b = (t / 12.9 + 0.8) % 1;
  const pulse = (x: number) => (x < 0.02 ? 1 - x / 0.02 : 0) + (x > 0.03 && x < 0.045 ? 0.6 : 0);
  return Math.min(1, pulse(a) + pulse(b) * 0.8);
}

function sky(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const P = c.pal;
  const g = ctx.createLinearGradient(0, 0, 0, 0.52);
  g.addColorStop(0, P.sky0);
  g.addColorStop(0.55, P.sky1);
  g.addColorStop(1, P.sky2);
  ctx.fillStyle = g;
  ctx.fillRect(-0.05, -0.05, A + 0.1, 0.62);

  if (c.stars && !f.sketch) {
    for (let i = 0; i < 60; i++) {
      circle(ctx, hash(i) * A, hash(i + 40) * 0.35, 0.0012 + hash(i + 80) * 0.0015, withAlpha('#f0ecd8', 0.6));
    }
  }
  let sunBoost = 0;
  if (c.weather === 'rain' && c.duration > 0) sunBoost = smooth(0.35, 0.7, f.t / c.duration);
  if (c.sun) {
    const s = c.sun;
    const glowR = s.glow * (1 + sunBoost * 0.5);
    const rg = ctx.createRadialGradient(s.x, s.y, s.r * 0.8, s.x, s.y, glowR);
    rg.addColorStop(0, withAlpha(P.sunGlow, 0.85));
    rg.addColorStop(0.25, withAlpha(P.sunGlow, 0.35));
    rg.addColorStop(1, withAlpha(P.sunGlow, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(s.x - glowR, s.y - glowR, glowR * 2, glowR * 2);
    circle(ctx, s.x, s.y, s.r, P.sun);
  }
  if (c.moon) {
    const m = c.moon;
    const rg = ctx.createRadialGradient(m.x, m.y, m.r, m.x, m.y, m.r * 6);
    rg.addColorStop(0, withAlpha(P.sunGlow, 0.45));
    rg.addColorStop(1, withAlpha(P.sunGlow, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(m.x - m.r * 6, m.y - m.r * 6, m.r * 12, m.r * 12);
    circle(ctx, m.x, m.y, m.r, P.sun);
  }
  if (c.lightning && !f.sketch) {
    const fl = lightningFlash(f.t);
    if (fl > 0) {
      ctx.fillStyle = `rgba(190,200,235,${fl * 0.45})`;
      ctx.fillRect(0, 0, A, 0.6);
      const seed = Math.floor(f.t / 7.3 + 0.35);
      const r = mulberry(seed * 31 + 7);
      let x = 0.2 + r() * 1.2;
      let y = 0.05;
      ctx.beginPath();
      ctx.moveTo(x, y);
      while (y < 0.42) {
        x += (r() - 0.5) * 0.05;
        y += 0.02 + r() * 0.03;
        ctx.lineTo(x, y);
      }
      ctx.strokeStyle = `rgba(235,238,255,${fl})`;
      ctx.lineWidth = 0.003;
      ctx.stroke();
    }
  }
}

function clouds(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const cl = c.clouds;
  const P = c.pal;
  const span = A + 0.9;
  const order = Array.from({ length: cl.n }, (_, i) => i).sort((a, b) => hash(a * 1.3 + 5) - hash(b * 1.3 + 5));
  for (const i of order) {
    const depth = hash(i * 1.3 + 5);
    const s = cl.scale * (0.05 + 0.075 * depth);
    const x = ((((i + 0.2 + 0.6 * hash(i * 3.1 + 2)) / cl.n) * span + f.t * cl.speed * (0.5 + depth)) % span) - 0.45;
    const y = lerp(cl.y0, cl.y1, hash(i * 7.7 + 1));
    const litRGB = mixRGB(hex(P.cloudLit), hex(P.sky1), 0.25 * (1 - depth));
    const shdRGB = mixRGB(hex(P.cloudShade), hex(P.sky1), 0.3 * (1 - depth));
    const lit = css(litRGB);
    const shd = css(shdRGB);
    if (cl.kind === 'streaky') streaky(ctx, x, y, s, lit, shd, i);
    else if (cl.kind === 'storm') stormCloud(ctx, x, y, s * 1.6, css(mixRGB(litRGB, shdRGB, 0.45)), shd, i);
    else cumulus(ctx, x, y, s * (cl.kind === 'rain' ? 1.25 : 1), lit, shd, i, cl.kind);
  }
}

function cumulus(
  ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lit: string, shd: string, seed: number,
  kind: string,
): void {
  const r = mulberry(seed * 97 + 13);
  const k = 5 + Math.floor(r() * 3);
  const parts: [number, number, number][] = [];
  for (let j = 0; j < k; j++) {
    const u = j / (k - 1);
    const rr = s * (0.32 + 0.5 * Math.sin(Math.PI * u)) * (0.8 + 0.4 * r());
    parts.push([x + (u - 0.5) * s * 2.3, y - rr * 0.45, rr]);
  }
  ctx.fillStyle = shd;
  ctx.beginPath();
  for (const [cx, cy, rr] of parts) {
    ctx.moveTo(cx + rr, cy);
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
  }
  ctx.ellipse(x, y, s * 1.35, s * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = lit;
  ctx.beginPath();
  const lift = kind === 'storm' ? 0.28 : 0.18;
  for (const [cx, cy, rr] of parts) {
    const lx = cx - rr * 0.1;
    const ly = cy - rr * lift;
    const lr = rr * (kind === 'storm' ? 0.7 : 0.84);
    ctx.moveTo(lx + lr, ly);
    ctx.arc(lx, ly, lr, 0, Math.PI * 2);
  }
  ctx.fill();
}

function stormCloud(
  ctx: CanvasRenderingContext2D, x: number, y: number, s: number, mid: string, shd: string, seed: number,
): void {
  const r = mulberry(seed * 71 + 5);
  for (let j = 0; j < 7; j++) {
    const ox = (r() - 0.5) * s * 3;
    const oy = (r() - 0.5) * s * 0.7;
    const rx = s * (1.2 + r() * 1.5);
    const ry = s * (0.3 + r() * 0.35);
    ellipse(ctx, x + ox, y + oy + ry * 0.3, rx, ry, (r() - 0.5) * 0.1, shd);
    ellipse(ctx, x + ox - rx * 0.1, y + oy - ry * 0.25, rx * 0.8, ry * 0.55, (r() - 0.5) * 0.1, mid);
  }
}

function streaky(
  ctx: CanvasRenderingContext2D, x: number, y: number, s: number, lit: string, shd: string, seed: number,
): void {
  const r = mulberry(seed * 53 + 3);
  const n = 2 + Math.floor(r() * 3);
  for (let j = 0; j < n; j++) {
    const ox = (r() - 0.5) * s * 2;
    const oy = (r() - 0.5) * s * 0.5;
    const len = s * (1.8 + r() * 2);
    ellipse(ctx, x + ox, y + oy + s * 0.05, len, s * 0.16, -0.02, shd);
    ellipse(ctx, x + ox - s * 0.12, y + oy, len * 0.9, s * 0.11, -0.02, lit);
  }
}

function ridge(ctx: CanvasRenderingContext2D, base: number, fn: (x: number) => number, fill: string): void {
  ctx.beginPath();
  ctx.moveTo(-0.05, base);
  for (let x = -0.05; x <= A + 0.05; x += 0.015) ctx.lineTo(x, fn(x));
  ctx.lineTo(A + 0.05, base);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function hills(ctx: CanvasRenderingContext2D, P: Palette, c: SceneConfig): void {
  ridge(ctx, 0.53, (x) => 0.392 + 0.03 * Math.sin(x * 3.3 + 0.6) + 0.018 * Math.sin(x * 7.9 + 2.1) + 0.008 * Math.sin(x * 17.3), P.hillFar);
  if (c.snow) {
    ridge(ctx, 0.53, (x) => 0.402 + 0.03 * Math.sin(x * 3.3 + 0.6) + 0.018 * Math.sin(x * 7.9 + 2.1) + 0.008 * Math.sin(x * 17.3) + 0.012, shade(P.hillFar, -0.08));
  }
  ridge(ctx, 0.53, (x) => 0.434 + 0.019 * Math.sin(x * 4.1 + 2.2) + 0.011 * Math.sin(x * 9.7 + 0.4), P.hillMid);
  ridge(ctx, 0.56, (x) => 0.462 + 0.011 * Math.sin(x * 5.3 + 1.0) + 0.006 * Math.sin(x * 13.1 + 2.0), P.hillNear);
  ridge(ctx, 0.56, (x) => 0.475 + 0.008 * Math.sin(x * 6.1 + 0.3), P.hillNearShade);
}

function farBank(ctx: CanvasRenderingContext2D, P: Palette, c: SceneConfig): void {
  const g = ctx.createLinearGradient(0, 0.47, 0, 0.6);
  g.addColorStop(0, mixHex(P.field3, P.hillFar, 0.35));
  g.addColorStop(1, P.field3);
  ctx.fillStyle = g;
  ctx.fillRect(-0.05, 0.47, A + 0.1, 0.14);
  const r = mulberry(7);
  const fields = [P.field1, P.field2, P.field3, P.field1, P.field2, P.field3];
  for (let row = 0; row < 4; row++) {
    const y0 = 0.474 + row * 0.018 + row * row * 0.003;
    const h = 0.014 + row * 0.006;
    let x = -0.05 - r() * 0.1;
    while (x < A) {
      const w = (0.09 + r() * 0.16) * (1 + row * 0.25);
      const sk = (r() - 0.5) * 0.03;
      const col = mixHex(fields[Math.floor(r() * fields.length)], P.hillFar, 0.3 - row * 0.08);
      poly(ctx, [[x, y0], [x + w, y0], [x + w + sk, y0 + h], [x + sk, y0 + h]]);
      ctx.fillStyle = col;
      ctx.fill();
      if (r() < 0.55) {
        ctx.strokeStyle = shade(col, -0.08);
        ctx.lineWidth = 0.0012 + row * 0.0005;
        ctx.beginPath();
        const n = 3 + row * 2;
        for (let k = 1; k < n; k++) {
          const yy = y0 + (h * k) / n;
          ctx.moveTo(x + sk * (k / n) + 0.004, yy);
          ctx.lineTo(x + w + sk * (k / n) - 0.004, yy);
        }
        ctx.stroke();
      }
      if (r() < 0.6) {
        for (let k = 0; k < Math.floor(w / 0.012); k++) {
          const s = 0.004 + row * 0.0018 + r() * 0.003;
          const hx = x + k * 0.012 + r() * 0.004;
          circle(ctx, hx + s * 0.2, y0 + h - s * 0.2, s, mixHex(P.treeDark, P.hillFar, 0.25 - row * 0.06));
          circle(ctx, hx - s * 0.25, y0 + h - s * 0.55, s * 0.6, mixHex(P.treeLit, P.hillFar, 0.25 - row * 0.06));
        }
      }
      x += w + 0.004;
    }
  }
  for (let i = 0; i < 7; i++) {
    const x = 0.06 + i * 0.052 + r() * 0.02;
    const y = 0.556 + r() * 0.012;
    const h = 0.07 + r() * 0.035;
    ellipse(ctx, x + 0.003, y - h / 2, 0.012, h / 2, 0, P.treeDark);
    ellipse(ctx, x - 0.003, y - h / 2 - 0.006, 0.0065, h / 2.4, 0, P.treeLit);
  }
  if (c.cherry) {
    for (let i = 0; i < 8; i++) {
      const x = 1.14 + i * 0.05 + r() * 0.02;
      const y = 0.628 + i * 0.012;
      const s = 0.02 + r() * 0.01;
      ctx.fillStyle = shade(P.trunk, -0.2);
      ctx.fillRect(x - 0.002, y - 0.006, 0.004, 0.02);
      circle(ctx, x + 0.004, y - s * 0.6, s, '#e59db4');
      circle(ctx, x - 0.004, y - s * 0.9, s * 0.8, '#f4c8d3');
      circle(ctx, x + 0.01, y - s * 1.1, s * 0.5, '#fbe3e8');
    }
  }
}

function rightLand(ctx: CanvasRenderingContext2D, f: Frame): void {
  const P = f.cfg.pal;
  const { right } = riverBanks(false);
  const pts: Pt[] = [[1.0, 0.585], [1.08, 0.54], [1.3, 0.505], [1.7, 0.49], [1.7, 1.05]];
  for (let i = right.length - 1; i >= 0; i--) if (right[i][1] >= 0.58) pts.push(right[i]);
  const g = ctx.createLinearGradient(0, 0.5, 0, 1);
  g.addColorStop(0, P.bank);
  g.addColorStop(1, P.bankShade);
  poly(ctx, pts);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(1.12, 0.6);
  ctx.bezierCurveTo(1.25, 0.66, 1.3, 0.8, 1.62, 0.84);
  ctx.lineTo(1.62, 0.87);
  ctx.bezierCurveTo(1.28, 0.83, 1.22, 0.68, 1.1, 0.608);
  ctx.closePath();
  ctx.fillStyle = f.cfg.snow ? '#e3e7ef' : P.lane;
  ctx.fill();
}

function reeds(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const P = c.pal;
  if (c.flood) return;
  const r = mulberry(55);
  const { right, left } = riverBanks(false);
  const col = c.snow ? '#b9b39a' : c.fig.leaves === 'autumn' ? '#b99a4a' : mixHex(P.leafMid, P.bankShade, 0.3);
  const dk = c.snow ? '#8a8472' : shade(col, -0.25);
  ctx.lineWidth = 0.0022;
  for (let i = 0; i < 60; i++) {
    const onRight = i < 42;
    const y = onRight ? 0.66 + r() * 0.36 : 0.63 + r() * 0.07;
    const bx = onRight ? xAtY(right, y) + 0.004 + r() * 0.03 : xAtY(left, y) - 0.03 + r() * 0.025;
    const h = (0.02 + r() * 0.035) * (0.6 + y * 0.6);
    const sway = f.sketch ? 0 : Math.sin(f.t * 1.3 + i * 0.7) * 0.006 * c.wind;
    ctx.strokeStyle = r() < 0.5 ? col : dk;
    ctx.beginPath();
    ctx.moveTo(bx, y);
    ctx.quadraticCurveTo(bx + sway * 0.3, y - h * 0.6, bx + sway + (r() - 0.5) * 0.01, y - h);
    ctx.stroke();
    if (r() < 0.2) ellipse(ctx, bx + sway * 0.8, y - h * 0.85, 0.0022, 0.007, 0, '#6a4a32');
  }
}

function willow(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const P = c.pal;
  const [bx, by] = WILLOW_BASE;
  const bare = c.fig.leaves === 'none';
  const autumn = c.fig.leaves === 'autumn';
  const sway = (i: number, k: number) => (f.sketch ? 0 : Math.sin(f.t * 0.9 + i * 0.6) * 0.005 * k * (0.4 + c.wind));
  ctx.strokeStyle = P.trunkShade;
  ctx.lineWidth = 0.02;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.quadraticCurveTo(bx - 0.03, by - 0.1, bx - 0.012, by - 0.2);
  ctx.moveTo(bx - 0.015, by - 0.14);
  ctx.quadraticCurveTo(bx - 0.06, by - 0.2, bx - 0.09, by - 0.26);
  ctx.moveTo(bx - 0.01, by - 0.17);
  ctx.quadraticCurveTo(bx + 0.03, by - 0.24, bx + 0.07, by - 0.27);
  ctx.stroke();
  const dark = bare ? P.trunkShade : autumn ? '#a07c36' : mixHex(P.leafDark, P.treeDark, 0.5);
  const mid = bare ? P.trunk : autumn ? '#d6a84a' : mixHex(P.leafMid, P.treeLit, 0.5);
  const light = bare ? P.trunk : autumn ? '#eccb6c' : mixHex(P.leafLight, P.treeLit, 0.4);
  const r = mulberry(61);
  if (bare) {
    const tips: Pt[] = [];
    ctx.strokeStyle = P.trunk;
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i / 8 - 0.5) * 2.4 + (r() - 0.5) * 0.2;
      const sx = bx - 0.012 + (r() - 0.5) * 0.02;
      const sy = by - 0.19 - r() * 0.03;
      const L = 0.06 + r() * 0.05;
      const ex = sx + Math.cos(a) * L * 1.3;
      const ey = sy + Math.sin(a) * L;
      ctx.lineWidth = 0.005;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.quadraticCurveTo((sx + ex) / 2, sy + Math.sin(a) * L * 0.7, ex, ey);
      ctx.stroke();
      tips.push([ex, ey]);
    }
    ctx.lineWidth = 0.0014;
    ctx.beginPath();
    for (let i = 0; i < 60; i++) {
      const t0 = tips[i % tips.length];
      const x0 = t0[0] + (r() - 0.5) * 0.03;
      const y0 = t0[1] + r() * 0.02;
      const len = 0.06 + r() * 0.12;
      ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(x0 + (x0 - bx) * 0.3, y0 + len * 0.3, x0 + (x0 - bx) * 0.25 + sway(i, 1), y0 + len);
    }
    ctx.stroke();
    if (c.snow) {
      ctx.strokeStyle = '#f5f7fb';
      ctx.lineWidth = 0.003;
      ctx.beginPath();
      for (const [tx, ty] of tips) {
        ctx.moveTo(tx - 0.012, ty + 0.004);
        ctx.lineTo(tx + 0.004, ty - 0.002);
      }
      ctx.stroke();
    }
    return;
  }
  const blobs: [number, number, number][] = [];
  for (let i = 0; i < 11; i++) {
    const a = r() * Math.PI * 2;
    const d = Math.sqrt(r());
    blobs.push([bx - 0.01 + Math.cos(a) * d * 0.1, by - 0.27 + Math.sin(a) * d * 0.07, 0.035 + r() * 0.03]);
  }
  for (const [x, y, rr] of blobs) circle(ctx, x + rr * 0.15, y + rr * 0.2, rr, dark);
  for (const [x, y, rr] of blobs) circle(ctx, x - rr * 0.15 + sway(x * 50, 1), y - rr * 0.1, rr * 0.75, mid);
  for (const [x, y, rr] of blobs) if (y < by - 0.27) circle(ctx, x - rr * 0.35 + sway(x * 50, 1.2), y - rr * 0.35, rr * 0.4, light);
  ctx.lineWidth = 0.005;
  for (let i = 0; i < 26; i++) {
    const x0 = bx - 0.1 + r() * 0.2;
    const y0 = by - 0.24 + r() * 0.05;
    const len = 0.05 + r() * 0.07;
    ctx.strokeStyle = i % 2 ? mid : dark;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.quadraticCurveTo(x0 + (x0 - bx) * 0.2, y0 + len * 0.5, x0 + (x0 - bx) * 0.15 + sway(i, 1.5), y0 + len);
    ctx.stroke();
  }
}

function cloudShadows(ctx: CanvasRenderingContext2D, f: Frame): void {
  const P = f.cfg.pal;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-0.05, 0.475, A + 0.1, 0.6);
  ctx.clip();
  for (let i = 0; i < 4; i++) {
    const span = A + 1.2;
    const x = ((hash(i * 4.1 + 1) * span + f.t * 0.01) % span) - 0.6;
    const y = 0.5 + hash(i * 2.7) * 0.45;
    const w = 0.25 + hash(i * 3.3) * 0.2;
    const g = ctx.createRadialGradient(x, y, 0.01, x, y, w);
    g.addColorStop(0, withAlpha(P.riverDark, 0.16));
    g.addColorStop(0.7, withAlpha(P.riverDark, 0.1));
    g.addColorStop(1, withAlpha(P.riverDark, 0));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.32);
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.fillRect(x - w, y - w, w * 2, w * 2);
    ctx.restore();
  }
  ctx.restore();
}

interface House {
  x: number; y: number; w: number; h: number; wall: number; gable: boolean; since: number; roof2: boolean; lit: number;
}

let HOUSES: House[] | null = null;
export function houses(): House[] {
  if (HOUSES) return HOUSES;
  const r = mulberry(1234);
  const list: House[] = [];
  for (let i = 0; i < 22; i++) {
    const u = i / 21;
    const x = 1.05 + r() * 0.52;
    const y = lerp(0.505, 0.6, Math.pow(r(), 0.8)) + (x - 1.05) * -0.03;
    list.push({
      x, y, w: 0.03 + r() * 0.03, h: 0.022 + r() * 0.02, wall: Math.floor(r() * 3), gable: r() < 0.5,
      since: u < 0.6 ? 0 : (u - 0.6) * 2.5, roof2: r() < 0.35, lit: r(),
    });
  }
  for (let i = 0; i < 7; i++) {
    const x = 0.05 + r() * 0.3;
    list.push({
      x, y: 0.535 + r() * 0.02, w: 0.028 + r() * 0.025, h: 0.02 + r() * 0.015, wall: Math.floor(r() * 3), gable: r() < 0.5,
      since: i < 4 ? 0 : 0.5 + i * 0.1, roof2: r() < 0.4, lit: r(),
    });
  }
  list.sort((a, b) => a.y - b.y);
  HOUSES = list;
  return list;
}

function town(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const P = c.pal;
  const walls = [P.wall1, P.wall2, P.wall3];
  let churchDrawn = false;
  for (const h of houses()) {
    if (h.since > c.town) continue;
    if (!churchDrawn && h.y > 0.53) {
      church(ctx, f);
      churchDrawn = true;
    }
    house(ctx, h, walls[h.wall], P, c);
  }
  if (!churchDrawn) church(ctx, f);
}

function house(ctx: CanvasRenderingContext2D, h: House, wall: string, P: Palette, c: SceneConfig): void {
  const { x, y, w } = h;
  const top = y - h.h;
  const sd = w * 0.35;
  poly(ctx, [[x + w, top], [x + w + sd, top - sd * 0.25], [x + w + sd, y - sd * 0.25], [x + w, y]]);
  ctx.fillStyle = P.wallShade;
  ctx.fill();
  ctx.fillStyle = wall;
  ctx.fillRect(x, top, w, h.h);
  const roofC = h.roof2 ? P.roof2 : P.roof;
  if (h.gable) {
    const rh = w * 0.45;
    poly(ctx, [[x - 0.002, top], [x + w / 2, top - rh], [x + w + 0.002, top]]);
    ctx.fillStyle = shade(wall, -0.06);
    ctx.fill();
    poly(ctx, [[x + w / 2, top - rh], [x + w / 2 + sd, top - rh - sd * 0.25], [x + w + sd + 0.002, top - sd * 0.25], [x + w + 0.002, top]]);
    ctx.fillStyle = roofC;
    ctx.fill();
  } else {
    const rh = w * 0.32;
    poly(ctx, [[x - 0.003, top], [x + w * 0.12, top - rh], [x + w + sd * 0.9, top - rh - sd * 0.25], [x + w + sd + 0.003, top - sd * 0.25], [x + w, top]]);
    ctx.fillStyle = roofC;
    ctx.fill();
    ctx.fillStyle = P.roofShade;
    ctx.fillRect(x - 0.003, top - 0.003, w + 0.006, 0.004);
  }
  const nw = w > 0.045 ? 3 : 2;
  for (let i = 0; i < nw; i++) {
    const wx = x + w * (i + 0.5) / nw - 0.0035;
    const lit = c.townLit && (h.lit + i * 0.31) % 1 < 0.45;
    ctx.fillStyle = lit ? P.windowLit : P.window;
    ctx.fillRect(wx, top + h.h * 0.28, 0.007, 0.009);
    if (h.h > 0.03) ctx.fillRect(wx, top + h.h * 0.62, 0.007, 0.009);
    if (lit && c.townLit) {
      const g = ctx.createRadialGradient(wx + 0.0035, top + h.h * 0.3, 0.002, wx + 0.0035, top + h.h * 0.3, 0.02);
      g.addColorStop(0, withAlpha(P.windowLit, 0.35));
      g.addColorStop(1, withAlpha(P.windowLit, 0));
      ctx.fillStyle = g;
      ctx.fillRect(wx - 0.02, top + h.h * 0.3 - 0.02, 0.04, 0.04);
    }
  }
}

function church(ctx: CanvasRenderingContext2D, f: Frame): void {
  const P = f.cfg.pal;
  const x = 1.285;
  const base = 0.53;
  ctx.fillStyle = P.wall1;
  ctx.fillRect(x + 0.03, base - 0.05, 0.12, 0.05);
  poly(ctx, [[x + 0.025, base - 0.05], [x + 0.04, base - 0.075], [x + 0.16, base - 0.075], [x + 0.155, base - 0.05]]);
  ctx.fillStyle = P.roof2;
  ctx.fill();
  ctx.fillStyle = P.wallShade;
  ctx.fillRect(x + 0.034, base - 0.2, 0.012, 0.2);
  ctx.fillStyle = P.wall1;
  ctx.fillRect(x, base - 0.2, 0.034, 0.2);
  poly(ctx, [[x - 0.004, base - 0.2], [x + 0.021, base - 0.29], [x + 0.05, base - 0.2]]);
  ctx.fillStyle = P.roof2;
  ctx.fill();
  poly(ctx, [[x + 0.021, base - 0.29], [x + 0.05, base - 0.2], [x + 0.034, base - 0.2]]);
  ctx.fillStyle = P.roofShade;
  ctx.fill();
  ctx.fillStyle = P.window;
  ctx.fillRect(x + 0.009, base - 0.185, 0.006, 0.018);
  ctx.fillRect(x + 0.019, base - 0.185, 0.006, 0.018);
  circle(ctx, x + 0.017, base - 0.14, 0.0065, shade(P.wall1, 0.3));
  ctx.strokeStyle = P.ink;
  ctx.lineWidth = 0.0012;
  ctx.beginPath();
  ctx.moveTo(x + 0.017, base - 0.14);
  ctx.lineTo(x + 0.017, base - 0.145);
  ctx.moveTo(x + 0.017, base - 0.14);
  ctx.lineTo(x + 0.021, base - 0.14);
  ctx.stroke();
  if (f.cfg.snow) {
    poly(ctx, [[x - 0.004, base - 0.2], [x + 0.021, base - 0.29], [x + 0.012, base - 0.21]]);
    ctx.fillStyle = '#f4f6fa';
    ctx.fill();
  }
}

function nearBank(ctx: CanvasRenderingContext2D, f: Frame): void {
  const P = f.cfg.pal;
  const { left } = riverBanks(false);
  const pts: Pt[] = [[-0.05, 0.548], [0.2, 0.545], [BRIDGE.x0 + 0.02, 0.546]];
  for (const p of left) if (p[1] > 0.55 && p[1] < 0.75) pts.push(p);
  pts.push([xAtY(left, 0.75), 0.75], [-0.05, 0.75]);
  const g = ctx.createLinearGradient(0, 0.55, 0, 0.75);
  g.addColorStop(0, P.bank);
  g.addColorStop(1, P.bankShade);
  poly(ctx, pts);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.beginPath();
  ctx.moveTo(BRIDGE.x0 + 0.01, 0.548);
  ctx.quadraticCurveTo(0.2, 0.56, -0.05, 0.63);
  ctx.lineTo(-0.05, 0.655);
  ctx.quadraticCurveTo(0.22, 0.58, BRIDGE.x0 + 0.03, 0.556);
  ctx.closePath();
  ctx.fillStyle = P.lane;
  ctx.fill();

  const H = [
    { x: 0.02, y: 0.625, w: 0.07, h: 0.04 },
    { x: 0.12, y: 0.6, w: 0.055, h: 0.032 },
  ];
  for (const h of H) {
    ctx.fillStyle = P.wall2;
    ctx.fillRect(h.x, h.y - h.h, h.w, h.h);
    poly(ctx, [[h.x - 0.005, h.y - h.h], [h.x + h.w * 0.15, h.y - h.h - 0.022], [h.x + h.w + 0.005, h.y - h.h - 0.022], [h.x + h.w + 0.01, h.y - h.h]]);
    ctx.fillStyle = f.cfg.snow ? '#f2f4f8' : P.roof;
    ctx.fill();
    ctx.fillStyle = f.cfg.townLit ? P.windowLit : P.window;
    ctx.fillRect(h.x + h.w * 0.25, h.y - h.h * 0.6, 0.008, 0.01);
    ctx.fillRect(h.x + h.w * 0.62, h.y - h.h * 0.6, 0.008, 0.01);
  }

  const r = mulberry(99);
  for (let i = 0; i < 12; i++) {
    const y = 0.6 + r() * 0.12;
    const x = xAtY(left, y) - 0.02 - r() * 0.05;
    const s = 0.01 + r() * 0.014;
    circle(ctx, x + s * 0.25, y, s, P.treeDark);
    circle(ctx, x - s * 0.2, y - s * 0.25, s * 0.7, f.cfg.snow ? '#eef1f6' : P.treeLit);
  }
}

export function riverPath(ctx: CanvasRenderingContext2D, flood: boolean): void {
  const { left, right } = riverBanks(flood);
  ctx.beginPath();
  ctx.moveTo(left[0][0], left[0][1]);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i][0], left[i][1]);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i][0], right[i][1]);
  ctx.closePath();
}

function river(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const P = c.pal;
  const flood = !!c.flood;
  ctx.save();
  riverPath(ctx, flood);
  const g = ctx.createLinearGradient(0, 0.48, 0, 1);
  g.addColorStop(0, P.river0);
  g.addColorStop(0.35, mixHex(P.river0, P.river1, 0.45));
  g.addColorStop(1, P.river1);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.clip();

  const { left, right } = riverBanks(flood);
  ctx.beginPath();
  for (let y = 0.48; y <= 1.02; y += 0.02) {
    const x = xAtY(left, y);
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.015 + (y - 0.48) * 0.08, y);
  }
  ctx.strokeStyle = withAlpha(P.riverDark, 0.35);
  ctx.lineWidth = 0.02;
  ctx.stroke();
  ctx.beginPath();
  for (let y = 0.48; y <= 1.02; y += 0.02) {
    const x = xAtY(right, y);
    ctx.moveTo(x, y);
    ctx.lineTo(x - 0.02 - (y - 0.48) * 0.1, y);
  }
  ctx.stroke();

  if (c.sun && !c.window) {
    const sx = clamp(c.sun.x, 0.7, 1.3);
    const rg = ctx.createRadialGradient(sx, 0.78, 0.01, sx, 0.78, 0.3);
    rg.addColorStop(0, withAlpha(P.riverLight, 0.3));
    rg.addColorStop(1, withAlpha(P.riverLight, 0));
    ctx.fillStyle = rg;
    ctx.fillRect(sx - 0.3, 0.5, 0.6, 0.55);
  }

  if (!f.sketch) {
    const n = flood ? 90 : 60;
    const speedK = flood ? 2.2 : 1;
    for (let i = 0; i < n; i++) {
      const h1 = hash(i * 1.7 + 0.3);
      const h2 = hash(i * 3.3 + 1.1);
      const s = (h1 + f.t * (0.012 + 0.01 * hash(i * 5.1)) * speedK) % 1;
      const y = lerp(0.49, 1.03, Math.pow(s, 1.3));
      const [xl, xr] = riverSpan(y, flood);
      const x = lerp(xl, xr, 0.06 + 0.88 * h2) + Math.sin(f.t * 0.7 + i) * 0.004;
      const len = 0.008 + 0.06 * s * (0.5 + 0.9 * hash(i * 7.3));
      const th = 0.0012 + 0.0028 * s;
      const fade = Math.min(1, s * 8, (1 - s) * 6);
      const dark = hash(i * 9.1) < 0.3;
      ellipse(ctx, x, y, len, th, -0.05 + (x - 0.8) * 0.06, withAlpha(dark ? P.riverDark : P.riverLight, (dark ? 0.35 : 0.6) * fade));
    }
    if (c.weather === 'rain' || c.weather === 'storm') {
      const intensity = c.weather === 'storm' ? 1 : 1 - smooth(0.35, 0.65, f.t / Math.max(1, c.duration));
      ctx.lineWidth = 0.0012;
      ctx.strokeStyle = withAlpha(P.riverLight, 0.45 * intensity);
      ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const ph = (hash(i * 2.9) + f.t * 0.8) % 1;
        const y = 0.6 + hash(i * 4.7) * 0.4;
        const [xl, xr] = riverSpan(y, flood);
        const x = lerp(xl, xr, hash(i * 6.1));
        const rr = 0.002 + ph * 0.012 * (0.5 + y);
        ctx.moveTo(x + rr, y);
        ctx.ellipse(x, y, rr, rr * 0.35, 0, 0, Math.PI * 2);
      }
      ctx.stroke();
    }
  }

  if (c.ice) {
    ctx.fillStyle = '#e6edf5';
    ctx.beginPath();
    ctx.moveTo(left[0][0], left[0][1]);
    for (const p of left) ctx.lineTo(p[0], p[1]);
    for (let i = left.length - 1; i >= 0; i--) {
      const p = left[i];
      ctx.lineTo(p[0] + 0.02 + (p[1] - 0.48) * 0.12 + Math.sin(p[1] * 60) * 0.008, p[1]);
    }
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(right[0][0], right[0][1]);
    for (const p of right) ctx.lineTo(p[0], p[1]);
    for (let i = right.length - 1; i >= 0; i--) {
      const p = right[i];
      ctx.lineTo(p[0] - 0.03 - (p[1] - 0.48) * 0.15 + Math.sin(p[1] * 50) * 0.01, p[1]);
    }
    ctx.fill();
  }
  ctx.restore();

  ctx.strokeStyle = withAlpha(P.bankShade, 0.9);
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  for (let i = 0; i < right.length; i++) {
    const p = right[i];
    if (i === 0) ctx.moveTo(p[0], p[1]);
    else ctx.lineTo(p[0], p[1]);
  }
  ctx.stroke();
}

function mist(ctx: CanvasRenderingContext2D, f: Frame, y0: number, y1: number): void {
  const P = f.cfg.pal;
  for (let i = 0; i < 6; i++) {
    const y = lerp(y0, y1, hash(i * 3.7 + y0));
    const x = ((hash(i * 1.9 + y0) * (A + 0.8) + f.t * 0.006 * (1 + hash(i))) % (A + 0.8)) - 0.4;
    const w = 0.3 + hash(i * 5.3) * 0.4;
    const g = ctx.createRadialGradient(x, y, 0.001, x, y, w);
    g.addColorStop(0, withAlpha(P.sky2, 0.55));
    g.addColorStop(1, withAlpha(P.sky2, 0));
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(1, 0.12);
    ctx.translate(-x, -y);
    ctx.fillStyle = g;
    ctx.fillRect(x - w, y - w, w * 2, w * 2);
    ctx.restore();
  }
}

function archPath(ctx: CanvasRenderingContext2D, a: number, b: number, water: number, rise: number, down = false): void {
  const mid = (a + b) / 2;
  const rx = (b - a) / 2;
  ctx.moveTo(a, water);
  ctx.ellipse(mid, water, rx, rise, 0, Math.PI, down ? Math.PI * 3 : Math.PI * 2, down);
}

function bridge(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const P = c.pal;
  const B = BRIDGE;
  if (c.bridge === 'none') return;
  if (c.bridge === 'building') {
    bridgeWorks(ctx, f);
    return;
  }
  // Reflection first, clipped to the water.
  ctx.save();
  riverPath(ctx, !!c.flood);
  ctx.clip();
  const refl = withAlpha(P.stoneShade, 0.5);
  for (let k = 0; k < 14; k++) {
    const y = B.water + k * 0.005;
    const wob = f.sketch ? 0 : Math.sin(f.t * 1.3 + k * 1.7) * 0.003 * (1 + k * 0.15);
    const h = 0.0052;
    const edges = [B.x0, ...B.spans.flat(), B.x1];
    for (let e = 0; e < edges.length; e += 2) {
      const a = edges[e];
      const b = edges[e + 1];
      ctx.fillStyle = refl;
      ctx.fillRect(a + wob, y, b - a, h);
    }
    for (const [a, b] of B.spans) {
      const mid = (a + b) / 2;
      const rx = (b - a) / 2;
      const dy = (y - B.water) / B.rise;
      if (dy < 1) {
        const half = rx * Math.sqrt(1 - dy * dy);
        ctx.fillRect(a + wob, y, rx - half, h);
        ctx.fillRect(mid + half + wob, y, rx - half, h);
      }
    }
  }
  if (c.lamps === 'on' || (c.lamps === 'dawn' && f.t < c.duration * 0.3)) {
    for (const lx of lampXs()) {
      for (let k = 0; k < 16; k++) {
        const y = B.water + 0.004 + k * 0.007;
        const wob = f.sketch ? 0 : Math.sin(f.t * 2 + k * 1.9 + lx * 10) * 0.004;
        ctx.fillStyle = withAlpha(P.windowLit, 0.5 * (1 - k / 16));
        ctx.fillRect(lx - 0.004 + wob, y, 0.008, 0.004);
      }
    }
  }
  ctx.restore();

  ctx.fillStyle = P.stone;
  ctx.fillRect(B.x0, B.top, B.x1 - B.x0, B.water - B.top + 0.004);
  const g = ctx.createLinearGradient(0, B.top, 0, B.water);
  g.addColorStop(0, withAlpha(P.stoneShade, 0));
  g.addColorStop(0.6, withAlpha(P.stoneShade, 0.15));
  g.addColorStop(1, withAlpha(P.stoneShade, 0.7));
  ctx.fillStyle = g;
  ctx.fillRect(B.x0, B.top, B.x1 - B.x0, B.water - B.top + 0.004);

  for (const [a, b] of B.spans) {
    ctx.beginPath();
    archPath(ctx, a, b, B.water + 0.004, B.rise);
    ctx.closePath();
    ctx.fillStyle = P.stoneDark;
    ctx.fill();
    ctx.save();
    ctx.clip();
    const wg = ctx.createLinearGradient(0, B.water - 0.02, 0, B.water + 0.004);
    wg.addColorStop(0, withAlpha(P.river0, 0));
    wg.addColorStop(1, withAlpha(P.river0, 0.8));
    ctx.fillStyle = wg;
    ctx.fillRect(a, B.water - 0.02, b - a, 0.025);
    ctx.restore();
    ctx.beginPath();
    archPath(ctx, a - 0.004, b + 0.004, B.water + 0.004, B.rise + 0.006);
    ctx.strokeStyle = P.stoneShade;
    ctx.lineWidth = 0.0035;
    ctx.stroke();
  }
  for (let i = 0; i < B.spans.length - 1; i++) {
    const px = (B.spans[i][1] + B.spans[i + 1][0]) / 2;
    poly(ctx, [[px - 0.02, B.water + 0.004], [px, B.water - 0.03], [px + 0.02, B.water + 0.004]]);
    ctx.fillStyle = P.stoneShade;
    ctx.fill();
    poly(ctx, [[px - 0.02, B.water + 0.004], [px, B.water - 0.03], [px - 0.004, B.water + 0.004]]);
    ctx.fillStyle = shade(P.stoneShade, 0.15);
    ctx.fill();
  }

  ctx.fillStyle = shade(P.stoneShade, 0.1);
  ctx.fillRect(B.x0, B.deck + 0.004, B.x1 - B.x0, 0.004);

  drawBridgeFigures(ctx, f);

  ctx.fillStyle = P.stone;
  ctx.fillRect(B.x0 - 0.004, B.top - 0.011, B.x1 - B.x0 + 0.008, 0.013);
  ctx.fillStyle = shade(P.stone, 0.18);
  ctx.fillRect(B.x0 - 0.006, B.top - 0.013, B.x1 - B.x0 + 0.012, 0.004);
  ctx.fillStyle = withAlpha(P.stoneShade, 0.6);
  ctx.fillRect(B.x0 - 0.004, B.top + 0.001, B.x1 - B.x0 + 0.008, 0.002);
  if (c.snow) {
    ctx.fillStyle = '#f5f7fb';
    ctx.fillRect(B.x0 - 0.007, B.top - 0.017, B.x1 - B.x0 + 0.014, 0.006);
  }

  if (c.lamps && c.lamps !== 'off') {
    const on = c.lamps === 'on' || f.t < c.duration * 0.3;
    for (const lx of lampXs()) {
      ctx.strokeStyle = P.stoneDark;
      ctx.lineWidth = 0.0025;
      ctx.beginPath();
      ctx.moveTo(lx, B.top - 0.012);
      ctx.lineTo(lx, B.top - 0.05);
      ctx.stroke();
      if (on && !f.sketch) {
        const lg = ctx.createRadialGradient(lx, B.top - 0.055, 0.002, lx, B.top - 0.055, 0.05);
        lg.addColorStop(0, withAlpha(P.windowLit, 0.6));
        lg.addColorStop(1, withAlpha(P.windowLit, 0));
        ctx.fillStyle = lg;
        ctx.fillRect(lx - 0.05, B.top - 0.105, 0.1, 0.1);
      }
      ctx.fillStyle = on ? P.windowLit : P.stoneDark;
      ctx.fillRect(lx - 0.004, B.top - 0.061, 0.008, 0.011);
    }
  }
}

export function lampXs(): number[] {
  return [0.4, 0.645, 0.835, 1.075];
}

function bridgeWorks(ctx: CanvasRenderingContext2D, f: Frame): void {
  const P = f.cfg.pal;
  const B = BRIDGE;
  const piers = [(B.spans[0][1] + B.spans[1][0]) / 2, (B.spans[1][1] + B.spans[2][0]) / 2];
  const abut = (x0: number, x1: number, top: number, stepRight: boolean) => {
    const pts: Pt[] = [[x0, B.water + 0.004], [x0, top]];
    const steps = 4;
    for (let k = 0; k < steps; k++) {
      const u0 = k / steps;
      const u1 = (k + 1) / steps;
      const xa = stepRight ? lerp(x0, x1, u0) : lerp(x1, x0, u0);
      const xb = stepRight ? lerp(x0, x1, u1) : lerp(x1, x0, u1);
      const y = top + k * 0.008;
      if (stepRight) pts.push([xa, y], [xb, y]);
      else pts.splice(1, 0, [xb, y], [xa, y]);
    }
    pts.push([x1, B.water + 0.004]);
    poly(ctx, stepRight ? pts : [[x0, B.water + 0.004], ...pts.slice(1)]);
    ctx.fillStyle = mixHex(P.stone, P.stoneShade, 0.35);
    ctx.fill();
    ctx.strokeStyle = withAlpha(P.stoneShade, 0.7);
    ctx.lineWidth = 0.0015;
    ctx.beginPath();
    for (let y = top + 0.012; y < B.water; y += 0.012) {
      ctx.moveTo(x0, y);
      ctx.lineTo(x1, y);
    }
    ctx.stroke();
  };
  abut(B.x0, B.x0 + 0.105, B.top + 0.012, true);
  abut(B.x1 - 0.12, B.x1, B.top + 0.02, false);
  for (const px of piers) {
    ctx.fillStyle = P.stone;
    ctx.fillRect(px - 0.017, 0.578, 0.034, B.water - 0.574);
    ctx.fillStyle = P.stoneShade;
    ctx.fillRect(px + 0.008, 0.578, 0.009, B.water - 0.574);
    poly(ctx, [[px - 0.022, B.water + 0.004], [px, B.water - 0.028], [px + 0.022, B.water + 0.004]]);
    ctx.fill();
  }
  ctx.strokeStyle = P.wood;
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  archPath(ctx, B.spans[0][0], B.spans[0][1], B.water, B.rise);
  ctx.stroke();
  ctx.lineWidth = 0.0018;
  ctx.beginPath();
  const [a0, b0] = B.spans[0];
  for (let k = 1; k < 6; k++) {
    const th = Math.PI + (Math.PI * k) / 6;
    ctx.moveTo((a0 + b0) / 2, B.water);
    ctx.lineTo((a0 + b0) / 2 + Math.cos(th) * (b0 - a0) / 2, B.water + Math.sin(th) * B.rise);
  }
  ctx.stroke();

  ctx.strokeStyle = shade(P.wood, 0.1);
  ctx.lineWidth = 0.0022;
  ctx.beginPath();
  for (const px of piers) {
    for (const dx of [-0.03, -0.012, 0.012, 0.03]) {
      ctx.moveTo(px + dx, B.water);
      ctx.lineTo(px + dx, 0.505);
    }
    for (let y = 0.515; y < B.water; y += 0.022) {
      ctx.moveTo(px - 0.034, y);
      ctx.lineTo(px + 0.034, y);
    }
    ctx.moveTo(px - 0.03, B.water - 0.005);
    ctx.lineTo(px + 0.03, 0.52);
  }
  ctx.stroke();

  const woke = f.woke.bridge;
  const swing = Math.sin(f.t * 0.45) * 0.12 + (woke !== undefined ? Math.sin(woke * 2) * Math.exp(-woke * 0.3) * 0.25 : 0);
  const mx = 1.1;
  ctx.strokeStyle = P.woodShade;
  ctx.lineWidth = 0.004;
  ctx.beginPath();
  ctx.moveTo(mx, 0.6);
  ctx.lineTo(mx, 0.39);
  const jx = mx - Math.cos(swing) * 0.2;
  const jy = 0.4 - Math.sin(swing) * 0.05 + 0.02;
  ctx.moveTo(mx + 0.03, 0.4);
  ctx.lineTo(jx, jy);
  ctx.stroke();
  ctx.lineWidth = 0.0012;
  ctx.beginPath();
  ctx.moveTo(mx, 0.39);
  ctx.lineTo(jx + 0.04, jy);
  ctx.moveTo(jx + 0.01, jy);
  const ropeY = jy + 0.07 + Math.sin(f.t * 0.9) * 0.01;
  ctx.lineTo(jx + 0.01, ropeY);
  ctx.stroke();
  ctx.fillStyle = P.stone;
  ctx.fillRect(jx - 0.002, ropeY, 0.024, 0.014);

  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i % 2 ? P.stone : shade(P.stone, -0.1);
    ctx.fillRect(1.14 + i * 0.012, 0.598 - (i % 3) * 0.008, 0.016, 0.009);
  }
  drawBridgeFigures(ctx, f);
}

function ferry(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  if (c.ferry === 'none') return;
  const P = c.pal;
  const hull = c.bridge === 'building' ? '#3d74bf' : P.wood;
  if (c.ferry === 'active') {
    ctx.strokeStyle = withAlpha(P.ink, 0.55);
    ctx.lineWidth = 0.0015;
    ctx.beginPath();
    ctx.moveTo(0.47, 0.668);
    ctx.quadraticCurveTo(0.8, 0.678, 1.15, 0.664);
    ctx.stroke();
    jetty(ctx, 0.43, 0.678, P);
    jetty(ctx, 1.12, 0.668, P);
    drawFerryBoat(ctx, f);
  } else {
    const x = 0.405;
    const y = 0.7;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.12);
    poly(ctx, [[-0.045, -0.008], [0.045, -0.008], [0.037, 0.006], [-0.037, 0.006]]);
    ctx.fillStyle = c.ferry === 'wreck' ? shade(P.wood, -0.25) : hull;
    ctx.fill();
    if (c.ferry === 'wreck') {
      ctx.fillStyle = P.bankShade;
      ctx.fillRect(-0.02, -0.006, 0.012, 0.01);
      ctx.fillRect(0.012, -0.004, 0.008, 0.008);
    }
    ctx.restore();
    if (c.ferry === 'wreck') {
      const r = mulberry(5);
      for (let i = 0; i < 16; i++) {
        const nx = x - 0.05 + r() * 0.1;
        const ny = y - 0.004 + r() * 0.016;
        const s = 0.005 + r() * 0.008;
        ellipse(ctx, nx, ny - s, s * 0.45, s * 1.3, (r() - 0.5) * 0.6, i % 2 ? P.treeDark : P.leafMid);
      }
    }
  }
}

export function drawFerryBoat(ctx: CanvasRenderingContext2D, f: Frame): void {
  const P = f.cfg.pal;
  const hull = f.cfg.bridge === 'building' ? '#3d74bf' : P.wood;
  const x = ferryX(f.cfg, f.t, f.woke.ferry).x;
  const y = 0.678 + Math.sin(f.t * 1.4) * 0.0015;
  ellipse(ctx, x, y + 0.012, 0.05, 0.006, 0, withAlpha(P.riverDark, 0.45));
  poly(ctx, [[x - 0.048, y - 0.006], [x + 0.048, y - 0.006], [x + 0.04, y + 0.007], [x - 0.04, y + 0.007]]);
  ctx.fillStyle = hull;
  ctx.fill();
  ctx.fillStyle = shade(hull, 0.25);
  ctx.fillRect(x - 0.048, y - 0.008, 0.096, 0.003);
  ferryman(ctx, f, x - 0.02, y - 0.006);
}

function jetty(ctx: CanvasRenderingContext2D, x: number, y: number, P: Palette): void {
  ctx.fillStyle = P.wood;
  ctx.fillRect(x, y - 0.004, 0.05, 0.006);
  ctx.fillStyle = P.woodShade;
  ctx.fillRect(x + 0.004, y + 0.002, 0.003, 0.012);
  ctx.fillRect(x + 0.04, y + 0.002, 0.003, 0.012);
}

function ferryman(ctx: CanvasRenderingContext2D, f: Frame, x: number, y: number): void {
  const P = f.cfg.pal;
  const w = f.woke.ferry;
  const waving = w !== undefined && w < 6;
  const h = 0.034;
  ctx.strokeStyle = P.woodShade;
  ctx.lineWidth = 0.0016;
  ctx.beginPath();
  ctx.moveTo(x - 0.012, y - h * 0.75);
  ctx.lineTo(x + 0.02, y + 0.02);
  ctx.stroke();
  ctx.fillStyle = '#39465e';
  ctx.fillRect(x - 0.005, y - h * 0.45, 0.01, h * 0.45);
  ctx.fillStyle = '#b8563f';
  ctx.fillRect(x - 0.006, y - h * 0.82, 0.012, h * 0.4);
  circle(ctx, x, y - h * 0.9, 0.0045, P.skin);
  ctx.fillStyle = '#2e2a28';
  ctx.fillRect(x - 0.006, y - h * 1.02, 0.012, 0.004);
  if (waving) {
    const a = Math.sin(w * 9) * 0.4;
    ctx.strokeStyle = '#b8563f';
    ctx.lineWidth = 0.003;
    ctx.beginPath();
    ctx.moveTo(x + 0.004, y - h * 0.78);
    ctx.lineTo(x + 0.012 + Math.sin(a) * 0.006, y - h * 1.15);
    ctx.stroke();
  }
}

function garden(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const P = c.pal;
  const pts: Pt[] = [[-0.05, WALL_Y + 0.012]];
  for (let y = WALL_Y + 0.012; y <= 1.03; y += 0.02) pts.push([gardenRight(y), y]);
  pts.push([gardenRight(1.03), 1.03], [-0.05, 1.03]);
  const g = ctx.createLinearGradient(0, WALL_Y, 0, 1);
  g.addColorStop(0, P.grass);
  g.addColorStop(1, P.grassShade);
  poly(ctx, pts);
  ctx.fillStyle = g;
  ctx.fill();

  if (!c.snow && !f.sketch) {
    const r = mulberry(31);
    ctx.lineWidth = 0.0018;
    ctx.strokeStyle = withAlpha(P.grassShade, 0.8);
    ctx.beginPath();
    for (let i = 0; i < 140; i++) {
      const y = WALL_Y + 0.02 + r() * 0.28;
      const x = r() * gardenRight(y);
      const l = 0.006 + (y - WALL_Y) * 0.03;
      const sway = Math.sin(f.t * 1.4 + x * 20) * 0.002 * c.wind;
      ctx.moveTo(x, y);
      ctx.lineTo(x + sway + (r() - 0.5) * 0.004, y - l);
    }
    ctx.stroke();
  }

  ctx.fillStyle = P.path;
  const r = mulberry(17);
  for (let i = 0; i < 9; i++) {
    const u = i / 8;
    const y = lerp(0.76, 1.0, u);
    const x = lerp(0.33, 0.27, u) + Math.sin(u * 3) * 0.02;
    const s = lerp(0.012, 0.03, u);
    ellipse(ctx, x + (r() - 0.5) * 0.005, y, s * 1.3, s * 0.45, 0, P.path);
    ellipse(ctx, x + s * 0.2, y + s * 0.15, s * 1.2, s * 0.3, 0, withAlpha(P.gardenWallShade, 0.25));
  }

  if (!c.snow && c.fig.leaves !== 'none') {
    const colors = c.fig.leaves === 'autumn' ? ['#d0763a', '#e3b04a', '#b9543a'] : ['#e8574d', '#f1c24f', '#f4f0e6', '#d86aa0'];
    const rf = mulberry(3);
    for (let i = 0; i < 30; i++) {
      const x = 0.02 + rf() * 0.44;
      const y = WALL_Y + 0.018 + rf() * 0.02;
      circle(ctx, x, y + 0.004, 0.008, P.leafDark);
      circle(ctx, x, y, 0.0045, colors[i % colors.length]);
    }
  }

  const wr = gardenRight(WALL_Y);
  ctx.fillStyle = P.gardenWall;
  ctx.fillRect(-0.05, WALL_Y, wr + 0.05, 0.017);
  ctx.fillStyle = shade(P.gardenWall, 0.15);
  ctx.fillRect(-0.05, WALL_Y - 0.004, wr + 0.055, 0.006);
  ctx.fillStyle = P.gardenWallShade;
  ctx.fillRect(-0.05, WALL_Y + 0.013, wr + 0.05, 0.005);
  ctx.beginPath();
  ctx.moveTo(wr, WALL_Y - 0.004);
  for (let y = WALL_Y; y <= 1.03; y += 0.02) ctx.lineTo(gardenRight(y) + 0.004, y);
  for (let y = 1.03; y >= WALL_Y; y -= 0.02) ctx.lineTo(gardenRight(y) + 0.022 + (y - WALL_Y) * 0.02, y);
  ctx.closePath();
  ctx.fillStyle = P.gardenWallShade;
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(wr, WALL_Y - 0.004);
  for (let y = WALL_Y; y <= 1.03; y += 0.02) ctx.lineTo(gardenRight(y) + 0.004, y);
  for (let y = 1.03; y >= WALL_Y; y -= 0.02) ctx.lineTo(gardenRight(y) - 0.008 - (y - WALL_Y) * 0.01, y);
  ctx.closePath();
  ctx.fillStyle = shade(P.gardenWall, 0.1);
  ctx.fill();

  if (c.snow) {
    ctx.fillStyle = '#f6f8fb';
    ctx.fillRect(-0.05, WALL_Y - 0.009, wr + 0.055, 0.007);
    if (!f.sketch) {
      for (let i = 0; i < 14; i++) {
        const u = i / 13;
        const x = lerp(0.3, 0.36, u) + (i % 2 ? 0.008 : -0.008);
        const y = lerp(1.0, 0.915, u);
        ellipse(ctx, x, y, 0.005 + (1 - u) * 0.004, 0.003, 0, withAlpha(P.grassShade, 0.9));
      }
    }
  }

  if (c.kitchenLight && !f.sketch) {
    const lg = ctx.createRadialGradient(0.2, 1.05, 0.02, 0.2, 1.05, 0.42);
    lg.addColorStop(0, withAlpha(P.windowLit, 0.55));
    lg.addColorStop(1, withAlpha(P.windowLit, 0));
    ctx.fillStyle = lg;
    ctx.fillRect(-0.2, 0.62, 0.9, 0.45);
    poly(ctx, [[0.1, 0.88], [0.3, 0.88], [0.36, 1.03], [0.02, 1.03]]);
    ctx.fillStyle = withAlpha(P.windowLit, 0.28);
    ctx.fill();
    ctx.fillStyle = withAlpha(P.grassShade, 0.5);
    ctx.fillRect(0.19, 0.88, 0.012, 0.15);
    ctx.fillRect(0.06, 0.945, 0.28, 0.01);
  }

  if (c.bench) bench(ctx, f);
  if (c.washing) washing(ctx, f);
  if (c.beans) beans(ctx, f);
}

function bench(ctx: CanvasRenderingContext2D, f: Frame): void {
  const P = f.cfg.pal;
  const col = mixHex('#557a60', P.grassShade, 0.4);
  const dk = shade(col, -0.3);
  const x = 0.33;
  const y = 0.905;
  const w = 0.085;
  ctx.fillStyle = dk;
  ctx.fillRect(x + 0.004, y - 0.004, 0.005, 0.028);
  ctx.fillRect(x + w - 0.009, y - 0.004, 0.005, 0.028);
  ctx.fillRect(x + 0.01, y - 0.045, 0.004, 0.045);
  ctx.fillRect(x + w - 0.014, y - 0.045, 0.004, 0.045);
  ctx.fillStyle = col;
  ctx.fillRect(x, y - 0.008, w, 0.009);
  ctx.fillRect(x + 0.004, y - 0.045, w - 0.008, 0.008);
  ctx.fillRect(x + 0.004, y - 0.031, w - 0.008, 0.007);
  ctx.fillStyle = shade(col, 0.25);
  ctx.fillRect(x, y - 0.009, w, 0.003);
  if (f.cfg.snow) {
    ctx.fillStyle = '#f6f8fb';
    ctx.fillRect(x - 0.002, y - 0.014, w + 0.004, 0.006);
    ctx.fillRect(x + 0.002, y - 0.05, w - 0.004, 0.005);
  }
}

function washing(ctx: CanvasRenderingContext2D, f: Frame): void {
  const P = f.cfg.pal;
  const x0 = 0.05;
  const x1 = 0.47;
  const y0 = 0.79;
  ctx.fillStyle = P.woodShade;
  ctx.fillRect(x0 - 0.003, y0 - 0.006, 0.005, 0.17);
  ctx.fillRect(x1 - 0.003, y0 - 0.008, 0.005, 0.16);
  const sag = (u: number) => y0 + Math.sin(u * Math.PI) * 0.022 - u * 0.002;
  ctx.strokeStyle = withAlpha(P.ink, 0.6);
  ctx.lineWidth = 0.0012;
  ctx.beginPath();
  for (let u = 0; u <= 1.001; u += 0.05) {
    const x = lerp(x0, x1, u);
    if (u === 0) ctx.moveTo(x, sag(u));
    else ctx.lineTo(x, sag(u));
  }
  ctx.stroke();
  const items = [
    { u: 0.1, w: 0.05, h: 0.05, c: '#f7f3ea' },
    { u: 0.26, w: 0.022, h: 0.022, c: '#8cc6e8' },
    { u: 0.36, w: 0.022, h: 0.024, c: '#f2a6b5' },
    { u: 0.47, w: 0.012, h: 0.016, c: '#f5d45e' },
    { u: 0.52, w: 0.012, h: 0.016, c: '#f5d45e' },
    { u: 0.64, w: 0.06, h: 0.055, c: '#eef0f3' },
    { u: 0.8, w: 0.022, h: 0.022, c: '#9fd3a8' },
    { u: 0.9, w: 0.02, h: 0.02, c: '#f7f3ea' },
  ];
  items.forEach((it, i) => {
    const x = lerp(x0, x1, it.u);
    const y = sag(it.u);
    const sw = f.sketch ? 0 : Math.sin(f.t * 2.2 + i * 1.3) * 0.006 * f.cfg.wind;
    poly(ctx, [[x - it.w / 2, y], [x + it.w / 2, y], [x + it.w / 2 + sw, y + it.h], [x - it.w / 2 + sw, y + it.h]]);
    ctx.fillStyle = it.c;
    ctx.fill();
    ctx.fillStyle = withAlpha('#7d8aa0', 0.25);
    ctx.fillRect(x + it.w * 0.15 + sw * 0.5, y, it.w * 0.35, it.h);
    ctx.fillStyle = P.woodShade;
    ctx.fillRect(x - it.w / 2 + 0.002, y - 0.003, 0.002, 0.005);
    ctx.fillRect(x + it.w / 2 - 0.004, y - 0.003, 0.002, 0.005);
  });
}

function beans(ctx: CanvasRenderingContext2D, f: Frame): void {
  const P = f.cfg.pal;
  const bare = f.cfg.beans === 'bare';
  for (let k = 0; k < 3; k++) {
    const cx = 0.41 + k * 0.045;
    const top = 0.765 + k * 0.004;
    const base = 0.855 + k * 0.01;
    ctx.strokeStyle = P.wood;
    ctx.lineWidth = 0.0022;
    ctx.beginPath();
    for (const dx of [-0.018, -0.006, 0.008, 0.019]) {
      ctx.moveTo(cx + dx, base);
      ctx.lineTo(cx, top);
    }
    ctx.stroke();
    if (!bare) {
      const r = mulberry(40 + k);
      for (let i = 0; i < 22; i++) {
        const u = r();
        const dx = [-0.018, -0.006, 0.008, 0.019][i % 4];
        const x = lerp(cx, cx + dx, u) + (r() - 0.5) * 0.008;
        const y = lerp(top, base, u);
        const col = r() < 0.4 ? '#c8a445' : r() < 0.5 ? P.leafMid : '#7a9a45';
        ellipse(ctx, x, y, 0.006, 0.0045, r() * 3, col);
      }
    } else {
      ctx.fillStyle = '#f5f7fa';
      ctx.fillRect(cx - 0.004, top - 0.002, 0.008, 0.004);
    }
  }
}

export interface Limb { x0: number; y0: number; cx: number; cy: number; x1: number; y1: number; w: number }

export function figSkeleton(s: number): { limbs: Limb[]; tips: Pt[] } {
  const r = mulberry(42);
  const [bx, by] = FIG_BASE;
  const trunkH = 0.04 + 0.16 * s;
  const fx = bx + 0.004;
  const fy = by - trunkH;
  const limbs: Limb[] = [{ x0: bx, y0: by, cx: bx - 0.004, cy: by - trunkH * 0.5, x1: fx, y1: fy, w: 0.008 + 0.03 * s }];
  const tips: Pt[] = [];
  const n = 5;
  for (let i = 0; i < n; i++) {
    const a = lerp(-2.45, -0.55, i / (n - 1)) + (r() - 0.5) * 0.25;
    const L = (0.08 + 0.3 * s) * (0.75 + 0.35 * r());
    const x1 = fx + Math.cos(a) * L * 1.2;
    const y1 = fy + Math.sin(a) * L;
    const cx = fx + Math.cos(a) * L * 0.4 + (r() - 0.5) * 0.03;
    const cy = fy + Math.sin(a) * L * 0.65;
    limbs.push({ x0: fx, y0: fy, cx, cy, x1, y1, w: (0.005 + 0.016 * s) * (0.8 + 0.3 * r()) });
    tips.push([x1, y1]);
    for (let j = 0; j < 2; j++) {
      const t = 0.55 + j * 0.3;
      const sx = lerp(fx, x1, t);
      const sy = lerp(fy, y1, t) - 0.01;
      const b = a + (j ? 0.5 : -0.55) + (r() - 0.5) * 0.3;
      const l = L * (0.35 + 0.2 * r());
      const ex = sx + Math.cos(b) * l;
      const ey = sy + Math.sin(b) * l;
      limbs.push({ x0: sx, y0: sy, cx: (sx + ex) / 2, cy: (sy + ey) / 2 - 0.005, x1: ex, y1: ey, w: (0.003 + 0.008 * s) });
      tips.push([ex, ey]);
    }
  }
  return { limbs, tips };
}

function drawLimbs(ctx: CanvasRenderingContext2D, limbs: Limb[], col: string, dx: number, dy: number, k: number): void {
  ctx.strokeStyle = col;
  for (const l of limbs) {
    ctx.lineWidth = l.w * k;
    ctx.beginPath();
    ctx.moveTo(l.x0 + dx, l.y0 + dy);
    ctx.quadraticCurveTo(l.cx + dx, l.cy + dy, l.x1 + dx, l.y1 + dy);
    ctx.stroke();
  }
}

export function figLeaf(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number, col: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.beginPath();
  for (let i = 0; i <= 40; i++) {
    const th = (i / 40) * Math.PI * 2;
    const lobes = Math.pow(Math.abs(Math.cos(th * 2.5)), 0.6);
    const rr = s * (0.5 + 0.5 * lobes) * (th > Math.PI * 0.35 && th < Math.PI * 0.65 ? 0.5 : 1);
    const px = Math.cos(th) * rr;
    const py = Math.sin(th) * rr * 0.9;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = col;
  ctx.fill();
  ctx.restore();
}

export interface Cluster { x: number; y: number; r: number; i: number }

export function figClusters(F: SceneConfig['fig'], tips: Pt[]): { clusters: Cluster[]; rc: number; density: number } {
  const s = F.size;
  const density = F.leaves === 'autumn' ? 0.6 : F.leaves === 'spring' ? 0.8 : 1;
  const rc = (0.025 + 0.06 * s) * (F.leaves === 'spring' ? 0.8 : 1);
  const r = mulberry(77);
  const clusters: Cluster[] = [];
  tips.forEach((tp, i) => {
    if (F.broken && i < 3) return;
    const k = Math.round(3 * density) + 1;
    for (let j = 0; j < k; j++) {
      clusters.push({
        x: tp[0] + (r() - 0.5) * rc * 1.6,
        y: tp[1] + (r() - 0.5) * rc * 1.1 + rc * 0.2,
        r: rc * (0.55 + 0.5 * r()),
        i: i * 7 + j,
      });
    }
  });
  return { clusters, rc, density };
}

function fig(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const P = c.pal;
  const F = c.fig;
  const [bx, by] = FIG_BASE;

  if (F.leaves === 'stick') {
    ellipse(ctx, bx, by + 0.004, 0.03, 0.008, 0, shade(P.grassShade, -0.35));
    ctx.strokeStyle = P.trunk;
    ctx.lineWidth = 0.0035;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.quadraticCurveTo(bx - 0.003, by - 0.03, bx + 0.002, by - 0.062);
    ctx.stroke();
    ctx.strokeStyle = '#c9b27a';
    ctx.lineWidth = 0.0025;
    ctx.beginPath();
    ctx.moveTo(bx + 0.012, by + 0.004);
    ctx.lineTo(bx + 0.012, by - 0.07);
    ctx.stroke();
    const sway = f.sketch ? 0 : Math.sin(f.t * 1.7) * 0.15;
    figLeaf(ctx, bx - 0.012, by - 0.066, 0.013, -0.6 + sway, P.leafMid);
    figLeaf(ctx, bx + 0.014, by - 0.072, 0.011, 0.5 + sway, P.leafLight);
    return;
  }

  const s = F.size;
  const { limbs, tips } = figSkeleton(s);
  const drawn = F.broken ? limbs.filter((_, i) => i !== 1 && i !== 2 && i !== 3) : limbs;
  const wind = c.wind;
  const sway = (i: number, k: number) => (f.sketch ? 0 : Math.sin(f.t * 1.1 + i * 1.7) * 0.004 * wind * k * (0.5 + s));

  if (F.leaves === 'none') {
    drawLimbs(ctx, drawn, P.trunkShade, 0.003, 0.002, 1);
    drawLimbs(ctx, drawn, P.trunk, 0, 0, 0.8);
    const r = mulberry(8);
    ctx.strokeStyle = P.trunk;
    ctx.lineWidth = 0.0022;
    ctx.beginPath();
    tips.forEach((tp, i) => {
      if (F.broken && i < 3) return;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + (r() - 0.5) * 2;
        ctx.moveTo(tp[0], tp[1]);
        ctx.lineTo(tp[0] + Math.cos(a) * 0.03 + sway(i, 1), tp[1] + Math.sin(a) * 0.03);
      }
    });
    ctx.stroke();
    if (F.snow) {
      ctx.strokeStyle = '#f7f9fc';
      ctx.lineWidth = 0.004;
      ctx.beginPath();
      for (const l of drawn.slice(1)) {
        ctx.moveTo(l.x0, l.y0 - l.w * 0.5);
        ctx.quadraticCurveTo(l.cx, l.cy - l.w * 0.5, l.x1, l.y1 - l.w * 0.4);
      }
      ctx.stroke();
    }
    if (F.broken) brokenStub(ctx, limbs[1], P);
    return;
  }

  const { clusters, rc, density } = figClusters(F, tips);
  const cols = [P.leafDark, P.leafMid, P.leafLight];

  for (const cl of clusters) {
    circle(ctx, cl.x + cl.r * 0.15 + sway(cl.i, 0.6), cl.y + cl.r * 0.2, cl.r, cols[0]);
  }
  drawLimbs(ctx, drawn, P.trunkShade, 0.003, 0.002, 1);
  drawLimbs(ctx, drawn, P.trunk, 0, 0, 0.8);
  if (F.broken) brokenStub(ctx, limbs[1], P);
  for (const cl of clusters) {
    if (hash(cl.i) < 0.25 * (1 - density + 0.2)) continue;
    circle(ctx, cl.x - cl.r * 0.1 + sway(cl.i, 1), cl.y - cl.r * 0.1, cl.r * 0.78, cols[1]);
  }
  for (const cl of clusters) {
    if (hash(cl.i + 3) < 0.35) continue;
    circle(ctx, cl.x - cl.r * 0.3 + sway(cl.i, 1.3), cl.y - cl.r * 0.35, cl.r * 0.42, cols[2]);
  }
  const rl = mulberry(12);
  for (const cl of clusters) {
    if (rl() < 0.5) continue;
    const a = rl() * Math.PI * 2;
    const lx = cl.x + Math.cos(a) * cl.r * 0.95;
    const ly = cl.y + Math.sin(a) * cl.r * 0.85;
    figLeaf(ctx, lx + sway(cl.i, 1.4), ly, rc * 0.28, a + Math.PI / 2 + (rl() - 0.5), cols[rl() < 0.5 ? 1 : 2]);
  }
  if (F.fruit) {
    const rf = mulberry(21);
    for (const cl of clusters) {
      if (rf() < 0.4) continue;
      for (let k = 0; k < 2; k++) {
        const fx = cl.x + (rf() - 0.5) * cl.r;
        const fy = cl.y + rf() * cl.r * 0.6;
        const fr = 0.004 + s * 0.004;
        circle(ctx, fx, fy, fr, F.leaves === 'autumn' ? '#6d3550' : '#5b2d4f');
        circle(ctx, fx - fr * 0.3, fy - fr * 0.3, fr * 0.35, '#9a5a7a');
      }
    }
  }
}

function brokenStub(ctx: CanvasRenderingContext2D, l: Limb, P: Palette): void {
  const ex = lerp(l.x0, l.x1, 0.35);
  const ey = lerp(l.y0, l.y1, 0.35);
  ctx.strokeStyle = P.trunk;
  ctx.lineWidth = l.w * 0.9;
  ctx.beginPath();
  ctx.moveTo(l.x0, l.y0);
  ctx.quadraticCurveTo(lerp(l.x0, l.cx, 0.4), lerp(l.y0, l.cy, 0.4), ex, ey);
  ctx.stroke();
  const a = Math.atan2(ey - l.y0, ex - l.x0);
  poly(ctx, [
    [ex + Math.cos(a + 1.57) * l.w * 0.5, ey + Math.sin(a + 1.57) * l.w * 0.5],
    [ex + Math.cos(a) * 0.012, ey + Math.sin(a) * 0.012],
    [ex + Math.cos(a) * 0.004, ey + Math.sin(a) * 0.004 + 0.002],
    [ex + Math.cos(a - 1.57) * l.w * 0.5, ey + Math.sin(a - 1.57) * l.w * 0.5],
  ]);
  ctx.fillStyle = '#d9c29a';
  ctx.fill();
}

