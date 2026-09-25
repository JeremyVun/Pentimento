# Look and sound

## The painting

- **Gouache, not oil.** Flat, opaque, matte colour. Brush marks show as slight shifts in value and ragged dry-brush edges, not glossy impasto. Stroke colour varies only as much as her hand that year allows (below); even her most broken colour reads as mixed on a palette, not as confetti.
- **Naive and designed.** Simple shapes with clear silhouettes: cumulus clouds as flat lobes with a cool shadow underneath, trees as clusters of round masses, houses as blocks with one lit and one shaded face. Figures are small and simple, but their poses must read at a glance (a wave is an arm well clear of the head).
- **Light is palette, not rendering.** Each chapter has a hand-picked palette in `src/scene/config.ts`. There are no lighting passes; the time of day lives in the colours.
- **Paper and tape.** Warm cold-press paper (`PAPER_RGB`), masking tape round the edge, and paint that can run over the tape in the current sitting.
- **Wet then dry.** Fresh paint is darker, more saturated, with a faint sheen, and dries matte within a couple of seconds. Keep the sheen subtle; a sparkle means it's too strong.
- **Poured paint.** A pour takes about a second and a half to spread, with a ragged wet front, and stops at the edge of its shape, leaving a pixel or two of bleed. Regions come from the drawn scene itself, so a pour never leaves rectangular ghosts. Hairline details (twigs, fronds, ropes) belong to whatever is behind them.
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

## Her hand across the years

Each year is painted in her hand at that age (`hand` in `src/scene/config.ts`, settings in `src/hand.ts`), so the layers read as different paintings on one board. Only the look changes; pouring works the same way every year.

| Year | Her hand |
|---|---|
| Nine | A child's: big scrubbing strokes going every which way, small things simplified into blobs, bright unmixed colours from a tin of twelve, wobbly dark outlines |
| Sixteen | Bold and dramatic: saturated, high contrast, loose strokes, a trace of outline |
| Twenty-three | Finer and fresher; she's learning to look |
| Thirty-one | Rushed: big quick strokes, little detail |
| Forty-four | Muddy and muted, low contrast |
| Forty-nine | Practised: small strokes and broken colour mixed on the board |
| Seventy-two | Pale and loose, quiet colour |
| Eighty-six | Her eyes have gone: the view is blurred and the strokes are broad |
| Twenty years later | The grandchild's own hand: crisp, flat, clean colour |

## Words on screen

- EB Garamond. Gran's narration is italic; the grandchild's is upright. The same goes for the year cards.
- Narration is inked onto the board one line at a time, word by word, beside the thing it's about.
- UI is quiet: buttons are pale cream brushstrokes like the clouds (a dry-brush mask drawn at load) with dark text, bottom right; Begin is the larger one. Mute is a speaker icon. The title screen shows only the title and Begin. Every string follows the `user-facing-copy` skill.

## Sound

See `docs/contracts/audio.md`. The short version: warm, intimate, slightly lo-fi. A small room with a real piano, a music box for childhood, and the river under everything. The brush is an instrument that always stays in key.
