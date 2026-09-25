import type { GL } from './gl/gl';
import type { Look } from './gl/painter';

export interface Tier {
  name: string;
  look: Look;
  /** Share of the brush strokes drawn. */
  strokes: number;
  /** Draws at most 30 frames a second. */
  halfRate: boolean;
  /** GPU time per frame relative to the full tier, measured while pouring (see tools/README.md). */
  gpuCost: number;
}

export const TIERS: Tier[] = [
  { name: 'full', look: { scale: 1, baked: false, lean: false }, strokes: 1, halfRate: false, gpuCost: 1 },
  { name: 'baked', look: { scale: 1, baked: true, lean: false }, strokes: 1, halfRate: false, gpuCost: 0.8 },
  { name: 'fine', look: { scale: 0.84, baked: true, lean: false }, strokes: 1, halfRate: false, gpuCost: 0.66 },
  { name: 'soft', look: { scale: 0.7, baked: true, lean: false }, strokes: 1, halfRate: false, gpuCost: 0.54 },
  { name: 'lean', look: { scale: 0.7, baked: true, lean: true }, strokes: 0.7, halfRate: false, gpuCost: 0.48 },
  { name: 'low', look: { scale: 0.58, baked: true, lean: true }, strokes: 0.6, halfRate: false, gpuCost: 0.4 },
  { name: 'half', look: { scale: 0.58, baked: true, lean: true }, strokes: 0.6, halfRate: true, gpuCost: 0.4 },
];

export function tierNamed(name: string | null): number {
  if (name === null) return -1;
  const n = Number(name);
  if (name !== '' && Number.isInteger(n) && n >= 0 && n < TIERS.length) return n;
  return TIERS.findIndex((t) => t.name === name);
}

/** Share of recent heavy frames that missed their slot before the look steps down, and the most allowed before it steps up. */
const SLOW = 0.12;
const SMOOTH = 0.02;
/** A frame misses when it takes this many times the frame slot. */
const MISS = 1.5;
/** Frames rendering the full living view kept for judging, about ten seconds' worth. */
const WINDOW = 600;
/** Heavy frames needed before judging; half as many do when most of them miss. */
const ENOUGH = 60;
/** Frames drawn nothing to time the display alone. */
const CALIBRATE_FRAMES = 6;
/** A calibration older than this is taken again before acting on it, as a battery saver may have capped the display since. */
const CALIBRATION_TTL = 20000;
const WARMUP_MS = 1200;
const SETTLE_MS = 700;
/** The predicted frame must fit in this share of its slot to step up, halved for each time that tier has failed. */
const UP_MARGIN = 0.7;
/** And this share to settle on a tier when stepping down. */
const DOWN_MARGIN = 0.85;

/**
 * GPU time per frame: timer queries where the browser has them, otherwise how long a fence takes to pass, sampled
 * every few frames. Either way it only ever reads results a frame or more later, so it never stalls the GPU.
 */
export class GpuClock {
  private ext: { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  private pending: { q: WebGLQuery; heavy: boolean }[] = [];
  private active: WebGLQuery | null = null;
  private fencing = false;
  private frame = 0;
  readonly samples: number[] = [];

  constructor(private gl: GL, timers: boolean) {
    this.ext = timers ? gl.getExtension('EXT_disjoint_timer_query_webgl2') : null;
  }

  get kind(): string {
    return this.ext ? 'timer' : 'fence';
  }

  begin(): void {
    this.frame++;
    if (!this.ext || this.pending.length > 6) return;
    const q = this.gl.createQuery();
    if (!q) return;
    this.gl.beginQuery(this.ext.TIME_ELAPSED_EXT, q);
    this.active = q;
  }

  /** `heavy`: whether the frame rendered the full living view; only those are kept. */
  end(heavy: boolean): void {
    const gl = this.gl;
    if (this.ext) {
      if (this.active) {
        gl.endQuery(this.ext.TIME_ELAPSED_EXT);
        this.pending.push({ q: this.active, heavy });
        this.active = null;
      }
      this.poll();
      return;
    }
    if (!heavy || this.fencing || this.frame % 8 !== 0) return;
    const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (!fence) return;
    gl.flush();
    this.fencing = true;
    const t0 = performance.now();
    const check = () => {
      const ms = performance.now() - t0;
      const status = gl.clientWaitSync(fence, 0, 0);
      if (status === gl.TIMEOUT_EXPIRED && ms < 200) {
        setTimeout(check, 1);
        return;
      }
      gl.deleteSync(fence);
      this.fencing = false;
      if (status !== gl.WAIT_FAILED && status !== gl.TIMEOUT_EXPIRED) this.push(ms);
    };
    setTimeout(check, 0);
  }

  private poll(): void {
    const gl = this.gl;
    const ext = this.ext!;
    const disjoint = gl.getParameter(ext.GPU_DISJOINT_EXT);
    while (this.pending.length) {
      const { q, heavy } = this.pending[0];
      if (!gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) break;
      this.pending.shift();
      const ns = gl.getQueryParameter(q, gl.QUERY_RESULT) as number;
      gl.deleteQuery(q);
      if (!disjoint && heavy) this.push(ns / 1e6);
    }
  }

  private push(ms: number): void {
    this.samples.push(ms);
    if (this.samples.length > 240) this.samples.shift();
  }

  reset(): void {
    this.samples.length = 0;
  }
}

const quantile = (a: number[], q: number): number => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

interface Sample {
  delta: number;
  js: number;
}

export interface Decision {
  tier: number;
  reason: string;
}

/**
 * Watches how long frames take against the display's own frame rate and picks a tier. It only suggests a change when
 * asked at a moment the game has chosen as safe; it never changes anything by itself.
 */
export class Governor {
  tier: number;
  private heavy: Sample[] = [];
  private deltas: number[] = [];
  private lastNow = -1;
  private lastDrawn = -1;
  private start = -1;
  private quietUntil = 0;
  private calibrating = 0;
  private calibration: number[] = [];
  private vsync = NaN;
  private calibratedAt = -Infinity;
  private lastChange = -Infinity;
  private upFailures: number[] = TIERS.map(() => 0);
  private steppedUpTo = -1;
  private drawing = true;

  /** `locked` keeps the tier it starts with, for QA. */
  constructor(tier: number, private clock: GpuClock | null, private locked = false) {
    this.tier = tier;
    document.addEventListener('visibilitychange', () => this.quiet(performance.now()));
  }

  /** Called at the top of every animation frame. Returns whether the frame should draw. */
  frame(now: number): boolean {
    if (this.start < 0) this.start = now;
    const delta = this.lastNow < 0 ? 0 : now - this.lastNow;
    this.lastNow = now;
    if (this.calibrating > 0) {
      if (this.calibrating <= CALIBRATE_FRAMES - 2 && delta > 0) this.calibration.push(delta);
      this.calibrating--;
      if (this.calibrating === 0) {
        this.vsync = quantile(this.calibration, 0.5);
        this.calibratedAt = now;
        this.quietUntil = now + 100;
        this.lastDrawn = -1;
      }
      this.drawing = false;
      return false;
    }
    const t = TIERS[this.tier];
    if (t.halfRate && this.lastDrawn >= 0 && now - this.lastDrawn < 1000 / 30 - this.display() / 2) {
      this.drawing = false;
      return false;
    }
    this.drawing = true;
    if (delta > 0 && delta < 250 && now >= this.quietUntil && now - this.start > WARMUP_MS) {
      this.deltas.push(delta);
      if (this.deltas.length > 240) this.deltas.shift();
    }
    return true;
  }

  /** Called after a drawn frame with its JS time and whether it rendered the full living view. */
  drawn(now: number, jsMs: number, heavy: boolean): void {
    if (!this.drawing) return;
    const delta = this.lastDrawn < 0 ? 0 : now - this.lastDrawn;
    this.lastDrawn = now;
    if (!heavy || delta <= 0 || delta >= 250 || now < this.quietUntil || now - this.start < WARMUP_MS) return;
    this.heavy.push({ delta, js: jsMs });
    if (this.heavy.length > WINDOW) this.heavy.shift();
  }

  /** The next frames do one-off work (a new scene, a new look), so they say nothing about the tier. */
  quiet(now = this.lastNow): void {
    this.quietUntil = now + SETTLE_MS;
    this.lastDrawn = -1;
  }

  private display(): number {
    if (Number.isFinite(this.vsync)) return this.vsync;
    const d = quantile(this.deltas, 0.1);
    return Number.isFinite(d) ? Math.max(4, d) : 1000 / 60;
  }

  /** The time each drawn frame has: the display's own interval, but never less than a 60 Hz frame, or 30 Hz at half rate. */
  private slot(tier = this.tier): number {
    return Math.max(this.display(), TIERS[tier].halfRate ? 1000 / 30 : 1000 / 60);
  }

  private missRatio(): number {
    const limit = this.slot() * MISS;
    return this.heavy.filter((s) => s.delta > limit).length / this.heavy.length;
  }

  get stats() {
    const gpu = this.clock ? quantile(this.clock.samples, 0.75) : NaN;
    return {
      tier: TIERS[this.tier].name,
      display: +this.display().toFixed(2),
      calibrated: Number.isFinite(this.vsync),
      heavyFrames: this.heavy.length,
      missRatio: this.heavy.length ? +this.missRatio().toFixed(3) : null,
      gpuMs: Number.isFinite(gpu) ? +gpu.toFixed(2) : null,
      jsMs: this.heavy.length ? +quantile(this.heavy.map((s) => s.js), 0.75).toFixed(2) : null,
      clock: this.clock?.kind ?? null,
    };
  }

  /** How long a frame takes now, from GPU time where known and otherwise from the frame times themselves. */
  private cost(): { gpu: number; js: number; measured: boolean } {
    const js = quantile(this.heavy.map((s) => s.js), 0.75);
    const gpu = this.clock ? quantile(this.clock.samples, 0.75) : NaN;
    if (Number.isFinite(gpu)) return { gpu, js, measured: true };
    return { gpu: quantile(this.heavy.map((s) => s.delta), 0.5), js, measured: false };
  }

  private predict(c: { gpu: number; js: number }, to: number): number {
    const from = TIERS[this.tier];
    return Math.max(c.js, c.gpu * TIERS[to].gpuCost / from.gpuCost);
  }

  /**
   * The game is at a moment when the look can change unseen. Returns the tier to switch to, or null to stay. It may
   * first ask for a few frames drawn with nothing, to time the display on its own; ask again on the next frames.
   */
  safeMoment(now = this.lastNow): Decision | null {
    if (this.locked || this.calibrating > 0 || this.heavy.length < ENOUGH / 2 || now - this.lastChange < 5000) return null;
    const miss = this.missRatio();
    if (this.heavy.length < ENOUGH && miss < 0.5) return null;
    const stale = now - this.calibratedAt > CALIBRATION_TTL;
    if (stale && (miss > SLOW || this.display() > 20)) {
      this.calibrating = CALIBRATE_FRAMES;
      this.calibration = [];
      return null;
    }
    const slot = this.slot();
    const c = this.cost();
    if (miss > SLOW && this.tier < TIERS.length - 1) {
      if (this.steppedUpTo === this.tier) this.upFailures[this.tier]++;
      this.steppedUpTo = -1;
      let to = this.tier + 1;
      const most = this.lastChange < 0 ? TIERS.length - 1 : this.tier + 2;
      while (to < Math.min(most, TIERS.length - 1) && this.predict(c, to) > this.slot(to) * DOWN_MARGIN) to++;
      return this.change(to, now, `${(miss * 100).toFixed(0)}% of frames missed a ${slot.toFixed(1)} ms slot; frame ~${Math.max(c.gpu, c.js).toFixed(1)} ms`);
    }
    if (miss < SMOOTH && this.tier > 0 && c.measured) {
      const to = this.tier - 1;
      const fit = this.predict(c, to);
      const margin = UP_MARGIN / 2 ** this.upFailures[to];
      if (fit < this.slot(to) * margin) {
        const d = this.change(to, now, `frames fit (${c.gpu.toFixed(1)} ms GPU, ${c.js.toFixed(1)} ms JS); ${TIERS[to].name} predicted ${fit.toFixed(1)} ms`);
        this.steppedUpTo = to;
        return d;
      }
    }
    return null;
  }

  private change(to: number, now: number, reason: string): Decision {
    this.tier = to;
    this.lastChange = now;
    this.heavy = [];
    this.clock?.reset();
    this.quiet(now);
    return { tier: to, reason };
  }
}
