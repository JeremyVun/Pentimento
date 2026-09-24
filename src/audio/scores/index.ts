import type { ScoreId } from '../index';
import { build, type Composition, type ScoreDef } from '../compose';
import { eightysix } from './eightysix';
import { fortyfour } from './fortyfour';
import { fortynine } from './fortynine';
import { later } from './later';
import { lift } from './lift';
import { nine } from './nine';
import { seventytwo } from './seventytwo';
import { sixteen } from './sixteen';
import { thirtyone } from './thirtyone';
import { title } from './title';
import { twentythree } from './twentythree';

export const SCORES: Record<ScoreId, ScoreDef> = {
  title,
  nine,
  sixteen,
  twentythree,
  thirtyone,
  fortyfour,
  fortynine,
  seventytwo,
  eightysix,
  later,
  lift,
};

export const SCORE_IDS = Object.keys(SCORES) as ScoreId[];

const cache = new Map<string, Composition>();

/** The composed score; chapter scores are fitted so the final cadence lands at `durationSec`. */
export function compose(id: ScoreId, durationSec?: number): Composition {
  const def = SCORES[id];
  const len = def.loop ? 0 : Math.round((durationSec && durationSec > 5 ? durationSec : def.length) * 100) / 100;
  const k = `${id}:${len}`;
  let c = cache.get(k);
  if (!c) {
    c = build(def, len || undefined);
    cache.set(k, c);
  }
  return c;
}
