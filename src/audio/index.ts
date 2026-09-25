import { Brush, type BrushTarget } from './brush';
import { engineStats } from './debug';
import { ScorePlayer } from './player';
import { compose, SCORES, SCORE_IDS } from './scores';
import { Synth } from './synth';
import { LOOP_IDS } from './tones';
import { compositionAssets, Warmer } from './warm';

export type ScoreId =
  | 'title' | 'nine' | 'sixteen' | 'twentythree' | 'thirtyone'
  | 'fortyfour' | 'fortynine' | 'seventytwo' | 'eightysix' | 'later' | 'lift';

export interface AudioEngine {
  /** Starts making every score's buffers in the background before the first gesture; `unlock` does it otherwise. */
  warm(): void;
  unlock(): Promise<void>;
  play(id: ScoreId, durationSec?: number): void;
  endChapter(): void;
  brush(x: number, y: number, speed: number): void;
  brushUp(): void;
  wake(x: number): void;
  duck(on: boolean): void;
  setMuted(muted: boolean): void;
  readonly muted: boolean;
  liftLayer(id: ScoreId | null): void;
  /** The church bell strikes eight, in time with the current score. */
  bell(): void;
}

const LOOKAHEAD = 0.13;
const TICK_MS = 25;
const CROSSFADE = 3;

export function createAudioEngine(): AudioEngine {
  let ctx: AudioContext | null = null;
  let synth: Synth | null = null;
  let brush: Brush | null = null;
  let brushOuts: Synth['outs'] | null = null;
  let current: ScorePlayer | null = null;
  let currentId: ScoreId | null = null;
  const fading: { p: ScorePlayer; until: number }[] = [];
  let pending: { id: ScoreId; dur?: number } | null = null;
  let muted = false;
  let ducked = false;
  let layer: ScoreId | null = null;
  let brushDown = false;
  let warmer: Warmer | null = null;

  function tick(): void {
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    if (current) current.pump(now + LOOKAHEAD - current.t0);
    for (let i = fading.length - 1; i >= 0; i--) {
      const f = fading[i];
      if (now > f.until) {
        f.p.dispose(now);
        fading.splice(i, 1);
      } else {
        f.p.pump(now + LOOKAHEAD - f.p.t0);
      }
    }
  }

  function liftMode(): ScorePlayer['mode'] {
    if (currentId !== 'lift' || !layer || layer === 'lift') return null;
    return { tonic: SCORES.lift.key.tonic, scale: SCORES[layer].key.scale };
  }

  function target(): BrushTarget | null {
    if (!current || !brushOuts) return null;
    const p = current;
    const spec = currentId === 'lift' && layer ? SCORES[layer].brush : p.comp.brush;
    return { t0: p.t0, eighth: p.comp.beat / 2, harmony: (t) => p.harmony(t), spec, outs: brushOuts };
  }

  function start(id: ScoreId, dur?: number): void {
    if (!ctx || !synth) return;
    const comp = compose(id, dur);
    const now = ctx.currentTime;
    const old = current;
    if (old) {
      old.fadeOut(now, CROSSFADE);
      fading.push({ p: old, until: now + CROSSFADE + 0.2 });
    }
    current = new ScorePlayer(synth, comp, now + 0.1, old ? CROSSFADE : 0.8);
    currentId = id;
    current.mode = liftMode();
    synth.setMix(comp.mix, now, old ? CROSSFADE : 0.05);
    warmer?.request(compositionAssets(comp), true);
    tick();
  }

  function onVisibility(): void {
    if (!ctx) return;
    if (document.hidden) {
      if (brush) brush.up(ctx.currentTime);
      brushDown = false;
      ctx.suspend().catch(() => {});
    } else {
      ctx.resume().catch(() => {});
    }
  }

  const engine: AudioEngine = {
    warm() {
      if (warmer) return;
      warmer = new Warmer();
      warmer.request(LOOP_IDS.map((id) => ({ kind: 'loop', id, n: 0 })));
      for (const sid of SCORE_IDS) warmer.request(compositionAssets(compose(sid)));
    },

    async unlock() {
      try {
        if (!ctx) {
          // iOS plays Web Audio through the ringer channel unless told this is playback, so the silent switch would mute it.
          const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
          if (session) session.type = 'playback';
          ctx = new AudioContext({ latencyHint: 'interactive' });
          synth = new Synth(ctx);
          brushOuts = synth.makeOuts(1).outs;
          brush = new Brush(synth, target);
          synth.setMuted(muted, ctx.currentTime);
          if (ducked) synth.duck(true, ctx.currentTime);
          document.addEventListener('visibilitychange', onVisibility);
          let failed = false;
          setInterval(() => {
            try {
              tick();
            } catch (e) {
              if (!failed) console.error(e);
              failed = true;
            }
          }, TICK_MS);
          engine.warm();
        }
        if (ctx.state !== 'running' && !document.hidden) await ctx.resume();
        if (pending) {
          const p = pending;
          pending = null;
          start(p.id, p.dur);
        }
      } catch (e) {
        console.warn('Audio could not start', e);
      }
    },

    play(id, durationSec) {
      if (currentId === id && current && !current.ended) return;
      if (!ctx) {
        pending = { id, dur: durationSec };
        return;
      }
      start(id, durationSec);
    },

    endChapter() {
      if (!ctx) {
        pending = null;
        return;
      }
      current?.end(ctx.currentTime);
    },

    brush(x, y, speed) {
      if (!ctx || !brush || ctx.state !== 'running') return;
      brushDown = true;
      brush.move(x, y, speed, ctx.currentTime);
    },

    brushUp() {
      if (!ctx || !brush || !brushDown) return;
      brushDown = false;
      brush.up(ctx.currentTime);
    },

    wake(x) {
      if (!ctx || !brush || ctx.state !== 'running') return;
      brush.wake(x, ctx.currentTime);
    },

    duck(on) {
      ducked = on;
      if (ctx && synth) synth.duck(on, ctx.currentTime);
    },

    setMuted(m) {
      muted = m;
      if (ctx && synth) synth.setMuted(m, ctx.currentTime);
    },

    get muted() {
      return muted;
    },

    liftLayer(id) {
      layer = id;
      if (current) current.mode = liftMode();
    },

    bell() {
      if (!ctx || !current || ctx.state !== 'running') return;
      const p = current;
      const beat = p.comp.beat;
      const from = Math.ceil((ctx.currentTime - p.t0 + 0.05) / beat) * beat;
      for (let k = 0; k < 8; k++) {
        p.dispatch({ kind: 'note', t: from + k * 3 * beat, inst: 'bell', midi: 62, dur: 12, vel: 0.8 * (k === 0 ? 1 : 0.94), pan: -0.35, bus: 'far' });
      }
    },
  };
  engineStats.set(engine, () => ({
    state: ctx?.state ?? 'none',
    time: ctx?.currentTime ?? 0,
    voices: synth?.voiceCount ?? 0,
    peakVoices: synth?.peakVoices ?? 0,
    stolen: synth?.stolen ?? 0,
    players: (current ? 1 : 0) + fading.length,
    score: currentId,
  }));
  return engine;
}
