export type RGB = [number, number, number];

/** Parses '#rrggbb' or 'rgb(r,g,b)'. */
export function hex(h: string): RGB {
  if (h.charCodeAt(0) !== 35) {
    const m = h.match(/-?[\d.]+/g);
    return m ? [Number(m[0]), Number(m[1]), Number(m[2])] : [0, 0, 0];
  }
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function css(c: RGB, a = 1): string {
  return a >= 1
    ? `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`
    : `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
}

export function mixRGB(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

export function mixHex(a: string, b: string, t: number): string {
  return css(mixRGB(hex(a), hex(b), t));
}

export function shade(h: string, k: number): string {
  const c = hex(h);
  return css(k >= 0 ? mixRGB(c, [255, 255, 255], k) : mixRGB(c, [0, 0, 0], -k));
}

export function withAlpha(h: string, a: number): string {
  return css(hex(h), a);
}

export function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123;
  return s - Math.floor(s);
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export const smooth = (a: number, b: number, v: number) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};

export type Pt = [number, number];

export function poly(ctx: CanvasRenderingContext2D, pts: Pt[], close = true): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

export function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string): void {
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0, r), 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

export function ellipse(
  ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, rot: number, fill: string,
): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), rot, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

/** Interpolates a polyline sorted by y and returns x at the given y. */
export function xAtY(pts: Pt[], y: number): number {
  if (y <= pts[0][1]) return pts[0][0];
  for (let i = 1; i < pts.length; i++) {
    if (y <= pts[i][1]) {
      const a = pts[i - 1];
      const b = pts[i];
      const t = (y - a[1]) / (b[1] - a[1] || 1);
      return lerp(a[0], b[0], t);
    }
  }
  return pts[pts.length - 1][0];
}
