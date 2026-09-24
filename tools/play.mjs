// Plays the real game in Chrome with real mouse input and captures the board at each phase.
// Usage: node tools/play.mjs <outdir> [--speed 6] [--chapters 9] [--coverage 0.6] [--lift]
// Needs the dev server on 127.0.0.1:5317. Captures go to <outdir> (use a /tmp dir).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const args = process.argv.slice(2);
const outdir = args[0];
const opt = (name, def) => { const i = args.indexOf('--' + name); return i >= 0 ? Number(args[i + 1]) : def; };
const speed = opt('speed', 6);
const chapters = opt('chapters', 9);
const coverage = opt('coverage', 0.6);
const lift = args.includes('--lift');
mkdirSync(outdir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`http://127.0.0.1:5317/?speed=${speed}`);
await page.waitForFunction(() => (window.__frames || 0) > 10);
const state = () => page.evaluate(() => window.__game.debug);
const shot = async (name) => { await page.screenshot({ path: `${outdir}/${name}.png` }); console.log('shot', name, JSON.stringify(await state())); };
const box = await page.locator('canvas.board').boundingBox();
const at = (u, v) => [box.x + u * box.width, box.y + v * box.height];

await page.waitForTimeout(800);
await shot('00-title');
await page.getByRole('button', { name: 'Begin' }).click();
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };

for (let c = 0; c < chapters; c++) {
  await page.waitForFunction(() => window.__game.debug.phase === 'intro', null, { timeout: 120000 });
  await page.waitForTimeout(1600 / speed * 1.2);
  await shot(`${String(c + 1).padStart(2, '0')}a-card`);
  await page.waitForFunction(() => window.__game.debug.phase === 'painting', null, { timeout: 60000 });
  await page.waitForTimeout(200);
  await shot(`${String(c + 1).padStart(2, '0')}b-sketch`);
  // Paint horizontal sweeps over a random band until the coverage target is met.
  const strokes = Math.round(coverage * 26);
  for (let s = 0; s < strokes; s++) {
    const v = rnd() * 0.9 + 0.05;
    const u0 = rnd() * 0.4;
    const u1 = u0 + 0.3 + rnd() * 0.5;
    const [x0, y0] = at(u0, v);
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    const steps = 18;
    for (let k = 1; k <= steps; k++) {
      const u = u0 + ((u1 - u0) * k) / steps;
      const [x, y] = at(u, v + Math.sin(k * 0.7) * 0.02);
      await page.mouse.move(x, y);
      await page.waitForTimeout(12);
    }
    await page.mouse.up();
    if ((await state()).phase !== 'painting') break;
  }
  await shot(`${String(c + 1).padStart(2, '0')}c-painted`);
  await page.waitForFunction(() => window.__game.debug.phase === 'drying', null, { timeout: 200000 });
  await page.waitForTimeout(3000 / speed);
  await shot(`${String(c + 1).padStart(2, '0')}d-dry`);
}
if (lift) {
  await page.waitForFunction(() => window.__game.debug.phase === 'lift', null, { timeout: 120000 });
  await page.evaluate(() => { window.__speed = 1; });
  await page.waitForTimeout(1500);
  await shot('90-final');
  const [x, y] = at(0.3, 0.3);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.waitForTimeout(1600);
  await shot('90b-hold');
  await page.waitForTimeout(1600);
  await shot('90c-hold-longer');
  for (let k = 0; k < 90; k++) {
    const [px, py] = at(0.35 + 0.3 * Math.sin(k * 0.13), 0.5 + 0.12 * Math.sin(k * 0.21));
    await page.mouse.move(px, py);
    await page.waitForTimeout(30);
  }
  await shot('91-lifting');
  await page.mouse.up();
}
await browser.close();
