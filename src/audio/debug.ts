export interface EngineStats {
  state: string;
  time: number;
  voices: number;
  peakVoices: number;
  stolen: number;
  players: number;
  score: string | null;
}

/** Live-engine counters for tools (the soak test in tools/render-audio.mjs); not part of the game API. */
export const engineStats = new WeakMap<object, () => EngineStats>();
