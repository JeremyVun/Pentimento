import type { ScoreDef, Section, Span, Writer } from '../compose';
import { MAJOR } from '../theory';
import { bars, hold, lines, roll, tailPad } from './common';

const key = { tonic: 72, scale: MAJOR };
const keyD = { tonic: 74, scale: MAJOR };

const pluck = { lo: 60, hi: 76, count: 3, vel: 0.32, bassLo: 48, layer: 'pl' };

function accomp(w: Writer, bar: number, s: Span[], pad: number, bass: number): void {
  w.arp('pluck', bar, s, 'B 0 1 2 1 2 0 2', pluck);
  if (pad) w.pad('pad', bar, s, { lo: 57, hi: 74, count: 3, vel: pad, bright: 1.2 });
  if (bass) w.bass(bar, s, { vel: bass, pattern: 'half' });
}

function sky(w: Writer, bar: number, n: number): void {
  w.scatter('swallow', w.at(bar) + 1, w.at(bar + n), 6, 11, 0.8, 0.5, 1);
  w.scatter('bird', w.at(bar) + 2, w.at(bar + n), 4, 8, 0.8);
}

const intro: Section = {
  bars: 2,
  write(w, b) {
    bars(w, b, ['C', 'F/C'], (s, bar) => w.arp('pluck', bar, s, 'B 0 1 2 1 0 1 2', pluck));
    w.note('musicbox', 91, b + 1, 2, 1, 0.3, { pan: 0.4 });
    sky(w, b, 2);
  },
};

const A: Section = {
  bars: 8,
  write(w, b) {
    bars(w, b, ['C', 'F:1 G:1 C:2', 'Am7', 'F:1 G:1 C:2', 'F', 'G', 'Em', 'Am:2 G:2'], (s, bar, i) => accomp(w, bar, s, i >= 4 ? 0.38 : 0, 0.4));
    w.motif('musicbox', b, 0, { vel: 0.62, oct: 1, pan: 0.2 });
    w.motif('piano', b + 2, 0, { vel: 0.58, pan: -0.15 });
    lines(w, 'musicbox', b + 4, ['A5:1 C6:1 F6:1.5 E6:.5', '', 'B5:1 G5:1 E5:1 G5:1'], 0.58, { pan: 0.2 });
    lines(w, 'piano', b + 5, ['D5:1 B4:1 G4:2', '', 'C5:1.5 B4:.5 A4:1 G4:1'], 0.56, { pan: -0.15 });
    sky(w, b, 8);
  },
};

const B: Section = {
  bars: 8,
  drop: 1,
  write(w, b) {
    bars(w, b, ['F', 'G', 'Em', 'Am', 'Dm7', 'G', 'C/E', 'F:2 G:2'], (s, bar) => accomp(w, bar, s, 0.45, 0.44));
    lines(w, 'musicbox', b, ['A5:2 C6:2', 'B5:2 D6:2', 'G5:1 B5:1 E6:2', 'C6:3 E6:1', 'F6:2 E6:1 D6:1', 'D6:2 B5:2', 'C6:1 E6:1 G6:2', 'A6:2 B6:2'], 0.58, { pan: 0.2 });
    lines(w, 'piano', b, ['F4:2 A4:2', 'G4:2 B4:2', 'E4:1 G4:1 B4:2', 'A4:3 C5:1', 'D5:2 C5:1 A4:1', 'B4:2 G4:2', 'E4:1 G4:1 C5:2', 'C5:2 D5:2'], 0.42, { pan: -0.15 });
    sky(w, b, 8);
  },
};

const bridge: Section = {
  bars: 4,
  drop: 2,
  write(w, b) {
    bars(w, b, ['Dm7', 'G', 'Em7', 'A7'], (s, bar) => accomp(w, bar, s, 0.45, 0.44));
    lines(w, 'piano', b, ['F5:1 E5:1 D5:1 C5:1', 'B4:2 D5:2', 'E5:1 G5:1 B5:1 D6:1', 'C#6:2 A5:1 G5:1'], 0.6, { pan: -0.1 });
    sky(w, b, 4);
  },
};

const A2: Section = {
  bars: 8,
  write(w, b) {
    w.key = keyD;
    bars(w, b, ['D', 'G:1 A:1 D:2', 'Bm7', 'G:1 A:1 D:2', 'G', 'A', 'F#m', 'Bm:2 A:2'], (s, bar) => {
      accomp(w, bar, s, 0.5, 0.48);
      w.pad('shimmer', bar, s, { lo: 69, hi: 86, count: 3, vel: 0.3 });
    }, keyD);
    w.motif('musicbox', b, 0, { vel: 0.66, oct: 1, pan: 0.2 });
    w.motif('piano', b + 2, 0, { vel: 0.62, pan: -0.15 });
    lines(w, 'musicbox', b + 4, ['B5:1 D6:1 G6:1.5 F#6:.5', '', 'C#6:1 A5:1 F#5:1 A5:1'], 0.6, { pan: 0.2 });
    lines(w, 'piano', b + 5, ['E5:1 C#5:1 A4:2', '', 'D5:1.5 C#5:.5 B4:1 C#5:1'], 0.58, { pan: -0.15 });
    sky(w, b, 8);
  },
};

const coda: Section = {
  bars: 4,
  write(w, b) {
    w.key = keyD;
    bars(w, b, ['G', 'A', 'Bm:2 G:2', 'Asus4:2 A:2'], (s, bar) => {
      accomp(w, bar, s, 0.48, 0.46);
      w.pad('shimmer', bar, s, { lo: 69, hi: 86, count: 3, vel: 0.3 });
    }, keyD);
    lines(w, 'musicbox', b, ['D6:1 E6:1 F#6:2', 'E6:2 C#6:2', 'D6:2 B5:2', 'A5:2'], 0.6, { pan: 0.2 });
    lines(w, 'piano', b, ['B4:2 D5:2', 'C#5:2 A4:2', 'F#4:2 G4:2', 'E4:2 C#5:2'], 0.44, { pan: -0.15 });
    w.motif('musicbox', b + 3, -2, { vel: 0.62, oct: 1, only: [4, 5, 6], pan: 0.2 });
    sky(w, b, 4);
  },
};

const vamp: Section = {
  bars: 1,
  write(w, b) {
    accomp(w, b, w.prog(b, 'F'), 0.4, 0.4);
  },
};

export const later: ScoreDef = {
  id: 'later',
  bpm: 96,
  beatsPerBar: 4,
  key,
  length: 85,
  loop: false,
  seed: 104,
  sections: [intro, A, B, bridge, A2, coda],
  vamp,
  final(w, b) {
    w.prog(b, 'D', keyD);
    roll(w, 'piano', 'D3 A3 D4 F#4 A4', b, 0, 12, 0.42);
    roll(w, 'pluck', 'D3 A3 D4 F#4', b, 0.5, 4, 0.3);
    w.note('celesta', 98, b, 1, 2, 0.3, { pan: 0.4 });
    w.note('celesta', 93, b, 1.5, 2, 0.26, { pan: 0.5 });
    w.note('bass', 38, b, 0, 9, 0.46);
    hold(w, 'pad', 'D', b, 0, 10, { lo: 57, hi: 74, count: 3, vel: 0.45, release: 4, bright: 1.2 });
    hold(w, 'shimmer', 'D', b, 0, 10, { lo: 69, hi: 86, count: 3, vel: 0.35, release: 4 });
    w.scatter('swallow', w.at(b) + 1, w.at(b) + 8, 2, 4, 0.8, 0.5, 1);
  },
  tail(w) {
    const t = tailPad(w, 'pad', 'D', 4, { lo: 57, hi: 74, count: 3, vel: 0.3 });
    w.note('musicbox', 93, 1, 0, 1, 0.22, { pan: 0.3 });
    w.note('musicbox', 90, 3, 0, 1, 0.18, { pan: -0.2 });
    w.scatter('swallow', 0, t.period, 4, 9, 0.7, 0.5, 1);
    return t;
  },
  cadence(w, k) {
    const up = k.tonic - 72;
    const n = (m: number) => m + up;
    [43, 50, 55, 59, 65].forEach((m, i) => w.note('pluck', n(m), 0, i * 0.125, 2 - i * 0.125, 0.36));
    w.note('musicbox', n(83), 0, 0, 2, 0.5);
    w.note('bass', n(43), 0, 0, 2, 0.4);
    [48, 55, 60, 64, 67].forEach((m, i) => w.note('piano', n(m), 0, 2 + i * 0.125, 10, 0.4));
    w.note('musicbox', n(84), 0, 2, 4, 0.6);
    w.note('bass', n(36), 0, 2, 8, 0.42);
    w.note('celesta', n(96), 0, 3, 2, 0.28);
  },
  bed: { water: { level: 0.3, cutoff: 2600 } },
  mix: { music: 1, amb: 0.9, dryVerb: 0.16, wetVerb: 0.4 },
  brush: { inst: 'kalimba', lo: 67, hi: 91, vel: 0.46, bus: 'dry', dur: 1 },
};
