// Plays one sitting from a board with every earlier year painted, and tries to catch each passing moment.
// Usage: BASE=http://127.0.0.1:5317/ node tools/moment.mjs <outdir> <chapter> [--miss] [--speed 2]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const outdir = args[0];
const chapter = args[1];
const miss = args.includes('--miss');
const si = args.indexOf('--speed');
const speed = si >= 0 ? Number(args[si + 1]) : 2;
mkdirSync(outdir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5317/'}?from=${chapter}&speed=${speed}`);
await page.waitForFunction(() => (window.__frames || 0) > 10);
const state = () => page.evaluate(() => window.__game.debug);
const text = () => page.evaluate(() => [...document.querySelectorAll('.narration .line, .hint.on')].map((l) => l.textContent).join(' | '));
let n = 0;
const shot = async (name) => {
  const file = `${String(n++).padStart(2, '0')}-${name}`;
  await page.screenshot({ path: `${outdir}/${file}.png` });
  const s = await state();
  const ms = Object.entries(s.moments ?? {}).map(([k, v]) => `${k}:${v.state}`).join(' ');
  console.log(file, `t=${s.t.toFixed(1)} ${ms} cov=${s.coverage.toFixed(2)}`, '::', await text());
};
const box = await page.locator('canvas.board').boundingBox();
const at = (u, v) => [box.x + u * box.width, box.y + v * box.height];
const pour = async (u, v, ms) => {
  const [x, y] = at(u, v);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(ms / speed);
  await page.mouse.up();
};

await page.getByRole('button', { name: 'Begin' }).click();
await page.waitForFunction(() => window.__game.debug.phase === 'painting', null, { timeout: 60000 });
await shot('start');
for (const [u, v, ms] of [[0.5, 0.12, 1400], [0.2, 0.3, 800], [0.8, 0.3, 800], [0.55, 0.8, 1400], [0.5, 0.575, 1000], [0.15, 0.85, 900], [0.85, 0.7, 900]]) {
  await pour(u, v, ms);
}
await page.waitForTimeout(1500 / speed);
await shot('wet');

const ids = Object.keys((await state()).moments ?? {});
for (const id of ids) {
  await page.waitForFunction((id) => window.__game.debug.moments[id].state !== 'waiting', id, { timeout: 200000 });
  await shot(`${id}-appears`);
  if (!miss) {
    await page.waitForTimeout(3000 / speed);
    const s = await state();
    const m = s.moments[id];
    if (m.u !== undefined) {
      const [x, y] = at(m.u, m.v);
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(500 / speed);
      await page.mouse.up();
    }
    await page.waitForTimeout(1000 / speed);
    await shot(`${id}-caught`);
    await page.waitForTimeout(5000 / speed);
    await shot(`${id}-set`);
  }
  await page.waitForFunction((id) => window.__game.debug.moments[id].state === 'gone', id, { timeout: 200000 });
  await page.waitForTimeout(2000 / speed);
  await shot(`${id}-gone`);
}
await page.waitForFunction(() => window.__game.debug.phase === 'drying', null, { timeout: 200000 });
await page.waitForTimeout(3000 / speed);
await shot('dry');
await browser.close();
