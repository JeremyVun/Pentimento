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

// Silent placeholder until the real engine lands (see docs/contracts/audio.md).
export function createAudioEngine(): AudioEngine {
  let muted = false;
  return {
    async unlock() {},
    play() {},
    endChapter() {},
    brush() {},
    brushUp() {},
    wake() {},
    duck() {},
    setMuted(m: boolean) { muted = m; },
    get muted() { return muted; },
    liftLayer() {},
  };
}
