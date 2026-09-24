import { chordAt, schedule, type ChordSpan, type Composition, type Ev } from './compose';
import { Bed, type Outs, type Synth } from './synth';
import { stepToMidi, type Key } from './theory';

/** Plays one composition through the synth: lookahead pumping, early endings, fades. */
export class ScorePlayer {
  cursor = 0;
  /** Score time from which nothing more is scheduled. */
  cutoff = Infinity;
  ended = false;
  /** A mode that deg-tagged notes follow (the lift ending's layers). */
  mode: Key | null = null;
  readonly outs: Outs;
  private readonly gains: GainNode[];
  private readonly bedGain: GainNode;
  private readonly bed: Bed;
  private home: ChordSpan | null = null;

  constructor(
    readonly synth: Synth,
    readonly comp: Composition,
    readonly t0: number,
    fadeIn: number,
  ) {
    const { outs, gains } = synth.makeOuts(0);
    this.outs = outs;
    this.gains = gains;
    const start = Math.max(0, t0 - 0.05);
    for (const g of gains) {
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(1, start + fadeIn);
    }
    this.bedGain = synth.gain(1);
    this.bedGain.connect(outs.amb);
    this.bed = new Bed(synth, comp.bed, start, this.bedGain);
  }

  /** Schedules everything up to score time `until`. */
  pump(until: number): void {
    if (until <= this.cursor) return;
    const evs = schedule(this.comp, this.cursor, until);
    this.cursor = until;
    for (const ev of evs) if (ev.t < this.cutoff) this.dispatch(ev);
  }

  dispatch(ev: Ev): void {
    const when = this.t0 + ev.t;
    const s = this.synth;
    if (when < s.ctx.currentTime - 0.08) return;
    if (ev.kind === 'note') {
      const midi = this.mode && ev.deg !== undefined ? stepToMidi(this.mode, ev.deg) : ev.midi;
      s.note(midi === ev.midi ? ev : { ...ev, midi }, when, this.outs, this);
    } else if (ev.kind === 'pad') {
      s.pad(ev, when, this.outs, this);
    } else {
      s.amb(ev, when, this.outs, this);
    }
  }

  /** The harmony at context time `t`. After an early ending it rests on the tonic. */
  harmony(t: number): ChordSpan {
    const st = t - this.t0;
    if (this.home && st >= this.cutoff) return this.home;
    const span = chordAt(this.comp, st);
    return this.mode ? { ...span, key: { tonic: span.key.tonic, scale: this.mode.scale } } : span;
  }

  /**
   * Finishes the piece: a cadence on the next beat if it is still going,
   * or a quiet fade of the tail if the final cadence has already played.
   */
  end(now: number): void {
    if (this.ended) return;
    this.ended = true;
    const c = this.comp;
    const from = Math.max(this.cursor, now - this.t0);
    const s = this.synth;
    if (c.loop === 0 && from >= c.end - c.beat) {
      this.cutoff = Math.max(from, c.end + 4 * c.beat);
      if (from > c.end + 3) s.release(this, now + 0.05, 4);
    } else {
      const tb = Math.ceil((from + 0.02) / c.beat) * c.beat;
      this.cutoff = tb;
      s.release(this, this.t0 + tb, 1.2);
      const span = chordAt(c, tb);
      const events = c.cadence(tb, span.key);
      const tonic = c.loop ? c.chords[0] : c.chords[c.chords.length - 1];
      this.home = { ...tonic, t: tb, key: span.key };
      for (const ev of events) this.dispatch(ev);
    }
    const g = this.bedGain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(g.value, now);
    g.linearRampToValueAtTime(0.55, now + 6);
  }

  fadeOut(now: number, over: number): void {
    for (const g of this.gains) {
      g.gain.cancelScheduledValues(now);
      g.gain.setValueAtTime(g.gain.value, now);
      g.gain.linearRampToValueAtTime(0, now + over);
    }
    this.cutoff = Math.min(this.cutoff, now + over - this.t0);
  }

  dispose(now: number): void {
    this.bed.stop(now);
    this.synth.release(this, now, 0.05);
    const nodes = [...this.gains, this.bedGain];
    setTimeout(() => {
      for (const n of nodes) n.disconnect();
    }, 500);
  }
}
