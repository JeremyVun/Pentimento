import { ASPECT } from './gl/painter';
import { TITLE, UI } from './story';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

/** A dry-brush stroke, used as a mask so buttons look like dabs of paint. */
function brushSwatch(): string {
  const w = 400;
  const h = 120;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  if (!g) return 'none';
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  g.lineCap = 'round';
  g.strokeStyle = '#000';
  const rows = 90;
  for (let i = 0; i < rows; i++) {
    const t = i / (rows - 1);
    const edge = Math.abs(t - 0.5) * 2;
    const y = 14 + t * (h - 28) + (rand() - 0.5) * 3;
    const x0 = 8 + rand() * 28 + edge ** 2 * 60 * rand();
    const x1 = w - 8 - rand() * 40 - edge ** 2 * 90 * rand();
    const streak = rand() < 0.12;
    g.globalAlpha = streak ? 0.3 + rand() * 0.2 : edge > 0.8 ? 0.45 + rand() * 0.5 : 0.75 + rand() * 0.25;
    g.lineWidth = 1.5 + rand() * 3;
    g.beginPath();
    g.moveTo(x0, y);
    g.quadraticCurveTo((x0 + x1) / 2, y - 7, x1, y + (rand() - 0.5) * 4);
    g.stroke();
  }
  return `url(${c.toDataURL()})`;
}

/** Hidden controls only fade out, so they also leave the tab order and give up focus. */
function hideControls(e: HTMLElement, hidden: boolean): void {
  if (e.inert === hidden) return;
  e.inert = hidden;
  if (hidden && e.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
}

const SPEAKER = '<path d="M3 9h4l5-4v14l-5-4H3z" fill="currentColor"/>';
const WAVES = '<path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
const CROSS = '<path d="M16 9.5l5 5M21 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>';
const EXPAND = '<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';
const SHRINK = '<path d="M9 4v5H4M20 9h-5V4M15 20v-5h5M4 15h5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>';

/** Everything on the page apart from the painting itself. */
export class View {
  readonly board: HTMLCanvasElement;
  readonly narrationRoot: HTMLElement;
  private title: HTMLElement;
  private notes: HTMLElement;
  private card: HTMLElement;
  private hint: HTMLElement;
  private cursor: HTMLElement;
  private liftLabel: HTMLElement;
  private finish: HTMLButtonElement;
  private mute: HTMLButtonElement;
  private fullscreen: HTMLButtonElement;
  private end: HTMLElement;
  private controls!: HTMLElement;
  private rect = { x: 0, y: 0, w: 0, h: 0 };
  onBegin: (() => void) | null = null;
  onFinish: (() => void) | null = null;
  onAgain: (() => void) | null = null;
  onSave: (() => void) | null = null;
  onMute: ((muted: boolean) => void) | null = null;
  onBoardPress: (() => void) | null = null;
  /** Any press or key, so audio that the browser paused can resume on a user gesture. */
  onPress: (() => void) | null = null;

  constructor(root: HTMLElement) {
    document.documentElement.style.setProperty('--swatch', brushSwatch());
    this.board = el('canvas', 'board', root);
    this.board.setAttribute('aria-label', 'The painting');
    this.board.setAttribute('role', 'img');
    this.board.addEventListener('pointerdown', () => this.onBoardPress?.());

    this.title = el('div', 'title', root);
    const plate = el('div', 'plate', this.title);
    el('h1', '', plate, TITLE);
    const begin = el('button', 'begin', plate, UI.begin);
    begin.addEventListener('click', () => this.onBegin?.());
    this.notes = el('div', 'notes', root);
    el('p', 'rotate', this.notes, UI.rotate);

    this.card = el('div', 'card', root);
    this.cursor = el('div', 'cursor', root);
    this.liftLabel = el('div', 'lift-label', root);
    this.narrationRoot = el('div', 'narration', root);
    this.narrationRoot.setAttribute('aria-live', 'polite');
    this.hint = el('div', 'hint', root);

    const controls = el('div', 'controls', root);
    this.controls = controls;
    this.finish = el('button', 'quiet finish', controls, UI.finish);
    this.finish.addEventListener('click', () => this.onFinish?.());
    this.mute = el('button', 'quiet icon', controls);
    this.showMuted();
    this.mute.addEventListener('click', () => this.toggleMute());
    this.fullscreen = el('button', 'quiet icon', controls);
    this.fullscreen.hidden = !document.fullscreenEnabled;
    this.showFullscreen();
    this.fullscreen.addEventListener('click', () => this.toggleFullscreen());
    document.addEventListener('fullscreenchange', () => this.showFullscreen());

    this.finish.inert = true;
    this.end = el('div', 'end', root);
    this.end.inert = true;
    const save = el('button', 'quiet', this.end, UI.save);
    save.addEventListener('click', () => this.onSave?.());
    const again = el('button', 'quiet', this.end, UI.again);
    again.addEventListener('click', () => this.onAgain?.());

    window.addEventListener('keydown', (e) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (e.key === 'm' || e.key === 'M') this.toggleMute();
      if (e.key === 'f' || e.key === 'F') this.toggleFullscreen();
    });
    for (const type of ['pointerdown', 'pointerup', 'keydown']) window.addEventListener(type, () => this.onPress?.(), true);
    window.addEventListener('resize', () => this.layout());
    this.layout();
  }

  private muted = false;
  private toggleMute(): void {
    this.muted = !this.muted;
    this.showMuted();
    this.onMute?.(this.muted);
  }

  private showMuted(): void {
    const label = this.muted ? UI.unmute : UI.mute;
    this.mute.setAttribute('aria-label', label);
    this.mute.title = `${label} (M)`;
    this.mute.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${SPEAKER}${this.muted ? CROSS : WAVES}</svg>`;
  }

  private toggleFullscreen(): void {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  }

  private showFullscreen(): void {
    const on = !!document.fullscreenElement;
    const label = on ? UI.exitFullscreen : UI.fullscreen;
    this.fullscreen.setAttribute('aria-label', label);
    this.fullscreen.title = `${label} (F)`;
    this.fullscreen.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${on ? SHRINK : EXPAND}</svg>`;
  }

  /** CSS size of the board, used to choose the painting resolution. */
  get boardCss(): { w: number; h: number } {
    return { w: this.rect.w, h: this.rect.h };
  }

  layout(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const margin = document.fullscreenElement ? 0 : 0.03;
    const h = Math.max(160, Math.min(vh * (1 - margin), (vw * (1 - margin)) / ASPECT));
    const w = h * ASPECT;
    const x = (vw - w) / 2;
    const y = (vh - h) / 2;
    this.rect = { x, y, w, h };
    Object.assign(this.board.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    for (const e of [this.title, this.card]) {
      Object.assign(e.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    }
    Object.assign(this.narrationRoot.style, { left: `${x}px`, width: `${w}px`, top: `${y}px`, height: `${h}px` });
    for (const e of [this.hint, this.notes]) {
      Object.assign(e.style, { left: `${x}px`, width: `${w}px`, top: `${y + h * 0.78}px`, height: `${h * 0.18}px` });
    }
    const inset = h * 0.045;
    for (const e of [this.controls, this.end]) {
      Object.assign(e.style, { bottom: `${vh - (y + h) + inset}px` });
    }
    this.controls.style.right = `${vw - (x + w) + inset}px`;
    document.documentElement.style.setProperty('--board-h', `${h}px`);
  }

  showTitle(on: boolean): void {
    this.title.classList.toggle('on', on);
    hideControls(this.title, !on);
    this.notes.classList.toggle('on', on);
  }

  showCard(text: string, voice: string): void {
    this.card.textContent = text;
    this.card.className = `card ${voice} on`;
  }

  hideCard(): void {
    this.card.classList.remove('on');
  }

  showHint(text: string, centred = false): void {
    this.hint.replaceChildren();
    el('span', '', this.hint, text);
    this.hint.classList.toggle('centred', centred);
    this.hint.classList.add('on');
  }

  hideHint(): void {
    this.hint.classList.remove('on');
  }

  showFinish(on: boolean): void {
    this.finish.classList.toggle('on', on);
    hideControls(this.finish, !on);
  }

  showEnd(on: boolean): void {
    this.end.classList.toggle('on', on);
    hideControls(this.end, !on);
  }

  setCursor(visible: boolean, u: number, v: number, radius: number, down: boolean): void {
    const c = this.cursor;
    c.classList.toggle('on', visible);
    c.classList.toggle('down', down);
    const cursor = visible ? 'none' : '';
    if (this.board.style.cursor !== cursor) this.board.style.cursor = cursor;
    if (!visible) return;
    const d = radius * 2 * this.rect.h;
    c.style.width = `${d}px`;
    c.style.height = `${d}px`;
    c.style.transform = `translate(${this.rect.x + u * this.rect.w - d / 2}px, ${this.rect.y + v * this.rect.h - d / 2}px)`;
  }

  setLiftLabel(text: string | null, u = 0, v = 0): void {
    const l = this.liftLabel;
    if (!text) {
      l.classList.remove('on');
      return;
    }
    if (l.textContent !== text) l.textContent = text;
    l.classList.add('on');
    l.style.transform = `translate(${this.rect.x + u * this.rect.w + 26}px, ${this.rect.y + v * this.rect.h - 34}px)`;
  }

  /** Covers the game with a message, once. `reload` adds a button to reload the page. */
  fatal(message: string, reload = false): void {
    if (document.querySelector('.fatal')) return;
    for (const c of document.body.children) (c as HTMLElement).inert = true;
    const m = el('div', 'fatal', document.body);
    m.setAttribute('role', 'alert');
    el('p', '', m, message);
    if (!reload) return;
    const b = el('button', 'quiet', m, UI.reload);
    b.addEventListener('click', () => location.reload());
    b.focus();
  }
}
