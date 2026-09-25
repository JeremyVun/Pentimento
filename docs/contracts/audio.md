# Audio contract

`src/audio/` owns all sound. Everything is synthesised with Web Audio at runtime. There are no audio files.

## Interface

`src/audio/index.ts` exports:

```ts
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
  bell(): void;
}

export function createAudioEngine(): AudioEngine;
```

Semantics:

- `unlock()` is called inside the first user gesture. It creates or resumes the AudioContext. It is idempotent and safe to call on every gesture.
- `play(id, durationSec)` crossfades (about 3 s) from whatever is playing into score `id`. For chapter scores, `durationSec` is the painting time. The score reaches its final cadence at `durationSec`, then holds a soft tail until `endChapter()` or the next `play()`. `title` and `lift` loop indefinitely and ignore `durationSec`. Calling `play` with the id already playing does nothing.
- `endChapter()` means painting has finished, possibly early. The cadence plays within the next bar and rings for about 6 s. The ambience bed stays on quietly until the next `play()`.
- `brush(x, y, speed)` is called every animation frame while the brush is down. `x` and `y` are 0..1 painting coordinates with y down. `speed` is painting-widths per second, usually 0..3. The engine owns rate limiting and quantising. `brushUp()` is called once when the brush lifts.
- `wake(x)` means a thing in the view woke up because the player painted it. It plays a small flourish in key, panned by `x`.
- `duck(on)` is true while a narration line is on screen. Music drops about 3 dB. Ambience does not.
- `setMuted` fades the master in or out over about 0.3 s. `muted` reads it back.
- `bell()` strikes the church bell eight times, three beats apart, starting on the current score's next beat.
- `liftLayer(id)` is used only in the lift ending. Brush notes switch to that chapter's scale and timbre. `null` returns to the lift score's own.

Offline rendering: `src/audio/offline.ts` exports `renderOffline(id: ScoreId, durationSec: number, sampleRate?: number, opts?: RenderOptions): Promise<AudioBuffer>`. It renders a score into an `OfflineAudioContext` with the same code the live engine uses. `durationSec` is the length of audio to render; a chapter is fitted to its length in the table below unless `opts.chapterSec` says otherwise, so `renderOffline('nine', 88)` gives the 80 s chapter and 8 s of its tail.

`RenderOptions` (all optional, added for tools and tests): `chapterSec` fits the chapter to another painting time; `brush` paints a scripted stroke over the whole render; `endAt` calls `endChapter()` at that second; `stems` returns four channels (the mix, then the music bus on its own); `solo` silences everything but `'music'`, `'amb'` or `'bristle'`; `onBrushNote` and `onVoices` report brush notes and voice counts.

Two small behaviours the table does not pin down: `play()` with the id of a chapter that has already ended starts it again, and calls made before `unlock()` are remembered (the last `play`, `duck` and `setMuted`) and applied once it runs.

## Invariants

- Master peak stays at or below -1 dBFS, through a compressor and limiter.
- The engine caps simultaneous voices and steals the oldest voice when the cap is reached.
- Scores are scheduled by a pure `schedule(t0, t1)` style function. The live engine calls it from a lookahead timer. The offline renderer calls it once for the whole duration.
- The engine suspends the context when the page is hidden and resumes it when the page is shown again.
- Painting non-stop for 90 s must stay pleasant: at most about 4 brush notes a second, always in the current chord or scale.

## The music, chapter by chapter

One recurring motif, called the window theme, runs through the whole game. It is short (6 or 7 notes) and singable. It is first heard on a music box in `nine`. Each chapter re-harmonises and re-voices it.

The river is in every scene, so a soft water bed plays under every score, and its character changes with the chapter.

A distant church bell strikes eight in `twentythree`, `fortynine` and `seventytwo`. Those are the mornings Joe first crosses the bridge, June leaves on the eight o'clock bus, and the first winter without Joe. The game rings it with `bell()` at the moment it chooses, so the scores don't contain it.

| Score | Length | Scene | Music |
|---|---|---|---|
| title | loop | Late summer evening | Warm and slow. Felt piano, soft pad, river, a few birds. |
| nine | 80 s | Summer morning, age nine | Music box or celesta carries the motif. Simple major key, about 92 bpm, light plucks, birdsong. Childlike. |
| sixteen | 80 s | Autumn afternoon, restless teenager | Minor or Dorian, about 100 bpm, an eighth-note ostinato. Distant hammer taps from the bridge works, on the beat. Wind. |
| twentythree | 85 s | Spring morning after rain, falling in love | Major or Lydian, about 84 bpm, felt piano lead, warm pad. Light rain that eases halfway. Bell strikes eight near the start. Hopeful, rising. |
| thirtyone | 50 s | High summer noon, newborn, busy | Major, about 116 bpm, bright and bouncy, marimba or kalimba. Full and short. |
| fortyfour | 80 s | Winter night, flood, her father has died | Minor, about 60 bpm, low piano and a sustained low pad. Heavy rain, distant thunder, a loud river. Sparse. The motif is broken. |
| fortynine | 80 s | Autumn morning mist, daughter leaves | Major with a flattened seventh, about 76 bpm. Nostalgic piano and a soft horn-like pad. Wind. Bell strikes eight near the start. |
| seventytwo | 95 s | Winter dawn, snow, her husband has died | Minor turning to major at the very end, about 54 bpm. Sparse solo piano with long silences. Snow hush, muffled river under ice, bell strikes eight near the start, an occasional robin. |
| eightysix | 85 s | Spring afternoon, her eyes are failing | Warm major, about 68 bpm. Washy pads, heavy reverb, soft-attack piano. The motif plays slowly and leaves its last note out until the final cadence. |
| later | 85 s | Summer morning, twenty years on, the grandchild paints | Echoes `nine`. Music box states the motif and piano answers it. Swallows and birdsong. Ends bright. |
| lift | loop | The ending: lifting paint to see the years | Ambient and gentle, built from fragments of the motif. Brush notes follow `liftLayer`. |

The brush is an instrument. While painting there is a very quiet bristle-on-paper noise that follows speed. Notes fall on the score's eighth-note grid, with pitch from height (top is high), pan from x and velocity from speed. Each score has its own brush timbre.

## Implementation

Everything lives in `src/audio/`:

- `index.ts`: the engine. A 25 ms timer schedules 130 ms ahead. `play()` crossfades players over 3 s. The page's `visibilitychange` suspends and resumes the context.
- `compose.ts`: event types, the pure `schedule(comp, t0, t1)`, and the `Writer` the scores are written with. A chapter is built from sections. `build()` drops or repeats sections, then sets the tempo (within about 10% of the table) so the final cadence lands exactly at `durationSec`.
- `scores/*.ts`: one composed score per `ScoreId`.
- `player.ts`: plays one composition, handles `endChapter()` and fades. `synth.ts`: the master chain, reverb, voices, voice cap and ambience beds. `tones.ts`: every instrument, bird and noise loop is synthesised into buffers. `tones.worker.ts` and `warm.ts` build those buffers in a worker before they are needed. `brush.ts`: the brush instrument. `offline.ts`: `renderOffline`. `analysis.ts`: checks used by the tools. `debug.ts`: live counters for the soak test, not part of the game API.
- The bench is `audio.html` (`src/audio/bench.ts`). It has a button per score, End chapter, Wake, Duck, Mute, a lift layer menu and a pad to paint on.
- `tools/render-audio.mjs` renders every score in headless Chromium. It writes WAVs and prints peak, RMS, near-silent gaps, motif statements, off-key and off-grid counts and brush stats. `--soak 15` runs the live engine for 15 minutes instead and prints voice and node counts once a minute.

The window theme, as scale degrees: 5 (below the tonic), 3, 2, 1, 6 (below), 7 (below), 1. In C that is G4 E5 D5 C5 A4 B4 C5. The rhythm is 1, 1½, ½, 1, 1, 1, 2 beats. It opens with a rising sixth, falls by step to the tonic, dips to the sixth below and climbs back through the leading note. The `motif()` writer keeps its shape in every key and mode: minor and Dorian give E C B A F G A, and Mixolydian flattens the seventh. `analysis.ts` checks every statement's contour.

Mixing: voices feed dry and wet music buses. Each has a slow tape wobble (a modulated delay), a 3 dB duck and a gentle low-pass. They go into a generated 4.2 s stereo room reverb and then the master: a 32 Hz high-pass, a compressor at -18 dB (2:1), a limiter at -4 dB (20:1) and a soft clipper whose ceiling is -1.04 dBFS. The compressors' automatic makeup gain is cancelled so the thresholds mean what they say. At most 56 voices sound at once; the oldest is faded out over 50 ms. Every voice disconnects its nodes when its sources end.
