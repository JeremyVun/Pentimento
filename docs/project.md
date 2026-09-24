# Pentimento

## The brief (Jeremy, verbatim)

> Create an artistic, narrative game in gauche stylistic. The game should feel like a moving, animated painting with flowing colours and music that explores life and any concept you want it to. Make the game you've always wanted to make.

"Gauche" here means gouache: opaque, matte watercolour.

## What it is

A woman paints the view from her bedroom window across one life, from age nine to eighty-six. She only ever owned one board, so each painting goes on top of the last one. You are her hand. Each chapter is one sitting. The view has changed since the last painting: a bridge gets built, a fig tree grows, people arrive and leave. You paint the new view over the old painting while her letter to her grandchild tells you what that year was.

A pentimento is an earlier painting that shows through the paint on top of it. That is the idea the game explores: a life is layered. What you attend to becomes the picture. What you leave alone keeps showing through from the years underneath. Nothing is fully painted over.

## How it plays

- The board starts blank. A pencil sketch shows the new view over the old paint.
- Hold the mouse button, or touch, to paint. Wherever you paint, the new year comes alive: water flows, clouds drift, people move. Where you don't paint, the old years stay, dry and still.
- Each sitting lasts as long as its music, roughly a minute and a half. The busy year with a newborn is shorter. Then the paint dries and the next year begins on top of it.
- Some things in the view carry a memory. Paint enough of one and it wakes up (the ferryman waves, the swallows swoop) and the narrator tells you about it. Things you don't paint keep their memories.
- The last sitting belongs to the grandchild, twenty years later. Afterwards you can hold the brush down to lift the paint and see every year underneath. You can save the finished board as an image.

## Chapters

The final wording lives in `src/story.ts`.

| Card | Season, light | What changed in the view | The year |
|---|---|---|---|
| Nine | Summer morning | Ferry, no bridge, fig tree is a stick | A tin of twelve paints |
| Sixteen | Autumn afternoon | Bridge being built, scaffolding | Wants to leave town |
| Twenty-three | Spring after rain | Bridge finished, a man in a yellow coat crosses at eight | Meets Joe |
| Thirty-one | High summer noon (short sitting) | Washing line, figs, swimmers | June is born |
| Forty-four | Winter night, flood | River up to the garden wall, lanterns on the bridge | Her father dies |
| Forty-nine | Autumn morning mist | The eight o'clock bus crosses the bridge | June leaves |
| Seventy-two | Winter dawn, snow | Empty bridge, snow on Joe's bench, a robin | Joe dies |
| Eighty-six | Spring afternoon, painted blurred | The window frame, tulips, a child under the fig tree | Her eyes fail; the board goes to her grandchild |
| Twenty years later | Summer morning | The fig tree is enormous | The grandchild paints |

A church bell strikes eight three times in the game: when Joe first crosses the bridge, when June leaves, and in the first winter without Joe.

## Principles

- It must look painted, never rendered: flat opaque colour, visible brush marks, paper grain, wobbling hand-made edges.
- The present moves and the past is still. That contrast is the game.
- Narration follows the `user-facing-copy` skill: plain, spoken, one idea at a time, no epigrams.
- There are no scores, failure or menus beyond what's needed. The painting you end with is yours.

## Build plan

1. Scaffold (Vite + TypeScript, WebGL2, Web Audio, no external art or audio files).
2. Scene: a Canvas2D renderer draws the living view per chapter as flat shapes.
3. Paint: WebGL turns the scene into gouache (flowing brush strokes, bristle texture, paper, wet-to-matte drying), and composites your painting over the dried layers.
4. Story: chapter flow, narration, memories, pencil sketch, title cards.
5. Music: a generative score per chapter, a recurring motif, and a musical brush (built by a subagent against `docs/contracts/audio.md`).
6. Ending: lifting layers, saving the board, starting again.
7. Visual QA with screenshots through every chapter, then polish.
