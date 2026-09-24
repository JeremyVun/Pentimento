import { Brush, type BrushTarget } from './brush';
import type { Composition } from './compose';
import { engineStats } from './debug';
import { ScorePlayer } from './player';
import { compose, SCORES, SCORE_IDS } from './scores';
import { Synth } from './synth';
import { hasTone, toneBuffer, type ToneId } from './tones';

export type ScoreId =
  | 'title' | 'nine' | 'sixteen' | 'twentythree' | 'thirtyone'
  | 'fortyfour' | 'fortynine' | 'seventytwo' | 'eightysix' | 'later' | 'lift';

export interface AudioEngine {
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
}

const LOOKAHEAD = 0.13;
const TICK_MS = 25;
const CROSSFADE = 3;

type Idle = (cb: (deadline: { timeRemaining(): number }) => void) => number;

/** Builds the per-note buffers a score needs in idle time, so scheduling rarely stalls on them. */
function warm(comp: Composition, extra: [ToneId, number][] = []): void {
  const todo = new Map<string, [ToneId, number]>();
  for (const ev of comp.events) {
    if (ev.kind === 'note' && ev.inst !== 'bass' && !hasTone(ev.inst, ev.midi)) todo.set(`${ev.inst}:${ev.midi}`, [ev.inst, ev.midi]);
  }
  for (const [inst, midi] of extra) if (!hasTone(inst, midi)) todo.set(`${inst}:${midi}`, [inst, midi]);
  const first = new Map<string, number>();
  for (const ev of comp.events) {
    if (ev.kind === 'note' && !first.has(`${ev.inst}:${ev.midi}`)) first.set(`${ev.inst}:${ev.midi}`, ev.t);
  }
  const queue = [...todo.entries()].sort((a, b) => (first.get(a[0]) ?? 1e9) - (first.get(b[0]) ?? 1e9)).map((e) => e[1]);
  const idle: Idle =
    (globalThis as { requestIdleCallback?: Idle }).requestIdleCallback?.bind(globalThis) ??
    ((cb) => window.setTimeout(() => cb({ timeRemaining: () => 8 }), 16));
  const step = (deadline: { timeRemaining(): number }) => {
    while (queue.length && deadline.timeRemaining() > 4) {
      const [inst, midi] = queue.shift()!;
      toneBuffer(inst, midi);
    }
    if (queue.length) idle(step);
  };
  idle(step);
}

function brushRange(id: ScoreId): [ToneId, number][] {
  const b = SCORES[id].brush;
  const out: [ToneId, number][] = [];
  for (let m = b.lo; m <= b.hi + 17; m++) out.push([b.inst, m]);
  return out;
}

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
    warm(comp, id === 'lift' ? SCORE_IDS.flatMap(brushRange) : brushRange(id));
    tick();
  }

  function onVisibility(): void {
    if (!ctx) return;
    if (document.hidden) {
      if (brush) brush.up(ctx.currentTime);
      brushDown = false;
      void ctx.suspend();
    } else {
      void ctx.resume();
    }
  }

  const engine: AudioEngine = {
    async unlock() {
      if (!ctx) {
        ctx = new AudioContext({ latencyHint: 'interactive' });
        synth = new Synth(ctx);
        brushOuts = synth.makeOuts(1).outs;
        brush = new Brush(synth, target);
        synth.setMuted(muted, ctx.currentTime);
        if (ducked) synth.duck(true, ctx.currentTime);
        document.addEventListener('visibilitychange', onVisibility);
        setInterval(tick, TICK_MS);
      }
      if (ctx.state !== 'running' && !document.hidden) await ctx.resume();
      if (pending) {
        const p = pending;
        pending = null;
        start(p.id, p.dur);
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
