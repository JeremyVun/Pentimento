import type { ScoreDef, Section, Span, Writer } from '../compose';
import { MAJOR } from '../theory';
import { bars, hold, lines, roll, tailPad } from './common';

const key = { tonic: 73, scale: MAJOR };
const SOFT = { bus: 'wet' as const, attack: 0.05, bright: 0.75 };
const MOTIF = { stretch: 2, only: [0, 1, 2, 3, 4, 5], hold: 1.1, ...SOFT };

function wash(w: Writer, bar: number, s: Span[], vel: number): void {
  w.pad('pad', bar, s, { lo: 53, hi: 70, count: 4, vel, attack: 2.5, release: 4, bus: 'wet', bright: 0.8 });
  w.pad('shimmer', bar, s, { lo: 68, hi: 84, count: 3, vel: vel * 0.8, bus: 'wet' });
}

function lh(w: Writer, bar: number, s: Span[], vel: number): void {
  w.arp('piano', bar, s, 'B 1 2 3', { lo: 51, hi: 65, count: 3, vel, bassLo: 37, bassHi: 48, sub: 1, layer: 'lh', ...SOFT });
}

function birds(w: Writer, bar: number, n: number): void {
  w.scatter('bird', w.at(bar) + 2, w.at(bar + n), 7, 14, 0.6);
}

const intro: Section = {
  bars: 4,
  write(w, b) {
    bars(w, b, ['Db', 'Gbmaj7', 'Db/F', 'Gbmaj7'], (s, bar) => {
      wash(w, bar, s, 0.5);
      w.arp('piano', bar, s, 'B . 1 . 2 . 3 .', { lo: 53, hi: 67, count: 3, vel: 0.28, bassLo: 37, bassHi: 48, layer: 'lh', ...SOFT });
    });
    birds(w, b, 4);
  },
};

const A: Section = {
  bars: 8,
  write(w, b) {
    bars(w, b, ['Db', 'Bbm7:2 Gb:2', 'Gb:2 Ab:2', 'Bbm7:2 Gbmaj7:2', 'Gbmaj7', 'Db/F', 'Ebm7', 'Ab7sus4:2 Ab:2'], (s, bar) => {
      wash(w, bar, s, 0.5);
      lh(w, bar, s, 0.26);
    });
    w.motif('piano', b, 0, { vel: 0.56, ...MOTIF });
    lines(w, 'piano', b + 4, ['F5:2 Eb5:1 Db5:1', 'Ab4:4', 'Gb4:1 Bb4:1 Db5:1 Eb5:1', 'Eb5:2 C5:2'], 0.5, SOFT);
    birds(w, b, 8);
  },
};

const B: Section = {
  bars: 8,
  drop: 1,
  write(w, b) {
    bars(w, b, ['Bbm', 'Gb', 'Db/F', 'Gbmaj7', 'Ebm7', 'Db/Ab', 'Gb', 'Absus4:2 Ab:2'], (s, bar) => {
      wash(w, bar, s, 0.62);
      lh(w, bar, s, 0.28);
      w.bass(bar, s, { vel: 0.34, lo: 37 });
    });
    lines(w, 'piano', b, ['F5:2 Db5:2', 'Bb5:3 Ab5:1', 'F5:4', 'r:2 Eb5:1 F5:1', 'Gb5:2 F5:1 Eb5:1', 'F5:2 Ab5:2', 'Db6:2 Bb5:2', 'Ab5:2 Eb5:2'], 0.5, SOFT);
    birds(w, b, 8);
  },
};

const A2: Section = {
  bars: 4,
  write(w, b) {
    bars(w, b, ['Db', 'Bbm7:2 Gb:2', 'Gb:2 Ab:2', 'Ab7sus4:2 Ab7:2'], (s, bar) => {
      wash(w, bar, s, 0.55);
      lh(w, bar, s, 0.26);
    });
    w.motif('piano', b, 0, { vel: 0.58, ...MOTIF });
    birds(w, b, 4);
  },
};

const vamp: Section = {
  bars: 1,
  write(w, b) {
    const s = w.prog(b, 'Gbmaj7');
    wash(w, b, s, 0.5);
    lh(w, b, s, 0.26);
  },
};

export const eightysix: ScoreDef = {
  id: 'eightysix',
  bpm: 68,
  beatsPerBar: 4,
  key,
  length: 85,
  loop: false,
  seed: 86,
  sections: [intro, A, B, A2],
  vamp,
  final(w, b) {
    w.prog(b, 'Db');
    w.motif('piano', b, -12, { vel: 0.6, stretch: 2, only: [6], hold: 2, ...SOFT });
    roll(w, 'piano', 'Db2 Ab2 F3 Db4 Ab4', b, 0, 12, 0.34, SOFT);
    w.note('bass', 37, b, 0, 9, 0.38);
    hold(w, 'pad', 'Db', b, 0, 10, { lo: 56, hi: 75, count: 4, vel: 0.5, release: 5, bus: 'wet' });
    hold(w, 'shimmer', 'Db', b, 0, 10, { lo: 68, hi: 84, count: 3, vel: 0.4, release: 5, bus: 'wet' });
  },
  tail(w) {
    const t = tailPad(w, 'pad', 'Db', 4, { lo: 56, hi: 75, count: 4, vel: 0.3, bus: 'wet' });
    w.note('piano', 80, 1, 0, 3, 0.2, SOFT);
    w.scatter('bird', 0, t.period, 6, 12, 0.5);
    return t;
  },
  cadence(w) {
    roll(w, 'piano', 'Ab2 Eb3 Gb3 C4', 0, 0, 2, 0.32, SOFT);
    roll(w, 'piano', 'Db2 Ab2 F3 Db4 Ab4', 0, 2, 12, 0.34, SOFT);
    w.motif('piano', 0, -4, { vel: 0.56, only: [6], hold: 2, ...SOFT });
    hold(w, 'pad', 'Db', 0, 2, 9, { lo: 56, hi: 75, count: 4, vel: 0.45, release: 5, bus: 'wet' });
  },
  bed: { water: { level: 0.28, cutoff: 1500 } },
  mix: { music: 1, amb: 0.85, dryVerb: 0.35, wetVerb: 0.75 },
  brush: { inst: 'piano', lo: 68, hi: 92, vel: 0.36, bus: 'wet', dur: 1.6, attack: 0.06, bright: 0.7 },
};
