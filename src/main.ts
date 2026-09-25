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
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason instanceof Error && !(e.reason instanceof DOMException)) stop(UI.crashed);
  });
  view.onMute = (m) => audio.setMuted(m);
  const brush = new Brush(view.board);
  const narration = new Narration(view.narrationRoot);
  const game = new Game(painter, audio, brush, narration, view);
  Object.assign(window as object, { __game: game, __audioStats: () => engineStats.get(audio)?.() });

  const asked = Number(params.get('speed') || 1);
  const speed = Number.isFinite(asked) && asked > 0 ? asked : 1;
  let last = performance.now();
  let frames = 0;
  const loop = (now: number) => {
    if (stopped) return;
    const dt = Math.max(0, Math.min(0.1, (now - last) / 1000)) * ((window as unknown as { __speed?: number }).__speed ?? speed);
    try {
      game.update(dt);
      game.render(now / 1000, (now - last) / 1000);
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
