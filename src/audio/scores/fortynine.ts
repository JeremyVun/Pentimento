import type { ScoreDef, Section, Span, Writer } from '../compose';
import { MIXOLYDIAN } from '../theory';
import { bars, hold, lines, roll, tailPad } from './common';

const key = { tonic: 67, scale: MIXOLYDIAN };
const BELL = 62;

const lh = (vel: number) => ({ lo: 45, hi: 59, count: 3, vel, bassLo: 33, bassHi: 44, layer: 'lh' });

function horn(w: Writer, bar: number, s: Span[], vel: number): void {
  w.pad('horn', bar, s, { lo: 46, hi: 62, count: 3, vel, attack: 0.9, release: 1.8 });
}

const intro: Section = {
  bars: 4,
  write(w, b) {
    bars(w, b, ['G', 'F/G', 'C/G', 'G'], (s, bar) => {
      horn(w, bar, s, 0.45);
      w.arp('piano', bar, s, 'B . . . 2 . . .', lh(0.3));
    });
    w.bell(BELL, b, 2, 3, 0.8);
  },
};

const A: Section = {
  bars: 8,
  write(w, b) {
    bars(w, b, ['G', 'C:1 F:1 G:2', 'Em', 'C', 'G/B', 'C:1 F:1 G:2', 'Am7', 'Dm7:2 C:2'], (s, bar) => {
      w.arp('piano', bar, s, 'B 1 2 . 0 1 2 .', lh(0.3));
      horn(w, bar, s, 0.42);
      w.bass(bar, s, { vel: 0.36 });
    });
    w.motif('piano', b, 0, { vel: 0.64 });
    w.motif('piano', b + 4, 0, { vel: 0.62, only: [0, 1, 2, 3] });
    lines(w, 'piano', b, ['', '', 'B4:1 D5:1 E5:1.5 D5:.5', 'C5:1 B4:1 G4:2', '', 'E4:1 F4:1 D5:2', 'C5:1.5 B4:.5 A4:1 G4:1', 'A4:2 G4:2'], 0.6);
  },
};

const B: Section = {
  bars: 8,
  drop: 1,
  write(w, b) {
    bars(w, b, ['Em', 'C', 'F', 'G', 'Em', 'Am7', 'F', 'D7sus4'], (s, bar) => {
      w.arp('piano', bar, s, 'B 0 1 2 1 2 0 2', lh(0.32));
      horn(w, bar, s, 0.5);
      w.bass(bar, s, { vel: 0.4, pattern: 'half' });
    });
    lines(w, 'piano', b, ['B4:1 E5:1 G5:2', 'E5:1.5 D5:.5 C5:1 G4:1', 'A4:1 C5:1 F5:2', 'D5:3 B4:1', 'E5:1 G5:1 B5:1.5 A5:.5', 'G5:2 E5:1 C5:1', 'A5:2 F5:1 C5:1', 'C5:2 D5:2'], 0.6);
  },
};

const A2: Section = {
  bars: 4,
  write(w, b) {
    bars(w, b, ['G', 'C:1 F:1 G:2', 'Em', 'F:2 C:2'], (s, bar) => {
      w.arp('piano', bar, s, 'B 1 2 . 0 1 2 .', lh(0.32));
      horn(w, bar, s, 0.5);
      w.bass(bar, s, { vel: 0.4 });
    });
    w.motif('piano', b, 0, { vel: 0.66 });
    w.motif('piano', b, 0, { vel: 0.3, oct: 1 });
    lines(w, 'piano', b + 2, ['B4:1 A4:1 G4:1 E4:1', 'F4:2 E4:2'], 0.58);
  },
};

const coda: Section = {
  bars: 1,
  write(w, b) {
    const s = w.prog(b, 'C:2 F:2');
    w.arp('piano', b, s, 'B 1 2 . 0 1 . .', lh(0.3));
    horn(w, b, s, 0.45);
    w.bass(b, s, { vel: 0.38 });
    w.line('piano', 'C5:1 E4:1 F4:2', b, 0, 0.56);
  },
};

const vamp: Section = {
  bars: 1,
  write(w, b) {
    const s = w.prog(b, 'F/G');
    w.arp('piano', b, s, 'B 1 2 . 0 1 2 .', lh(0.3));
    horn(w, b, s, 0.42);
  },
};

export const fortynine: ScoreDef = {
  id: 'fortynine',
  bpm: 76,
  beatsPerBar: 4,
  key,
  length: 80,
  loop: false,
  seed: 49,
  sections: [intro, A, B, A2, coda],
  vamp,
  final(w, b) {
    w.prog(b, 'G');
    w.motif('piano', b, -6, { vel: 0.58, only: [6], hold: 3 });
    roll(w, 'piano', 'G2 D3 B3 D4', b, 0, 12, 0.38);
    w.note('bass', 43, b, 0, 9, 0.42);
    hold(w, 'horn', 'G', b, 0, 9, { lo: 50, hi: 67, count: 3, vel: 0.45, release: 4 });
  },
  tail(w) {
    const t = tailPad(w, 'horn', 'G', 4, { lo: 50, hi: 67, count: 3, vel: 0.28 });
    w.note('piano', 74, 2, 0, 2, 0.2, { pan: 0.25 });
    return t;
  },
  cadence(w) {
    roll(w, 'piano', 'F2 C3 A3 C4', 0, 0, 2, 0.38);
    w.note('bass', 41, 0, 0, 2, 0.4);
    roll(w, 'piano', 'G2 D3 B3 D4', 0, 2, 12, 0.4);
    w.note('piano', 67, 0, 2, 6, 0.52);
    w.note('bass', 43, 0, 2, 8, 0.42);
    hold(w, 'horn', 'G', 0, 2, 9, { lo: 50, hi: 67, count: 3, vel: 0.42, release: 4 });
  },
  bed: { water: { level: 0.3, cutoff: 2200 }, wind: 0.4 },
  mix: { music: 1, amb: 0.95, dryVerb: 0.22, wetVerb: 0.5 },
  brush: { inst: 'harp', lo: 62, hi: 86, vel: 0.44, bus: 'wet', dur: 1.5 },
};
