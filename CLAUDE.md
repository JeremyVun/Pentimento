# Pentimento

A gouache narrative painting game (Vite + TypeScript, WebGL2, Web Audio, no art or audio files).

Read `docs/project.md` first: it holds Jeremy's brief verbatim, the vision and the chapter plan. Look and sound: `docs/styles.md`. Audio interface: `docs/contracts/audio.md`.

Commands: `npm run dev` (127.0.0.1:5317), `npm run typecheck`, `npm run build`, `npm run preview` (5318).

Layout: `src/story.ts` holds every chapter's words and timing. `src/scene/` draws the living view with Canvas2D. `src/gl/` turns it into paint and composites the layers. `src/audio/` is the music engine; `audio.html` is its bench. Tools live in `tools/`; keep captures in `/tmp`.

Narration and UI text follow the `user-facing-copy` skill.
