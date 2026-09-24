import type { ScoreDef, Section, Writer } from '../compose';
import { MAJOR } from '../theory';
import { bars, hold, lines, roll, tailPad } from './common';

const key = { tonic: 72, scale: MAJOR };

const pluck = (lo = 60, hi = 76) => ({ lo, hi, count: 3, vel: 0.36, bassLo: 48 });

function birds(w: Writer, bar: number, n: number): void {
  w.scatter('bird', w.at(bar), w.at(bar + n), 2.5, 6, 0.9);
}

const intro: Section = {
  bars: 2,
  write(w, b) {
    bars(w, b, ['C', 'F/C'], (s, bar) => w.arp('pluck', bar, s, 'B 0 1 2 1 0 1 2', pluck()));
    birds(w, b, 2);
  },
};

const A_PROG = ['C', 'F:1 G:1 C:2', 'Am', 'F:2 G:2', 'C', 'Am:2 Em:2', 'F:2 G:2', 'C'];
const A_LINES = ['', '', 'E5:1 E5:.5 D5:.5 C5:1 D5:1', 'E5:1.5 D5:.5 C5:1 B4:1', '', 'A4:1 B4:1 C5:1 E5:1', 'F5:1.5 E5:.5 D5:1 B4:1', 'C5:3 r:1'];

const A: Section = {
  bars: 8,
  write(w, b) {
    bars(w, b, A_PROG, (s, bar, i) => {
      w.arp('pluck', bar, s, 'B 0 1 2 B 0 1 2', pluck());
      if (i >= 4) w.bass(bar, s, { vel: 0.4, pattern: 'half' });
    });
    w.motif('musicbox', b, 0, { vel: 0.62 });
    w.motif('musicbox', b + 4, 0, { vel: 0.6, only: [0, 1, 2, 3] });
    lines(w, 'musicbox', b, A_LINES, 0.58);
    birds(w, b, 8);
  },
};

const B_PROG = ['F', 'C/E', 'Dm7', 'G', 'Am', 'F', 'Dm7', 'Gsus4:2 G:2'];
const B_LINES = [
  'A5:1 G5:.5 F5:.5 E5:1 F5:1',
  'G5:2 E5:1 C5:1',
  'D5:1 F5:1 A5:1 G5:1',
  'G5:2 r:1 D5:1',
  'C6:1 B5:.5 A5:.5 E5:1 A5:1',
  'G5:1.5 F5:.5 E5:1 C5:1',
  'F5:1 E5:1 D5:1 A4:1',
  'D5:2 B4:2',
];

const B: Section = {
  bars: 8,
  drop: 1,
  write(w, b) {
    bars(w, b, B_PROG, (s, bar) => {
      w.arp('pluck', bar, s, '0 1 2 1 0 1 2 1', pluck(57, 74));
      w.pad('pad', bar, s, { lo: 55, hi: 72, count: 3, vel: 0.45 });
      w.bass(bar, s, { vel: 0.42, pattern: 'half' });
    });
    lines(w, 'musicbox', b, B_LINES, 0.56);
    birds(w, b, 8);
  },
};

const A2_PROG = ['C', 'F:1 G:1 C:2', 'Am', 'F:2 G:2', 'C', 'Am:2 Em:2', 'F:2 G:2', 'C:2 C7:2'];
const A2_LINES = [...A_LINES.slice(0, 7), 'C5:2 E5:1 Bb4:1'];

const A2: Section = {
  bars: 8,
  write(w, b) {
    bars(w, b, A2_PROG, (s, bar, i) => {
      w.arp('pluck', bar, s, 'B 0 1 2 1 2 0 2', pluck());
      w.pad('pad', bar, s, { lo: 55, hi: 72, count: 3, vel: 0.5 });
      w.bass(bar, s, { vel: 0.46, pattern: i % 2 ? 'half' : 'root5' });
      if (w.rand() < 0.35) {
        const top = w.voiced('orn', s[0].chord, 84, 96, 1)[0];
        w.note('celesta', top, bar, 3.5, 0.5, 0.3, { pan: 0.4 });
      }
    });
    w.motif('musicbox', b, 0, { vel: 0.66 });
    w.motif('celesta', b, 0, { vel: 0.3, oct: 1, pan: 0.3 });
    w.motif('musicbox', b + 4, 0, { vel: 0.62, only: [0, 1, 2, 3] });
    lines(w, 'musicbox', b, A2_LINES, 0.6);
    birds(w, b, 8);
  },
};

const coda: Section = {
  bars: 4,
  write(w, b) {
    bars(w, b, ['F:2 G:2', 'C:2 Am:2', 'Dm7:2 F:2', 'F:2 G7:2'], (s, bar, i) => {
      w.arp('pluck', bar, s, i === 0 ? 'B 0 1 2 1 2 0 2' : 'B 0 1 . 2 . 1 .', pluck());
      w.pad('pad', bar, s, { lo: 55, hi: 72, count: 3, vel: 0.42 });
      w.bass(bar, s, { vel: 0.4 });
    });
    w.motif('musicbox', b, 0, { vel: 0.4, oct: 1, only: [0, 1, 2, 3] });
    w.motif('musicbox', b + 1, 0, { vel: 0.62, stretch: 2, hold: 1 });
    birds(w, b, 4);
  },
};

const vamp: Section = {
  bars: 1,
  write(w, b) {
    const s = w.prog(b, 'F');
    w.arp('pluck', b, s, 'B 0 1 2 1 0 1 2', pluck());
    w.pad('pad', b, s, { lo: 55, hi: 72, count: 3, vel: 0.4 });
  },
};

export const nine: ScoreDef = {
  id: 'nine',
  bpm: 92,
  beatsPerBar: 4,
  key,
  length: 80,
  loop: false,
  seed: 9,
  sections: [intro, A, B, A2, coda],
  vamp,
  final(w, b) {
    w.prog(b, 'C');
    roll(w, 'pluck', 'C3 G3 C4 E4 G4', b, 0, 12, 0.4);
    hold(w, 'pad', 'C', b, 0, 10, { lo: 55, hi: 72, count: 3, vel: 0.45, release: 4 });
    w.note('bass', 36, b, 0, 9, 0.45);
    w.note('celesta', 84, b, 1, 2, 0.28, { pan: 0.35 });
    w.scatter('bird', w.at(b) + 1, w.at(b) + 8, 2, 4, 0.9);
  },
  tail(w) {
    const t = tailPad(w, 'pad', 'C', 4, { lo: 55, hi: 72, count: 3, vel: 0.3 });
    w.note('musicbox', 79, 1, 0, 1, 0.22, { pan: 0.3 });
    w.note('musicbox', 76, 3, 0, 1, 0.18, { pan: -0.2 });
    w.scatter('bird', 0, t.period, 3, 7, 0.8);
    return t;
  },
  cadence(w) {
    roll(w, 'pluck', 'G2 D3 G3 B3 F4', 0, 0, 2, 0.36);
    w.note('musicbox', 71, 0, 0, 2, 0.5);
    w.note('bass', 43, 0, 0, 2, 0.4);
    roll(w, 'pluck', 'C3 G3 C4 E4 G4', 0, 2, 12, 0.4);
    w.note('musicbox', 72, 0, 2, 4, 0.58);
    hold(w, 'pad', 'C', 0, 2, 9, { lo: 55, hi: 72, count: 3, vel: 0.4, release: 4 });
    w.note('bass', 36, 0, 2, 8, 0.42);
  },
  bed: { water: { level: 0.32, cutoff: 2400 } },
  mix: { music: 1, amb: 0.9, dryVerb: 0.16, wetVerb: 0.4 },
  brush: { inst: 'celesta', lo: 67, hi: 88, vel: 0.44, bus: 'dry', dur: 1.2 },
};
