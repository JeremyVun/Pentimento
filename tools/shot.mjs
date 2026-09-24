// Screenshots the board for one or more QA queries.
// Usage: node tools/shot.mjs <outdir> "view=nine&t=12" "view=sixteen" ...
// Needs the dev server on 127.0.0.1:5317 (npm run dev). Uses real Chrome with GPU when available.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const [outdir, ...queries] = process.argv.slice(2);
if (!outdir || queries.length === 0) {
  console.error('usage: node tools/shot.mjs <outdir> <query>...');
  process.exit(1);
}
mkdirSync(outdir, { recursive: true });
const base = process.env.BASE || 'http://127.0.0.1:5317/';
const browser = await chromium.launch({
  channel: process.env.CHANNEL || 'chrome',
  args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--enable-gpu', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: Number(process.env.VW || 1500), height: Number(process.env.VH || 1000) } });
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console:', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
for (const q of queries) {
  await page.goto(base + '?' + q);
  await page.waitForFunction(() => (window.__frames || 0) > 20, null, { timeout: 60000 });
  const name = q.replace(/[^a-z0-9=_-]+/gi, '_').slice(0, 80);
  const el = await page.$(process.env.SEL || '.board');
  const file = `${outdir}/${name}.png`;
  if (el && !process.env.FULL) await el.screenshot({ path: file });
  else await page.screenshot({ path: file });
  const fps = await page.evaluate(async () => {
    const f0 = window.__frames; const t0 = performance.now();
    await new Promise((r) => setTimeout(r, 1000));
    return ((window.__frames - f0) * 1000) / (performance.now() - t0);
  });
  console.log(file, `fps=${fps.toFixed(1)}`);
}
const gpu = await page.evaluate(() => {
  const gl = document.createElement('canvas').getContext('webgl2');
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : 'unknown';
});
console.log('renderer:', gpu);
await browser.close();
