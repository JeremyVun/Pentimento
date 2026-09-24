import type { AudioEngine } from './audio';
import { Brush, Coverage } from './brush';
import { ASPECT, DEFAULT_LAYERS, Painter, type Dab } from './gl/painter';
import { Narration } from './narration';
import { SCENES, type SceneConfig } from './scene/config';
import { drawScene } from './scene/draw';
import { drawFlow } from './scene/flow';
import { CHAPTERS, UI, type Chapter } from './story';
import type { View } from './view-dom';

type Phase = 'title' | 'opening' | 'intro' | 'painting' | 'drying' | 'lift';

const BRUSH_RADIUS = 0.034;
const WAKE_AT = 0.42;
const INTRO = 5.2;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const ramp = (t: number, a: number, b: number) => ease((t - a) / (b - a));

export class Game {
  private phase: Phase = 'title';
  private phaseT = 0;
  private chapterIndex = -1;
  private chapter: Chapter | null = null;
  private cfg: SceneConfig = SCENES.title;
  private sceneT = 0;
  private wakeTimes: Record<string, number> = {};
  private shownLines = new Set<number>();
  private sceneCanvas: HTMLCanvasElement;
  private sceneCtx: CanvasRenderingContext2D;
  private flowCanvas: HTMLCanvasElement;
  private sketchCanvas: HTMLCanvasElement;
  private coverage = new Coverage();
  private liftGrid = new Coverage();
  private wash = 0;
  private sketch = 0;
  private living = 1;
  private finishRequested = false;
  private baked = false;
  private closeQueued = false;
  private paintedSeconds = 0;
  private hintShown = false;
  private checkT = 0;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private sceneScale = 0.62;

  constructor(
    private painter: Painter,
    private audio: AudioEngine,
    private brush: Brush,
    private narration: Narration,
    private view: View,
  ) {
    this.sceneCanvas = document.createElement('canvas');
    this.sceneCanvas.width = Math.round(painter.w * this.sceneScale);
    this.sceneCanvas.height = Math.round(painter.h * this.sceneScale);
    this.sceneCtx = this.sceneCanvas.getContext('2d', { alpha: false })!;
    this.flowCanvas = document.createElement('canvas');
    this.flowCanvas.width = 256;
    this.flowCanvas.height = 160;
    this.sketchCanvas = document.createElement('canvas');
    this.sketchCanvas.width = painter.w;
    this.sketchCanvas.height = painter.h;

    brush.radius = BRUSH_RADIUS;
    brush.onFirstPaint = () => this.audio.unlock();
    narration.onVisible = (on) => this.audio.duck(on);
    view.onBegin = () => this.begin();
    view.onFinish = () => { this.finishRequested = true; };
    view.onAgain = () => this.again();
    view.onSave = () => this.save();
    this.enterTitle();
  }

  get debug() {
    return { phase: this.phase, chapter: this.chapter?.id ?? null, t: this.phaseT, coverage: this.coverage.total() };
  }

  /** QA only: jump straight to the lift ending with whatever is on the board. */
  qaLift(): void {
    for (let i = 0; i < CHAPTERS.length; i++) this.painter.bake(i);
    this.chapterIndex = CHAPTERS.length - 1;
    this.chapter = CHAPTERS[this.chapterIndex];
    this.view.showTitle(false);
    this.enterLift();
  }

  private enterTitle(): void {
    this.phase = 'title';
    this.phaseT = 0;
    this.chapterIndex = -1;
    this.chapter = null;
    this.setScene(SCENES.title);
    this.painter.fillMask();
    this.living = 1;
    this.wash = 0;
    this.sketch = 0;
    this.brush.enabled = false;
    this.view.showTitle(true);
    this.view.showEnd(false);
    this.view.setLiftLabel(null);
  }

  private begin(): void {
    if (this.phase !== 'title') return;
    void this.audio.unlock();
    this.audio.play('title');
    this.view.showTitle(false);
    this.phase = 'opening';
    this.phaseT = 0;
  }

  private again(): void {
    this.narration.clear();
    this.view.showEnd(false);
    this.painter.clearLift();
    this.liftGrid.clear();
    this.audio.play('title');
    this.phase = 'opening';
    this.phaseT = 0;
    this.chapterIndex = -1;
    this.setScene(SCENES.title);
    this.painter.fillMask();
    this.living = 1;
    this.brush.enabled = false;
  }

  private async save(): Promise<void> {
    const blob = await this.painter.exportPNG(this.compositeParams(0));
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'pentimento.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  private setScene(cfg: SceneConfig): void {
    this.cfg = cfg;
    this.sceneT = 0;
    this.wakeTimes = {};
    drawFlow(this.flowCanvas.getContext('2d')!, this.flowCanvas.height, cfg);
    this.painter.uploadFlow(this.flowCanvas);
    const sctx = this.sketchCanvas.getContext('2d')!;
    drawScene(sctx, this.sketchCanvas.height, { cfg, t: 0, sketch: true, woke: {} });
    this.painter.uploadSketch(this.sketchCanvas);
  }

  private startChapter(i: number): void {
    const ch = CHAPTERS[i];
    this.chapterIndex = i;
    this.chapter = ch;
    this.setScene(SCENES[ch.id]);
    this.painter.clearMask();
    this.coverage.clear();
    this.shownLines.clear();
    this.finishRequested = false;
    this.baked = false;
    this.closeQueued = false;
    this.brush.scale = ch.brush ?? 1;
    this.living = 1;
    this.sketch = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.view.showCard(ch.card, ch.voice);
  }

  update(dt: number): void {
    this.phaseT += dt;
    this.narration.update(dt);
    const dabs = this.brush.update(dt);

    switch (this.phase) {
      case 'title':
        this.sceneT += dt;
        break;

      case 'opening': {
        this.sceneT += dt;
        this.wash = ramp(this.phaseT, 0, 2.2);
        if (this.phaseT >= 2.4) {
          this.painter.resetBoard();
          this.wash = 1;
          this.startChapter(0);
        }
        break;
      }

      case 'intro': {
        const first = this.chapterIndex === 0;
        const t = this.phaseT;
        if (first) this.wash = 1 - ramp(t, 3.2, 4.6);
        else this.wash = 0.55 * ramp(t, 0, 0.9) * (1 - ramp(t, 3.3, 4.6));
        this.sketch = ramp(t, 2.4, 4.8);
        if (t >= 2.8 && t - dt < 2.8) this.view.hideCard();
        if (t >= INTRO - 1.6 && t - dt < INTRO - 1.6) {
          this.audio.play(this.chapter!.id, this.cfg.duration + 1.6);
        }
        if (t >= INTRO) {
          this.phase = 'painting';
          this.phaseT = 0;
          this.wash = 0;
          this.brush.enabled = true;
          if (first && !this.hintShown) {
            this.hintShown = true;
            this.view.showHint(matchMedia('(pointer: coarse)').matches ? UI.hintTouch : UI.hintMouse);
          }
        }
        break;
      }

      case 'painting': {
        const ch = this.chapter!;
        this.sceneT += dt;
        this.applyPaint(dabs, dt);
        this.painter.dryMask(dt, 0.5);
        ch.lines.forEach((l, i) => {
          if (!this.shownLines.has(i) && this.phaseT >= l.at) {
            this.shownLines.add(i);
            this.narration.push(l.text, ch.voice);
          }
        });
        this.checkT -= dt;
        if (this.checkT <= 0) {
          this.checkT = 0.2;
          for (const s of ch.subjects) {
            if (this.wakeTimes[s.id] !== undefined) continue;
            if (this.coverage.ellipse(s.x, s.y, s.rx, s.ry) >= WAKE_AT) {
              this.wakeTimes[s.id] = this.sceneT;
              this.narration.push(s.line, ch.voice);
              this.audio.wake(s.x / ASPECT);
            }
          }
        }
        if (this.brush.down) this.paintedSeconds += dt;
        if (this.paintedSeconds > 2.5) this.view.hideHint();
        const canFinish = this.phaseT > 25 && this.shownLines.size === ch.lines.length;
        this.view.showFinish(canFinish);
        if (this.phaseT >= this.cfg.duration || this.finishRequested) this.enterDrying();
        break;
      }

      case 'drying': {
        const t = this.phaseT;
        this.painter.dryMask(dt, 3);
        this.sketch = 1 - ramp(t, 0, 1.2);
        if (!this.baked && t >= 1.3) {
          this.baked = true;
          this.painter.bake(this.chapterIndex);
          this.living = 0;
        }
        if (!this.closeQueued && t >= 1.0) {
          this.closeQueued = true;
          this.narration.push(this.closeLine(), this.chapter!.voice);
        }
        if (t > 3 && !this.narration.busy) {
          if (this.chapterIndex + 1 < CHAPTERS.length) this.startChapter(this.chapterIndex + 1);
          else this.enterLift();
        }
        break;
      }

      case 'lift': {
        this.applyLift(dabs, dt);
        break;
      }
    }

    const onBoard = this.brush.x >= 0 && this.brush.x <= 1 && this.brush.y >= 0 && this.brush.y <= 1;
    this.view.setCursor(
      (this.phase === 'painting' || this.phase === 'lift') && this.brush.inside && onBoard,
      this.brush.x, this.brush.y, this.brush.radius * this.brush.scale, this.brush.down,
    );
  }

  private closeLine(): string {
    const ch = this.chapter!;
    const total = this.coverage.total();
    if (total < 0.15) return ch.closeLow;
    if (ch.closeFull && this.coverage.region(0, 0.45) > 0.8) return ch.closeFull;
    return ch.close;
  }

  private enterDrying(): void {
    this.phase = 'drying';
    this.phaseT = 0;
    this.brush.enabled = false;
    this.brush.release();
    this.audio.brushUp();
    this.audio.endChapter();
    this.view.showFinish(false);
    this.view.hideHint();
  }

  private enterLift(): void {
    this.phase = 'lift';
    this.phaseT = 0;
    this.painter.clearLift();
    this.liftGrid.clear();
    this.brush.enabled = true;
    this.brush.scale = 1.8;
    this.audio.play('lift');
    this.view.showHint(UI.lift, true);
    this.view.showEnd(true);
  }

  private wasDown = false;

  private applyPaint(dabs: Dab[], dt: number): void {
    if (dabs.length) {
      this.painter.paint(dabs);
      for (const d of dabs) this.coverage.add(d);
    }
    if (this.brush.down) this.audio.brush(this.brush.x, this.brush.y, this.brush.speed);
    else if (this.wasDown) this.audio.brushUp();
    this.wasDown = this.brush.down;
    void dt;
  }

  private applyLift(dabs: Dab[], dt: number): void {
    const lifted = dabs.map((d) => ({ ...d, strength: d.strength < 0.1 ? 0.004 : 0.011 }));
    if (lifted.length) {
      this.painter.liftPaint(lifted);
      for (const d of lifted) this.liftGrid.add({ ...d, strength: d.strength / 1.6 });
    }
    this.painter.settleLift(dt);
    const k = Math.exp(-dt * 0.06);
    const g = this.liftGrid.grid;
    for (let i = 0; i < g.length; i++) g[i] *= k;

    const depth = this.liftGrid.ellipse(this.brush.x * ASPECT, this.brush.y, 0.015, 0.015) / 1.5;
    const top = CHAPTERS.length - 1;
    const idx = Math.round(top - Math.min(1, depth) * top);
    const layer = CHAPTERS[Math.max(0, Math.min(top, idx))];
    const showing = depth > 0.04 && this.brush.inside;
    this.view.setLiftLabel(showing ? layer.card : null, this.brush.x, this.brush.y);
    if (this.brush.down) {
      this.audio.liftLayer(showing ? layer.id : null);
      this.audio.brush(this.brush.x, this.brush.y, this.brush.speed);
    } else if (this.wasDown) this.audio.brushUp();
    this.wasDown = this.brush.down;
  }

  private compositeParams(time: number) {
    return {
      time,
      sketch: this.sketch,
      wash: this.wash,
      living: this.living,
      dryFade: 0,
      liftMode: this.phase === 'lift',
      layers: CHAPTERS.length,
    };
  }

  private quality = 1;
  private slowFrames = 0;

  /** Thins the brush strokes if frames keep running long. */
  private adapt(frameSec: number): void {
    if (frameSec > 0.024 && frameSec < 0.25) this.slowFrames++;
    else this.slowFrames = Math.max(0, this.slowFrames - 1);
    if (this.slowFrames > 90 && this.quality > 0.45) {
      this.quality *= 0.8;
      this.slowFrames = 0;
    }
  }

  render(time: number, frameSec = 1 / 60): void {
    this.adapt(frameSec);
    const needsLiving = this.living > 0 && (this.phase === 'title' || this.phase === 'opening'
      || this.phase === 'painting' || (this.phase === 'drying' && !this.baked) || (this.phase === 'intro' && this.phaseT > INTRO - 1.5));
    if (needsLiving) {
      const woke: Record<string, number> = {};
      for (const [k, v] of Object.entries(this.wakeTimes)) woke[k] = this.sceneT - v;
      drawScene(this.sceneCtx, this.sceneCanvas.height, { cfg: this.cfg, t: this.sceneT, sketch: false, woke });
      this.painter.uploadScene(this.sceneCanvas, !!this.cfg.blur);
      const slow = this.reducedMotion ? 0.4 : 1;
      this.painter.renderLiving({
        time: this.sceneT * slow,
        warp: this.reducedMotion ? 0.3 : 1,
        blur: this.cfg.blur ?? 0,
        strokeScale: this.cfg.blur ? 1.7 : 1,
        angle: 0,
        layers: this.quality < 1 ? DEFAULT_LAYERS.map((l) => ({ ...l, count: l.count * this.quality })) : DEFAULT_LAYERS,
      });
    }
    this.painter.present(this.compositeParams(time));
  }
}
