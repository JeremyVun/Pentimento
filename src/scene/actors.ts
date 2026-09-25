import type { Frame } from './draw';
import { A, BRIDGE, FIG_BASE, WALL_Y, riverSpan } from './geometry';
import { circle, clamp, ellipse, hash, lerp, mixHex, mulberry, poly, shade, smooth, withAlpha } from './util';

interface PersonStyle {
  coat: string;
  legs: string;
  hair: string;
  skin: string;
  long?: boolean;
  child?: boolean;
}

interface Pose {
  walk?: number;
  wave?: number;
  bothArms?: boolean;
  armUp?: number;
  kneel?: boolean;
  umbrella?: string;
  carry?: string;
}

function person(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, s: PersonStyle, p: Pose): void {
  const k = s.child ? 1.15 : 1;
  const headR = h * 0.085 * k;
  const hipY = y - h * (s.child ? 0.4 : 0.46);
  const shoulderY = y - h * (s.child ? 0.74 : 0.8);
  const sw = h * 0.105;
  const hw = h * 0.085;
  const shoe = shade(s.legs, -0.35);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (p.kneel) {
    const kx = x + h * 0.12;
    const ky = y - h * 0.02;
    ctx.strokeStyle = s.legs;
    ctx.lineWidth = h * 0.075;
    ctx.beginPath();
    ctx.moveTo(x, y - h * 0.26);
    ctx.lineTo(kx, ky);
    ctx.lineTo(x - h * 0.14, y);
    ctx.stroke();
    ellipse(ctx, x - h * 0.16, y - h * 0.01, h * 0.035, h * 0.02, 0, shoe);
    ctx.save();
    ctx.translate(x, y - h * 0.26);
    ctx.rotate(0.45);
    ctx.translate(-x, -(y - h * 0.26));
    torso(ctx, x, y - h * 0.26, y - h * 0.26 - (hipY - shoulderY), h, sw, hw, s, false);
    ctx.strokeStyle = s.coat;
    ctx.lineWidth = h * 0.06;
    const sy = y - h * 0.26 - (hipY - shoulderY);
    ctx.beginPath();
    ctx.moveTo(x + sw * 0.7, sy + h * 0.04);
    ctx.lineTo(x + sw * 1.2, sy + h * 0.2);
    ctx.lineTo(x + sw * 1.5, sy + h * 0.32 * (p.armUp ?? 1));
    ctx.stroke();
    circle(ctx, x + sw * 1.5, sy + h * 0.32 * (p.armUp ?? 1), h * 0.03, s.skin);
    head(ctx, x, sy - headR * 1.05, headR, s);
    ctx.restore();
    return;
  }

  const walk = p.walk !== undefined ? Math.sin(p.walk) : 0;
  const stride = walk * h * 0.08;
  ctx.strokeStyle = s.legs;
  ctx.lineWidth = h * 0.07;
  ctx.beginPath();
  ctx.moveTo(x - hw * 0.45, hipY);
  ctx.lineTo(x - hw * 0.45 + stride, y - h * 0.02);
  ctx.moveTo(x + hw * 0.45, hipY);
  ctx.lineTo(x + hw * 0.45 - stride, y - h * 0.02);
  ctx.stroke();
  ellipse(ctx, x - hw * 0.45 + stride + h * 0.012, y - h * 0.01, h * 0.035, h * 0.018, 0, shoe);
  ellipse(ctx, x + hw * 0.45 - stride + h * 0.012, y - h * 0.01, h * 0.035, h * 0.018, 0, shoe);

  const armY = shoulderY + h * 0.035;
  const arm = (side: number, ex: number, ey: number, hx: number, hy: number) => {
    ctx.strokeStyle = side > 0 ? shade(s.coat, -0.12) : s.coat;
    ctx.lineWidth = h * 0.058;
    ctx.beginPath();
    ctx.moveTo(x + side * sw * 0.8, armY);
    ctx.lineTo(ex, ey);
    ctx.lineTo(hx, hy);
    ctx.stroke();
    circle(ctx, hx, hy, h * 0.028, s.skin);
  };
  const hang = (side: number) => arm(side, x + side * sw * 1.05, armY + h * 0.16, x + side * sw * 1.0 + walk * side * h * 0.03, armY + h * 0.31);
  const wave = p.wave ?? 0;
  if (wave > 0) {
    const a = Math.sin(wave) * h * 0.06;
    arm(1, x + sw * 2.0, armY - h * 0.1, x + sw * 2.3 + a, armY - h * 0.36);
    if (p.bothArms) arm(-1, x - sw * 2.0, armY - h * 0.1, x - sw * 2.3 - a, armY - h * 0.36);
    else hang(-1);
  } else if (p.armUp !== undefined) {
    arm(1, x + sw * 1.3, armY + h * 0.02, x + sw * 1.55, armY - h * 0.18 * p.armUp + h * 0.12 * (1 - p.armUp));
    hang(-1);
  } else {
    hang(-1);
    hang(1);
  }
  torso(ctx, x, hipY, shoulderY, h, sw, hw, s, !!s.long);
  if (p.carry) {
    ellipse(ctx, x - sw * 0.2, shoulderY + h * 0.14, sw * 0.9, h * 0.07, 0.3, p.carry);
    circle(ctx, x - sw * 0.95, shoulderY + h * 0.1, h * 0.05, s.skin);
  }
  head(ctx, x, shoulderY - headR * 1.05, headR, s);
  if (p.umbrella) {
    const ux = x + sw * 0.4;
    const uy = shoulderY - headR * 3.2;
    ctx.strokeStyle = '#2a2a2e';
    ctx.lineWidth = h * 0.02;
    ctx.beginPath();
    ctx.moveTo(ux, uy);
    ctx.lineTo(ux, shoulderY + h * 0.12);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(ux - h * 0.34, uy + h * 0.06);
    ctx.quadraticCurveTo(ux - h * 0.3, uy - h * 0.2, ux, uy - h * 0.2);
    ctx.quadraticCurveTo(ux + h * 0.3, uy - h * 0.2, ux + h * 0.34, uy + h * 0.06);
    ctx.quadraticCurveTo(ux + h * 0.17, uy + h * 0.02, ux, uy + h * 0.06);
    ctx.quadraticCurveTo(ux - h * 0.17, uy + h * 0.02, ux - h * 0.34, uy + h * 0.06);
    ctx.fillStyle = p.umbrella;
    ctx.fill();
  }
}

function torso(
  ctx: CanvasRenderingContext2D, x: number, hipY: number, shoulderY: number, h: number, sw: number, hw: number,
  s: PersonStyle, long: boolean,
): void {
  const hem = long ? hipY + h * 0.22 : hipY + h * 0.03;
  const flare = long ? 1.35 : 1.05;
  ctx.beginPath();
  ctx.moveTo(x - sw, shoulderY + h * 0.03);
  ctx.quadraticCurveTo(x - sw, shoulderY - h * 0.015, x - sw * 0.6, shoulderY - h * 0.02);
  ctx.lineTo(x + sw * 0.6, shoulderY - h * 0.02);
  ctx.quadraticCurveTo(x + sw, shoulderY - h * 0.015, x + sw, shoulderY + h * 0.03);
  ctx.lineTo(x + hw * flare, hem);
  ctx.quadraticCurveTo(x, hem + h * 0.015, x - hw * flare, hem);
  ctx.closePath();
  ctx.fillStyle = s.coat;
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = withAlpha('#1c1a30', 0.2);
  ctx.fillRect(x + sw * 0.25, shoulderY - h * 0.05, sw, hem - shoulderY + h * 0.1);
  ctx.fillStyle = withAlpha('#ffffff', 0.12);
  ctx.fillRect(x - sw, shoulderY - h * 0.05, sw * 0.35, hem - shoulderY + h * 0.1);
  ctx.restore();
}

function head(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, s: PersonStyle): void {
  circle(ctx, x, y, r, s.skin);
  ctx.beginPath();
  ctx.arc(x, y, r * 1.06, Math.PI * 0.95, Math.PI * 2.05);
  ctx.quadraticCurveTo(x + r * 0.6, y - r * 0.2, x, y - r * 0.35);
  ctx.quadraticCurveTo(x - r * 0.7, y - r * 0.15, x - r * 1.05, y + r * 0.1);
  ctx.closePath();
  ctx.fillStyle = s.hair;
  ctx.fill();
  circle(ctx, x + r * 0.35, y + r * 0.15, r * 0.35, withAlpha('#c0705a', 0.18));
}

const JOE: PersonStyle = { coat: '#f0bf2e', legs: '#3b3f52', hair: '#3a2c26', skin: '#e3b596' };

const JOE_STOPS = 7;

/** Where Joe is on the bridge, if he is on it. He crosses once, at eight, and stops to wave if he's painted. */
export function joeOnBridge(c: Frame['cfg'], t: number, woke: number | undefined): { x: number; y: number; walkT: number; waving: boolean } | null {
  if (!c.figures.includes('joeBridge')) return null;
  const at = c.joeAt ?? 0;
  const walk = c.joeAt === undefined ? c.duration * 0.95 : 20;
  const walkT = t - at - (woke === undefined ? 0 : Math.min(woke, JOE_STOPS));
  if (walkT < 0 || walkT > walk) return null;
  return { x: lerp(0.37, 1.12, walkT / walk), y: BRIDGE.top, walkT, waving: woke !== undefined && woke < JOE_STOPS };
}

/** The people, boats and birds that move, alone on white paper, for the pencil layer. */
export function drawFigures(ctx: CanvasRenderingContext2D, H: number, f: Frame): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.setTransform(H, 0, 0, H, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawBridgeFigures(ctx, f);
  drawRiverFigures(ctx, f);
  drawGardenFigures(ctx, f);
  drawBirds(ctx, f);
  ctx.restore();
}

export function drawBridgeFigures(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const y = BRIDGE.top + 0.002;
  const joe = joeOnBridge(c, f.t, f.woke.joe);
  if (joe) {
    const w = f.woke.joe;
    const umbrellaUp = c.weather === 'rain' && f.t < c.duration * 0.4;
    person(ctx, joe.x, y, 0.054, JOE, {
      walk: joe.waving ? undefined : joe.walkT * 6,
      wave: joe.waving ? (w ?? 0) * 8 : 0,
      umbrella: umbrellaUp ? '#2c2b31' : undefined,
    });
  }
  if (c.figures.includes('workers')) {
    const beat = f.t * (100 / 60) * Math.PI;
    const wk = f.woke.bridge;
    const spots: [number, number][] = [[0.622, 0.515], [0.83, 0.537], [0.46, 0.565]];
    spots.forEach(([x, yy], i) => {
      const waving = wk !== undefined && wk < 5 && i < 2;
      person(ctx, x, yy, 0.026, { coat: i % 2 ? '#7d8fa8' : '#c9a36a', legs: '#4a4038', hair: '#3a302c', skin: '#d9a88a' },
        waving ? { wave: wk * 8 } : { armUp: 0.5 + 0.5 * Math.sin(beat + i * 1.3) });
    });
  }
  if (c.figures.includes('lanterns')) {
    const wk = f.woke.lanterns;
    const bright = wk !== undefined ? 1 + 0.6 * Math.exp(-wk * 0.25) : 1;
    for (let i = 0; i < 7; i++) {
      const x = 0.46 + i * 0.085 + hash(i) * 0.02;
      const h = 0.038 + hash(i + 3) * 0.008;
      person(ctx, x, y, h, { coat: '#171b28', legs: '#12151f', hair: '#10121a', skin: '#3a3440', long: i % 2 === 0 }, {});
      if (!f.sketch) {
        const sw = Math.sin(f.t * 1.5 + i) * 0.004;
        const lx = x + 0.008 + sw;
        const ly = y - h * 0.45;
        const g = ctx.createRadialGradient(lx, ly, 0.001, lx, ly, 0.03 * bright);
        g.addColorStop(0, withAlpha('#ffd27a', 0.8));
        g.addColorStop(1, withAlpha('#ffd27a', 0));
        ctx.fillStyle = g;
        ctx.fillRect(lx - 0.04, ly - 0.04, 0.08, 0.08);
        circle(ctx, lx, ly, 0.0035, '#ffe7a8');
      }
    }
  }
  if (c.figures.includes('bus')) {
    const start = 4;
    const u = clamp((f.t - start) / (c.duration * 0.85));
    const x = lerp(0.2, 1.22, smooth(0, 1, u) * 0.4 + u * 0.6);
    const by = BRIDGE.top - 0.004;
    const w = 0.085;
    const h = 0.036;
    ctx.fillStyle = '#3f7a6a';
    ctx.beginPath();
    ctx.roundRect(x - w / 2, by - h, w, h, 0.006);
    ctx.fill();
    ctx.fillStyle = '#efe6cf';
    ctx.fillRect(x - w / 2, by - h + 0.004, w, 0.013);
    ctx.fillStyle = '#34414a';
    for (let k = 0; k < 5; k++) ctx.fillRect(x - w / 2 + 0.006 + k * 0.016, by - h + 0.006, 0.011, 0.009);
    circle(ctx, x - w / 2 + 0.011, by - h + 0.0105, 0.0042, '#d6402f');
    const wk = f.woke.june;
    if (wk !== undefined && wk < 8) {
      ctx.strokeStyle = '#d6402f';
      ctx.lineWidth = 0.002;
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 0.008, by - h + 0.008);
      ctx.lineTo(x - w / 2 + 0.002 + Math.sin(wk * 9) * 0.003, by - h - 0.004);
      ctx.stroke();
    }
    if (!f.sketch) {
      for (let k = 0; k < 4; k++) {
        const ph = (f.t * 0.5 + k / 4) % 1;
        circle(ctx, x - w / 2 - 0.01 - ph * 0.06, by - 0.01 - ph * 0.03, 0.004 + ph * 0.012, withAlpha('#e8e2da', 0.35 * (1 - ph)));
      }
    }
  }
  if (c.figures.includes('kidsBridge')) {
    const wk = f.woke.kids;
    const kids: [number, string][] = [[0.875, '#e2574c'], [0.91, '#4a8fd0'], [0.945, '#f2c94c']];
    kids.forEach(([x, col], i) => {
      if (i === 1 && wk !== undefined) {
        if (wk < 1.4) {
          const u = wk / 1.4;
          const jx = x + u * 0.03;
          const jy = BRIDGE.top - 0.012 - Math.sin(u * Math.PI) * 0.03 + u * u * 0.09;
          person(ctx, jx, jy, 0.028, { coat: col, legs: col, hair: '#3a2c26', skin: '#e3b596', child: true }, { wave: 1, bothArms: true });
        }
        return;
      }
      const bob = f.sketch ? 0 : Math.abs(Math.sin(f.t * 3 + i)) * 0.002;
      person(ctx, x, BRIDGE.top - 0.012 - bob, 0.028, { coat: col, legs: '#3b4a6a', hair: '#3a2c26', skin: '#e3b596', child: true },
        { wave: i === 0 && !f.sketch ? f.t * 4 : 0 });
    });
  }
  if (c.figures.includes('strollers')) {
    const x = lerp(0.42, 1.0, (f.t * 0.004) % 1);
    person(ctx, x, y, 0.04, { coat: '#6a5a8a', legs: '#3a3346', hair: '#2e2630', skin: '#e3b596', long: true }, { walk: f.t * 4 });
    person(ctx, x + 0.022, y, 0.044, { coat: '#b86a4a', legs: '#3b3f52', hair: '#9a9090', skin: '#e3b596' }, { walk: f.t * 4 + 1 });
  }
}

export function drawRiverFigures(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const P = c.pal;
  if (c.figures.includes('swimmers')) {
    const spots: [number, number, string][] = [[0.8, 0.72, '#3a2c26'], [0.92, 0.76, '#c89a50'], [1.04, 0.705, '#2e2a28'], [0.74, 0.8, '#6a4a3a']];
    spots.forEach(([x, y, hair], i) => {
      const bx = x + Math.sin(f.t * 0.4 + i) * 0.01;
      const by = y + Math.sin(f.t * 1.8 + i * 2) * 0.002;
      if (!f.sketch) {
        ctx.strokeStyle = withAlpha(P.riverLight, 0.6);
        ctx.lineWidth = 0.0016;
        for (let k = 0; k < 2; k++) {
          const ph = (f.t * 0.5 + k * 0.5 + i * 0.3) % 1;
          ctx.beginPath();
          ctx.ellipse(bx, by + 0.004, 0.008 + ph * 0.02, 0.003 + ph * 0.006, 0, 0, Math.PI * 2);
          ctx.globalAlpha = 1 - ph;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }
      circle(ctx, bx, by, 0.0065, P.skin);
      ctx.beginPath();
      ctx.arc(bx, by - 0.001, 0.0067, Math.PI, Math.PI * 2);
      ctx.fillStyle = hair;
      ctx.fill();
      if (i === 1) {
        ctx.strokeStyle = P.skin;
        ctx.lineWidth = 0.003;
        ctx.beginPath();
        const a = Math.sin(f.t * 2.5) * 0.5;
        ctx.moveTo(bx + 0.006, by);
        ctx.lineTo(bx + 0.014 + Math.sin(a) * 0.004, by - 0.012);
        ctx.stroke();
      }
    });
    const wk = f.woke.kids;
    if (wk !== undefined && wk > 1.3 && wk < 5 && !f.sketch) {
      const u = (wk - 1.3) / 3.7;
      ctx.strokeStyle = withAlpha(P.riverLight, 0.9 * (1 - u));
      ctx.lineWidth = 0.003;
      ctx.beginPath();
      ctx.ellipse(0.94, 0.64, 0.01 + u * 0.05, 0.004 + u * 0.015, 0, 0, Math.PI * 2);
      ctx.stroke();
      if (u < 0.3) {
        for (let k = 0; k < 7; k++) {
          const a = -Math.PI * (0.15 + 0.7 * (k / 6));
          circle(ctx, 0.94 + Math.cos(a) * u * 0.1, 0.64 + Math.sin(a) * u * 0.12, 0.003, P.riverLight);
        }
      }
    }
  }
  if (c.figures.includes('rower')) {
    const u = (f.t / Math.max(30, c.duration)) % 1;
    const y = lerp(0.9, 0.66, u);
    const [xl, xr] = riverSpan(y, false);
    const x = lerp(xl, xr, 0.45);
    const k = lerp(1.5, 0.75, u);
    ellipse(ctx, x, y + 0.008 * k, 0.05 * k, 0.006 * k, 0, withAlpha(P.riverDark, 0.4));
    poly(ctx, [[x - 0.045 * k, y - 0.004 * k], [x + 0.05 * k, y - 0.006 * k], [x + 0.035 * k, y + 0.006 * k], [x - 0.035 * k, y + 0.006 * k]]);
    ctx.fillStyle = '#b8443a';
    ctx.fill();
    const oar = Math.sin(f.t * 2.2);
    ctx.strokeStyle = P.woodShade;
    ctx.lineWidth = 0.002 * k;
    ctx.beginPath();
    ctx.moveTo(x - 0.01 * k, y - 0.012 * k);
    ctx.lineTo(x - 0.04 * k + oar * 0.01 * k, y + 0.01 * k);
    ctx.moveTo(x - 0.01 * k, y - 0.012 * k);
    ctx.lineTo(x + 0.02 * k + oar * 0.01 * k, y + 0.012 * k);
    ctx.stroke();
    person(ctx, x - 0.008 * k, y - 0.002 * k, 0.03 * k, { coat: '#f2ede0', legs: '#3b4a6a', hair: '#3a2c26', skin: '#e3b596' }, {});
  }
}

export function drawGardenFigures(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const [fx, fy] = FIG_BASE;
  if (c.figures.includes('father')) {
    const wk = f.woke.fig;
    const waving = wk !== undefined && wk < 7;
    const style: PersonStyle = { coat: '#eee8da', legs: '#4a5a7a', hair: '#5a4a3e', skin: '#e0ae8e' };
    const px = fx - 0.07;
    const py = fy + 0.012;
    const h = 0.11;
    if (waving) {
      person(ctx, px, py, h, style, { wave: wk * 7 });
    } else {
      person(ctx, px, py, h, style, { armUp: 0.25 });
      const hx = px + h * 0.105 * 1.55;
      const hy = py - h * 0.8 + h * 0.035 - h * 0.18 * 0.25 + h * 0.12 * 0.75;
      ctx.save();
      ctx.translate(hx + 0.008, hy + 0.006);
      ctx.rotate(0.5);
      poly(ctx, [[-0.01, -0.009], [0.012, -0.009], [0.014, 0.011], [-0.012, 0.011]]);
      ctx.fillStyle = '#6d8a7d';
      ctx.fill();
      ctx.strokeStyle = '#6d8a7d';
      ctx.lineWidth = 0.0035;
      ctx.beginPath();
      ctx.moveTo(0.012, -0.002);
      ctx.lineTo(0.032, -0.014);
      ctx.stroke();
      ctx.restore();
      if (!f.sketch) {
        const sx = hx + 0.036;
        const sy = hy - 0.002;
        for (let k = 0; k < 7; k++) {
          const ph = (f.t * 1.4 + k / 7) % 1;
          circle(ctx, sx + ph * 0.012, sy + ph * ph * 0.05, 0.0018, withAlpha('#d4ecf6', 0.9));
        }
      }
    }
  }
  if (c.figures.includes('joeGarden')) {
    const wk = f.woke.washing;
    const waving = wk !== undefined && wk < 6;
    const x = 0.28;
    const y = 0.935;
    person(ctx, x, y, 0.15, { coat: '#5d8fc4', legs: '#3b3f52', hair: '#3a2c26', skin: '#e3b596' },
      waving ? { wave: wk * 7 } : { armUp: 0.6 + 0.4 * Math.sin(f.t * 1.2) });
    pram(ctx, 0.44, 0.955, f);
  }
  if (c.figures.includes('joeBeans')) {
    const busGone = f.t > c.duration * 0.8;
    const wk = f.woke.joe;
    const turned = wk !== undefined && wk < 6;
    person(ctx, 0.37, 0.93, 0.14, { coat: '#7b6a5c', legs: '#3b3f52', hair: '#8a817a', skin: '#e3b596' },
      turned ? { wave: wk * 6 } : busGone ? {} : { wave: f.t * 5 });
  }
  if (c.figures.includes('child')) {
    const wk = f.woke.child;
    const waving = wk !== undefined && wk < 7;
    const bob = f.sketch ? 0 : Math.abs(Math.sin(f.t * 2.5)) * 0.004;
    person(ctx, fx + 0.07, fy - bob, 0.075, { coat: '#f2c94c', legs: '#4a7ab8', hair: '#6a4a36', skin: '#eab99a', child: true },
      waving ? { wave: wk * 8, bothArms: true } : { armUp: 0.8 });
  }
  if (c.figures.includes('june')) {
    person(ctx, 0.46, 0.94, 0.15, { coat: '#d6402f', legs: '#3b3f52', hair: '#4a3428', skin: '#e3b596', long: true }, {});
  }
}

function pram(ctx: CanvasRenderingContext2D, x: number, y: number, f: Frame): void {
  const rock = f.sketch ? 0 : Math.sin(f.t * 1.6) * 0.004;
  ctx.strokeStyle = '#2b2a33';
  ctx.lineWidth = 0.003;
  ctx.beginPath();
  ctx.arc(x - 0.018, y, 0.01, 0, Math.PI * 2);
  ctx.moveTo(x + 0.028, y);
  ctx.arc(x + 0.018, y, 0.01, 0, Math.PI * 2);
  ctx.stroke();
  ctx.save();
  ctx.translate(x, y - 0.02);
  ctx.rotate(rock * 3);
  ctx.beginPath();
  ctx.roundRect(-0.035, -0.022, 0.07, 0.03, 0.01);
  ctx.fillStyle = '#2f4a6e';
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-0.02, -0.022, 0.022, 0.024, 0, Math.PI, Math.PI * 2);
  ctx.fillStyle = '#26405f';
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(x + 0.035, y - 0.03);
  ctx.lineTo(x + 0.05, y - 0.05);
  ctx.stroke();
}

function swallow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ang: number, flap: number, col: string): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  ctx.beginPath();
  const w = 1 - 0.5 * flap;
  ctx.moveTo(s * 1.0, 0);
  ctx.quadraticCurveTo(0, -s * 0.2, -s * 0.5, -s * 1.3 * w);
  ctx.quadraticCurveTo(-s * 0.2, -s * 0.2, -s * 0.8, -s * 0.25);
  ctx.lineTo(-s * 1.4, -s * 0.35);
  ctx.lineTo(-s * 0.9, 0);
  ctx.lineTo(-s * 1.4, s * 0.35);
  ctx.lineTo(-s * 0.8, s * 0.25);
  ctx.quadraticCurveTo(-s * 0.2, s * 0.2, -s * 0.5, s * 1.3 * w);
  ctx.quadraticCurveTo(0, s * 0.2, s * 1.0, 0);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.restore();
}

export function drawBirds(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  if (!c.birds || f.sketch) return;
  if (c.birds === 'swallows') {
    const wk = f.woke.swallows;
    const n = 6 + (wk !== undefined ? 5 : 0);
    for (let i = 0; i < n; i++) {
      const extra = i >= 6;
      const t = f.t * (extra ? 0.9 : 0.55) + i * 1.7;
      const cx = 0.8 + hash(i) * 0.5 - (extra ? 0.3 : 0);
      const cy = extra ? 0.3 : 0.2 + hash(i + 9) * 0.12;
      const ax = 0.35 + hash(i + 2) * 0.3;
      const ay = 0.06 + hash(i + 4) * 0.06;
      const w1 = 0.35 + hash(i + 5) * 0.2;
      const w2 = w1 * 2;
      const x = cx + Math.sin(t * w1) * ax;
      const y = cy + Math.sin(t * w2 + 1) * ay;
      const vx = Math.cos(t * w1) * ax * w1;
      const vy = Math.cos(t * w2 + 1) * ay * w2;
      const s = extra ? 0.014 : 0.008 + hash(i + 7) * 0.004;
      if (extra && wk !== undefined && wk > 12) continue;
      swallow(ctx, x, y, s, Math.atan2(vy, vx), (Math.sin(f.t * 14 + i) + 1) / 2, '#23263a');
    }
  } else if (c.birds === 'gulls') {
    ctx.strokeStyle = '#f7efe4';
    ctx.lineWidth = 0.0028;
    for (let i = 0; i < 5; i++) {
      const x = ((hash(i) * 2 + f.t * 0.012 * (1 + hash(i + 1))) % 2) - 0.2;
      const y = 0.18 + hash(i + 3) * 0.2 + Math.sin(f.t * 0.7 + i) * 0.01;
      const s = 0.012 + hash(i + 2) * 0.006;
      const flap = Math.sin(f.t * 4 + i * 2) * 0.4;
      ctx.beginPath();
      ctx.moveTo(x - s, y - s * (0.2 + flap));
      ctx.quadraticCurveTo(x - s * 0.5, y - s * 0.6, x, y);
      ctx.quadraticCurveTo(x + s * 0.5, y - s * 0.6, x + s, y - s * (0.2 + flap));
      ctx.stroke();
    }
  } else if (c.birds === 'robin') {
    const wk = f.woke.robin;
    let x = 0.26;
    let y = WALL_Y - 0.015;
    if (wk !== undefined) {
      const hop = Math.floor(wk / 1.2);
      const ph = (wk / 1.2) % 1;
      if (hop < 4) {
        x += (hop + ph) * 0.012;
        y -= Math.sin(ph * Math.PI) * 0.01;
      } else x += 0.048;
    }
    const bob = Math.sin(f.t * 5) > 0.95 ? 0.002 : 0;
    ellipse(ctx, x, y - bob, 0.011, 0.009, -0.2, '#7a5a42');
    ellipse(ctx, x + 0.004, y + 0.001 - bob, 0.0065, 0.006, 0, '#d65a32');
    circle(ctx, x + 0.009, y - 0.007 - bob, 0.0055, '#7a5a42');
    circle(ctx, x + 0.011, y - 0.008 - bob, 0.0012, '#1a1a1a');
    ctx.strokeStyle = '#3a3030';
    ctx.lineWidth = 0.0015;
    ctx.beginPath();
    ctx.moveTo(x - 0.009, y - bob);
    ctx.lineTo(x - 0.018, y - 0.005 - bob);
    ctx.stroke();
  }
}

export function drawWeather(ctx: CanvasRenderingContext2D, f: Frame): void {
  const c = f.cfg;
  const w = c.weather;
  if (!w || f.sketch) return;
  if (w === 'rain' || w === 'storm') {
    const storm = w === 'storm';
    const intensity = storm ? 1 : 1 - smooth(0.35, 0.65, f.t / Math.max(1, c.duration));
    const n = Math.round((storm ? 420 : 220) * intensity);
    const v = storm ? 1.7 : 1.1;
    const slant = (storm ? 0.25 : 0.1) * c.wind;
    ctx.strokeStyle = storm ? withAlpha('#9aabcc', 0.45) : withAlpha('#dfe6ee', 0.5);
    ctx.lineWidth = storm ? 0.0016 : 0.0012;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const y = ((hash(i * 3.1) + f.t * v * (0.8 + 0.4 * hash(i))) % 1.1) - 0.05;
      const x = hash(i * 1.3) * (A + 0.3) - 0.15 + y * slant;
      const l = storm ? 0.04 : 0.028;
      ctx.moveTo(x, y);
      ctx.lineTo(x - slant * l, y - l);
    }
    ctx.stroke();
  } else if (w === 'snow') {
    for (let i = 0; i < 260; i++) {
      const near = hash(i * 5.7);
      const y = ((hash(i * 3.1) + f.t * (0.025 + 0.04 * near)) % 1.05) - 0.02;
      const x = ((hash(i * 1.3) * (A + 0.2) + Math.sin(f.t * 0.6 + i) * 0.015 + f.t * 0.01 * c.wind) % (A + 0.2)) - 0.1;
      circle(ctx, x, y, 0.0014 + near * 0.0032, withAlpha('#fbfcff', 0.75 + near * 0.25));
    }
  } else if (w === 'leaves') {
    const cols = ['#d98a34', '#e8b84a', '#b9542f', '#c9a040'];
    for (let i = 0; i < 34; i++) {
      const ph = (hash(i * 2.3) + f.t * (0.04 + 0.03 * hash(i))) % 1;
      const fromFig = i % 2 === 0;
      const x0 = fromFig ? FIG_BASE[0] + (hash(i + 5) - 0.5) * 0.4 : hash(i + 5) * A;
      const y0 = fromFig ? 0.55 : 0.35;
      const x = x0 + Math.sin(f.t * 1.4 + i) * 0.03 + ph * 0.25 * c.wind;
      const y = y0 + ph * (1.05 - y0);
      const rot = f.t * 3 + i;
      ellipse(ctx, x, y, 0.006, 0.003 + Math.abs(Math.sin(rot)) * 0.003, rot, withAlpha(cols[i % 4], Math.min(1, (1 - ph) * 5)));
    }
  }
  if (f.woke.cherry !== undefined && f.woke.cherry < 14) {
    const k = f.woke.cherry;
    for (let i = 0; i < 50; i++) {
      const ph = hash(i * 1.9) * 0.6 + k * 0.12;
      if (ph > 1.2) continue;
      const x = 1.14 + hash(i * 3.3) * 0.36 - ph * 0.3 + Math.sin(f.t * 1.2 + i) * 0.01;
      const y = 0.58 + ph * 0.18;
      ellipse(ctx, x, y, 0.004, 0.0025, f.t * 2 + i, withAlpha(i % 3 ? '#f6cad6' : '#fbe6ec', Math.max(0, 1 - ph)));
    }
  }
  if (w === 'petals') {
    for (let i = 0; i < 70; i++) {
      const ph = (hash(i * 2.3) + f.t * (0.03 + 0.03 * hash(i))) % 1;
      const x = (hash(i + 5) * (A + 0.4) - 0.2 + ph * 0.3 + Math.sin(f.t + i) * 0.02) % (A + 0.2);
      const y = ph * 1.05 - 0.02;
      const rot = f.t * 2 + i;
      ellipse(ctx, x, y, 0.004, 0.002 + Math.abs(Math.sin(rot)) * 0.002, rot, withAlpha(i % 3 ? '#f6cad6' : '#fbe6ec', 0.9));
    }
  }
}

export function drawWindow(ctx: CanvasRenderingContext2D, f: Frame): void {
  const P = f.cfg.pal;
  const fr = P.wood;
  const lit = shade(fr, 0.25);
  const dark = P.woodShade;
  const inX0 = 0.07;
  const inX1 = A - 0.07;
  const inY0 = 0.055;
  const sillY = 0.86;

  ctx.fillStyle = mixHex('#efe6d6', P.sky2, 0.2);
  ctx.fillRect(-0.05, -0.05, inX0 + 0.05, 1.1);
  ctx.fillRect(inX1, -0.05, 0.12, 1.1);
  ctx.fillRect(-0.05, -0.05, A + 0.1, inY0 + 0.05);

  ctx.fillStyle = fr;
  ctx.fillRect(inX0 - 0.025, inY0 - 0.025, 0.028, sillY - inY0 + 0.03);
  ctx.fillRect(inX1 - 0.003, inY0 - 0.025, 0.028, sillY - inY0 + 0.03);
  ctx.fillRect(inX0 - 0.025, inY0 - 0.025, inX1 - inX0 + 0.05, 0.028);
  const mx = A / 2;
  // In the region map the bars are left out, so they don't cut the view into separate panes.
  if (!f.region) {
    ctx.fillRect(mx - 0.016, inY0, 0.032, sillY - inY0);
    ctx.fillRect(inX0, 0.3, inX1 - inX0, 0.022);
    ctx.fillStyle = lit;
    ctx.fillRect(mx - 0.016, inY0, 0.006, sillY - inY0);
    ctx.fillRect(inX0, 0.3, inX1 - inX0, 0.005);
    ctx.fillStyle = dark;
    ctx.fillRect(mx + 0.01, inY0, 0.006, sillY - inY0);
    ctx.fillRect(inX0, 0.318, inX1 - inX0, 0.004);
  }

  ctx.fillStyle = withAlpha('#ffffff', 0.08);
  poly(ctx, [[0.2, inY0], [0.32, inY0], [0.1, 0.5], [inX0, 0.5], [inX0, 0.4]]);
  ctx.fill();
  poly(ctx, [[1.0, inY0], [1.06, inY0], [0.86, 0.45], [0.83, 0.45]]);
  ctx.fill();

  ctx.fillStyle = '#e6dac2';
  ctx.fillRect(-0.05, sillY, A + 0.1, 0.04);
  ctx.fillStyle = shade('#e6dac2', 0.2);
  ctx.fillRect(-0.05, sillY, A + 0.1, 0.006);
  ctx.fillStyle = '#b9ab92';
  ctx.fillRect(-0.05, sillY + 0.04, A + 0.1, 0.12);
  ctx.fillStyle = withAlpha('#6a5a4a', 0.3);
  ctx.fillRect(-0.05, sillY + 0.04, A + 0.1, 0.008);

  ctx.fillStyle = '#efe2cc';
  ctx.beginPath();
  ctx.moveTo(-0.05, -0.05);
  ctx.lineTo(0.16, -0.05);
  ctx.quadraticCurveTo(0.1, 0.4, 0.14, sillY);
  ctx.lineTo(-0.05, sillY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = withAlpha('#b8a58a', 0.6);
  ctx.lineWidth = 0.006;
  for (const k of [0.03, 0.07, 0.11]) {
    ctx.beginPath();
    ctx.moveTo(k, -0.05);
    ctx.quadraticCurveTo(k - 0.03, 0.4, k + 0.01, sillY);
    ctx.stroke();
  }
  const rr = mulberry(4);
  for (let i = 0; i < 30; i++) {
    const y = rr() * sillY;
    const x = rr() * (0.12 - y * 0.02);
    circle(ctx, x, y, 0.004, i % 2 ? '#d98a8a' : '#8fb28a');
  }

  const jx = 1.22;
  const jy = sillY + 0.004;
  const sway = (i: number) => (f.sketch ? 0 : Math.sin(f.t * 0.9 + i) * 0.004);
  const stems: [number, number, string][] = [[-0.05, 0.66, '#e5484d'], [-0.02, 0.63, '#f4a3b4'], [0.01, 0.62, '#f6cf4d'], [0.04, 0.65, '#e5484d'], [0.065, 0.69, '#f4a3b4']];
  ctx.strokeStyle = '#5f9a4e';
  ctx.lineWidth = 0.004;
  stems.forEach(([dx, ty], i) => {
    ctx.beginPath();
    ctx.moveTo(jx + dx * 0.2, jy - 0.05);
    ctx.quadraticCurveTo(jx + dx * 0.6, jy - 0.14, jx + dx + sway(i), ty);
    ctx.stroke();
  });
  ellipse(ctx, jx - 0.03, jy - 0.1, 0.008, 0.03, 0.4, '#6fa85a');
  ellipse(ctx, jx + 0.035, jy - 0.11, 0.008, 0.032, -0.4, '#6fa85a');
  stems.forEach(([dx, ty, col], i) => {
    const x = jx + dx + sway(i);
    ctx.beginPath();
    ctx.moveTo(x - 0.014, ty - 0.02);
    ctx.quadraticCurveTo(x - 0.016, ty + 0.012, x, ty + 0.012);
    ctx.quadraticCurveTo(x + 0.016, ty + 0.012, x + 0.014, ty - 0.02);
    ctx.lineTo(x + 0.005, ty - 0.008);
    ctx.lineTo(x, ty - 0.024);
    ctx.lineTo(x - 0.005, ty - 0.008);
    ctx.closePath();
    ctx.fillStyle = col;
    ctx.fill();
    ctx.fillStyle = withAlpha('#ffffff', 0.25);
    ctx.fillRect(x - 0.01, ty - 0.012, 0.004, 0.016);
  });
  ctx.beginPath();
  ctx.roundRect(jx - 0.035, jy - 0.075, 0.07, 0.075, 0.012);
  ctx.fillStyle = withAlpha('#cfe3dd', 0.75);
  ctx.fill();
  ctx.fillStyle = withAlpha('#9fc4bc', 0.6);
  ctx.fillRect(jx - 0.033, jy - 0.045, 0.066, 0.043);
  ctx.fillStyle = withAlpha('#ffffff', 0.5);
  ctx.fillRect(jx - 0.026, jy - 0.07, 0.006, 0.06);
  ellipse(ctx, jx, jy + 0.004, 0.04, 0.005, 0, withAlpha('#7a6a55', 0.35));
}
