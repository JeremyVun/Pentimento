import { ASPECT } from './gl/painter';
import { DEFINITION, TITLE, UI } from './story';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls: string, parent: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  parent.appendChild(e);
  return e;
}

/** Everything on the page apart from the painting itself. */
export class View {
  readonly board: HTMLCanvasElement;
  readonly narrationRoot: HTMLElement;
  private title: HTMLElement;
  private card: HTMLElement;
  private hint: HTMLElement;
  private cursor: HTMLElement;
  private liftLabel: HTMLElement;
  private finish: HTMLButtonElement;
  private mute: HTMLButtonElement;
  private end: HTMLElement;
  private rect = { x: 0, y: 0, w: 0, h: 0 };
  onBegin: (() => void) | null = null;
  onFinish: (() => void) | null = null;
  onAgain: (() => void) | null = null;
  onSave: (() => void) | null = null;
  onMute: ((muted: boolean) => void) | null = null;

  constructor(root: HTMLElement) {
    this.board = el('canvas', 'board', root);
    this.board.setAttribute('aria-label', 'The painting');
    this.board.setAttribute('role', 'img');

    this.title = el('div', 'title', root);
    const plate = el('div', 'plate', this.title);
    el('h1', '', plate, TITLE);
    el('p', 'definition', plate, DEFINITION);
    const begin = el('button', 'begin', plate, UI.begin);
    begin.addEventListener('click', () => this.onBegin?.());
    el('p', 'small', plate, UI.sound);

    this.card = el('div', 'card', root);
    this.cursor = el('div', 'cursor', root);
    this.liftLabel = el('div', 'lift-label', root);
    this.narrationRoot = el('div', 'narration', root);
    this.narrationRoot.setAttribute('aria-live', 'polite');
    this.hint = el('div', 'hint', root);

    const controls = el('div', 'controls', root);
    this.finish = el('button', 'quiet finish', controls, UI.finish);
    this.finish.addEventListener('click', () => this.onFinish?.());
    this.mute = el('button', 'quiet', controls, UI.mute);
    this.mute.addEventListener('click', () => this.toggleMute());

    this.end = el('div', 'end', root);
    const save = el('button', 'quiet', this.end, UI.save);
    save.addEventListener('click', () => this.onSave?.());
    const again = el('button', 'quiet', this.end, UI.again);
    again.addEventListener('click', () => this.onAgain?.());

    window.addEventListener('keydown', (e) => {
      if (e.key === 'm' || e.key === 'M') this.toggleMute();
      if (e.key === 'f' || e.key === 'F') {
        if (document.fullscreenElement) void document.exitFullscreen();
        else void document.documentElement.requestFullscreen?.().catch(() => {});
      }
    });
    window.addEventListener('resize', () => this.layout());
    this.layout();
  }

  private muted = false;
  private toggleMute(): void {
    this.muted = !this.muted;
    this.mute.textContent = this.muted ? UI.unmute : UI.mute;
    this.onMute?.(this.muted);
  }

  /** CSS size of the board, used to choose the painting resolution. */
  get boardCss(): { w: number; h: number } {
    return { w: this.rect.w, h: this.rect.h };
  }

  layout(): void {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const band = Math.max(96, vh * 0.15);
    let h = Math.min(vh - band - vh * 0.05, (vw * 0.95) / ASPECT);
    h = Math.max(160, h);
    const w = h * ASPECT;
    const x = (vw - w) / 2;
    const y = Math.max(vh * 0.035, (vh - band - h) * 0.55);
    this.rect = { x, y, w, h };
    Object.assign(this.board.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    for (const e of [this.title, this.card]) {
      Object.assign(e.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
    }
    const top = y + h;
    Object.assign(this.narrationRoot.style, { left: `${x}px`, width: `${w}px`, top: `${top}px`, height: `${vh - top}px` });
    Object.assign(this.hint.style, { left: `${x}px`, width: `${w}px`, top: `${top}px`, height: `${vh - top}px` });
    document.documentElement.style.setProperty('--board-h', `${h}px`);
  }

  showTitle(on: boolean): void {
    this.title.classList.toggle('on', on);
  }

  showCard(text: string, voice: string): void {
    this.card.textContent = text;
    this.card.className = `card ${voice} on`;
  }

  hideCard(): void {
    this.card.classList.remove('on');
  }

  showHint(text: string, centred = false): void {
    this.hint.textContent = text;
    this.hint.classList.toggle('centred', centred);
    this.hint.classList.add('on');
  }

  hideHint(): void {
    this.hint.classList.remove('on');
  }

  showFinish(on: boolean): void {
    this.finish.classList.toggle('on', on);
  }

  showEnd(on: boolean): void {
    this.end.classList.toggle('on', on);
  }

  setCursor(visible: boolean, u: number, v: number, radius: number, down: boolean): void {
    const c = this.cursor;
    c.classList.toggle('on', visible);
    c.classList.toggle('down', down);
    if (!visible) return;
    const d = radius * 2 * this.rect.h;
    c.style.width = `${d}px`;
    c.style.height = `${d}px`;
    c.style.transform = `translate(${this.rect.x + u * this.rect.w - d / 2}px, ${this.rect.y + v * this.rect.h - d / 2}px)`;
    this.board.style.cursor = 'none';
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

  fatal(message: string): void {
    const m = el('div', 'fatal', document.body, message);
    m.setAttribute('role', 'alert');
  }
}
