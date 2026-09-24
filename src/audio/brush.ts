import type { BrushSpec, ChordSpan } from './compose';
import type { Outs, Synth } from './synth';
import { clamp, pc } from './theory';
import { loopBuffer } from './tones';

export interface BrushTarget {
  /** Context time of the current score's first beat, for the eighth-note grid. */
  t0: number;
  eighth: number;
  harmony(t: number): ChordSpan;
  spec: BrushSpec;
  outs: Outs;
}

export interface BrushNote {
  t: number;
  midi: number;
  gridIndex: number;
  allowed: number[];
}

const MAX_RATE_GAP = 0.25;
const RUN = 8;

/** Pitches the brush may play: chord tones on the beat, gentle scale tones between beats. */
export function brushPitches(span: ChordSpan, lo: number, hi: number, onBeat: boolean): number[] {
  const chordPcs = span.chord.pcs;
  const allowed = new Set(chordPcs);
  if (!onBeat) {
    for (const deg of span.key.scale) {
      const p = pc(span.key.tonic + deg);
      const rubs = chordPcs.some((c) => pc(p - c) === 1 || pc(c - p) === 1);
      if (!rubs) allowed.add(p);
    }
  }
  const out: number[] = [];
  for (let m = lo; m <= hi; m++) if (allowed.has(pc(m))) out.push(m);
  return out;
}

/**
 * The brush as an instrument: a quiet bristle hiss that follows speed, and notes on the
 * score's eighth-note grid whose pitch follows height and whose pan follows x.
 */
export class Brush {
  onNote: ((n: BrushNote) => void) | null = null;
  private lastNote = -Infinity;
  private lastMove = -1;
  private lastParam = -1;
  private dist = 0;
  private run = 0;
  private restUntil = 0;
  private lastMidi = -1;
  private prevMidi = -1;
  private lastY = 0.5;
  private wakeFree = 0;
  private recent: number[] = [];
  private bristle: { src: AudioBufferSourceNode; nodes: AudioNode[]; g: GainNode; bp: BiquadFilterNode; pan: StereoPannerNode } | null = null;

  constructor(
    private readonly synth: Synth,
    private readonly target: () => BrushTarget | null,
  ) {}

  move(x: number, y: number, speed: number, now: number): void {
    const tg = this.target();
    if (!tg) return;
    const sp = Number.isFinite(speed) ? Math.max(0, speed) : 0;
    this.hiss(x, sp, now);
    const dt = this.lastMove < 0 ? 0 : clamp(now - this.lastMove, 0, 0.1);
    this.lastMove = now;
    this.dist += sp * dt;
    const dy = y - this.lastY;
    this.lastY = y;
    if (sp < 0.06 || this.lastNote > now || this.dist < 0.03) return;

    const e = tg.eighth;
    let idx = Math.ceil((now + 0.03 - tg.t0) / e);
    while (tg.t0 + idx * e < this.lastNote + Math.max(MAX_RATE_GAP, e) - 1e-4) idx++;
    const g = tg.t0 + idx * e;
    if (g < this.restUntil) return;
    const onBeat = idx % 2 === 0;
    if (!onBeat && sp < 1.1) return;
    if (this.run >= RUN) {
      this.run = 0;
      this.restUntil = g + 2 * e;
      return;
    }

    const span = tg.harmony(g);
    const spec = tg.spec;
    const pitches = brushPitches(span, spec.lo, spec.hi, onBeat);
    if (!pitches.length) return;
    let i = Math.round((1 - clamp(y, 0, 1)) * (pitches.length - 1));
    if (pitches[i] === this.lastMidi && this.lastMidi === this.prevMidi) {
      i = clamp(i + (dy < 0 ? 1 : -1), 0, pitches.length - 1);
    }
    const midi = pitches[i];
    this.recent = this.recent.filter((t) => t > g - 10);
    const fatigue = this.recent.length > 24 ? 0.8 : 1;
    const vel = spec.vel * (0.55 + 0.45 * clamp(sp / 2.2, 0, 1)) * fatigue * (onBeat ? 1 : 0.85);
    this.synth.note(
      { kind: 'note', t: 0, inst: spec.inst, midi, vel, dur: spec.dur, pan: clamp((x - 0.5) * 1.4, -0.8, 0.8), bus: spec.bus, bright: spec.bright, attack: spec.attack },
      g,
      tg.outs,
      this,
    );
    this.onNote?.({ t: g, midi, gridIndex: idx, allowed: pitches });
    this.lastNote = g;
    this.dist = 0;
    this.run++;
    this.prevMidi = this.lastMidi;
    this.lastMidi = midi;
    this.recent.push(g);
  }

  up(now: number): void {
    this.run = 0;
    this.dist = 0;
    this.lastMove = -1;
    const b = this.bristle;
    if (!b) return;
    this.bristle = null;
    b.g.gain.cancelScheduledValues(now);
    b.g.gain.setTargetAtTime(0, now, 0.03);
    b.src.stop(now + 0.25);
    b.src.onended = () => {
      for (const n of b.nodes) n.disconnect();
    };
  }

  /** A small rising flourish in the current chord, panned to where the thing woke. */
  wake(x: number, now: number): void {
    const tg = this.target();
    if (!tg) return;
    const e = tg.eighth;
    const start = Math.max(now + 0.03, this.wakeFree);
    const g = tg.t0 + Math.ceil((start - tg.t0) / e) * e;
    const spec = tg.spec;
    const span = tg.harmony(g);
    const tones = brushPitches(span, spec.lo + 5, spec.hi + 5, true);
    const mid = (spec.lo + spec.hi) / 2;
    let first = tones.findIndex((m) => m >= mid - 4);
    if (first < 0) first = 0;
    const run = tones.slice(first, first + 4);
    const pan = clamp((x - 0.5) * 1.4, -0.8, 0.8);
    run.forEach((midi, i) => {
      const last = i === run.length - 1;
      this.synth.note(
        { kind: 'note', t: 0, inst: spec.inst, midi, vel: 0.36 + i * 0.04, dur: last ? spec.dur * 1.5 : e, pan, bus: 'wet', bright: 1.1, attack: spec.attack },
        g + (i * e) / 2,
        tg.outs,
        this,
      );
    });
    const top = run[run.length - 1];
    if (top !== undefined) {
      this.synth.note({ kind: 'note', t: 0, inst: spec.inst, midi: top + 12, vel: 0.22, dur: spec.dur, pan: -pan * 0.5, bus: 'wet', bright: 1.1 }, g + e * 2, tg.outs, this);
    }
    this.wakeFree = g + e * 3;
  }

  private hiss(x: number, speed: number, now: number): void {
    const s = this.synth;
    const c = s.ctx;
    if (!this.bristle) {
      const src = c.createBufferSource();
      src.buffer = loopBuffer('pink');
      src.loop = true;
      src.playbackRate.value = 1.7;
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2500;
      bp.Q.value = 0.9;
      const hp = c.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 900;
      const g = s.gain(0);
      const pan = c.createStereoPanner();
      src.connect(hp).connect(bp).connect(g).connect(pan).connect(s.bristle);
      src.start(now, Math.random() * 2);
      this.bristle = { src, nodes: [src, hp, bp, g, pan], g, bp, pan };
      this.lastParam = -1;
    }
    if (now - this.lastParam < 0.03) return;
    this.lastParam = now;
    const b = this.bristle;
    const k = clamp(speed / 2, 0, 1);
    b.g.gain.setTargetAtTime(0.12 * Math.pow(k, 0.8), now, 0.05);
    b.bp.frequency.setTargetAtTime(1800 + 2600 * clamp(speed / 2.5, 0, 1), now, 0.06);
    b.pan.pan.setTargetAtTime(clamp((x - 0.5) * 1.2, -0.8, 0.8), now, 0.06);
  }
}
