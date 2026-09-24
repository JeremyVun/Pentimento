import '@fontsource/eb-garamond/latin-400.css';
import '@fontsource/eb-garamond/latin-400-italic.css';
import '@fontsource/eb-garamond/latin-500.css';
import './style.css';
import { createAudioEngine } from './audio';
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
  view.board.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    view.fatal(UI.contextLost);
  });
  const audio = createAudioEngine();
  view.onMute = (m) => audio.setMuted(m);
  const brush = new Brush(view.board);
  const narration = new Narration(view.narrationRoot);
  const game = new Game(painter, audio, brush, narration, view);
  (window as unknown as { __game: Game }).__game = game;

  const speed = Number(params.get('speed') || 1);
  let last = performance.now();
  let frames = 0;
  const loop = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000) * ((window as unknown as { __speed?: number }).__speed ?? speed);
    game.update(dt);
    game.render(now / 1000, (now - last) / 1000);
    last = now;
    frames++;
    (window as unknown as { __frames: number }).__frames = frames;
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

if (params.has('view')) runViewer(params);
else start();
