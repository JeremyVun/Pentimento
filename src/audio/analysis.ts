import type { ScoreId } from './index';
import type { BrushNote } from './brush';
import { chordAt, MOTIF_STEPS, schedule, type NoteEv } from './compose';
import { compose } from './scores';
import { inScale, pc } from './theory';

export interface MotifStatement {
  t: number;
  inst: string;
  indices: number[];
  ok: boolean;
}

export interface ScoreCheck {
  id: ScoreId;
  bpm: number;
  bars: number;
  end: number;
  notes: number;
  offKey: string[];
  offGrid: string[];
  motifs: MotifStatement[];
}

/** Checks a composed score: every pitch in its chord or scale, every onset on a 32nd grid, and the window theme's shape. */
export function checkScore(id: ScoreId, durationSec?: number): ScoreCheck {
  const c = compose(id, durationSec);
  const horizon = c.loop ? c.loop : c.end + 12;
  const evs = schedule(c, 0, horizon);
  const offKey: string[] = [];
  const offGrid: string[] = [];
  let notes = 0;
  const q = c.beat / 8;
  const motifNotes: NoteEv[] = [];
  for (const ev of evs) {
    if (ev.kind === 'amb') continue;
    const onGrid = Math.abs(ev.t / q - Math.round(ev.t / q)) * q < 0.002;
    if (!onGrid) offGrid.push(`${ev.t.toFixed(3)}s ${ev.inst}`);
    if (ev.kind === 'note' && ev.inst === 'bell') continue;
    const span = chordAt(c, ev.t);
    const midis = ev.kind === 'note' ? [ev.midi] : ev.midis;
    for (const m of midis) {
      notes++;
      if (!inScale(span.key, m) && !span.chord.pcs.includes(pc(m))) offKey.push(`${ev.t.toFixed(2)}s ${m} over ${span.chord.name}`);
    }
    if (ev.kind === 'note' && ev.motif !== undefined) motifNotes.push(ev);
  }

  const motifs: MotifStatement[] = [];
  const open = new Map<string, { st: MotifStatement; last: NoteEv }>();
  for (const n of motifNotes) {
    const voiceKey = `${n.inst}:${(n.deg ?? 0) - MOTIF_STEPS[n.motif!]}`;
    const prev = open.get(voiceKey);
    const i = n.motif!;
    if (prev && i > prev.last.motif! && n.t - prev.last.t < 3 * c.bar) {
      const j = prev.last.motif!;
      const dDeg = MOTIF_STEPS[i] - MOTIF_STEPS[j];
      const dMidi = n.midi - prev.last.midi;
      const tagged = n.deg !== undefined && prev.last.deg !== undefined ? n.deg - prev.last.deg === dDeg : true;
      const shape = Math.sign(dMidi) === Math.sign(dDeg) && Math.abs(dMidi) >= Math.abs(dDeg) && Math.abs(dMidi) <= Math.abs(dDeg) * 2 + 1;
      prev.st.indices.push(i);
      prev.st.ok = prev.st.ok && tagged && shape;
      prev.last = n;
    } else {
      const st: MotifStatement = { t: n.t, inst: n.inst, indices: [i], ok: true };
      motifs.push(st);
      open.set(voiceKey, { st, last: n });
    }
  }

  return { id, bpm: c.bpm, bars: Math.round(c.end / c.bar), end: c.end, notes, offKey, offGrid, motifs };
}

export interface BrushCheck {
  notes: number;
  offGrid: number;
  outside: number;
  maxPerSecond: number;
  meanPerSecond: number;
}

/** Brush notes must sit on the eighth grid, use allowed pitches and stay near four a second at most. */
export function checkBrush(notes: BrushNote[], t0: number, eighth: number, seconds: number): BrushCheck {
  let offGrid = 0;
  let outside = 0;
  let maxPerSecond = 0;
  for (const n of notes) {
    const k = (n.t - t0) / eighth;
    if (Math.abs(k - Math.round(k)) > 1e-3) offGrid++;
    if (!n.allowed.includes(n.midi)) outside++;
    const inWindow = notes.filter((m) => m.t >= n.t && m.t < n.t + 1).length;
    maxPerSecond = Math.max(maxPerSecond, inWindow);
  }
  return { notes: notes.length, offGrid, outside, maxPerSecond, meanPerSecond: notes.length / seconds };
}

export interface LevelStats {
  peakDb: number;
  rmsDb: number;
  musicRmsDb: number;
  longestGap: number;
  musicGap: number;
}

const db = (x: number) => (x > 0 ? 20 * Math.log10(x) : -120);

function gap(chs: Float32Array[], sr: number, thresholdDb: number, from: number, to: number): number {
  const win = Math.round(sr * 0.05);
  const thr = Math.pow(10, thresholdDb / 20);
  let run = 0;
  let longest = 0;
  const a = Math.round(from * sr);
  const b = Math.min(chs[0].length, Math.round(to * sr));
  for (let i = a; i + win <= b; i += win) {
    let sum = 0;
    for (const ch of chs) for (let k = i; k < i + win; k++) sum += ch[k] * ch[k];
    const rms = Math.sqrt(sum / (win * chs.length));
    if (rms < thr) {
      run += win;
      longest = Math.max(longest, run);
    } else run = 0;
  }
  return longest / sr;
}

/** Peak and RMS of the mix, and the longest stretches of near-silence in the mix and in the music alone. */
export function levels(buf: AudioBuffer, from = 0, to = buf.duration): LevelStats {
  const mix = [buf.getChannelData(0), buf.getChannelData(1)];
  let peak = 0;
  let sum = 0;
  for (const ch of mix) {
    for (let i = 0; i < ch.length; i++) {
      const v = ch[i];
      const a = v < 0 ? -v : v;
      if (a > peak) peak = a;
      sum += v * v;
    }
  }
  const rms = Math.sqrt(sum / (mix[0].length * 2));
  const music = buf.numberOfChannels >= 4 ? [buf.getChannelData(2), buf.getChannelData(3)] : mix;
  let msum = 0;
  for (const ch of music) for (let i = 0; i < ch.length; i++) msum += ch[i] * ch[i];
  return {
    peakDb: db(peak),
    rmsDb: db(rms),
    musicRmsDb: db(Math.sqrt(msum / (music[0].length * 2))),
    longestGap: gap(mix, buf.sampleRate, -50, from, to),
    musicGap: gap(music, buf.sampleRate, -48, from, to),
  };
}

/** 16-bit stereo WAV of the first two channels. */
export function wav(buf: AudioBuffer): Uint8Array {
  const n = buf.length;
  const out = new DataView(new ArrayBuffer(44 + n * 4));
  const str = (o: number, s: string) => {
    for (let i = 0; i < s.length; i++) out.setUint8(o + i, s.charCodeAt(i));
  };
  str(0, 'RIFF');
  out.setUint32(4, 36 + n * 4, true);
  str(8, 'WAVE');
  str(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 2, true);
  out.setUint32(24, buf.sampleRate, true);
  out.setUint32(28, buf.sampleRate * 4, true);
  out.setUint16(32, 4, true);
  out.setUint16(34, 16, true);
  str(36, 'data');
  out.setUint32(40, n * 4, true);
  const l = buf.getChannelData(0);
  const r = buf.getChannelData(1);
  for (let i = 0; i < n; i++) {
    out.setInt16(44 + i * 4, Math.max(-32768, Math.min(32767, Math.round(l[i] * 32767))), true);
    out.setInt16(46 + i * 4, Math.max(-32768, Math.min(32767, Math.round(r[i] * 32767))), true);
  }
  return new Uint8Array(out.buffer);
}
