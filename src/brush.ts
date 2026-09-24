import type { Dab } from './gl/painter';
import { ASPECT } from './gl/painter';

const GW = 160;
const GH = 100;

/** Low-resolution copy of the paint mask, used to tell when a subject has been painted. */
export class Coverage {
  readonly grid = new Float32Array(GW * GH);

  clear(): void {
    this.grid.fill(0);
  }

  add(d: Dab): void {
    const r = d.r;
    const rx = r / ASPECT;
    const x0 = Math.max(0, Math.floor((d.x - rx) * GW));
    const x1 = Math.min(GW - 1, Math.ceil((d.x + rx) * GW));
    const y0 = Math.max(0, Math.floor((d.y - r) * GH));
    const y1 = Math.min(GH - 1, Math.ceil((d.y + r) * GH));
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const dx = ((gx + 0.5) / GW - d.x) * ASPECT;
        const dy = (gy + 0.5) / GH - d.y;
        const q = Math.sqrt(dx * dx + dy * dy) / r;
        if (q >= 1) continue;
        const i = gy * GW + gx;
        this.grid[i] = Math.min(1, this.grid[i] + d.strength * 1.6 * (1 - q * q));
      }
    }
  }

  /** Mean coverage inside an ellipse given in scene units (x 0..ASPECT, y 0..1). */
  ellipse(cx: number, cy: number, rx: number, ry: number): number {
    let sum = 0;
    let n = 0;
    const x0 = Math.max(0, Math.floor(((cx - rx) / ASPECT) * GW));
    const x1 = Math.min(GW - 1, Math.ceil(((cx + rx) / ASPECT) * GW));
    const y0 = Math.max(0, Math.floor((cy - ry) * GH));
    const y1 = Math.min(GH - 1, Math.ceil((cy + ry) * GH));
    for (let gy = y0; gy <= y1; gy++) {
      for (let gx = x0; gx <= x1; gx++) {
        const dx = (((gx + 0.5) / GW) * ASPECT - cx) / rx;
        const dy = ((gy + 0.5) / GH - cy) / ry;
        if (dx * dx + dy * dy > 1) continue;
        sum += Math.min(1, this.grid[gy * GW + gx] * 1.5);
        n++;
      }
    }
    return n ? sum / n : 0;
  }

  total(): number {
    let sum = 0;
    for (let i = 0; i < this.grid.length; i++) sum += Math.min(1, this.grid[i] * 1.5);
    return sum / this.grid.length;
  }

  region(y0: number, y1: number): number {
    let sum = 0;
    let n = 0;
    for (let gy = Math.floor(y0 * GH); gy < Math.min(GH, Math.ceil(y1 * GH)); gy++) {
      for (let gx = 0; gx < GW; gx++) {
        sum += Math.min(1, this.grid[gy * GW + gx] * 1.5);
        n++;
      }
    }
    return n ? sum / n : 0;
  }
}

interface Sample { x: number; y: number; pressure: number; pen: boolean }

/**
 * Turns pointer and keyboard input on the board into brush dabs.
 * Positions are painting uv (0..1, y down).
 */
export class Brush {
  down = false;
  x = 0.5;
  y = 0.5;
  speed = 0;
  inside = false;
  radius = 0.03;
  scale = 1;
  enabled = false;
  keyboard = false;
  private samples: Sample[] = [];
  private last: { x: number; y: number } | null = null;
  private carry = 0;
  private seed = 1;
  private keys = new Set<string>();
  private pointerId: number | null = null;
  onFirstPaint: (() => void) | null = null;
  onChange: (() => void) | null = null;

  constructor(private el: HTMLElement) {
    el.addEventListener('pointerdown', (e) => this.pointerDown(e));
    window.addEventListener('pointermove', (e) => this.pointerMove(e));
    window.addEventListener('pointerup', (e) => this.pointerUp(e));
    window.addEventListener('pointercancel', (e) => this.pointerUp(e));
    el.addEventListener('pointerenter', () => { this.inside = true; this.onChange?.(); });
    el.addEventListener('pointerleave', () => { this.inside = false; this.onChange?.(); });
    window.addEventListener('keydown', (e) => this.keyDown(e));
    window.addEventListener('keyup', (e) => this.keyUp(e));
    window.addEventListener('blur', () => this.release());
  }

  private toUV(e: PointerEvent): { x: number; y: number } {
    const r = this.el.getBoundingClientRect();
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  }

  private pointerDown(e: PointerEvent): void {
    if (!this.enabled || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    this.keyboard = false;
    this.pointerId = e.pointerId;
    this.el.setPointerCapture?.(e.pointerId);
    const p = this.toUV(e);
    this.x = p.x;
    this.y = p.y;
    this.down = true;
    this.last = null;
    this.samples.push({ ...p, pressure: e.pointerType === 'pen' ? e.pressure : 0.5, pen: e.pointerType === 'pen' });
    this.onFirstPaint?.();
    this.onChange?.();
  }

  private pointerMove(e: PointerEvent): void {
    const p = this.toUV(e);
    if (!this.keyboard) {
      this.x = p.x;
      this.y = p.y;
    }
    if (!this.down || e.pointerId !== this.pointerId) return;
    const events = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    for (const ce of events.length ? events : [e]) {
      const q = this.toUV(ce);
      this.samples.push({ ...q, pressure: ce.pointerType === 'pen' ? ce.pressure : 0.5, pen: ce.pointerType === 'pen' });
    }
  }

  private pointerUp(e: PointerEvent): void {
    if (e.pointerId !== this.pointerId) return;
    this.pointerId = null;
    this.release();
  }

  release(): void {
    if (!this.down) return;
    this.down = false;
    this.last = null;
    this.samples.length = 0;
    this.onChange?.();
  }

  private keyDown(e: KeyboardEvent): void {
    const k = e.key;
    if (!this.enabled) return;
    if (k.startsWith('Arrow')) {
      e.preventDefault();
      if (!this.keyboard) {
        this.keyboard = true;
        this.inside = true;
      }
      this.keys.add(k);
      this.onChange?.();
    } else if (k === ' ' && this.keyboard) {
      e.preventDefault();
      if (!this.down) {
        this.down = true;
        this.last = null;
        this.samples.push({ x: this.x, y: this.y, pressure: 0.5, pen: false });
        this.onFirstPaint?.();
        this.onChange?.();
      }
    }
  }

  private keyUp(e: KeyboardEvent): void {
    this.keys.delete(e.key);
    if (e.key === ' ' && this.keyboard) this.release();
  }

  /** Advances the brush and returns the dabs laid down since the last call. */
  update(dt: number): Dab[] {
    if (this.keyboard && this.keys.size) {
      const v = 0.32 * dt;
      if (this.keys.has('ArrowLeft')) this.x -= v / ASPECT;
      if (this.keys.has('ArrowRight')) this.x += v / ASPECT;
      if (this.keys.has('ArrowUp')) this.y -= v;
      if (this.keys.has('ArrowDown')) this.y += v;
      this.x = Math.min(1, Math.max(0, this.x));
      this.y = Math.min(1, Math.max(0, this.y));
      if (this.down) this.samples.push({ x: this.x, y: this.y, pressure: 0.5, pen: false });
    }
    const dabs: Dab[] = [];
    if (!this.down) {
      this.speed *= Math.exp(-dt * 8);
      return dabs;
    }
    if (this.samples.length === 0) this.samples.push({ x: this.x, y: this.y, pressure: 0.5, pen: false });
    let travelled = 0;
    for (const s of this.samples) {
      if (!this.last) {
        this.last = { x: s.x, y: s.y };
        dabs.push(this.dab(s.x, s.y, 0, s));
        continue;
      }
      const dx = (s.x - this.last.x) * ASPECT;
      const dy = s.y - this.last.y;
      const d = Math.hypot(dx, dy);
      travelled += d;
      const ang = Math.atan2(dy, dx);
      const spacing = this.radius * this.scale * 0.22;
      let pos = spacing - this.carry;
      while (pos <= d) {
        const u = pos / d;
        dabs.push(this.dab(this.last.x + (s.x - this.last.x) * u, this.last.y + (s.y - this.last.y) * u, ang, s));
        pos += spacing;
      }
      this.carry = d - (pos - spacing);
      this.last = { x: s.x, y: s.y };
    }
    this.samples.length = 0;
    const inst = dt > 0 ? travelled / dt : 0;
    this.speed += (inst - this.speed) * Math.min(1, dt * 10);
    if (dabs.length === 0 && dt > 0) {
      dabs.push(this.dab(this.x, this.y, 0, { x: this.x, y: this.y, pressure: 0.5, pen: false }, 0.35 * Math.min(1, dt * 20)));
    }
    return dabs;
  }

  private dab(x: number, y: number, angle: number, s: Sample, k = 1): Dab {
    const speedK = Math.max(0.65, Math.min(1.15, 1.18 - this.speed * 0.22));
    const pressureK = s.pen ? 0.45 + s.pressure * 0.9 : 1;
    this.seed = (this.seed * 16807) % 2147483647;
    return {
      x,
      y,
      r: this.radius * this.scale * speedK * pressureK,
      strength: 0.2 * k,
      angle,
      seed: (this.seed % 1000) / 10,
    };
  }
}
