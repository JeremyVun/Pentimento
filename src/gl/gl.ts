export type GL = WebGL2RenderingContext;

export class Program {
  readonly prog: WebGLProgram;
  private locs = new Map<string, WebGLUniformLocation | null>();

  constructor(private gl: GL, vs: string, fs: string) {
    const v = shader(gl, gl.VERTEX_SHADER, vs);
    const f = shader(gl, gl.FRAGMENT_SHADER, fs);
    const p = gl.createProgram()!;
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error('Program link failed: ' + gl.getProgramInfoLog(p));
    }
    gl.deleteShader(v);
    gl.deleteShader(f);
    this.prog = p;
  }

  use(): this {
    this.gl.useProgram(this.prog);
    return this;
  }

  loc(name: string): WebGLUniformLocation | null {
    let l = this.locs.get(name);
    if (l === undefined) {
      l = this.gl.getUniformLocation(this.prog, name);
      this.locs.set(name, l);
    }
    return l;
  }

  f(name: string, ...v: number[]): this {
    const l = this.loc(name);
    if (!l) return this;
    const gl = this.gl;
    if (v.length === 1) gl.uniform1f(l, v[0]);
    else if (v.length === 2) gl.uniform2f(l, v[0], v[1]);
    else if (v.length === 3) gl.uniform3f(l, v[0], v[1], v[2]);
    else gl.uniform4f(l, v[0], v[1], v[2], v[3]);
    return this;
  }

  i(name: string, v: number): this {
    const l = this.loc(name);
    if (l) this.gl.uniform1i(l, v);
    return this;
  }

  tex(name: string, unit: number, t: WebGLTexture, target: number = this.gl.TEXTURE_2D): this {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target, t);
    return this.i(name, unit);
  }
}

function shader(gl: GL, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(s);
    const numbered = src.split('\n').map((l, i) => `${i + 1}: ${l}`).join('\n');
    console.error(numbered);
    throw new Error('Shader compile failed: ' + log);
  }
  return s;
}

export interface Target {
  tex: WebGLTexture;
  fbo: WebGLFramebuffer;
  w: number;
  h: number;
}

export function createTexture(gl: GL, w: number, h: number, linear = true, half = false): WebGLTexture {
  const t = gl.createTexture()!;
  gl.bindTexture(gl.TEXTURE_2D, t);
  if (half) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
  else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const filter = linear ? gl.LINEAR : gl.NEAREST;
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

export function createTarget(gl: GL, w: number, h: number, linear = true, half = false): Target {
  const tex = createTexture(gl, w, h, linear, half);
  const fbo = gl.createFramebuffer()!;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { tex, fbo, w, h };
}

export function bindTarget(gl: GL, t: Target | null, w?: number, h?: number): void {
  gl.bindFramebuffer(gl.FRAMEBUFFER, t ? t.fbo : null);
  gl.viewport(0, 0, t ? t.w : w!, t ? t.h : h!);
}

export function clearTarget(gl: GL, t: Target, r: number, g: number, b: number, a = 1): void {
  bindTarget(gl, t);
  gl.disable(gl.BLEND);
  gl.clearColor(r, g, b, a);
  gl.clear(gl.COLOR_BUFFER_BIT);
}
