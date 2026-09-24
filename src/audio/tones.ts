import { clamp, hz, rng } from './theory';

export type ToneId = 'piano' | 'musicbox' | 'celesta' | 'marimba' | 'kalimba' | 'glass' | 'pluck' | 'harp' | 'bell';
export type AmbToneId = 'bird' | 'swallow' | 'robin' | 'hammer' | 'thunder';
export type LoopId = 'waterA' | 'waterB' | 'rainA' | 'rainB' | 'pink' | 'brown';

/** Something the synth plays from a generated buffer: a pitched tone, an ambience call or a noise loop. */
export type Asset =
  | { kind: 'tone'; id: ToneId; n: number }
  | { kind: 'amb'; id: AmbToneId; n: number }
  | { kind: 'loop'; id: LoopId; n: number };

/** Generated samples, channel after channel. Plain data so a worker can make it. */
export interface Raw {
  data: Float32Array<ArrayBuffer>;
  sampleRate: number;
  channels: number;
}

export const AMB_VARIANTS: Record<AmbToneId, number> = { bird: 16, swallow: 8, robin: 8, hammer: 4, thunder: 4 };
export const LOOP_IDS: LoopId[] = ['waterA', 'waterB', 'rainA', 'rainB', 'pink', 'brown'];

const TAU = Math.PI * 2;
const cache = new Map<string, AudioBuffer>();

function normalise(a: Asset): Asset {
  if (a.kind === 'tone') return { ...a, n: clamp(Math.round(a.n), 21, 108) };
  if (a.kind === 'amb') return { ...a, n: ((a.n % AMB_VARIANTS[a.id]) + AMB_VARIANTS[a.id]) % AMB_VARIANTS[a.id] };
  return { ...a, n: 0 };
}

export function assetKey(a: Asset): string {
  const b = normalise(a);
  return `${b.kind}:${b.id}:${b.n}`;
}

/** Pure sample generation; safe to run in a worker. */
export function renderAsset(a: Asset): Raw {
  const b = normalise(a);
  if (b.kind === 'tone') return GENERATORS[b.id](b.n);
  if (b.kind === 'amb') return AMB_GENERATORS[b.id](b.n);
  return LOOPS[b.id]();
}

export function isReady(a: Asset): boolean {
  return cache.has(assetKey(a));
}

/** Stores samples made elsewhere (the worker) as a playable buffer. */
export function adopt(a: Asset, r: Raw): void {
  const key = assetKey(a);
  if (cache.has(key)) return;
  const length = r.data.length / r.channels;
  const buf = new AudioBuffer({ length, sampleRate: r.sampleRate, numberOfChannels: r.channels });
  for (let c = 0; c < r.channels; c++) buf.copyToChannel(r.data.subarray(c * length, (c + 1) * length), c);
  cache.set(key, buf);
}

function get(a: Asset): AudioBuffer {
  const key = assetKey(a);
  let b = cache.get(key);
  if (!b) {
    adopt(a, renderAsset(a));
    b = cache.get(key)!;
  }
  return b;
}

/** Neighbouring semitones share one buffer, the odd one played a semitone up, which halves memory. */
export function toneAsset(id: ToneId, midi: number): { asset: Asset; detune: number } {
  const m = clamp(Math.round(midi), 21, 108);
  const base = m - (m & 1);
  return { asset: { kind: 'tone', id, n: base }, detune: (m - base) * 100 };
}

export function toneBuffer(id: ToneId, midi: number): { buffer: AudioBuffer; detune: number } {
  const { asset, detune } = toneAsset(id, midi);
  return { buffer: get(asset), detune };
}

export function ambBuffer(id: AmbToneId, variant: number): AudioBuffer {
  return get({ kind: 'amb', id, n: variant });
}

export function loopBuffer(id: LoopId): AudioBuffer {
  return get({ kind: 'loop', id, n: 0 });
}

function raw(data: Float32Array<ArrayBuffer>, sampleRate: number, channels = 1): Raw {
  return { data, sampleRate, channels };
}

interface Partial {
  f: number;
  a: number;
  tau: number;
  a2?: number;
  tau2?: number;
  phase?: number;
}

function addPartials(out: Float32Array, sr: number, parts: Partial[]): void {
  for (const p of parts) {
    if (p.f >= sr * 0.45 || p.f <= 0) continue;
    const w = (TAU * p.f) / sr;
    const c = Math.cos(w);
    const s = Math.sin(w);
    const d1 = Math.exp(-1 / (p.tau * sr));
    const tau2 = p.tau2 ?? p.tau;
    const d2 = Math.exp(-1 / (tau2 * sr));
    const ph = p.phase ?? 0;
    let re = Math.cos(ph);
    let im = Math.sin(ph);
    let a1 = p.a;
    let a2 = p.a2 ?? 0;
    const n = Math.min(out.length, Math.ceil(Math.max(p.tau, tau2) * sr * 9.5));
    for (let i = 0; i < n; i++) {
      out[i] += im * (a1 + a2);
      const r2 = re * c - im * s;
      im = re * s + im * c;
      re = r2;
      a1 *= d1;
      a2 *= d2;
    }
  }
}

function attack(out: Float32Array, sr: number, tau: number): void {
  const n = Math.min(out.length, Math.ceil(tau * sr * 7));
  for (let i = 0; i < n; i++) out[i] *= 1 - Math.exp(-i / (tau * sr));
}

/** Short filtered noise burst mixed into the start (hammer, pin or mallet contact). */
function burst(out: Float32Array, sr: number, seed: number, amp: number, tau: number, cutoff: number, highpass = false): void {
  const r = rng(seed);
  const k = 1 - Math.exp((-TAU * cutoff) / sr);
  let lp = 0;
  let prev = 0;
  const n = Math.min(out.length, Math.ceil(tau * sr * 8));
  for (let i = 0; i < n; i++) {
    const x = r() * 2 - 1;
    lp += k * (x - lp);
    const y = highpass ? lp - prev : lp;
    prev = lp;
    out[i] += y * amp * Math.exp(-i / (tau * sr)) * (highpass ? 3 : 1);
  }
}

function normaliseRms(out: Float32Array, sr: number, target: number, windowSec = 0.3): void {
  const n = Math.min(out.length, Math.round(windowSec * sr));
  let sum = 0;
  for (let i = 0; i < n; i++) sum += out[i] * out[i];
  const rms = Math.sqrt(sum / Math.max(1, n));
  if (rms < 1e-9) return;
  const g = target / rms;
  for (let i = 0; i < out.length; i++) out[i] *= g;
}

function fadeTail(out: Float32Array, sr: number, sec = 0.05): void {
  const n = Math.min(out.length, Math.round(sec * sr));
  for (let i = 0; i < n; i++) out[out.length - 1 - i] *= i / n;
}

const PIANO_SR = 16000;

function piano(midi: number): Raw {
  const sr = PIANO_SR;
  const f0 = hz(midi);
  const r = rng(midi * 7919 + 13);
  const len = Math.round(sr * clamp(6.5 - (midi - 36) * 0.075, 2.4, 6.5));
  const out = new Float32Array(len);
  const inharm = 0.00012 * Math.pow(2, ((midi - 40) / 12) * 0.9);
  const tau1 = clamp(5.5 * Math.pow(2, -(midi - 43) / 16), 0.8, 8);
  const detunes = [-(0.35 + r() * 0.8), 0.35 + r() * 0.8, (r() - 0.5) * 0.4];
  const weights = midi < 40 ? [0.6, 0.4, 0] : [0.4, 0.33, 0.27];
  const parts: Partial[] = [];
  for (let n = 1; n <= 24; n++) {
    const fn = n * f0 * Math.sqrt(1 + inharm * n * n);
    if (fn > 7200) break;
    const comb = Math.abs(Math.sin(Math.PI * n * 0.13));
    const a = (1 / Math.pow(n, 0.85)) * Math.exp(-fn / 1900) * (0.3 + 0.7 * comb);
    const tauN = tau1 / (1 + 0.2 * (n - 1) + fn / 2800);
    for (let s = 0; s < 3; s++) {
      if (!weights[s]) continue;
      const f = fn * Math.pow(2, detunes[s] / 1200);
      const as = a * weights[s];
      parts.push({ f, a: as * 0.55, tau: tauN * 0.2, a2: as * 0.45, tau2: tauN, phase: r() * 0.3 });
    }
  }
  addPartials(out, sr, parts);
  burst(out, sr, midi * 31 + 7, 0.1, 0.01, 500 + f0 * 1.5);
  attack(out, sr, 0.0025 + 0.004 * clamp((72 - midi) / 36, 0, 1));
  normaliseRms(out, sr, 0.16 * (1 + clamp((60 - midi) / 48, -0.25, 0.3)));
  fadeTail(out, sr, 0.3);
  return raw(out, sr);
}

function struck(
  midi: number,
  sr: number,
  seconds: number,
  parts: Partial[],
  atk: number,
  click: { amp: number; tau: number; cutoff: number; hp?: boolean } | null,
): Raw {
  const out = new Float32Array(Math.round(sr * seconds));
  addPartials(out, sr, parts);
  if (click) burst(out, sr, midi * 17 + 3, click.amp, click.tau, click.cutoff, click.hp);
  attack(out, sr, atk);
  normaliseRms(out, sr, 0.16, 0.15);
  fadeTail(out, sr, 0.1);
  return raw(out, sr);
}

function musicbox(midi: number): Raw {
  const f = hz(midi);
  const tau = clamp(2.2 * Math.pow(2, -(midi - 72) / 20), 0.7, 3.6);
  return struck(
    midi,
    24000,
    Math.min(4.5, tau * 4.5),
    [
      { f, a: 1, tau },
      { f: f * 1.0017, a: 0.2, tau: tau * 0.85, phase: 1.3 },
      { f: f * 2, a: 0.05, tau: tau * 0.35 },
      { f: f * 5.93, a: 0.09, tau: 0.16 },
      { f: f * 16.6, a: 0.02, tau: 0.03 },
    ],
    0.0006,
    { amp: 0.18, tau: 0.0012, cutoff: 6000, hp: true },
  );
}

function celesta(midi: number): Raw {
  const f = hz(midi);
  const tau = clamp(1.7 * Math.pow(2, -(midi - 72) / 22), 0.6, 3);
  return struck(
    midi,
    24000,
    Math.min(4, tau * 4.5),
    [
      { f, a: 1, tau },
      { f: f * 2, a: 0.07, tau: tau * 0.4 },
      { f: f * 2.76, a: 0.07, tau: 0.12 },
      { f: f * 5.4, a: 0.025, tau: 0.05 },
    ],
    0.0015,
    { amp: 0.08, tau: 0.003, cutoff: 2500 },
  );
}

function marimba(midi: number): Raw {
  const f = hz(midi);
  const tau = clamp(0.75 * Math.pow(2, -(midi - 60) / 20), 0.22, 1.4);
  return struck(
    midi,
    24000,
    Math.min(4, tau * 5 + 0.1),
    [
      { f, a: 1, tau },
      { f: f * 3.93, a: 0.2, tau: tau * 0.22 },
      { f: f * 9.2, a: 0.04, tau: 0.025 },
    ],
    0.0012,
    { amp: 0.22, tau: 0.004, cutoff: 1800 },
  );
}

function kalimba(midi: number): Raw {
  const f = hz(midi);
  const tau = clamp(1.3 * Math.pow(2, -(midi - 67) / 24), 0.5, 2.2);
  return struck(
    midi,
    24000,
    Math.min(4, tau * 4),
    [
      { f, a: 1, tau },
      { f: f * 2, a: 0.05, tau: tau * 0.5 },
      { f: f * 6.27, a: 0.12, tau: 0.06 },
      { f: f * 6.31, a: 0.05, tau: 0.09 },
    ],
    0.002,
    { amp: 0.12, tau: 0.008, cutoff: 1100 },
  );
}

function glass(midi: number): Raw {
  const f = hz(midi);
  const tau = clamp(3.2 * Math.pow(2, -(midi - 72) / 24), 1.2, 5);
  return struck(
    midi,
    16000,
    Math.min(5, tau * 3.5),
    [
      { f, a: 1, tau },
      { f: f * 1.0009, a: 0.3, tau, phase: 2 },
      { f: f * 2, a: 0.1, tau: tau * 0.5 },
      { f: f * 3, a: 0.035, tau: tau * 0.3 },
      { f: f * 4.16, a: 0.01, tau: 0.1 },
    ],
    0.018,
    null,
  );
}

/** Karplus-Strong string with a fractional-delay allpass for accurate tuning. */
function karplus(midi: number, bright: number, t60: number, seconds: number): Raw {
  const sr = 24000;
  const f0 = hz(midi);
  const period = sr / f0;
  let L = Math.floor(period - 0.5);
  let frac = period - 0.5 - L;
  if (frac < 0.15) {
    L -= 1;
    frac += 1;
  }
  const c = (1 - frac) / (1 + frac);
  const rho = Math.pow(10, -3 / (t60 * f0));
  const len = Math.round(sr * seconds);
  const out = new Float32Array(len);
  const r = rng(midi * 101 + Math.round(bright * 1000));
  const exc = new Float32Array(L);
  const k = 1 - Math.exp((-TAU * (500 + bright * 5000)) / sr);
  let lp = 0;
  for (let i = 0; i < L; i++) {
    lp += k * (r() * 2 - 1 - lp);
    exc[i] = lp;
  }
  const pos = Math.max(1, Math.round(L * 0.18));
  for (let i = L - 1; i >= pos; i--) exc[i] -= exc[i - pos];
  let apx = 0;
  let apy = 0;
  for (let n = 0; n < len; n++) {
    const a = n - L >= 0 ? out[n - L] : 0;
    const b = n - L - 1 >= 0 ? out[n - L - 1] : 0;
    const avg = 0.5 * (a + b) * rho;
    const ap = c * avg + apx - c * apy;
    apx = avg;
    apy = ap;
    out[n] = (n < L ? exc[n] : 0) + ap;
  }
  attack(out, sr, 0.0015);
  normaliseRms(out, sr, 0.16, 0.2);
  fadeTail(out, sr, 0.2);
  return raw(out, sr);
}

function pluck(midi: number): Raw {
  const t60 = clamp(3.2 * Math.pow(2, -(midi - 60) / 18), 0.8, 5);
  return karplus(midi, 0.25, t60, Math.min(3.5, t60 * 1.1));
}

function harp(midi: number): Raw {
  const t60 = clamp(5 * Math.pow(2, -(midi - 60) / 20), 1.5, 7);
  return karplus(midi, 0.5, t60, Math.min(5, t60 * 1.1));
}

function bell(midi: number): Raw {
  const sr = 22050;
  const f = hz(midi);
  const r = rng(midi * 53 + 1);
  const ratios = [0.5, 1, 1.183, 1.506, 2, 2.514, 2.662, 3.011, 4.166, 5.433];
  const amps = [0.35, 0.5, 0.45, 0.22, 0.7, 0.18, 0.14, 0.14, 0.07, 0.04];
  const taus = [9, 6, 4.5, 3.5, 3, 1.8, 1.6, 1.3, 0.8, 0.5];
  const parts: Partial[] = [];
  ratios.forEach((q, i) => {
    const beat = 1 + 0.0008 + r() * 0.0012;
    parts.push({ f: f * q, a: amps[i] * 0.6, tau: taus[i], phase: r() * TAU });
    parts.push({ f: f * q * beat, a: amps[i] * 0.4, tau: taus[i] * 0.9, phase: r() * TAU });
  });
  const out = new Float32Array(Math.round(sr * 11));
  addPartials(out, sr, parts);
  burst(out, sr, midi, 0.25, 0.006, 2500);
  attack(out, sr, 0.0015);
  normaliseRms(out, sr, 0.16, 0.5);
  fadeTail(out, sr, 0.5);
  return raw(out, sr);
}

const GENERATORS: Record<ToneId, (midi: number) => Raw> = {
  piano,
  musicbox,
  celesta,
  marimba,
  kalimba,
  glass,
  pluck,
  harp,
  bell,
};

interface Chirp {
  t: number;
  d: number;
  f0: number;
  f1: number;
  a: number;
  fmr?: number;
  fmd?: number;
  h2?: number;
}

function chirps(notes: Chirp[], seed: number): Raw {
  const sr = 32000;
  const end = notes.reduce((m, n) => Math.max(m, n.t + n.d), 0) + 0.05;
  const out = new Float32Array(Math.round(end * sr));
  const r = rng(seed);
  for (const n of notes) {
    const n0 = Math.round(n.t * sr);
    const N = Math.max(8, Math.round(n.d * sr));
    let phase = r() * TAU;
    for (let i = 0; i < N && n0 + i < out.length; i++) {
      const u = i / N;
      let f = n.f0 * Math.pow(n.f1 / n.f0, u);
      if (n.fmr) f *= 1 + (n.fmd ?? 0) * Math.sin((TAU * n.fmr * i) / sr);
      phase += (TAU * f) / sr;
      const env = Math.pow(Math.sin(Math.PI * Math.pow(u, 0.7)), 1.5);
      out[n0 + i] += n.a * env * (Math.sin(phase) + (n.h2 ?? 0.06) * Math.sin(2 * phase));
    }
  }
  normaliseRms(out, sr, 0.12, end);
  return raw(out, sr);
}

function bird(v: number): Raw {
  const r = rng(v * 977 + 5);
  const notes: Chirp[] = [];
  const species = v % 4;
  let t = 0;
  if (species === 0) {
    const n = 5 + Math.floor(r() * 6);
    const base = 3200 + r() * 1800;
    for (let k = 0; k < n; k++) {
      const d = 0.035 + r() * 0.05;
      const f0 = base * (1 - 0.035 * k) * (0.95 + r() * 0.1);
      notes.push({ t, d, f0, f1: f0 * (0.75 + r() * 0.5), a: 0.6 + r() * 0.4 });
      t += d + 0.02 + r() * 0.05;
    }
  } else if (species === 1) {
    const n = 2 + Math.floor(r() * 3);
    const base = 1900 + r() * 1200;
    for (let k = 0; k < n; k++) {
      const d = 0.12 + r() * 0.2;
      const f0 = base * (0.85 + r() * 0.35);
      notes.push({ t, d, f0, f1: f0 * (0.8 + r() * 0.45), a: 0.7 + r() * 0.3, fmr: 22 + r() * 10, fmd: 0.012, h2: 0.12 });
      t += d + 0.06 + r() * 0.1;
    }
  } else if (species === 2) {
    const n = 2 + Math.floor(r() * 3);
    for (let k = 0; k < n; k++) {
      const d = 0.018 + r() * 0.012;
      const f0 = 6000 + r() * 1500;
      notes.push({ t, d, f0, f1: f0 * 0.7, a: 0.8 });
      t += d + 0.08 + r() * 0.12;
    }
  } else {
    const rate = 14 + r() * 6;
    const n = Math.round((0.6 + r() * 0.5) * rate);
    const f0 = 3800 + r() * 900;
    for (let k = 0; k < n; k++) {
      notes.push({ t, d: 0.035, f0: f0 * (1 - 0.004 * k), f1: f0 * 1.15, a: 0.5 + 0.5 * Math.sin((Math.PI * k) / n) });
      t += 1 / rate;
    }
  }
  return chirps(notes, v);
}

function robin(v: number): Raw {
  const r = rng(v * 431 + 9);
  const notes: Chirp[] = [];
  let t = 0;
  const n = 6 + Math.floor(r() * 7);
  for (let k = 0; k < n; k++) {
    const kind = r();
    if (kind < 0.4) {
      const d = 0.03 + r() * 0.05;
      const f0 = 5000 + r() * 3000;
      notes.push({ t, d, f0, f1: f0 * (r() < 0.5 ? 0.8 : 1.2), a: 0.5 + r() * 0.4 });
      t += d + 0.03 + r() * 0.06;
    } else if (kind < 0.8) {
      const d = 0.1 + r() * 0.12;
      const f0 = 2800 + r() * 1800;
      notes.push({ t, d, f0, f1: f0 * (0.85 + r() * 0.3), a: 0.6 + r() * 0.4, fmr: 30 + r() * 30, fmd: 0.04 + r() * 0.04 });
      t += d + 0.05 + r() * 0.08;
    } else {
      const f0 = 5500 + r() * 1500;
      for (let j = 0; j < 5; j++) {
        notes.push({ t, d: 0.022, f0, f1: f0 * 0.85, a: 0.45 });
        t += 0.035;
      }
      t += 0.06;
    }
  }
  return chirps(notes, v + 100);
}

function swallow(v: number): Raw {
  const r = rng(v * 613 + 2);
  const notes: Chirp[] = [];
  let t = 0;
  const n = 10 + Math.floor(r() * 12);
  for (let k = 0; k < n; k++) {
    if (r() < 0.12) {
      const d = 0.12 + r() * 0.06;
      const f0 = 3600 + r() * 800;
      notes.push({ t, d, f0, f1: f0 * 1.05, a: 0.4, fmr: 80 + r() * 30, fmd: 0.1 });
      t += d + 0.04;
    } else {
      const d = 0.02 + r() * 0.03;
      const f0 = 3000 + r() * 2500;
      notes.push({ t, d, f0, f1: f0 * (r() < 0.6 ? 1.3 : 0.8), a: 0.5 + r() * 0.5 });
      t += d + 0.02 + r() * 0.07;
    }
  }
  return chirps(notes, v + 200);
}

function hammer(v: number): Raw {
  const sr = 22050;
  const r = rng(v * 71 + 4);
  const out = new Float32Array(Math.round(sr * 0.4));
  addPartials(out, sr, [
    { f: 380 + r() * 80, a: 0.5, tau: 0.045 },
    { f: 1150 + r() * 200, a: 0.45, tau: 0.03 },
    { f: 2600 + r() * 300, a: 0.25, tau: 0.015 },
    { f: 4100 + r() * 300, a: 0.1, tau: 0.008 },
  ]);
  burst(out, sr, v + 40, 0.6, 0.002, 4000);
  attack(out, sr, 0.0003);
  normaliseRms(out, sr, 0.16, 0.08);
  fadeTail(out, sr, 0.05);
  return raw(out, sr);
}

function thunder(v: number): Raw {
  const sr = 11025;
  const r = rng(v * 991 + 17);
  const len = Math.round(sr * 7);
  const out = new Float32Array(len);
  const rolls: { t: number; atk: number; dec: number; a: number }[] = [];
  let t = 0.1;
  const count = 3 + Math.floor(r() * 4);
  for (let k = 0; k < count; k++) {
    rolls.push({ t, atk: 0.15 + r() * 0.35, dec: 0.6 + r() * 1.0, a: (0.4 + r() * 0.6) * (k === 0 ? 1 : 0.8) });
    t += 0.3 + r() * 1.1;
  }
  let b = 0;
  let l1 = 0;
  let l2 = 0;
  const k1 = 1 - Math.exp((-TAU * 220) / sr);
  for (let i = 0; i < len; i++) {
    b = (b + 0.02 * (r() * 2 - 1)) / 1.02;
    const time = i / sr;
    let env = 0;
    for (const roll of rolls) {
      const u = time - roll.t;
      if (u < 0) continue;
      env += roll.a * (u < roll.atk ? u / roll.atk : Math.exp(-(u - roll.atk) / roll.dec));
    }
    l1 += k1 * (b * env - l1);
    l2 += k1 * (l1 - l2);
    out[i] = l2;
  }
  normaliseRms(out, sr, 0.16, 7);
  fadeTail(out, sr, 0.5);
  return raw(out, sr);
}

const AMB_GENERATORS: Record<AmbToneId, (v: number) => Raw> = { bird, swallow, robin, hammer, thunder };

const LOOP_SR = 22050;

/** Noise of `len` samples whose end flows seamlessly into its start. */
function seamless(len: number, fade: number, gen: (n: number) => Float32Array): Float32Array<ArrayBuffer> {
  const raw = gen(len + fade);
  const out = raw.slice(0, len);
  for (let i = 0; i < fade; i++) {
    const w = i / fade;
    out[i] = raw[i] * Math.sqrt(w) + raw[len + i] * Math.sqrt(1 - w);
  }
  return out;
}

function pinkNoise(seed: number): (n: number) => Float32Array {
  return (n) => {
    const r = rng(seed);
    const out = new Float32Array(n);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < n; i++) {
      const w = r() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      out[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return out;
  };
}

function brownNoise(seed: number): (n: number) => Float32Array {
  return (n) => {
    const r = rng(seed);
    const out = new Float32Array(n);
    let b = 0;
    for (let i = 0; i < n; i++) {
      b = (b + 0.02 * (r() * 2 - 1)) / 1.02;
      out[i] = b * 3.5;
    }
    let mean = 0;
    for (let i = 0; i < n; i++) mean += out[i];
    mean /= n;
    for (let i = 0; i < n; i++) out[i] -= mean;
    return out;
  };
}

function stereo(left: Float32Array, right: Float32Array): Float32Array<ArrayBuffer> {
  const out = new Float32Array(left.length * 2);
  out.set(left, 0);
  out.set(right, left.length);
  return out;
}

function water(seconds: number, seed: number): Raw {
  const sr = LOOP_SR;
  const len = Math.round(seconds * sr);
  const chan = (s: number) => {
    const bed = seamless(len, 4000, brownNoise(s));
    const hiss = seamless(len, 4000, pinkNoise(s + 1));
    const out = new Float32Array(len);
    for (let i = 0; i < len; i++) out[i] = bed[i] * 0.3 + hiss[i] * 0.05;
    const r = rng(s + 2);
    const count = Math.round(seconds * 110);
    for (let b = 0; b < count; b++) {
      const start = Math.floor(r() * len);
      const f0 = Math.exp(Math.log(280) + r() * Math.log(1700 / 280));
      const d = clamp(9 / f0, 0.004, 0.03);
      const n = Math.round(d * sr);
      const amp = 0.04 + r() * r() * 0.22;
      let phase = 0;
      for (let i = 0; i < n; i++) {
        const u = i / n;
        phase += (TAU * f0 * (1 + 0.9 * u)) / sr;
        const env = Math.min(1, i / (0.0006 * sr)) * Math.exp(-u * 3.2);
        out[(start + i) % len] += Math.sin(phase) * env * amp;
      }
    }
    return out;
  };
  const l = chan(seed);
  const rr = chan(seed + 50);
  normaliseRms(l, sr, 0.1, seconds);
  normaliseRms(rr, sr, 0.1, seconds);
  return raw(stereo(l, rr), sr, 2);
}

function rain(seconds: number, seed: number): Raw {
  const sr = LOOP_SR;
  const len = Math.round(seconds * sr);
  const chan = (s: number) => {
    const out = new Float32Array(len);
    const r = rng(s);
    const hiss = seamless(len, 3000, (n) => {
      const h = new Float32Array(n);
      const rr = rng(s + 7);
      let prev = 0;
      for (let i = 0; i < n; i++) {
        const w = rr() * 2 - 1;
        h[i] = (w - prev) * 0.5;
        prev = w;
      }
      return h;
    });
    for (let i = 0; i < len; i++) out[i] = hiss[i] * 0.05;
    const count = Math.round(seconds * 260);
    for (let k = 0; k < count; k++) {
      const start = Math.floor(r() * len);
      const amp = Math.pow(r(), 3) * 0.6 + 0.02;
      const f = 2200 + r() * 5000;
      const tau = 0.002 + r() * 0.004;
      const n = Math.round(tau * sr * 6);
      const w = (TAU * f) / sr;
      for (let i = 0; i < n; i++) {
        const e = Math.exp(-i / (tau * sr));
        const click = i < 30 ? (r() * 2 - 1) * Math.exp(-i / 6) : 0;
        out[(start + i) % len] += amp * e * (Math.sin(w * i) * 0.7 + click);
      }
    }
    return out;
  };
  const l = chan(seed);
  const rr = chan(seed + 13);
  normaliseRms(l, sr, 0.1, seconds);
  normaliseRms(rr, sr, 0.1, seconds);
  return raw(stereo(l, rr), sr, 2);
}

function noiseLoop(kind: 'pink' | 'brown', seconds: number, seed: number): Raw {
  const sr = LOOP_SR;
  const len = Math.round(seconds * sr);
  const gen = kind === 'pink' ? pinkNoise : brownNoise;
  const l = seamless(len, 4000, gen(seed));
  const rr = seamless(len, 4000, gen(seed + 1));
  normaliseRms(l, sr, 0.1, seconds);
  normaliseRms(rr, sr, 0.1, seconds);
  return raw(stereo(l, rr), sr, 2);
}

const LOOPS: Record<LoopId, () => Raw> = {
  waterA: () => water(5.3, 11),
  waterB: () => water(7.7, 23),
  rainA: () => rain(4.1, 31),
  rainB: () => rain(5.9, 37),
  pink: () => noiseLoop('pink', 4.3, 41),
  brown: () => noiseLoop('brown', 6.1, 43),
};
