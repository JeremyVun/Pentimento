import { Pt, xAtY } from './util';

export const A = 1.6;

export const RIVER_LEFT: Pt[] = [
  [0.7, 0.478], [0.655, 0.5], [0.59, 0.526], [0.522, 0.556], [0.485, 0.585], [0.47, 0.615],
  [0.485, 0.665], [0.525, 0.72], [0.575, 0.79], [0.62, 0.87], [0.65, 0.95], [0.664, 1.02],
];
export const RIVER_RIGHT: Pt[] = [
  [0.745, 0.478], [0.765, 0.5], [0.81, 0.526], [0.9, 0.556], [0.985, 0.585], [1.04, 0.615],
  [1.085, 0.66], [1.13, 0.72], [1.17, 0.8], [1.2, 0.88], [1.225, 0.95], [1.24, 1.02],
];
export const FLOOD_LEFT: Pt[] = [
  [0.68, 0.478], [0.6, 0.5], [0.42, 0.535], [0.2, 0.56], [-0.02, 0.585],
  [-0.02, 0.728], [0.52, 0.728], [0.575, 0.79], [0.62, 0.87], [0.65, 0.95], [0.664, 1.02],
];
export const FLOOD_RIGHT: Pt[] = [
  [0.76, 0.478], [0.8, 0.5], [0.87, 0.526], [0.97, 0.556], [1.05, 0.585], [1.1, 0.615],
  [1.15, 0.66], [1.2, 0.72], [1.24, 0.8], [1.28, 0.88], [1.31, 0.95], [1.33, 1.02],
];

export function riverBanks(flood: boolean): { left: Pt[]; right: Pt[] } {
  return flood ? { left: FLOOD_LEFT, right: FLOOD_RIGHT } : { left: RIVER_LEFT, right: RIVER_RIGHT };
}

/** x range of the river at height y, ignoring the flood's sideways spill. */
export function riverSpan(y: number, flood: boolean): [number, number] {
  const b = riverBanks(false);
  const l = xAtY(b.left, y);
  const r = xAtY(b.right, y);
  if (!flood) return [l, r];
  return [l - 0.02, r + 0.06];
}

export const BRIDGE = {
  x0: 0.355,
  x1: 1.125,
  top: 0.543,
  deck: 0.552,
  water: 0.622,
  spans: [[0.472, 0.628], [0.662, 0.818], [0.852, 1.008]] as [number, number][],
  rise: 0.043,
};

export const WALL_Y = 0.728;

/** The shapes poured paint fills. Paint flows freely inside one region and stops at its edges. */
export const REGION = {
  sky: 1, hills: 2, fields: 3, town: 4, rightBank: 5, nearBank: 6, river: 7, bridge: 8,
  garden: 9, fig: 10, willow: 11, window: 12, none: 0,
} as const;
export const FIG_BASE: Pt = [0.19, 0.958];
export const WILLOW_BASE: Pt = [1.5, 0.93];

export function gardenRight(y: number): number {
  return xAtY(RIVER_LEFT, y) - 0.012;
}
