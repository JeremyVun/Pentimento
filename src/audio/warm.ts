import type { Composition } from './compose';
import { adopt, assetKey, isReady, renderAsset, toneAsset, type Asset, type Raw } from './tones';

type Deadline = { timeRemaining(): number };
type Idle = (cb: (d: Deadline) => void) => number;

const idle: Idle =
  (globalThis as { requestIdleCallback?: Idle }).requestIdleCallback?.bind(globalThis) ??
  ((cb) => window.setTimeout(() => cb({ timeRemaining: () => 8 }), 16));

/** Every buffer a composition will play, in the order it first needs them. */
export function compositionAssets(c: Composition): Asset[] {
  const out: Asset[] = [];
  const seen = new Set<string>();
  const add = (a: Asset) => {
    const k = assetKey(a);
    if (!seen.has(k)) {
      seen.add(k);
      out.push(a);
    }
  };
  const tail = c.tail ? c.tail.events : [];
  for (const ev of [...c.events, ...tail, ...c.cadence(0, c.key)]) {
    if (ev.kind === 'note' && ev.inst !== 'bass') add(toneAsset(ev.inst, ev.midi).asset);
    if (ev.kind === 'amb') add({ kind: 'amb', id: ev.sound, n: ev.variant });
  }
  for (let m = c.brush.lo; m <= c.brush.hi + 5; m++) add(toneAsset(c.brush.inst, m).asset);
  return out;
}

/**
 * Generates buffers before they are needed: in a worker when there is one, otherwise in idle time,
 * so the main thread never stalls on a low piano note mid-chapter.
 */
export class Warmer {
  private queue: Asset[] = [];
  private readonly pending = new Map<string, Asset>();
  private readonly flying = new Set<string>();
  private worker: Worker | null = null;
  private idling = false;

  constructor() {
    try {
      const w = new Worker(new URL('./tones.worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<{ asset: Asset; raw: Raw }>) => {
        adopt(e.data.asset, e.data.raw);
        const k = assetKey(e.data.asset);
        this.pending.delete(k);
        this.flying.delete(k);
        this.pump();
      };
      w.onerror = () => {
        w.terminate();
        this.worker = null;
        this.flying.clear();
        this.queue = [...this.pending.values()];
        this.pump();
      };
      this.worker = w;
    } catch {
      this.worker = null;
    }
  }

  request(assets: Asset[], urgent = false): void {
    const fresh: Asset[] = [];
    for (const a of assets) {
      const k = assetKey(a);
      if (isReady(a) || this.pending.has(k)) continue;
      this.pending.set(k, a);
      fresh.push(a);
    }
    if (urgent) {
      const keys = new Set(assets.map(assetKey));
      const first = assets.filter((a) => this.pending.has(assetKey(a)) && !this.flying.has(assetKey(a)));
      this.queue = [...first, ...this.queue.filter((a) => !keys.has(assetKey(a)))];
    } else {
      this.queue.push(...fresh);
    }
    this.pump();
  }

  private pump(): void {
    if (this.worker) {
      while (this.flying.size < 3 && this.queue.length) {
        const a = this.queue.shift()!;
        const k = assetKey(a);
        if (isReady(a)) {
          this.pending.delete(k);
          continue;
        }
        this.flying.add(k);
        this.worker.postMessage(a);
      }
      return;
    }
    if (!this.idling && this.queue.length) {
      this.idling = true;
      idle(this.step);
    }
  }

  private readonly step = (d: Deadline): void => {
    while (this.queue.length && d.timeRemaining() > 6) {
      const a = this.queue.shift()!;
      if (!isReady(a)) adopt(a, renderAsset(a));
      this.pending.delete(assetKey(a));
    }
    this.idling = false;
    if (this.worker) return;
    this.pump();
  };
}
