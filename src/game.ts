import type { AudioEngine } from './audio';
import { Brush, Coverage } from './brush';
import { ASPECT, Painter, type Dab } from './gl/painter';
import { handOf, livingParams, needsMip } from './hand';
import { Narration, type NoteAt } from './narration';
import { SCENES, type SceneConfig } from './scene/config';
import { drawFigures, drawGhosts, momentSpot, type Spot } from './scene/actors';
import { drawScene } from './scene/draw';
import { drawFlow } from './scene/flow';
import { drawRegions } from './scene/regions';
import { CHAPTERS, UI, type Chapter } from './story';
import type { View } from './view-dom';

type Phase = 'title' | 'opening' | 'intro' | 'painting' | 'drying' | 'reflect' | 'lift';

const BRUSH_RADIUS = 0.034;
const WAKE_AT = 0.42;
/** Seconds from the last opening line to the brush: the card fades, the sketch draws itself, the music starts. */
const SETTLE = 2.6;
/** Most notes she gives after a sitting, besides the closing line. Moments are always told; painted things fill the rest. */
const REFLECT_NOTES = 6;
/** How fast poured paint dries while painting. Wet paint moves with the view; dry paint keeps its moment. */
const DRY_RATE = 0.06;
/** How much further paint reaches for each second the button is held. */
const REACH_PER_SEC = 0.4;
/** A quick click, or each new spot a drag passes over, starts with a small pool. */
const CLICK_REACH = 0.06;
/** Seconds after a moment is caught before the paint around it sets, holding it mid-wave. */
const SETS_AFTER: Record<string, number> = { joe: 3.5, ferry: 2.5, train: 0.8, bus: 2, robin: 2.6 };

type MomentState = 'waiting' | 'passing' | 'caught' | 'gone';

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
  private sceneCanvas: HTMLCanvasElement;
  private sceneCtx: CanvasRenderingContext2D;
  private flowCanvas: HTMLCanvasElement;
  private sketchCanvas: HTMLCanvasElement;
  private regionCanvas: HTMLCanvasElement;
  private pourHeld = 0;
  /** Every spot this press has poured on. They all keep spreading until the button is let go. */
  private pourSpots: { x: number; y: number }[] = [];
  private readT = 0;
  private coverage = new Coverage();
  private liftGrid = new Coverage();
  private wash = 0;
  private sketch = 0;
  private living = 1;
  private finishRequested = false;
  private baked = false;
  private paintedSeconds = 0;
  /** Seconds since the brush was last down, and since the last moment passed. */
  private idleT = 0;
  private sinceGone = 0;
  private hintShown = false;
  private checkT = 0;
  private pulse: { x: number; y: number; rx: number; ry: number; t: number } | null = null;
  private reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private sceneScale = 0.62;
  private figuresCanvas: HTMLCanvasElement;
  private ghostsCanvas: HTMLCanvasElement;
  private ghostsShown = false;
  private moments: Record<string, { state: MomentState; set: boolean; last?: Spot }> = {};
  /** What this sitting's painting holds, in the order it was painted, with where it is. */
  private kept: { lines: string[]; spot?: Spot; moment?: boolean }[] = [];
  private introEnd = Infinity;
  private openingQueued = false;
  private musicStarted = false;
  /** The score plays on under her notes and resolves as her closing line begins. */
  private musicEnded = false;
  private focus: Spot | null = null;
  private focusAmt = 0;
  private attn: Spot | null = null;
  private attnAmt = 0;
  private bellRung = false;
  private paintLeft = Infinity;
  private catchHint = false;

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
    this.figuresCanvas = document.createElement('canvas');
    this.figuresCanvas.width = this.sceneCanvas.width;
    this.figuresCanvas.height = this.sceneCanvas.height;
    this.ghostsCanvas = document.createElement('canvas');
    this.ghostsCanvas.width = this.sceneCanvas.width;
    this.ghostsCanvas.height = this.sceneCanvas.height;

    this.regionCanvas = document.createElement('canvas');
    this.regionCanvas.width = Math.round(painter.w / 2);
    this.regionCanvas.height = Math.round(painter.h / 2);
    brush.radius = BRUSH_RADIUS;
    brush.onFirstPaint = () => this.audio.unlock();
    narration.onVisible = (on) => this.audio.duck(on);
    narration.onLine = (at) => {
      this.focus = at ? { x: at.u * ASPECT, y: at.v, rx: Math.max(0.05, at.ru * ASPECT * 1.6), ry: Math.max(0.04, at.rv * 1.8) } : null;
    };
    view.onBoardPress = () => {
      if (this.phase === 'intro' || this.phase === 'reflect') this.narration.skip();
    };
    view.onBegin = () => this.begin();
    view.onFinish = () => { this.finishRequested = true; };
    view.onAgain = () => this.again();
    view.onSave = () => this.save();
    this.enterTitle();
  }

  get debug() {
    const spots: Record<string, { state: MomentState; u?: number; v?: number }> = {};
    for (const [id, m] of Object.entries(this.moments)) {
      const s = momentSpot(this.cfg, id, this.sceneT, this.woke(id));
      spots[id] = { state: m.state, u: s ? s.x / ASPECT : undefined, v: s?.y };
    }
    return { phase: this.phase, chapter: this.chapter?.id ?? null, t: this.phaseT, sceneT: this.sceneT, coverage: this.coverage.total(), moments: spots };
  }

  /** QA only: jump straight to the lift ending with whatever is on the board. */
  qaLift(): void {
    for (let i = 0; i < CHAPTERS.length; i++) this.painter.bake(i);
    this.chapterIndex = CHAPTERS.length - 1;
    this.chapter = CHAPTERS[this.chapterIndex];
    this.view.showTitle(false);
    this.enterLift();
  }

  /** QA only: paints every earlier year in full, then starts chapter `id`. */
  qaFrom(id: string): void {
    const i = CHAPTERS.findIndex((c) => c.id === id);
    if (i < 0) return;
    void this.audio.unlock();
    this.view.showTitle(false);
    this.painter.resetBoard();
    for (let j = 0; j < i; j++) {
      this.setScene(SCENES[CHAPTERS[j].id]);
      this.painter.fillMask();
      drawScene(this.sceneCtx, this.sceneCanvas.height, { cfg: this.cfg, t: 20, sketch: false, woke: {} });
      this.painter.uploadScene(this.sceneCanvas, needsMip(this.cfg));
      this.painter.renderLiving(livingParams(this.cfg, 20, { follow: 1 }));
      this.painter.bake(j);
    }
    this.startChapter(i);
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
    const from = new URLSearchParams(location.search).get('from');
    if (from) {
      this.qaFrom(from);
      return;
    }
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
    this.cfg = { ...cfg, moments: cfg.moments && { ...cfg.moments } };
    this.sceneT = 0;
    this.wakeTimes = {};
    drawFlow(this.flowCanvas.getContext('2d')!, this.flowCanvas.height, cfg);
    this.painter.uploadFlow(this.flowCanvas);
    const sctx = this.sketchCanvas.getContext('2d')!;
    drawScene(sctx, this.sketchCanvas.height, { cfg: { ...cfg, figures: [] }, t: 0, sketch: true, woke: {} });
    this.painter.uploadSketch(this.sketchCanvas);
    const rctx = this.regionCanvas.getContext('2d')!;
    drawRegions(rctx, this.regionCanvas.height, cfg);
    this.painter.uploadRegions(this.regionCanvas);
  }

  private startChapter(i: number): void {
    const ch = CHAPTERS[i];
    this.chapterIndex = i;
    this.chapter = ch;
    this.setScene(SCENES[ch.id]);
    this.painter.clearMask();
    this.coverage.clear();
    this.finishRequested = false;
    this.baked = false;
    this.moments = {};
    this.idleT = 0;
    this.sinceGone = 0;
    this.kept = [];
    this.introEnd = Infinity;
    this.openingQueued = false;
    this.musicStarted = false;
    this.musicEnded = false;
    for (const m of ch.moments ?? []) this.moments[m.id] = { state: 'waiting', set: false };
    this.bellRung = false;
    this.paintLeft = ch.paint ?? Infinity;
    this.pourSpots = [];
    this.finishAt = Infinity;
    this.brush.scale = ch.brush ?? 1;
    this.living = 1;
    this.sketch = 0;
    this.phase = 'intro';
    this.phaseT = 0;
    this.view.showCard(ch.card, ch.voice);
  }

  update(dt: number): void {
    this.phaseT += dt;
    if (this.pulse) {
      this.pulse.t += dt;
      if (this.pulse.t > 3.5) this.pulse = null;
    }
    this.narration.update(dt);
    this.focusAmt += ((this.focus && this.phase === 'reflect' ? 1 : 0) - this.focusAmt) * Math.min(1, dt * 2.5);
    this.updateAttention(dt);
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
        const ch = this.chapter!;
        const first = this.chapterIndex === 0;
        const t = this.phaseT;
        if (!this.openingQueued && t >= 1.4) {
          this.openingQueued = true;
          for (const line of ch.opening) this.narration.push(line, ch.voice, { v: 0.74 });
        }
        if (this.openingQueued && !Number.isFinite(this.introEnd) && !this.narration.busy) {
          this.introEnd = Math.max(t, 2.8) + SETTLE;
        }
        const e = this.introEnd;
        const settled = Number.isFinite(e);
        if (first) this.wash = settled ? 1 - ramp(t, e - 1.4, e) : 1;
        else this.wash = 0.55 * ramp(t, 0, 0.9) * (settled ? 1 - ramp(t, e - 1.3, e) : 1);
        this.sketch = settled ? ramp(t, e - 2.4, e) : 0;
        if (settled && t >= e - SETTLE && t - dt < e - SETTLE) this.view.hideCard();
        if (settled && !this.musicStarted && t >= e - 1.6) {
          this.musicStarted = true;
          this.audio.play(ch.id, this.cfg.duration + 1.6);
        }
        if (settled && t >= e) {
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
        this.applyPour(dabs, dt);
        this.painter.dryMask(dt, DRY_RATE * handOf(this.cfg).dry);
        this.readT -= dt;
        if (this.readT <= 0) {
          this.readT = 0.2;
          this.coverage.setPoured(this.painter.readPour());
        }
        this.checkT -= dt;
        if (this.checkT <= 0) {
          this.checkT = 0.2;
          for (const s of ch.subjects) {
            if (this.wakeTimes[s.id] !== undefined) continue;
            if (this.coverage.ellipse(s.x, s.y, s.rx, s.ry) >= WAKE_AT) {
              this.wakeTimes[s.id] = this.sceneT;
              this.pulse = { x: s.x, y: s.y, rx: s.rx * 1.3, ry: s.ry * 1.6, t: 0 };
              this.kept.push({ lines: [s.line], spot: s });
              this.audio.wake(s.x / ASPECT);
            }
          }
        }
        this.scheduleMoments(ch);
        this.updateBell();
        this.updateMoments(ch);
        if (this.brush.down) this.paintedSeconds += dt;
        this.idleT = this.brush.down ? 0 : this.idleT + dt;
        this.sinceGone += dt;
        if (this.sittingDone()) this.finishRequested = true;
        if (!this.catchHint && (this.paintedSeconds > 2.5 || this.coverage.total() > 0.06)) this.view.hideHint();
        const canFinish = this.phaseT > 25
          && Object.values(this.moments).every((m) => m.state === 'gone');
        this.view.showFinish(canFinish);
        if (this.phaseT >= this.cfg.duration || this.finishRequested || this.phaseT >= this.finishAt) this.enterDrying();
        break;
      }

      case 'drying': {
        const t = this.phaseT;
        if (!this.baked) this.painter.pourSpread(dt, this.chapterIndex * 7.3);
        this.painter.dryMask(dt, 3);
        this.sketch = 1 - ramp(t, 0, 1.2);
        if (!this.baked && t >= 1.3) {
          this.baked = true;
          this.painter.bake(this.chapterIndex);
          this.living = 0;
        }
        if (this.baked && t >= 1.8) this.enterReflect();
        break;
      }

      case 'reflect': {
        if (!this.musicEnded && this.narration.onLast) {
          this.musicEnded = true;
          this.audio.endChapter();
        }
        if (this.phaseT > 1 && !this.narration.busy) {
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
    const left = Number.isFinite(this.paintLeft) ? Math.max(0, this.paintLeft / (this.chapter?.paint ?? 1)) : 1;
    const cursorR = this.phase === 'painting'
      ? (0.006 + 0.012 * Math.sqrt(left)) + (this.brush.down && left > 0 ? this.pourBudget * 0.035 : 0)
      : this.brush.radius * this.brush.scale;
    this.view.setCursor(
      (this.phase === 'painting' || this.phase === 'lift') && this.brush.inside && onBoard,
      this.brush.x, this.brush.y, cursorR, this.brush.down,
    );
  }

  private woke(id: string): number | undefined {
    return this.wakeTimes[id] === undefined ? undefined : this.sceneT - this.wakeTimes[id];
  }

  private pouringOn(spot: Spot): boolean {
    if (!this.brush.down || this.paintLeft <= 0) return false;
    const dx = (this.brush.x * ASPECT - spot.x) / (spot.rx + 0.04);
    const dy = (this.brush.y - spot.y) / (spot.ry + 0.04);
    return dx * dx + dy * dy <= 1;
  }

  /** A figure stands in front of several shapes, so paint poured on a passing moment covers it whatever is behind. */
  private pourOnMoments(): void {
    for (const [id, m] of Object.entries(this.moments)) {
      if (m.state !== 'passing' && m.state !== 'caught') continue;
      const spot = momentSpot(this.cfg, id, this.sceneT, this.woke(id));
      if (!spot) continue;
      const dx = (this.brush.x * ASPECT - spot.x) / (spot.rx + 0.04);
      const dy = (this.brush.y - spot.y) / (spot.ry + 0.04);
      if (dx * dx + dy * dy > 1) continue;
      const n = Math.max(1, Math.round(spot.rx / spot.ry));
      const seeds: Dab[] = [];
      for (let k = 0; k < n; k++) {
        const x = spot.x + (n === 1 ? 0 : (k / (n - 1) - 0.5) * 2 * (spot.rx - spot.ry));
        seeds.push({ x: x / ASPECT, y: spot.y, r: spot.ry + 0.012, strength: 0.02, angle: 0, seed: this.sceneT + k });
      }
      this.painter.pourSeed(seeds, true);
    }
  }

  /** A soft glow follows whatever is passing and not yet caught, so the eye finds it. */
  private updateAttention(dt: number): void {
    let spot: Spot | null = null;
    if (this.phase === 'painting') {
      for (const [id, m] of Object.entries(this.moments)) {
        if (m.state !== 'passing') continue;
        spot = momentSpot(this.cfg, id, this.sceneT, this.woke(id));
        if (spot) break;
      }
    }
    if (spot) this.attn = spot;
    this.attnAmt += ((spot ? 1 : 0) - this.attnAmt) * Math.min(1, dt * (spot ? 1.2 : 3));
  }

  /** She has painted enough, or has stopped to look. Things can pass now rather than on the clock. */
  private get ready(): boolean {
    const c = this.coverage.total();
    return this.phaseT >= 10 && (c >= 0.5 || (c >= 0.15 && this.idleT >= 3));
  }

  /** Brings the next moment forward once she's ready and the last one has gone. The bell keeps its place before it. */
  private scheduleMoments(ch: Chapter): void {
    const m = this.cfg.moments;
    if (!m || !this.ready || this.sinceGone < 3) return;
    const states = Object.values(this.moments);
    if (states.some((s) => s.state === 'passing' || s.state === 'caught')) return;
    const next = (ch.moments ?? []).map((d) => d.id).filter((id) => this.moments[id].state === 'waiting')
      .sort((a, b) => m[a] - m[b])[0];
    if (!next) return;
    const lead = this.cfg.bellAt !== undefined && !this.bellRung ? m[next] - this.cfg.bellAt : 0;
    const at = this.sceneT + lead + 0.5;
    if (at >= m[next]) return;
    m[next] = at;
    if (lead > 0) this.cfg.bellAt = at - lead;
  }

  /** Everything has passed and she has put the brush down for a while, so the paint can dry. */
  private sittingDone(): boolean {
    if (Object.values(this.moments).some((m) => m.state !== 'gone')) return false;
    return this.phaseT >= 20 && this.sinceGone >= 2 && (this.idleT >= 6 || (this.coverage.total() >= 0.8 && this.idleT >= 2.5));
  }

  private updateBell(): void {
    const at = this.cfg.bellAt;
    if (at === undefined || this.bellRung || this.sceneT < at) return;
    this.bellRung = true;
    this.audio.bell();
  }

  /** Things pass through the view once. Paint that is wet where one is catches it, and the paint then sets around it. */
  private updateMoments(ch: Chapter): void {
    for (const def of ch.moments ?? []) {
      const m = this.moments[def.id];
      const woke = this.woke(def.id);
      const spot = momentSpot(this.cfg, def.id, this.sceneT, woke);
      if (m.state === 'waiting') {
        if (!spot) continue;
        m.state = 'passing';
        m.last = spot;
        if (this.chapterIndex === 0 && def.id === 'ferry') {
          this.catchHint = true;
          this.view.showHint(matchMedia('(pointer: coarse)').matches ? UI.catchTouch : UI.catchMouse);
        }
      } else if (m.state === 'passing') {
        if (spot) m.last = spot;
        if (!spot) {
          m.state = 'gone';
          this.sinceGone = 0;
          this.catchHint = false;
          this.view.hideHint();
          if (def.missed) this.kept.push({ lines: [def.appears, def.missed].filter((l): l is string => !!l), spot: m.last, moment: true });
        } else if (this.pouringOn(spot)) {
          m.state = 'caught';
          this.catchHint = false;
          this.view.hideHint();
          this.wakeTimes[def.id] = this.sceneT;
          this.kept.push({ lines: [def.appears, def.caught, def.after].filter((l): l is string => !!l), spot, moment: true });
          if (!def.ghost) {
            this.pulse = { x: spot.x, y: spot.y, rx: spot.rx * 2.5, ry: spot.ry * 2.5, t: 0 };
            this.audio.wake(spot.x / ASPECT);
          }
        }
      } else if (m.state === 'caught') {
        if (!m.set && woke !== undefined && woke >= (SETS_AFTER[def.id] ?? 2.5) && spot) {
          m.set = true;
          this.painter.setPaint(spot.x, spot.y, spot.rx + 0.015, spot.ry + 0.015);
        }
        if (!spot) {
          m.state = 'gone';
          this.sinceGone = 0;
        }
      }
    }
  }

  private closeLine(): string {
    const ch = this.chapter!;
    if (this.coverage.total() >= 0.15) {
      const missed = (ch.moments ?? []).find((m) => m.closeMissed && !this.wakeTimes[m.id]);
      if (missed?.closeMissed) return missed.closeMissed;
    }
    const total = this.coverage.total();
    if (total < 0.15) return ch.closeLow;
    if (ch.closeFull && this.coverage.region(0, 0.45) > 0.8) return ch.closeFull;
    return ch.close;
  }

  /** The painting is dry and still. She talks about what's in it, pointing at each thing in turn. */
  private enterReflect(): void {
    const ch = this.chapter!;
    this.phase = 'reflect';
    this.phaseT = 0;
    const note = (sp: Spot): NoteAt => ({ u: sp.x / ASPECT, v: sp.y, ru: sp.rx / ASPECT, rv: sp.ry });
    const fixed = (ch.before?.length ?? 0) + (ch.after?.length ?? 0) + this.kept.filter((k) => k.moment).reduce((n, k) => n + k.lines.length, 0);
    let room = REFLECT_NOTES - fixed;
    const told = this.kept.filter((k) => k.moment || room-- > 0);
    for (const line of ch.before ?? []) this.narration.push(line, ch.voice);
    for (const k of told) {
      for (const line of k.lines) this.narration.push(line, ch.voice, k.spot ? { at: note(k.spot) } : {});
    }
    for (const line of ch.after ?? []) this.narration.push(line, ch.voice);
    this.narration.push(this.closeLine(), ch.voice);
  }

  private enterDrying(): void {
    this.phase = 'drying';
    this.phaseT = 0;
    this.brush.enabled = false;
    this.brush.release();
    this.audio.brushUp();
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
  private finishAt = Infinity;

  /** How far the paint from this press has reached so far. */
  private get pourBudget(): number {
    return Math.min(1.6, this.pourHeld * REACH_PER_SEC) * (this.chapter?.brush ?? 1);
  }

  private applyPour(dabs: Dab[], dt: number): void {
    if (this.brush.down && this.paintLeft <= 0) {
      this.pourHeld = 0;
      if (this.wasDown) this.audio.brushUp();
      this.wasDown = false;
      this.painter.pourSpread(dt, (this.chapterIndex + 1) * 7.3);
      return;
    }
    if (this.brush.down) {
      this.paintLeft -= dt;
      if (this.paintLeft <= 0) this.finishAt = this.phaseT + 2.5;
      this.pourHeld += dt;
      if (!this.wasDown) this.pourSpots = [];
      const k = this.chapter?.brush ?? 1;
      const seeds: Dab[] = this.pourSpots.map((p) => ({ x: p.x, y: p.y, r: 0.016, strength: REACH_PER_SEC * dt * k, angle: 0, seed: 1 }));
      const at = dabs.length ? dabs : [{ x: this.brush.x, y: this.brush.y }];
      for (const d of at) {
        if (this.pourSpots.length >= 500 || this.pourSpots.some((p) => Math.abs(p.x - d.x) < 0.012 && Math.abs(p.y - d.y) < 0.012)) continue;
        this.pourSpots.push({ x: d.x, y: d.y });
        seeds.push({ x: d.x, y: d.y, r: 0.016, strength: (CLICK_REACH + REACH_PER_SEC * dt) * k, angle: 0, seed: 1 });
      }
      this.painter.pourAdd(seeds, 0.1 + this.pourBudget);
      this.pourOnMoments();
      this.audio.brush(this.brush.x, this.brush.y, Math.max(this.brush.speed, 0.5));
    } else {
      this.pourHeld = 0;
      this.pourSpots = [];
      if (this.wasDown) this.audio.brushUp();
    }
    this.wasDown = this.brush.down;
    this.painter.pourSpread(dt, (this.chapterIndex + 1) * 7.3);
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
      sketch: this.cfg.noPencil ? 0 : this.sketch,
      wash: this.wash,
      living: this.living,
      dryFade: 0,
      liftMode: this.phase === 'lift',
      layers: CHAPTERS.length,
      pulse: this.pulse ? [this.pulse.x, this.pulse.y, this.pulse.rx, this.pulse.ry] as [number, number, number, number] : undefined,
      pulseAmt: this.pulse ? Math.sin(Math.min(1, this.pulse.t / 3.5) * Math.PI) ** 1.5 : 0,
      figures: this.phase === 'painting' || this.phase === 'intro' || (this.phase === 'drying' && !this.baked) ? this.sketch : 0,
      attn: this.attn ? [this.attn.x, this.attn.y, this.attn.rx * 2 + 0.07, this.attn.ry * 2 + 0.06] as [number, number, number, number] : undefined,
      attnAmt: this.attnAmt * (0.7 + 0.3 * Math.sin(time * 2.4)),
      focus: this.focus ? [this.focus.x, this.focus.y, this.focus.rx, this.focus.ry] as [number, number, number, number] : undefined,
      focusAmt: this.focusAmt,
      ghosts: this.ghostsShown ? 1 : 0,
      figureLines: this.cfg.noPencil ? 0 : 1,
      figureBlur: this.cfg.noPencil ? 0.012 : 0,
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
      || this.phase === 'painting' || (this.phase === 'drying' && !this.baked) || (this.phase === 'intro' && this.phaseT > this.introEnd - 1.5));
    if (needsLiving) {
      const woke: Record<string, number> = {};
      for (const [k, v] of Object.entries(this.wakeTimes)) woke[k] = this.sceneT - v;
      drawScene(this.sceneCtx, this.sceneCanvas.height, { cfg: this.cfg, t: this.sceneT, sketch: false, woke });
      this.painter.uploadScene(this.sceneCanvas, needsMip(this.cfg));
      const slow = this.reducedMotion ? 0.4 : 1;
      if (this.phase !== 'title' && this.phase !== 'opening') {
        drawFigures(this.figuresCanvas.getContext('2d')!, this.figuresCanvas.height, { cfg: this.cfg, t: this.sceneT, sketch: false, woke });
        this.painter.uploadFigures(this.figuresCanvas);
        const hasGhosts = this.cfg.figures.some((g) => g === 'joeGhost' || g === 'fatherGhost');
        if (hasGhosts || this.ghostsShown) {
          this.ghostsShown = drawGhosts(this.ghostsCanvas.getContext('2d')!, this.ghostsCanvas.height, { cfg: this.cfg, t: this.sceneT, sketch: false, woke });
          this.painter.uploadGhosts(this.ghostsCanvas);
        }
      }
      this.painter.renderLiving(livingParams(this.cfg, this.sceneT * slow, {
        warp: this.reducedMotion ? 0.3 : 1,
        follow: this.phase === 'title' || this.phase === 'opening' ? 1 : 0,
        quality: this.quality,
      }));
    }
    this.painter.present(this.compositeParams(time));
  }
}
