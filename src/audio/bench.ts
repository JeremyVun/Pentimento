import { createAudioEngine, type ScoreId } from './index';
import { compose, SCORE_IDS } from './scores';

const engine = createAudioEngine();
const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = $<HTMLPreElement>('status');
const durInput = $<HTMLInputElement>('dur');
let playing: { id: ScoreId; at: number; end: number } | null = null;

for (const id of SCORE_IDS) {
  const b = document.createElement('button');
  b.textContent = id;
  b.onclick = async () => {
    await engine.unlock();
    const dur = Number(durInput.value) || undefined;
    engine.play(id, dur);
    const c = compose(id, dur);
    playing = { id, at: performance.now(), end: c.loop ? 0 : c.end };
  };
  $('scores').append(b, ' ');
}

$('end').onclick = () => engine.endChapter();
$('wake').onclick = async () => {
  await engine.unlock();
  engine.wake(0.5);
};
$<HTMLInputElement>('duck').onchange = (e) => engine.duck((e.target as HTMLInputElement).checked);
$<HTMLInputElement>('mute').onchange = (e) => engine.setMuted((e.target as HTMLInputElement).checked);

const layer = $<HTMLSelectElement>('layer');
layer.append(new Option('lift (its own)', ''));
for (const id of SCORE_IDS) if (id !== 'lift') layer.append(new Option(id, id));
layer.onchange = () => engine.liftLayer((layer.value || null) as ScoreId | null);

const pad = $<HTMLDivElement>('pad');
let down = false;
let pos = { x: 0.5, y: 0.5 };
let last = { x: 0.5, y: 0.5, t: 0 };
let speed = 0;

function point(e: PointerEvent): { x: number; y: number } {
  const r = pad.getBoundingClientRect();
  return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
}

pad.onpointerdown = async (e) => {
  pad.setPointerCapture(e.pointerId);
  await engine.unlock();
  down = true;
  pos = point(e);
  last = { ...pos, t: performance.now() };
  speed = 0;
  requestAnimationFrame(frame);
};
pad.onpointermove = (e) => {
  if (down) pos = point(e);
};
pad.onpointerup = pad.onpointercancel = () => {
  down = false;
  engine.brushUp();
};

function frame(now: number): void {
  if (!down) return;
  const dt = Math.max(0.001, (now - last.t) / 1000);
  const instant = Math.hypot(pos.x - last.x, (pos.y - last.y) * (pad.clientHeight / pad.clientWidth)) / dt;
  speed = speed * 0.6 + instant * 0.4;
  last = { ...pos, t: now };
  engine.brush(pos.x, pos.y, speed);
  requestAnimationFrame(frame);
}

setInterval(() => {
  if (!playing) return;
  const t = (performance.now() - playing.at) / 1000;
  const cadence = playing.end ? `, final cadence at ${playing.end.toFixed(1)} s` : ', loops';
  status.textContent = `${playing.id}: ${t.toFixed(1)} s${cadence}${engine.muted ? ' (muted)' : ''}${down ? `, brush speed ${speed.toFixed(2)}` : ''}`;
}, 200);
