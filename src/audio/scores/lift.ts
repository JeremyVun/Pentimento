import type { ScoreDef } from '../compose';
import { MAJOR } from '../theory';
import { bars, hold } from './common';

const key = { tonic: 75, scale: MAJOR };

/**
 * Pads use only the tonic, second, fourth and fifth, which every chapter's mode shares,
 * so the melodic fragments can follow whichever layer is being lifted.
 */
const PROG = [
  'Ebsus2', 'Ebsus2', 'Absus2', 'Absus2', 'Ebsus2', 'Bbsus4', 'Absus2', 'Bbsus4',
  'Ebsus2', 'Absus2', 'Ebsus2', 'Bbsus4', 'Absus2', 'Absus2', 'Bbsus4', 'Bbsus4',
];

export const lift: ScoreDef = {
  id: 'lift',
  bpm: 60,
  beatsPerBar: 4,
  key,
  length: 0,
  loop: true,
  seed: 7,
  sections: [
    {
      bars: 16,
      write(w, b) {
        bars(w, b, PROG, (s, bar) => {
          w.pad('pad', bar, s, { lo: 55, hi: 72, count: 3, vel: 0.42, attack: 3, release: 4, bus: 'wet', bright: 0.8 });
          w.pad('shimmer', bar, s, { lo: 70, hi: 86, count: 2, vel: 0.3, bus: 'wet' });
          w.pad('lowpad', bar, s, { lo: 39, hi: 51, count: 1, vel: 0.5, attack: 3, release: 4 });
        });
        const wet = { bus: 'wet' as const };
        w.motif('musicbox', b, -6, { vel: 0.5, oct: 1, only: [6], ...wet });
        w.motif('musicbox', b + 1, 0, { vel: 0.46, oct: 1, only: [0, 1, 2, 3], stretch: 1.5, ...wet });
        w.motif('piano', b + 4, -4, { vel: 0.42, only: [4, 5, 6], stretch: 1.5, ...wet, attack: 0.04 });
        w.motif('glass', b + 6, 0, { vel: 0.4, only: [0, 1], stretch: 2, ...wet });
        w.motif('musicbox', b + 9, -1, { vel: 0.44, oct: 1, only: [1, 2, 3], stretch: 1.5, ...wet });
        w.motif('piano', b + 11, 0, { vel: 0.44, only: [0, 1, 2, 3, 4, 5], stretch: 1.5, ...wet, attack: 0.04 });
        w.motif('glass', b + 14, 2, { vel: 0.3, oct: 1, only: [0], ...wet });
      },
    },
  ],
  cadence(w) {
    hold(w, 'pad', 'Bbsus4', 0, 0, 2, { lo: 55, hi: 72, count: 3, vel: 0.4, bus: 'wet' });
    hold(w, 'pad', 'Ebsus2', 0, 2, 9, { lo: 55, hi: 72, count: 3, vel: 0.4, release: 5, bus: 'wet' });
    w.note('musicbox', 87, 0, 2, 4, 0.46, { deg: 7, bus: 'wet' });
  },
  bed: { water: { level: 0.26, cutoff: 2000 }, wind: 0.14 },
  mix: { music: 1, amb: 0.85, dryVerb: 0.3, wetVerb: 0.7 },
  brush: { inst: 'musicbox', lo: 70, hi: 94, vel: 0.42, bus: 'wet', dur: 1.2 },
};
