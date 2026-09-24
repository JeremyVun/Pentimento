# Tools

All need the dev server (`npm run dev`, 127.0.0.1:5317) and write captures to a `/tmp` dir you pass in.

- `shot.mjs <outdir> <query>...`: screenshots the board for viewer queries such as `view=fortyfour&t=20&woke=lanterns`. The viewer (`?view=<scene>`) shows one scene fully painted. Other params: `t` (scene seconds), `freeze=1`, `mask=none` (pencil sketch only), `woke=a,b` (subjects already awake).
- `play.mjs <outdir> [--speed 6] [--chapters 9] [--coverage 0.6] [--lift]`: plays the real game with real mouse strokes and captures every phase, then optionally tests lifting at normal speed.
- `render-audio.mjs`: renders every score offline and reports levels (see its header).
