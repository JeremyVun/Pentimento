# Pentimento

## The brief (Jeremy, verbatim)

> Create an artistic, narrative game in gauche stylistic. The game should feel like a moving, animated painting with flowing colours and music that explores life and any concept you want it to. Make the game you've always wanted to make.

"Gauche" here means gouache: opaque, matte watercolour.

## What it is

A woman paints the view from her bedroom window across one life, from age nine to eighty-six. She only ever owned one board, so each painting goes on top of the last one. You are her hand. Each chapter is one sitting. The view has changed since the last painting: a bridge gets built, a fig tree grows, people arrive and leave. You paint the new view over the old painting while her letter to her grandchild tells you what that year was.

A pentimento is an earlier painting that shows through the paint on top of it. That is the idea the game explores: a life is layered. What you attend to becomes the picture. What you leave alone keeps showing through from the years underneath. Nothing is fully painted over.

## How it plays

Each sitting has three parts, so the player never reads and paints at once (Jeremy, 2026-09-25: reading text under the board while watching the painting split his attention).

- **Before.** The age card and one or two of her lines are inked onto the faded board. Then the pencil sketch draws itself over the old paint.
- **Painting, in silence.** Click, or tap, to pour paint. It flows out from the cursor and fills the shape you clicked (the sky, the river, the fig tree, the garden) and stops at its edges. Holding pours more; dragging leaves a trail of pours. Wet paint moves with the view: water flows, clouds drift, people move. As it dries it goes still, keeping the moment it dried in. Pour again to wet it. Where you don't pour, the old years stay.
- **Something passes once.** The moving people, boats and birds show in pencil, with reds and yellows in colour. Each sitting has one or two moments that pass through the view once: the ferry, Joe crossing at eight, June's bus. Pour on one while it's there and it's caught: it reacts, and the paint sets around it so the painting keeps it. Missed, it's gone.
- **After.** The painting dries and she talks you through it, in the order you painted things. Each note sits beside the thing it's about, which stays lit while the rest dims. Things you didn't paint keep their memories. Click to move on.
- Each sitting lasts as long as its music, roughly a minute and a half. The newborn year is the one sitting with limited paint.
- The last sitting belongs to the grandchild, twenty years later. Afterwards you can hold the brush down to lift the paint and see every year underneath. You can save the finished board as an image.
- Pouring replaced dragging a brush after Jeremy found brushing the whole board by hand tiring. Limited paint everywhere was rejected: it may suit one sitting, not all. How the prototypes got here is in `docs/explore.md`.

## Chapters

The final wording lives in `src/story.ts`.

| Card | Season, light | What changed in the view | The year | What passes |
|---|---|---|---|---|
| Nine | Summer morning | Ferry, no bridge, fig tree is a stick | A tin of twelve paints | The ferry crosses |
| Sixteen | Autumn afternoon | Bridge being built, scaffolding | Wants to leave town | The afternoon train to the city leaves along the far hills |
| Twenty-three | Spring after rain | Bridge finished | Meets Joe | A man in a yellow coat crosses at eight |
| Thirty-one | High summer noon (short, limited paint) | Washing line, figs, swimmers | June is born | Children jump off the bridge |
| Forty-four | Winter night, flood | River up to the garden wall, lanterns on the bridge | Her father dies | Her father under the fig tree, in pencil only: painting him shows he isn't there |
| Forty-nine | Autumn morning mist | Mist | June leaves | The eight o'clock bus, June's red coat in the back window |
| Seventy-two | Winter dawn, snow | Empty bridge, snow on Joe's bench | Joe dies | Pencil Joe crosses at eight and the paint shows an empty bridge; then a robin |
| Eighty-six | Spring afternoon, painted blurred, no pencil | The window frame, tulips | Her eyes fail; the board goes to her grandchild | The grandchild playing, a blur of yellow |
| Twenty years later | Summer morning | The fig tree is enormous | The grandchild paints | The afternoon train arrives, bringing the grandchild home; children jump |

She wanted to leave and never did: every painting is the same view. Things pass through it and leave (the ferry, the train, Joe each morning, June's bus), and painting is how she keeps them. Her daughter and granddaughter do what she couldn't.

A church bell strikes eight three times in the game: when Joe first crosses the bridge, when June leaves, and in the first winter without Joe.

## Principles

- It must look painted, never rendered: flat opaque colour, visible brush marks, paper grain, wobbling hand-made edges.
- The present moves and the past is still. That contrast is the game.
- Reading and painting never happen at once. Words come before and after the sitting, on the board.
- Narration follows the `user-facing-copy` skill: plain, spoken, one idea at a time, no epigrams.
- There are no scores, failure or menus beyond what's needed. The painting you end with is yours.

## Build plan

1. Scaffold (Vite + TypeScript, WebGL2, Web Audio, no external art or audio files).
2. Scene: a Canvas2D renderer draws the living view per chapter as flat shapes.
3. Paint: WebGL turns the scene into gouache (flowing brush strokes, bristle texture, paper, wet-to-matte drying), and composites your painting over the dried layers. Poured paint spreads on the GPU through a region map drawn from the scene itself (`src/scene/regions.ts`).
4. Story: chapter flow, narration, memories, pencil sketch, title cards. Then moments and reflections (`docs/explore.md`).
5. Music: a generative score per chapter, a recurring motif, and a musical brush (built by a subagent against `docs/contracts/audio.md`).
6. Ending: lifting layers, saving the board, starting again.
7. Visual QA with screenshots through every chapter, then polish.
