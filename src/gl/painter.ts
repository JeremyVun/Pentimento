import { GL, Program, Target, bindTarget, clearTarget, createFloatTarget, createTarget } from './gl';
import {
  BASE_FS, COMPOSITE_FS, DAB_FS, DAB_VS, FULLSCREEN_VS, HOLD_FS, OUTLINE_FS, PAPER_FS, POUR_DOWN_FS, POUR_SEED_FS, POUR_SEED_VS, POUR_SPREAD_FS,
  SKETCH_LINE_FS, STROKE_FS, STROKE_VS,
} from './shaders';

export const ASPECT = 1.6;
export const MAX_LAYERS = 10;
/** Spread passes a second: a pour takes about a second and a half to flow across its shape. */
const SPREAD_PASSES = 100;
export const PAPER_RGB: [number, number, number] = [0.953, 0.925, 0.868];

export interface StrokeLayer {
  count: number;
  length: number;
  width: number;
  detail: number;
  life: number;
  drift: number;
  opacity: number;
}

/** How the paint looks in a given year's hand. */
export interface HandLook {
  /** Mip levels of the view blurred away before painting, so small things become blobs. */
  simplify: number;
  sat: number;
  contrast: number;
  /** 0..1 pull towards the unmixed colours of a child's tin of paints. */
  tin: number;
  /** 0..1 dark painted outline around shapes. */
  outline: number;
  /** 0..1 strokes going every which way instead of following the forms. */
  scrub: number;
  /** How much colour varies stroke to stroke; 1 is the usual. */
  broken: number;
}

export const PLAIN_HAND: HandLook = { simplify: 0, sat: 1, contrast: 1, tin: 0, outline: 0, scrub: 0, broken: 1 };

export interface LivingParams {
  time: number;
  warp: number;
  blur: number;
  strokeScale: number;
  angle: number;
  layers: StrokeLayer[];
  /** 1 makes the held picture follow the living view everywhere, wet or not. */
  follow: number;
  hand: HandLook;
}

export interface CompositeParams {
  time: number;
  sketch: number;
  wash: number;
  living: number;
  dryFade: number;
  liftMode: boolean;
  layers: number;
  pulse?: [number, number, number, number];
  pulseAmt?: number;
  /** How strongly the moving figures show in pencil where the paint isn't alive. */
  figures?: number;
  /** How strongly the people she only imagines show, over wet paint as well as dry. */
  ghosts?: number;
  /** A passing moment, in scene units, glowing softly so the eye finds it. */
  attn?: [number, number, number, number];
  attnAmt?: number;
  /** An ellipse in scene units to light while the rest of the painting dims. */
  focus?: [number, number, number, number];
  focusAmt?: number;
  /** 0 leaves only their colours, blurred by `figureBlur`. */
  figureLines?: number;
  figureBlur?: number;
}

export interface Dab {
  x: number;
  y: number;
  r: number;
  strength: number;
  angle: number;
  seed: number;
}

const DECAY_FS = `#version 300 es
precision mediump float;
out vec4 outColor;
void main() { outColor = vec4(0.0); }
`;

export const DEFAULT_LAYERS: StrokeLayer[] = [
  { count: 3200, length: 48, width: 17, detail: 0, life: 7, drift: 0.01, opacity: 0.8 },
  { count: 7000, length: 24, width: 8.5, detail: 0.045, life: 5.5, drift: 0.01, opacity: 0.9 },
  { count: 9000, length: 12, width: 4.5, detail: 0.11, life: 4.5, drift: 0.008, opacity: 0.95 },
];

export class Painter {
  readonly gl: GL;
  readonly w: number;
  readonly h: number;
  private paper: Target;
  private living: Target;
  private held: [Target, Target];
  private heldIdx = 0;
  private holds: number[] = [];
  private snapFrom = 0;
  private pHold: Program;
  private figuresTex: WebGLTexture;
  private ghostsTex: WebGLTexture;
  private mask: Target;
  private lift: Target;
  private dry: [Target, Target];
  private dryIdx = 0;
  private exportTarget: Target | null = null;
  private snaps: WebGLTexture;
  private sceneTex: WebGLTexture;
  private flowTex: WebGLTexture;
  private sketchTex: WebGLTexture;
  /** The sketch's pencil lines as the screen shows them, worked out once per sketch; null without float targets. */
  private sketchLine: Target | null = null;
  private pSketchLine: Program;
  private pBase: Program;
  private pStroke: Program;
  private pDab: Program;
  private pComposite: Program;
  private pDecay: Program;
  private pOutline: Program;
  private emptyVao: WebGLVertexArrayObject;
  private dabVao: WebGLVertexArrayObject;
  private dabBuf: WebGLBuffer;
  private dabData = new Float32Array(6 * 2048);
  private sceneMip = false;
  private regionTex: WebGLTexture;
  private pour: [Target, Target];
  private pourIdx = 0;
  private pourDown: Target;
  private pSeed: Program;
  private pSpread: Program;
  private pDown: Program;
  private spreadSet = 0;
  private spreadDue = 0;
  readonly coverageW = 160;
  readonly coverageH = 100;
  private coverageBytes = new Uint8Array(160 * 100 * 4);
  private pourPbo: WebGLBuffer;
  private pourFence: WebGLSync | null = null;
  private pourStale = false;

  constructor(readonly canvas: HTMLCanvasElement, width: number) {
    const gl = canvas.getContext('webgl2', {
      antialias: false,
      alpha: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      powerPreference: 'high-performance',
    });
    if (!gl) throw new Error('WebGL2 is not available');
    this.gl = gl;
    this.w = Math.round(width);
    this.h = Math.round(width / ASPECT);
    canvas.width = this.w;
    canvas.height = this.h;

    this.pBase = new Program(gl, FULLSCREEN_VS, BASE_FS);
    this.pStroke = new Program(gl, STROKE_VS, STROKE_FS);
    this.pDab = new Program(gl, DAB_VS, DAB_FS);
    this.pComposite = new Program(gl, FULLSCREEN_VS, COMPOSITE_FS);
    this.pDecay = new Program(gl, FULLSCREEN_VS, DECAY_FS);
    this.pOutline = new Program(gl, FULLSCREEN_VS, OUTLINE_FS);
    this.pSeed = new Program(gl, POUR_SEED_VS, POUR_SEED_FS);
    this.pSpread = new Program(gl, FULLSCREEN_VS, POUR_SPREAD_FS);
    this.pDown = new Program(gl, FULLSCREEN_VS, POUR_DOWN_FS);
    this.pHold = new Program(gl, FULLSCREEN_VS, HOLD_FS);
    this.pSketchLine = new Program(gl, FULLSCREEN_VS, SKETCH_LINE_FS);
    const pPaper = new Program(gl, FULLSCREEN_VS, PAPER_FS);

    this.emptyVao = gl.createVertexArray()!;
    this.dabVao = gl.createVertexArray()!;
    this.dabBuf = gl.createBuffer()!;
    gl.bindVertexArray(this.dabVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dabBuf);
    gl.bufferData(gl.ARRAY_BUFFER, this.dabData.byteLength, gl.DYNAMIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 4, gl.FLOAT, false, 24, 0);
    gl.vertexAttribDivisor(0, 1);
    gl.enableVertexAttribArray(1);
    gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 16);
    gl.vertexAttribDivisor(1, 1);
    gl.bindVertexArray(null);

    const { w, h } = this;
    const half = !!gl.getExtension('EXT_color_buffer_float');
    this.paper = createTarget(gl, w, h);
    this.living = createTarget(gl, w, h);
    this.held = [createTarget(gl, w, h), createTarget(gl, w, h)];
    this.mask = createTarget(gl, w, h, true, half);
    this.lift = createTarget(gl, w, h, true, half);
    this.dry = [createTarget(gl, w, h), createTarget(gl, w, h)];
    const pw = Math.round(w / 2);
    const ph = Math.round(h / 2);
    this.pour = [createTarget(gl, pw, ph, true, half), createTarget(gl, pw, ph, true, half)];
    this.pourDown = createTarget(gl, this.coverageW, this.coverageH);
    this.pourPbo = gl.createBuffer()!;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pourPbo);
    gl.bufferData(gl.PIXEL_PACK_BUFFER, this.coverageBytes.byteLength, gl.STREAM_READ);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.regionTex = this.makeInputTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.regionTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    this.sceneTex = this.makeInputTexture();
    this.flowTex = this.makeInputTexture();
    this.sketchTex = this.makeInputTexture();
    if (half) this.sketchLine = createFloatTarget(gl, w, h);
    this.figuresTex = this.makeInputTexture();
    this.ghostsTex = this.makeInputTexture();

    this.snaps = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.snaps);
    gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1, gl.RGBA8, w, h, MAX_LAYERS);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    bindTarget(gl, this.paper);
    gl.disable(gl.BLEND);
    pPaper.use().f('uRes', w, h);
    gl.bindVertexArray(this.emptyVao);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    this.resetBoard();
  }

  private makeInputTexture(): WebGLTexture {
    const gl = this.gl;
    const t = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([243, 236, 221, 255]));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  private upload(tex: WebGLTexture, src: TexImageSource, mip = false): void {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
    if (mip) {
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    } else {
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    }
  }

  uploadScene(src: TexImageSource, mip: boolean): void {
    this.sceneMip = mip;
    this.upload(this.sceneTex, src, mip);
  }

  uploadFlow(src: TexImageSource): void {
    this.upload(this.flowTex, src);
  }

  uploadSketch(src: TexImageSource): void {
    this.upload(this.sketchTex, src);
    if (!this.sketchLine) return;
    const gl = this.gl;
    bindTarget(gl, this.sketchLine);
    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    this.pSketchLine.use()
      .tex('uSketch', 0, this.sketchTex)
      .tex('uPaper', 1, this.paper.tex)
      .f('uRes', this.w, this.h)
      .f('uFlipY', 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  uploadFigures(src: TexImageSource): void {
    this.upload(this.figuresTex, src);
  }

  uploadGhosts(src: TexImageSource): void {
    this.upload(this.ghostsTex, src);
  }

  uploadRegions(src: TexImageSource): void {
    this.upload(this.regionTex, src);
    const gl = this.gl;
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  }

  resetBoard(): void {
    const [r, g, b] = PAPER_RGB;
    clearTarget(this.gl, this.dry[0], r, g, b);
    clearTarget(this.gl, this.dry[1], r, g, b);
    clearTarget(this.gl, this.held[0], r, g, b);
    clearTarget(this.gl, this.held[1], r, g, b);
    this.dryIdx = 0;
    this.clearMask();
    this.clearLift();
  }

  clearMask(): void {
    if (this.pourFence) this.pourStale = true;
    this.holds = [];
    this.snapFrom = 0;
    clearTarget(this.gl, this.mask, 0, 0, 0, 0);
    clearTarget(this.gl, this.pour[0], 0, 0, 0, 0);
    clearTarget(this.gl, this.pour[1], 0, 0, 0, 0);
  }

  clearLift(): void {
    clearTarget(this.gl, this.lift, 0, 0, 0, 0);
  }

  /** Paints the whole board inside the tape, as if the player had covered it. */
  fillMask(): void {
    const gl = this.gl;
    this.clearMask();
    const t = Math.ceil(0.028 * this.h) + 1;
    bindTarget(gl, this.mask);
    gl.enable(gl.SCISSOR_TEST);
    gl.scissor(t, t, this.w - 2 * t, this.h - 2 * t);
    gl.clearColor(1, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.SCISSOR_TEST);
  }

  renderLiving(p: LivingParams): void {
    const gl = this.gl;
    const h = p.hand;
    const lod = this.sceneMip ? h.simplify : 0;
    bindTarget(gl, this.living);
    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    this.pBase.use()
      .tex('uScene', 0, this.sceneTex)
      .tex('uFlow', 1, this.flowTex)
      .f('uTime', p.time)
      .f('uAspect', ASPECT)
      .f('uWarp', p.warp)
      .f('uBlur', this.sceneMip ? p.blur : 0)
      .f('uLod', lod)
      .f('uSat', h.sat)
      .f('uContrast', h.contrast)
      .f('uTin', h.tin);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    const s = this.pStroke.use()
      .tex('uScene', 0, this.sceneTex)
      .tex('uFlow', 1, this.flowTex)
      .f('uRes', this.w, this.h)
      .f('uAspect', ASPECT)
      .f('uTime', p.time)
      .f('uAngle', p.angle)
      .f('uLod', this.sceneMip ? p.blur * 60 + h.simplify : 0)
      .f('uSat', h.sat)
      .f('uContrast', h.contrast)
      .f('uTin', h.tin)
      .f('uScrub', h.scrub)
      .f('uBroken', h.broken);
    const k = (this.h / 1000) * p.strokeScale;
    const areaK = (1 / (p.strokeScale * p.strokeScale));
    p.layers.forEach((l, i) => {
      s.f('uSeed', i * 13.7 + 1)
        .f('uSize', l.length * k, l.width * k)
        .f('uDetail', l.detail)
        .f('uLife', l.life)
        .f('uDrift', l.drift)
        .f('uOpacity', l.opacity);
      const count = Math.min(40000, Math.round(l.count * areaK));
      gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
    });
    if (h.outline > 0) {
      gl.bindVertexArray(this.emptyVao);
      this.pOutline.use()
        .tex('uScene', 0, this.sceneTex)
        .f('uRes', this.w, this.h)
        .f('uAspect', ASPECT)
        .f('uLod', lod)
        .f('uOutline', h.outline);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    gl.disable(gl.BLEND);
    this.hold(p.follow);
  }

  private hold(follow: number): void {
    const gl = this.gl;
    const src = this.held[this.heldIdx];
    const dst = this.held[1 - this.heldIdx];
    bindTarget(gl, dst);
    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    this.pHold.use()
      .tex('uHeld', 0, src.tex)
      .tex('uLiving', 1, this.living.tex)
      .tex('uPour', 2, this.pour[this.pourIdx].tex)
      .f('uFollow', follow)
      .f('uAspect', ASPECT)
      .f('uHoldN', this.holds.length / 4)
      .f('uSnapFrom', this.snapFrom);
    if (this.holds.length > 0) gl.uniform4fv(this.pHold.loc('uHolds'), this.holds);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    this.snapFrom = this.holds.length / 4;
    this.heldIdx = 1 - this.heldIdx;
  }

  private packDabs(dabs: Dab[], n: number): void {
    const a = this.dabData;
    for (let i = 0; i < n; i++) {
      const d = dabs[i];
      const o = i * 6;
      a[o] = d.x;
      a[o + 1] = d.y;
      a[o + 2] = d.r;
      a[o + 3] = d.strength;
      a[o + 4] = d.angle;
      a[o + 5] = d.seed;
    }
  }

  private drawDabs(target: Target, dabs: Dab[], wet: number): void {
    if (dabs.length === 0) return;
    const gl = this.gl;
    const n = Math.min(dabs.length, this.dabData.length / 6);
    this.packDabs(dabs, n);
    bindTarget(gl, target);
    gl.bindVertexArray(this.dabVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dabBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dabData, 0, n * 6);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE);
    this.pDab.use().f('uRes', this.w, this.h).f('uWet', wet);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);
  }

  paint(dabs: Dab[]): void {
    this.drawDabs(this.mask, dabs, 0.5);
  }

  liftPaint(dabs: Dab[]): void {
    this.drawDabs(this.lift, dabs, 0);
  }

  private decay(target: Target, r: number, g: number, a = 1): void {
    const gl = this.gl;
    bindTarget(gl, target);
    gl.bindVertexArray(this.emptyVao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ZERO, gl.CONSTANT_COLOR);
    gl.blendColor(r, g, 1, a);
    this.pDecay.use();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  dryMask(dt: number, rate = 0.55): void {
    this.decay(this.mask, 1, Math.exp(-dt * rate));
    this.decay(this.pour[this.pourIdx], 1, Math.exp(-dt * rate), Math.exp(-dt * 0.8 * SPREAD_PASSES / 170));
  }

  /** Holds the paint inside an ellipse (scene units, y down) at what the view shows now, however wet it still is. */
  setPaint(x: number, y: number, rx: number, ry: number): void {
    if (this.holds.length >= 16) return;
    this.holds.push(x, y, rx * 1.35, ry * 1.35);
  }

  /** Drops paint at each dab; its strength is how far the paint will flow. */
  pourSeed(dabs: Dab[], anyRegion = false): void {
    if (dabs.length === 0) return;
    const gl = this.gl;
    const n = Math.min(dabs.length, this.dabData.length / 6);
    this.packDabs(dabs, n);
    bindTarget(gl, this.pour[this.pourIdx]);
    gl.bindVertexArray(this.dabVao);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.dabBuf);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.dabData, 0, n * 6);
    gl.enable(gl.BLEND);
    gl.blendEquation(gl.MAX);
    this.pSeed.use().f('uRes', this.pour[0].w, this.pour[0].h).tex('uRegion', 0, this.regionTex).f('uAnyRegion', anyRegion ? 1 : 0);
    gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, n);
    gl.blendEquation(gl.FUNC_ADD);
    gl.disable(gl.BLEND);
    gl.bindVertexArray(this.emptyVao);
  }

  /** Lets poured paint flow on through its region. */
  pourSpread(dt: number, seed: number): void {
    const gl = this.gl;
    this.spreadDue = Math.min(5, this.spreadDue + dt * SPREAD_PASSES);
    const passes = Math.floor(this.spreadDue);
    this.spreadDue -= passes;
    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    for (let i = 0; i < passes; i++) {
      const src = this.pour[this.pourIdx];
      const dst = this.pour[1 - this.pourIdx];
      bindTarget(gl, dst);
      this.spreadSet = 1 - this.spreadSet;
      this.pSpread.use()
        .tex('uPour', 0, src.tex)
        .tex('uRegion', 1, this.regionTex)
        .i('uSet', this.spreadSet)
        .f('uAspect', ASPECT)
        .f('uSeed', seed);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      this.pourIdx = 1 - this.pourIdx;
    }
  }

  private drawPourDown(): void {
    const gl = this.gl;
    bindTarget(gl, this.pourDown);
    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    this.pDown.use().tex('uPour', 0, this.pour[this.pourIdx].tex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /** Coarse painted/unpainted map of poured paint, one byte per cell, rows from the top. Waits for the GPU. */
  readPour(): Uint8Array {
    const gl = this.gl;
    this.drawPourDown();
    gl.readPixels(0, 0, this.coverageW, this.coverageH, gl.RGBA, gl.UNSIGNED_BYTE, this.coverageBytes);
    return this.coverageBytes;
  }

  /** Starts copying the coarse pour map back without waiting for the GPU; `takePourRead` collects it a frame or two later. */
  requestPourRead(): boolean {
    if (this.pourFence) return false;
    const gl = this.gl;
    this.drawPourDown();
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pourPbo);
    gl.readPixels(0, 0, this.coverageW, this.coverageH, gl.RGBA, gl.UNSIGNED_BYTE, 0);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    this.pourFence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    this.pourStale = false;
    gl.flush();
    return true;
  }

  /** The pour map from the last `requestPourRead` once the GPU has finished it, else null. */
  takePourRead(): Uint8Array | null {
    const gl = this.gl;
    const fence = this.pourFence;
    if (!fence || gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED) return null;
    gl.deleteSync(fence);
    this.pourFence = null;
    if (this.pourStale) return null;
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, this.pourPbo);
    gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, this.coverageBytes);
    gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    return this.coverageBytes;
  }

  settleLift(dt: number): void {
    this.decay(this.lift, Math.exp(-dt * 0.06), 1);
  }

  private compositeInto(target: Target | null, c: CompositeParams, bake: boolean): void {
    const gl = this.gl;
    if (target) bindTarget(gl, target);
    else bindTarget(gl, null, this.w, this.h);
    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    this.pComposite.use()
      .tex('uDry', 0, this.dry[this.dryIdx].tex)
      .tex('uLiving', 1, this.held[this.heldIdx].tex)
      .tex('uMask', 2, this.mask.tex)
      .tex('uSketch', 3, this.sketchTex)
      .tex('uPaper', 4, this.paper.tex)
      .tex('uSnaps', 5, this.snaps, gl.TEXTURE_2D_ARRAY)
      .tex('uLift', 6, this.lift.tex)
      .tex('uPour', 7, this.pour[this.pourIdx].tex)
      .f('uLayers', c.layers)
      .f('uLiftMode', c.liftMode ? 1 : 0)
      .f('uSketchAmt', c.sketch)
      .f('uWash', c.wash)
      .f('uBake', bake ? 1 : 0)
      .f('uFlipY', target ? 0 : 1)
      .f('uTape', 0.028)
      .f('uAspect', ASPECT)
      .f('uTime', c.time)
      .f('uLivingAmt', c.living)
      .f('uRes', this.w, this.h)
      .f('uPaperCol', ...PAPER_RGB)
      .f('uDryFade', c.dryFade)
      .f('uPulse', ...(c.pulse ?? [0, 0, 1, 1]))
      .f('uPulseAmt', c.pulseAmt ?? 0)
      .tex('uFigures', 8, this.figuresTex)
      .tex('uGhosts', 9, this.ghostsTex)
      .f('uGhostAmt', c.ghosts ?? 0)
      .f('uFigAmt', c.figures ?? 0)
      .f('uAttn', ...(c.attn ?? [0, 0, 1, 1]))
      .f('uAttnAmt', c.attn ? c.attnAmt ?? 0 : 0)
      .f('uFocus', ...(c.focus ?? [0, 0, 1, 1]))
      .f('uFocusAmt', c.focus ? c.focusAmt ?? 0 : 0)
      .f('uFigLines', c.figureLines ?? 1)
      .f('uFigBlur', c.figureBlur ?? 0)
      .f('uHasLine', this.sketchLine ? 1 : 0);
    if (this.sketchLine) this.pComposite.tex('uSketchLine', 10, this.sketchLine.tex);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  present(c: CompositeParams): void {
    this.compositeInto(null, c, false);
  }

  /** Dries the current painting into the board and records it as snapshot `layer`. */
  bake(layer: number): void {
    const gl = this.gl;
    const next = this.dry[1 - this.dryIdx];
    this.compositeInto(next, {
      time: 0, sketch: 0, wash: 0, living: 1, dryFade: 0, liftMode: false, layers: 1,
    }, true);
    this.dryIdx = 1 - this.dryIdx;
    if (layer >= 0 && layer < MAX_LAYERS) {
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, next.fbo);
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.snaps);
      gl.copyTexSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, 0, 0, this.w, this.h);
      gl.bindFramebuffer(gl.READ_FRAMEBUFFER, null);
    }
    this.clearMask();
  }

  async exportPNG(c: CompositeParams): Promise<Blob> {
    const gl = this.gl;
    this.exportTarget ??= createTarget(gl, this.w, this.h);
    this.compositeInto(this.exportTarget, c, false);
    const px = new Uint8Array(this.w * this.h * 4);
    gl.readPixels(0, 0, this.w, this.h, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const cv = document.createElement('canvas');
    cv.width = this.w;
    cv.height = this.h;
    const ctx = cv.getContext('2d')!;
    const img = ctx.createImageData(this.w, this.h);
    img.data.set(px);
    ctx.putImageData(img, 0, 0);
    return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('toBlob failed'))), 'image/png'));
  }
}
