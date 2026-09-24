export type Voice = 'gran' | 'grandchild';

interface Line { text: string; voice: Voice }

const GAP = 0.6;
const FADE = 0.9;

/** Shows one narration line at a time, inked in word by word. */
export class Narration {
  private queue: Line[] = [];
  private current: { line: Line; t: number; hold: number; el: HTMLElement } | null = null;
  private gap = 0;
  onVisible: ((on: boolean) => void) | null = null;

  constructor(private root: HTMLElement) {}

  push(text: string, voice: Voice): void {
    this.queue.push({ text, voice });
  }

  get busy(): boolean {
    return this.current !== null || this.queue.length > 0;
  }

  get pending(): number {
    return this.queue.length + (this.current ? 1 : 0);
  }

  clear(): void {
    this.queue.length = 0;
    if (this.current) {
      const el = this.current.el;
      el.classList.add('out');
      setTimeout(() => el.remove(), FADE * 1000);
      this.current = null;
      this.onVisible?.(false);
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
    const words = next.text.split(' ');
    words.forEach((w, i) => {
      const span = document.createElement('span');
      span.textContent = w;
      span.style.animationDelay = `${(i * 0.055).toFixed(3)}s`;
      el.appendChild(span);
      if (i < words.length - 1) el.appendChild(document.createTextNode(' '));
    });
    this.root.appendChild(el);
    this.current = { line: next, t: 0, hold: 2.6 + words.length * 0.3, el };
    this.onVisible?.(true);
  }
}
