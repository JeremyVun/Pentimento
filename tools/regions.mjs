// Renders every scene's paint regions as a contact sheet, to check that pours stop where they should.
// Usage: node tools/regions.mjs <out.png>   (needs the dev server on 127.0.0.1:5317)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const out = process.argv[2] || '/tmp/pentimento-regions.png';
const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
await page.goto('http://127.0.0.1:5317/?view=nine');
const url = await page.evaluate(async () => {
  const { drawRegions } = await import('/src/scene/regions.ts');
  const { drawScene } = await import('/src/scene/draw.ts');
  const { SCENES } = await import('/src/scene/config.ts');
  const ids = Object.keys(SCENES);
  const W = 480, H = 300;
  const sheet = document.createElement('canvas');
  sheet.width = W * 2; sheet.height = H * ids.length;
  const sc = sheet.getContext('2d');
  ids.forEach((id, k) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const ctx = c.getContext('2d');
    drawScene(ctx, H, { cfg: SCENES[id], t: 0, sketch: true, woke: {} });
    sc.drawImage(c, 0, k * H);
    drawRegions(ctx, H, SCENES[id]);
    const v = ctx.getImageData(0, 0, W, H);
    for (let i = 0; i < v.data.length; i += 4) { const r = Math.round(v.data[i] / 16); v.data[i] = (r * 67) % 255; v.data[i + 1] = (r * 131) % 255; v.data[i + 2] = (r * 29 + 40) % 255; }
    ctx.putImageData(v, 0, 0);
    sc.drawImage(c, W, k * H);
    sc.fillStyle = '#fff'; sc.font = '16px sans-serif'; sc.fillText(id, 8, k * H + 20);
  });
  return sheet.toDataURL();
});
writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
console.log(out);
await browser.close();
