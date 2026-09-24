import type { ScoreId } from './index';
import type { AmbToneId, ToneId } from './tones';
import { chord, noteToMidi, rng, stepToMidi, voice, type Chord, type Key } from './theory';

export type InstId = ToneId | 'bass';
export type PadId = 'pad' | 'lowpad' | 'horn' | 'shimmer';
export type Bus = 'dry' | 'wet' | 'amb' | 'far';

export interface NoteEv {
  kind: 'note';
  t: number;
  inst: InstId;
  midi: number;
  vel: number;
  /** Seconds the key is held; struck instruments ring past it. */
  dur: number;
  pan: number;
  bus?: Bus;
  attack?: number;
  bright?: number;
  /** Index into the window theme when this note belongs to a statement of it. */
  motif?: number;
  /** Scale step relative to the tonic; lets the lift score follow another chapter's mode. */
  deg?: number;
}

export interface PadEv {
  kind: 'pad';
  t: number;
  inst: PadId;
  midis: number[];
  vel: number;
  dur: number;
  pan: number;
  attack?: number;
  release?: number;
  bright?: number;
  bus?: Bus;
  degs?: number[];
}

export interface AmbEv {
  kind: 'amb';
  t: number;
  sound: AmbToneId;
  variant: number;
  vel: number;
  pan: number;
  /** Pan travel across the sound's length (swallows flying past). */
  sweep?: number;
}

export type Ev = NoteEv | PadEv | AmbEv;

export interface ChordSpan {
  t: number;
  chord: Chord;
  key: Key;
}

export interface BedSpec {
  water: { level: number; cutoff: number; roar?: number };
  wind?: number;
  rain?: { level: number; heavy?: boolean; ease?: { at: number; to: number; over: number } };
  snow?: number;
}

export interface Mix {
  music: number;
  amb: number;
  dryVerb: number;
  wetVerb: number;
}

export interface BrushSpec {
  inst: ToneId;
  lo: number;
  hi: number;
  vel: number;
  bus: Bus;
  dur: number;
  bright?: number;
  attack?: number;
}

export interface Composition {
  id: ScoreId;
  bpm: number;
  beatsPerBar: number;
  beat: number;
  bar: number;
  key: Key;
  /** Loop length in seconds; 0 for chapter scores. */
  loop: number;
  /** Chapter scores: time of the final cadence. Loops: the loop length. */
  end: number;
  events: Ev[];
  tail: { start: number; period: number; events: Ev[] } | null;
  chords: ChordSpan[];
  /** Early ending: events for a cadence starting at score time `t` in `key`. */
  cadence(t: number, key: Key): Ev[];
  bed: BedSpec;
  mix: Mix;
  brush: BrushSpec;
}

function lowerBound(events: readonly Ev[], t: number): number {
  let lo = 0;
  let hi = events.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (events[mid].t < t) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function pushRange(out: Ev[], events: readonly Ev[], a: number, b: number, offset: number): void {
  for (let i = lowerBound(events, a); i < events.length && events[i].t < b; i++) {
    out.push({ ...events[i], t: events[i].t + offset });
  }
}

/** Every event of `c` that starts in [t0, t1), in score seconds. Pure. */
export function schedule(c: Composition, t0: number, t1: number): Ev[] {
  const out: Ev[] = [];
  if (t1 <= t0) return out;
  if (c.loop > 0) {
    for (let k = Math.floor(t0 / c.loop); k * c.loop < t1; k++) {
      const base = k * c.loop;
      pushRange(out, c.events, t0 - base, t1 - base, base);
    }
    return out;
  }
  pushRange(out, c.events, t0, t1, 0);
  if (c.tail && t1 > c.tail.start) {
    const { start, period, events } = c.tail;
    const from = Math.max(t0, start);
    for (let k = Math.floor((from - start) / period); start + k * period < t1; k++) {
      const base = start + k * period;
      pushRange(out, events, t0 - base, t1 - base, base);
    }
  }
  return out;
}

export function chordAt(c: Composition, t: number): ChordSpan {
  const time = c.loop > 0 ? ((t % c.loop) + c.loop) % c.loop : t;
  const spans = c.chords;
  let lo = 0;
  let hi = spans.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (spans[mid].t <= time) lo = mid;
    else hi = mid - 1;
  }
  return spans[lo];
}

export const MOTIF_STEPS = [-3, 2, 1, 0, -2, -1, 0] as const;
const MOTIF_BEATS = [0, 1, 2.5, 3, 4, 5, 6] as const;
const MOTIF_DURS = [1, 1.5, 0.5, 1, 1, 1, 2] as const;

export interface Span {
  chord: Chord;
  beat: number;
  beats: number;
}

export interface Section {
  bars: number;
  /** Lower numbers are dropped first when the chapter must be shorter. */
  drop?: number;
  write(w: Writer, bar: number): void;
}

export interface MotifOpts {
  oct?: number;
  stretch?: number;
  only?: readonly number[];
  vel?: number;
  key?: Key;
  bus?: Bus;
  attack?: number;
  bright?: number;
  pan?: number;
  hold?: number;
}

export class Writer {
  readonly events: Ev[] = [];
  readonly chords: ChordSpan[] = [];
  readonly beat: number;
  readonly bar: number;
  readonly rand: () => number;
  private readonly lead = new Map<string, number[]>();

  constructor(
    readonly bpm: number,
    readonly beatsPerBar: number,
    public key: Key,
    seed: number,
  ) {
    this.beat = 60 / bpm;
    this.bar = this.beat * beatsPerBar;
    this.rand = rng(seed);
  }

  at(bar: number, beat = 0): number {
    return bar * this.bar + beat * this.beat;
  }

  add(ev: Ev): void {
    this.events.push(ev);
  }

  note(inst: InstId, midi: number, bar: number, beat: number, beats: number, vel: number, extra: Partial<NoteEv> = {}): void {
    this.add({ kind: 'note', t: this.at(bar, beat), inst, midi, vel, dur: beats * this.beat, pan: 0, ...extra });
  }

  /** Places 'G4:1 E5:1.5 r:1' notes one after another from (bar, beat). Returns the beat after the last. */
  line(inst: InstId, text: string, bar: number, beat: number, vel: number, extra: Partial<NoteEv> = {}, hold = 1): number {
    let b = beat;
    for (const tok of text.trim().split(/\s+/)) {
      const [name, len] = tok.split(':');
      const beats = Number(len);
      if (name !== 'r') {
        const accent = (bar * this.beatsPerBar + b) % this.beatsPerBar === 0 ? 1.08 : 1;
        this.note(inst, noteToMidi(name), bar, b, beats * hold, Math.min(1, vel * accent * (0.94 + this.rand() * 0.1)), extra);
      }
      b += beats;
    }
    return b;
  }

  /** Records the harmony for one bar: 'F:1 G:1 C:2' or 'Am'. */
  prog(bar: number, text: string, key: Key = this.key): Span[] {
    const toks = text.trim().split(/\s+/);
    const spans: Span[] = [];
    let beat = 0;
    for (const tok of toks) {
      const [name, len] = tok.split(':');
      const beats = len ? Number(len) : this.beatsPerBar - beat;
      spans.push({ chord: chord(name), beat, beats });
      this.chords.push({ t: this.at(bar, beat), chord: chord(name), key });
      beat += beats;
    }
    return spans;
  }

  voiced(layer: string, c: Chord, lo: number, hi: number, count: number): number[] {
    const v = voice(c, lo, hi, count, this.lead.get(layer));
    this.lead.set(layer, v);
    return v;
  }

  motif(inst: InstId, bar: number, beat: number, o: MotifOpts = {}): void {
    const key = o.key ?? this.key;
    const stretch = o.stretch ?? 1;
    const idx = o.only ?? [0, 1, 2, 3, 4, 5, 6];
    for (const i of idx) {
      const step = MOTIF_STEPS[i] + 7 * (o.oct ?? 0);
      const accent = i === 1 || i === 6 ? 1.06 : i === 2 ? 0.85 : 1;
      this.note(inst, stepToMidi(key, step), bar, beat + MOTIF_BEATS[i] * stretch, MOTIF_DURS[i] * stretch * (o.hold ?? 1.15), Math.min(1, (o.vel ?? 0.6) * accent), {
        motif: i,
        bus: o.bus,
        attack: o.attack,
        bright: o.bright,
        pan: o.pan ?? 0,
        deg: step,
      });
    }
  }

  /**
   * Broken-chord figure in eighths. Tokens: 'B' bass, digits index the upper voicing, '.' rests.
   * Durations sustain to the end of the chord like a held pedal unless `ring` is set.
   */
  arp(inst: InstId, bar: number, spans: Span[], pattern: string, o: {
    lo: number; hi: number; count: number; vel: number; bassLo?: number; bassHi?: number;
    ring?: number; bus?: Bus; accents?: readonly number[]; layer?: string; pan?: number; bright?: number; attack?: number; sub?: number;
  }): void {
    const toks = pattern.trim().split(/\s+/);
    const sub = o.sub ?? 2;
    const slots = this.beatsPerBar * sub;
    const layer = o.layer ?? `arp:${inst}`;
    let current: Span | null = null;
    let voicing: number[] = [];
    for (let s = 0; s < slots; s++) {
      const beat = s / sub;
      const span = spans.find((x) => beat >= x.beat - 1e-6 && beat < x.beat + x.beats - 1e-6) ?? spans[spans.length - 1];
      if (span !== current) {
        current = span;
        voicing = this.voiced(layer, span.chord, o.lo, o.hi, o.count);
      }
      const tok = toks[s % toks.length];
      if (tok === '.') continue;
      const acc = o.accents ? o.accents[s % o.accents.length] : s % sub === 0 ? 1 : 0.82;
      const vel = Math.min(1, o.vel * acc * (0.92 + this.rand() * 0.14));
      let midi: number;
      if (tok === 'B') {
        const lo = o.bassLo ?? 36;
        midi = lo + ((span.chord.bass - lo) % 12 + 12) % 12;
        if (o.bassHi !== undefined && midi > o.bassHi) midi -= 12;
      } else {
        const i = Number(tok);
        midi = voicing[i % voicing.length] + 12 * Math.floor(i / voicing.length);
      }
      const held = o.ring ?? span.beat + span.beats - beat + 0.25;
      const pan = (o.pan ?? 0) + (midi - 60) * 0.012;
      this.note(inst, midi, bar, beat, held, vel, { bus: o.bus, pan, bright: o.bright, attack: o.attack });
    }
  }

  pad(inst: PadId, bar: number, spans: Span[], o: {
    lo: number; hi: number; count: number; vel: number; attack?: number; release?: number; bus?: Bus; bright?: number; layer?: string; pan?: number; overlap?: number;
  }): void {
    for (const s of spans) {
      const midis = this.voiced(o.layer ?? `pad:${inst}`, s.chord, o.lo, o.hi, o.count);
      this.add({
        kind: 'pad', t: this.at(bar, s.beat), inst, midis, vel: o.vel, dur: (s.beats + (o.overlap ?? 0.3)) * this.beat,
        pan: o.pan ?? 0, attack: o.attack, release: o.release, bus: o.bus, bright: o.bright,
      });
    }
  }

  bass(bar: number, spans: Span[], o: { lo?: number; vel: number; pattern?: 'whole' | 'half' | 'pulse' | 'bounce' | 'root5' }): void {
    const lo = o.lo ?? 33;
    for (const s of spans) {
      const root = lo + ((s.chord.bass - lo) % 12 + 12) % 12;
      const fifth = lo + ((s.chord.root + 7 - lo) % 12 + 12) % 12;
      const p = o.pattern ?? 'whole';
      if (p === 'whole' || s.beats < 2) {
        this.note('bass', root, bar, s.beat, s.beats * 0.97, o.vel);
      } else if (p === 'half' || p === 'root5') {
        for (let b = 0; b < s.beats; b += 2) {
          const m = p === 'root5' && b > 0 ? fifth : root;
          this.note('bass', m, bar, s.beat + b, Math.min(2, s.beats - b) * 0.95, o.vel * (b === 0 ? 1 : 0.85));
        }
      } else if (p === 'pulse') {
        for (let b = 0; b < s.beats; b += 0.5) this.note('bass', root, bar, s.beat + b, 0.42, o.vel * (b % 1 === 0 ? 1 : 0.7));
      } else {
        for (let b = 0; b < s.beats; b += 1) {
          const m = b % 2 === 1 ? fifth : root;
          this.note('bass', m, bar, s.beat + b, 0.6, o.vel * (b % 2 === 0 ? 1 : 0.8));
          if (b % 2 === 1 && b + 0.5 < s.beats) this.note('bass', root + 12, bar, s.beat + b + 0.5, 0.3, o.vel * 0.55);
        }
      }
    }
  }

  amb(sound: AmbToneId, t: number, vel: number, pan: number, sweep?: number): void {
    this.add({ kind: 'amb', t, sound, variant: Math.floor(this.rand() * 1000), vel, pan, sweep });
  }

  /** Scatters ambience calls over [from, to) with gaps between minGap and maxGap seconds. */
  scatter(sound: AmbToneId, from: number, to: number, minGap: number, maxGap: number, vel: number, spread = 0.8, sweep = 0): void {
    let t = from + this.rand() * minGap;
    while (t < to) {
      const pan = (this.rand() * 2 - 1) * spread;
      this.amb(sound, t, vel * (0.6 + this.rand() * 0.4), pan, sweep ? (this.rand() < 0.5 ? -sweep : sweep) : undefined);
      t += minGap + this.rand() * (maxGap - minGap);
    }
  }

  bell(midi: number, bar: number, beat: number, everyBeats: number, vel: number, pan = -0.35): void {
    for (let k = 0; k < 8; k++) {
      this.note('bell', midi, bar, beat + k * everyBeats, 12, vel * (k === 0 ? 1 : 0.92 + this.rand() * 0.08), { bus: 'far', pan });
    }
  }

  sorted(): Ev[] {
    return this.events.sort((a, b) => a.t - b.t);
  }
}

export interface ScoreDef {
  id: ScoreId;
  bpm: number;
  beatsPerBar: number;
  key: Key;
  /** Chapter length in the contract; loops use their natural length. */
  length: number;
  loop: boolean;
  sections: Section[];
  /** One bar of accompaniment used to lengthen a chapter. */
  vamp?: Section;
  /** Writes the final cadence starting at `bar`; the tonic lands at the start of `bar`. */
  final?(w: Writer, bar: number): void;
  tail?(w: Writer): { period: number };
  /** Early ending: penultimate chord at beat 0, tonic at beat 2 of bar 0. */
  cadence(w: Writer, key: Key): void;
  bed: BedSpec;
  mix: Mix;
  brush: BrushSpec;
  seed: number;
}

/**
 * Picks sections so the chapter lands close to `target` bars: drops optional sections when short,
 * repeats the middle sections when long, and pads the last few bars with a vamp. Tempo absorbs the rest.
 */
function fit(def: ScoreDef, target: number): Section[] {
  const chosen = [...def.sections];
  const total = () => chosen.reduce((n, s) => n + s.bars, 0);
  const droppable = chosen.filter((s) => s.drop !== undefined).sort((a, b) => (a.drop ?? 0) - (b.drop ?? 0));
  for (const s of droppable) {
    if (total() - target < s.bars / 2) break;
    chosen.splice(chosen.indexOf(s), 1);
  }
  while (total() - target >= 2 && chosen.length > 2) chosen.splice(chosen.length - 2, 1);
  const middle = def.sections.slice(1, -1);
  for (let k = 0; middle.length && target - total() >= middle[k % middle.length].bars * 0.75; k++) {
    chosen.splice(chosen.length - 1, 0, middle[k % middle.length]);
  }
  const extra = Math.round(target - total());
  if (def.vamp && extra / target > 0.03) {
    for (let i = 0; i < extra; i++) chosen.splice(chosen.length - 1, 0, def.vamp);
  }
  return chosen;
}

export function build(def: ScoreDef, durationSec?: number): Composition {
  const nominalBar = (def.beatsPerBar * 60) / def.bpm;
  let sections = def.sections;
  let bpm = def.bpm;
  if (!def.loop) {
    const want = durationSec && durationSec > 5 ? durationSec : def.length;
    sections = fit(def, want / nominalBar);
    const bars = sections.reduce((n, s) => n + s.bars, 0);
    bpm = Math.min(def.bpm * 1.25, Math.max(def.bpm * 0.8, (bars * def.beatsPerBar * 60) / want));
  }
  const w = new Writer(bpm, def.beatsPerBar, def.key, def.seed);
  let bar = 0;
  for (const s of sections) {
    s.write(w, bar);
    bar += s.bars;
  }
  const end = w.at(bar);
  if (def.final) def.final(w, bar);
  const events = w.sorted();
  const chords = w.chords.sort((a, b) => a.t - b.t);

  let tail: Composition['tail'] = null;
  if (!def.loop && def.tail) {
    const tw = new Writer(bpm, def.beatsPerBar, def.key, def.seed + 1);
    const { period } = def.tail(tw);
    tail = { start: end + Math.ceil(5 / w.bar) * w.bar, period, events: tw.sorted() };
  }

  const cadence = (t: number, key: Key): Ev[] => {
    const cw = new Writer(bpm, def.beatsPerBar, key, def.seed + 2);
    def.cadence(cw, key);
    return cw.sorted().map((e) => ({ ...e, t: e.t + t }));
  };

  return {
    id: def.id,
    bpm,
    beatsPerBar: def.beatsPerBar,
    beat: w.beat,
    bar: w.bar,
    key: def.key,
    loop: def.loop ? end : 0,
    end,
    events,
    tail,
    chords,
    cadence,
    bed: def.bed,
    mix: def.mix,
    brush: def.brush,
  };
}

export function degLine(w: Writer, inst: InstId, steps: readonly (number | null)[], beatsEach: readonly number[], bar: number, beat: number, vel: number, extra: Partial<NoteEv> = {}): void {
  let b = beat;
  steps.forEach((s, i) => {
    const len = beatsEach[i % beatsEach.length];
    if (s !== null) w.note(inst, stepToMidi(w.key, s), bar, b, len * 1.2, vel, { ...extra, deg: s });
    b += len;
  });
}
