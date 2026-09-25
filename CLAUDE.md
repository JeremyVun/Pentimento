# Pentimento

A gouache narrative painting game (Vite + TypeScript, WebGL2, Web Audio, no art or audio files).

Read `docs/project.md` first: it holds Jeremy's brief verbatim, the vision and the chapter plan.
`docs/explore.md` holds Jeremy's feedback on pacing and interaction, verbatim, and what each prototype taught. Look and sound: `docs/styles.md`. Audio interface: `docs/contracts/audio.md`.

Commands: `npm run dev` (127.0.0.1:5317), `npm run typecheck`, `npm run build`, `npm run preview` (5318). QA: `?speed=8` runs the game fast; `?view=<scene>` shows one scene fully painted; `?quality=<tier>` pins a quality tier (`src/quality.ts`; the game otherwise picks one itself, logging each change at debug level, and `__game.debug.quality` shows it). Capture tools are indexed in `tools/README.md`; keep captures in `/tmp`. Always run browsers headless: headless Chrome here gets the real Metal GPU and GPU timer queries, and headed windows interrupt Jeremy.

Deploy: `tools/deploy.sh` builds and uploads `dist/` as static assets of the Cloudflare Worker `pentimento` (`wrangler.jsonc`). It needs `CLOUDFLARE_API_TOKEN` with Workers Scripts Edit permission, a clean tree and the `main` branch; every deploy goes to production.

Layout: `src/story.ts` holds every chapter's words, timings and memory regions. `src/game.ts` runs the chapter flow. `src/scene/` draws the living view with Canvas2D (`config.ts` palettes and per-chapter state, `draw.ts` landscape, `actors.ts` people, birds, weather, `flow.ts` stroke behaviour). `src/gl/` turns it into paint and composites the dried years. `src/audio/` is the music engine; `audio.html` is its bench.

Narration and UI text follow the `user-facing-copy` skill.
