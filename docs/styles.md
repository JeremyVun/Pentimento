# Look and sound

## The painting

- **Gouache, not oil.** Flat, opaque, matte colour. Brush marks show as slight shifts in value and ragged dry-brush edges, not glossy impasto. Keep stroke hue jitter small; the painting reads as mixed on a palette, not as confetti.
- **Naive and designed.** Simple shapes with clear silhouettes: cumulus clouds as flat lobes with a cool shadow underneath, trees as clusters of round masses, houses as blocks with one lit and one shaded face. Figures are small and simple, but their poses must read at a glance (a wave is an arm well clear of the head).
- **Light is palette, not rendering.** Each chapter has a hand-picked palette in `src/scene/config.ts`. There are no lighting passes; the time of day lives in the colours.
- **Paper and tape.** Warm cold-press paper (`PAPER_RGB`), masking tape round the edge, and paint that can run over the tape in the current sitting.
- **Wet then dry.** Fresh paint is darker, more saturated, with a faint sheen, and dries matte within a couple of seconds. Keep the sheen subtle; a sparkle means it's too strong.
- **Pencil first.** Each new year appears as a thin graphite underdrawing over the old paint, light where the paint is dark.
- **The present moves, the past is still.** Only the current sitting's paint animates (flowing strokes, water, weather, people). Dried years never move.

## How strokes behave

The flow map (`src/scene/flow.ts`) sets stroke direction and drift per region:

| Region | Strokes |
|---|---|
| Sky | Long and horizontal, drifting with the wind |
| River | Horizontal ripples that drift towards the viewer |
| Lawn | Upright, like grass |
| Everything else | Follow the edges of shapes |

Three stroke layers run: broad everywhere, then finer ones only where the scene has edges.

## Words on screen

- EB Garamond. Gran's narration is italic; the grandchild's is upright. The same goes for the year cards.
- Narration sits below the board on the dark ground, one line at a time, inked in word by word.
- UI is quiet: thin-bordered text buttons, bottom right. Every string follows the `user-facing-copy` skill.

## Sound

See `docs/contracts/audio.md`. The short version: warm, intimate, slightly lo-fi. A small room with a real piano, a music box for childhood, and the river under everything. The brush is an instrument that always stays in key.
