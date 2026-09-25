import type { ScoreDef, Section, Span, Writer } from '../compose';
import { MAJOR, MINOR } from '../theory';
import { bars, lines, roll } from './common';

const key = { tonic: 69, scale: MINOR };
const major = { tonic: 69, scale: MAJOR };

/** A single low note held under the bar, and sometimes a soft dyad on beat three. */
function lh(w: Writer, bar: number, s: Span[], dyad: boolean, vel = 0.3): void {
  w.arp('piano', bar, s, dyad ? 'B . . . 1 2 . .' : 'B . . . . . . .', { lo: 48, hi: 60, count: 3, vel, bassLo: 36, bassHi: 47, layer: 'lh', bus: 'wet' });
}

function robin(w: Writer, bar: number, n: number): void {
  w.scatter('robin', w.at(bar) + 3, w.at(bar + n), 16, 28, 0.85, 0.5);
}

const intro: Section = {
  bars: 3,
  write(w, b) {
    w.prog(b, 'Am');
    w.prog(b + 1, 'Am');
    lh(w, b + 2, w.prog(b + 2, 'Am'), true, 0.28);
    w.amb('robin', w.at(b + 1, 3), 0.7, 0.45);
  },
};

const A: Section = {
  bars: 6,
  write(w, b) {
    bars(w, b, ['Am', 'F:1 G:1 Am:2', 'Am', 'Dm', 'Esus4:2 E:2', 'Am'], (s, bar, i) => {
      if (i !== 5) lh(w, bar, s, i !== 2);
    });
    w.motif('piano', b, 0, { vel: 0.46, hold: 1.4 });
    lines(w, 'piano', b + 3, ['F4:2 A4:1 D5:1', 'B4:2 G#4:2'], 0.42);
    robin(w, b, 6);
  },
};

const B: Section = {
  bars: 6,
  drop: 1,
  write(w, b) {
    bars(w, b, ['F', 'C/E', 'Dm', 'Am', 'F', 'Esus4:2 E:2'], (s, bar, i) => {
      if (i !== 3) lh(w, bar, s, true, 0.32);
    });
    lines(w, 'piano', b, ['A4:1 C5:1 F5:2', 'E5:3 D5:1', 'C5:2 A4:2', '', 'C5:1.5 B4:.5 A4:1 F4:1', 'E4:4'], 0.44);
    robin(w, b, 6);
  },
};

const A2: Section = {
  bars: 4,
  write(w, b) {
    bars(w, b, ['Am', 'Dm:2 E:2', 'Am/C', 'F'], (s, bar, i) => lh(w, bar, s, i !== 2));
    w.motif('piano', b, 0, { vel: 0.46, only: [0, 1, 2, 3], hold: 1.4 });
    lines(w, 'piano', b + 1, ['F4:2 G#4:2', '', 'A4:2 C5:2'], 0.42);
    robin(w, b, 4);
  },
};

const coda: Section = {
  bars: 2,
  write(w, b) {
    bars(w, b, ['Dm', 'Esus4:2 E:2'], (s, bar) => lh(w, bar, s, true, 0.3));
    lines(w, 'piano', b, ['F4:2 E4:2', 'B3:2 G#3:2'], 0.4);
  },
};

const vamp: Section = {
  bars: 1,
  write(w, b) {
    lh(w, b, w.prog(b, 'Am'), false);
  },
};

export const seventytwo: ScoreDef = {
  id: 'seventytwo',
  bpm: 54,
  beatsPerBar: 4,
  key,
  length: 95,
  loop: false,
  seed: 72,
  sections: [intro, A, B, A2, coda],
  vamp,
  final(w, b) {
    w.prog(b, 'A', major);
    roll(w, 'piano', 'A2 E3 A3 C#4 E4', b, 0, 12, 0.36, { bus: 'wet' });
    w.motif('piano', b, -6, { vel: 0.44, only: [6], hold: 4 });
    w.amb('robin', w.at(b, 2.5), 0.75, 0.4);
  },
  tail(w) {
    w.prog(0, 'A', major);
    w.note('glass', 76, 0, 2, 4, 0.2, { pan: 0.2 });
    w.note('glass', 81, 2, 2, 4, 0.16, { pan: -0.2 });
    w.amb('robin', w.at(3), 0.6, 0.4);
    return { period: 4 * w.bar };
  },
  cadence(w) {
    roll(w, 'piano', 'E2 B2 E3 G#3 D4', 0, 0, 2, 0.34, { bus: 'wet' });
    roll(w, 'piano', 'A2 E3 A3 C#4 E4', 0, 2, 12, 0.36, { bus: 'wet' });
    w.note('piano', 69, 0, 2, 8, 0.44);
  },
  bed: { water: { level: 0.24, cutoff: 380 }, snow: 0.34 },
  mix: { music: 1.5, amb: 0.9, dryVerb: 0.28, wetVerb: 0.55 },
  brush: { inst: 'glass', lo: 69, hi: 93, vel: 0.38, bus: 'wet', dur: 2 },
};
