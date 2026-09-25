import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-500.css';
import './style.css';
import { createAudioEngine } from './audio';
import { engineStats } from './audio/debug';
import { Brush } from './brush';
import { Game } from './game';
import { Painter } from './gl/painter';
import { Narration } from './narration';
import { GpuClock, Governor, TIERS, tierNamed } from './quality';
import { UI } from './story';
import { View } from './view-dom';
import { runViewer } from './view';

const params = new URLSearchParams(location.search);

function start(): void {
  const view = new View(document.body);
  const css = view.boardCss;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(960, Math.min(1800, Math.round(css.w * dpr)));
  let painter: Painter;
  try {
    painter = new Painter(view.board, width);
  } catch (e) {
    console.error(e);
    view.fatal(UI.noWebgl);
    return;
  }
  const forced = tierNamed(params.get('quality'));
  if (forced > 0) painter.setLook(TIERS[forced].look);
  // ?quality pins a tier. The QA harnesses' own GPU timers would clash with ours, so they leave the clock to fences.
  const clock = forced < 0 ? new GpuClock(painter.gl, !params.has('perfmode')) : null;
  const governor = new Governor(Math.max(0, forced), clock, forced >= 0);
  const audio = createAudioEngine();
  let stopped = false;
  const stop = (message: string) => {
    if (stopped) return;
    stopped = true;
    view.onMute = null;
    audio.setMuted(true);
    view.fatal(message, true);
  };
  view.board.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    stop(UI.contextLost);
  });
  window.addEventListener('error', (e) => {
    if (e.filename?.startsWith(location.origin)) stop(UI.crashed);
  });
  // Make the instrument buffers while the title shows, so Begin doesn't have to synthesise the first ones on the spot.
  setTimeout(() => audio.warm(), 1500);
  view.onMute = (m) => audio.setMuted(m);
  const brush = new Brush(view.board);
  const narration = new Narration(view.narrationRoot);
  const game = new Game(painter, audio, brush, narration, view, governor, Math.max(0, forced));
  Object.assign(window as object, { __game: game, __audioStats: () => engineStats.get(audio)?.() });

  const asked = Number(params.get('speed') || 1);
  const speed = Number.isFinite(asked) && asked > 0 ? asked : 1;
  let last = performance.now();
  let frames = 0;
  const loop = (now: number) => {
    if (stopped) return;
    if (!governor.frame(now)) {
      requestAnimationFrame(loop);
      return;
    }
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)) * ((window as unknown as { __speed?: number }).__speed ?? speed);
    try {
      const t0 = performance.now();
      clock?.begin();
      game.update(dt);
      game.render(now / 1000);
      clock?.end(game.heavy);
      governor.drawn(now, performance.now() - t0, game.heavy);
    } catch (e) {
      console.error(e);
      stop(UI.crashed);
      return;
    }
    last = now;
    frames++;
    (window as unknown as { __frames: number }).__frames = frames;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

if (params.has('view')) runViewer(params);
else start();
