import type { ScoreDef, Section, Span, Writer } from '../compose';
import { DORIAN, noteToMidi } from '../theory';
import { bars, hold, lines, roll, tailPad } from './common';

const key = { tonic: 74, scale: DORIAN };

/** Open four-note cells the ostinato cycles through, per chord. */
const CELLS: Record<string, string> = {
  Dm: 'D4 A4 E5 F5',
  'G/D': 'D4 B4 E5 G5',
  G: 'G3 D4 B4 A4',
  C: 'C4 G4 E5 D5',
  Am: 'A3 E4 C5 B4',
  F: 'F3 C4 A4 G4',
  'Dm/F': 'F3 A4 D5 E5',
  Em7: 'E4 B4 D5 G5',
  A: 'A3 E4 C#5 B4',
};

const PATTERN = [0, 1, 2, 1, 3, 1, 2, 1];
const ACCENT = [1, 0.7, 0.85, 0.7, 0.95, 0.7, 0.85, 0.72];

function ostinato(w: Writer, bar: number, spans: Span[], vel: number): void {
  for (let s = 0; s < 8; s++) {
    const beat = s / 2;
    const span = spans.find((x) => beat >= x.beat && beat < x.beat + x.beats) ?? spans[0];
    const cell = CELLS[span.chord.name].split(' ').map(noteToMidi);
    const midi = cell[PATTERN[s]];
    w.note('pluck', midi, bar, beat, 0.9, vel * ACCENT[s] * (0.94 + w.rand() * 0.1), { pan: -0.25 + (midi - 62) * 0.02 });
  }
}

const TAPS = [
  [1, 0, 1, 0, 1, 0, 1, 0],
  [1, 1, 1, 1, 0, 0, 0, 0],
  [1, 0, 0, 0, 1, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [1, 0, 1, 0, 1, 1, 1, 0],
  [0, 0, 1, 0, 1, 0, 1, 0],
];

/** Distant hammering from the bridge works, in bouts, always on the beat. */
function hammer(w: Writer, bar: number, n: number): void {
  for (let b = 0; b < n; b += 2) {
    const p = TAPS[Math.floor(w.rand() * TAPS.length)];
    for (let i = 0; i < 8 && b + i / 4 < n; i++) {
      if (p[i]) w.add({ kind: 'amb', t: w.at(bar + b, i), sound: 'hammer', variant: Math.floor(w.rand() * 4), vel: 0.55 + w.rand() * 0.3, pan: -0.55 });
    }
  }
}

const intro: Section = {
  bars: 4,
  write(w, b) {
    bars(w, b, ['Dm', 'Dm', 'G/D', 'Dm'], (s, bar, i) => ostinato(w, bar, s, i < 2 ? 0.34 : 0.4));
    hammer(w, b + 2, 2);
  },
};

const A: Section = {
  bars: 8,
  write(w, b) {
    bars(w, b, ['Dm', 'G:2 Dm:2', 'F', 'C', 'Dm', 'G', 'C', 'Am'], (s, bar, i) => {
      ostinato(w, bar, s, 0.4);
      w.bass(bar, s, { vel: 0.38 });
      if (i >= 4) w.pad('lowpad', bar, s, { lo: 45, hi: 62, count: 3, vel: 0.45 });
    });
    w.motif('piano', b, 0, { vel: 0.62 });
    w.motif('piano', b + 4, 0, { vel: 0.6, only: [0, 1, 2, 3] });
    lines(w, 'piano', b, ['', '', 'C5:.5 D5:.5 F5:1 A5:1.5 G5:.5', 'E5:2 r:1 C5:1', '', 'B4:1 C5:1 D5:1 E5:1', 'G5:1.5 A5:.5 G5:1 E5:1', 'E5:3 r:1'], 0.58);
    hammer(w, b, 8);
  },
};

const B: Section = {
  bars: 8,
  drop: 1,
  write(w, b) {
    bars(w, b, ['G', 'Dm/F', 'C', 'Am', 'G', 'F', 'Em7', 'A'], (s, bar) => {
      ostinato(w, bar, s, 0.44);
      w.bass(bar, s, { vel: 0.4, pattern: 'pulse' });
      w.pad('lowpad', bar, s, { lo: 45, hi: 62, count: 3, vel: 0.55 });
    });
    lines(w, 'piano', b, ['D6:2 B5:1 G5:1', 'A5:3 F5:1', 'G5:2 E5:1 C5:1', 'E5:4', 'D5:1 E5:1 G5:1 B5:1', 'A5:2 G5:1 F5:1', 'E5:1 G5:1 B5:1 D6:1', 'C#6:2 A5:1 E5:1'], 0.6);
    hammer(w, b, 8);
  },
};

const A2: Section = {
  bars: 8,
  write(w, b) {
    bars(w, b, ['Dm', 'G:2 Dm:2', 'F', 'C', 'Dm', 'G:2 Dm:2', 'C:2 A:2', 'Dm'], (s, bar) => {
      ostinato(w, bar, s, 0.44);
      w.bass(bar, s, { vel: 0.42, pattern: 'pulse' });
      w.pad('lowpad', bar, s, { lo: 45, hi: 62, count: 3, vel: 0.55 });
      w.pad('pad', bar, s, { lo: 57, hi: 74, count: 3, vel: 0.35 });
    });
    w.motif('piano', b, 0, { vel: 0.66 });
    w.motif('piano', b, 0, { vel: 0.4, oct: -1 });
    w.motif('piano', b + 4, 0, { vel: 0.64 });
    lines(w, 'piano', b, ['', '', 'C5:.5 D5:.5 F5:1 A5:1.5 G5:.5', 'E5:2 D5:1 C5:1', '', '', 'E5:1 D5:1 C#5:2', 'D5:4'], 0.62);
    hammer(w, b, 8);
  },
};

const coda: Section = {
  bars: 4,
  write(w, b) {
    bars(w, b, ['Dm', 'G/D', 'Dm', 'G/D'], (s, bar, i) => {
      ostinato(w, bar, s, 0.4 - i * 0.04);
      w.pad('lowpad', bar, s, { lo: 45, hi: 62, count: 3, vel: 0.45 });
    });
    w.motif('piano', b, 0, { vel: 0.5, only: [0, 1, 2, 3] });
    w.motif('piano', b + 2, 0, { vel: 0.42, only: [0, 1] });
    hammer(w, b, 4);
  },
};

const vamp: Section = {
  bars: 1,
  write(w, b) {
    const s = w.prog(b, 'Dm');
    ostinato(w, b, s, 0.4);
    w.pad('lowpad', b, s, { lo: 45, hi: 62, count: 3, vel: 0.45 });
    hammer(w, b, 1);
  },
};

export const sixteen: ScoreDef = {
  id: 'sixteen',
  bpm: 100,
  beatsPerBar: 4,
  key,
  length: 80,
  loop: false,
  seed: 16,
  sections: [intro, A, B, A2, coda],
  vamp,
  final(w, b) {
    w.prog(b, 'Dm');
    roll(w, 'piano', 'D3 A3 E4 F4', b, 0, 10, 0.42);
    w.note('pluck', 74, b, 0, 4, 0.36);
    w.note('bass', 38, b, 0, 8, 0.45);
    hold(w, 'lowpad', 'Dm', b, 0, 10, { lo: 45, hi: 62, count: 3, vel: 0.5, release: 4 });
  },
  tail(w) {
    const t = tailPad(w, 'lowpad', 'Dm', 4, { lo: 45, hi: 62, count: 3, vel: 0.35 });
    hammer(w, 1, 2);
    return t;
  },
  cadence(w) {
    roll(w, 'piano', 'A2 E3 C#4 A4', 0, 0, 2, 0.4);
    w.note('bass', 45, 0, 0, 2, 0.4);
    roll(w, 'piano', 'D3 A3 E4 F4 D5', 0, 2, 12, 0.44);
    w.note('bass', 38, 0, 2, 8, 0.42);
    hold(w, 'lowpad', 'Dm', 0, 2, 9, { lo: 45, hi: 62, count: 3, vel: 0.45, release: 4 });
  },
  bed: { water: { level: 0.3, cutoff: 2000 }, wind: 0.36 },
  mix: { music: 1, amb: 0.95, dryVerb: 0.18, wetVerb: 0.42 },
  brush: { inst: 'pluck', lo: 62, hi: 86, vel: 0.46, bus: 'dry', dur: 0.8, bright: 1.3 },
};
