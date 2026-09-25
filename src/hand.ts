import { DEFAULT_LAYERS, PLAIN_HAND, type LivingParams } from './gl/painter';
import type { Hand, SceneConfig } from './scene/config';

export function handOf(cfg: SceneConfig): Hand {
  return { ...PLAIN_HAND, strokes: 1, detail: 1, dry: 1, ...cfg.hand };
}

/** The living layer's settings for a year: her hand, plus the blur of her failing eyes at eighty-six. */
export function livingParams(cfg: SceneConfig, time: number, opts: { follow: number; warp?: number; quality?: number }): LivingParams {
  const hand = handOf(cfg);
  const d = hand.detail;
  const q = opts.quality ?? 1;
  const counts = [q, d * q, d * d * q];
  return {
    time,
    warp: opts.warp ?? 1,
    blur: cfg.blur ?? 0,
    strokeScale: hand.strokes,
    angle: 0,
    follow: opts.follow,
    layers: DEFAULT_LAYERS.map((l, i) => ({ ...l, count: l.count * counts[i] })),
    hand,
  };
}

/** The view needs mipmaps when her hand simplifies it or her eyes blur it. */
export function needsMip(cfg: SceneConfig): boolean {
  return !!cfg.blur || handOf(cfg).simplify > 0;
}
