#!/usr/bin/env node
/**
 * Renders every Pentimento score offline in headless Chromium, writes WAVs and prints checks.
 *
 * Usage (from the repo root):
 *   node tools/render-audio.mjs [outDir] [--only nine,seventytwo] [--no-wav]
 *
 * outDir defaults to a new /tmp/pentimento-render-XXXX directory. The tool starts its own Vite
 * dev server on 127.0.0.1:5327 (strict port, with its dependency cache inside outDir), checks the
 * listener belongs to this process and runs from this checkout, and closes it when done.
 *
 * For each score it prints peak and RMS in dBFS, the longest near-silent stretch of the whole mix
 * (below -50 dBFS) and of the music alone (below -48 dBFS), how many window-theme statements it
 * holds, and any pitches outside the chord or scale. Chapters render at their contract length plus
 * 8 s of tail; title and lift render 60 s. Two brush runs paint for 30 s over nine and seventytwo,
 * and one run ends nine early to exercise endChapter().
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const PORT = 5327;
const SR = 44100;
const root = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
process.chdir(root);

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--only'));
const outDir = positional[0] ? path.resolve(positional[0]) : fs.mkdtempSync(path.join(os.tmpdir(), 'pentimento-render-'));
fs.mkdirSync(outDir, { recursive: true });
const only = opt('--only')?.split(',');
const writeWav = !flag('--no-wav');

const LENGTHS = {
  title: 0, nine: 80, sixteen: 80, twentythree: 85, thirtyone: 50, fortyfour: 80,
  fortynine: 80, seventytwo: 95, eightysix: 85, later: 85, lift: 0,
};

const jobs = [];
for (const [id, len] of Object.entries(LENGTHS)) {
  jobs.push({ name: id, id, dur: len ? len + 8 : 60, chapter: len });
}
jobs.push({ name: 'nine-brush', id: 'nine', dur: 30, chapter: 80, brush: true });
jobs.push({ name: 'seventytwo-brush', id: 'seventytwo', dur: 30, chapter: 95, brush: true });
jobs.push({ name: 'nine-end', id: 'nine', dur: 42, chapter: 80, endAt: 30 });
if (flag('--bristle')) jobs.push({ name: 'nine-bristle', id: 'nine', dur: 30, chapter: 80, brush: true, solo: 'bristle' });
if (flag('--balance')) {
  for (const id of Object.keys(LENGTHS)) {
    jobs.push({ name: `${id}-music`, id, dur: 40, chapter: LENGTHS[id], solo: 'music' });
    jobs.push({ name: `${id}-amb`, id, dur: 40, chapter: LENGTHS[id], solo: 'amb' });
  }
}
const selected = only ? jobs.filter((j) => only.includes(j.id) || only.includes(j.name)) : jobs;

function listenerPid() {
  try {
    return execSync(`lsof -tiTCP:${PORT} -sTCP:LISTEN`, { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

if (listenerPid().length) {
  console.error(`Port ${PORT} is already in use; stop that server first.`);
  process.exit(1);
}

const server = await createServer({
  root,
  configFile: path.join(root, 'vite.config.ts'),
  cacheDir: path.join(outDir, '.vite-cache'),
  logLevel: 'warn',
  server: { host: '127.0.0.1', port: PORT, strictPort: true },
});
await server.listen();

let browser;
try {
  const pids = listenerPid();
  if (!pids.includes(String(process.pid))) throw new Error(`listener on ${PORT} is ${pids.join(',')}, not this process (${process.pid})`);
  const cwd = execSync(`lsof -a -p ${process.pid} -d cwd -Fn`, { encoding: 'utf8' }).split('\n').find((l) => l.startsWith('n'))?.slice(1);
  if (cwd !== root) throw new Error(`listener cwd is ${cwd}, expected ${root}`);

  browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.error('page error:', e.message));
  await page.goto(`http://127.0.0.1:${PORT}/audio.html`);

  const rows = [];
  for (const job of selected) {
    const res = await page.evaluate(async ({ job, sr }) => {
      const { renderOffline } = await import('/src/audio/offline.ts');
      const { levels, wav, checkScore, checkBrush } = await import('/src/audio/analysis.ts');
      const { compose } = await import('/src/audio/scores/index.ts');
      const notes = [];
      let voices = [0, 0];
      const started = performance.now();
      const buf = await renderOffline(job.id, job.dur, sr, {
        stems: true,
        chapterSec: job.chapter || undefined,
        brush: !!job.brush,
        endAt: job.endAt,
        onBrushNote: (n) => notes.push(n),
        solo: job.solo,
        onVoices: (peak, stolen) => (voices = [peak, stolen]),
      });
      const ms = performance.now() - started;
      const comp = compose(job.id, job.chapter || undefined);
      const musicEnd = comp.loop ? job.dur : Math.min(job.dur, (job.endAt ?? comp.end) + 6);
      const lv = levels(buf, 1, musicEnd);
      const check = checkScore(job.id, job.chapter || undefined);
      const brush = job.brush ? checkBrush(notes, 0.1, comp.beat / 2, job.dur) : null;
      const bytes = wav(buf);
      window.__wav = bytes;
      return { ms, lv, check, brush, voices, size: bytes.length, end: comp.end, loop: comp.loop, bpm: comp.bpm };
    }, { job, sr: SR });

    if (writeWav) {
      const file = path.join(outDir, `${job.name}.wav`);
      const fd = fs.openSync(file, 'w');
      const CHUNK = 4 * 1024 * 1024;
      for (let off = 0; off < res.size; off += CHUNK) {
        const b64 = await page.evaluate(({ off, n }) => {
          const u = window.__wav.subarray(off, off + n);
          let s = '';
          for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000));
          return btoa(s);
        }, { off, n: CHUNK });
        fs.writeSync(fd, Buffer.from(b64, 'base64'));
      }
      fs.closeSync(fd);
    }
    const motifs = res.check.motifs;
    const full = motifs.filter((m) => m.indices.length === 7).length;
    const bad = motifs.filter((m) => !m.ok).length;
    rows.push({
      render: job.name,
      sec: job.dur,
      bpm: res.bpm.toFixed(1),
      cadence: res.loop ? 'loop' : `${res.end.toFixed(1)}s`,
      peak: res.lv.peakDb.toFixed(2),
      rms: res.lv.rmsDb.toFixed(1),
      'music rms': res.lv.musicRmsDb.toFixed(1),
      'mix gap': `${res.lv.longestGap.toFixed(2)}s`,
      'music gap': `${res.lv.musicGap.toFixed(2)}s`,
      motif: `${motifs.length} (${full} whole${bad ? `, ${bad} BAD` : ''})`,
      'off-key': res.check.offKey.length,
      'off-grid': res.check.offGrid.length,
      brush: res.brush ? `${res.brush.notes} notes, max ${res.brush.maxPerSecond}/s, off-grid ${res.brush.offGrid}, outside ${res.brush.outside}` : '',
      voices: `${res.voices[0]}${res.voices[1] ? ` (${res.voices[1]} stolen)` : ''}`,
      'render ms': Math.round(res.ms),
    });
    if (res.check.offKey.length) console.log(`${job.name} off-key:`, res.check.offKey.slice(0, 8).join('; '));
    if (res.check.offGrid.length) console.log(`${job.name} off-grid:`, res.check.offGrid.slice(0, 8).join('; '));
    process.stdout.write(`rendered ${job.name}\n`);
  }
  console.table(rows);
  console.log(`WAVs in ${outDir}`);
} finally {
  await browser?.close();
  await server.close();
}
