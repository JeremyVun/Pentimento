import type { ScoreDef, Section, Span, Writer } from '../compose';
import { HARMONIC_MINOR, MINOR } from '../theory';
import { bars, hold, lines, roll, tailPad } from './common';

const key = { tonic: 60, scale: MINOR };
const harmonic = { tonic: 60, scale: HARMONIC_MINOR };

function low(w: Writer, bar: number, s: Span[], vel: number): void {
  w.pad('lowpad', bar, s, { lo: 43, hi: 60, count: 3, vel, attack: 2.5, release: 3.5 });
  w.bass(bar, s, { vel: 0.42, lo: 31 });
}

function thunder(w: Writer, bar: number, n: number): void {
  w.scatter('thunder', w.at(bar) + 2, w.at(bar + n), 14, 24, 0.9, 0.6);
}

const intro: Section = {
  bars: 2,
  write(w, b) {
    bars(w, b, ['Cm', 'Cm'], (s, bar) => low(w, bar, s, 0.55));
    roll(w, 'piano', 'C2 G2', b, 0, 8, 0.42, { bus: 'wet' });
    w.amb('thunder', w.at(b) + 1.5, 0.8, -0.3);
  },
};

const A: Section = {
  bars: 6,
  write(w, b) {
    bars(w, b, ['Cm', 'Ab', 'Fm', 'Cm/Eb', 'Ab', 'G'], (s, bar) => low(w, bar, s, 0.55));
    w.motif('piano', b, 0, { vel: 0.5, only: [0, 1, 2, 3], hold: 1.6 });
    roll(w, 'piano', 'Ab2 Eb3 C4', b + 1, 0, 4, 0.34);
    lines(w, 'piano', b + 2, ['F3:2 Ab3:1 C4:1', 'G3:4'], 0.44);
    w.note('piano', 39, b + 3, 0, 4, 0.36);
    w.motif('piano', b + 4, -1, { vel: 0.46, only: [1, 2, 3], hold: 1.4 });
    w.line('piano', 'B3:4', b + 5, 0, 0.42);
    w.note('piano', 31, b + 5, 0, 4, 0.34);
    thunder(w, b, 6);
  },
};

const interlude: Section = {
  bars: 2,
  drop: 2,
  write(w, b) {
    bars(w, b, ['Ab', 'G'], (s, bar) => low(w, bar, s, 0.6));
    w.note('piano', 32, b, 0, 4, 0.36);
    w.note('piano', 31, b + 1, 0, 4, 0.36);
    thunder(w, b, 2);
  },
};

const B: Section = {
  bars: 6,
  drop: 1,
  write(w, b) {
    bars(w, b, ['Cm', 'Db', 'Ab', 'Eb/G', 'Fm', 'G'], (s, bar, i) => {
      low(w, bar, s, 0.6);
      if (i > 0) w.arp('piano', bar, s, 'B . . . 1 . . .', { lo: 48, hi: 63, count: 3, vel: 0.3, bassLo: 31, bassHi: 43, layer: 'lh' });
    });
    w.motif('piano', b, 0, { vel: 0.5, only: [0, 1], hold: 2.2 });
    lines(w, 'piano', b + 1, ['F4:2 Db4:2', 'C4:1 Eb4:1 Ab4:2', 'G4:3 F4:1', 'Ab4:2 G4:1 F4:1', 'D4:2 B3:2'], 0.46);
    thunder(w, b, 6);
  },
};

const A2: Section = {
  bars: 4,
  write(w, b) {
    bars(w, b, ['Cm', 'Ab', 'Fm', 'G'], (s, bar) => low(w, bar, s, 0.55));
    w.motif('piano', b, 0, { vel: 0.5, only: [0, 1, 2, 3], hold: 1.6 });
    w.motif('piano', b + 1, -4, { vel: 0.44, only: [4], hold: 2 });
    w.motif('piano', b + 3, -5, { vel: 0.42, only: [5], key: harmonic, hold: 3 });
    roll(w, 'piano', 'F2 C3 Ab3', b + 2, 0, 4, 0.3);
    thunder(w, b, 4);
  },
};

const vamp: Section = {
  bars: 1,
  write(w, b) {
    low(w, b, w.prog(b, 'Cm'), 0.5);
  },
};

export const fortyfour: ScoreDef = {
  id: 'fortyfour',
  bpm: 60,
  beatsPerBar: 4,
  key,
  length: 80,
  loop: false,
  seed: 44,
  sections: [intro, A, interlude, B, A2],
  vamp,
  final(w, b) {
    w.prog(b, 'Cm');
    roll(w, 'piano', 'C2 G2 Eb3 C4', b, 0, 10, 0.4, { bus: 'wet' });
    w.note('bass', 36, b, 0, 8, 0.42);
    hold(w, 'lowpad', 'Cm', b, 0, 9, { lo: 43, hi: 60, count: 3, vel: 0.5, release: 4 });
    w.amb('thunder', w.at(b) + 3, 0.7, 0.4);
  },
  tail(w) {
    const t = tailPad(w, 'lowpad', 'Cm', 3, { lo: 43, hi: 60, count: 3, vel: 0.3 });
    w.amb('thunder', w.at(1, 2), 0.6, -0.4);
    return t;
  },
  cadence(w) {
    roll(w, 'piano', 'G1 D3 G3 B3', 0, 0, 2, 0.38);
    w.note('bass', 31, 0, 0, 2, 0.4);
    roll(w, 'piano', 'C2 G2 Eb3 C4', 0, 2, 12, 0.42, { bus: 'wet' });
    w.note('bass', 36, 0, 2, 8, 0.42);
    hold(w, 'lowpad', 'Cm', 0, 2, 9, { lo: 43, hi: 60, count: 3, vel: 0.45, release: 4 });
  },
  bed: { water: { level: 0.42, cutoff: 1900, roar: 0.5 }, rain: { level: 0.5, heavy: true } },
  mix: { music: 0.95, amb: 0.95, dryVerb: 0.26, wetVerb: 0.5 },
  brush: { inst: 'piano', lo: 48, hi: 72, vel: 0.38, bus: 'wet', dur: 1.4, bright: 0.6 },
};
