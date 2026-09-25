// Plays the twenty-three sitting from a board with every earlier year painted, and tries to catch Joe at eight.
// Usage: BASE=http://127.0.0.1:5317/ node tools/moment.mjs <outdir> [--miss] [--speed 2]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const outdir = args[0];
const miss = args.includes('--miss');
const si = args.indexOf('--speed');
const speed = si >= 0 ? Number(args[si + 1]) : 2;
mkdirSync(outdir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${process.env.BASE || 'http://127.0.0.1:5317/'}?from=twentythree&speed=${speed}`);
await page.waitForFunction(() => (window.__frames || 0) > 10);
const state = () => page.evaluate(() => window.__game.debug);
const narration = () => page.evaluate(() => [...document.querySelectorAll('.narration .line')].map((l) => l.textContent).join(' | '));
const shot = async (name) => {
  await page.screenshot({ path: `${outdir}/${name}.png` });
  const s = await state();
  console.log('shot', name, `t=${s.t.toFixed(1)} joe=${s.joe} cov=${s.coverage.toFixed(2)}`, '::', await narration());
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
const until = (t) => page.waitForFunction((t) => window.__game.debug.t >= t, t, { timeout: 120000 });

await page.getByRole('button', { name: 'Begin' }).click();
await page.waitForFunction(() => window.__game.debug.phase === 'painting', null, { timeout: 60000 });
await shot('00-start');
for (const [u, v, ms] of [[0.5, 0.12, 1400], [0.2, 0.3, 800], [0.8, 0.3, 800], [0.55, 0.8, 1400], [0.5, 0.575, 1000], [0.15, 0.85, 900], [0.85, 0.7, 900]]) {
  await pour(u, v, ms);
}
await page.waitForTimeout(1500 / speed);
await shot('01-wet');
await until(30);
await shot('02-dried');
await until(36);
await shot('03-joe-pencil');
if (!miss) {
  await until(39);
  const s = await state();
  if (s.joePos) {
    const [x, y] = at(s.joePos.u, s.joePos.v);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.waitForTimeout(500 / speed);
    await page.mouse.up();
  }
  await page.waitForTimeout(1000 / speed);
  await shot('04-caught');
  await page.waitForTimeout(5000 / speed);
  await shot('05-set');
}
await until(62);
await shot('06-after');
await page.waitForFunction(() => window.__game.debug.phase === 'drying', null, { timeout: 200000 });
await page.waitForTimeout(3000 / speed);
await shot('07-dry');
await browser.close();
