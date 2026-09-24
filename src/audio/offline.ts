import type { ScoreId } from './index';
import { Brush, type BrushNote } from './brush';
import { ScorePlayer } from './player';
import { compose } from './scores';
import { Synth } from './synth';

export interface RenderOptions {
  /** Chapter length the score is fitted to; defaults to the contract length. */
  chapterSec?: number;
  /** Paint continuously (with short lifts) over the render using a scripted stroke path. */
  brush?: boolean;
  /** Call endChapter() at this many seconds. */
  endAt?: number;
  /** Return four channels: the master mix, then the music bus alone (for gap analysis). */
  stems?: boolean;
  onBrushNote?: (note: BrushNote) => void;
  /** Silence everything but the music, the ambience or the brush hiss, for balancing. */
  solo?: 'music' | 'amb' | 'bristle';
  onVoices?: (peak: number, stolen: number) => void;
}

const FPS = 60;
const LOOKAHEAD = 0.13;

function strokePos(u: number): { x: number; y: number } {
  return {
    x: 0.5 + 0.38 * Math.sin(u * 1.3) * Math.cos(u * 0.21),
    y: 0.5 + 0.4 * Math.sin(u * 0.37 + 1) * Math.sin(u * 0.9),
  };
}

/** Path time: strokes alternate between slow, steady painting and fast scrubbing. */
function strokeClock(t: number): number {
  const cycle = Math.floor(t / 6.5);
  const within = t - cycle * 6.5;
  return cycle * 6.5 * 2 + within * (cycle % 2 ? 3.5 : 1);
}

/** A looping, wandering stroke: mostly painting, lifting for a moment every few seconds. */
export function strokeAt(t: number): { x: number; y: number; speed: number; down: boolean } {
  const down = t % 6.5 < 5.6;
  const dt = 1 / FPS;
  const a = strokePos(strokeClock(t));
  const b = strokePos(strokeClock(t + dt));
  return { ...a, speed: Math.hypot(b.x - a.x, b.y - a.y) / dt, down };
}

/** Renders `durationSec` seconds of a score with the same code the live engine uses. */
export async function renderOffline(id: ScoreId, durationSec: number, sampleRate = 44100, opts: RenderOptions = {}): Promise<AudioBuffer> {
  const ctx = new OfflineAudioContext(opts.stems ? 4 : 2, Math.ceil(durationSec * sampleRate), sampleRate);
  const synth = new Synth(ctx, { stems: opts.stems });
  const comp = compose(id, opts.chapterSec);
  const solo = opts.solo;
  const music = solo === 'amb' || solo === 'bristle' ? 0 : comp.mix.music;
  const amb = solo === 'music' || solo === 'bristle' ? 0 : comp.mix.amb;
  synth.setMix({ ...comp.mix, music, amb, dryVerb: music ? comp.mix.dryVerb : 0, wetVerb: music ? comp.mix.wetVerb : 0 }, 0, 0.01);
  const finish = async () => {
    const buf = await ctx.startRendering();
    opts.onVoices?.(synth.peakVoices, synth.stolen);
    return buf;
  };
  const player = new ScorePlayer(synth, comp, 0.1, 0.8);
  const endAt = opts.endAt;

  if (!opts.brush && endAt === undefined) {
    player.pump(durationSec);
    return finish();
  }

  const outs = synth.makeOuts(1).outs;
  const brush = new Brush(synth, () => ({ t0: player.t0, eighth: comp.beat / 2, harmony: (t) => player.harmony(t), spec: comp.brush, outs }));
  brush.onNote = opts.onBrushNote ?? null;
  let wasDown = false;
  let ended = false;
  for (let f = 0; f / FPS < durationSec; f++) {
    const t = f / FPS;
    if (endAt !== undefined && !ended && t >= endAt) {
      player.pump(t + LOOKAHEAD - player.t0);
      player.end(t);
      ended = true;
    }
    player.pump(t + LOOKAHEAD - player.t0);
    if (!opts.brush) continue;
    const s = strokeAt(t);
    if (s.down) {
      brush.move(s.x, s.y, s.speed, t);
      wasDown = true;
    } else if (wasDown) {
      brush.up(t);
      wasDown = false;
    }
  }
  return finish();
}
