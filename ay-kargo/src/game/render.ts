import { Sim, Ud, CRATE_HALF } from './world';
import { WORLDS, hash } from './levels';
import { save } from './save';

export const W = 1280, H = 720;
export class Camera {
  x = 0; y = 0; zoom = 1; init = false;
  follow(sim: Sim, dt: number) {
    const c = sim.chassis.getPosition(), v = sim.speed;
    const tx = c.x + Math.max(-2, Math.min(7, v * 0.5)) + 2, ty = c.y + 1.2;
    const tz = 1 - Math.min(0.22, Math.abs(v) * 0.018);
    if (!this.init) { this.x = tx; this.y = ty; this.zoom = tz; this.init = true; }
    const k = 1 - Math.exp(-dt * 4); this.x += (tx - this.x) * k; this.y += (ty - this.y) * (1 - Math.exp(-dt * 3)); this.zoom += (tz - this.zoom) * (1 - Math.exp(-dt * 1.5));
  }
}
const PPM = 42;
const CRATE_COL = ['#d9964b', '#c97b3a', '#e0a95e', '#b86f33'];

export function worldBackdrop(ctx: CanvasRenderingContext2D, wi: number, camX: number, camY: number, t: number) {
  const w = WORLDS[wi];
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, w.sky[0]); g.addColorStop(1, w.sky[1]);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // stars
  ctx.fillStyle = w.star;
  for (let i = 0; i < 90; i++) { const px = ((hash(i * 3) * 1600 - camX * 3) % 1600 + 1600) % 1600 - 160, py = hash(i * 7 + 1) * 460, tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + i)); ctx.globalAlpha = tw * (0.4 + hash(i) * 0.6); ctx.fillRect(px, py, 2, 2); }
  ctx.globalAlpha = 1;
  // big planet
  const px = 980 - camX * 1.5 % 40, py = 140;
  const pg = ctx.createRadialGradient(px - 30, py - 30, 10, px, py, 110);
  if (wi === 0) { pg.addColorStop(0, '#6ec1ff'); pg.addColorStop(0.6, '#2b6cb0'); pg.addColorStop(1, '#0d2342'); }
  else if (wi === 1) { pg.addColorStop(0, '#ffd9a8'); pg.addColorStop(0.6, '#d98a4e'); pg.addColorStop(1, '#6a3318'); }
  else { pg.addColorStop(0, '#fff3c4'); pg.addColorStop(0.6, '#e8b45a'); pg.addColorStop(1, '#7a4a1c'); }
  ctx.fillStyle = pg; ctx.beginPath(); ctx.arc(px, py, 90, 0, 7); ctx.fill();
  if (wi === 2) { ctx.strokeStyle = 'rgba(255,230,170,.6)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(px, py, 150, 28, -0.3, 0, 7); ctx.stroke(); }
  // far hills (parallax)
  for (const [par, base, amp, col, a] of [[0.12, 470, 70, w.far, 0.8], [0.3, 520, 60, w.far, 1]] as const) {
    ctx.fillStyle = col; ctx.globalAlpha = a * (par < 0.2 ? 0.55 : 0.9); ctx.beginPath(); ctx.moveTo(0, H);
    for (let sx = 0; sx <= W + 16; sx += 16) { const wx = sx / 30 + camX * par * 0.8; ctx.lineTo(sx, base - camY * par * 20 + Math.sin(wx * 0.7) * amp * 0.5 + Math.sin(wx * 1.9 + 2) * amp * 0.3 + Math.sin(wx * 0.23) * amp); }
    ctx.lineTo(W, H); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

export function drawWorld(ctx: CanvasRenderingContext2D, sim: Sim, cam: Camera, t: number) {
  const wd = WORLDS[sim.L.world], a = sim.alpha, z = cam.zoom, S = PPM * z;
  let sh = sim.shake > 0 ? sim.shake : 0; const ox = (Math.random() - .5) * 18 * sh, oy = (Math.random() - .5) * 18 * sh;
  worldBackdrop(ctx, sim.L.world, cam.x, cam.y, t);
  ctx.save(); ctx.translate(ox, oy);
  const X = (x: number) => (x - cam.x) * S + W / 2, Y = (y: number) => 430 - (y - cam.y) * S;
  const x0 = cam.x - W / 2 / S - 1, x1 = cam.x + W / 2 / S + 1;
  // terrain
  const step = 0.5, i0 = Math.floor(x0 / step), i1 = Math.ceil(x1 / step);
  ctx.beginPath(); ctx.moveTo(X(i0 * step), H + 50);
  for (let i = i0; i <= i1; i++) ctx.lineTo(X(i * step), Y(sim.groundY(i * step)));
  ctx.lineTo(X(i1 * step), H + 50); ctx.closePath();
  const tg = ctx.createLinearGradient(0, 300, 0, H); tg.addColorStop(0, wd.ground[0]); tg.addColorStop(1, wd.ground[1]);
  ctx.fillStyle = tg; ctx.fill();
  // surface details
  ctx.save(); ctx.clip();
  for (let i = Math.floor(x0 / 2); i <= Math.ceil(x1 / 2); i++) { const h1 = hash(i * 5.3 + sim.L.seed), x = i * 2 + h1 * 1.8, y = sim.groundY(x) - 0.4 - hash(i * 9.1) * 2.2, r = (0.12 + h1 * 0.38) * S;
    ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.beginPath(); ctx.ellipse(X(x), Y(y), r * 1.5, r * 0.8, 0, 0, 7); ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.beginPath(); ctx.ellipse(X(x) - r * .3, Y(y) - r * .25, r * 1.1, r * .5, 0, 0, 7); ctx.fill(); }
  ctx.restore();
  ctx.beginPath(); for (let i = i0; i <= i1; i++) { const px = X(i * step), py = Y(sim.groundY(i * step)); i === i0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
  ctx.strokeStyle = wd.rim; ctx.lineWidth = 4 * z + 1; ctx.lineJoin = 'round'; ctx.stroke();
  // start + finish
  if (!sim.L.endless) { drawFinish(ctx, X(sim.L.length), Y(sim.groundY(sim.L.length)), S, t); }
  // meteor warnings & meteors
  for (const m of sim.meteors) {
    const gy = sim.groundY(m.tx), p = m.t / 1.5, r = (2.4 - 1.5 * p) * S, pulse = 0.5 + 0.5 * Math.sin(t * 18);
    ctx.fillStyle = `rgba(255,40,30,${0.12 + 0.18 * p})`; ctx.beginPath(); ctx.ellipse(X(m.tx), Y(gy) + 2, r * 1.9, r * 0.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = `rgba(255,${60 + 80 * pulse | 0},50,.95)`; ctx.lineWidth = 4; ctx.beginPath(); ctx.ellipse(X(m.tx), Y(gy) + 2, r * 1.9, r * 0.5, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(X(m.tx), Y(gy) + 2, r * 0.9, r * 0.25, 0, 0, 7); ctx.stroke();
    if (m.t > 0.7) { const q = (m.t - 0.7) / 0.8, mx = m.tx + 10 * (1 - q), my = gy + 26 * (1 - q), sx = X(mx), sy = Y(my);
      const fg = ctx.createRadialGradient(sx, sy, 2, sx, sy, 44); fg.addColorStop(0, '#fff3b0'); fg.addColorStop(0.35, '#ff9a2e'); fg.addColorStop(1, 'rgba(255,60,0,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(sx, sy, 44, 0, 7); ctx.fill(); ctx.fillStyle = '#5a4a40'; ctx.beginPath(); ctx.arc(sx, sy, 15, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(255,170,60,.6)'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(X(mx + 10 * 0.5), Y(my + 26 * 0.5)); ctx.stroke(); }
  }
  // rocks
  for (const b of sim.rocks) { const q = interp(b, a); ctx.save(); ctx.translate(X(q.x), Y(q.y)); ctx.rotate(-q.a);
    const fx = (b.getFixtureList()!.getShape() as any).m_vertices as { x: number; y: number }[];
    ctx.beginPath(); fx.forEach((v, i) => i ? ctx.lineTo(v.x * S, -v.y * S) : ctx.moveTo(v.x * S, -v.y * S)); ctx.closePath();
    ctx.fillStyle = wd.ground[1]; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = wd.rim; ctx.stroke(); ctx.restore(); }
  // slimes
  for (const b of sim.slimes) { const q = interp(b, a), sx = X(q.x), sy = Y(q.y), r = 0.34 * S, wob = Math.sin(t * 5 + q.x * 3) * 0.08;
    ctx.fillStyle = '#5be35b'; ctx.beginPath(); ctx.ellipse(sx, sy, r * (1 + wob), r * (0.95 - wob), 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.beginPath(); ctx.ellipse(sx - r * .3, sy - r * .35, r * .3, r * .2, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#10300f'; ctx.beginPath(); ctx.arc(sx - r * .3, sy - r * .05, r * .13, 0, 7); ctx.arc(sx + r * .3, sy - r * .05, r * .13, 0, 7); ctx.fill(); }
  // crates
  for (const c of sim.crates) { if (c.stolen) continue; const q = interp(c.body, a); drawCrate(ctx, X(q.x), Y(q.y), q.a, CRATE_HALF * S, c.idx, c.dropped); }
  // rover
  drawRover(ctx, sim, a, X, Y, S, t);
  // UFO
  if (sim.ufo) drawUfo(ctx, sim, X, Y, S, t);
  // particles
  for (const p of sim.particles) { const al = p.life / p.max; ctx.globalAlpha = al;
    ctx.fillStyle = p.type === 'goo' ? '#5be35b' : p.type === 'coin' ? '#ffd23a' : p.type === 'spark' ? '#ffcf5a' : p.type === 'debris' ? wd.ground[0] : wd.rim;
    ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.size * S * (p.type === 'dust' ? 1.5 - al * 0.5 : 1), 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.restore();
  if (sim.hitFlash > 0) { ctx.fillStyle = `rgba(255,255,255,${sim.hitFlash * 0.4})`; ctx.fillRect(0, 0, W, H); }
}

function interp(b: import('planck').Body, a: number) { const u = b.getUserData() as Ud, p = b.getPosition(); return { x: u.px + (p.x - u.px) * a, y: u.py + (p.y - u.py) * a, a: u.pa + (b.getAngle() - u.pa) * a }; }

function drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, h: number, idx: number, dim: boolean) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(-ang); if (dim) ctx.globalAlpha = 0.7;
  ctx.fillStyle = CRATE_COL[idx % 4]; ctx.fillRect(-h, -h, h * 2, h * 2);
  ctx.strokeStyle = '#6b3d17'; ctx.lineWidth = 2.5; ctx.strokeRect(-h + 1, -h + 1, h * 2 - 2, h * 2 - 2);
  ctx.beginPath(); ctx.moveTo(-h, -h); ctx.lineTo(h, h); ctx.moveTo(h, -h); ctx.lineTo(-h, h); ctx.stroke();
  ctx.fillStyle = idx % 2 ? '#ffd23a' : '#5ad1ff'; ctx.beginPath(); ctx.arc(0, 0, h * 0.28, 0, 7); ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawRover(ctx: CanvasRenderingContext2D, sim: Sim, a: number, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const ch = interp(sim.chassis, a);
  // suspension lines + wheels
  for (let i = 0; i < 2; i++) {
    const w = interp(sim.wheels[i], a), dx = i ? 1.05 : -1.05, ca = Math.cos(ch.a), sa = Math.sin(ch.a);
    const ax = ch.x + dx * ca + 0.0 * sa, ay = ch.y + dx * sa - 0.1 * ca;
    ctx.strokeStyle = '#2a2d36'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(X(ax), Y(ay)); ctx.lineTo(X(w.x), Y(w.y)); ctx.stroke();
    const r = 0.42 * S; ctx.save(); ctx.translate(X(w.x), Y(w.y)); ctx.rotate(-w.a);
    ctx.fillStyle = '#17181d'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    ctx.fillStyle = '#b9bfcc'; ctx.beginPath(); ctx.arc(0, 0, r * 0.6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#4a4f5c'; ctx.lineWidth = 3; for (let k = 0; k < 4; k++) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(k * 1.5708) * r * 0.6, Math.sin(k * 1.5708) * r * 0.6); ctx.stroke(); }
    ctx.fillStyle = '#e8590c'; ctx.beginPath(); ctx.arc(0, 0, r * 0.18, 0, 7); ctx.fill();
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
    if (sim.goo > 0) { ctx.fillStyle = '#5be35b'; ctx.beginPath(); ctx.arc(r * 0.7, 0, r * 0.3, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  ctx.save(); ctx.translate(X(ch.x), Y(ch.y)); ctx.rotate(-ch.a);
  const s = S, bedH = 0.55 + 0.1 * save.up.bed;
  // turbo flame
  if (sim.turboOn) { const f = 0.7 + Math.random() * 0.5; const fg = ctx.createLinearGradient(-1.5 * s, 0, -1.5 * s - 1.6 * s * f, 0); fg.addColorStop(0, '#fff3b0'); fg.addColorStop(0.4, '#ff9a2e'); fg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-1.5 * s, -0.1 * s); ctx.lineTo(-1.5 * s - 1.6 * s * f, 0.02 * s); ctx.lineTo(-1.5 * s, 0.15 * s); ctx.fill(); }
  // chassis floor
  rr(ctx, -1.5 * s, -0.25 * s, 3 * s, 0.5 * s, 0.1 * s); ctx.fillStyle = '#3a4150'; ctx.fill(); ctx.strokeStyle = '#14171d'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#e8590c'; ctx.fillRect(-1.4 * s, 0.02 * s, 2.8 * s, 0.07 * s);
  // rear wall, bed front wall
  ctx.fillStyle = '#6b7385'; ctx.fillRect(-1.5 * s, -(0.25 + bedH) * s, 0.1 * s, bedH * s); ctx.fillRect(0.73 * s, -(0.25 + bedH * 0.9) * s, 0.1 * s, bedH * 0.9 * s);
  ctx.strokeStyle = '#14171d'; ctx.lineWidth = 2; ctx.strokeRect(-1.5 * s, -(0.25 + bedH) * s, 0.1 * s, bedH * s);
  // cab
  rr(ctx, 0.83 * s, -1.25 * s, 0.64 * s, 1.0 * s, 0.14 * s); ctx.fillStyle = '#19a7a0'; ctx.fill(); ctx.stroke();
  rr(ctx, 1.0 * s, -1.15 * s, 0.4 * s, 0.4 * s, 0.08 * s); const wg = ctx.createLinearGradient(0, -1.15 * s, 0, -0.75 * s); wg.addColorStop(0, '#bff6ff'); wg.addColorStop(1, '#4aa8d8'); ctx.fillStyle = wg; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.fillRect(1.43 * s, -0.55 * s, 0.1 * s, 0.14 * s);
  ctx.strokeStyle = '#14171d'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(0.95 * s, -1.25 * s); ctx.lineTo(0.88 * s, -1.6 * s); ctx.stroke(); ctx.fillStyle = sim.t % 1 < 0.5 ? '#ff4040' : '#701010'; ctx.beginPath(); ctx.arc(0.88 * s, -1.6 * s, 0.07 * s, 0, 7); ctx.fill();
  // shield bubble
  if (sim.shields > 0) { ctx.strokeStyle = `rgba(110,220,255,${0.6 + 0.3 * Math.sin(t * 5)})`; ctx.lineWidth = 3; ctx.fillStyle = 'rgba(110,220,255,.12)'; ctx.beginPath(); ctx.ellipse(0, -0.55 * s, 2.6 * s, 1.7 * s, 0, 0, 7); ctx.fill(); ctx.stroke(); }
  ctx.restore();
}

function drawUfo(ctx: CanvasRenderingContext2D, sim: Sim, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const u = sim.ufo!, sx = X(u.x), sy = Y(u.y);
  if (u.state === 'beam' || u.state === 'arm') {
    const gy = Y(sim.groundY(u.x)), hw = 1.7 * S, on = u.state === 'beam', fl = on ? 0.35 + 0.1 * Math.sin(t * 30) : 0.1 + 0.1 * Math.sin(t * 14);
    const bg = ctx.createLinearGradient(0, sy, 0, gy); bg.addColorStop(0, `rgba(160,255,200,${fl + 0.2})`); bg.addColorStop(1, `rgba(160,255,200,${fl * 0.4})`);
    ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(sx - 0.7 * S, sy + 10); ctx.lineTo(sx + 0.7 * S, sy + 10); ctx.lineTo(sx + hw, gy); ctx.lineTo(sx - hw, gy); ctx.fill();
  }
  ctx.fillStyle = '#9aa6bd'; ctx.beginPath(); ctx.ellipse(sx, sy, 1.6 * S, 0.45 * S, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#2b3142'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = 'rgba(130,230,255,.85)'; ctx.beginPath(); ctx.ellipse(sx, sy - 0.3 * S, 0.75 * S, 0.55 * S, 0, Math.PI, 0); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#7dff7d'; ctx.beginPath(); ctx.arc(sx, sy - 0.3 * S, 0.14 * S, 0, 7); ctx.fill();
  for (let i = -2; i <= 2; i++) { ctx.fillStyle = (Math.floor(t * 6) + i) % 2 ? '#ffd23a' : '#ff5a5a'; ctx.beginPath(); ctx.arc(sx + i * 0.5 * S, sy + 0.12 * S, 0.09 * S, 0, 7); ctx.fill(); }
}

function drawFinish(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number) {
  const h = 3.4 * S; ctx.fillStyle = '#e9ecf4'; ctx.fillRect(x - 3, y - h, 6, h);
  ctx.save(); ctx.translate(x + 3, y - h); const cw = 0.4 * S;
  for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) { ctx.fillStyle = (r + c) % 2 ? '#111' : '#fff'; ctx.fillRect(c * cw, r * cw + Math.sin(t * 4 + c) * 2, cw, cw); }
  ctx.restore();
  ctx.fillStyle = 'rgba(80,255,120,.25)'; ctx.fillRect(x - 0.3 * S, y - h, 0.6 * S, h);
}

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
export { rr };
