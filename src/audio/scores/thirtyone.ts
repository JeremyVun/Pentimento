import type { ScoreDef, Section, Writer } from '../compose';
import { MAJOR } from '../theory';
import { bars, hold, lines, roll, tailPad } from './common';

const key = { tonic: 79, scale: MAJOR };

const BOUNCE = [1, 0.62, 0.85, 0.7, 0.95, 0.62, 0.88, 0.72];
const mar = (vel: number) => ({ lo: 59, hi: 74, count: 3, vel, bassLo: 43, bassHi: 55, accents: BOUNCE, layer: 'mar' });

function birds(w: Writer, bar: number, n: number): void {
  w.scatter('bird', w.at(bar), w.at(bar + n), 3, 6, 0.8);
}

const intro: Section = {
  bars: 2,
  write(w, b) {
    bars(w, b, ['G', 'C:2 D:2'], (s, bar) => {
      w.arp('marimba', bar, s, 'B 1 0 2 B 1 0 2', mar(0.4));
      w.bass(bar, s, { vel: 0.45, lo: 31, pattern: 'bounce' });
    });
    birds(w, b, 2);
  },
};

const A: Section = {
  bars: 8,
  write(w, b) {
    bars(w, b, ['G', 'C:1 D:1 G:2', 'Em', 'C:2 D:2', 'G', 'C:1 D:1 Em:2', 'C', 'D7'], (s, bar) => {
      w.arp('marimba', bar, s, 'B 1 0 2 B 1 0 2', mar(0.4));
      w.bass(bar, s, { vel: 0.48, lo: 31, pattern: 'bounce' });
    });
    w.motif('marimba', b, 0, { vel: 0.66 });
    w.motif('marimba', b + 4, 0, { vel: 0.64, only: [0, 1, 2, 3] });
    lines(w, 'marimba', b, ['', '', 'B5:.5 B5:.5 A5:.5 G5:.5 E5:1 G5:1', 'A5:1 G5:.5 E5:.5 D5:2', '', 'E5:1 F#5:1 G5:.5 A5:.5 B5:1', 'C6:1 B5:.5 A5:.5 G5:1 E5:1', 'F#5:2 A5:1 D6:1'], 0.62);
    birds(w, b, 8);
  },
};

const B: Section = {
  bars: 8,
  drop: 1,
  write(w, b) {
    bars(w, b, ['C', 'D', 'Bm', 'Em', 'C', 'D', 'G/B', 'Am7:2 D7:2'], (s, bar) => {
      w.arp('marimba', bar, s, 'B 1 0 2 B 1 0 2', mar(0.42));
      w.bass(bar, s, { vel: 0.5, lo: 31, pattern: 'bounce' });
      w.pad('pad', bar, s, { lo: 62, hi: 79, count: 3, vel: 0.4, bright: 1.4, attack: 0.6 });
      w.arp('kalimba', bar, s, '. 2 . 1 . 2 . 0', { lo: 74, hi: 88, count: 3, vel: 0.3, layer: 'kal' });
    });
    lines(w, 'marimba', b, ['E6:1 D6:.5 C6:.5 G5:1 E5:1', 'F#5:1 A5:1 D6:2', 'D6:1 B5:.5 A5:.5 F#5:1 D5:1', 'E5:1 G5:1 B5:2', 'C6:1.5 B5:.5 A5:1 G5:1', 'A5:1 F#5:1 D5:1 F#5:1', 'G5:1 B5:1 D6:1 B5:1', 'C6:1 A5:1 F#5:1 D5:1'], 0.62);
    w.scatter('swallow', w.at(b), w.at(b + 8), 5, 9, 0.8, 0.5, 0.9);
    birds(w, b, 8);
  },
};

const A3: Section = {
  bars: 4,
  write(w, b) {
    bars(w, b, ['G', 'C:1 D:1 G:2', 'Em', 'C:2 D:2'], (s, bar) => {
      w.arp('marimba', bar, s, 'B 1 0 2 B 1 0 2', mar(0.44));
      w.bass(bar, s, { vel: 0.5, lo: 31, pattern: 'bounce' });
      w.pad('pad', bar, s, { lo: 62, hi: 79, count: 3, vel: 0.45, bright: 1.4, attack: 0.6 });
    });
    w.motif('marimba', b, 0, { vel: 0.7 });
    w.motif('kalimba', b, 0, { vel: 0.4, oct: -1 });
    lines(w, 'marimba', b, ['', '', 'B5:.5 A5:.5 G5:.5 E5:.5 G5:1 B5:1', 'C6:1 B5:1 A5:2'], 0.64);
    birds(w, b, 4);
  },
};

const coda: Section = {
  bars: 2,
  write(w, b) {
    bars(w, b, ['C:2 D:2', 'Am7:2 D7:2'], (s, bar) => {
      w.arp('marimba', bar, s, 'B 1 0 2 B 1 0 2', mar(0.42));
      w.bass(bar, s, { vel: 0.5, lo: 31, pattern: 'bounce' });
      w.pad('pad', bar, s, { lo: 62, hi: 79, count: 3, vel: 0.45, bright: 1.4, attack: 0.6 });
    });
    lines(w, 'marimba', b, ['E5:.5 G5:.5 C6:.5 E6:.5 D6:1 A5:1', 'C6:.5 B5:.5 A5:.5 G5:.5'], 0.62);
    w.motif('marimba', b + 1, -2, { vel: 0.64, only: [4, 5, 6] });
  },
};

const vamp: Section = {
  bars: 1,
  write(w, b) {
    const s = w.prog(b, 'C:2 D:2');
    w.arp('marimba', b, s, 'B 1 0 2 B 1 0 2', mar(0.42));
    w.bass(b, s, { vel: 0.5, lo: 31, pattern: 'bounce' });
  },
};

export const thirtyone: ScoreDef = {
  id: 'thirtyone',
  bpm: 116,
  beatsPerBar: 4,
  key,
  length: 50,
  loop: false,
  seed: 31,
  sections: [intro, A, B, A3, coda],
  vamp,
  final(w, b) {
    w.prog(b, 'G');
    roll(w, 'marimba', 'G3 B3 D4 G4 B4 D5', b, 0, 4, 0.5);
    w.note('kalimba', 91, b, 0.5, 2, 0.3, { pan: 0.4 });
    w.note('bass', 31, b, 0, 6, 0.5);
    hold(w, 'pad', 'G', b, 0, 10, { lo: 62, hi: 79, count: 3, vel: 0.45, release: 4, bright: 1.3 });
    w.scatter('swallow', w.at(b) + 1, w.at(b) + 8, 3, 5, 0.8, 0.5, 0.9);
  },
  tail(w) {
    const t = tailPad(w, 'pad', 'G', 4, { lo: 62, hi: 79, count: 3, vel: 0.28 });
    w.note('kalimba', 86, 1, 0, 1, 0.2, { pan: 0.3 });
    w.note('kalimba', 83, 3, 0, 1, 0.18, { pan: -0.3 });
    w.scatter('bird', 0, t.period, 3, 6, 0.8);
    return t;
  },
  cadence(w) {
    roll(w, 'marimba', 'D4 F#4 A4 C5', 0, 0, 2, 0.45);
    w.note('bass', 38, 0, 0, 2, 0.45);
    roll(w, 'marimba', 'G3 B3 D4 G4 B4 D5', 0, 2, 4, 0.5);
    w.note('marimba', 79, 0, 2, 2, 0.6);
    w.note('bass', 31, 0, 2, 6, 0.48);
    hold(w, 'pad', 'G', 0, 2, 9, { lo: 62, hi: 79, count: 3, vel: 0.42, release: 4, bright: 1.3 });
  },
  bed: { water: { level: 0.3, cutoff: 2800 } },
  mix: { music: 0.95, amb: 0.9, dryVerb: 0.13, wetVerb: 0.35 },
  brush: { inst: 'marimba', lo: 72, hi: 91, vel: 0.48, bus: 'dry', dur: 0.6 },
};
