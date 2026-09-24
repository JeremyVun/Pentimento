import type { AmbEv, BedSpec, Bus, InstId, Mix, NoteEv, PadEv, PadId } from './compose';
import { ambBuffer, loopBuffer, toneBuffer, type AmbToneId, type LoopId } from './tones';
import { clamp, hz, rng } from './theory';

export type Outs = Record<Bus, AudioNode>;

export interface Voice {
  start: number;
  end: number;
  kill: GainNode;
  srcs: AudioScheduledSourceNode[];
  nodes: AudioNode[];
  owner: unknown;
  done: boolean;
  killed: boolean;
}

export const VOICE_CAP = 56;

interface TonePatch {
  level: number;
  cutoff: number;
  attack: number;
  release: number;
  damped: boolean;
  bus: Bus;
  detune: number;
}

const TONES: Record<Exclude<InstId, 'bass'>, TonePatch> = {
  piano: { level: 0.95, cutoff: 5200, attack: 0.012, release: 0.35, damped: true, bus: 'dry', detune: 5 },
  musicbox: { level: 0.5, cutoff: 9000, attack: 0.001, release: 0.3, damped: false, bus: 'dry', detune: 7 },
  celesta: { level: 0.55, cutoff: 7000, attack: 0.002, release: 0.3, damped: false, bus: 'dry', detune: 4 },
  marimba: { level: 0.75, cutoff: 6000, attack: 0.001, release: 0.2, damped: false, bus: 'dry', detune: 3 },
  kalimba: { level: 0.7, cutoff: 6000, attack: 0.002, release: 0.2, damped: false, bus: 'dry', detune: 5 },
  glass: { level: 0.5, cutoff: 7000, attack: 0.02, release: 0.8, damped: false, bus: 'wet', detune: 3 },
  pluck: { level: 0.7, cutoff: 4200, attack: 0.002, release: 0.25, damped: true, bus: 'dry', detune: 4 },
  harp: { level: 0.62, cutoff: 7000, attack: 0.002, release: 0.4, damped: false, bus: 'wet', detune: 3 },
  bell: { level: 0.7, cutoff: 2600, attack: 0.002, release: 1, damped: false, bus: 'far', detune: 0 },
};

interface PadPatch {
  type: OscillatorType;
  detune: number;
  cutoff: number;
  q: number;
  attack: number;
  release: number;
  level: number;
  octave: number;
  vibrato: number;
  swell: boolean;
}

const PADS: Record<PadId, PadPatch> = {
  pad: { type: 'sawtooth', detune: 7, cutoff: 950, q: 0.5, attack: 1.2, release: 2.5, level: 0.05, octave: 0, vibrato: 0, swell: false },
  lowpad: { type: 'triangle', detune: 5, cutoff: 650, q: 0.4, attack: 1.5, release: 3, level: 0.075, octave: 0, vibrato: 0, swell: false },
  horn: { type: 'sawtooth', detune: 4, cutoff: 1000, q: 1.4, attack: 0.5, release: 1.4, level: 0.05, octave: 0, vibrato: 5, swell: true },
  shimmer: { type: 'sine', detune: 9, cutoff: 6000, q: 0.3, attack: 2, release: 3.5, level: 0.035, octave: 1, vibrato: 0, swell: false },
};

interface AmbPatch {
  level: number;
  bus: Bus;
  cutoff?: number;
}

const AMBS: Record<AmbToneId, AmbPatch> = {
  bird: { level: 0.3, bus: 'far' },
  swallow: { level: 0.26, bus: 'far' },
  robin: { level: 0.34, bus: 'far' },
  hammer: { level: 0.6, bus: 'far', cutoff: 2600 },
  thunder: { level: 1, bus: 'amb' },
};

/** Level into the master compressor; the voices are balanced well below full scale. */
const MASTER_GAIN = 3;
/** Ambience sits under the music; per-score levels are relative to this. */
const AMB_TRIM = 0.4;
/** The continuous beds (river, wind, rain, snow) sit further down than single calls like birds or the bell. */
const BED_TRIM = 0.35;

function compressor(c: BaseAudioContext, threshold: number, ratio: number, attack: number, release: number): DynamicsCompressorNode {
  const n = c.createDynamicsCompressor();
  n.threshold.value = threshold;
  n.knee.value = 0;
  n.ratio.value = ratio;
  n.attack.value = attack;
  n.release.value = release;
  return n;
}

/**
 * Web Audio compressors add automatic makeup gain of (1 / gain at 0 dBFS) ^ 0.6.
 * This undoes it (exact for a hard knee) so the thresholds mean what they say.
 */
function unMakeup(threshold: number, ratio: number): number {
  const gainAtFullScaleDb = threshold * (1 - 1 / ratio);
  return Math.pow(10, (0.6 * gainAtFullScaleDb) / 20);
}

function softClipCurve(): Float32Array<ArrayBuffer> {
  const n = 4097;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const a = Math.abs(x);
    const y = a <= 0.8 ? a : 0.8 + 0.089 * Math.tanh((a - 0.8) / 0.089);
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

/** Stereo decaying-noise room: early taps, then a tail that darkens as it fades. */
function impulse(ctx: BaseAudioContext, seconds = 4.2, rt60 = 3.1): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.round(sr * seconds);
  const buf = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    const r = rng(ch * 7 + 101);
    const pre = Math.round(0.014 * sr);
    let lp = 0;
    let lp2 = 0;
    for (let i = pre; i < len; i++) {
      const t = (i - pre) / sr;
      const cutoff = 7000 * Math.exp(-t / 0.7) + 1200;
      const k = 1 - Math.exp((-2 * Math.PI * cutoff) / sr);
      lp += k * (r() * 2 - 1 - lp);
      lp2 += k * (lp - lp2);
      const fadeIn = Math.min(1, t / 0.02);
      d[i] = lp2 * Math.exp((-6.91 * t) / rt60) * fadeIn;
    }
    for (let k = 0; k < 10; k++) {
      const at = Math.round((0.006 + r() * 0.06) * sr);
      d[at] += (r() < 0.5 ? -1 : 1) * (0.5 - k * 0.035) * 0.3;
    }
    let sum = 0;
    for (let i = 0; i < len; i++) sum += d[i] * d[i];
    const g = 1 / Math.sqrt(sum);
    for (let i = 0; i < len; i++) d[i] *= g;
  }
  return buf;
}

export class Synth {
  readonly rand = rng(20260924);
  /** Most voices ever sounding at once, and how many were stolen to stay under the cap. */
  peakVoices = 0;
  stolen = 0;
  readonly outs: Outs;
  readonly bristle: GainNode;
  private readonly voices: Voice[] = [];
  private readonly ins: Record<Bus, GainNode>;
  private readonly sends: Record<Bus, GainNode>;
  private readonly ducks: GainNode[] = [];
  private readonly mute: GainNode;

  constructor(readonly ctx: BaseAudioContext, opts: { stems?: boolean } = {}) {
    const c = ctx;
    const gain = (v: number) => {
      const g = c.createGain();
      g.gain.value = v;
      return g;
    };
    const masterSum = gain(MASTER_GAIN);
    const comp = compressor(c, -18, 2, 0.03, 0.35);
    const lim = compressor(c, -4, 20, 0.001, 0.1);
    const clip = c.createWaveShaper();
    clip.curve = softClipCurve();
    this.mute = gain(1);
    const rumble = c.createBiquadFilter();
    rumble.type = 'highpass';
    rumble.frequency.value = 32;
    masterSum.connect(rumble).connect(comp).connect(gain(unMakeup(-18, 2))).connect(lim).connect(gain(unMakeup(-4, 20))).connect(clip).connect(this.mute);

    const reverb = c.createConvolver();
    reverb.normalize = false;
    reverb.buffer = impulse(c);
    reverb.connect(masterSum);

    const wow = c.createOscillator();
    wow.frequency.value = 0.43;
    const wowDepth = gain(0.0006);
    wow.connect(wowDepth);
    const flutter = c.createOscillator();
    flutter.frequency.value = 5.3;
    const flutterDepth = gain(0.00004);
    flutter.connect(flutterDepth);

    const musicTap = opts.stems ? gain(1) : null;
    const ins = {} as Record<Bus, GainNode>;
    const sends = {} as Record<Bus, GainNode>;
    for (const bus of ['dry', 'wet'] as const) {
      const input = gain(1);
      const delay = c.createDelay(0.05);
      delay.delayTime.value = 0.012;
      wowDepth.connect(delay.delayTime);
      flutterDepth.connect(delay.delayTime);
      const duck = gain(1);
      const tone = c.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 8500;
      tone.Q.value = 0.5;
      const level = gain(bus === 'dry' ? 1 : 0.75);
      const send = gain(0.2);
      input.connect(delay).connect(duck).connect(tone).connect(level).connect(masterSum);
      duck.connect(send).connect(reverb);
      if (musicTap) level.connect(musicTap);
      this.ducks.push(duck);
      ins[bus] = input;
      sends[bus] = send;
    }
    const ambIn = gain(1);
    const ambSend = gain(0.12);
    ambIn.connect(masterSum);
    ambIn.connect(ambSend).connect(reverb);
    const farIn = gain(1);
    const farTone = c.createBiquadFilter();
    farTone.type = 'lowpass';
    farTone.frequency.value = 6500;
    const farLevel = gain(0.6);
    const farSend = gain(0.5);
    farIn.connect(farTone).connect(farLevel).connect(masterSum);
    farTone.connect(farSend).connect(reverb);
    ins.amb = ambIn;
    ins.far = farIn;
    sends.amb = ambSend;
    sends.far = farSend;
    this.ins = ins;
    this.sends = sends;
    this.outs = ins;
    this.bristle = gain(1);
    this.bristle.connect(masterSum);

    if (musicTap) {
      c.destination.channelCount = 4;
      c.destination.channelInterpretation = 'discrete';
      const merger = c.createChannelMerger(4);
      const splitMix = c.createChannelSplitter(2);
      const splitMusic = c.createChannelSplitter(2);
      this.mute.connect(splitMix);
      musicTap.connect(splitMusic);
      splitMix.connect(merger, 0, 0);
      splitMix.connect(merger, 1, 1);
      splitMusic.connect(merger, 0, 2);
      splitMusic.connect(merger, 1, 3);
      merger.connect(c.destination);
    } else {
      this.mute.connect(c.destination);
    }
    wow.start();
    flutter.start();
  }

  gain(v: number): GainNode {
    const g = this.ctx.createGain();
    g.gain.value = v;
    return g;
  }

  /** Per-owner outputs feeding the shared buses, so a score can fade as a unit. */
  makeOuts(level: number): { outs: Outs; gains: GainNode[] } {
    const gains: GainNode[] = [];
    const outs = {} as Outs;
    for (const bus of ['dry', 'wet', 'amb', 'far'] as const) {
      const g = this.gain(level);
      g.connect(this.ins[bus]);
      gains.push(g);
      outs[bus] = g;
    }
    return { outs, gains };
  }

  setMix(m: Mix, at: number, over: number): void {
    const ramp = (p: AudioParam, v: number) => {
      p.cancelScheduledValues(at);
      p.setValueAtTime(p.value, at);
      p.linearRampToValueAtTime(v, at + over);
    };
    ramp(this.ins.dry.gain, m.music);
    ramp(this.ins.wet.gain, m.music);
    ramp(this.ins.amb.gain, m.amb * AMB_TRIM);
    ramp(this.ins.far.gain, m.amb * AMB_TRIM);
    ramp(this.sends.dry.gain, m.dryVerb);
    ramp(this.sends.wet.gain, m.wetVerb);
  }

  duck(on: boolean, at: number): void {
    for (const d of this.ducks) {
      d.gain.cancelScheduledValues(at);
      d.gain.setTargetAtTime(on ? 0.708 : 1, at, 0.15);
    }
  }

  setMuted(muted: boolean, at: number): void {
    const g = this.mute.gain;
    g.cancelScheduledValues(at);
    g.setValueAtTime(g.value, at);
    g.linearRampToValueAtTime(muted ? 0 : 1, at + 0.3);
  }

  private made = 0;
  private freed = 0;

  /** Voices whose nodes are still connected. */
  get voiceCount(): number {
    return this.made - this.freed;
  }

  private register(v: Voice): void {
    const cutoff = v.start - 0.5;
    for (let i = this.voices.length - 1; i >= 0; i--) {
      const o = this.voices[i];
      if (o.done || o.end < cutoff) this.voices.splice(i, 1);
    }
    const active = this.voices.filter((o) => !o.killed && o.end > v.start);
    this.peakVoices = Math.max(this.peakVoices, Math.min(VOICE_CAP, active.length + 1));
    if (active.length >= VOICE_CAP) {
      let oldest = active[0];
      for (const o of active) if (o.start < oldest.start) oldest = o;
      this.fade(oldest, v.start, 0.05);
      this.stolen++;
    }
    this.voices.push(v);
    this.made++;
    v.srcs[0].onended = () => {
      if (v.done) return;
      v.done = true;
      this.freed++;
      for (const n of v.nodes) n.disconnect();
    };
  }

  private fade(v: Voice, at: number, over: number): void {
    if (v.killed) return;
    v.killed = true;
    const from = Math.max(at, v.start);
    v.kill.gain.setValueAtTime(1, from);
    v.kill.gain.linearRampToValueAtTime(0, from + over);
    const stop = from + over + 0.02;
    for (const s of v.srcs) s.stop(stop);
    v.end = Math.min(v.end, stop);
  }

  /** Fades every voice of `owner` still sounding after `at`. */
  release(owner: unknown, at: number, over: number): void {
    for (const v of this.voices) if (v.owner === owner && !v.done && v.end > at) this.fade(v, at, over);
  }

  note(ev: NoteEv, when: number, outs: Outs, owner: unknown): void {
    if (ev.inst === 'bass') return this.bass(ev, when, outs, owner);
    const c = this.ctx;
    const p = TONES[ev.inst];
    const buf = toneBuffer(ev.inst, ev.midi);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.detune.value = (this.rand() - 0.5) * p.detune;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = 0.3;
    lp.frequency.value = clamp(p.cutoff * (0.4 + 0.8 * ev.vel) * (ev.bright ?? 1), 300, 16000);
    const g = c.createGain();
    const amp = p.level * Math.pow(clamp(ev.vel, 0, 1), 1.6);
    const atk = Math.max(ev.attack ?? p.attack, 0.001);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(amp, when + atk);
    let stop = when + buf.duration;
    if (p.damped) {
      const off = when + Math.max(ev.dur, atk + 0.05);
      if (off < stop) {
        g.gain.setTargetAtTime(0, off, p.release / 3);
        stop = Math.min(stop, off + p.release * 2);
      }
    }
    const kill = this.gain(1);
    const pan = c.createStereoPanner();
    pan.pan.value = clamp(ev.pan, -1, 1);
    src.connect(lp).connect(g).connect(kill).connect(pan).connect(outs[ev.bus ?? p.bus]);
    src.start(when);
    src.stop(stop);
    this.register({ start: when, end: stop, kill, srcs: [src], nodes: [src, lp, g, kill, pan], owner, done: false, killed: false });
  }

  private bass(ev: NoteEv, when: number, outs: Outs, owner: unknown): void {
    const c = this.ctx;
    const f = hz(ev.midi);
    const g = c.createGain();
    const kill = this.gain(1);
    const amp = 0.13 * Math.pow(clamp(ev.vel, 0, 1), 1.4);
    const release = 0.3;
    const off = when + Math.max(0.08, ev.dur);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(amp, when + 0.025);
    g.gain.setTargetAtTime(amp * 0.75, when + 0.03, 0.25);
    g.gain.setTargetAtTime(0, off, release / 3);
    const stop = off + release * 2;
    const srcs: OscillatorNode[] = [];
    const nodes: AudioNode[] = [g, kill];
    [
      [1, 1],
      [2, 0.22],
      [3, 0.05],
    ].forEach(([mult, level]) => {
      const o = c.createOscillator();
      o.frequency.value = f * mult;
      const lg = this.gain(level);
      o.connect(lg).connect(g);
      o.start(when);
      o.stop(stop);
      srcs.push(o);
      nodes.push(o, lg);
    });
    g.connect(kill).connect(outs[ev.bus ?? 'dry']);
    this.register({ start: when, end: stop, kill, srcs, nodes, owner, done: false, killed: false });
  }

  pad(ev: PadEv, when: number, outs: Outs, owner: unknown): void {
    const c = this.ctx;
    const p = PADS[ev.inst];
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.Q.value = p.q;
    const cut = clamp(p.cutoff * (ev.bright ?? 1), 150, 12000);
    const atk = ev.attack ?? p.attack;
    const rel = ev.release ?? p.release;
    if (p.swell) {
      lp.frequency.setValueAtTime(cut * 0.3, when);
      lp.frequency.exponentialRampToValueAtTime(cut, when + atk * 1.3);
      lp.frequency.setTargetAtTime(cut * 0.8, when + atk * 1.3, 1);
    } else {
      lp.frequency.setValueAtTime(cut * 0.7, when);
      lp.frequency.linearRampToValueAtTime(cut, when + atk);
    }
    const g = c.createGain();
    const amp = (p.level * Math.pow(clamp(ev.vel, 0, 1), 1.2)) / Math.sqrt(Math.max(1, ev.midis.length) / 3);
    const end = when + Math.max(ev.dur, atk);
    g.gain.setValueAtTime(0, when);
    g.gain.linearRampToValueAtTime(amp, when + atk);
    g.gain.setValueAtTime(amp, end);
    g.gain.setTargetAtTime(0, end, rel / 4);
    const stop = end + rel * 1.3;
    const kill = this.gain(1);
    const pan = c.createStereoPanner();
    pan.pan.value = clamp(ev.pan, -1, 1);
    lp.connect(g).connect(kill).connect(pan).connect(outs[ev.bus ?? 'dry']);
    const srcs: OscillatorNode[] = [];
    const nodes: AudioNode[] = [lp, g, kill, pan];
    let vib: GainNode | null = null;
    if (p.vibrato) {
      const lfo = c.createOscillator();
      lfo.frequency.value = 4.6 + this.rand() * 0.6;
      vib = this.gain(p.vibrato);
      lfo.connect(vib);
      lfo.start(when);
      lfo.stop(stop);
      srcs.push(lfo);
      nodes.push(lfo, vib);
    }
    for (const m of ev.midis) {
      for (const side of [-1, 1]) {
        const o = c.createOscillator();
        o.type = p.type;
        o.frequency.value = hz(m + 12 * p.octave);
        o.detune.value = side * p.detune + (this.rand() - 0.5) * 3;
        if (vib) vib.connect(o.detune);
        o.connect(lp);
        o.start(when);
        o.stop(stop);
        srcs.push(o);
        nodes.push(o);
      }
    }
    this.register({ start: when, end: stop, kill, srcs, nodes, owner, done: false, killed: false });
  }

  amb(ev: AmbEv, when: number, outs: Outs, owner: unknown): void {
    const c = this.ctx;
    const p = AMBS[ev.sound];
    const buf = ambBuffer(ev.sound, ev.variant);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = ev.sound === 'thunder' ? 0.9 + this.rand() * 0.2 : 0.94 + this.rand() * 0.12;
    const g = this.gain(p.level * ev.vel);
    const kill = this.gain(1);
    const pan = c.createStereoPanner();
    pan.pan.setValueAtTime(clamp(ev.pan, -1, 1), when);
    const dur = buf.duration / src.playbackRate.value;
    if (ev.sweep) pan.pan.linearRampToValueAtTime(clamp(ev.pan + ev.sweep, -1, 1), when + dur);
    const nodes: AudioNode[] = [src, g, kill, pan];
    let head: AudioNode = src;
    if (p.cutoff) {
      const lp = c.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = p.cutoff;
      src.connect(lp);
      head = lp;
      nodes.push(lp);
    }
    head.connect(g).connect(kill).connect(pan).connect(outs[p.bus]);
    src.start(when);
    const stop = when + dur + 0.05;
    src.stop(stop);
    this.register({ start: when, end: stop, kill, srcs: [src], nodes, owner, done: false, killed: false });
  }
}

/** The continuous ambience under a score: river, wind, rain, snow. */
export class Bed {
  private readonly srcs: AudioScheduledSourceNode[] = [];
  private readonly nodes: AudioNode[] = [];
  private stopped = false;

  constructor(s: Synth, spec: BedSpec, when: number, out: AudioNode) {
    const c = s.ctx;
    const r = rng(Math.round(when * 1000) + 5);
    const loop = (id: LoopId, rate = 1) => {
      const src = c.createBufferSource();
      src.buffer = loopBuffer(id);
      src.loop = true;
      src.playbackRate.value = rate;
      src.start(when, r() * src.buffer.duration);
      this.srcs.push(src);
      this.nodes.push(src);
      return src;
    };
    const node = <T extends AudioNode>(n: T) => {
      this.nodes.push(n);
      return n;
    };
    const filter = (type: BiquadFilterType, f: number, q = 0.7) => {
      const b = node(c.createBiquadFilter());
      b.type = type;
      b.frequency.value = f;
      b.Q.value = q;
      return b;
    };
    const gain = (v: number) => node(s.gain(v));
    const trim = gain(BED_TRIM);
    trim.connect(out);
    const lfo = (freq: number, depth: number, target: AudioParam) => {
      const o = c.createOscillator();
      o.frequency.value = freq;
      o.start(when);
      this.srcs.push(o);
      this.nodes.push(o);
      o.connect(gain(depth)).connect(target);
    };
    const panner = (v: number) => {
      const p = node(c.createStereoPanner());
      p.pan.value = v;
      return p;
    };

    const w = spec.water;
    const wLP = filter('lowpass', w.cutoff, 0.3);
    const wGain = gain(w.level);
    loop('waterA').connect(panner(-0.35)).connect(wLP);
    loop('waterB', 0.93).connect(panner(0.35)).connect(wLP);
    wLP.connect(wGain).connect(trim);
    lfo(0.06, w.level * 0.18, wGain.gain);
    if (w.roar) {
      const rLP = filter('lowpass', 700, 0.4);
      const rGain = gain(w.roar);
      loop('brown').connect(rLP).connect(rGain).connect(trim);
      lfo(0.045, w.roar * 0.3, rGain.gain);
      const rush = filter('bandpass', 900, 0.5);
      loop('pink', 0.8).connect(rush).connect(gain(w.roar * 0.6)).connect(trim);
    }
    if (spec.wind) {
      const bp = filter('bandpass', 520, 1.4);
      const wg = gain(spec.wind);
      const wp = panner(0);
      loop('pink', 1.1).connect(bp).connect(wg).connect(wp).connect(trim);
      lfo(0.061, 260, bp.frequency);
      lfo(0.17, 110, bp.frequency);
      lfo(0.083, spec.wind * 0.55, wg.gain);
      lfo(0.029, 0.5, wp.pan);
    }
    if (spec.rain) {
      const { level, heavy, ease } = spec.rain;
      const hp = filter('highpass', 350, 0.5);
      const rg = gain(level);
      loop('rainA').connect(panner(-0.3)).connect(hp);
      loop('rainB', 1.07).connect(panner(0.3)).connect(hp);
      hp.connect(rg).connect(trim);
      if (ease) {
        rg.gain.setValueAtTime(level, when + ease.at);
        rg.gain.linearRampToValueAtTime(level * ease.to, when + ease.at + ease.over);
      }
      if (heavy) {
        loop('pink', 0.9).connect(filter('bandpass', 1800, 0.4)).connect(gain(level * 1.1)).connect(trim);
        loop('brown', 1.2).connect(filter('lowpass', 260, 0.5)).connect(gain(level * 0.7)).connect(trim);
      }
    }
    if (spec.snow) {
      const sg = gain(spec.snow);
      loop('pink', 0.7).connect(filter('lowpass', 900, 0.5)).connect(filter('highpass', 180, 0.5)).connect(sg).connect(trim);
      lfo(0.05, spec.snow * 0.3, sg.gain);
    }
  }

  stop(at: number): void {
    if (this.stopped) return;
    this.stopped = true;
    for (const src of this.srcs) src.stop(at);
    const first = this.srcs[0];
    first.onended = () => {
      for (const n of this.nodes) n.disconnect();
    };
  }
}
