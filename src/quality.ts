import type { Look } from './gl/painter';

export interface Tier {
  name: string;
  look: Look;
  /** Share of the brush strokes drawn. */
  strokes: number;
  /** Draws at most 30 frames a second. */
  halfRate: boolean;
  /** Frame time relative to the full tier where the GPU is what's slow, measured pouring at 1800x1125 on an M4 Pro. */
  gpuCost: number;
}

export const TIERS: Tier[] = [
  { name: 'full', look: { scale: 1, baked: false, lean: false }, strokes: 1, halfRate: false, gpuCost: 1 },
  { name: 'baked', look: { scale: 1, baked: true, lean: false }, strokes: 1, halfRate: false, gpuCost: 0.78 },
  { name: 'fine', look: { scale: 0.84, baked: true, lean: false }, strokes: 1, halfRate: false, gpuCost: 0.67 },
  { name: 'soft', look: { scale: 0.7, baked: true, lean: false }, strokes: 1, halfRate: false, gpuCost: 0.57 },
  { name: 'lean', look: { scale: 0.7, baked: true, lean: true }, strokes: 0.7, halfRate: false, gpuCost: 0.55 },
  { name: 'low', look: { scale: 0.58, baked: true, lean: true }, strokes: 0.6, halfRate: false, gpuCost: 0.5 },
  { name: 'half', look: { scale: 0.58, baked: true, lean: true }, strokes: 0.6, halfRate: true, gpuCost: 0.5 },
];

export function tierNamed(name: string | null): number {
  if (name === null) return -1;
  const n = Number(name);
  if (name !== '' && Number.isInteger(n) && n >= 0 && n < TIERS.length) return n;
  return TIERS.findIndex((t) => t.name === name);
}

/** Share of recent heavy frames that missed their slot before the look steps down, and the most allowed to count as smooth. */
const SLOW = 0.12;
const SMOOTH = 0.02;
/** A frame misses when it takes this many times the frame slot. */
const MISS = 1.5;
/** Frames rendering the full living view kept for judging, about ten seconds' worth. */
const WINDOW = 600;
/** Heavy frames needed before judging; half as many do when most of them miss. */
const ENOUGH = 60;
/** Frames drawn with nothing, to time the display alone. */
const CALIBRATE_FRAMES = 6;
/** A calibration older than this is taken again before acting on it, as a battery saver may have capped the display since. */
const CALIBRATION_TTL = 20000;
const WARMUP_MS = 1200;
const SETTLE_MS = 700;
/** Stepping down picks the first tier whose predicted frame fits in this share of its slot. */
const DOWN_MARGIN = 0.85;
/**
 * Nothing in a browser says how much room a frame that keeps up has left (GPU timers read high at light load, as the
 * GPU clocks down), so the look steps back up on trial after this many smooth chapters in a row, and waits three times
 * as long again each time that tier has failed a trial.
 */
const TRIAL_AFTER = 2;

const quantile = (a: number[], q: number): number => {
  if (!a.length) return NaN;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))];
};

const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;

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
  /** Time between drawn frames that rendered the full living view, the work the tiers change. */
  private heavy: number[] = [];
  /**
   * Script time of those same frames. No tier shortens it but half rate, so it bars trying a tier it can't fit. It only
   * means that while frames keep up: when the GPU falls behind, its backlog stalls the script too.
   */
  private js: number[] = [];
  /** Time between animation frames of any kind, for a first guess at the display's rate. */
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
  private failures: number[] = TIERS.map(() => 0);
  private steppedUpTo = -1;
  private smoothRuns = 0;
  private drawing = true;

  /** `locked` keeps the tier it starts with, for QA. */
  constructor(tier: number, private locked = false) {
    this.tier = tier;
    document.addEventListener('visibilitychange', () => this.quiet(performance.now()));
  }

  /** Called at the top of every animation frame. Returns whether the frame should draw. */
  frame(now: number): boolean {
    if (this.start < 0) this.start = now;
    const delta = this.lastNow < 0 ? 0 : now - this.lastNow;
    this.lastNow = now;
    if (this.calibrating > 0) {
      // The first two may still be waiting on the last real frame.
      if (this.calibrating <= CALIBRATE_FRAMES - 2 && delta > 0) this.calibration.push(delta);
      this.calibrating--;
      if (this.calibrating === 0) {
        this.vsync = quantile(this.calibration, 0.5);
        this.calibratedAt = now;
        console.debug(`[quality] display timed at ${this.vsync.toFixed(1)} ms a frame`);
        this.quiet(now);
      }
      this.drawing = false;
      return false;
    }
    if (TIERS[this.tier].halfRate && this.lastDrawn >= 0 && now - this.lastDrawn < 1000 / 30 - this.display() / 2) {
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

  /** Called after each drawn frame with whether it rendered the full living view and how long its script ran. */
  drawn(now: number, heavy: boolean, jsMs: number): void {
    if (!this.drawing) return;
    const delta = this.lastDrawn < 0 ? 0 : now - this.lastDrawn;
    this.lastDrawn = now;
    if (!heavy || delta <= 0 || delta >= 250 || now < this.quietUntil || now - this.start < WARMUP_MS) return;
    this.heavy.push(delta);
    this.js.push(jsMs);
    if (this.heavy.length > WINDOW) {
      this.heavy.shift();
      this.js.shift();
    }
  }

  /** The next frames do one-off work (a new scene, a new look, a hidden tab), so they say nothing about the tier. */
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
    return this.heavy.filter((d) => d > limit).length / this.heavy.length;
  }

  get stats() {
    return {
      tier: TIERS[this.tier].name,
      display: +this.display().toFixed(2),
      calibrated: Number.isFinite(this.vsync),
      heavyFrames: this.heavy.length,
      missRatio: this.heavy.length ? +this.missRatio().toFixed(3) : null,
      frameMs: this.heavy.length ? +mean(this.heavy).toFixed(2) : null,
      jsMs: this.js.length ? +quantile(this.js, 0.5).toFixed(2) : null,
    };
  }

  get timing(): boolean {
    return this.calibrating > 0;
  }

  /**
   * The game is at a moment when the look can change unseen; ask once per such moment. Returns the tier to switch to,
   * or null to stay. It may first start `timing`, drawing nothing for a few frames to time the display on its own; ask
   * again once that is done. `trial` is false when a failed trial couldn't be undone before the end.
   */
  safeMoment(trial = true, now = this.lastNow): Decision | null {
    if (this.locked || this.calibrating > 0 || this.heavy.length < ENOUGH / 2 || now - this.lastChange < 5000) return null;
    const miss = this.missRatio();
    if (this.heavy.length < ENOUGH && miss < 0.5) return null;
    if (now - this.calibratedAt > CALIBRATION_TTL && (miss > SLOW || this.display() > 20)) {
      this.calibrating = CALIBRATE_FRAMES;
      this.calibration = [];
      return null;
    }
    const frame = mean(this.heavy);
    const js = quantile(this.js, 0.5);
    const fits = (t: number) => frame * TIERS[t].gpuCost / TIERS[this.tier].gpuCost <= this.slot(t) * DOWN_MARGIN;
    if (miss > SLOW && this.tier < TIERS.length - 1) {
      if (this.steppedUpTo === this.tier) this.failures[this.tier]++;
      this.steppedUpTo = -1;
      const last = this.lastChange < 0 ? TIERS.length - 1 : Math.min(TIERS.length - 1, this.tier + 2);
      let to = this.tier + 1;
      while (to < last && !fits(to)) to++;
      return this.change(to, now, `${(miss * 100).toFixed(0)}% of frames missed a ${this.slot().toFixed(1)} ms slot, averaging ${frame.toFixed(1)} ms`);
    }
    this.smoothRuns = miss < SMOOTH ? this.smoothRuns + 1 : 0;
    const to = this.tier - 1;
    if (trial && to >= 0 && js <= this.slot(to) * DOWN_MARGIN && this.smoothRuns >= TRIAL_AFTER * 3 ** this.failures[to]) {
      const d = this.change(to, now, `smooth for ${this.smoothRuns} chapters with ${js.toFixed(1)} ms of script a frame; trying ${TIERS[to].name}`);
      this.steppedUpTo = to;
      return d;
    }
    return null;
  }

  private change(to: number, now: number, reason: string): Decision {
    this.tier = to;
    this.lastChange = now;
    this.smoothRuns = 0;
    this.heavy = [];
    this.js = [];
    this.quiet(now);
    return { tier: to, reason };
  }
}
