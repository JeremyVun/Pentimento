import { GL, Program, Target, bindTarget, clearTarget, createTarget } from './gl';
import {
  BASE_FS, COMPOSITE_FS, DAB_FS, DAB_VS, FULLSCREEN_VS, PAPER_FS, STROKE_FS, STROKE_VS,
} from './shaders';

export const ASPECT = 1.6;
export const MAX_LAYERS = 10;
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

export interface LivingParams {
  time: number;
  warp: number;
  blur: number;
  strokeScale: number;
  angle: number;
  layers: StrokeLayer[];
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
  private mask: Target;
  private lift: Target;
  private dry: [Target, Target];
  private dryIdx = 0;
  private exportTarget: Target;
  private snaps: WebGLTexture;
  private sceneTex: WebGLTexture;
  private flowTex: WebGLTexture;
  private sketchTex: WebGLTexture;
  private pBase: Program;
  private pStroke: Program;
  private pDab: Program;
  private pComposite: Program;
  private pDecay: Program;
  private emptyVao: WebGLVertexArrayObject;
  private dabVao: WebGLVertexArrayObject;
  private dabBuf: WebGLBuffer;
  private dabData = new Float32Array(6 * 2048);
  private sceneMip = false;

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
    this.mask = createTarget(gl, w, h, true, half);
    this.lift = createTarget(gl, w, h, true, half);
    this.dry = [createTarget(gl, w, h), createTarget(gl, w, h)];
    this.exportTarget = createTarget(gl, w, h);

    this.sceneTex = this.makeInputTexture();
    this.flowTex = this.makeInputTexture();
    this.sketchTex = this.makeInputTexture();

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
  }

  resetBoard(): void {
    const [r, g, b] = PAPER_RGB;
    clearTarget(this.gl, this.dry[0], r, g, b);
    clearTarget(this.gl, this.dry[1], r, g, b);
    this.dryIdx = 0;
    this.clearMask();
    this.clearLift();
  }

  clearMask(): void {
    clearTarget(this.gl, this.mask, 0, 0, 0, 0);
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
    bindTarget(gl, this.living);
    gl.bindVertexArray(this.emptyVao);
    gl.disable(gl.BLEND);
    this.pBase.use()
      .tex('uScene', 0, this.sceneTex)
      .tex('uFlow', 1, this.flowTex)
      .f('uTime', p.time)
      .f('uAspect', ASPECT)
      .f('uWarp', p.warp)
      .f('uBlur', this.sceneMip ? p.blur : 0);
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
      .f('uLod', this.sceneMip ? p.blur * 60 : 0);
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
      gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, count);
    });
    gl.disable(gl.BLEND);
  }

  private drawDabs(target: Target, dabs: Dab[], wet: number): void {
    if (dabs.length === 0) return;
    const gl = this.gl;
    const n = Math.min(dabs.length, this.dabData.length / 6);
    for (let i = 0; i < n; i++) {
      const d = dabs[i];
      const o = i * 6;
      this.dabData[o] = d.x;
      this.dabData[o + 1] = d.y;
      this.dabData[o + 2] = d.r;
      this.dabData[o + 3] = d.strength;
      this.dabData[o + 4] = d.angle;
      this.dabData[o + 5] = d.seed;
    }
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

  private decay(target: Target, r: number, g: number): void {
    const gl = this.gl;
    bindTarget(gl, target);
    gl.bindVertexArray(this.emptyVao);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ZERO, gl.CONSTANT_COLOR);
    gl.blendColor(r, g, 1, 1);
    this.pDecay.use();
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.disable(gl.BLEND);
  }

  dryMask(dt: number, rate = 0.55): void {
    this.decay(this.mask, 1, Math.exp(-dt * rate));
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
      .tex('uLiving', 1, this.living.tex)
      .tex('uMask', 2, this.mask.tex)
      .tex('uSketch', 3, this.sketchTex)
      .tex('uPaper', 4, this.paper.tex)
      .tex('uSnaps', 5, this.snaps, gl.TEXTURE_2D_ARRAY)
      .tex('uLift', 6, this.lift.tex)
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
      .f('uPulseAmt', c.pulseAmt ?? 0);
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
