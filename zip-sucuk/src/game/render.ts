/**
 * In-game rendering. Reads the simulation, never changes it (gameplay/physics live in world.ts).
 * Art follows UI_REVIEW.md §2: outline = darker shade of the object's own colour, flat base + one shadow + one highlight,
 * chunky rounded shapes, saturated foreground over the desaturated backdrop. Platforms are drawn at their collider size.
 */
import type { Body } from 'planck';
import { Sim, Ud } from './world';
import { CFG } from '../config';
import { Plat, Kind, LevelDef } from './levels';
import { skinDef } from './save';
import { drawBackdrop, drawVignette } from './backdrop';
import { drawIcon } from '../ui/icons';
import { C, motion, reducedMotion } from '../ui/theme';
import { rr, shade } from '../ui/widgets';

export const W = 1280, H = 720;
export { rr };
type Theme = LevelDef['theme'];
const lerpPos = (b: Body, a: number) => { const u = b.getUserData() as Ud, p = b.getPosition(); return { x: u.px + (p.x - u.px) * a, y: u.py + (p.y - u.py) * a, a: u.pa + (b.getAngle() - u.pa) * a }; };

export class Camera {
  x = 0; y = 0; S = CFG.camera.ppm; init = false; shake = 0;
  follow(sim: Sim, dt: number) {
    const c = sim.center, v = sim.velocity;
    const tx = c.x + v.x * CFG.camera.lookAhead * 0.3, ty = c.y + 1.2 + v.y * 0.08;
    if (!this.init) { this.x = tx; this.y = ty; this.init = true; }
    const k = 1 - Math.exp(-dt * CFG.camera.smooth); this.x += (tx - this.x) * k; this.y += (ty - this.y) * k;
    this.shake = Math.max(0, this.shake - dt * 3);
  }
}

// ---------------- render-side feedback (visual only, observes the sim) ----------------
interface FxP { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; s: number; kind: 'puff' | 'chip' | 'spark' | 'steam'; }
interface Watch { lastBase: number; stuck: boolean; falls: number; coins: number; vy: number; sweat: number; grin: number; blinkT: number; fallT: number; fx: FxP[]; steamT: number; }
const watch = new WeakMap<Sim, Watch>();
const SURF: Record<Kind, { col: string; kind: FxP['kind'] }> = {
  counter: { col: '#c99a6a', kind: 'chip' }, board: { col: '#e0b277', kind: 'chip' }, shelf: { col: '#e8dcc6', kind: 'puff' }, cabinet: { col: '#d8c3a2', kind: 'puff' },
  butter: { col: '#ffe48a', kind: 'puff' }, jelly: { col: '#ff8fa6', kind: 'puff' }, grill: { col: '#ffb15a', kind: 'spark' }, knife: { col: '#e8eef6', kind: 'spark' },
};
function emit(w: Watch, x: number, y: number, n: number, col: string, kind: FxP['kind'], sp = 2) {
  for (let i = 0; i < n && w.fx.length < 120; i++) { const a = Math.PI * (0.1 + Math.random() * 0.8), s = sp * (0.4 + Math.random() * 0.6), life = 0.4 + Math.random() * 0.45;
    w.fx.push({ x, y, vx: Math.cos(a) * s * (Math.random() < 0.5 ? -1 : 1), vy: Math.sin(a) * s, life, max: life, col, s: 0.05 + Math.random() * 0.06, kind }); }
}
/** surface kind the sausage is standing on (if any) */
const standingKind = (sim: Sim): Kind | null => { const b = sim.stuck?.body; if (!b) return null; const u = b.getUserData() as Ud; return u?.kind ?? null; };

function observe(sim: Sim, cam: Camera, dt: number): Watch {
  let w = watch.get(sim);
  const c = sim.center, v = sim.velocity;
  if (!w) { w = { lastBase: 0, stuck: !!sim.stuck, falls: sim.falls, coins: sim.coinsRun, vy: v.y, sweat: 0, grin: 0, blinkT: 2, fallT: 0, fx: [], steamT: 0 }; watch.set(sim, w); }
  // landing: surface-tinted dust / crumbs / sparkles, shake on hard landings
  if (sim.stuck && !w.stuck) {
    const k = standingKind(sim) ?? 'counter', s = SURF[k], base = sim.segs[sim.stuck.base].getPosition(), hard = Math.abs(w.vy) > 9;
    emit(w, base.x, base.y - 0.1, hard ? 12 : 7, sim.L.theme === 'fridge' && k !== 'grill' ? '#e6f7ff' : s.col, sim.L.theme === 'fridge' ? 'spark' : s.kind, hard ? 3 : 2);
    if (hard && !reducedMotion) cam.shake = Math.min(1, cam.shake + 0.35);
  }
  if (sim.falls > w.falls) w.fallT = 1;           // fall reaction
  if (sim.coinsRun > w.coins) w.grin = 0.7;
  // near miss: close to a hazard but not burnt -> sweat
  for (const p of sim.plats) { if (p.def.kind !== 'grill' && p.def.kind !== 'knife') continue; const q = p.body.getPosition();
    const dx = Math.max(0, Math.abs(c.x - q.x) - p.def.w / 2), dy = Math.max(0, Math.abs(c.y - q.y) - p.def.h / 2); if (Math.hypot(dx, dy) < 0.9) w.sweat = 1; }
  // steam rising from hot things on screen
  w.steamT -= dt; if (w.steamT < 0) { w.steamT = 0.12; for (const p of sim.plats) if (p.def.kind === 'grill') { const q = p.body.getPosition(); if (Math.abs(q.x - cam.x) < 12) emit(w, q.x + (Math.random() - 0.5) * p.def.w, q.y + p.def.h / 2, 1, 'rgba(255,255,255,.7)', 'steam', 0.6); } }
  if (sim.stuck) w.lastBase = sim.stuck.base;
  w.stuck = !!sim.stuck; w.falls = sim.falls; w.coins = sim.coinsRun; w.vy = v.y;
  w.sweat = Math.max(0, w.sweat - dt * 0.8); w.grin = Math.max(0, w.grin - dt); w.fallT = Math.max(0, w.fallT - dt * 1.1);
  w.blinkT -= dt; if (w.blinkT < -0.12) w.blinkT = 2 + Math.random() * 3;
  for (let i = w.fx.length - 1; i >= 0; i--) { const p = w.fx[i]; p.life -= dt; if (p.life <= 0) { w.fx.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; if (p.kind === 'steam') { p.vy = 1.2; p.vx *= 0.98; } else p.vy -= 9 * dt; }
  return w;
}
/** 0..1 of the funny fall reaction, for the HUD */
export const fallReaction = (sim: Sim) => watch.get(sim)?.fallT ?? 0;

// ---------------- world ----------------
export function drawWorld(ctx: CanvasRenderingContext2D, sim: Sim, cam: Camera, t: number, dt = 0) {
  const S = cam.S, a = sim.alpha, w = observe(sim, cam, dt);
  drawBackdrop(ctx, sim.L.theme, cam.x, cam.y, t);
  ctx.save();
  const sh = motion(Math.max(cam.shake, sim.shake)); if (sh > 0.01) ctx.translate((Math.random() - 0.5) * 12 * sh, (Math.random() - 0.5) * 12 * sh);
  const X = (x: number) => (x - cam.x) * S + W / 2, Y = (y: number) => H * 0.55 - (y - cam.y) * S;
  drawSoup(ctx, sim, X, Y, t);
  const theme = sim.L.theme;
  for (const p of sim.plats) drawPlatShadow(ctx, p.def, lerpPos(p.body, a), X, Y, S);
  for (const p of sim.plats) drawPlat(ctx, p.def, lerpPos(p.body, a), X, Y, S, t, theme);
  for (const f of sim.flags) drawFlag(ctx, X(f.x), Y(f.y), S, t, f.taken);
  for (const c of sim.coins) if (!c.taken) drawCoin(ctx, X(c.x), Y(c.y) + Math.sin(t * 3 + c.x) * 4, 0.27 * S, t + c.x);
  drawGoal(ctx, theme, X(sim.L.finish[0]), Y(sim.L.finish[1]), S, t, sim.state === 'win' ? sim.winT : -1);
  // aim preview: chili-red dots fading out
  if (sim.charging && CFG.jump.aimDots > 0) { const lv = sim.launchVector(); if (lv) { const c = sim.center, g = CFG.physics.gravity;
    for (let i = 1; i <= CFG.jump.aimDots; i++) { const tt = i / CFG.jump.aimDots * CFG.jump.aimTime; ctx.globalAlpha = 1 - i / (CFG.jump.aimDots + 2);
      ctx.beginPath(); ctx.arc(X(c.x + lv.x * tt), Y(c.y + lv.y * tt - 0.5 * g * tt * tt), 7 - i * 0.4, 0, 7); ctx.fillStyle = C.cream.light; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.primary.dark; ctx.stroke(); }
    ctx.globalAlpha = 1; } }
  drawGroundShadow(ctx, sim, X, Y, S);
  drawSausage(ctx, sim, X, Y, S, t, w);
  // sim particles (coins, stars, steam, dust) + render fx
  for (const p of sim.particles) { const al = p.life / p.max, x = X(p.x), y = Y(p.y); ctx.globalAlpha = al;
    if (p.type === 'coin' || p.type === 'star') sparkle(ctx, x, y, p.size * S * 1.6, p.type === 'coin' ? C.mustard.base : C.cream.light);
    else { ctx.fillStyle = p.type === 'steam' ? 'rgba(255,255,255,.8)' : p.type === 'spark' ? C.mustard.light : 'rgba(255,246,228,.85)'; ctx.beginPath(); ctx.arc(x, y, p.size * S * (p.type === 'steam' ? 2.2 - al : 1.3), 0, 7); ctx.fill(); } }
  for (const p of w.fx) { const al = p.life / p.max, x = X(p.x), y = Y(p.y), r = p.s * S; ctx.globalAlpha = Math.min(1, al * 1.5);
    if (p.kind === 'spark') sparkle(ctx, x, y, r * 1.6, p.col);
    else if (p.kind === 'chip') { ctx.fillStyle = p.col; ctx.save(); ctx.translate(x, y); ctx.rotate(p.life * 9); ctx.fillRect(-r, -r * 0.5, r * 2, r); ctx.restore(); }
    else { ctx.fillStyle = p.col; ctx.beginPath(); ctx.arc(x, y, r * (p.kind === 'steam' ? 2.6 - al * 1.4 : 1.4), 0, 7); ctx.fill(); } }
  ctx.globalAlpha = 1;
  ctx.restore();
  drawVignette(ctx);
}

function sparkle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, col: string) {
  ctx.fillStyle = col; ctx.beginPath();
  for (let k = 0; k < 8; k++) { const rr2 = k % 2 ? r * 0.28 : r; ctx.lineTo(x + Math.cos(k * Math.PI / 4) * rr2, y + Math.sin(k * Math.PI / 4) * rr2); }
  ctx.closePath(); ctx.fill();
}

/** the soup at the bottom (kill zone): bubbling lentil soup with a darker rim */
function drawSoup(ctx: CanvasRenderingContext2D, sim: Sim, X: (x: number) => number, Y: (y: number) => number, t: number) {
  const ky = Y(sim.L.killY + 2.5); if (ky >= H) return;
  ctx.fillStyle = '#c65d22'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, ky + Math.sin(x * 0.03 + t * 3) * 5); ctx.lineTo(W, H); ctx.fill();
  ctx.fillStyle = '#e8892f'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, ky + 8 + Math.sin(x * 0.03 + t * 3) * 5); ctx.lineTo(W, H); ctx.fill();
  ctx.strokeStyle = '#8a3510'; ctx.lineWidth = 4; ctx.beginPath(); for (let x = 0; x <= W; x += 20) { const y = ky + Math.sin(x * 0.03 + t * 3) * 5; x ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  for (let i = 0; i < 7; i++) { const bx = ((i * 211 + t * 30) % W), ph = (t * 0.9 + i * 0.37) % 1, by = ky + 26 + (i % 3) * 16 - ph * 10;
    ctx.globalAlpha = 1 - ph; ctx.strokeStyle = '#ffd08a'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bx, by, 4 + ph * 5, 0, 7); ctx.stroke(); }
  ctx.globalAlpha = 1;
}

// ---------------- platforms ----------------
function drawPlatShadow(ctx: CanvasRenderingContext2D, p: Plat, q: { x: number; y: number; a: number }, X: (x: number) => number, Y: (y: number) => number, S: number) {
  if (p.kind === 'knife') return;
  ctx.save(); ctx.translate(X(q.x) + 6, Y(q.y) + 9); ctx.rotate(-q.a); ctx.fillStyle = 'rgba(60,25,10,.18)';
  rr(ctx, -p.w * S / 2, -p.h * S / 2, p.w * S, p.h * S, 12); ctx.fill(); ctx.restore();
}
function outlineRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, base: string, dark: string, light: string) {
  rr(ctx, x, y, w, h, r); ctx.fillStyle = base; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  ctx.fillStyle = shade(dark, 0.22); ctx.fillRect(x, y + h * 0.72, w, h * 0.28);
  ctx.fillStyle = shade(light, 0.7); ctx.fillRect(x + 6, y + 3, w - 12, Math.min(6, h * 0.18));
  ctx.restore();
  rr(ctx, x, y, w, h, r); ctx.lineWidth = 3.5; ctx.strokeStyle = dark; ctx.stroke();
}
function drawPlat(ctx: CanvasRenderingContext2D, p: Plat, q: { x: number; y: number; a: number }, X: (x: number) => number, Y: (y: number) => number, S: number, t: number, theme: Theme) {
  const w = p.w * S, h = p.h * S, x0 = -w / 2, y0 = -h / 2, frozen = theme === 'fridge', hot = theme === 'stove';
  ctx.save(); ctx.translate(X(q.x), Y(q.y)); ctx.rotate(-q.a);
  switch (p.kind) {
    case 'counter': {
      // body: cabinet front (frozen block in the freezer, dark steel by the stove), top: thick worktop slab with knife marks
      const body = frozen ? C.ice : hot ? { base: '#6d6a72', dark: '#3d3a42', light: '#a6a2ad' } : { base: '#d9a76b', dark: '#7a4521', light: '#f2cf9d' };
      ctx.save(); rr(ctx, x0, y0, w, h, 10); ctx.clip();
      ctx.fillStyle = body.base; ctx.fillRect(x0, y0, w, h);
      ctx.strokeStyle = shade(body.dark, 0.35); ctx.lineWidth = 3;
      for (let dx = x0 + 22; dx < x0 + w - 20; dx += 150) { rr(ctx, dx, y0 + 46, Math.min(130, x0 + w - dx - 22), 120, 10); ctx.stroke(); ctx.fillStyle = shade(body.dark, 0.5); rr(ctx, dx + 50, y0 + 60, 30, 8, 4); ctx.fill(); }
      ctx.fillStyle = shade(body.dark, 0.25); ctx.fillRect(x0, y0 + 28, w, 8);
      ctx.restore();
      const top = frozen ? C.ice : C.wood;
      outlineRect(ctx, x0 - 3, y0 - 2, w + 6, 30, 9, top.base, top.dark, top.light);
      ctx.strokeStyle = shade(top.dark, 0.35); ctx.lineWidth = 2; for (let dx = x0 + 30; dx < x0 + w - 30; dx += 57) { ctx.beginPath(); ctx.moveTo(dx, y0 + 8); ctx.lineTo(dx + 14, y0 + 16); ctx.stroke(); }
      if (frozen) { ctx.fillStyle = C.ice.light; for (let dx = x0 + 18; dx < x0 + w - 10; dx += 46) { const len = 10 + (Math.abs(Math.sin(dx)) * 14); ctx.beginPath(); ctx.moveTo(dx, y0 + 26); ctx.lineTo(dx + 9, y0 + 26); ctx.lineTo(dx + 4, y0 + 26 + len); ctx.closePath(); ctx.fill(); } }
      rr(ctx, x0, y0, w, h, 10); ctx.lineWidth = 3.5; ctx.strokeStyle = body.dark; ctx.stroke();
      break;
    }
    case 'board': {
      outlineRect(ctx, x0, y0, w, h, Math.min(16, h / 2), '#e6b47a', '#8a5222', '#ffe1b5');
      ctx.strokeStyle = 'rgba(138,82,34,.35)'; ctx.lineWidth = 2; for (let dx = x0 + 18; dx < x0 + w - 18; dx += 23) { ctx.beginPath(); ctx.moveTo(dx, y0 + h * 0.3); ctx.lineTo(dx + 9, y0 + h * 0.7); ctx.stroke(); }
      if (h < 44) { ctx.fillStyle = '#8a5222'; rr(ctx, x0 + w - 30, -4, 16, 8, 4); ctx.fill(); }
      break;
    }
    case 'shelf': {
      if (frozen) {
        rr(ctx, x0, y0, w, h, 6); ctx.fillStyle = 'rgba(205,238,252,.9)'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.ice.dark; ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(x0 + 6, y0 + 3, w - 12, 4);
        ctx.fillStyle = C.ice.light; ctx.strokeStyle = C.ice.dark; ctx.lineWidth = 1.5;
        for (let dx = x0 + 14; dx < x0 + w - 10; dx += 30) { const len = 8 + Math.abs(Math.sin(dx * 1.7)) * 16; ctx.beginPath(); ctx.moveTo(dx, y0 + h); ctx.lineTo(dx + 10, y0 + h); ctx.lineTo(dx + 5, y0 + h + len); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      } else {
        outlineRect(ctx, x0, y0, w, h, 6, '#d4935a', '#7a4521', '#f2c793');
        ctx.fillStyle = '#7a4521'; for (const bx of [x0 + 20, x0 + w - 30]) { ctx.beginPath(); ctx.moveTo(bx, y0 + h); ctx.lineTo(bx + 10, y0 + h); ctx.lineTo(bx + 10, y0 + h + 24); ctx.closePath(); ctx.fill(); }
      }
      break;
    }
    case 'cabinet': {
      const T = frozen ? { base: '#e7f5fc', dark: '#7fb3cf', light: '#ffffff' } : { base: '#9ccfc4', dark: '#3f7f73', light: '#d2f0e9' };
      outlineRect(ctx, x0, y0, w, h, 8, T.base, T.dark, T.light);
      ctx.strokeStyle = shade(T.dark, 0.6); ctx.lineWidth = 3;
      for (let yy = y0 + 24; yy < y0 + h - 140; yy += 170) { rr(ctx, x0 + 10, yy, w - 20, 140, 8); ctx.stroke(); ctx.fillStyle = frozen ? '#9fc6db' : '#e0b85c'; ctx.beginPath(); ctx.arc(0, yy + 70, 6, 0, 7); ctx.fill(); }
      break;
    }
    case 'butter': {
      // butter block on wax paper
      ctx.fillStyle = '#fbf3e3'; rr(ctx, x0 - 2, y0 + h * 0.4, w + 4, h * 0.6, 6); ctx.fill(); ctx.strokeStyle = '#cdb994'; ctx.lineWidth = 2; ctx.stroke();
      outlineRect(ctx, x0, y0, w, h, 9, '#ffd95a', '#b98a08', '#fff6c2');
      for (let dx = x0 + 30; dx < x0 + w - 20; dx += 66) { ctx.fillStyle = '#ffd95a'; ctx.beginPath(); ctx.ellipse(dx, y0 + h + 3, 6, 7 + Math.sin(t * 2 + dx) * 2, 0, 0, 7); ctx.fill(); }
      ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.beginPath(); ctx.ellipse(x0 + w * 0.25, y0 + h * 0.35, w * 0.08, 3, 0, 0, 7); ctx.fill();
      break;
    }
    case 'jelly': {
      const wob = 1 + motion(Math.sin(t * 7) * 0.05); ctx.translate(0, h / 2); ctx.scale(1 / wob, wob); ctx.translate(0, -h / 2);
      rr(ctx, x0, y0, w, h, 14); ctx.fillStyle = 'rgba(230,55,90,.88)'; ctx.fill();
      ctx.save(); rr(ctx, x0, y0, w, h, 14); ctx.clip(); ctx.fillStyle = 'rgba(140,10,40,.25)'; ctx.fillRect(x0, y0 + h * 0.65, w, h); ctx.restore();
      rr(ctx, x0, y0, w, h, 14); ctx.lineWidth = 3.5; ctx.strokeStyle = '#8f1430'; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.beginPath(); ctx.ellipse(x0 + w * 0.3, y0 + 7, w * 0.18, 4, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(255,200,210,.6)'; ctx.beginPath(); ctx.arc(x0 + w * 0.72, y0 + h * 0.45, 5, 0, 7); ctx.arc(x0 + w * 0.55, y0 + h * 0.6, 3, 0, 7); ctx.fill();
      break;
    }
    case 'grill': {
      const glow = 0.6 + 0.4 * Math.sin(t * 5);
      rr(ctx, x0, y0, w, h, 8); ctx.fillStyle = '#3a3036'; ctx.fill();
      ctx.save(); rr(ctx, x0, y0, w, h, 8); ctx.clip();
      ctx.fillStyle = `rgba(255,${100 + 60 * glow | 0},40,.9)`; ctx.fillRect(x0, y0 + 12, w, Math.min(h * 0.5, 40));
      for (let dx = x0 + 16; dx < x0 + w; dx += 34) { ctx.fillStyle = `rgba(255,220,120,${0.5 + 0.4 * Math.sin(t * 4 + dx)})`; ctx.beginPath(); ctx.arc(dx, y0 + 30, 6, 0, 7); ctx.fill(); }
      // warning stripes along the bottom edge of the hot zone
      ctx.fillStyle = '#e2b031'; for (let dx = x0 - 20; dx < x0 + w; dx += 36) { ctx.beginPath(); ctx.moveTo(dx, y0 + h); ctx.lineTo(dx + 16, y0 + h); ctx.lineTo(dx + 34, y0 + h - 14); ctx.lineTo(dx + 18, y0 + h - 14); ctx.closePath(); ctx.fill(); }
      ctx.restore();
      ctx.fillStyle = '#7a7480'; for (let dx = x0 + 8; dx < x0 + w - 6; dx += 22) { rr(ctx, dx, y0 - 3, 10, 14, 4); ctx.fill(); }
      ctx.fillStyle = '#c9c3cf'; for (let dx = x0 + 8; dx < x0 + w - 6; dx += 22) ctx.fillRect(dx + 2, y0 - 2, 6, 3);
      rr(ctx, x0, y0, w, h, 8); ctx.lineWidth = 3.5; ctx.strokeStyle = '#211a1f'; ctx.stroke();
      break;
    }
    case 'knife': {
      ctx.fillStyle = '#5b3016'; rr(ctx, x0 - 5, y0 + h * 0.55, w + 10, h * 0.45, 5); ctx.fill(); ctx.strokeStyle = '#2f1608'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.fillStyle = '#c9a14a'; ctx.beginPath(); ctx.arc(0, y0 + h * 0.7, 2.5, 0, 7); ctx.arc(0, y0 + h * 0.85, 2.5, 0, 7); ctx.fill();
      ctx.beginPath(); ctx.moveTo(x0, y0 + h * 0.55); ctx.lineTo(x0, y0 + 10); ctx.lineTo(x0 + w, y0 - 8); ctx.lineTo(x0 + w, y0 + h * 0.55); ctx.closePath(); ctx.fillStyle = '#dfe6ee'; ctx.fill(); ctx.strokeStyle = '#5c6574'; ctx.lineWidth = 2.5; ctx.stroke();
      const gl = (t * 0.6 + q.x * 0.13) % 1; if (gl < 0.25) sparkle(ctx, x0 + w / 2, y0 + h * 0.5 * (1 - gl * 4), 7, '#ffffff');
      break;
    }
  }
  ctx.restore();
}

// ---------------- props ----------------
function drawCoin(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, t: number) {
  const sx = Math.max(0.18, Math.abs(Math.cos(t * 2.4)));
  ctx.save(); ctx.translate(x, y); ctx.scale(sx, 1); drawIcon(ctx, 'coin', 0, 0, r * 2.2); ctx.restore();
  const tw = (t * 0.8) % 1; if (tw < 0.18) { ctx.globalAlpha = 1 - tw / 0.18; sparkle(ctx, x + r * 0.5, y - r * 0.6, r * 0.7, '#fffbe0'); ctx.globalAlpha = 1; }
}
function drawFlag(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number, taken: boolean) {
  // kebab skewer with a pennant; turns green when reached
  const top = y - 1.7 * S;
  ctx.lineCap = 'round'; ctx.strokeStyle = '#7a4521'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, top); ctx.stroke();
  ctx.strokeStyle = '#d9a76b'; ctx.lineWidth = 4.5; ctx.stroke();
  ctx.fillStyle = '#4a7a2a'; ctx.beginPath(); ctx.arc(x, top - 4, 7, 0, 7); ctx.fill(); ctx.strokeStyle = '#25420f'; ctx.lineWidth = 2.5; ctx.stroke();
  const T = taken ? C.go : C.chili, wv = motion(Math.sin(t * 6 + x) * 5);
  ctx.beginPath(); ctx.moveTo(x + 3, top + 6); ctx.quadraticCurveTo(x + 0.5 * S, top + 2 + wv, x + 0.85 * S, top + 0.25 * S + wv); ctx.lineTo(x + 3, top + 0.55 * S); ctx.closePath();
  ctx.fillStyle = T.base; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.dark; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.beginPath(); ctx.moveTo(x + 6, top + 10); ctx.lineTo(x + 0.45 * S, top + 0.18 * S + wv); ctx.lineTo(x + 6, top + 18); ctx.closePath(); ctx.fill();
  if (taken) { ctx.fillStyle = C.cream.light; ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 6); sparkle(ctx, x + 0.9 * S, top - 6, 7, C.cream.light); ctx.globalAlpha = 1; }
}
/** a finish object per world; `won` = seconds since winning (-1 = not yet) */
function drawGoal(ctx: CanvasRenderingContext2D, theme: Theme, x: number, y: number, S: number, t: number, won: number) {
  const bob = won >= 0 ? 0 : motion(Math.sin(t * 3) * 6), pop = won >= 0 ? 1 + 0.15 * Math.sin(Math.min(won, 0.6) / 0.6 * Math.PI) : 1;
  ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
  ctx.fillStyle = 'rgba(60,25,10,.2)'; ctx.beginPath(); ctx.ellipse(0, 2, 0.95 * S, 8, 0, 0, 7); ctx.fill();
  if (theme === 'stove') {
    // frying pan with sizzling oil
    ctx.strokeStyle = '#2b2328'; ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(0.8 * S, -0.22 * S); ctx.lineTo(1.6 * S, -0.5 * S); ctx.stroke();
    ctx.strokeStyle = '#a0522d'; ctx.lineWidth = 7; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -0.2 * S, 0.95 * S, 0.3 * S, 0, 0, 7); ctx.fillStyle = '#3a3036'; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = '#1d171b'; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -0.24 * S, 0.75 * S, 0.2 * S, 0, 0, 7); ctx.fillStyle = '#5a4a3a'; ctx.fill();
    ctx.fillStyle = 'rgba(255,214,120,.8)'; for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(-0.4 * S + i * 0.27 * S, -0.26 * S, 3 + Math.sin(t * 9 + i) * 1.5, 0, 7); ctx.fill(); }
  } else if (theme === 'shelves' || theme === 'fridge') {
    // plate with a mustard squiggle (frosty rim in the freezer)
    const rim = theme === 'fridge' ? C.ice : C.cream;
    ctx.beginPath(); ctx.ellipse(0, -0.12 * S, 1.0 * S, 0.24 * S, 0, 0, 7); ctx.fillStyle = rim.base; ctx.fill(); ctx.lineWidth = 3.5; ctx.strokeStyle = rim.dark; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, -0.15 * S, 0.66 * S, 0.14 * S, 0, 0, 7); ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = C.mustard.base; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = 0; i <= 12; i++) { const px = -0.45 * S + i * 0.075 * S, py = -0.16 * S + Math.sin(i * 1.4 + t * 2) * 4; i ? ctx.lineTo(px, py) : ctx.moveTo(px, py); } ctx.stroke();
  } else {
    // hot-dog bun with sesame
    const w = 1.7 * S, h = 0.7 * S;
    rr(ctx, -w / 2, -h, w, h, h / 2); ctx.fillStyle = '#e09a46'; ctx.fill();
    ctx.save(); rr(ctx, -w / 2, -h, w, h, h / 2); ctx.clip(); ctx.fillStyle = 'rgba(138,70,20,.25)'; ctx.fillRect(-w / 2, -h * 0.35, w, h); ctx.fillStyle = 'rgba(255,255,255,.35)'; rr(ctx, -w * 0.38, -h * 0.92, w * 0.5, 7, 3); ctx.fill(); ctx.restore();
    rr(ctx, -w / 2, -h, w, h, h / 2); ctx.lineWidth = 3.5; ctx.strokeStyle = '#8a4614'; ctx.stroke();
    ctx.fillStyle = '#fbe2b0'; rr(ctx, -w / 2 + 12, -h * 0.78, w - 24, h * 0.32, 8); ctx.fill();
    ctx.fillStyle = '#fff6dc'; for (let i = 0; i < 6; i++) { ctx.beginPath(); ctx.ellipse(-w * 0.34 + i * w * 0.135, -h * 0.25, 3, 2, 0.5, 0, 7); ctx.fill(); }
  }
  ctx.restore();
  if (won < 0) { // bouncing arrow: green pennant arrow pointing at the goal
    ctx.save(); ctx.translate(x, y - 1.45 * S + bob); drawIcon(ctx, 'arrowR', 0, 0, 44, { tint: C.go }); ctx.restore();
  } else if (won < 1.2) { ctx.globalAlpha = 1 - won / 1.2; for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2 + won * 2; sparkle(ctx, x + Math.cos(a) * won * 140, y - 0.6 * S + Math.sin(a) * won * 90, 9, k % 2 ? C.mustard.light : C.cream.light); } ctx.globalAlpha = 1; }
}

// ---------------- sausage ----------------
/** soft shadow on the surface below the sausage; shrinks and fades with height */
function drawGroundShadow(ctx: CanvasRenderingContext2D, sim: Sim, X: (x: number) => number, Y: (y: number) => number, S: number) {
  const c = sim.center; let low = c.y; for (const s of sim.segs) low = Math.min(low, s.getPosition().y - CFG.sausage.radius);
  let best = -Infinity;
  for (const p of sim.plats) { const q = p.body.getPosition(); if (Math.abs(p.body.getAngle()) > 0.05 || p.def.kind === 'knife') continue; const top = q.y + p.def.h / 2;
    if (c.x > q.x - p.def.w / 2 && c.x < q.x + p.def.w / 2 && top <= low + 0.05 && top > best) best = top; }
  if (best === -Infinity) return;
  const hgt = Math.max(0, low - best), k = 1 / (1 + hgt * 0.6);
  ctx.fillStyle = `rgba(60,25,10,${0.3 * k})`; ctx.beginPath(); ctx.ellipse(X(c.x), Y(best) + 2, 0.75 * S * k + 6, 6 * k + 2, 0, 0, 7); ctx.fill();
}

export interface Face { look: { x: number; y: number }; blink: boolean; mood: 'calm' | 'grin' | 'sweat' | 'dizzy' | 'effort'; }
/**
 * Draw a sausage through screen points (base..tip). Shared by the game, title, skins and loading screens.
 * `thick` = body thickness in px; eyes sit near pts[pts.length-1].
 */
export function drawSausageShape(ctx: CanvasRenderingContext2D, pts: { x: number; y: number }[], thick: number, skinId: string | undefined, face: Face, t: number) {
  const sk = skinDef(skinId), n = pts.length;
  const path = () => { ctx.beginPath(); ctx.moveTo(pts[0].x, pts[0].y); for (let i = 1; i < n - 1; i++) { const mx = (pts[i].x + pts[i + 1].x) / 2, my = (pts[i].y + pts[i + 1].y) / 2; ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my); } ctx.lineTo(pts[n - 1].x, pts[n - 1].y); };
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  path(); ctx.strokeStyle = sk.dark; ctx.lineWidth = thick + 7; ctx.stroke();
  path(); ctx.strokeStyle = sk.body; ctx.lineWidth = thick; ctx.stroke();
  ctx.save(); ctx.translate(thick * 0.12, thick * 0.2); path(); ctx.strokeStyle = shade(sk.dark, 0.35); ctx.lineWidth = thick * 0.38; ctx.stroke(); ctx.restore();   // one shadow band
  ctx.save(); ctx.translate(-thick * 0.14, -thick * 0.22); path(); ctx.strokeStyle = sk.light; ctx.globalAlpha = 0.85; ctx.lineWidth = thick * 0.3; ctx.stroke(); ctx.restore(); // one highlight
  ctx.save(); ctx.translate(-thick * 0.18, -thick * 0.28); path(); ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = thick * 0.09; ctx.stroke(); ctx.restore();  // gloss
  if (sk.fat) { ctx.fillStyle = sk.fat; for (let i = 1; i < n - 1; i++) { const p = pts[i], q = pts[i + 1], ox = (i % 2 ? 0.2 : -0.16) * thick, nx = -(q.y - p.y), ny = q.x - p.x, l = Math.hypot(nx, ny) || 1;
    ctx.beginPath(); ctx.ellipse(p.x + nx / l * ox, p.y + ny / l * ox, thick * 0.09, thick * 0.055, Math.atan2(q.y - p.y, q.x - p.x), 0, 7); ctx.fill(); } }
  // string ties at both ends
  ctx.strokeStyle = '#efe0bf'; ctx.lineWidth = 3;
  for (const [e, f] of [[0, 1], [n - 1, n - 2]]) { const p = pts[e], q = pts[f], dx = p.x - q.x, dy = p.y - q.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l, cx = p.x + ux * thick * 0.45, cy = p.y + uy * thick * 0.45;
    ctx.beginPath(); ctx.moveTo(cx - uy * thick * 0.25, cy + ux * thick * 0.25); ctx.lineTo(cx + uy * thick * 0.25, cy - ux * thick * 0.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + ux * 2, cy + uy * 2); ctx.quadraticCurveTo(cx + ux * 12 + uy * 6, cy + uy * 12 - ux * 6, cx + ux * 16 + Math.sin(t * 8) * 3, cy + uy * 16); ctx.stroke(); }
  // face near the tip
  const e0 = pts[n - 1], e1 = pts[n - 2], dx = e1.x - e0.x, dy = e1.y - e0.y, l = Math.hypot(dx, dy) || 1, ux = dx / l, uy = dy / l;
  const ex = e0.x + ux * thick * 0.8, ey = e0.y + uy * thick * 0.8, nx = uy, ny = -ux, r = thick * 0.3;
  for (const k of [-1, 1]) {
    const cx = ex + nx * thick * 0.28 * k, cy = ey + ny * thick * 0.28 * k;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = sk.dark; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill(); ctx.stroke();
    if (face.mood === 'dizzy') { ctx.strokeStyle = sk.dark; ctx.lineWidth = 2.5; ctx.beginPath(); for (let a = 0; a < 9; a += 0.4) ctx.lineTo(cx + Math.cos(a + t * 8) * a * r * 0.09, cy + Math.sin(a + t * 8) * a * r * 0.09); ctx.stroke(); continue; }
    if (face.blink) { ctx.fillStyle = sk.body; ctx.beginPath(); ctx.arc(cx, cy, r + 1, 0, 7); ctx.fill(); ctx.strokeStyle = sk.dark; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(cx - r * 0.8, cy); ctx.quadraticCurveTo(cx, cy + r * 0.5, cx + r * 0.8, cy); ctx.stroke(); continue; }
    ctx.fillStyle = '#1a0a05'; ctx.beginPath(); ctx.arc(cx + face.look.x * r * 0.42, cy + face.look.y * r * 0.42, r * 0.48, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(cx + face.look.x * r * 0.42 - r * 0.15, cy + face.look.y * r * 0.42 - r * 0.18, r * 0.15, 0, 7); ctx.fill();
  }
  // mouth
  const mx = ex + ux * thick * 0.55, my = ey + uy * thick * 0.55; ctx.strokeStyle = sk.dark; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
  const ma = Math.atan2(uy, ux) - Math.PI / 2;
  ctx.save(); ctx.translate(mx, my); ctx.rotate(ma);
  if (face.mood === 'grin') { ctx.fillStyle = '#5a150a'; ctx.beginPath(); ctx.arc(0, -2, thick * 0.2, 0, Math.PI); ctx.closePath(); ctx.fill(); ctx.stroke(); }
  else if (face.mood === 'dizzy' || face.mood === 'effort') { ctx.beginPath(); ctx.ellipse(0, 0, thick * 0.1, thick * (face.mood === 'dizzy' ? 0.12 : 0.06), 0, 0, 7); ctx.fillStyle = '#5a150a'; ctx.fill(); }
  else { ctx.beginPath(); ctx.arc(0, -thick * 0.06, thick * 0.12, 0.25, Math.PI - 0.25); ctx.stroke(); }
  ctx.restore();
  if (face.mood === 'sweat' || face.mood === 'effort') { const o = (t * 2) % 1; ctx.fillStyle = 'rgba(150,215,255,.95)'; ctx.strokeStyle = '#3a7fb0'; ctx.lineWidth = 1.5;
    const sx = ex + nx * thick * 0.75, sy = ey + ny * thick * 0.75 + o * 14; ctx.beginPath(); ctx.moveTo(sx, sy - 7); ctx.quadraticCurveTo(sx + 6, sy + 2, sx, sy + 4); ctx.quadraticCurveTo(sx - 6, sy + 2, sx, sy - 7); ctx.fill(); ctx.stroke(); }
}

function drawSausage(ctx: CanvasRenderingContext2D, sim: Sim, X: (x: number) => number, Y: (y: number) => number, S: number, t: number, w: Watch) {
  const a = sim.alpha, n = sim.segs.length, base = sim.stuck ? sim.stuck.base : w.lastBase; // eyes stay on the same end in the air
  let pts = sim.segs.map(s => { const q = lerpPos(s, a); return { x: X(q.x), y: Y(q.y) }; });
  if (base !== 0) pts = pts.reverse();                       // pts[0] = base, pts[n-1] = tip (eyes)
  const sq = sim.charging ? 0.24 * sim.charge : -0.14 * sim.landSquash * Math.sin(t * 30);
  if (sq) { const b = pts[0]; pts = pts.map(p => ({ x: b.x + (p.x - b.x) * (1 - sq), y: b.y + (p.y - b.y) * (1 - sq) })); }
  const thick = CFG.sausage.radius * 2 * S * (1 + Math.max(0, sq) * 0.6);
  const v = sim.velocity, sp = Math.hypot(v.x, v.y), dir = sp > 0.5 ? { x: v.x / sp, y: -v.y / sp } : { x: Math.sin(sim.swayLean) || 0.3, y: 0.2 };
  const mood: Face['mood'] = w.fallT > 0.6 ? 'dizzy' : sim.charging ? 'effort' : w.sweat > 0.3 ? 'sweat' : w.grin > 0 || sim.state === 'win' ? 'grin' : 'calm';
  drawSausageShape(ctx, pts, thick, undefined, { look: { x: dir.x * Math.min(1, sp / 6 + 0.3), y: dir.y * Math.min(1, sp / 6 + 0.3) }, blink: w.blinkT < 0 && !sim.charging, mood }, t);
  void n;
}
