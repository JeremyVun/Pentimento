import type { ScoreDef } from '../compose';
import { MAJOR } from '../theory';
import { bars, hold, lines, roll } from './common';

const key = { tonic: 75, scale: MAJOR };

const PROG = [
  'Eb', 'Bb/D', 'Cm7', 'Ab', 'Eb/G', 'Ab', 'Fm7', 'Bb7sus4:2 Bb7:2',
  'Eb', 'Ab:1 Bb:1 Eb:2', 'Cm7', 'Gm7/Bb', 'Abmaj7', 'Eb/G', 'Fm7', 'Bb7sus4:2 Bb7:2',
];

const MELODY = [
  'r:2 Bb4:1 Eb5:1', 'F5:3 D5:1', 'Eb5:2 G5:1.5 F5:.5', 'Eb5:4', 'r:1 G5:1 Bb5:1 G5:1', 'F5:1.5 Eb5:.5 C5:2', 'Ab4:1 C5:1 Eb5:1 F5:1', 'F5:2 D5:2',
  '', '', 'G5:1.5 F5:.5 Eb5:1 D5:1', 'D5:3 Bb4:1', 'C5:1 Eb5:1 G5:2', 'F5:1.5 Eb5:.5 Bb4:2', 'Ab4:1 C5:1 F5:2', 'Eb5:2 D5:2',
];

export const title: ScoreDef = {
  id: 'title',
  bpm: 66,
  beatsPerBar: 4,
  key,
  length: 0,
  loop: true,
  seed: 1,
  sections: [
    {
      bars: 16,
      write(w, b) {
        bars(w, b, PROG, (s, bar, i) => {
          w.arp('piano', bar, s, 'B 0 1 2 3 2 1 0', { lo: 51, hi: 68, count: 4, vel: i < 8 ? 0.28 : 0.31, bassLo: 39, bassHi: 50, layer: 'lh' });
          w.pad('pad', bar, s, { lo: 55, hi: 72, count: 3, vel: 0.38, attack: 2 });
          w.bass(bar, s, { vel: 0.36, lo: 34 });
        });
        lines(w, 'piano', b, MELODY, 0.55);
        w.motif('piano', b + 8, 0, { vel: 0.6 });
        w.scatter('bird', w.at(b) + 3, w.at(b + 16) - 3, 9, 16, 0.75);
      },
    },
  ],
  cadence(w) {
    roll(w, 'piano', 'Bb2 F3 Ab3 D4', 0, 0, 2, 0.34);
    w.note('bass', 46, 0, 0, 2, 0.36);
    roll(w, 'piano', 'Eb2 Bb2 G3 Eb4 G4', 0, 2, 12, 0.36);
    w.note('piano', 75, 0, 2, 6, 0.5);
    w.note('bass', 39, 0, 2, 8, 0.38);
    hold(w, 'pad', 'Eb', 0, 2, 9, { lo: 55, hi: 72, count: 3, vel: 0.38, release: 4 });
  },
  bed: { water: { level: 0.3, cutoff: 2200 } },
  mix: { music: 1, amb: 0.9, dryVerb: 0.22, wetVerb: 0.5 },
  brush: { inst: 'piano', lo: 67, hi: 91, vel: 0.4, bus: 'dry', dur: 1 },
};
