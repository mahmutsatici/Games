import type { Body } from 'planck';
import { Sim, Ud, Crate } from './world';
import { WORLDS, hash, WorldDef } from './levels';
import { save } from './save';

export const W = 1280, H = 720;
/** 92 px per metre at rest: the rover body (~2.8 m) is ~20% of screen width. */
export const BASE_PPM = 92;

export function interp(b: Body, a: number) { const u = b.getUserData() as Ud, p = b.getPosition(); return { x: u.px + (p.x - u.px) * a, y: u.py + (p.y - u.py) * a, a: u.pa + (b.getAngle() - u.pa) * a }; }

export class Camera {
  x = 0; y = 0; zoom = 1; look = 0; init = false; S = BASE_PPM;
  follow(sim: Sim, dt: number) {
    const c = interp(sim.chassis, sim.alpha), v = sim.speed;
    const airH = sim.grounded === 0 ? Math.max(0, c.y - sim.groundY(c.x) - 0.8) : 0;
    const tz = Math.max(0.8, 1 - 0.2 * Math.min(1, Math.abs(v) / 13) - Math.min(0.2, airH * 0.06));
    const tl = Math.max(-1.5, Math.min(3.5, v * 0.32));
    if (!this.init) { this.zoom = tz; this.look = tl; }
    this.zoom += (tz - this.zoom) * (1 - Math.exp(-dt * (tz < this.zoom ? 2.2 : 1.1)));
    this.look += (tl - this.look) * (1 - Math.exp(-dt * 1.6));
    this.S = BASE_PPM * this.zoom * (1 + 0.07 * sim.punch);
    const tx = c.x + (W / 2 - W * 0.35) / this.S + this.look;
    const ty = c.y * 0.75 + (sim.groundY(c.x) + 1.0) * 0.25 + 50 / this.S;
    if (!this.init) { this.x = tx; this.y = ty; this.init = true; }
    this.x += (tx - this.x) * (1 - Math.exp(-dt * 9));
    this.y += (ty - this.y) * (1 - Math.exp(-dt * 4));
  }
}

// ---------------- cached sky ----------------
const planetCache = new Map<number, HTMLCanvasElement>();
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
// CPU-backed offscreen canvases: blitting them into the main canvas never needs a GPU readback
const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d', { willReadFrequently: true })!;
function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number) {
  g.beginPath(); for (let i = 0; i <= 12; i++) { const a = i / 12 * Math.PI * 2, rr = r * (0.7 + 0.5 * hash(seed + i)); g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.8); } g.closePath(); g.fill();
}
function planetCanvas(wd: WorldDef) {
  let c = planetCache.get(wd.id); if (c) return c;
  c = mk(300, 300); const g = ctx2d(c), cx = 150, cy = 150;
  if (wd.id === 0) { // Earth: continents, clouds, atmosphere glow, night side
    const R = 88;
    let rg = g.createRadialGradient(cx, cy, R * 0.9, cx, cy, R * 1.55); rg.addColorStop(0, 'rgba(120,200,255,.45)'); rg.addColorStop(1, 'rgba(120,200,255,0)'); g.fillStyle = rg; g.fillRect(0, 0, 300, 300);
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    rg = g.createRadialGradient(cx - 30, cy - 30, 10, cx, cy, R); rg.addColorStop(0, '#4fb4ff'); rg.addColorStop(0.7, '#1f62c8'); rg.addColorStop(1, '#0f2f78'); g.fillStyle = rg; g.fillRect(0, 0, 300, 300);
    g.fillStyle = '#5cbf62'; blob(g, cx - 35, cy - 10, 34, 3); blob(g, cx + 30, cy + 30, 26, 17); blob(g, cx + 22, cy - 46, 18, 31);
    g.fillStyle = '#c8b27a'; blob(g, cx - 28, cy - 2, 14, 51); g.fillStyle = '#3f9a4c'; blob(g, cx + 34, cy + 36, 12, 61);
    g.fillStyle = 'rgba(255,255,255,.8)'; for (let i = 0; i < 9; i++) { g.beginPath(); g.ellipse(cx - 80 + hash(i * 3) * 160, cy - 70 + hash(i * 7) * 140, 22 + hash(i) * 24, 6 + hash(i * 2) * 5, -0.2, 0, 7); g.fill(); }
    const sh = g.createLinearGradient(cx - R, 0, cx + R, 0); sh.addColorStop(0.45, 'rgba(0,4,20,0)'); sh.addColorStop(1, 'rgba(0,4,20,.7)'); g.fillStyle = sh; g.fillRect(0, 0, 300, 300);
    g.restore(); g.strokeStyle = 'rgba(170,225,255,.85)'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, R, Math.PI * 0.6, Math.PI * 1.5); g.stroke();
  } else if (wd.id === 1) { // Mars: hazy sun + small moon
    let rg = g.createRadialGradient(cx, cy, 4, cx, cy, 120); rg.addColorStop(0, 'rgba(255,250,230,1)'); rg.addColorStop(0.12, 'rgba(255,230,190,.95)'); rg.addColorStop(0.4, 'rgba(255,170,110,.25)'); rg.addColorStop(1, 'rgba(255,150,90,0)');
    g.fillStyle = rg; g.fillRect(0, 0, 300, 300);
    g.fillStyle = '#8a6a58'; g.save(); g.translate(60, 230); g.rotate(-0.4); g.beginPath(); g.ellipse(0, 0, 22, 15, 0, 0, 7); g.fill(); g.fillStyle = '#5e463a'; g.beginPath(); g.arc(-6, 3, 4, 0, 7); g.arc(7, -3, 3, 0, 7); g.fill(); g.restore();
  } else { // Ice moon: ringed gas giant
    const R = 95; g.save(); g.translate(cx, cy); g.rotate(-0.35);
    g.strokeStyle = 'rgba(255,230,180,.35)'; g.lineWidth = 14; g.beginPath(); g.ellipse(0, 0, 145, 32, 0, Math.PI, 0); g.stroke();
    g.beginPath(); g.arc(0, 0, R, 0, 7); g.save(); g.clip();
    const bands = ['#f1c27d', '#d9935a', '#f6dca8', '#c47a4a', '#ecc58f', '#b9683e', '#f3d39a'];
    for (let i = 0; i < 14; i++) { g.fillStyle = bands[i % bands.length]; g.fillRect(-R, -R + i * 14, 2 * R, 15); }
    const sh = g.createLinearGradient(-R, 0, R, 0); sh.addColorStop(0.4, 'rgba(10,10,40,0)'); sh.addColorStop(1, 'rgba(10,10,40,.65)'); g.fillStyle = sh; g.fillRect(-R, -R, 2 * R, 2 * R); g.restore();
    g.strokeStyle = 'rgba(255,235,190,.6)'; g.lineWidth = 10; g.beginPath(); g.ellipse(0, 0, 145, 32, 0, 0, Math.PI); g.stroke(); g.restore();
  }
  planetCache.set(wd.id, c); return c;
}
// Backdrop: the sky gradient is the canvas' CSS background (see skyCss), so the canvas only draws what covers it:
// tiny star rects, the planet, and the ridge silhouettes as plain polygons. Keeps per-pixel overdraw low.
const PERIOD = 2048, STAR_W = 1600;
const STARS = [0, 1, 2].map(l => Array.from({ length: 70 - l * 18 }, (_, i) => ({ x: hash(i * 13 + l * 101) * STAR_W, y: hash(i * 7 + l * 31) * 470, s: 1.2 + l * 0.8, b: 0.45 + hash(i * 3 + l) * 0.55 })));
let shoot = { t: 4, x: 0, y: 0 };
const RIDGE = [{ par: 0.06, base: 430, amp: 1.1 }, { par: 0.13, base: 475, amp: 0.9 }, { par: 0.24, base: 525, amp: 0.75 }];
function ridgeY(x: number, l: number) { const s = l * 17.3, k = Math.PI * 2 / PERIOD; return Math.sin(x * k * 3 + s) * 38 + Math.sin(x * k * 8 + s * 2) * 20 + Math.sin(x * k * 19 + s) * 8 + Math.abs(Math.sin(x * k + s)) * 50; }

/** CSS background for the canvas element: the sky never has to be painted by the canvas itself. */
export function skyCss(wi: number) {
  const wd = WORLDS[wi], neb = wd.id === 1 ? 'rgba(255,170,110,.12)' : wd.id === 2 ? 'rgba(120,220,255,.12)' : 'rgba(140,120,255,.10)';
  return `radial-gradient(ellipse 35% 30% at 22% 25%, ${neb}, transparent), radial-gradient(ellipse 30% 25% at 70% 45%, ${neb}, transparent), linear-gradient(180deg, ${wd.sky[0]} 0%, ${wd.sky[1]} 55%, ${wd.sky[2]} 100%)`;
}

export function backdrop(ctx: CanvasRenderingContext2D, wi: number, camX: number, camY: number, t: number, dt: number, groundBottom = H) {
  const wd = WORLDS[wi];
  ctx.fillStyle = wd.star;
  for (let l = 0; l < 3; l++) {
    const par = [3, 7, 14][l], tw = 0.7 + 0.3 * Math.sin(t * (1.1 + l * 0.7) + l * 2), y0 = -camY * l * 2;
    ctx.globalAlpha = (wi === 1 ? 0.5 : 1) * tw;
    for (const s of STARS[l]) { const x = ((s.x - camX * par) % STAR_W + STAR_W) % STAR_W - 160; if (x < -4 || x > W + 4) continue; ctx.fillRect(x, s.y + y0, s.s * s.b + 0.6, s.s * s.b + 0.6); }
  }
  ctx.globalAlpha = 1;
  shoot.t -= dt; if (shoot.t < 0) shoot = { t: 6 + Math.random() * 6, x: 200 + Math.random() * 900, y: 40 + Math.random() * 160 };
  if (shoot.t > 5.4 && shoot.t < 6.2) { const p = 1 - (shoot.t - 5.4) / 0.8, x = shoot.x + p * 260, y = shoot.y + p * 90; const g = ctx.createLinearGradient(x - 120, y - 42, x, y); g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(255,255,255,.9)'); ctx.strokeStyle = g; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(x - 120, y - 42); ctx.lineTo(x, y); ctx.stroke(); }
  ctx.drawImage(planetCanvas(wd), 860 - (camX * 0.8 % 80), 30 - camY * 2);
  for (let l = 0; l < 3; l++) {
    const R = RIDGE[l], off = camX * BASE_PPM * R.par, yoff = -camY * [4, 8, 14][l];
    const bottom = Math.min(groundBottom, l < 2 ? RIDGE[l + 1].base + 40 + yoff : H); // only down to where nearer layers / the ground cover it
    ctx.fillStyle = wd.ridges[l]; ctx.beginPath(); ctx.moveTo(0, bottom);
    for (let sx = 0; sx <= W + 16; sx += 16) ctx.lineTo(sx, R.base + yoff - ridgeY(sx + off, l) * R.amp);
    ctx.lineTo(W, bottom); ctx.closePath(); ctx.fill();
    if (l === 2) { ctx.strokeStyle = wd.ridgeRim; ctx.globalAlpha = 0.5; ctx.lineWidth = 2; ctx.beginPath(); for (let sx = 0; sx <= W + 16; sx += 16) { const y = R.base + yoff - ridgeY(sx + off, l) * R.amp; sx ? ctx.lineTo(sx, y) : ctx.moveTo(sx, y); } ctx.stroke(); ctx.globalAlpha = 1; }
  }
}

// ---------------- world ----------------
const lerpC = (a: string, b: string, t: number) => { const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16); const r = (pa >> 16) + ((pb >> 16) - (pa >> 16)) * t, g = ((pa >> 8) & 255) + (((pb >> 8) & 255) - ((pa >> 8) & 255)) * t, bl = (pa & 255) + ((pb & 255) - (pa & 255)) * t; return `rgb(${r | 0},${g | 0},${bl | 0})`; };
const speedLines = Array.from({ length: 16 }, (_, i) => ({ y: hash(i * 5.1) * H, x: hash(i * 2.3) * W, l: 80 + hash(i) * 160 }));
const storm = Array.from({ length: 34 }, (_, i) => ({ y: hash(i * 3.7) * H, x: hash(i * 1.9) * W, l: 30 + hash(i) * 90, v: 900 + hash(i * 4) * 900 }));

export function drawWorld(ctx: CanvasRenderingContext2D, sim: Sim, cam: Camera, t: number, dt: number) {
  const wd = sim.W, a = sim.alpha, S = cam.S, G = wd.ground;
  const sh = sim.shake, ox = (Math.random() - 0.5) * 22 * sh, oy = (Math.random() - 0.5) * 22 * sh;
  const X = (x: number) => (x - cam.x) * S + W / 2, Y = (y: number) => H / 2 - (y - cam.y) * S;
  const x0 = cam.x - (W / 2 + 40) / S, x1 = cam.x + (W / 2 + 40) / S;
  const step = 0.25, i0 = Math.floor(x0 / step), i1 = Math.ceil(x1 / step);
  const px: number[] = [], py: number[] = [];
  let maxPy = 0; for (let i = i0; i <= i1; i++) { px.push(X(i * step)); const yy = Y(sim.groundY(i * step)); py.push(yy); if (yy > maxPy) maxPy = yy; }
  const n = px.length;
  backdrop(ctx, sim.L.world, cam.x, cam.y - sim.groundY(4), t, dt, Math.min(H, maxPy + 30 + 22 * sh));
  ctx.save(); ctx.translate(ox, oy);
  // ---- finish outpost & markers (behind the ground line) ----
  if (!sim.L.endless) drawOutpost(ctx, sim, X, Y, S, t);
  for (let m = Math.ceil(x0 / 50) * 50; m < x1; m += 50) if (m > 0 && (sim.L.endless || m < sim.L.length - 10)) drawMarker(ctx, X(m), Y(sim.groundY(m)), S, m, wd);
  for (const f of sim.terrain.feats) if (f.k === 'ramp' && f.x - 7 > x0 && f.x - 7 < x1) drawSign(ctx, X(f.x - 7), Y(sim.groundY(f.x - 7)), S, wd);
  // ---- ground body ----
  ctx.beginPath(); ctx.moveTo(px[0], H + 60); for (let i = 0; i < n; i++) ctx.lineTo(px[i], py[i]); ctx.lineTo(px[n - 1], H + 60); ctx.closePath();
  let minY = H; for (let i = 0; i < n; i++) minY = Math.min(minY, py[i]);
  const dg = ctx.createLinearGradient(0, minY + 60, 0, minY + 360); dg.addColorStop(0, G.mid); dg.addColorStop(1, G.deep); ctx.fillStyle = dg; ctx.fill();
  // embedded rocks & crater decals with shaded inner side
  const cs = 3.4;
  for (let c = Math.floor(x0 / cs) - 1; c <= Math.ceil(x1 / cs); c++) {
    const hh = hash(c * 3.13 + sim.L.seed), wx = c * cs + hash(c * 7.7) * cs, depth = 0.55 + hash(c * 1.7) * 2.6, sx = X(wx), sy = Y(sim.groundY(wx) - depth), r = (0.18 + hash(c * 5.9) * 0.4) * S;
    if (hh < 0.45) { // rock
      ctx.fillStyle = wd.rock[1]; ctx.beginPath(); for (let k = 0; k < 7; k++) { const an = k / 7 * Math.PI * 2, rr = r * (0.75 + 0.35 * hash(c + k * 11)); ctx.lineTo(sx + Math.cos(an) * rr, sy + Math.sin(an) * rr * 0.75); } ctx.closePath(); ctx.fill();
      ctx.fillStyle = wd.rock[0]; ctx.beginPath(); ctx.ellipse(sx - r * 0.15, sy - r * 0.18, r * 0.62, r * 0.42, -0.2, 0, 7); ctx.fill();
      ctx.fillStyle = wd.rock[2]; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(sx - r * 0.35, sy - r * 0.35, r * 0.22, r * 0.12, -0.4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    } else if (hh < 0.8) { // crater decal
      const rx = r * 1.7, ry = r * 0.6;
      ctx.fillStyle = G.shade; ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, 7); ctx.fill();
      ctx.fillStyle = G.deep; ctx.globalAlpha = 0.55; ctx.beginPath(); ctx.ellipse(sx, sy - ry * 0.25, rx * 0.88, ry * 0.7, 0, Math.PI, 0); ctx.fill(); ctx.globalAlpha = 1;
      ctx.strokeStyle = G.top; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0.15, Math.PI - 0.15); ctx.stroke();
    }
  }
  // bands under the surface are filled polygons (much cheaper to rasterise than wide strokes)
  const band = (o0: number, o1: number, from = 0, to = n - 1) => { ctx.beginPath(); ctx.moveTo(px[from], py[from] + o0); for (let i = from + 1; i <= to; i++) ctx.lineTo(px[i], py[i] + o0); for (let i = to; i >= from; i--) ctx.lineTo(px[i], py[i] + o1); ctx.closePath(); };
  ctx.globalAlpha = 0.5; ctx.fillStyle = G.shade; band(14, 40); ctx.fill(); ctx.globalAlpha = 1;
  // lit top band: slopes facing the light (upper left) are brighter, 5 shade buckets
  for (let b = 0; b < 5; b++) {
    ctx.fillStyle = lerpC(G.shade, G.top, [0.15, 0.4, 0.62, 0.82, 1][b]); ctx.beginPath();
    for (let i = 1; i < n; i++) { const sl = (py[i - 1] - py[i]) / (px[i] - px[i - 1]), k = Math.max(0, Math.min(1, 0.6 + sl * 1.4)), bk = k < 0.28 ? 0 : k < 0.5 ? 1 : k < 0.72 ? 2 : k < 0.9 ? 3 : 4;
      if (bk !== b) continue; const xa = px[i - 1] - 0.6, xb = px[i] + 0.6; ctx.moveTo(xa, py[i - 1]); ctx.lineTo(xb, py[i]); ctx.lineTo(xb, py[i] + 18); ctx.lineTo(xa, py[i - 1] + 18); ctx.closePath(); }
    ctx.fill();
  }
  // ice patches: glossy sheet on the surface
  if (sim.L.ice) for (const p of sim.terrain.ice) { if (p.x1 < x0 || p.x0 > x1) continue;
    const f = Math.max(0, Math.ceil((p.x0 - i0 * step) / step)), l = Math.min(n - 1, Math.floor((p.x1 - i0 * step) / step)); if (l <= f) continue;
    ctx.fillStyle = '#8fe6ff'; band(-2, 12, f, l); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3; ctx.beginPath(); for (let i = f + 2; i < l - 1; i += 6) { ctx.moveTo(px[i], py[i] + 5); ctx.lineTo(px[i + 2], py[i + 2] + 3); } ctx.stroke(); }
  ctx.fillStyle = G.rim; band(-1, 4); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = G.line; ctx.lineJoin = 'round'; ctx.beginPath(); for (let i = 0; i < n; i++) i ? ctx.lineTo(px[i], py[i]) : ctx.moveTo(px[i], py[i]); ctx.stroke();
  // meteor scorch marks
  for (const c of sim.craters) if (c.x > x0 - 2 && c.x < x1 + 2) { ctx.fillStyle = 'rgba(20,14,10,.45)'; ctx.beginPath(); ctx.ellipse(X(c.x), Y(sim.groundY(c.x)) + 3, c.r * S * 0.75, 6, 0, 0, 7); ctx.fill(); }
  // surface pebbles
  for (let c = Math.floor(x0 / 2.2); c <= Math.ceil(x1 / 2.2); c++) { if (hash(c * 2.71 + 5) > 0.45) continue; const wx = c * 2.2 + hash(c * 9.3) * 1.5, r = (0.06 + hash(c * 4.1) * 0.1) * S, sx = X(wx), sy = Y(sim.groundY(wx));
    ctx.fillStyle = wd.rock[1]; ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.35, r, r * 0.65, 0, 0, 7); ctx.fill(); ctx.fillStyle = wd.rock[2]; ctx.beginPath(); ctx.ellipse(sx - r * 0.3, sy - r * 0.6, r * 0.4, r * 0.22, 0, 0, 7); ctx.fill(); }
  // ---- pickups ----
  const coinSpr = sprite('coin', [-0.33, -0.33, 0.33, 0.36], (g, s) => drawCoin(g, 0, 0, 0.27 * s, 0));
  for (const p of sim.terrain.pickups) { if (p.taken || p.x < x0 || p.x > x1) continue; const sx = X(p.x), sy = Y(p.y) + Math.sin(t * 3 + p.x) * 4; if (p.k === 'coin') blit(ctx, coinSpr, sx, sy, 0, S, Math.max(0.15, Math.abs(Math.cos((t + p.x * 0.4) * 2.5))), 1); else drawCell(ctx, sx, sy, S, t); }
  // ---- meteor warnings ----
  for (const m of sim.meteors) drawMeteor(ctx, sim, m.x, m.t, X, Y, S, t);
  // ---- rover ground shadow ----
  const ch = interp(sim.chassis, a), gy = sim.groundY(ch.x), hgt = Math.max(0, ch.y - gy);
  ctx.fillStyle = `rgba(0,0,0,${0.32 * Math.max(0.15, 1 - hgt / 6)})`; ctx.beginPath(); ctx.ellipse(X(ch.x), Y(gy) + 2, S * (1.6 + hgt * 0.1), S * 0.16, 0, 0, 7); ctx.fill();
  // ---- rocks & slimes ----
  for (const b of sim.rocks) { const q = interp(b, a), vs = ((b.getFixtureList()!.getShape() as any).m_vertices as { x: number; y: number }[]); ctx.save(); ctx.translate(X(q.x), Y(q.y)); ctx.rotate(-q.a);
    ctx.beginPath(); vs.forEach((v, i) => i ? ctx.lineTo(v.x * S, -v.y * S) : ctx.moveTo(v.x * S, -v.y * S)); ctx.closePath(); ctx.fillStyle = wd.rock[0]; ctx.fill();
    ctx.save(); ctx.clip(); ctx.fillStyle = wd.rock[1]; ctx.fillRect(-S, 0, 2 * S, S); ctx.fillStyle = wd.rock[2]; ctx.globalAlpha = 0.7; ctx.fillRect(-S, -S, S * 0.9, S * 0.75); ctx.restore();
    ctx.globalAlpha = 1; ctx.strokeStyle = G.line; ctx.lineWidth = 2.5; ctx.stroke(); ctx.restore(); }
  for (const s of sim.slimes) { const q = interp(s.body, a), dir = Math.sign(ch.x - q.x) || 1, sq = 1 + Math.sin(s.phase) * 0.09;
    blit(ctx, sprite('slime:' + dir, [-0.45, -0.66, 0.45, 0.42], (g, sz) => drawSlime(g, { x: 0, y: 0, a: 0 }, 0, () => 0, () => 0, sz, dir)), X(q.x), Y(q.y), q.a, S, 1 / sq, sq); }
  // ---- rover + crates ----
  drawRover(ctx, sim, a, X, Y, S, t);
  // ---- UFO ----
  if (sim.ufo) drawUfo(ctx, sim, X, Y, S, t);
  // ---- particles ----
  for (const p of sim.particles) {
    const al = p.life / p.max, sx = X(p.x), sy = Y(p.y);
    if (p.type === 'spark') { ctx.strokeStyle = `rgba(255,${190 + 60 * al | 0},90,${al})`; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - p.vx * 0.03 * S, sy + p.vy * 0.03 * S); ctx.stroke(); continue; }
    if (p.type === 'flash') { const k = 1 - al; ctx.fillStyle = `rgba(255,240,200,${al * 0.8})`; ctx.beginPath(); ctx.arc(sx, sy, (0.6 + k * 3) * S, 0, 7); ctx.fill(); ctx.strokeStyle = `rgba(255,170,80,${al})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(sx, sy, (1 + k * 4.5) * S, 0, 7); ctx.stroke(); continue; }
    ctx.globalAlpha = p.type === 'dust' || p.type === 'smoke' ? al * 0.55 : al;
    ctx.fillStyle = p.type === 'goo' ? '#7be05a' : p.type === 'coin' ? '#ffd23a' : p.type === 'debris' ? wd.rock[1] : p.type === 'glass' ? '#bff3ff' : p.type === 'energy' ? '#7dff9a' : p.type === 'smoke' ? (al > 0.6 ? '#ffb35c' : '#9aa0ad') : wd.dust;
    const r = p.size * S * (p.type === 'dust' || p.type === 'smoke' ? 1.6 - al * 0.6 : 1);
    if (p.type === 'debris' || p.type === 'glass') ctx.fillRect(sx - r, sy - r, r * 2, r * 2); else { ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // ---- score popups ----
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `900 ${0.5 * S | 0}px system-ui,"Segoe UI",Roboto,Arial,sans-serif`; ctx.lineJoin = 'round';
  for (const p of sim.popups) { ctx.globalAlpha = Math.min(1, p.life * 2); const sx = X(p.x), sy = Y(p.y); ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(20,16,30,.85)'; ctx.strokeText('+' + p.n, sx, sy); ctx.fillStyle = p.color; ctx.fillText('+' + p.n, sx, sy); }
  ctx.globalAlpha = 1;
  ctx.restore();
  // ---- screen-space effects ----
  const v = Math.abs(sim.speed), sl = sim.turboOn ? 1 : Math.max(0, (v - 8) / 6);
  if (sl > 0) { ctx.strokeStyle = `rgba(255,255,255,${0.22 * Math.min(1, sl)})`; ctx.lineWidth = 2; for (const l of speedLines) { l.x -= (900 + 600 * sl) * dt; if (l.x < -l.l) { l.x = W + Math.random() * 200; l.y = Math.random() * H; } ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + l.l, l.y); ctx.stroke(); } }
  if (sim.storm > 0.02) drawStorm(ctx, sim.storm, X(ch.x), dt);
  if (sim.hitFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${sim.hitFlash * 0.35})`; ctx.fillRect(0, 0, W, H); }
  // off-screen meteor indicator
  for (const m of sim.meteors) { const sx = X(m.x); if (sx > W - 20) { const yy = Math.min(H - 80, Math.max(140, Y(sim.groundY(m.x)))); warnIcon(ctx, W - 46, yy, 0.6 + 0.4 * Math.sin(t * 20)); } }
}

function drawStorm(ctx: CanvasRenderingContext2D, k: number, roverX: number, dt: number) {
  // the haze itself is a CSS overlay (#storm); the canvas only draws wind streaks
  void roverX;
  ctx.strokeStyle = `rgba(255,205,160,${0.35 * Math.min(1, k)})`; ctx.lineWidth = 2;
  for (const s of storm) { s.x -= s.v * dt; if (s.x < -s.l) { s.x = W + Math.random() * 100; s.y = Math.random() * H; } ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.l, s.y - s.l * 0.08); ctx.stroke(); }
}
function warnIcon(ctx: CanvasRenderingContext2D, x: number, y: number, al: number) {
  ctx.globalAlpha = al; ctx.fillStyle = '#ff4a3d'; ctx.strokeStyle = '#5a0d08'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x + 26, y + 20); ctx.lineTo(x - 26, y + 20); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillRect(x - 3, y - 10, 6, 17); ctx.fillRect(x - 3, y + 10, 6, 6); ctx.globalAlpha = 1;
}

function drawMeteor(ctx: CanvasRenderingContext2D, sim: Sim, mx: number, tl: number, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const gy = sim.groundY(mx), sx = X(mx), sy = Y(gy), p = 1 - tl / 1.6, pulse = 0.5 + 0.5 * Math.sin(t * 18);
  const rx = 2.4 * S * (0.6 + 0.4 * (1 - p));
  ctx.fillStyle = `rgba(0,0,0,${0.15 + 0.35 * p})`; ctx.beginPath(); ctx.ellipse(sx, sy + 3, rx * 0.6 * (0.4 + p), 9 + 6 * p, 0, 0, 7); ctx.fill();
  ctx.strokeStyle = `rgba(255,${70 + 90 * pulse | 0},60,${0.55 + 0.45 * pulse})`; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(sx, sy + 3, rx, rx * 0.22, 0, 0, 7); ctx.stroke();
  ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(sx, sy + 3, rx * 0.45, rx * 0.1, 0, 0, 7); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(sx - rx * 1.15, sy + 3); ctx.lineTo(sx - rx * 0.8, sy + 3); ctx.moveTo(sx + rx * 0.8, sy + 3); ctx.lineTo(sx + rx * 1.15, sy + 3); ctx.stroke();
  if (tl < 0.8) { const k = tl / 0.8, fx = sx + k * 300, fy = sy - k * 620;
    const tg = ctx.createLinearGradient(fx, fy, fx + 90, fy - 190); tg.addColorStop(0, 'rgba(255,200,90,.9)'); tg.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.strokeStyle = tg; ctx.lineWidth = 22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(fx + 90, fy - 190); ctx.stroke();
    const mg = ctx.createRadialGradient(fx, fy, 2, fx, fy, 40); mg.addColorStop(0, '#fff7cc'); mg.addColorStop(0.45, '#ff9a2e'); mg.addColorStop(1, 'rgba(255,60,0,0)'); ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(fx, fy, 40, 0, 7); ctx.fill();
    ctx.fillStyle = '#6a5446'; ctx.strokeStyle = '#3a2b22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(fx, fy, 16, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#8c7262'; ctx.beginPath(); ctx.arc(fx - 5, fy - 5, 6, 0, 7); ctx.fill(); }
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  const sx = Math.max(0.15, Math.abs(Math.cos(t * 2.5)));
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
  ctx.fillStyle = '#c98a10'; ctx.beginPath(); ctx.arc(0, 2, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffcf3a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffe78a'; ctx.beginPath(); ctx.arc(-r * 0.2, -r * 0.2, r * 0.6, 0, 7); ctx.fill();
  ctx.strokeStyle = '#9a6508'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
  ctx.fillStyle = '#c98a10'; ctx.fillRect(-r * 0.14, -r * 0.5, r * 0.28, r);
  ctx.restore();
}
function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number) {
  const w = 0.42 * S, h = 0.62 * S, gl = 0.5 + 0.5 * Math.sin(t * 5);
  const g = ctx.createRadialGradient(x, y, 2, x, y, S * 0.8); g.addColorStop(0, `rgba(120,255,150,${0.35 + 0.25 * gl})`); g.addColorStop(1, 'rgba(120,255,150,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, S * 0.8, 0, 7); ctx.fill();
  ctx.fillStyle = '#2a7a3c'; ctx.strokeStyle = '#174a24'; ctx.lineWidth = 2.5; rr(ctx, x - w / 2, y - h / 2, w, h, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#5ee06a'; rr(ctx, x - w / 2 + 4, y - h / 2 + 4, w - 8, h - 8, 4); ctx.fill();
  ctx.fillStyle = '#174a24'; ctx.fillRect(x - w * 0.2, y - h / 2 - 5, w * 0.4, 6);
  ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(x + 3, y - h * 0.3); ctx.lineTo(x - w * 0.22, y + 2); ctx.lineTo(x, y + 2); ctx.lineTo(x - 3, y + h * 0.3); ctx.lineTo(x + w * 0.22, y - 3); ctx.lineTo(x, y - 3); ctx.closePath(); ctx.fill();
}

function drawSlime(ctx: CanvasRenderingContext2D, q: { x: number; y: number; a: number }, phase: number, X: (x: number) => number, Y: (y: number) => number, S: number, roverX: number) {
  const sq = 1 + Math.sin(phase) * 0.09, rx = 0.36 * S, ry = 0.29 * S, look = Math.sign(roverX - q.x) * 0.06 * S;
  ctx.save(); ctx.translate(X(q.x), Y(q.y)); ctx.rotate(-q.a); ctx.scale(1 / sq, sq);
  ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.beginPath(); ctx.ellipse(0, ry * 0.9, rx * 1.05, ry * 0.25, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7be05a'; ctx.beginPath(); ctx.ellipse(0, 2, rx, ry, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = '#46b034'; ctx.beginPath(); ctx.ellipse(rx * 0.15, ry * 0.75, rx * 1.1, ry * 0.7, 0, 0, 7); ctx.fill(); ctx.restore();
  ctx.strokeStyle = '#2f7a22'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(0, 2, rx, ry, 0, 0, 7); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(-rx * 0.45, -ry * 0.35, rx * 0.22, ry * 0.14, -0.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2f7a22'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-rx * 0.25, -ry * 0.8); ctx.lineTo(-rx * 0.45, -ry * 1.6); ctx.moveTo(rx * 0.25, -ry * 0.8); ctx.lineTo(rx * 0.45, -ry * 1.6); ctx.stroke();
  ctx.fillStyle = '#ff7fc4'; ctx.beginPath(); ctx.arc(-rx * 0.45, -ry * 1.6, 0.06 * S, 0, 7); ctx.arc(rx * 0.45, -ry * 1.6, 0.06 * S, 0, 7); ctx.fill();
  for (const ex of [-0.3, 0.3]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ex * rx, -ry * 0.05, 0.085 * S, 0, 7); ctx.fill(); ctx.fillStyle = '#10200c'; ctx.beginPath(); ctx.arc(ex * rx + look * 0.4, -ry * 0.02, 0.045 * S, 0, 7); ctx.fill(); }
  ctx.restore();
}

const STENCIL = ['ring', 'arrow', 'star'];
function drawCrate(ctx: CanvasRenderingContext2D, c: Crate & { half: number }, x: number, y: number, ang: number, S: number, shakeT: number) {
  const h = c.half * S;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-ang); if (c.lost) ctx.globalAlpha = 0.8;
  if (shakeT > 0) ctx.translate(Math.sin(shakeT * 60) * 2, 0);
  if (c.glass) {
    ctx.fillStyle = 'rgba(160,232,255,.45)'; ctx.fillRect(-h, -h, 2 * h, 2 * h);
    ctx.fillStyle = 'rgba(80,190,230,.55)'; rr(ctx, -h * 0.35, -h * 0.55, h * 0.7, h * 1.3, 5); ctx.fill(); ctx.fillRect(-h * 0.15, -h * 0.8, h * 0.3, h * 0.3);
    ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-h * 0.7, h * 0.2); ctx.lineTo(-h * 0.2, -h * 0.7); ctx.stroke();
    ctx.strokeStyle = '#3d8fb3'; ctx.lineWidth = 4; ctx.strokeRect(-h + 2, -h + 2, 2 * h - 4, 2 * h - 4);
  } else {
    ctx.fillStyle = '#d99a4e'; ctx.fillRect(-h, -h, 2 * h, 2 * h);
    ctx.fillStyle = '#f2bd73'; ctx.fillRect(-h, -h, 2 * h, h * 0.22); ctx.fillRect(-h, -h, h * 0.22, 2 * h);
    ctx.fillStyle = '#a8692c'; ctx.fillRect(-h, h * 0.78, 2 * h, h * 0.22); ctx.fillRect(h * 0.78, -h, h * 0.22, 2 * h);
    ctx.fillStyle = '#8a5422'; ctx.fillRect(-h, -h * 0.36, 2 * h, 2); ctx.fillRect(-h, h * 0.32, 2 * h, 2);
    ctx.fillStyle = '#5a3a1e'; for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { ctx.beginPath(); ctx.arc(nx * h * 0.72, ny * h * 0.72, 2.2, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(110,60,20,.7)'; ctx.strokeStyle = 'rgba(110,60,20,.7)'; ctx.lineWidth = 3; const st = STENCIL[c.idx % 3];
    if (st === 'ring') { ctx.beginPath(); ctx.arc(0, 0, h * 0.28, 0, 7); ctx.fill(); ctx.beginPath(); ctx.ellipse(0, 0, h * 0.55, h * 0.16, -0.3, 0, 7); ctx.stroke(); }
    else if (st === 'arrow') { ctx.beginPath(); ctx.moveTo(0, -h * 0.5); ctx.lineTo(h * 0.35, -h * 0.1); ctx.lineTo(h * 0.12, -h * 0.1); ctx.lineTo(h * 0.12, h * 0.45); ctx.lineTo(-h * 0.12, h * 0.45); ctx.lineTo(-h * 0.12, -h * 0.1); ctx.lineTo(-h * 0.35, -h * 0.1); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? h * 0.2 : h * 0.45, an = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(Math.cos(an) * r, Math.sin(an) * r); } ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = '#6b3f17'; ctx.lineWidth = 2.5; ctx.strokeRect(-h + 1, -h + 1, 2 * h - 2, 2 * h - 2);
  }
  ctx.restore();
}

// ---------------- sprites ----------------
// Detailed, many-path objects (rover body, wheels, crates, coins, slimes) are rendered once into CPU canvases at the
// current pixel density and blitted with a transform. One drawImage instead of dozens of antialiased paths.
let pxScale = 1;
export function setPixelScale(k: number) { pxScale = Math.max(0.25, Math.round(k * 20) / 20); }
const SPR_S = BASE_PPM * 1.08;
type Spr = { c: HTMLCanvasElement; w: number; h: number; ox: number; oy: number };
const sprites = new Map<string, Spr>();
/** bounds [left, top, right, bottom] in metres around the drawing origin (screen orientation, y down) */
function sprite(key: string, b: [number, number, number, number], draw: (g: CanvasRenderingContext2D, S: number) => void): Spr {
  const k = key + '@' + pxScale; let sp = sprites.get(k);
  if (!sp) {
    if (sprites.size > 160) sprites.clear();
    const w = (b[2] - b[0]) * SPR_S, h = (b[3] - b[1]) * SPR_S, c = mk(Math.ceil(w * pxScale), Math.ceil(h * pxScale)), g = ctx2d(c);
    g.scale(pxScale, pxScale); g.translate(-b[0] * SPR_S, -b[1] * SPR_S); draw(g, SPR_S); sp = { c, w, h, ox: b[0] * SPR_S, oy: b[1] * SPR_S }; sprites.set(k, sp);
  }
  return sp;
}
function blit(ctx: CanvasRenderingContext2D, sp: Spr, x: number, y: number, ang: number, S: number, sx = 1, sy = 1) {
  const f = S / SPR_S; ctx.save(); ctx.translate(x, y); if (ang) ctx.rotate(-ang); ctx.scale(f * sx, f * sy); ctx.drawImage(sp.c, sp.ox, sp.oy, sp.w, sp.h); ctx.restore();
}
const OUT = '#4a5366';
function roverBody(ctx: CanvasRenderingContext2D, s: number) {
  ctx.fillStyle = '#566074'; rr(ctx, -1.38 * s, 0.02 * s, 2.76 * s, 0.22 * s, 0.08 * s); ctx.fill();
  ctx.fillStyle = '#3a4152'; ctx.fillRect(-1.5 * s, -0.02 * s, 0.16 * s, 0.12 * s); // exhaust
  rr(ctx, -1.38 * s, -0.2 * s, 2.8 * s, 0.38 * s, 0.1 * s); ctx.fillStyle = '#f4f6fa'; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = '#ccd3df'; ctx.fillRect(-1.4 * s, 0.05 * s, 2.9 * s, 0.2 * s);
  ctx.fillStyle = '#ff7a2f'; ctx.fillRect(-1.4 * s, -0.08 * s, 2.9 * s, 0.1 * s); ctx.fillStyle = '#ffa262'; ctx.fillRect(-1.4 * s, -0.08 * s, 2.9 * s, 0.025 * s); ctx.restore();
  ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; rr(ctx, -1.38 * s, -0.2 * s, 2.8 * s, 0.38 * s, 0.1 * s); ctx.stroke();
  ctx.fillStyle = '#ff3b3b'; ctx.fillRect(-1.41 * s, -0.14 * s, 0.06 * s, 0.1 * s);
  // bumper plate (grows with bumper upgrade)
  const bp = 0.1 + 0.04 * save.up.bumper; ctx.fillStyle = '#8a93a6'; ctx.beginPath(); ctx.moveTo(1.4 * s, -0.16 * s); ctx.lineTo((1.42 + bp) * s, 0); ctx.lineTo(1.4 * s, 0.2 * s); ctx.closePath(); ctx.fill(); ctx.strokeStyle = OUT; ctx.stroke();
}
function roverCab(ctx: CanvasRenderingContext2D, s: number, bedH: number) {
  for (const wx of [-1.33, 0.48]) { ctx.fillStyle = '#e8ecf3'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; rr(ctx, (wx - 0.06) * s, -(0.18 + bedH) * s, 0.12 * s, bedH * s, 0.03 * s); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ff7a2f'; ctx.fillRect((wx - 0.06) * s, -(0.18 + bedH) * s, 0.12 * s, 0.07 * s); }
  const cab = () => { ctx.beginPath(); ctx.moveTo(0.52 * s, -0.16 * s); ctx.lineTo(0.52 * s, -0.8 * s); ctx.quadraticCurveTo(0.52 * s, -0.92 * s, 0.64 * s, -0.92 * s); ctx.lineTo(1.04 * s, -0.92 * s); ctx.lineTo(1.42 * s, -0.5 * s); ctx.lineTo(1.42 * s, -0.16 * s); ctx.closePath(); };
  cab(); ctx.fillStyle = '#f4f6fa'; ctx.fill();
  ctx.save(); cab(); ctx.clip(); ctx.fillStyle = '#d3d9e4'; ctx.fillRect(0.52 * s, -0.36 * s, s, 0.22 * s); ctx.fillRect(1.25 * s, -1 * s, 0.3 * s, s);
  ctx.fillStyle = '#ff7a2f'; ctx.fillRect(0.5 * s, -0.42 * s, s, 0.08 * s); ctx.restore();
  cab(); ctx.strokeStyle = OUT; ctx.lineWidth = 2.5; ctx.stroke();
  // windshield with driver helmet + reflection
  const win = () => { ctx.beginPath(); ctx.moveTo(0.7 * s, -0.84 * s); ctx.lineTo(1.0 * s, -0.84 * s); ctx.lineTo(1.33 * s, -0.5 * s); ctx.lineTo(0.7 * s, -0.5 * s); ctx.closePath(); };
  win(); const wg = ctx.createLinearGradient(0, -0.84 * s, 0, -0.5 * s); wg.addColorStop(0, '#c9f2ff'); wg.addColorStop(1, '#3d8fd0'); ctx.fillStyle = wg; ctx.fill();
  ctx.save(); win(); ctx.clip();
  ctx.fillStyle = '#eef1f6'; ctx.beginPath(); ctx.arc(0.92 * s, -0.6 * s, 0.15 * s, 0, 7); ctx.fill(); ctx.fillStyle = '#1d3557'; ctx.beginPath(); ctx.ellipse(0.98 * s, -0.61 * s, 0.09 * s, 0.075 * s, 0, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.moveTo(0.95 * s, -0.86 * s); ctx.lineTo(1.05 * s, -0.86 * s); ctx.lineTo(0.85 * s, -0.48 * s); ctx.lineTo(0.75 * s, -0.48 * s); ctx.closePath(); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(1.12 * s, -0.86 * s); ctx.lineTo(1.16 * s, -0.86 * s); ctx.lineTo(0.98 * s, -0.48 * s); ctx.lineTo(0.94 * s, -0.48 * s); ctx.closePath(); ctx.fill();
  ctx.restore(); win(); ctx.strokeStyle = OUT; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#fff6c8'; ctx.strokeStyle = OUT; ctx.lineWidth = 2; rr(ctx, 1.36 * s, -0.36 * s, 0.08 * s, 0.14 * s, 3); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#3a4152'; ctx.fillRect(0.66 * s, -0.98 * s, 0.32 * s, 0.06 * s);
  ctx.strokeStyle = '#5b6476'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0.64 * s, -0.92 * s); ctx.lineTo(0.55 * s, -1.42 * s); ctx.stroke();
}

function drawRover(ctx: CanvasRenderingContext2D, sim: Sim, a: number, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const ch = interp(sim.chassis, a), ca = Math.cos(ch.a), sa = Math.sin(ch.a), cx = X(ch.x), cy = Y(ch.y);
  const toLocal = (wx: number, wy: number) => { const dx = wx - ch.x, dy = wy - ch.y; return { x: dx * ca + dy * sa, y: -dx * sa + dy * ca }; };
  // headlight cone + turbo flame
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-ch.a);
  const hg = ctx.createLinearGradient(1.42 * S, 0, 3.6 * S, 0); hg.addColorStop(0, 'rgba(255,244,200,.3)'); hg.addColorStop(1, 'rgba(255,244,200,0)');
  ctx.fillStyle = hg; ctx.beginPath(); ctx.moveTo(1.42 * S, -0.34 * S); ctx.lineTo(3.6 * S, -0.85 * S); ctx.lineTo(3.6 * S, 0.4 * S); ctx.lineTo(1.42 * S, -0.22 * S); ctx.closePath(); ctx.fill();
  if (sim.turboOn) { const f = 0.75 + Math.random() * 0.45; const fg = ctx.createLinearGradient(-1.45 * S, 0, -1.45 * S - 1.5 * S * f, 0); fg.addColorStop(0, '#fff6c8'); fg.addColorStop(0.35, '#ffa13a'); fg.addColorStop(1, 'rgba(255,70,20,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-1.45 * S, -0.16 * S); ctx.quadraticCurveTo(-1.45 * S - 1.5 * S * f, 0, -1.45 * S, 0.12 * S); ctx.closePath(); ctx.fill(); }
  // springs that visibly compress
  for (let i = 0; i < 2; i++) {
    const w = interp(sim.wheels[i], a), lw = toLocal(w.x, w.y), ax = i ? 0.95 : -0.95, top = -0.02 * S, bot = -lw.y * S, sx = lw.x * S;
    ctx.strokeStyle = '#3a4152'; ctx.lineWidth = 0.08 * S; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(ax * S, top); ctx.lineTo(sx, bot); ctx.stroke();
    ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 0.05 * S; ctx.beginPath(); const N = 7, len = bot - top;
    for (let k = 0; k <= N * 2; k++) { const f = k / (N * 2), yy = top + len * (0.1 + f * 0.65), xx = ax * S + (sx - ax * S) * f + (k % 2 ? 1 : -1) * 0.13 * S; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke();
  }
  ctx.restore();
  const wheel = sprite('wheel', [-0.5, -0.5, 0.5, 0.5], (g, s) => drawWheel(g, 0, 0, 0, s, false));
  for (let i = 0; i < 2; i++) { const w = interp(sim.wheels[i], a); blit(ctx, wheel, X(w.x), Y(w.y), w.a, S); if (sim.stickT > 0) drawGoo(ctx, X(w.x), Y(w.y), w.a, S); }
  blit(ctx, sprite('body:' + save.up.bumper, [-1.56, -0.26, 1.8, 0.3], roverBody), cx, cy, ch.a, S);
  for (const c of sim.crates) { if (c.gone) continue; const q = interp(c.body, a), h = sim.crateHalf;
    const sp = sprite(`crate:${c.glass ? 'g' : c.idx % 3}:${h}`, [-h - 0.03, -h - 0.03, h + 0.03, h + 0.03], (g, s) => drawCrate(g, { ...c, lost: false, half: h }, 0, 0, 0, s, 0));
    if (c.lost) ctx.globalAlpha = 0.8; blit(ctx, sp, X(q.x), Y(q.y), q.a, S); ctx.globalAlpha = 1; }
  blit(ctx, sprite('cab:' + sim.wallH.toFixed(3), [-1.45, -1.48, 1.48, -0.1], (g, s) => roverCab(g, s, sim.wallH)), cx, cy, ch.a, S);
  // blinking antenna light + shield bubble
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-ch.a); const s = S, on = Math.sin(t * 6) > 0;
  if (on) { ctx.fillStyle = 'rgba(255,90,90,.35)'; ctx.beginPath(); ctx.arc(0.55 * s, -1.42 * s, 0.18 * s, 0, 7); ctx.fill(); }
  ctx.fillStyle = on ? '#ff4a4a' : '#7a2020'; ctx.beginPath(); ctx.arc(0.55 * s, -1.42 * s, 0.055 * s, 0, 7); ctx.fill();
  if (sim.shields > 0 || sim.shieldFlash > 0) { const f = sim.shieldFlash; ctx.strokeStyle = `rgba(110,220,255,${0.28 + 0.14 * Math.sin(t * 4) + f * 0.6})`; ctx.lineWidth = 2.5 + f * 6; ctx.fillStyle = `rgba(110,220,255,${0.05 + f * 0.2})`; ctx.beginPath(); ctx.ellipse(0, -0.4 * s, 1.85 * s, 1.15 * s, 0, 0, 7); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}
function drawGoo(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, S: number) {
  const r = 0.42 * S; ctx.fillStyle = 'rgba(123,224,90,.85)';
  for (let k = 0; k < 3; k++) { const an = k * 2.1 - ang; ctx.beginPath(); ctx.arc(x + Math.cos(an) * r * 0.85, y + Math.sin(an) * r * 0.85, r * 0.22, 0, 7); ctx.fill(); }
}

function drawWheel(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, S: number, goo: boolean) {
  const r = 0.42 * S;
  ctx.save(); ctx.translate(x, y); ctx.rotate(-ang);
  ctx.fillStyle = '#2b2f39'; for (let k = 0; k < 14; k++) { ctx.save(); ctx.rotate(k / 14 * Math.PI * 2); ctx.fillRect(r - 0.05 * S, -0.055 * S, 0.09 * S, 0.11 * S); ctx.restore(); }
  ctx.fillStyle = '#3d4250'; ctx.beginPath(); ctx.arc(0, 0, r - 0.03 * S, 0, 7); ctx.fill();
  ctx.strokeStyle = '#4c5262'; ctx.lineWidth = 0.05 * S; ctx.beginPath(); ctx.arc(0, 0, r * 0.75, 0, 7); ctx.stroke();
  ctx.fillStyle = '#eef1f6'; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, 7); ctx.fill();
  ctx.fillStyle = '#b9c1cd'; ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0.3, Math.PI - 0.3); ctx.fill();
  ctx.strokeStyle = '#8a93a6'; ctx.lineWidth = 3; for (let k = 0; k < 5; k++) { const an = k / 5 * Math.PI * 2; ctx.beginPath(); ctx.moveTo(Math.cos(an) * r * 0.2, Math.sin(an) * r * 0.2); ctx.lineTo(Math.cos(an) * r * 0.5, Math.sin(an) * r * 0.5); ctx.stroke(); }
  ctx.fillStyle = '#ff7a2f'; ctx.strokeStyle = '#b84e12'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r * 0.2, 0, 7); ctx.fill(); ctx.stroke();
  ctx.strokeStyle = '#1e2129'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(0, 0, r + 0.03 * S, 0, 7); ctx.stroke();
  if (goo) { ctx.fillStyle = 'rgba(123,224,90,.85)'; for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(Math.cos(k * 2.1) * r * 0.85, Math.sin(k * 2.1) * r * 0.85, r * 0.22, 0, 7); ctx.fill(); } }
  ctx.restore();
}

function drawUfo(ctx: CanvasRenderingContext2D, sim: Sim, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const u = sim.ufo!, ux = X(u.x), uy = Y(u.y), k = S / 44;
  if (u.beam > 0) {
    const gy = Y(sim.groundY(u.x)), hw = 1.3 * S;
    const bg = ctx.createLinearGradient(0, uy, 0, gy); bg.addColorStop(0, `rgba(170,255,120,${0.55 * u.beam})`); bg.addColorStop(1, `rgba(170,255,120,${0.08 * u.beam})`);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(ux - 26 * k, uy + 10 * k); ctx.lineTo(ux + 26 * k, uy + 10 * k); ctx.lineTo(ux + hw, gy); ctx.lineTo(ux - hw, gy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = `rgba(220,255,190,${0.5 * u.beam})`; ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const f = ((t * 0.8 + i / 4) % 1), yy = gy + (uy - gy) * f, w = hw + (26 * k - hw) * f; ctx.beginPath(); ctx.ellipse(ux, yy, w, 6 * k, 0, 0, 7); ctx.stroke(); }
  }
  ctx.fillStyle = 'rgba(160,230,255,.9)'; ctx.strokeStyle = '#3a4a66'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(ux, uy - 10 * k, 30 * k, 24 * k, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7be05a'; ctx.beginPath(); ctx.arc(ux, uy - 16 * k, 10 * k, 0, 7); ctx.fill(); ctx.fillStyle = '#10200c'; ctx.beginPath(); ctx.arc(ux - 3.5 * k, uy - 17 * k, 2.4 * k, 0, 7); ctx.arc(ux + 3.5 * k, uy - 17 * k, 2.4 * k, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(ux - 12 * k, uy - 22 * k, 7 * k, 4 * k, -0.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#aab4c6'; ctx.beginPath(); ctx.ellipse(ux, uy, 72 * k, 19 * k, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#7d889c'; ctx.beginPath(); ctx.ellipse(ux, uy + 5 * k, 72 * k, 13 * k, 0, 0, Math.PI); ctx.fill();
  ctx.strokeStyle = '#3a4a66'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(ux, uy, 72 * k, 19 * k, 0, 0, 7); ctx.stroke();
  ctx.fillStyle = '#4b5568'; ctx.beginPath(); ctx.ellipse(ux, uy + 8 * k, 44 * k, 9 * k, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 5; i++) { ctx.fillStyle = (Math.floor(t * 6) + i) % 2 ? '#ffd23a' : '#ff6fb5'; ctx.beginPath(); ctx.arc(ux - 48 * k + i * 24 * k, uy + 1, 4.5 * k, 0, 7); ctx.fill(); }
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, m: number, wd: WorldDef) {
  ctx.fillStyle = '#5b6476'; ctx.fillRect(x - 3, y - 1.3 * S, 6, 1.3 * S);
  ctx.fillStyle = '#f4f6fa'; ctx.strokeStyle = '#4a5366'; ctx.lineWidth = 2.5; rr(ctx, x - 0.45 * S, y - 1.75 * S, 0.9 * S, 0.5 * S, 6); ctx.fill(); ctx.stroke();
  ctx.fillStyle = wd.accent; ctx.fillRect(x - 0.45 * S + 3, y - 1.75 * S + 3, 0.9 * S - 6, 5);
  ctx.fillStyle = '#2a3142'; ctx.font = `900 ${0.26 * S | 0}px system-ui,"Segoe UI",Roboto,Arial,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(m), x, y - 1.47 * S);
}
function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, wd: WorldDef) {
  ctx.fillStyle = '#5b6476'; ctx.fillRect(x - 3, y - 1.1 * S, 6, 1.1 * S);
  ctx.save(); ctx.translate(x, y - 1.45 * S); ctx.rotate(Math.PI / 4);
  ctx.fillStyle = '#ffc53d'; ctx.strokeStyle = '#7a5208'; ctx.lineWidth = 3; ctx.fillRect(-0.3 * S, -0.3 * S, 0.6 * S, 0.6 * S); ctx.strokeRect(-0.3 * S, -0.3 * S, 0.6 * S, 0.6 * S); ctx.restore();
  ctx.strokeStyle = '#3a2a08'; ctx.lineWidth = 0.07 * S; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 0.18 * S, y - 1.3 * S); ctx.lineTo(x + 0.14 * S, y - 1.62 * S); ctx.moveTo(x + 0.14 * S, y - 1.62 * S); ctx.lineTo(x - 0.02 * S, y - 1.62 * S); ctx.moveTo(x + 0.14 * S, y - 1.62 * S); ctx.lineTo(x + 0.14 * S, y - 1.46 * S); ctx.stroke();
  void wd;
}
function drawOutpost(ctx: CanvasRenderingContext2D, sim: Sim, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const e = sim.L.length, gx = X(e), gy = Y(sim.groundY(e));
  if (gx < -12 * S || gx > W + 4 * S) return;
  // dome base
  const dx = X(e + 7), dy = Y(sim.groundY(e + 7));
  ctx.fillStyle = '#e8ecf3'; ctx.strokeStyle = '#4a5366'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(dx, dy, 3 * S, 2.3 * S, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#c3cad6'; ctx.beginPath(); ctx.ellipse(dx, dy, 3 * S, 2.3 * S, 0, Math.PI * 1.5, 0); ctx.lineTo(dx, dy); ctx.closePath(); ctx.fill();
  ctx.fillStyle = '#4fb4ff'; for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(dx + i * 0.9 * S, dy - 1.1 * S, 0.22 * S, 0, 7); ctx.fill(); }
  ctx.fillStyle = '#ff7a2f'; ctx.fillRect(dx - 3 * S, dy - 0.35 * S, 6 * S, 0.18 * S);
  ctx.strokeStyle = '#5b6476'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(dx + 1.2 * S, dy - 2 * S); ctx.lineTo(dx + 1.6 * S, dy - 3.2 * S); ctx.stroke();
  ctx.fillStyle = '#d3d9e4'; ctx.beginPath(); ctx.ellipse(dx + 1.6 * S, dy - 3.3 * S, 0.5 * S, 0.22 * S, -0.5, 0, 7); ctx.fill(); ctx.stroke();
  // landing pad
  for (let i = 0; i < 8; i++) { const x0 = e - 1 + i * 0.8; ctx.fillStyle = i % 2 ? '#ff7a2f' : '#f4f6fa'; ctx.fillRect(X(x0), Y(sim.groundY(x0)) - 4, 0.8 * S + 1, 10); }
  // gate arch with checker banner and beacons
  const ph = 3.6 * S; ctx.fillStyle = '#e8ecf3'; ctx.strokeStyle = '#4a5366'; ctx.lineWidth = 2.5;
  for (const ox of [-0.15 * S, 2.6 * S]) { ctx.fillRect(gx + ox - 5, gy - ph, 10, ph); ctx.strokeRect(gx + ox - 5, gy - ph, 10, ph); }
  const cw = 0.3 * S; for (let r = 0; r < 2; r++) for (let c = 0; c < 9; c++) { ctx.fillStyle = (r + c) % 2 ? '#1f2430' : '#ffffff'; ctx.fillRect(gx - 0.15 * S + c * cw, gy - ph + r * cw + Math.sin(t * 4 + c) * 1.5, cw, cw); }
  const bl = Math.sin(t * 5) > 0; for (const ox of [-0.15 * S, 2.6 * S]) { ctx.fillStyle = bl ? '#5ee06a' : '#1f6b2c'; ctx.beginPath(); ctx.arc(gx + ox, gy - ph - 8, 7, 0, 7); ctx.fill(); }
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
