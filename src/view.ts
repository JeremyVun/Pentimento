import { Painter, DEFAULT_LAYERS } from './gl/painter';
import { SCENES } from './scene/config';
import { drawScene } from './scene/draw';
import { drawFlow } from './scene/flow';

/** QA viewer: ?view=<scene>&t=<seconds>&mask=full|none|half&sketch=1&freeze=1 */
export function runViewer(params: URLSearchParams): void {
  const id = params.get('view') || 'nine';
  const cfg = SCENES[id];
  const board = document.createElement('canvas');
  board.className = 'board';
  document.body.appendChild(board);
  const width = Number(params.get('w') || 1600);
  const painter = new Painter(board, width);
  const sceneScale = 0.62;
  const sc = document.createElement('canvas');
  sc.width = Math.round(painter.w * sceneScale);
  sc.height = Math.round(painter.h * sceneScale);
  const sctx = sc.getContext('2d')!;
  const fc = document.createElement('canvas');
  fc.width = 256;
  fc.height = 160;
  drawFlow(fc.getContext('2d')!, 160, cfg);
  painter.uploadFlow(fc);
  const sk = document.createElement('canvas');
  sk.width = sc.width;
  sk.height = sc.height;
  drawScene(sk.getContext('2d')!, sk.height, { cfg, t: 0, sketch: true, woke: {} });
  painter.uploadSketch(sk);
  const mask = params.get('mask') || 'full';
  if (mask === 'full') painter.fillMask();
  const t0 = Number(params.get('t') || 10);
  const freeze = params.get('freeze') === '1';
  const sketch = Number(params.get('sketch') || (mask === 'none' ? 1 : 0));
  const woke: Record<string, number> = {};
  for (const w of (params.get('woke') || '').split(',').filter(Boolean)) woke[w] = 1.5;
  const start = performance.now();
  const layout = () => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const s = Math.min(vw * 0.96 / painter.w, vh * 0.96 / painter.h);
    board.style.width = `${painter.w * s}px`;
    board.style.height = `${painter.h * s}px`;
  };
  layout();
  window.addEventListener('resize', layout);
  const frame = () => {
    const t = freeze ? t0 : t0 + (performance.now() - start) / 1000;
    drawScene(sctx, sc.height, { cfg, t, sketch: false, woke: Object.fromEntries(Object.entries(woke).map(([k, v]) => [k, v + t - t0])) });
    painter.uploadScene(sc, !!cfg.blur);
    painter.renderLiving({ time: t, warp: 1, blur: cfg.blur ?? 0, strokeScale: cfg.blur ? 1.6 : 1, angle: 0, follow: 1, layers: DEFAULT_LAYERS });
    painter.present({ time: t, sketch, wash: 0, living: mask === 'none' ? 0 : 1, dryFade: 0, liftMode: false, layers: 1 });
    (window as unknown as { __frames: number }).__frames = ((window as unknown as { __frames: number }).__frames || 0) + 1;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  if (params.get('flat') === '1') {
    sc.style.cssText = 'position:fixed;left:0;top:0;width:50vw;border:1px solid red';
    document.body.appendChild(sc);
  }
}
