const HEADER = `#version 300 es
precision highp float;
precision highp int;
`;

const NOISE = `
vec4 hash44(vec4 p) {
  p = fract(p * vec4(0.1031, 0.1030, 0.0973, 0.1099));
  p += dot(p, p.wzxy + 33.33);
  return fract((p.xxyz + p.yzzw) * p.zywx);
}
float hash21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vnoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i), b = hash21(i + vec2(1, 0));
  float c = hash21(i + vec2(0, 1)), d = hash21(i + vec2(1, 1));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }
float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
float fbm(vec2 p) {
  float s = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 17.1; a *= 0.5; }
  return s;
}
float lum(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
vec3 rgb2hsv(vec3 c) {
  vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
  vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
  vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));
  float d = q.x - min(q.w, q.y);
  float e = 1.0e-10;
  return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}
vec3 hsv2rgb(vec3 c) {
  vec3 p = abs(fract(c.xxx + vec3(0.0, 2.0 / 3.0, 1.0 / 3.0)) * 6.0 - 3.0);
  return c.z * mix(vec3(1.0), clamp(p - 1.0, 0.0, 1.0), c.y);
}
`;

export const FULLSCREEN_VS = `${HEADER}
out vec2 vUV;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  vUV = p;
  gl_Position = vec4(p * 2.0 - 1.0, 0.0, 1.0);
}
`;

// Paper: R = tooth (cold-press bumps), G = fibres, B = large-scale mottling.
export const PAPER_FS = `${HEADER}${NOISE}
in vec2 vUV;
uniform vec2 uRes;
out vec4 outColor;
void main() {
  vec2 px = vUV * uRes;
  float tooth = 0.0;
  tooth += 0.55 * vnoise(px / 5.5);
  tooth += 0.30 * vnoise(px / 2.3 + 11.0);
  tooth += 0.15 * vnoise(px / 1.1 + 5.0);
  tooth = smoothstep(0.2, 0.8, tooth);
  float fib = 0.0;
  for (int i = 0; i < 3; i++) {
    float a = float(i) * 2.1 + 0.4;
    vec2 d = vec2(cos(a), sin(a));
    vec2 q = vec2(dot(px, d), dot(px, vec2(-d.y, d.x)));
    fib = max(fib, smoothstep(0.82, 0.97, vnoise(vec2(q.x / 40.0, q.y / 1.6) + float(i) * 7.0)));
  }
  float mottle = fbm(vUV * vec2(uRes.x / uRes.y, 1.0) * 3.0);
  outColor = vec4(tooth, fib, mottle, 1.0);
}
`;

// The living layer's underpainting: the scene, sampled through a slow flowing warp.
export const BASE_FS = `${HEADER}${NOISE}
in vec2 vUV;
uniform sampler2D uScene;
uniform sampler2D uFlow;
uniform float uTime;
uniform float uAspect;
uniform float uWarp;
uniform float uBlur;
out vec4 outColor;
void main() {
  vec2 uv = vUV;
  vec2 q = uv * vec2(uAspect, 1.0);
  float t = uTime;
  vec2 w1 = vec2(snoise(q * 2.6 + vec2(t * 0.045, 0.0)), snoise(q * 2.6 + vec2(5.2, 1.3 - t * 0.04)));
  vec2 w2 = vec2(snoise(q * 8.0 + w1 * 1.5 + t * 0.07), snoise(q * 8.0 - w1 * 1.5 + 3.1 - t * 0.06));
  vec2 wuv = uv + (w1 * 0.0028 + w2 * 0.0011) * uWarp * vec2(1.0 / uAspect, 1.0);
  vec3 col;
  if (uBlur > 0.0) {
    col = vec3(0.0);
    float tot = 0.0;
    for (int i = 0; i < 12; i++) {
      float a = float(i) * 2.39996;
      float r = sqrt((float(i) + 0.5) / 12.0);
      vec2 o = vec2(cos(a), sin(a)) * r * uBlur * vec2(1.0 / uAspect, 1.0);
      col += textureLod(uScene, wuv + o, 2.0).rgb;
      tot += 1.0;
    }
    col /= tot;
  } else {
    col = texture(uScene, wuv).rgb;
  }
  vec4 fl = texture(uFlow, uv);
  float ang = fl.b > 0.004 ? (fl.b - 0.5) * 3.14159 : 0.0;
  vec2 d = vec2(cos(ang), sin(ang));
  vec2 r = vec2(dot(q, d), dot(q, vec2(-d.y, d.x)));
  float streak = snoise(vec2(r.x * 5.0, r.y * 140.0)) * 0.6 + snoise(vec2(r.x * 2.0, r.y * 45.0)) * 0.4;
  col *= 1.0 + streak * 0.035;
  float blot = fbm(q * 7.0 + 3.0);
  col = mix(col, col * (0.94 + 0.12 * blot), 0.6);
  float l = lum(col);
  col = mix(vec3(l), col, 0.9);
  col = col * 0.95 + vec3(0.03, 0.026, 0.018);
  outColor = vec4(col, 1.0);
}
`;

// Brush strokes, drawn instanced over the base. Everything about a stroke comes from its instance id.
export const STROKE_VS = `${HEADER}${NOISE}
uniform sampler2D uScene;
uniform sampler2D uFlow;
uniform vec2 uRes;
uniform float uAspect;
uniform float uTime;
uniform float uSeed;
uniform vec2 uSize;
uniform float uDetail;
uniform float uLife;
uniform float uDrift;
uniform float uOpacity;
uniform float uLod;
uniform float uAngle;
out vec2 vLocal;
out vec3 vColor;
out float vAlpha;
out float vSeed;

vec3 sampleScene(vec2 p) { return textureLod(uScene, p, uLod).rgb; }

void main() {
  float id = float(gl_InstanceID);
  vec4 h0 = hash44(vec4(id, uSeed, 1.7, 3.1));
  float life = uLife * (0.7 + 0.6 * h0.x);
  float tt = uTime + h0.y * life;
  float cyc = floor(tt / life);
  float ph = fract(tt / life);
  vec4 h1 = hash44(vec4(id, uSeed, cyc, 7.3));
  vec4 h2 = hash44(vec4(cyc, id, uSeed, 2.9));
  vec2 p = h1.xy * 1.04 - 0.02;

  vec4 fl = texture(uFlow, clamp(p, 0.0, 1.0));
  vec2 drift = (fl.rg - 0.5) * 2.0;
  p += drift * uDrift * (ph - 0.5) * life * vec2(1.0 / uAspect, 1.0);

  vec2 e = vec2(2.5 / uRes.y) * vec2(1.0 / uAspect, 1.0) * max(1.0, uSize.x * 0.35);
  vec3 cL = sampleScene(p - vec2(e.x, 0.0)), cR = sampleScene(p + vec2(e.x, 0.0));
  vec3 cU = sampleScene(p - vec2(0.0, e.y)), cD = sampleScene(p + vec2(0.0, e.y));
  vec2 g = vec2(lum(cR) - lum(cL), lum(cD) - lum(cU));
  float gm = length(g) + length(cR - cL) * 0.35 + length(cD - cU) * 0.35;

  float keep = uDetail <= 0.0 ? 1.0 : smoothstep(uDetail, uDetail * 1.8, gm);

  float ang;
  float edgeW = smoothstep(0.02, 0.12, gm);
  float hint = fl.b;
  float baseAng = hint > 0.004 ? (hint - 0.5) * 3.14159 : uAngle;
  float edgeAng = atan(g.y, g.x) + 1.5708;
  vec2 bd = vec2(cos(baseAng), sin(baseAng));
  vec2 ed = vec2(cos(edgeAng), sin(edgeAng));
  if (dot(bd, ed) < 0.0) ed = -ed;
  float force = hint > 0.004 ? smoothstep(0.25, 0.4, length(drift)) : 0.0;
  vec2 dir = normalize(mix(mix(bd, ed, edgeW), bd, force) + 1e-4);
  ang = atan(dir.y, dir.x) + (h1.z - 0.5) * 0.5;

  vec2 size = uSize * (0.7 + 0.6 * h1.w);
  float isBase = step(uDetail, 0.0);
  size *= mix(1.0, 0.55, edgeW * isBase);
  size *= 1.0 + isBase * (1.0 - edgeW) * step(0.004, hint) * vec2(0.8, 0.25);

  vec2 dirv = vec2(cos(ang), sin(ang));
  vec3 c0 = sampleScene(p);
  vec3 c1 = sampleScene(p + dirv * size.x * 0.35 / uRes.y * vec2(1.0 / uAspect, 1.0));
  vec3 col = mix(c0, c1, 0.3 * h2.x);
  vec3 hsv = rgb2hsv(col);
  hsv.x = fract(hsv.x + (h2.y - 0.5) * 0.012);
  hsv.y = clamp(hsv.y * (0.93 + 0.14 * h2.z), 0.0, 1.0);
  hsv.z = clamp(hsv.z * (0.965 + 0.07 * h2.w), 0.0, 1.0);
  vColor = hsv2rgb(hsv);

  float env = smoothstep(0.0, 0.12, ph) * (1.0 - smoothstep(0.82, 1.0, ph));
  vAlpha = env * keep * uOpacity;
  vSeed = h0.z * 50.0;

  int vi = gl_VertexID;
  vec2 corner = vec2((vi == 1 || vi == 2 || vi == 4) ? 1.0 : -1.0, (vi == 2 || vi == 4 || vi == 5) ? 1.0 : -1.0);
  vLocal = corner;
  vec2 offPx = mat2(dirv.x, dirv.y, -dirv.y, dirv.x) * (corner * size * 0.5);
  vec2 off = offPx / uRes;
  vec2 pos = p + off;
  gl_Position = vec4(pos * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const STROKE_FS = `${HEADER}${NOISE}
in vec2 vLocal;
in vec3 vColor;
in float vAlpha;
in float vSeed;
out vec4 outColor;
void main() {
  if (vAlpha < 0.004) discard;
  float u = vLocal.x * 0.5 + 0.5;
  float v = vLocal.y;
  float halfW = mix(0.6, 1.0, smoothstep(0.0, 0.22, u)) * mix(1.0, 0.7, smoothstep(0.65, 1.0, u));
  float n = vnoise(vec2(u * 7.0 + vSeed, v * 2.5 + vSeed));
  float edge = abs(v) / halfW;
  float body = 1.0 - smoothstep(0.7, 1.0, edge + (n - 0.5) * 0.35);
  float startCap = smoothstep(0.0, 0.1, u + (n - 0.5) * 0.08);
  float bristle = vnoise(vec2(v * 9.0 + vSeed * 3.0, u * 1.2 + vSeed));
  float bristle2 = vnoise(vec2(v * 23.0 + vSeed * 5.0, u * 2.0));
  float endCap = 1.0 - smoothstep(0.78, 1.0, u + (bristle - 0.5) * 0.3);
  float dry = smoothstep(0.5, 0.95, u) * smoothstep(0.35, 0.65, bristle2);
  float a = body * startCap * endCap * (1.0 - dry * 0.85) * vAlpha;
  if (a < 0.004) discard;
  vec3 c = vColor * (0.97 + 0.05 * bristle + 0.03 * bristle2);
  c *= 1.0 - 0.035 * smoothstep(0.6, 1.0, edge);
  outColor = vec4(c, a);
}
`;

// Brush dabs into the paint mask. R = paint coverage, G = wetness.
export const DAB_VS = `${HEADER}
layout(location = 0) in vec4 aDab;
layout(location = 1) in vec2 aExtra;
uniform vec2 uRes;
out vec2 vLocal;
out float vStrength;
out float vSeed;
void main() {
  int vi = gl_VertexID;
  vec2 corner = vec2((vi == 1 || vi == 2 || vi == 4) ? 1.0 : -1.0, (vi == 2 || vi == 4 || vi == 5) ? 1.0 : -1.0);
  vLocal = corner;
  vStrength = aDab.w;
  vSeed = aExtra.y;
  float ang = aExtra.x;
  vec2 d = vec2(cos(ang), sin(ang));
  vec2 size = vec2(1.35, 1.0) * aDab.z * uRes.y;
  vec2 offPx = mat2(d.x, d.y, -d.y, d.x) * (corner * size);
  gl_Position = vec4((aDab.xy + offPx / uRes) * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const DAB_FS = `${HEADER}${NOISE}
in vec2 vLocal;
in float vStrength;
in float vSeed;
uniform float uWet;
out vec4 outColor;
void main() {
  float r = length(vLocal);
  float n = vnoise(vLocal * 3.0 + vSeed);
  float shape = 1.0 - smoothstep(0.55, 1.0, r + (n - 0.5) * 0.35);
  float bristle = vnoise(vec2(vLocal.y * 11.0 + vSeed * 0.37, vLocal.x * 0.8));
  float cov = shape * mix(0.35, 1.0, smoothstep(0.25, 0.7, bristle));
  outColor = vec4(cov * vStrength, shape * uWet, 0.0, 0.0);
}
`;

// Poured paint. R = paint left to spread, G = wetness, B = painted this sitting,
// A = fresh paint still flowing from the latest pours (it fades, so pouring again re-wets what it reaches).
// A pour seed only wets the region most of the brush is over, so clicks near an edge or on a
// stray edge pixel still fill the shape the player meant.
export const POUR_SEED_VS = `${HEADER}
layout(location = 0) in vec4 aDab;
layout(location = 1) in vec2 aExtra;
uniform vec2 uRes;
uniform sampler2D uRegion;
out vec2 vLocal;
out float vStrength;
out float vSeed;
flat out float vRegion;
float rid(ivec2 p) { return floor(texelFetch(uRegion, p, 0).r * 255.0 / 16.0 + 0.5); }
void main() {
  int vi = gl_VertexID;
  vec2 corner = vec2((vi == 1 || vi == 2 || vi == 4) ? 1.0 : -1.0, (vi == 2 || vi == 4 || vi == 5) ? 1.0 : -1.0);
  vLocal = corner;
  vStrength = aDab.w;
  vSeed = aExtra.y;
  ivec2 size = textureSize(uRegion, 0);
  ivec2 c = ivec2(aDab.xy * vec2(size));
  float ids[9];
  for (int k = 0; k < 9; k++) {
    ivec2 o = ivec2(k % 3 - 1, k / 3 - 1) * 3;
    ids[k] = rid(clamp(c + o, ivec2(0), size - 1));
  }
  float best = ids[4];
  int bestN = 0;
  for (int a = 0; a < 9; a++) {
    int n = 0;
    for (int b = 0; b < 9; b++) n += ids[a] == ids[b] ? 1 : 0;
    if (n > bestN) { bestN = n; best = ids[a]; }
  }
  vRegion = best;
  vec2 size2 = vec2(1.35, 1.0) * aDab.z * uRes.y;
  float ang = aExtra.x;
  vec2 d = vec2(cos(ang), sin(ang));
  vec2 offPx = mat2(d.x, d.y, -d.y, d.x) * (corner * size2);
  gl_Position = vec4((aDab.xy + offPx / uRes) * 2.0 - 1.0, 0.0, 1.0);
}
`;

export const POUR_SEED_FS = `${HEADER}${NOISE}
in vec2 vLocal;
in float vStrength;
in float vSeed;
flat in float vRegion;
uniform sampler2D uRegion;
uniform float uAnyRegion;
out vec4 outColor;
float rid(ivec2 p) { return floor(texelFetch(uRegion, p, 0).r * 255.0 / 16.0 + 0.5); }
void main() {
  if (uAnyRegion < 0.5 && rid(ivec2(gl_FragCoord.xy)) != vRegion) discard;
  float r = length(vLocal);
  float n = vnoise(vLocal * 2.5 + vSeed);
  float shape = 1.0 - smoothstep(0.55, 1.0, r + (n - 0.5) * 0.4);
  if (shape <= 0.0) discard;
  outColor = vec4(vStrength * shape, 1.0, 0.0, vStrength * shape);
}
`;

export const POUR_SPREAD_FS = `${HEADER}${NOISE}
in vec2 vUV;
uniform sampler2D uPour;
uniform sampler2D uRegion;
uniform float uAspect;
uniform float uSeed;
uniform int uSet;
out vec4 outColor;
const ivec2 SET_A[8] = ivec2[8](ivec2(2, 0), ivec2(-2, 0), ivec2(0, 2), ivec2(0, -2), ivec2(1, 1), ivec2(1, -1), ivec2(-1, 1), ivec2(-1, -1));
const ivec2 SET_B[8] = ivec2[8](ivec2(2, 1), ivec2(-2, -1), ivec2(1, -2), ivec2(-1, 2), ivec2(2, -1), ivec2(-2, 1), ivec2(1, 2), ivec2(-1, -2));
float rid(ivec2 p) { return floor(texelFetch(uRegion, p, 0).r * 255.0 / 16.0 + 0.5); }
void main() {
  ivec2 size = textureSize(uPour, 0);
  ivec2 p = ivec2(gl_FragCoord.xy);
  vec4 c = texelFetch(uPour, p, 0);
  float me = rid(p);
  vec2 q0 = vUV * vec2(uAspect, 1.0);
  float rough = 0.7 + 1.1 * vnoise(q0 * 70.0 + uSeed) + 0.9 * vnoise(q0 * 9.0 - uSeed);
  float unit = rough / float(size.y);
  float best = c.r;
  float fresh = c.a;
  for (int i = 0; i < 8; i++) {
    ivec2 o = uSet == 0 ? SET_A[i] : SET_B[i];
    ivec2 q = clamp(p + o, ivec2(0), size - 1);
    vec4 n = texelFetch(uPour, q, 0);
    if (n.r <= 0.0 && n.a <= 0.0) continue;
    float cost = length(vec2(o)) * unit;
    bool other = rid(q) != me;
    best = max(best, other ? min(n.r - cost, 0.004) : n.r - cost);
    if (!other) fresh = max(fresh, n.a - cost);
  }
  float wet = c.g;
  if (best > c.r + 0.003 || fresh > c.a + 0.003) wet = 1.0;
  float painted = max(c.b, step(0.0005, best));
  outColor = vec4(max(best, 0.0), wet, painted, max(fresh, 0.0));
}
`;

export const POUR_DOWN_FS = `${HEADER}
in vec2 vUV;
uniform sampler2D uPour;
out vec4 outColor;
void main() {
  vec4 p = texture(uPour, vUV);
  float painted = max(smoothstep(0.0, 0.01, p.r), p.b);
  outColor = vec4(painted, clamp(p.g, 0.0, 1.0) * painted, 0.0, 1.0);
}
`;

// The current sitting's picture. Wet paint follows the living view; as it dries it keeps the moment it dried in.
export const HOLD_FS = `${HEADER}${NOISE}
in vec2 vUV;
uniform sampler2D uHeld;
uniform sampler2D uLiving;
uniform sampler2D uPour;
uniform float uFollow;
uniform float uAspect;
out vec4 outColor;
void main() {
  vec4 p = texture(uPour, vUV);
  float wet = p.g * max(step(0.0005, p.r), p.b);
  float n = fbm(vUV * vec2(uAspect, 1.0) * 7.0);
  float setsAt = 0.05 + 0.32 * n;
  float follow = max(uFollow, step(setsAt, wet));
  outColor = vec4(mix(texture(uHeld, vUV).rgb, texture(uLiving, vUV).rgb, follow), 1.0);
}
`;

// Final composite: dried layers, the living layer through the paint mask, pencil sketch, tape and paper.
export const COMPOSITE_FS = `${HEADER}${NOISE}
in vec2 vUV;
uniform sampler2D uDry;
uniform sampler2D uLiving;
uniform sampler2D uMask;
uniform sampler2D uSketch;
uniform sampler2D uPaper;
uniform highp sampler2DArray uSnaps;
uniform sampler2D uLift;
uniform sampler2D uPour;
uniform float uLayers;
uniform float uLiftMode;
uniform float uSketchAmt;
uniform float uWash;
uniform float uBake;
uniform float uFlipY;
uniform float uTape;
uniform float uAspect;
uniform float uTime;
uniform float uLivingAmt;
uniform vec2 uRes;
uniform vec3 uPaperCol;
uniform float uDryFade;
uniform vec4 uPulse;
uniform float uPulseAmt;
uniform sampler2D uFigures;
uniform sampler2D uGhosts;
uniform float uGhostAmt;
uniform float uFigAmt;
uniform float uFigLines;
uniform vec4 uFocus;
uniform float uFocusAmt;
uniform vec4 uAttn;
uniform float uAttnAmt;
uniform float uFigBlur;
out vec4 outColor;

float edgeOf(sampler2D s, vec2 uv) {
  vec2 e = 1.0 / vec2(textureSize(s, 0));
  vec3 tl = texture(s, uv + vec2(-e.x, -e.y)).rgb;
  vec3  t = texture(s, uv + vec2(0.0, -e.y)).rgb;
  vec3 tr = texture(s, uv + vec2(e.x, -e.y)).rgb;
  vec3  l = texture(s, uv + vec2(-e.x, 0.0)).rgb;
  vec3  r = texture(s, uv + vec2(e.x, 0.0)).rgb;
  vec3 bl = texture(s, uv + vec2(-e.x, e.y)).rgb;
  vec3  b = texture(s, uv + vec2(0.0, e.y)).rgb;
  vec3 br = texture(s, uv + vec2(e.x, e.y)).rgb;
  vec3 gx = -tl - 2.0 * l - bl + tr + 2.0 * r + br;
  vec3 gy = -tl - 2.0 * t - tr + bl + 2.0 * b + br;
  return length(gx) + length(gy);
}

float sketchEdge(vec2 uv) { return edgeOf(uSketch, uv); }

vec3 graphiteOver(vec3 c) {
  return mix(c * 0.58 + vec3(0.03, 0.03, 0.035), c + vec3(0.18), smoothstep(0.42, 0.2, lum(c)));
}

/** Moving figures in pencil: a pale silhouette, graphite edges, and reds and yellows in colour. */
vec3 pencilFigures(vec3 col, sampler2D tex, vec2 uv, float away, float tooth) {
  vec2 j = vec2(snoise(uv * 40.0 + 3.0), snoise(uv * 40.0 + 11.0)) * 0.0008;
  float line = smoothstep(0.3, 0.85, edgeOf(tex, uv + j));
  line *= 0.6 + 0.4 * tooth;
  vec3 fc = texture(tex, uv).rgb;
  if (uFigBlur > 0.0) {
    vec2 b = vec2(uFigBlur / uAspect, uFigBlur);
    fc = (fc + texture(tex, uv + b).rgb + texture(tex, uv - b).rgb
      + texture(tex, uv + vec2(b.x, -b.y)).rgb + texture(tex, uv + vec2(-b.x, b.y)).rgb) / 5.0;
  }
  float body = smoothstep(0.04, 0.2, length(vec3(1.0) - fc));
  col = mix(col, uPaperCol * 0.96, body * away * 0.45 * uFigLines);
  col = mix(col, graphiteOver(col), clamp(line * away, 0.0, 1.0) * 0.8 * uFigLines);
  vec3 fh = rgb2hsv(fc);
  float hd = min(abs(fh.x - 0.07), 1.0 - abs(fh.x - 0.07));
  float warm = smoothstep(0.55, 0.75, fh.y) * smoothstep(0.09, 0.065, hd);
  return mix(col, fc * 0.95, warm * away * 0.85);
}

float poured(vec2 uv) {
  vec4 p = texture(uPour, uv);
  return max(smoothstep(0.0, 0.03, p.r), p.b);
}

float pourCoverage(vec2 uv) {
  vec2 t = 1.0 / vec2(textureSize(uPour, 0));
  vec2 j = vec2(vnoise(uv * uRes * 0.07), vnoise(uv * uRes * 0.07 + 13.0)) - 0.5;
  float s = 0.0;
  s += poured(uv + j * t * 1.5) * 2.0;
  s += poured(uv + vec2(1.2, 0.7) * t);
  s += poured(uv + vec2(-0.7, 1.2) * t);
  s += poured(uv + vec2(-1.2, -0.7) * t);
  s += poured(uv + vec2(0.7, -1.2) * t);
  return s / 6.0;
}

vec3 wetLook(vec3 c, float wet, vec2 uv, float tooth) {
  if (wet < 0.01) return c;
  vec3 hsv = rgb2hsv(c);
  hsv.y = min(1.0, hsv.y * (1.0 + 0.25 * wet));
  hsv.z *= 1.0 - 0.13 * wet;
  vec3 w = hsv2rgb(hsv);
  vec2 q = uv * vec2(uAspect, 1.0) * 14.0;
  float h0 = fbm(q), hx = fbm(q + vec2(0.15, 0.0)), hy = fbm(q + vec2(0.0, 0.15));
  vec3 n = normalize(vec3((h0 - hx) * 2.0, (h0 - hy) * 2.0, 1.0));
  vec3 L = normalize(vec3(-0.5, -0.6, 0.7));
  vec3 H = normalize(L + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, H), 0.0), 24.0);
  return w + spec * wet * 0.1;
}

void main() {
  vec2 uv = vUV;
  if (uFlipY > 0.5) uv.y = 1.0 - uv.y;
  vec4 paper = texture(uPaper, uv);
  float tooth = paper.r;

  vec3 dry;
  if (uLiftMode > 0.5) {
    float d = clamp(texture(uLift, uv).r, 0.0, 1.0);
    float top = uLayers - 1.0;
    float idx = top - d * top;
    float i0 = floor(idx);
    float f = idx - i0;
    float nn = fbm(uv * vec2(uAspect, 1.0) * 14.0);
    float fe = smoothstep(0.35, 0.65, f + (nn - 0.5) * 0.45);
    vec3 a = texture(uSnaps, vec3(uv, i0)).rgb;
    vec3 b = texture(uSnaps, vec3(uv, min(i0 + 1.0, top))).rgb;
    dry = mix(a, b, fe);
    float rim = fe * (1.0 - fe) * 4.0 * step(0.001, d);
    dry *= 1.0 - rim * 0.12;
  } else {
    dry = texture(uDry, uv).rgb;
    dry = mix(dry, uPaperCol, uDryFade);
  }

  if (uSketchAmt > 0.001 && uBake < 0.5) {
    vec2 j = vec2(snoise(uv * 40.0), snoise(uv * 40.0 + 9.0)) * 0.0007;
    float e1 = sketchEdge(uv + j);
    float e2 = sketchEdge(uv - j * 1.7 + vec2(0.0009, 0.0004));
    float line = max(smoothstep(0.35, 0.9, e1), 0.45 * smoothstep(0.45, 1.0, e2));
    line *= 0.5 + 0.5 * smoothstep(0.3, 0.7, vnoise(uv * uRes * vec2(0.08, 0.3)));
    line *= 0.7 + 0.3 * tooth;
    float dl = lum(dry);
    vec3 graphite = mix(dry * 0.58 + vec3(0.03, 0.03, 0.035), dry + vec3(0.18), smoothstep(0.42, 0.2, dl));
    dry = mix(dry, graphite, clamp(line * uSketchAmt, 0.0, 1.0) * 0.72);
  }

  vec3 col = dry;
  float alive = 0.0;
  if (uLiftMode < 0.5 && uLivingAmt > 0.0) {
    vec4 m = texture(uMask, uv);
    vec4 pr = texture(uPour, uv);
    m.r = max(m.r, pourCoverage(uv) * 1.1);
    m.g = max(m.g, pr.g * max(smoothstep(0.0, 0.01, pr.r), pr.b));
    float streak = vnoise(uv * vec2(uAspect, 1.0) * vec2(120.0, 9.0));
    float cov = m.r * uLivingAmt;
    float mEff = smoothstep(0.16, 0.6, cov + (tooth - 0.5) * 0.32 + (streak - 0.5) * 0.12);
    vec3 liv = texture(uLiving, uv).rgb;
    float ridge = mEff * (1.0 - mEff) * 4.0;
    liv *= 1.0 - ridge * 0.08;
    if (uBake < 0.5) liv = wetLook(liv, clamp(m.g, 0.0, 1.0), uv, tooth);
    col = mix(dry, liv, mEff);
    alive = mEff * smoothstep(0.04, 0.2, m.g);
  }

  if (uFigAmt > 0.001 && uBake < 0.5 && uLiftMode < 0.5) {
    col = pencilFigures(col, uFigures, uv, (1.0 - alive) * uFigAmt, tooth);
    if (uGhostAmt > 0.001) col = pencilFigures(col, uGhosts, uv, uGhostAmt * uFigAmt, tooth);
  }

  if (uBake > 0.5) { outColor = vec4(col, 1.0); return; }

  if (uAttnAmt > 0.001) {
    vec2 ad = (uv * vec2(uAspect, 1.0) - uAttn.xy) / uAttn.zw;
    float r2 = dot(ad, ad);
    float halo = (exp(-r2 * 1.4) * 0.65 + exp(-r2 * 6.0) * 0.35) * uAttnAmt;
    vec3 gold = col * vec3(1.02, 0.9, 0.62) + vec3(0.12, 0.09, 0.02);
    col = mix(col, gold, clamp(halo, 0.0, 1.0));
  }

  if (uPulseAmt > 0.001) {
    vec2 pd = (uv * vec2(uAspect, 1.0) - uPulse.xy) / uPulse.zw;
    float pr = dot(pd, pd);
    float glow = exp(-pr * 1.6) * uPulseAmt;
    col = mix(col, col * vec3(1.1, 1.06, 0.96) + vec3(0.05, 0.04, 0.02), glow * 0.55);
  }

  if (uFocusAmt > 0.001) {
    vec2 fd = (uv * vec2(uAspect, 1.0) - uFocus.xy) / uFocus.zw;
    float lit = exp(-dot(fd, fd) * 0.9);
    vec3 quiet = mix(col, vec3(lum(col)), 0.4) * 0.74;
    col = mix(col, quiet, uFocusAmt * (1.0 - lit));
  }

  if (uWash > 0.001) {
    float wn = fbm(uv * vec2(uAspect, 1.0) * 3.0 + uTime * 0.05);
    float wm = smoothstep(0.0, 0.25, uWash * 1.3 - (wn - 0.5) * 0.5 - 0.15);
    col = mix(col, uPaperCol * (0.98 + 0.04 * wn), wm * min(1.0, uWash * 1.2));
  }

  col *= 0.955 + 0.06 * tooth - 0.012 * paper.g;
  col *= 0.97 + 0.05 * paper.b;

  vec2 pc = uv * vec2(uAspect, 1.0);
  float tx = uTape;
  float dEdge = min(min(pc.x, uAspect - pc.x), min(pc.y, 1.0 - pc.y));
  if (dEdge < tx) {
    float crepe = vnoise(vec2(pc.x * 900.0, pc.y * 30.0)) * 0.5 + vnoise(vec2(pc.x * 30.0, pc.y * 900.0)) * 0.5;
    vec3 tape = vec3(0.925, 0.895, 0.815) * (0.96 + 0.06 * crepe);
    float edgeN = snoise(pc * 60.0) * 0.0012;
    float inner = smoothstep(tx - 0.0012, tx + 0.0002, dEdge + edgeN);
    float over = 0.0;
    if (uLivingAmt > 0.0) {
      float mr = max(texture(uMask, uv).r, pourCoverage(uv));
      over = smoothstep(0.2, 0.7, mr) * 0.85;
    }
    vec3 painted = texture(uLiving, uv).rgb;
    vec3 tapeCol = mix(tape, painted * (0.9 + 0.1 * crepe), over);
    col = mix(tapeCol, col, inner);
    col *= mix(0.94, 1.0, smoothstep(0.0, 0.004, abs(dEdge - tx)));
  }

  vec2 vc = uv - 0.5;
  col *= 1.0 - dot(vc, vc) * 0.22;
  float g = hash21(uv * uRes + fract(uTime) * 100.0);
  col += (g - 0.5) * 0.012;
  outColor = vec4(col, 1.0);
}
`;
