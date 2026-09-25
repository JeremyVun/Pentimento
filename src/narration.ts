export type Voice = 'gran' | 'grandchild';

/** A point on the board (0..1 across and down) and how far the thing there extends, so a note can sit beside it. */
export interface NoteAt {
  u: number;
  v: number;
  ru: number;
  rv: number;
}

interface Line {
  text: string;
  voice: Voice;
  at?: NoteAt;
  /** Centred on the board at this height when there's no point to sit beside. */
  v?: number;
}

const GAP = 0.5;
const FADE = 0.9;

/** Shows one line at a time on the painting, inked in word by word. */
export class Narration {
  private queue: Line[] = [];
  private current: { line: Line; t: number; hold: number; el: HTMLElement } | null = null;
  private gap = 0;
  onVisible: ((on: boolean) => void) | null = null;
  /** Called as each line appears, with where it points, and with undefined once the last one has gone. */
  onLine: ((at: NoteAt | undefined) => void) | null = null;

  constructor(private root: HTMLElement) {}

  push(text: string, voice: Voice, place: { at?: NoteAt; v?: number } = {}): void {
    this.queue.push({ text, voice, ...place });
  }

  get busy(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  /** Moves on from the line showing now. */
  skip(): void {
    const c = this.current;
    if (c && c.t > 0.6) c.hold = Math.min(c.hold, c.t);
  }

  clear(): void {
    this.queue.length = 0;
    if (this.current) {
      const el = this.current.el;
      el.classList.add('out');
      setTimeout(() => el.remove(), FADE * 1000);
      this.current = null;
      this.onVisible?.(false);
      this.onLine?.(undefined);
    }
  }

  update(dt: number): void {
    if (this.current) {
      const c = this.current;
      c.t += dt;
      if (c.t > c.hold && !c.el.classList.contains('out')) {
        c.el.classList.add('out');
        this.onVisible?.(false);
      }
      if (c.t > c.hold + FADE) {
        c.el.remove();
        this.current = null;
        this.gap = GAP;
        if (this.queue.length === 0) this.onLine?.(undefined);
      }
      return;
    }
    if (this.gap > 0) {
      this.gap -= dt;
      return;
    }
    const next = this.queue.shift();
    if (!next) return;
    const el = document.createElement('p');
    el.className = `line ${next.voice}`;
    this.place(el, next);
    const words = next.text.split(' ');
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.textContent = w;
      span.style.animationDelay = `${(i * 0.05).toFixed(3)}s`;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    this.root.appendChild(el);
    this.current = { line: next, t: 0, hold: 2.4 + words.length * 0.28, el };
    this.onVisible?.(true);
    this.onLine?.(next.at);
  }

  /** Beside the thing it's about, on whichever side has more room, or centred. */
  private place(el: HTMLElement, line: Line): void {
    const a = line.at;
    if (!a) {
      el.style.left = '50%';
      el.style.top = `${(line.v ?? 0.5) * 100}%`;
      el.style.transform = 'translate(-50%, -50%)';
      return;
    }
    el.style.left = `${Math.min(0.72, Math.max(0.28, a.u)) * 100}%`;
    if (a.v < 0.55) {
      el.style.top = `${Math.min(0.9, a.v + a.rv + 0.04) * 100}%`;
      el.style.transform = 'translate(-50%, 0)';
    } else {
      el.style.top = `${Math.max(0.1, a.v - a.rv - 0.04) * 100}%`;
      el.style.transform = 'translate(-50%, -100%)';
    }
  }
}
