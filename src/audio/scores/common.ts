import type { InstId, PadId, Span, Writer } from '../compose';
import { chord, noteToMidi, type Key } from '../theory';

export function bars(w: Writer, bar: number, progs: readonly string[], each: (spans: Span[], b: number, i: number) => void, key?: Key): void {
  progs.forEach((p, i) => each(w.prog(bar + i, p, key), bar + i, i));
}

/** Lines per bar; empty strings leave the bar to the accompaniment. */
export function lines(w: Writer, inst: InstId, bar: number, text: readonly string[], vel: number, extra: Parameters<Writer['line']>[5] = {}): void {
  text.forEach((t, i) => {
    if (t) w.line(inst, t, bar + i, 0, vel, extra);
  });
}

/** A chord spread upward from the bass, one 32nd apart, like a hand rolling it. */
export function roll(w: Writer, inst: InstId, notes: string, bar: number, beat: number, beats: number, vel: number, extra: Parameters<Writer['note']>[6] = {}): void {
  notes.split(/\s+/).forEach((n, i) => {
    w.note(inst, noteToMidi(n), bar, beat + i * 0.125, beats - i * 0.125, vel * (1 - i * 0.04), { pan: -0.2 + i * 0.1, ...extra });
  });
}

export function hold(w: Writer, inst: PadId, name: string, bar: number, beat: number, beats: number, o: {
  lo: number; hi: number; count: number; vel: number; attack?: number; release?: number; bus?: 'dry' | 'wet'; bright?: number; layer?: string;
}): void {
  w.pad(inst, bar, [{ chord: chord(name), beat, beats }], { ...o, overlap: 0 });
}

export function tailPad(w: Writer, inst: PadId, name: string, periodBars: number, o: { lo: number; hi: number; count: number; vel: number; bus?: 'dry' | 'wet' }): { period: number } {
  w.prog(0, name);
  hold(w, inst, name, 0, 0, periodBars * w.beatsPerBar + 2, { ...o, attack: 3, release: 4, layer: 'tail' });
  return { period: periodBars * w.bar };
}
