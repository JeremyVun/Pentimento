export const MAJOR = [0, 2, 4, 5, 7, 9, 11] as const;
export const MINOR = [0, 2, 3, 5, 7, 8, 10] as const;
export const HARMONIC_MINOR = [0, 2, 3, 5, 7, 8, 11] as const;
export const DORIAN = [0, 2, 3, 5, 7, 9, 10] as const;
export const LYDIAN = [0, 2, 4, 6, 7, 9, 11] as const;
export const MIXOLYDIAN = [0, 2, 4, 5, 7, 9, 10] as const;

export interface Key {
  tonic: number;
  scale: readonly number[];
}

export function hz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function stepToMidi(key: Key, step: number): number {
  const oct = Math.floor(step / 7);
  return key.tonic + 12 * oct + key.scale[step - oct * 7];
}

export function pc(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function inScale(key: Key, midi: number): boolean {
  const rel = pc(midi - key.tonic);
  return key.scale.includes(rel);
}

const LETTERS: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

export function noteToMidi(name: string): number {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + LETTERS[m[1]] + acc;
}

function pitchClass(name: string): number {
  const m = /^([A-G])(#|b)?$/.exec(name);
  if (!m) throw new Error(`bad pitch class ${name}`);
  return pc(LETTERS[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0));
}

const QUALITIES: Record<string, readonly number[]> = {
  '': [0, 4, 7],
  m: [0, 3, 7],
  '5': [0, 7],
  '7': [0, 4, 7, 10],
  maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '7sus4': [0, 5, 7, 10],
  add9: [0, 2, 4, 7],
  madd9: [0, 2, 3, 7],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  dim: [0, 3, 6],
  maj9: [0, 2, 4, 7, 11],
  m9: [0, 2, 3, 7, 10],
};

export interface Chord {
  name: string;
  root: number;
  bass: number;
  /** Pitch classes in stacking order, root first. */
  pcs: number[];
}

const chordCache = new Map<string, Chord>();

export function chord(name: string): Chord {
  const hit = chordCache.get(name);
  if (hit) return hit;
  const m = /^([A-G](?:#|b)?)([a-z0-9]*)(?:\/([A-G](?:#|b)?))?$/.exec(name);
  if (!m || !(m[2] in QUALITIES)) throw new Error(`bad chord ${name}`);
  const root = pitchClass(m[1]);
  const pcs = QUALITIES[m[2]].map((i) => pc(root + i));
  const c: Chord = { name, root, bass: m[3] ? pitchClass(m[3]) : root, pcs };
  chordCache.set(name, c);
  return c;
}

/** Lowest midi note with pitch class `p` at or above `lo`. */
export function atOrAbove(p: number, lo: number): number {
  return lo + pc(p - lo);
}

/**
 * Close-position voicing of `count` notes inside [lo, hi], led smoothly from `prev`.
 */
export function voice(c: Chord, lo: number, hi: number, count: number, prev?: readonly number[]): number[] {
  const order = [...c.pcs].sort((a, b) => pc(a - c.root) - pc(b - c.root));
  let best: number[] | null = null;
  let bestScore = Infinity;
  const target = prev && prev.length ? prev : null;
  for (let start = 0; start < order.length; start++) {
    for (let base = atOrAbove(order[start], lo); base <= hi; base += 12) {
      const notes = [base];
      for (let i = 1; i < count; i++) {
        const p = order[(start + i) % order.length];
        notes.push(atOrAbove(p, notes[i - 1] + 1));
      }
      if (notes[notes.length - 1] > hi) continue;
      let score = 0;
      if (target) {
        for (let i = 0; i < notes.length; i++) score += Math.abs(notes[i] - target[Math.min(i, target.length - 1)]);
      } else {
        score = Math.abs((notes[0] + notes[notes.length - 1]) / 2 - (lo + hi) / 2);
      }
      if (score < bestScore) {
        bestScore = score;
        best = notes;
      }
    }
  }
  if (!best) {
    const notes = [atOrAbove(c.pcs[0], lo)];
    for (let i = 1; i < count; i++) notes.push(atOrAbove(c.pcs[i % c.pcs.length], notes[i - 1] + 1));
    return notes;
  }
  return best;
}

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}
