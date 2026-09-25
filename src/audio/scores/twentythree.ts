import type { ScoreDef, Section, Writer } from '../compose';
import { MAJOR } from '../theory';
import { bars, hold, lines, roll, tailPad } from './common';

const key = { tonic: 77, scale: MAJOR };
/** The rain eases around here, and the birds come out after it. */
const RAIN_EASES = 38;

const lh = (vel: number) => ({ lo: 53, hi: 69, count: 4, vel, bassLo: 41, bassHi: 52, layer: 'lh' });

function birds(w: Writer, bar: number, n: number): void {
  const from = Math.max(w.at(bar), RAIN_EASES + 6);
  if (from < w.at(bar + n)) w.scatter('bird', from, w.at(bar + n), 3, 7, 0.85);
}

const intro: Section = {
  bars: 4,
  write(w, b) {
    bars(w, b, ['Fmaj7', 'G/F', 'Fmaj7', 'G/F'], (s, bar) => {
      w.pad('pad', bar, s, { lo: 57, hi: 74, count: 4, vel: 0.45, attack: 2 });
      w.arp('piano', bar, s, 'B . 1 . 2 . 3 .', lh(0.3));
    });
  },
};

const A: Section = {
  bars: 8,
  write(w, b) {
    bars(w, b, ['F', 'Bb:1 C:1 F:2', 'Dm7', 'G', 'C/E', 'F', 'Bbmaj7', 'Csus4:2 C:2'], (s, bar, i) => {
      w.arp('piano', bar, s, 'B 0 1 2 B 1 2 3', lh(0.3));
      w.pad('pad', bar, s, { lo: 57, hi: 74, count: 3, vel: 0.4 });
      if (i >= 2) w.bass(bar, s, { vel: 0.36 });
    });
    w.motif('piano', b, 0, { vel: 0.64 });
    lines(w, 'piano', b, ['', '', 'F5:.5 G5:.5 A5:1 C6:1.5 A5:.5', 'B5:2 A5:1 G5:1', 'G5:3 E5:1', 'A5:1 C6:1.5 Bb5:.5 A5:1', 'D6:2 C6:1 A5:1', 'G5:2 E5:2'], 0.6);
    birds(w, b, 8);
  },
};

const B: Section = {
  bars: 8,
  drop: 1,
  write(w, b) {
    bars(w, b, ['Dm', 'Bb', 'F/A', 'G', 'Dm', 'Bbmaj7', 'C', 'C7'], (s, bar) => {
      w.arp('piano', bar, s, 'B 0 1 2 3 2 1 0', lh(0.32));
      w.pad('pad', bar, s, { lo: 57, hi: 74, count: 4, vel: 0.5 });
      w.bass(bar, s, { vel: 0.4, pattern: 'half' });
      w.arp('harp', bar, s, '. . 0 . . 1 . 2', { lo: 72, hi: 86, count: 3, vel: 0.26, layer: 'harp' });
    });
    lines(w, 'piano', b, ['F5:1 A5:1 D6:2', 'D6:1.5 C6:.5 Bb5:1 F5:1', 'A5:1 C6:1 F6:2', 'E6:1 D6:1 B5:2', 'A5:1 D6:1 F6:1.5 E6:.5', 'D6:2 C6:1 A5:1', 'G5:1 A5:1 C6:1 E6:1', 'G6:2 E6:1 Bb5:1'], 0.6);
    birds(w, b, 8);
  },
};

const A2: Section = {
  bars: 8,
  write(w, b) {
    bars(w, b, ['F', 'Bb:1 C:1 F:2', 'Dm7', 'Bb', 'Gm7', 'C', 'Bb/D', 'Csus4:2 C:2'], (s, bar) => {
      w.arp('piano', bar, s, 'B 0 1 2 B 1 2 3', lh(0.34));
      w.pad('pad', bar, s, { lo: 57, hi: 74, count: 4, vel: 0.55 });
      w.pad('shimmer', bar, s, { lo: 69, hi: 84, count: 3, vel: 0.35 });
      w.bass(bar, s, { vel: 0.44, pattern: 'half' });
    });
    w.motif('piano', b, 0, { vel: 0.68 });
    w.motif('piano', b, 0, { vel: 0.34, oct: 1 });
    lines(w, 'piano', b, ['', '', 'A5:1 C6:1 D6:1 C6:1', 'F6:2 D6:1 C6:1', 'Bb5:1 A5:1 G5:1 F5:1', 'E5:2 G5:2', 'F5:1 A5:1 D6:2', 'C6:2 Bb5:1 G5:1'], 0.62);
    birds(w, b, 8);
  },
};

const coda: Section = {
  bars: 2,
  write(w, b) {
    bars(w, b, ['Bb', 'C'], (s, bar) => {
      w.arp('piano', bar, s, 'B 0 1 2 3 . . .', lh(0.3));
      w.pad('pad', bar, s, { lo: 57, hi: 74, count: 4, vel: 0.45 });
      w.bass(bar, s, { vel: 0.4 });
    });
    lines(w, 'piano', b, ['D6:2 C6:1 A5:1', 'G5:2'], 0.56);
    w.motif('piano', b + 1, -2, { vel: 0.58, only: [4, 5, 6] });
    birds(w, b, 2);
  },
};

const vamp: Section = {
  bars: 1,
  write(w, b) {
    const s = w.prog(b, 'Bbmaj7');
    w.arp('piano', b, s, 'B 0 1 2 3 2 1 0', lh(0.3));
    w.pad('pad', b, s, { lo: 57, hi: 74, count: 4, vel: 0.45 });
  },
};

export const twentythree: ScoreDef = {
  id: 'twentythree',
  bpm: 84,
  beatsPerBar: 4,
  key,
  length: 85,
  loop: false,
  seed: 23,
  sections: [intro, A, B, A2, coda],
  vamp,
  final(w, b) {
    w.prog(b, 'F');
    roll(w, 'piano', 'F2 C3 A3 F4 C5', b, 0, 12, 0.4);
    w.note('piano', 93, b, 1.5, 4, 0.26, { pan: 0.3 });
    hold(w, 'pad', 'F', b, 0, 10, { lo: 57, hi: 74, count: 4, vel: 0.45, release: 4 });
    w.note('bass', 41, b, 0, 9, 0.44);
    w.scatter('bird', w.at(b) + 1, w.at(b) + 8, 2, 4, 0.9);
  },
  tail(w) {
    const t = tailPad(w, 'pad', 'F', 4, { lo: 57, hi: 74, count: 3, vel: 0.3 });
    w.note('piano', 84, 2, 0, 2, 0.2, { pan: 0.2 });
    w.scatter('bird', 0, t.period, 3, 7, 0.8);
    return t;
  },
  cadence(w) {
    roll(w, 'piano', 'C3 G3 Bb3 E4', 0, 0, 2, 0.38);
    w.note('bass', 36, 0, 0, 2, 0.4);
    roll(w, 'piano', 'F2 C3 A3 F4 C5', 0, 2, 12, 0.42);
    w.note('piano', 77, 0, 2, 6, 0.5);
    w.note('bass', 41, 0, 2, 8, 0.42);
    hold(w, 'pad', 'F', 0, 2, 9, { lo: 57, hi: 74, count: 4, vel: 0.4, release: 4 });
  },
  bed: { water: { level: 0.34, cutoff: 2600 }, rain: { level: 0.3, ease: { at: RAIN_EASES, to: 0.12, over: 12 } } },
  mix: { music: 1, amb: 0.95, dryVerb: 0.2, wetVerb: 0.45 },
  brush: { inst: 'piano', lo: 69, hi: 93, vel: 0.42, bus: 'dry', dur: 0.9, bright: 1.2 },
};
