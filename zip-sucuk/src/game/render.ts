import type { Body } from 'planck';
import { Sim, Ud } from './world';
import { CFG } from '../config';
import { Plat } from './levels';
import { skinDef } from './save';

export const W = 1280, H = 720;
const FONT = 'system-ui,"Segoe UI",Roboto,Arial,sans-serif';

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const lerpPos = (b: Body, a: number) => { const u = b.getUserData() as Ud, p = b.getPosition(); return { x: u.px + (p.x - u.px) * a, y: u.py + (p.y - u.py) * a, a: u.pa + (b.getAngle() - u.pa) * a }; };

export class Camera {
  x = 0; y = 0; S = CFG.camera.ppm; init = false;
  follow(sim: Sim, dt: number) {
    const c = sim.center, v = sim.velocity;
    const tx = c.x + v.x * CFG.camera.lookAhead * 0.3, ty = c.y + 1.2 + v.y * 0.08;
    if (!this.init) { this.x = tx; this.y = ty; this.init = true; }
    const k = 1 - Math.exp(-dt * CFG.camera.smooth); this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
  }
}

// ---------------- background (tile pattern cached per theme) ----------------
const THEMES = {
  counter: { wall: ['#f3eadb', '#eee3d1'], grout: '#e0d2ba', back: '#c98f5e', accent: '#e4572e' },
  shelves: { wall: ['#e5efed', '#dde9e6'], grout: '#c9dbd7', back: '#5f9e94', accent: '#e4572e' },
  stove: { wall: ['#3a3d47', '#35383f'], grout: '#2a2c33', back: '#1b1d23', accent: '#ff7a2f' },
  fridge: { wall: ['#e8f4fd', '#deedf9'], grout: '#c8def0', back: '#9cc6e6', accent: '#3aa0ff' },
};
const patterns = new Map<string, CanvasPattern>();
function tilePattern(ctx: CanvasRenderingContext2D, theme: keyof typeof THEMES) {
  let p = patterns.get(theme); if (p) return p;
  const T = THEMES[theme], c = document.createElement('canvas'); c.width = c.height = 96; const g = c.getContext('2d')!;
  for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { g.fillStyle = (i + j) % 2 ? T.wall[0] : T.wall[1]; g.fillRect(i * 48, j * 48, 48, 48);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(i * 48 + 4, j * 48 + 4, 40, 4); }
  g.strokeStyle = T.grout; g.lineWidth = 2; g.strokeRect(0, 0, 96, 96); g.beginPath(); g.moveTo(48, 0); g.lineTo(48, 96); g.moveTo(0, 48); g.lineTo(96, 48); g.stroke();
  p = ctx.createPattern(c, 'repeat')!; patterns.set(theme, p); return p;
}

export function drawBackground(ctx: CanvasRenderingContext2D, theme: keyof typeof THEMES, camX: number, camY: number, t: number) {
  const T = THEMES[theme], pat = tilePattern(ctx, theme);
  ctx.save(); ctx.fillStyle = pat; ctx.translate(-((camX * 18) % 96), ((camY * 18) % 96)); ctx.fillRect(-96, -96, W + 192, H + 192); ctx.restore();
  // soft light from a window
  const g = ctx.createRadialGradient(W * 0.75, -60, 40, W * 0.75, -60, 900); g.addColorStop(0, 'rgba(255,250,230,.45)'); g.addColorStop(1, 'rgba(255,250,230,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  // distant cabinets / appliances silhouette (slow parallax)
  ctx.fillStyle = T.back; ctx.globalAlpha = theme === 'stove' ? 0.8 : 0.22;
  for (let i = -1; i < 8; i++) { const x = ((i * 260 - camX * 10) % 2080 + 2080) % 2080 - 260, h = 140 + ((i * 97) % 5) * 30; rr(ctx, x, H - h + camY * 6, 200, h + 200, 16); ctx.fill(); }
  ctx.globalAlpha = 1;
  if (theme === 'stove') { ctx.fillStyle = 'rgba(255,120,40,.08)'; ctx.fillRect(0, H * 0.6, W, H * 0.4); }
  void t;
}

// ---------------- world ----------------
export function drawWorld(ctx: CanvasRenderingContext2D, sim: Sim, cam: Camera, t: number) {
  const S = cam.S, a = sim.alpha, sh = sim.shake;
  drawBackground(ctx, sim.L.theme, cam.x, cam.y, t);
  ctx.save(); if (sh > 0) ctx.translate((Math.random() - 0.5) * 14 * sh, (Math.random() - 0.5) * 14 * sh);
  const X = (x: number) => (x - cam.x) * S + W / 2, Y = (y: number) => H * 0.55 - (y - cam.y) * S;
  // kill zone: bubbling soup below the level
  const ky = Y(sim.L.killY + 2.5); if (ky < H) { const g = ctx.createLinearGradient(0, ky, 0, H); g.addColorStop(0, '#e8a33d'); g.addColorStop(1, '#b8501b'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, H);
    for (let x = 0; x <= W; x += 20) ctx.lineTo(x, ky + Math.sin(x * 0.03 + t * 3) * 5); ctx.lineTo(W, H); ctx.fill();
    ctx.fillStyle = 'rgba(255,230,160,.6)'; for (let i = 0; i < 6; i++) { const bx = ((i * 233 + t * 40) % W), by = ky + 20 + (i % 3) * 18; ctx.beginPath(); ctx.arc(bx, by, 5 + (i % 2) * 3, 0, 7); ctx.fill(); } }
  for (const p of sim.plats) drawPlat(ctx, p.def, lerpPos(p.body, a), X, Y, S, t);
  // flags
  for (const f of sim.flags) { const x = X(f.x), y = Y(f.y); ctx.strokeStyle = '#c9a26b'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y - 1.6 * S); ctx.stroke();
    ctx.fillStyle = f.taken ? '#3fbf5a' : '#e4572e'; const wv = Math.sin(t * 6 + f.x) * 4; ctx.beginPath(); ctx.moveTo(x, y - 1.6 * S); ctx.lineTo(x + 0.75 * S, y - 1.4 * S + wv); ctx.lineTo(x, y - 1.15 * S); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 2; ctx.stroke(); }
  // coins
  for (const c of sim.coins) if (!c.taken) drawCoin(ctx, X(c.x), Y(c.y) + Math.sin(t * 3 + c.x) * 4, 0.24 * S, t + c.x);
  drawBun(ctx, X(sim.L.finish[0]), Y(sim.L.finish[1]), S, t, sim.state === 'win');
  // aim preview
  if (sim.charging && CFG.jump.aimDots > 0) { const lv = sim.launchVector(); if (lv) { const c = sim.center, g = CFG.physics.gravity;
    for (let i = 1; i <= CFG.jump.aimDots; i++) { const tt = i / CFG.jump.aimDots * CFG.jump.aimTime; ctx.globalAlpha = 1 - i / (CFG.jump.aimDots + 2); ctx.fillStyle = '#fff'; ctx.strokeStyle = 'rgba(60,30,20,.6)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(X(c.x + lv.x * tt), Y(c.y + lv.y * tt - 0.5 * g * tt * tt), 6 - i * 0.35, 0, 7); ctx.fill(); ctx.stroke(); } ctx.globalAlpha = 1; } }
  drawSausage(ctx, sim, X, Y, S, t);
  for (const p of sim.particles) { const al = p.life / p.max; ctx.globalAlpha = al;
    ctx.fillStyle = p.type === 'coin' ? '#ffd23a' : p.type === 'spark' ? '#ffb347' : p.type === 'steam' ? '#ffffff' : p.type === 'star' ? '#fff27a' : '#d9c3a3';
    const r = p.size * S * (p.type === 'steam' ? 2.4 - al : 1); ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), r, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawPlat(ctx: CanvasRenderingContext2D, p: Plat, q: { x: number; y: number; a: number }, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const w = p.w * S, h = p.h * S;
  ctx.save(); ctx.translate(X(q.x), Y(q.y)); ctx.rotate(-q.a);
  const x0 = -w / 2, y0 = -h / 2;
  switch (p.kind) {
    case 'counter': {
      ctx.fillStyle = '#b97a4a'; ctx.fillRect(x0, y0, w, h);
      ctx.fillStyle = '#9a5f33'; for (let x = x0 + 30; x < x0 + w; x += 60) ctx.fillRect(x, y0 + 14, 3, h - 14);
      ctx.fillStyle = '#e9d6b8'; rr(ctx, x0 - 4, y0 - 2, w + 8, 18, 6); ctx.fill(); ctx.fillStyle = '#fff6e6'; ctx.fillRect(x0, y0, w, 4);
      ctx.strokeStyle = '#5b3417'; ctx.lineWidth = 3; ctx.strokeRect(x0, y0 + 14, w, h - 14); break;
    }
    case 'board': {
      rr(ctx, x0, y0, w, h, Math.min(14, h / 2)); ctx.fillStyle = '#e2b47c'; ctx.fill();
      ctx.strokeStyle = 'rgba(150,95,45,.45)'; ctx.lineWidth = 2; for (let x = x0 + 18; x < x0 + w - 10; x += 26) { ctx.beginPath(); ctx.moveTo(x, y0 + 4); ctx.lineTo(x + 6, y0 + h - 4); ctx.stroke(); }
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(x0 + 6, y0 + 3, w - 12, 4);
      rr(ctx, x0, y0, w, h, Math.min(14, h / 2)); ctx.strokeStyle = '#7a4a1f'; ctx.lineWidth = 3; ctx.stroke();
      if (h < 40) { ctx.fillStyle = '#7a4a1f'; ctx.beginPath(); ctx.arc(x0 + w - 16, 0, 5, 0, 7); ctx.fill(); }
      break;
    }
    case 'shelf': {
      ctx.fillStyle = '#ffffff'; rr(ctx, x0, y0, w, h, 5); ctx.fill(); ctx.strokeStyle = '#8aa6a0'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#c8d8d4'; ctx.fillRect(x0 + 4, y0 + h - 5, w - 8, 3);
      ctx.fillStyle = '#8aa6a0'; for (const bx of [x0 + 18, x0 + w - 26]) { ctx.beginPath(); ctx.moveTo(bx, y0 + h); ctx.lineTo(bx + 8, y0 + h); ctx.lineTo(bx + 8, y0 + h + 26); ctx.closePath(); ctx.fill(); }
      break;
    }
    case 'cabinet': {
      ctx.fillStyle = '#7fb8ad'; ctx.fillRect(x0, y0, w, h); ctx.strokeStyle = '#4f8378'; ctx.lineWidth = 3; ctx.strokeRect(x0, y0, w, h);
      for (let y = y0 + 20; y < y0 + h - 60; y += 160) { ctx.strokeRect(x0 + 8, y, w - 16, 130); ctx.fillStyle = '#d9c27a'; ctx.beginPath(); ctx.arc(0, y + 65, 5, 0, 7); ctx.fill(); }
      break;
    }
    case 'butter': {
      rr(ctx, x0, y0, w, h, 8); const g = ctx.createLinearGradient(0, y0, 0, y0 + h); g.addColorStop(0, '#fff3a6'); g.addColorStop(1, '#f2c94c'); ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = '#c99a1e'; ctx.lineWidth = 3; ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(x0 + 10, y0 + 4, w * 0.4, 4);
      ctx.fillStyle = '#f2c94c'; for (let x = x0 + 30; x < x0 + w - 20; x += 70) { ctx.beginPath(); ctx.ellipse(x, y0 + h + 4, 6, 9 + Math.sin(t * 2 + x) * 2, 0, 0, 7); ctx.fill(); }
      break;
    }
    case 'jelly': {
      const wob = 1 + Math.sin(t * 7) * 0.05; ctx.scale(1 / wob, wob);
      rr(ctx, x0, y0 - 6, w, h + 6, 14); ctx.fillStyle = 'rgba(232,58,90,.82)'; ctx.fill(); ctx.strokeStyle = '#9b1834'; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x0 + w * 0.3, y0, w * 0.18, 5, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,190,200,.5)'; ctx.beginPath(); ctx.arc(x0 + w * 0.7, y0 + h * 0.4, 6, 0, 7); ctx.fill();
      break;
    }
    case 'grill': {
      const glow = 0.6 + 0.4 * Math.sin(t * 5);
      ctx.fillStyle = '#2a2a30'; ctx.fillRect(x0, y0, w, h);
      const g = ctx.createLinearGradient(0, y0, 0, y0 + h * 0.6); g.addColorStop(0, `rgba(255,${110 + 60 * glow | 0},40,.95)`); g.addColorStop(1, 'rgba(120,20,10,.2)'); ctx.fillStyle = g; ctx.fillRect(x0, y0 + 6, w, h * 0.6);
      ctx.fillStyle = '#55555e'; for (let x = x0 + 6; x < x0 + w; x += 22) ctx.fillRect(x, y0, 8, 10);
      ctx.fillStyle = '#1b1b20'; ctx.fillRect(x0, y0, w, 4);
      ctx.strokeStyle = `rgba(255,255,255,${0.15 + 0.1 * glow})`; ctx.lineWidth = 2; for (let x = x0 + 20; x < x0 + w; x += 60) { const o = (t * 40 + x) % 60; ctx.beginPath(); ctx.moveTo(x, y0 - o); ctx.quadraticCurveTo(x + 8, y0 - o - 12, x, y0 - o - 24); ctx.stroke(); }
      break;
    }
    case 'knife': {
      ctx.fillStyle = '#4a2c1a'; rr(ctx, x0 - 4, y0 + h * 0.55, w + 8, h * 0.45, 4); ctx.fill();
      const g = ctx.createLinearGradient(x0, 0, x0 + w, 0); g.addColorStop(0, '#f4f7fb'); g.addColorStop(1, '#9aa4b2'); ctx.fillStyle = g;
      ctx.beginPath(); ctx.moveTo(x0, y0 + h * 0.55); ctx.lineTo(x0, y0 + 8); ctx.lineTo(x0 + w, y0 - 6); ctx.lineTo(x0 + w, y0 + h * 0.55); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#5c6470'; ctx.lineWidth = 2; ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  const sx = Math.max(0.2, Math.abs(Math.cos(t * 2.4)));
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1);
  ctx.fillStyle = '#c98a10'; ctx.beginPath(); ctx.arc(0, 2, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.strokeStyle = '#9a6508'; ctx.lineWidth = 2.5; ctx.stroke();
  // little chili pepper = spice coin
  ctx.fillStyle = '#d7301f'; ctx.beginPath(); ctx.ellipse(0, 1, r * 0.22, r * 0.5, 0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#2f8f3a'; ctx.fillRect(-r * 0.05 + r * 0.18, -r * 0.55, r * 0.12, r * 0.2);
  ctx.restore();
}

function drawBun(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number, won: boolean) {
  const w = 1.7 * S, h = 0.7 * S, bob = won ? 0 : Math.sin(t * 3) * 6;
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(x, y, w * 0.55, 6, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#d9913e'; rr(ctx, x - w / 2, y - h, w, h, h / 2); ctx.fill(); ctx.strokeStyle = '#8a4f17'; ctx.lineWidth = 3; ctx.stroke();
  ctx.fillStyle = '#f7d9a3'; rr(ctx, x - w / 2 + 10, y - h * 0.8, w - 20, h * 0.35, 8); ctx.fill();
  ctx.fillStyle = '#fff6dc'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(x - w * 0.35 + i * w * 0.14, y - h * 0.2, 3, 2, 0.5, 0, 7); ctx.fill(); }
  if (!won) { // bouncing arrow pointing at the goal
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#3fbf5a'; ctx.lineWidth = 4; const ay = y - h - 0.9 * S + bob;
    ctx.beginPath(); ctx.moveTo(x, ay + 26); ctx.lineTo(x - 18, ay + 4); ctx.lineTo(x - 7, ay + 4); ctx.lineTo(x - 7, ay - 16); ctx.lineTo(x + 7, ay - 16); ctx.lineTo(x + 7, ay + 4); ctx.lineTo(x + 18, ay + 4); ctx.closePath(); ctx.fill(); ctx.stroke(); }
}

/** the sucuk: a thick rounded stroke through the soft-body segments, with marbling, string ties and googly eyes */
export function drawSausage(ctx: CanvasRenderingContext2D, sim: Sim, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const a = sim.alpha, sk = skinDef(), n = sim.segs.length;
  let pts = sim.segs.map(s => { const q = lerpPos(s, a); return { x: X(q.x), y: Y(q.y) }; });
  const base = sim.stuck ? sim.stuck.base : 0, tip = base === 0 ? n - 1 : 0;
  // squash toward the base while charging, little bounce after sticking
  const sq = sim.charging ? 0.24 * sim.charge : -0.12 * sim.landSquash * Math.sin(t * 30);
  if (sq) { const b = pts[base]; pts = pts.map(p => ({ x: b.x + (p.x - b.x) * (1 - sq), y: b.y + (p.y - b.y) * (1 - sq) })); }
  const thick = CFG.sausage.radius * 2 * S * (1 + Math.max(0, sq) * 0.6);
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < n - 1; i++) { const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my); } ctx.lineTo(pts[n - 1].x, pts[n - 1].y); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  // shadow, outline, body, highlight
  ctx.save(); ctx.translate(0, 6); path(); ctx.strokeStyle = 'rgba(0,0,0,.18)'; ctx.lineWidth = thick + 4; ctx.stroke(); ctx.restore();
  path(); ctx.strokeStyle = sk.dark; ctx.lineWidth = thick + 6; ctx.stroke();
  path(); ctx.strokeStyle = sk.body; ctx.lineWidth = thick; ctx.stroke();
  ctx.save(); ctx.translate(-thick * 0.12, -thick * 0.18); path(); ctx.strokeStyle = sk.light; ctx.globalAlpha = 0.75; ctx.lineWidth = thick * 0.42; ctx.stroke(); ctx.restore();
  ctx.save(); ctx.translate(-thick * 0.15, -thick * 0.25); path(); ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = thick * 0.12; ctx.stroke(); ctx.restore();
  // fat marbling
  if (sk.fat) { ctx.fillStyle = sk.fat; for (let i = 1; i < n - 1; i++) { const p = pts[i], q = pts[i + 1], ox = (i % 2 ? 0.22 : -0.18) * thick; const nx = -(q.y - p.y), ny = q.x - p.x, l = Math.hypot(nx, ny) || 1;
    ctx.beginPath(); ctx.ellipse(p.x + nx / l * ox, p.y + ny / l * ox, thick * 0.09, thick * 0.06, Math.atan2(q.y - p.y, q.x - p.x), 0, 7); ctx.fill(); } }
  // string ties at both ends
  ctx.strokeStyle = '#e8d3a8'; ctx.lineWidth = 3;
  for (const [e, f] of [[0, 1], [n - 1, n - 2]]) { const p = pts[e], q = pts[f], dx = p.x - q.x, dy = p.y - q.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
    const cx = p.x + ux * thick * 0.45, cy = p.y + uy * thick * 0.45; ctx.beginPath(); ctx.moveTo(cx - uy * thick * 0.25, cy + ux * thick * 0.25); ctx.lineTo(cx + uy * thick * 0.25, cy - ux * thick * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + ux * 2, cy + uy * 2); ctx.quadraticCurveTo(cx + ux * 12 + uy * 6, cy + uy * 12 - ux * 6, cx + ux * 16 + Math.sin(t * 8) * 3, cy + uy * 16); ctx.stroke(); }
  // googly eyes near the top end (the end that is not stuck)
  const e0 = pts[tip], e1 = pts[tip === 0 ? 1 : n - 2], dx = e1.x - e0.x, dy = e1.y - e0.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  const ex = e0.x + ux * thick * 0.75, ey = e0.y + uy * thick * 0.75, side = -1, nx = -uy * side, ny = ux * side;
  const v = sim.velocity, look = Math.min(1, Math.hypot(v.x, v.y) / 8), lx = v.x / (Math.hypot(v.x, v.y) || 1), ly = -v.y / (Math.hypot(v.x, v.y) || 1);
  for (const k of [-1, 1]) {
    const cx = ex + nx * thick * 0.28 * k, cy = ey + ny * thick * 0.28 * k, r = thick * 0.3;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = '#2a120a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.stroke();
    const jig = Math.sin(t * 13 + k) * (sim.stuck ? 0.5 : 2);
    ctx.fillStyle = '#1a0a05'; ctx.beginPath(); ctx.arc(cx + lx * r * 0.45 * look + jig, cy + ly * r * 0.45 * look + r * 0.15, r * 0.48, 0, 7); ctx.fill();
  }
  if (sim.charging) { // effort: little sweat drops
    ctx.fillStyle = 'rgba(160,220,255,.9)'; for (let i = 0; i < 2; i++) { const o = (t * 2 + i * 0.5) % 1; ctx.beginPath(); ctx.arc(ex + 20 + i * 10, ey - 12 - o * 20, 3.5, 0, 7); ctx.fill(); }
  }
  void FONT;
}
