import type { Body } from 'planck';
import { Sim, Ud, Crate } from './world';
import { hash } from './levels';
import { save } from './save';
import { ART, WORLD_ART, WorldArt, Tri } from '../art/palette';
import { FONT_DISPLAY, motion, reducedMotion } from '../ui/theme';

export const W = 1280, H = 720;
/** 92 px per metre at rest: the rover body (~2.8 m) is ~20% of screen width. */
export const BASE_PPM = 92;
const ROVER_OUT = ART.roverAccent.dark;   // rover outline (#8a3e1c)

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
    this.S = BASE_PPM * this.zoom * (1 + 0.07 * sim.punch * motion(1));
    const tx = c.x + (W / 2 - W * 0.35) / this.S + this.look;
    const ty = c.y * 0.75 + (sim.groundY(c.x) + 1.0) * 0.25 + 50 / this.S;
    if (!this.init) { this.x = tx; this.y = ty; this.init = true; }
    this.x += (tx - this.x) * (1 - Math.exp(-dt * 9));
    this.y += (ty - this.y) * (1 - Math.exp(-dt * 4));
  }
}

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
const mk = (w: number, h: number) => { const c = document.createElement('canvas'); c.width = Math.max(1, w); c.height = Math.max(1, h); return c; };
const ctx2d = (c: HTMLCanvasElement) => c.getContext('2d')!;
const al = (hex: string, a: number) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

/**
 * Style helper: fill the current path flat, add one shadow shape (bottom-right crescent) and one highlight streak
 * (top-left crescent), then outline it in the darker shade. `path` must rebuild the same path each call.
 */
function shape(ctx: CanvasRenderingContext2D, path: () => void, T: Tri, s: number, o: { out?: string; lw?: number; noShade?: boolean; noHi?: boolean } = {}) {
  path(); ctx.fillStyle = T.base; ctx.fill();
  if (!o.noShade || !o.noHi) {
    ctx.save(); path(); ctx.clip();
    const d = Math.max(1.5, s * 0.04);
    // path() starts a new path, so build the shifted copy first and then add a huge rect: evenodd = outside the copy
    if (!o.noShade) { ctx.fillStyle = al(T.dark, 0.32); ctx.save(); ctx.translate(-d * 0.8, -d); path(); ctx.restore(); ctx.rect(-1e5, -1e5, 2e5, 2e5); fillEvenOddCurrent(ctx); }
    if (!o.noHi) { ctx.fillStyle = al(T.light, 0.8); ctx.save(); ctx.translate(d * 0.5, d * 0.6); path(); ctx.restore(); ctx.rect(-1e5, -1e5, 2e5, 2e5); fillEvenOddCurrent(ctx); }
    ctx.restore();
  }
  path(); ctx.lineWidth = o.lw ?? Math.max(2, s * 0.028); ctx.strokeStyle = o.out ?? T.dark; ctx.lineJoin = 'round'; ctx.stroke();
}
/** `path()` calls beginPath; this variant appends: we rebuild it into one evenodd fill */
function fillEvenOddCurrent(ctx: CanvasRenderingContext2D) { ctx.fill('evenodd'); }

// ======================================================================
// Sky and background (3 parallax layers per world)
// ======================================================================
const planetCache = new Map<number, HTMLCanvasElement>();
function blob(g: CanvasRenderingContext2D, x: number, y: number, r: number, seed: number, k = 0.8) {
  g.beginPath(); for (let i = 0; i <= 14; i++) { const a = i / 14 * Math.PI * 2, rr2 = r * (0.72 + 0.4 * hash(seed + i)); g.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2 * k); } g.closePath();
}
function planetCanvas(wi: number) {
  let c = planetCache.get(wi); if (c) return c;
  c = mk(320, 320); const g = ctx2d(c), cx = 160, cy = 160, A = WORLD_ART[wi];
  if (A.planet === 'earth') {
    const R = 82;
    for (let i = 4; i >= 1; i--) { g.fillStyle = `rgba(150,200,255,${0.05 * i})`; g.beginPath(); g.arc(cx, cy, R + 6 * (5 - i), 0, 7); g.fill(); } // soft atmosphere halo (sky element)
    g.save(); g.beginPath(); g.arc(cx, cy, R, 0, 7); g.clip();
    g.fillStyle = '#5b93cf'; g.fillRect(0, 0, 320, 320);
    g.fillStyle = '#7bb5e3'; g.beginPath(); g.ellipse(cx - 30, cy - 34, 50, 30, -0.5, 0, 7); g.fill();
    for (const [x, y, r, s] of [[cx - 34, cy - 4, 32, 3], [cx + 34, cy + 34, 24, 17], [cx + 26, cy - 44, 17, 31], [cx - 10, cy + 54, 14, 5]]) { blob(g, x, y, r, s); g.fillStyle = '#86c27a'; g.fill(); g.lineWidth = 3; g.strokeStyle = '#4f8a52'; g.stroke(); }
    g.fillStyle = '#d8c48f'; blob(g, cx - 28, cy + 2, 12, 51); g.fill();
    g.fillStyle = 'rgba(255,255,255,.85)'; for (let i = 0; i < 8; i++) { g.beginPath(); g.ellipse(cx - 76 + hash(i * 3) * 150, cy - 70 + hash(i * 7) * 140, 20 + hash(i) * 20, 6 + hash(i * 2) * 4, -0.2, 0, 7); g.fill(); }
    g.fillStyle = 'rgba(30,40,80,.38)'; g.beginPath(); g.arc(cx + 34, cy + 22, R + 4, 0, 7); g.arc(cx, cy, R + 40, 0, 7, true); g.fill(); // flat night-side shadow shape
    g.restore();
    g.lineWidth = 4; g.strokeStyle = '#3d6ea3'; g.beginPath(); g.arc(cx, cy, R, 0, 7); g.stroke();
    g.strokeStyle = 'rgba(230,245,255,.75)'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, R - 7, Math.PI * 1.05, Math.PI * 1.45); g.stroke();
  } else if (A.planet === 'sun') { // hazy sun + small moon
    for (let i = 6; i >= 1; i--) { g.fillStyle = `rgba(255,214,160,${0.05 * i})`; g.beginPath(); g.arc(cx, cy, 34 + i * 14, 0, 7); g.fill(); }
    g.fillStyle = '#fff1d6'; g.beginPath(); g.arc(cx, cy, 34, 0, 7); g.fill();
    g.save(); g.translate(64, 250); g.rotate(-0.4); g.fillStyle = '#9a7564'; g.beginPath(); g.ellipse(0, 0, 22, 15, 0, 0, 7); g.fill(); g.lineWidth = 3; g.strokeStyle = '#6e5144'; g.stroke();
    g.fillStyle = '#6e5144'; g.beginPath(); g.arc(-6, 3, 4, 0, 7); g.arc(7, -3, 3, 0, 7); g.fill(); g.restore();
  } else { // ringed gas giant
    const R = 86; g.save(); g.translate(cx, cy); g.rotate(-0.35);
    g.strokeStyle = '#e9d3a8'; g.lineWidth = 12; g.beginPath(); g.ellipse(0, 0, 140, 30, 0, Math.PI, 0); g.stroke();
    g.beginPath(); g.arc(0, 0, R, 0, 7); g.save(); g.clip();
    const bands = ['#e9c995', '#d7a477', '#f1dcb3', '#c98f68', '#e6c28f', '#c07f5c', '#efd6a6'];
    for (let i = 0; i < 14; i++) { g.fillStyle = bands[i % bands.length]; g.fillRect(-R, -R + i * 13, 2 * R, 14); }
    g.fillStyle = 'rgba(40,40,80,.3)'; g.beginPath(); g.arc(30, 20, R + 4, 0, 7); g.arc(0, 0, R + 40, 0, 7, true); g.fill(); g.restore();
    g.lineWidth = 4; g.strokeStyle = '#a77654'; g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke();
    g.strokeStyle = '#f2e1bd'; g.lineWidth = 10; g.beginPath(); g.ellipse(0, 0, 140, 30, 0, 0, Math.PI); g.stroke(); g.restore();
  }
  planetCache.set(wi, c); return c;
}

const PERIOD = 2048, STAR_W = 1600;
const STARS = [0, 1].map(l => Array.from({ length: 60 - l * 20 }, (_, i) => ({ x: hash(i * 13 + l * 101) * STAR_W, y: hash(i * 7 + l * 31) * 420, s: 1.6 + l * 1.2, b: 0.4 + hash(i * 3 + l) * 0.6, tw: hash(i * 9 + l) * 6 })));
const LAYER = [{ par: 0.05, base: 440, amp: 1.0 }, { par: 0.12, base: 488, amp: 0.85 }, { par: 0.26, base: 540, amp: 0.55 }];
/** layer silhouettes: Moon = soft rounded ridges, Mars = long dunes, Ice = flat-topped cliffs */
function layerY(x: number, l: number, wi: number) {
  const s = l * 17.3 + wi * 3.1, k = Math.PI * 2 / PERIOD;
  if (wi === 1) return Math.sin(x * k * 2 + s) * 46 + Math.sin(x * k * 5 + s * 2) * 18 + Math.sin(x * k * 11 + s) * 5;
  if (wi === 2) { const raw = Math.sin(x * k * 3 + s) * 52 + Math.sin(x * k * 7 + s * 2) * 24; return Math.min(raw, 34 + l * 6) + Math.abs(Math.sin(x * k * 13 + s)) * 6; }
  return Math.abs(Math.sin(x * k * 3 + s)) * 58 + Math.sin(x * k * 8 + s * 2) * 14 + Math.abs(Math.sin(x * k * 17 + s)) * 9;
}

/** CSS background for the canvas: the sky is never painted by the canvas itself */
export function skyCss(wi: number) {
  const A = WORLD_ART[wi];
  return `radial-gradient(ellipse 40% 35% at 25% 30%, ${A.haze}, transparent), linear-gradient(180deg, ${A.sky[0]} 0%, ${A.sky[1]} 52%, ${A.sky[2]} 100%)`;
}

let shoot = { t: 4, x: 0, y: 0 };
export function backdrop(ctx: CanvasRenderingContext2D, wi: number, camX: number, camY: number, t: number, dt: number, groundBottom = H) {
  const A = WORLD_ART[wi];
  ctx.fillStyle = A.stars;
  for (let l = 0; l < 2; l++) {
    const par = [3, 8][l], y0 = -camY * (l + 1) * 2;
    for (const s of STARS[l]) {
      const x = ((s.x - camX * par) % STAR_W + STAR_W) % STAR_W - 160; if (x < -6 || x > W + 6) continue;
      const tw = reducedMotion ? 1 : 0.65 + 0.35 * Math.sin(t * 1.3 + s.tw);
      ctx.globalAlpha = A.starAlpha * s.b * tw; const r = s.s * 0.5 + 0.4;
      ctx.fillRect(x - r, s.y + y0 - r, r * 2, r * 2);
    }
  }
  ctx.globalAlpha = 1;
  if (!reducedMotion) { shoot.t -= dt; if (shoot.t < 0) shoot = { t: 7 + Math.random() * 6, x: 200 + Math.random() * 800, y: 40 + Math.random() * 140 };
    if (shoot.t > 6.4 && shoot.t < 7) { const p = 1 - (shoot.t - 6.4) / 0.6, x = shoot.x + p * 240, y = shoot.y + p * 80; ctx.strokeStyle = al(A.stars, 0.8 * (1 - p)); ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x - 70, y - 24); ctx.lineTo(x, y); ctx.stroke(); } }
  ctx.drawImage(planetCanvas(wi), 860, 26 - camY * 1.5);
  for (let l = 0; l < 3; l++) {
    const L = LAYER[l], off = camX * BASE_PPM * L.par, yoff = -camY * [4, 9, 16][l];
    const bottom = Math.min(groundBottom, l < 2 ? LAYER[l + 1].base + 50 + yoff : H);
    ctx.fillStyle = A.layers[l]; ctx.beginPath(); ctx.moveTo(0, bottom);
    for (let sx = 0; sx <= W + 16; sx += 16) ctx.lineTo(sx, L.base + yoff - layerY(sx + off, l, wi) * L.amp);
    ctx.lineTo(W, bottom); ctx.closePath(); ctx.fill();
    if (l === 2) { // soft rim light along the near layer's edge (far layers stay flat: lower contrast with distance)
      ctx.strokeStyle = al(A.layerRim, 0.55); ctx.lineWidth = 3; ctx.lineJoin = 'round';
      ctx.beginPath(); for (let sx = 0; sx <= W + 16; sx += 32) { const y = L.base + yoff - layerY(sx + off, l, wi) * L.amp + 1.5; sx ? ctx.lineTo(sx, y) : ctx.moveTo(sx, y); } ctx.stroke(); // near layer: small rounded rocks sitting on it
      ctx.fillStyle = A.layers[1];
      for (let i = Math.floor(off / 90) - 1; i <= Math.ceil((off + W) / 90) + 1; i++) { if (hash(i * 3.3 + wi) > 0.45) continue; const sx = i * 90 + hash(i * 7.1) * 60 - off, r = 6 + hash(i * 1.7) * 12, y = L.base + yoff - layerY(sx + off, l, wi) * L.amp + r * 0.4;
        ctx.beginPath(); ctx.ellipse(sx, y, r * 1.3, r * 0.8, 0, Math.PI, 0); ctx.fill(); }
    }
  }
}

// ======================================================================
// Sprites (rendered once per pixel density, blitted with a transform)
// ======================================================================
let pxScale = 1;
export function setPixelScale(k: number) { pxScale = Math.max(0.25, Math.round(k * 20) / 20); }
const SPR_S = BASE_PPM * 1.08;
type Spr = { c: HTMLCanvasElement; w: number; h: number; ox: number; oy: number };
const sprites = new Map<string, Spr>();
/** bounds [left, top, right, bottom] in metres around the drawing origin (screen orientation, y down) */
function sprite(key: string, b: [number, number, number, number], draw: (g: CanvasRenderingContext2D, S: number) => void): Spr {
  const k = key + '@' + pxScale; let sp = sprites.get(k);
  if (!sp) {
    if (sprites.size > 180) sprites.clear();
    const w = (b[2] - b[0]) * SPR_S, h = (b[3] - b[1]) * SPR_S, c = mk(Math.ceil(w * pxScale), Math.ceil(h * pxScale)), g = ctx2d(c);
    g.scale(pxScale, pxScale); g.translate(-b[0] * SPR_S, -b[1] * SPR_S); draw(g, SPR_S); sp = { c, w, h, ox: b[0] * SPR_S, oy: b[1] * SPR_S }; sprites.set(k, sp);
  }
  return sp;
}
function blit(ctx: CanvasRenderingContext2D, sp: Spr, x: number, y: number, ang: number, S: number, sx = 1, sy = 1) {
  const f = S / SPR_S; ctx.save(); ctx.translate(x, y); if (ang) ctx.rotate(-ang); ctx.scale(f * sx, f * sy); ctx.drawImage(sp.c, sp.ox, sp.oy, sp.w, sp.h); ctx.restore();
}

// ---------------- rover ----------------
export type Up = typeof save.up;
const rivets = (g: CanvasRenderingContext2D, s: number, pts: number[][], T: Tri) => { for (const [x, y] of pts) { g.fillStyle = T.dark; g.beginPath(); g.arc(x * s, y * s + 1, 0.022 * s, 0, 7); g.fill(); g.fillStyle = T.light; g.beginPath(); g.arc(x * s, y * s, 0.02 * s, 0, 7); g.fill(); } };
/** hull + chassis rail + bumper + turbo nozzle + battery pack (body-local, y down). Collider: box ±1.35 x ±0.18. */
function roverHull(g: CanvasRenderingContext2D, s: number, up: Up) {
  const B = ART.roverBody, O = ART.roverAccent, D = ART.roverDark, M = ART.roverMetal;
  // turbo nozzle (grows with the turbo upgrade)
  const tn = 0.12 + 0.025 * up.turbo;
  shape(g, () => { g.beginPath(); g.moveTo(-1.34 * s, -0.09 * s); g.lineTo((-1.36 - tn) * s, -0.13 * s); g.lineTo((-1.36 - tn) * s, 0.07 * s); g.lineTo(-1.34 * s, 0.04 * s); g.closePath(); }, M, s);
  g.fillStyle = D.dark; g.beginPath(); g.ellipse((-1.36 - tn) * s, -0.03 * s, 0.025 * s, 0.09 * s, 0, 0, 7); g.fill();
  // chassis rail under the hull
  shape(g, () => rr(g, -1.3 * s, 0.08 * s, 2.6 * s, 0.13 * s, 0.05 * s), D, s, { noHi: true });
  // hull
  const hull = () => rr(g, -1.38 * s, -0.19 * s, 2.78 * s, 0.32 * s, 0.08 * s);
  shape(g, hull, B, s, { out: ROVER_OUT });
  g.save(); hull(); g.clip();
  g.fillStyle = O.base; g.fillRect(-1.4 * s, -0.06 * s, 2.9 * s, 0.09 * s); g.fillStyle = O.dark; g.fillRect(-1.4 * s, 0.02 * s, 2.9 * s, 0.015 * s); g.fillStyle = al(O.light, 0.8); g.fillRect(-1.4 * s, -0.06 * s, 2.9 * s, 0.018 * s);
  for (let i = 0; i < 3; i++) { g.fillStyle = i % 2 ? D.base : ART.sign.base; g.beginPath(); g.moveTo((-1.38 + i * 0.07) * s, 0.04 * s); g.lineTo((-1.31 + i * 0.07) * s, 0.04 * s); g.lineTo((-1.26 + i * 0.07) * s, 0.13 * s); g.lineTo((-1.33 + i * 0.07) * s, 0.13 * s); g.fill(); }
  // dents and scratches
  g.strokeStyle = al(B.dark, 0.55); g.lineWidth = 0.012 * s; g.beginPath(); g.arc(-0.55 * s, -0.12 * s, 0.05 * s, 0.3, 2.6); g.stroke();
  g.strokeStyle = al(B.light, 0.9); g.beginPath(); g.moveTo(0.2 * s, -0.15 * s); g.lineTo(0.34 * s, -0.11 * s); g.moveTo(0.24 * s, -0.16 * s); g.lineTo(0.33 * s, -0.135 * s); g.stroke();
  g.restore();
  hull(); g.lineWidth = Math.max(2, s * 0.028); g.strokeStyle = ROVER_OUT; g.stroke();
  rivets(g, s, [[-1.2, -0.13], [-0.8, -0.13], [-0.4, -0.13], [0.0, -0.13], [0.4, -0.13], [0.8, -0.13], [1.2, -0.13]], B);
  // battery pack on the side (cells = battery upgrade)
  shape(g, () => rr(g, -0.62 * s, 0.03 * s, 0.5 * s, 0.13 * s, 0.03 * s), M, s, { noHi: true });
  const cells = 1 + Math.round(up.battery / 2); for (let i = 0; i < Math.min(5, cells); i++) { g.fillStyle = ART.energy.base; g.fillRect((-0.59 + i * 0.09) * s, 0.06 * s, 0.065 * s, 0.07 * s); }
  // tail light
  g.fillStyle = ART.danger.base; g.strokeStyle = ART.danger.dark; g.lineWidth = 1.5; rr(g, -1.42 * s, -0.17 * s, 0.07 * s, 0.1 * s, 0.02 * s); g.fill(); g.stroke();
  // front bumper (bumper upgrade makes it bigger: max ~0.2 m past the hull)
  const bp = 0.06 + 0.028 * up.bumper;
  shape(g, () => { g.beginPath(); g.moveTo(1.38 * s, -0.17 * s); g.lineTo((1.4 + bp) * s, -0.1 * s); g.lineTo((1.42 + bp) * s, 0.08 * s); g.lineTo((1.38 + bp * 0.6) * s, 0.18 * s); g.lineTo(1.36 * s, 0.18 * s); g.closePath(); }, D, s);
  if (up.bumper > 0) { g.fillStyle = O.base; g.fillRect(1.39 * s, -0.04 * s, (bp * 0.9) * s, 0.05 * s); }
  rivets(g, s, [[1.4 + bp * 0.45, -0.07], [1.4 + bp * 0.45, 0.11]], M);
}
/** cab, bed posts, antenna mast, roof parts (body-local). Collider: cab box at (0.95, 0.52) ±(0.42, 0.38); walls at x -1.33 / 0.48. */
function roverCab(g: CanvasRenderingContext2D, s: number, bedH: number, up: Up) {
  const B = ART.roverBody, O = ART.roverAccent, M = ART.roverMetal, GL = ART.glass;
  // bed posts (match the wall colliders: 0.12 m wide, bedH tall)
  for (const wx of [-1.33, 0.48]) {
    shape(g, () => rr(g, (wx - 0.06) * s, -(0.18 + bedH) * s, 0.12 * s, (bedH + 0.02) * s, 0.03 * s), O, s, { out: ROVER_OUT });
    shape(g, () => rr(g, (wx - 0.075) * s, -(0.2 + bedH) * s, 0.15 * s, 0.07 * s, 0.025 * s), M, s, { noHi: true });
  }
  // exhaust stack (engine upgrade makes it taller, chrome tip from level 4)
  const eh = 0.3 + 0.035 * up.engine;
  shape(g, () => rr(g, 0.5 * s, -(0.6 + eh) * s, 0.07 * s, eh * s, 0.03 * s), up.engine >= 4 ? ART.rim : ART.roverDark, s, { noHi: true });
  // cab body
  const cab = () => { g.beginPath(); g.moveTo(0.53 * s, -0.16 * s); g.lineTo(0.53 * s, -0.82 * s); g.quadraticCurveTo(0.53 * s, -0.93 * s, 0.65 * s, -0.93 * s); g.lineTo(1.03 * s, -0.93 * s); g.quadraticCurveTo(1.1 * s, -0.93 * s, 1.14 * s, -0.87 * s); g.lineTo(1.38 * s, -0.55 * s); g.quadraticCurveTo(1.42 * s, -0.5 * s, 1.42 * s, -0.43 * s); g.lineTo(1.42 * s, -0.16 * s); g.closePath(); };
  shape(g, cab, B, s, { out: ROVER_OUT });
  g.save(); cab(); g.clip(); g.fillStyle = O.base; g.fillRect(0.5 * s, -0.33 * s, s, 0.08 * s); g.fillStyle = O.dark; g.fillRect(0.5 * s, -0.26 * s, s, 0.014 * s); g.restore();
  cab(); g.lineWidth = Math.max(2, s * 0.028); g.strokeStyle = ROVER_OUT; g.stroke();
  // door seam, handle, rivets
  g.strokeStyle = al(B.dark, 0.6); g.lineWidth = 1.5; g.beginPath(); g.moveTo(0.98 * s, -0.5 * s); g.lineTo(0.98 * s, -0.18 * s); g.stroke();
  g.fillStyle = M.dark; rr(g, 0.84 * s, -0.42 * s, 0.09 * s, 0.03 * s, 0.015 * s); g.fill();
  rivets(g, s, [[0.6, -0.2], [0.6, -0.86], [1.36, -0.2]], B);
  // windows: flat glass with one highlight streak
  shape(g, () => rr(g, 0.61 * s, -0.86 * s, 0.26 * s, 0.3 * s, 0.05 * s), GL, s, { noShade: true });
  shape(g, () => { g.beginPath(); g.moveTo(0.95 * s, -0.86 * s); g.lineTo(1.06 * s, -0.86 * s); g.lineTo(1.3 * s, -0.56 * s); g.lineTo(0.95 * s, -0.56 * s); g.closePath(); }, GL, s, { noShade: true });
  g.fillStyle = al(GL.light, 0.85); g.beginPath(); g.moveTo(0.66 * s, -0.82 * s); g.lineTo(0.72 * s, -0.82 * s); g.lineTo(0.66 * s, -0.7 * s); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(1.0 * s, -0.82 * s); g.lineTo(1.05 * s, -0.82 * s); g.lineTo(0.99 * s, -0.66 * s); g.closePath(); g.fill();
  // eye sockets (headlights live-drawn on top)
  for (const [ex, ey, r] of EYES) { g.fillStyle = ART.roverDark.base; g.beginPath(); g.arc(ex * s, ey * s, (r + 0.025) * s, 0, 7); g.fill(); }
  // antenna mast (light drawn live)
  g.strokeStyle = M.dark; g.lineWidth = 0.05 * s; g.lineCap = 'round'; g.beginPath(); g.moveTo(0.66 * s, -0.93 * s); g.lineTo(0.62 * s, -1.36 * s); g.stroke();
  g.strokeStyle = M.base; g.lineWidth = 0.025 * s; g.stroke();
  // shield emitter dish on the roof (shield upgrade)
  if (up.shield > 0) { const r = 0.08 + 0.025 * up.shield; shape(g, () => { g.beginPath(); g.ellipse(0.92 * s, -0.97 * s, r * s, r * 0.5 * s, 0, Math.PI, 0); g.closePath(); }, ART.shield, s); g.fillStyle = ART.shield.dark; g.fillRect(0.9 * s, -0.97 * s, 0.04 * s, 0.05 * s); }
}
/** headlight eyes in body-local metres: [x, y(down), radius] */
const EYES: [number, number, number][] = [[1.2, -0.42, 0.085], [1.34, -0.4, 0.075]];
function drawWheelSpr(g: CanvasRenderingContext2D, s: number, lvl: number) {
  const T = ART.tire, r = 0.42, tread = 0.045 + 0.004 * lvl, n = 14;
  g.fillStyle = T.dark; g.beginPath();
  for (let k = 0; k < n; k++) { const a0 = k / n * Math.PI * 2, a1 = a0 + Math.PI / n * 0.9; g.moveTo(Math.cos(a0) * (r - 0.03) * s, Math.sin(a0) * (r - 0.03) * s); g.arc(0, 0, (r - 0.03 + tread) * s, a0, a1); g.lineTo(Math.cos(a1) * (r - 0.03) * s, Math.sin(a1) * (r - 0.03) * s); g.closePath(); }
  g.fill();
  shape(g, () => { g.beginPath(); g.arc(0, 0, (r - 0.025) * s, 0, 7); }, T, s);
  shape(g, () => { g.beginPath(); g.arc(0, 0, 0.22 * s, 0, 7); }, ART.rim, s);
  g.fillStyle = ART.rim.dark; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(Math.cos(a) * 0.14 * s, Math.sin(a) * 0.14 * s, 0.025 * s, 0, 7); g.fill(); }
  shape(g, () => { g.beginPath(); g.arc(0, 0, 0.08 * s, 0, 7); }, ART.roverAccent, s, { out: ROVER_OUT });
}
const wheelSpr = () => sprite('wheel3:' + save.up.tires, [-0.5, -0.5, 0.5, 0.5], (g, s) => drawWheelSpr(g, s, save.up.tires));
const hullSpr = (up: Up) => sprite(`hull3:${up.bumper}:${up.turbo}:${up.battery}`, [-1.7, -0.26, 1.72, 0.26], (g, s) => roverHull(g, s, up));
const cabSpr = (bedH: number, up: Up) => sprite(`cab3:${bedH.toFixed(3)}:${up.engine}:${up.shield}`, [-1.45, -1.42, 1.5, -0.08], (g, s) => roverCab(g, s, bedH, up));

// ---------------- crates ----------------
const STENCIL = ['arrow', 'moon', 'star'];
function drawCrateSpr(g: CanvasRenderingContext2D, h: number, glass: boolean, idx: number, s: number) {
  const k = h * s;
  if (glass) {
    shape(g, () => rr(g, -k, -k, 2 * k, 2 * k, k * 0.12), ART.glassCrate, s, { noShade: true });
    g.fillStyle = al(ART.shield.base, 0.9); rr(g, -k * 0.3, -k * 0.45, k * 0.6, k * 1.15, k * 0.22); g.fill(); g.fillRect(-k * 0.13, -k * 0.75, k * 0.26, k * 0.32);
    g.strokeStyle = ART.shield.dark; g.lineWidth = 1.5; rr(g, -k * 0.3, -k * 0.45, k * 0.6, k * 1.15, k * 0.22); g.stroke();
    g.strokeStyle = ART.roverMetal.base; g.lineWidth = k * 0.16; g.strokeRect(-k * 0.92, -k * 0.92, k * 1.84, k * 1.84);
    g.strokeStyle = ART.roverMetal.dark; g.lineWidth = 1.5; g.strokeRect(-k * 0.84, -k * 0.84, k * 1.68, k * 1.68);
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = k * 0.1; g.lineCap = 'round'; g.beginPath(); g.moveTo(-k * 0.6, k * 0.15); g.lineTo(-k * 0.15, -k * 0.6); g.stroke();
    rr(g, -k, -k, 2 * k, 2 * k, k * 0.12); g.lineWidth = 2.5; g.strokeStyle = ART.glassCrate.dark; g.stroke();
    return;
  }
  const T = ART.crate;
  shape(g, () => rr(g, -k, -k, 2 * k, 2 * k, k * 0.1), T, s);
  // planks
  g.fillStyle = ART.crateShade; g.fillRect(-k, -k * 0.36, 2 * k, k * 0.07); g.fillRect(-k, k * 0.3, 2 * k, k * 0.07);
  g.fillStyle = al(T.light, 0.7); g.fillRect(-k, -k * 0.29, 2 * k, k * 0.05); g.fillRect(-k, k * 0.37, 2 * k, k * 0.05);
  // frame + diagonal brace
  g.strokeStyle = T.dark; g.lineWidth = 2; g.strokeRect(-k * 0.78, -k * 0.78, k * 1.56, k * 1.56);
  g.fillStyle = al(T.dark, 0.25); g.beginPath(); g.moveTo(-k * 0.78, k * 0.55); g.lineTo(k * 0.55, -k * 0.78); g.lineTo(k * 0.78, -k * 0.55); g.lineTo(-k * 0.55, k * 0.78); g.closePath(); g.fill();
  // stencil icon
  g.fillStyle = al(T.dark, 0.55); const st = STENCIL[idx % 3];
  if (st === 'arrow') { g.beginPath(); g.moveTo(0, -k * 0.5); g.lineTo(k * 0.32, -k * 0.12); g.lineTo(k * 0.11, -k * 0.12); g.lineTo(k * 0.11, k * 0.42); g.lineTo(-k * 0.11, k * 0.42); g.lineTo(-k * 0.11, -k * 0.12); g.lineTo(-k * 0.32, -k * 0.12); g.closePath(); g.fill(); }
  else if (st === 'moon') { g.beginPath(); g.arc(0, 0, k * 0.36, 0, 7); g.arc(k * 0.14, -k * 0.08, k * 0.3, 0, 7, true); g.fill('evenodd'); }
  else { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? k * 0.18 : k * 0.42, an = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(Math.cos(an) * r, Math.sin(an) * r); } g.closePath(); g.fill(); }
  // nails
  for (const [nx, ny] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { g.fillStyle = ART.roverMetal.dark; g.beginPath(); g.arc(nx * k * 0.86, ny * k * 0.86, k * 0.07, 0, 7); g.fill(); g.fillStyle = ART.roverMetal.light; g.beginPath(); g.arc(nx * k * 0.86 - 0.5, ny * k * 0.86 - 0.5, k * 0.035, 0, 7); g.fill(); }
}
const crateSpr = (h: number, glass: boolean, idx: number) => sprite(`crate3:${glass ? 'g' : idx % 3}:${h}`, [-h - 0.04, -h - 0.04, h + 0.04, h + 0.04], (g, s) => drawCrateSpr(g, h, glass, idx, s));

// ---------------- slime ----------------
/** slime body (collider box 0.6 x 0.48); eyes are live so they can blink, wobble and track the rover */
function drawSlimeSpr(g: CanvasRenderingContext2D, s: number) {
  const rx = 0.36 * s, ry = 0.3 * s, T = ART.slime;
  g.strokeStyle = T.dark; g.lineWidth = 0.05 * s; g.lineCap = 'round';
  g.beginPath(); g.moveTo(-rx * 0.35, -ry * 0.8); g.quadraticCurveTo(-rx * 0.6, -ry * 1.4, -rx * 0.42, -ry * 1.6); g.moveTo(rx * 0.35, -ry * 0.8); g.quadraticCurveTo(rx * 0.6, -ry * 1.4, rx * 0.42, -ry * 1.6); g.stroke();
  for (const ax of [-0.42, 0.42]) shape(g, () => { g.beginPath(); g.arc(ax * rx, -ry * 1.62, 0.055 * s, 0, 7); }, T, s, { noShade: true });
  const body = () => { g.beginPath(); g.moveTo(-rx, ry * 0.8); g.bezierCurveTo(-rx * 1.12, -ry * 0.6, -rx * 0.5, -ry * 1.05, 0, -ry * 1.02); g.bezierCurveTo(rx * 0.5, -ry * 1.05, rx * 1.12, -ry * 0.6, rx, ry * 0.8); g.quadraticCurveTo(0, ry * 1.02, -rx, ry * 0.8); g.closePath(); };
  shape(g, body, T, s);
  g.fillStyle = al(T.dark, 0.25); g.beginPath(); g.arc(rx * 0.4, ry * 0.35, rx * 0.12, 0, 7); g.arc(-rx * 0.5, ry * 0.45, rx * 0.08, 0, 7); g.fill();
  g.strokeStyle = T.dark; g.lineWidth = 0.035 * s; g.beginPath(); g.arc(0, ry * 0.3, rx * 0.2, 0.25, Math.PI - 0.25); g.stroke();
}
const slimeSpr = () => sprite('slime3', [-0.48, -0.62, 0.48, 0.4], drawSlimeSpr);
/** googly eyes: big white eyes with pupils that lag behind and look at (lookX) */
function googly(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, lookX: number, wob: number, blink: boolean, angry = false) {
  const er = 0.1 * S;
  for (const ex of [-0.12, 0.12]) {
    const cx = x + ex * S, cy = y - 0.06 * S;
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = ART.slime.dark; ctx.lineWidth = Math.max(1.5, S * 0.022);
    if (blink) { ctx.beginPath(); ctx.moveTo(cx - er, cy); ctx.lineTo(cx + er, cy); ctx.stroke(); continue; }
    ctx.beginPath(); ctx.arc(cx, cy, er, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1d2a14'; ctx.beginPath(); ctx.arc(cx + lookX * er * 0.42 + Math.sin(wob) * er * 0.12, cy + er * 0.25 + Math.cos(wob * 1.3) * er * 0.1, er * 0.5, 0, 7); ctx.fill();
    if (angry) { ctx.strokeStyle = ART.slime.dark; ctx.lineWidth = Math.max(2, S * 0.03); ctx.beginPath(); ctx.moveTo(cx - er * 1.1, cy - er * (ex < 0 ? 1.5 : 0.9)); ctx.lineTo(cx + er * 1.1, cy - er * (ex < 0 ? 0.9 : 1.5)); ctx.stroke(); }
  }
}

// ---------------- meteor, coin, energy ----------------
function meteorRock(g: CanvasRenderingContext2D, S: number) {
  const r = 0.5 * S, T = ART.meteor;
  const p = () => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, rr2 = r * (0.8 + 0.25 * hash(i * 7.3 + 1)); g.lineTo(Math.cos(a) * rr2, Math.sin(a) * rr2); } g.closePath(); };
  shape(g, p, T, S);
  g.fillStyle = al(T.dark, 0.5); for (const [cx, cy, cr] of [[-0.3, 0.1, 0.18], [0.25, -0.25, 0.14], [0.2, 0.35, 0.12]]) { g.beginPath(); g.arc(cx * r, cy * r, cr * r, 0, 7); g.fill(); }
  g.strokeStyle = ART.ember; g.lineWidth = 0.04 * S; g.lineCap = 'round'; g.beginPath(); g.moveTo(r * 0.7, -r * 0.2); g.lineTo(r * 0.25, r * 0.05); g.lineTo(r * 0.35, r * 0.4); g.stroke();
}
function coinSprDraw(g: CanvasRenderingContext2D, s: number) {
  const r = 0.27 * s, T = ART.coin;
  shape(g, () => { g.beginPath(); g.arc(0, 0, r, 0, 7); }, T, s);
  g.fillStyle = al(T.dark, 0.6); g.beginPath(); g.arc(0, 0, r * 0.55, 0, 7); g.arc(r * 0.22, -r * 0.1, r * 0.45, 0, 7, true); g.fill('evenodd');
}
function drawCell(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number) {
  const w = 0.4 * S, h = 0.6 * S, gl = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.fillStyle = al(ART.energy.base, 0.18 + 0.12 * gl); ctx.beginPath(); ctx.arc(x, y, S * 0.6, 0, 7); ctx.fill();
  shape(ctx, () => rr(ctx, x - w / 2, y - h / 2, w, h, w * 0.2), ART.roverMetal, S);
  ctx.fillStyle = ART.roverMetal.dark; ctx.fillRect(x - w * 0.2, y - h / 2 - 0.05 * S, w * 0.4, 0.06 * S);
  ctx.fillStyle = ART.energy.base; rr(ctx, x - w * 0.3, y - h * 0.32, w * 0.6, h * 0.66, w * 0.1); ctx.fill();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(x + 0.03 * S, y - h * 0.26); ctx.lineTo(x - w * 0.2, y + 0.02 * S); ctx.lineTo(x, y + 0.02 * S); ctx.lineTo(x - 0.03 * S, y + h * 0.26); ctx.lineTo(x + w * 0.2, y - 0.03 * S); ctx.lineTo(x, y - 0.03 * S); ctx.closePath(); ctx.fill();
}

// ======================================================================
// Render-side watchers (eyes, rattles, splats, celebration): read the sim, never write it
// ======================================================================
interface Splat { x: number; y: number; t: number; r: number; }
interface Watch { air: number; squint: number; blinkT: number; rattle: Map<Crate, { vy: number; t: number }>; slimes: Map<Body, { x: number; y: number }>; splats: Splat[]; confetti: { x: number; y: number; vx: number; vy: number; c: string; r: number; life: number }[]; won: boolean; }
const watches = new WeakMap<Sim, Watch>();
function watch(sim: Sim): Watch { let w = watches.get(sim); if (!w) { w = { air: 0, squint: 0, blinkT: 2, rattle: new Map(), slimes: new Map(), splats: [], confetti: [], won: false }; watches.set(sim, w); } return w; }
function observe(sim: Sim, w: Watch, dt: number) {
  if (w.air > 0.45 && sim.grounded > 0) w.squint = 0.45;
  w.air = sim.grounded === 0 ? w.air + dt : 0;
  w.squint = Math.max(0, w.squint - dt); w.blinkT -= dt; if (w.blinkT < -0.12) w.blinkT = 2.5 + Math.random() * 3;
  for (const c of sim.crates) { if (c.gone) continue; const vy = c.body.getLinearVelocity().y, r = w.rattle.get(c); if (!r) { w.rattle.set(c, { vy, t: 0 }); continue; } if (vy - r.vy > 1.4) r.t = 0.25; r.t = Math.max(0, r.t - dt); r.vy = vy; }
  // squashed slimes leave a splat (bodies culled far behind the rover don't)
  const cx = sim.chassis.getPosition().x, now = new Map<Body, { x: number; y: number }>();
  for (const s of sim.slimes) { const p = s.body.getPosition(); now.set(s.body, { x: p.x, y: p.y }); }
  for (const [b, p] of w.slimes) if (!now.has(b) && Math.abs(p.x - cx) < 6 && w.splats.length < 24) w.splats.push({ x: p.x, y: sim.groundY(p.x), t: 0, r: 0.4 + Math.random() * 0.2 });
  w.slimes = now;
  for (let i = w.splats.length - 1; i >= 0; i--) { w.splats[i].t += dt; if (w.splats[i].t > 6) w.splats.splice(i, 1); }
  if (sim.state === 'win' && !w.won) { w.won = true; const e = sim.L.length + 2, gy = sim.groundY(e);
    const cols = [ART.roverAccent.base, ART.coin.base, ART.slime.base, ART.shield.base, '#ffffff'];
    for (let i = 0; i < (reducedMotion ? 16 : 60); i++) w.confetti.push({ x: e + (Math.random() - 0.5) * 2, y: gy + 3.6, vx: (Math.random() - 0.5) * 7, vy: 3 + Math.random() * 6, c: cols[i % cols.length], r: Math.random() * 6, life: 2 + Math.random() }); }
  for (let i = w.confetti.length - 1; i >= 0; i--) { const p = w.confetti[i]; p.life -= dt; if (p.life <= 0) { w.confetti.splice(i, 1); continue; } p.x += p.vx * dt; p.y += p.vy * dt; p.vy -= 5 * dt; p.vx *= 1 - dt; p.r += dt * 8; }
}

// ======================================================================
// World
// ======================================================================
const speedLines = Array.from({ length: 14 }, (_, i) => ({ y: hash(i * 5.1) * H, x: hash(i * 2.3) * W, l: 80 + hash(i) * 160 }));
const storm = Array.from({ length: 34 }, (_, i) => ({ y: hash(i * 3.7) * H, x: hash(i * 1.9) * W, l: 30 + hash(i) * 90, v: 900 + hash(i * 4) * 900 }));

export function drawWorld(ctx: CanvasRenderingContext2D, sim: Sim, cam: Camera, t: number, dt: number) {
  const wi = sim.L.world, A = WORLD_ART[wi], G = A.ground, a = sim.alpha, S = cam.S, wa = watch(sim);
  if (dt > 0) observe(sim, wa, dt);
  const sh = sim.shake * motion(1), ox = (Math.random() - 0.5) * 22 * sh, oy = (Math.random() - 0.5) * 22 * sh;
  const X = (x: number) => (x - cam.x) * S + W / 2, Y = (y: number) => H / 2 - (y - cam.y) * S;
  const x0 = cam.x - (W / 2 + 40) / S, x1 = cam.x + (W / 2 + 40) / S;
  const step = 0.25, i0 = Math.floor(x0 / step), i1 = Math.ceil(x1 / step);
  const px: number[] = [], py: number[] = [];
  let maxPy = 0; for (let i = i0; i <= i1; i++) { px.push(X(i * step)); const yy = Y(sim.groundY(i * step)); py.push(yy); if (yy > maxPy) maxPy = yy; }
  const n = px.length;
  backdrop(ctx, wi, cam.x, cam.y - sim.groundY(4), t, dt, Math.min(H, maxPy + 30 + 22 * sh));
  ctx.save(); ctx.translate(ox, oy);
  // ---- delivery point & markers (behind the ground line) ----
  if (!sim.L.endless) drawOutpost(ctx, sim, X, Y, S, t);
  for (let m = Math.ceil(x0 / 50) * 50; m < x1; m += 50) if (m > 0 && (sim.L.endless || m < sim.L.length - 10)) drawMarker(ctx, X(m), Y(sim.groundY(m)), S, m);
  for (const f of sim.terrain.feats) if (f.k === 'ramp' && f.x - 7 > x0 && f.x - 7 < x1) drawSign(ctx, X(f.x - 7), Y(sim.groundY(f.x - 7)), S);
  // ---- ground: deep body, darker strata bands below, lit top band, rim, outline ----
  ctx.beginPath(); ctx.moveTo(px[0], H + 60); for (let i = 0; i < n; i++) ctx.lineTo(px[i], py[i]); ctx.lineTo(px[n - 1], H + 60); ctx.closePath(); ctx.fillStyle = G.deep; ctx.fill();
  const band = (o0: number, o1: number, from = 0, to = n - 1) => { ctx.beginPath(); ctx.moveTo(px[from], py[from] + o0); for (let i = from + 1; i <= to; i++) ctx.lineTo(px[i], py[i] + o0); for (let i = to; i >= from; i--) ctx.lineTo(px[i], py[i] + o1); ctx.closePath(); };
  ctx.fillStyle = G.top; band(0, 0.42 * S); ctx.fill();
  ctx.fillStyle = G.band; band(0.42 * S, 0.5 * S); ctx.fill();
  ctx.globalAlpha = 0.6; band(1.25 * S, 1.33 * S); ctx.fill(); ctx.globalAlpha = 0.4; band(2.2 * S, 2.27 * S); ctx.fill(); ctx.globalAlpha = 1;
  // embedded rocks & craters with a shaded inner side
  const cs = 3.4;
  for (let c = Math.floor(x0 / cs) - 1; c <= Math.ceil(x1 / cs); c++) {
    const hh = hash(c * 3.13 + sim.L.seed), wx = c * cs + hash(c * 7.7) * cs, depth = 0.7 + hash(c * 1.7) * 2.4, sx = X(wx), sy = Y(sim.groundY(wx) - depth), r = (0.16 + hash(c * 5.9) * 0.34) * S;
    if (hh < 0.4) { const R = A.rock; // cheap per-frame version of the style: flat fill, highlight, outline (no clip)
      ctx.beginPath(); for (let k = 0; k < 7; k++) { const an = k / 7 * Math.PI * 2, rr2 = r * (0.75 + 0.35 * hash(c + k * 11)); ctx.lineTo(sx + Math.cos(an) * rr2, sy + Math.sin(an) * rr2 * 0.72); } ctx.closePath();
      ctx.fillStyle = G.spot; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = al(R.dark, 0.6); ctx.stroke();
      ctx.fillStyle = al(R.light, 0.45); ctx.beginPath(); ctx.ellipse(sx - r * 0.25, sy - r * 0.3, r * 0.35, r * 0.14, -0.3, 0, 7); ctx.fill(); }
    else if (hh < 0.7) { const rx = r * 1.6, ry = r * 0.55;
      ctx.fillStyle = G.band; ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0, 7); ctx.fill();
      ctx.fillStyle = al(G.line, 0.45); ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, Math.PI, 0); ctx.ellipse(sx, sy - ry * 0.1, rx * 0.9, ry * 0.55, 0, 0, Math.PI, true); ctx.fill();
      ctx.strokeStyle = al(G.rim, 0.6); ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(sx, sy, rx, ry, 0, 0.2, Math.PI - 0.2); ctx.stroke(); }
  }
  // ice patches: glossy sheet on the surface
  if (sim.L.ice) for (const p of sim.terrain.ice) { if (p.x1 < x0 || p.x0 > x1) continue;
    const f = Math.max(0, Math.ceil((p.x0 - i0 * step) / step)), l = Math.min(n - 1, Math.floor((p.x1 - i0 * step) / step)); if (l <= f) continue;
    ctx.fillStyle = A.ice.base; band(-3, 12, f, l); ctx.fill(); ctx.strokeStyle = A.ice.dark; ctx.lineWidth = 2; band(-3, 12, f, l); ctx.stroke();
    ctx.strokeStyle = A.ice.light; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); for (let i = f + 2; i < l - 1; i += 6) { ctx.moveTo(px[i], py[i] + 2); ctx.lineTo(px[i + 2], py[i + 2]); } ctx.stroke(); }
  // lit rim + outline on the very edge
  ctx.fillStyle = G.rim; band(1, 6); ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = G.line; ctx.lineJoin = 'round'; ctx.beginPath(); for (let i = 0; i < n; i++) i ? ctx.lineTo(px[i], py[i]) : ctx.moveTo(px[i], py[i]); ctx.stroke();
  // meteor craters stay: scorched bowl with a lit far rim
  for (const c of sim.craters) if (c.x > x0 - 2 && c.x < x1 + 2) { const cx = X(c.x), cy = Y(sim.groundY(c.x));
    ctx.fillStyle = al(G.line, 0.5); ctx.beginPath(); ctx.ellipse(cx, cy + 4, c.r * S * 0.7, 0.12 * S, 0, 0, 7); ctx.fill();
    ctx.fillStyle = al('#2a1f18', 0.35); ctx.beginPath(); ctx.ellipse(cx, cy + 3, c.r * S * 0.45, 0.07 * S, 0, 0, 7); ctx.fill(); }
  // slime splats
  for (const s of wa.splats) { const k = Math.min(1, s.t * 8), fade = Math.min(1, (6 - s.t) / 1.5); ctx.globalAlpha = fade * 0.9; ctx.fillStyle = ART.slime.base; ctx.strokeStyle = ART.slime.dark; ctx.lineWidth = 2;
    const sx = X(s.x), sy = Y(s.y); ctx.beginPath(); ctx.ellipse(sx, sy + 2, s.r * S * k, 0.07 * S * k, 0, 0, 7); ctx.fill(); ctx.stroke();
    for (const d of [-1, 1]) { ctx.beginPath(); ctx.arc(sx + d * s.r * S * 1.15 * k, sy - 1, 0.04 * S * k, 0, 7); ctx.fill(); ctx.stroke(); } }
  ctx.globalAlpha = 1;
  // small rocks in front of the edge
  for (let c = Math.floor(x0 / 2.2); c <= Math.ceil(x1 / 2.2); c++) { if (hash(c * 2.71 + 5) > 0.45) continue; const wx = c * 2.2 + hash(c * 9.3) * 1.5, r = (0.06 + hash(c * 4.1) * 0.09) * S, sx = X(wx), sy = Y(sim.groundY(wx));
    ctx.beginPath(); ctx.ellipse(sx, sy - r * 0.3, r, r * 0.62, 0, 0, 7); ctx.fillStyle = A.rock.base; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = A.rock.dark; ctx.stroke();
    ctx.fillStyle = A.rock.light; ctx.beginPath(); ctx.ellipse(sx - r * 0.3, sy - r * 0.55, r * 0.4, r * 0.18, -0.2, 0, 7); ctx.fill(); }
  // ---- pickups ----
  const coin = sprite('coin3', [-0.32, -0.32, 0.32, 0.32], coinSprDraw);
  for (const p of sim.terrain.pickups) { if (p.taken || p.x < x0 || p.x > x1) continue; const sx = X(p.x), sy = Y(p.y) + Math.sin(t * 3 + p.x) * 4 * motion(1);
    if (p.k === 'coin') { const spin = reducedMotion ? 1 : Math.max(0.15, Math.abs(Math.cos((t + p.x * 0.4) * 2.5))); blit(ctx, coin, sx, sy, 0, S, spin, 1);
      if (!reducedMotion && ((t * 1.7 + p.x * 0.37) % 2.2) < 0.18) { ctx.fillStyle = '#ffffff'; const k = 0.06 * S; ctx.beginPath(); ctx.moveTo(sx + 0.12 * S, sy - 0.2 * S - k); ctx.lineTo(sx + 0.12 * S + k * 0.3, sy - 0.2 * S); ctx.lineTo(sx + 0.12 * S, sy - 0.2 * S + k); ctx.lineTo(sx + 0.12 * S - k * 0.3, sy - 0.2 * S); ctx.closePath(); ctx.fill(); } }
    else drawCell(ctx, sx, sy, S, t); }
  // ---- meteor warnings ----
  for (const m of sim.meteors) drawMeteor(ctx, sim, m, X, Y, S, t);
  // ---- rover ground shadow ----
  const ch = interp(sim.chassis, a), gy = sim.groundY(ch.x), hgt = Math.max(0, ch.y - gy);
  ctx.fillStyle = `rgba(20,16,12,${0.3 * Math.max(0.15, 1 - hgt / 6)})`; ctx.beginPath(); ctx.ellipse(X(ch.x), Y(gy) + 3, S * (1.5 + hgt * 0.1), S * 0.14, 0, 0, 7); ctx.fill();
  // ---- rocks & slimes ----
  for (const b of sim.rocks) { const q = interp(b, a), vs = ((b.getFixtureList()!.getShape() as any).m_vertices as { x: number; y: number }[]); ctx.save(); ctx.translate(X(q.x), Y(q.y)); ctx.rotate(-q.a);
    shape(ctx, () => { ctx.beginPath(); vs.forEach((v, i) => i ? ctx.lineTo(v.x * S, -v.y * S) : ctx.moveTo(v.x * S, -v.y * S)); ctx.closePath(); }, A.rock, S * 0.8); ctx.restore(); }
  const ss = slimeSpr();
  for (const s of sim.slimes) { const q = interp(s.body, a), vy = s.body.getLinearVelocity().y, st = (Math.max(-0.18, Math.min(0.22, vy * 0.05)) + Math.sin(s.phase * 1.4) * 0.05) * motion(1) + (reducedMotion ? 0 : 0);
    const x = X(q.x), y = Y(q.y), sq = 1 + st, near = Math.abs(ch.x - q.x); blit(ctx, ss, x, y, q.a, S, 1 / sq, sq);
    googly(ctx, x, y - (sq - 1) * 0.2 * S, S * Math.min(1.1, 1 / sq), Math.max(-1, Math.min(1, (ch.x - q.x) / 3)), s.phase * 2 + vy, (t * 0.7 + s.phase) % 3.2 < 0.12, near < 4); }
  // ---- rover + crates ----
  drawRover(ctx, sim, wa, a, X, Y, S, t);
  // ---- UFO ----
  if (sim.ufo) drawUfo(ctx, sim, X, Y, S, t);
  // ---- particles ----
  for (const p of sim.particles) {
    const k = p.life / p.max, sx = X(p.x), sy = Y(p.y);
    switch (p.type) {
      case 'spark': ctx.globalAlpha = k; ctx.strokeStyle = '#ffd77a'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx - p.vx * 0.03 * S, sy + p.vy * 0.03 * S); ctx.stroke(); continue;
      case 'flash': { const q = 1 - k; ctx.globalAlpha = k * 0.7; ctx.fillStyle = '#fff3d6'; ctx.beginPath(); ctx.arc(sx, sy, (0.6 + q * 3) * S, 0, 7); ctx.fill(); continue; }
      case 'ring': { const q = 1 - k; ctx.globalAlpha = k; ctx.strokeStyle = G.rim; ctx.lineWidth = 6 * k + 1; ctx.beginPath(); ctx.ellipse(sx, sy, (0.8 + q * 6) * S, (0.2 + q * 1.2) * S, 0, 0, 7); ctx.stroke(); continue; }
      case 'plank': case 'debris': { ctx.globalAlpha = Math.min(1, k * 2); ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot || 0); const w = p.size * S;
        if (p.type === 'plank') { ctx.fillStyle = ART.crate.base; ctx.strokeStyle = ART.crate.dark; ctx.lineWidth = 1.5; ctx.fillRect(-w, -w * 0.28, w * 2, w * 0.56); ctx.fillStyle = ART.crateShade; ctx.fillRect(-w, w * 0.08, w * 2, w * 0.2); ctx.strokeRect(-w, -w * 0.28, w * 2, w * 0.56); }
        else { ctx.fillStyle = A.rock.base; ctx.strokeStyle = A.rock.dark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-w, -w * 0.4); ctx.lineTo(w * 0.3, -w); ctx.lineTo(w, w * 0.2); ctx.lineTo(-w * 0.2, w); ctx.closePath(); ctx.fill(); ctx.stroke(); }
        ctx.restore(); continue; }
      case 'fire': { ctx.globalAlpha = k * 0.9; ctx.fillStyle = k > 0.6 ? '#fff1b0' : k > 0.35 ? ART.ember : ART.roverAccent.base; ctx.beginPath(); ctx.arc(sx, sy, p.size * S * (0.5 + k), 0, 7); ctx.fill(); continue; }
    }
    ctx.globalAlpha = p.type === 'dust' || p.type === 'smoke' ? k * 0.6 : k;
    ctx.fillStyle = p.type === 'goo' ? ART.slime.base : p.type === 'coin' ? ART.coin.base : p.type === 'glass' ? ART.glassCrate.base : p.type === 'energy' ? ART.energy.base : p.type === 'smoke' ? (k > 0.6 ? ART.ember : '#a6a39c') : A.dust;
    const r = p.size * S * (p.type === 'dust' || p.type === 'smoke' ? 1.6 - k * 0.6 : 1);
    if (p.type === 'glass') ctx.fillRect(sx - r, sy - r, r * 2, r * 2); else { ctx.beginPath(); ctx.arc(sx, sy, r, 0, 7); ctx.fill(); }
  }
  ctx.globalAlpha = 1;
  // celebration confetti at the delivery point
  for (const p of wa.confetti) { ctx.globalAlpha = Math.min(1, p.life); ctx.fillStyle = p.c; ctx.save(); ctx.translate(X(p.x), Y(p.y)); ctx.rotate(p.r); ctx.fillRect(-0.06 * S, -0.03 * S, 0.12 * S, 0.06 * S); ctx.restore(); }
  ctx.globalAlpha = 1;
  // ---- score popups ----
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = `700 ${0.5 * S | 0}px ${FONT_DISPLAY}`; ctx.lineJoin = 'round';
  for (const p of sim.popups) { ctx.globalAlpha = Math.min(1, p.life * 2); const sx = X(p.x), sy = Y(p.y), txt = '+' + p.n; ctx.lineWidth = 6; ctx.strokeStyle = '#3a3324'; ctx.strokeText(txt, sx, sy); ctx.fillStyle = p.color; ctx.fillText(txt, sx, sy); }
  ctx.globalAlpha = 1;
  ctx.restore();
  // ---- screen-space effects ----
  const v = Math.abs(sim.speed), sl = sim.turboOn ? 1 : Math.max(0, (v - 8) / 6);
  if (sl > 0 && !reducedMotion) { ctx.strokeStyle = `rgba(255,250,235,${0.2 * Math.min(1, sl)})`; ctx.lineWidth = 2.5; ctx.lineCap = 'round'; for (const l of speedLines) { l.x -= (900 + 600 * sl) * dt; if (l.x < -l.l) { l.x = W + Math.random() * 200; l.y = Math.random() * H; } ctx.beginPath(); ctx.moveTo(l.x, l.y); ctx.lineTo(l.x + l.l, l.y); ctx.stroke(); } }
  if (sim.storm > 0.02) { ctx.strokeStyle = `rgba(255,205,160,${0.35 * Math.min(1, sim.storm)})`; ctx.lineWidth = 2; for (const s of storm) { s.x -= s.v * dt; if (s.x < -s.l) { s.x = W + Math.random() * 100; s.y = Math.random() * H; } ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + s.l, s.y - s.l * 0.08); ctx.stroke(); } }
  if (sim.hitFlash > 0) { ctx.fillStyle = `rgba(255,250,240,${sim.hitFlash * 0.3})`; ctx.fillRect(0, 0, W, H); }
  // off-screen meteor indicator
  for (const m of sim.meteors) { const sx = X(m.x); if (sx > W - 20) { const yy = Math.min(H - 80, Math.max(140, Y(sim.groundY(m.x)))); warnIcon(ctx, W - 46, yy, 0.6 + 0.4 * Math.sin(t * 20)); } }
}

function warnIcon(ctx: CanvasRenderingContext2D, x: number, y: number, a: number) {
  const T = ART.danger; ctx.globalAlpha = a; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.moveTo(x, y - 26); ctx.lineTo(x + 27, y + 20); ctx.lineTo(x - 27, y + 20); ctx.closePath(); ctx.fillStyle = T.base; ctx.fill(); ctx.lineWidth = 4; ctx.strokeStyle = T.dark; ctx.stroke();
  ctx.fillStyle = '#fffaf0'; rr(ctx, x - 3.5, y - 11, 7, 18, 3); ctx.fill(); ctx.beginPath(); ctx.arc(x, y + 12, 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
}

function drawMeteor(ctx: CanvasRenderingContext2D, sim: Sim, m: import('./world').Meteor, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const gy = sim.groundY(m.x), sx = X(m.x), sy = Y(gy), p = 1 - m.t / 1.6, pulse = 0.5 + 0.5 * Math.sin(t * 18), T = ART.danger;
  const rx = 2.4 * S * (0.6 + 0.4 * (1 - p));
  ctx.fillStyle = `rgba(20,14,10,${0.12 + 0.35 * p})`; ctx.beginPath(); ctx.ellipse(sx, sy + 3, rx * 0.55 * (0.3 + p), 6 + 8 * p, 0, 0, 7); ctx.fill();
  // warning ring: solid outer ring + rotating dashed inner ring, both danger red with a darker outline
  ctx.lineWidth = 8; ctx.strokeStyle = T.dark; ctx.beginPath(); ctx.ellipse(sx, sy + 3, rx, rx * 0.22, 0, 0, 7); ctx.stroke();
  ctx.lineWidth = 4.5; ctx.strokeStyle = pulse > 0.5 ? T.base : T.light; ctx.stroke();
  ctx.lineWidth = 3; ctx.setLineDash([10, 8]); ctx.lineDashOffset = -t * 40; ctx.strokeStyle = T.base; ctx.beginPath(); ctx.ellipse(sx, sy + 3, rx * 0.55, rx * 0.12, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
  const mp = sim.meteorPos(m); if (!mp) return;
  // falling streak: flat layered tail along the fall direction (from the upper right)
  const mx = X(mp.x), my = Y(mp.y), dx = 10 * S, dy = -7.5 * S, len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len, L = 2.6 * S;
  for (const [w, c] of [[0.5, ART.roverAccent.base], [0.32, ART.ember], [0.14, '#fff1b0']] as [number, string][]) {
    ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(mx - uy * w * S, my + ux * w * S); ctx.lineTo(mx + ux * L, my + uy * L); ctx.lineTo(mx + uy * w * S, my - ux * w * S); ctx.closePath(); ctx.fill(); }
  ctx.save(); ctx.translate(mx, my); ctx.rotate(t * 4 * motion(1));
  blit(ctx, sprite('meteor3', [-0.7, -0.7, 0.7, 0.7], meteorRock), 0, 0, 0, S);
  ctx.restore();
}

function drawRover(ctx: CanvasRenderingContext2D, sim: Sim, wa: Watch, a: number, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const ch = interp(sim.chassis, a), ca = Math.cos(ch.a), sa = Math.sin(ch.a), cx = X(ch.x), cy = Y(ch.y), up = save.up;
  const toLocal = (wx: number, wy: number) => { const dx = wx - ch.x, dy = wy - ch.y; return { x: dx * ca + dy * sa, y: -dx * sa + dy * ca }; };
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-ch.a);
  // headlight beam (soft, flat) + turbo flame (layered flat shapes)
  ctx.fillStyle = 'rgba(255,243,196,.14)'; ctx.beginPath(); ctx.moveTo(1.4 * S, -0.48 * S); ctx.lineTo(3.8 * S, -1.0 * S); ctx.lineTo(3.8 * S, 0.3 * S); ctx.lineTo(1.4 * S, -0.3 * S); ctx.closePath(); ctx.fill();
  if (sim.turboOn) { const f = 0.75 + Math.random() * 0.45 * motion(1), tn = 1.48 + 0.025 * up.turbo;
    for (const [w, l, c] of [[0.13, 1.5, ART.roverAccent.base], [0.09, 1.0, ART.ember], [0.05, 0.55, '#fff6d0']] as [number, number, string][]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.moveTo(-tn * S, (-0.03 - w) * S); ctx.quadraticCurveTo((-tn - l * f) * S, -0.03 * S, -tn * S, (-0.03 + w) * S); ctx.closePath(); ctx.fill(); } }
  // springs that visibly compress (suspension upgrade = thicker coil)
  for (let i = 0; i < 2; i++) {
    if (sim.wheelGone[i]) continue;
    const w = interp(sim.wheels[i], a), lw = toLocal(w.x, w.y), ax = i ? 0.95 : -0.95; drawSpring(ctx, ax * S, 0.05 * S, lw.x * S, -lw.y * S, S, up.suspension);
  }
  ctx.restore();
  const wheel = wheelSpr(), fast = Math.abs(sim.speed) > 7;
  for (let i = 0; i < 2; i++) { if (sim.wheelGone[i]) { const k = sim.t - sim.wheelTornT[i]; if (k > 2.5) continue; ctx.globalAlpha = Math.min(1, (2.5 - k) * 2); }
    const w = interp(sim.wheels[i], a), jit = !sim.wheelGone[i] && sim.wheelHP[i] < 0.6 ? (1 - sim.wheelHP[i]) * 3 : 0, wx = X(w.x) + (Math.random() - 0.5) * jit, wy = Y(w.y) + (Math.random() - 0.5) * jit; blit(ctx, wheel, wx, wy, w.a, S);
    if (sim.latched.length && !sim.wheelGone[i]) drawGoo(ctx, wx, wy, w.a, S); ctx.globalAlpha = 1;
    if (fast && !reducedMotion) { ctx.strokeStyle = 'rgba(31,35,44,.35)'; ctx.lineWidth = 0.08 * S; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(wx, wy, 0.3 * S, -w.a, -w.a + 2); ctx.stroke(); } }
  blit(ctx, hullSpr(up), cx, cy, ch.a, S);
  for (const c of sim.crates) { if (c.gone) continue; const q = interp(c.body, a), h = sim.crateHalf, r = wa.rattle.get(c), jit = r && r.t > 0 ? Math.sin(t * 90) * 0.05 * r.t * 4 * motion(1) : 0;
    if (c.lost) ctx.globalAlpha = 0.8; blit(ctx, crateSpr(h, c.glass, c.idx), X(q.x) + jit * S * 0.3, Y(q.y), q.a + jit, S); ctx.globalAlpha = 1; }
  blit(ctx, cabSpr(sim.wallH, up), cx, cy, ch.a, S);
  // live parts in rover space: eyes, antenna light, latched slimes, shield bubble
  ctx.save(); ctx.translate(cx, cy); ctx.rotate(-ch.a);
  const vel = sim.chassis.getLinearVelocity(), warn = sim.crates.some(c => !c.lost && sim.t - c.warned < 1.2);
  const open = warn ? 1.35 : wa.squint > 0 ? 0.35 : wa.blinkT < 0 ? 0.1 : 1;
  drawEyes(ctx, S, { x: Math.max(-1, Math.min(1, sim.speed / 5)), y: Math.max(-1, Math.min(1, -vel.y / 8)) }, open, sim.state === 'fail' ? 'dizzy' : 'idle', t);
  antennaLight(ctx, S, t);
  const lsp = slimeSpr();
  for (const l of sim.latched) { const wob = 1 + Math.sin(l.phase) * 0.08 * motion(1), lx = l.lx * S, ly = -l.ly * S - 0.12 * S; blit(ctx, lsp, lx, ly, 0, S * 0.8, 1 / wob, wob); googly(ctx, lx, ly, S * 0.8, -1, l.phase, Math.sin(l.phase * 0.3) > 0.97, true); }
  if (sim.shields > 0 || sim.shieldFlash > 0) { const f = sim.shieldFlash, T = ART.shield; ctx.fillStyle = al(T.base, 0.08 + f * 0.2); ctx.strokeStyle = al(T.base, 0.45 + 0.15 * Math.sin(t * 4) + f * 0.4); ctx.lineWidth = 3 + f * 6;
    ctx.beginPath(); ctx.ellipse(0, -0.4 * S, 1.85 * S, 1.15 * S, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = al(T.light, 0.6); ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(0, -0.4 * S, 1.7 * S, 1.02 * S, 0, Math.PI * 1.15, Math.PI * 1.45); ctx.stroke(); }
  if (sim.state === 'fail' && !reducedMotion) smokePuffs(ctx, S, t);
  ctx.restore();
}
function drawSpring(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, S: number, lvl: number) {
  const M = ART.roverMetal, T = ART.spring;
  ctx.lineCap = 'round';
  ctx.strokeStyle = M.dark; ctx.lineWidth = 0.1 * S; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  ctx.strokeStyle = M.base; ctx.lineWidth = 0.05 * S; ctx.stroke();
  const N = 6, len = y1 - y0, w = (0.12 + 0.006 * lvl) * S, path = () => { ctx.beginPath(); for (let k = 0; k <= N * 2; k++) { const f = k / (N * 2), yy = y0 + len * (0.08 + f * 0.62), xx = x0 + (x1 - x0) * f * 0.7 + (k % 2 ? 1 : -1) * w; k ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } };
  path(); ctx.strokeStyle = T.dark; ctx.lineWidth = (0.075 + 0.004 * lvl) * S; ctx.lineJoin = 'round'; ctx.stroke();
  ctx.strokeStyle = T.base; ctx.lineWidth = (0.045 + 0.003 * lvl) * S; ctx.stroke();
}
/** headlight eyes: look toward (look.x, look.y); open 0.1 = blink, 0.35 = squint, 1.35 = wide; dizzy = spiral */
function drawEyes(ctx: CanvasRenderingContext2D, S: number, look: { x: number; y: number }, open: number, mood: 'idle' | 'dizzy' | 'happy', t: number) {
  for (const [ex, ey, r0] of EYES) {
    const x = ex * S, y = ey * S, r = r0 * S * (open > 1 ? 1.12 : 1);
    ctx.fillStyle = ART.headlight.base; ctx.strokeStyle = ART.headlight.dark; ctx.lineWidth = Math.max(1.5, S * 0.018);
    if (mood === 'dizzy') { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = ART.roverDark.dark; ctx.lineWidth = Math.max(1.5, S * 0.016); ctx.beginPath(); for (let k = 0; k < 18; k++) { const a = k * 0.7 + t * 6, rr2 = r * 0.85 * (1 - k / 20); ctx.lineTo(x + Math.cos(a) * rr2, y + Math.sin(a) * rr2); } ctx.stroke(); continue; }
    const ry = r * Math.min(1, open);
    ctx.beginPath(); ctx.ellipse(x, y, r, Math.max(0.6, ry), 0, 0, 7); ctx.fill(); ctx.stroke();
    if (open < 0.2) continue;
    if (mood === 'happy') { ctx.strokeStyle = ART.roverDark.dark; ctx.lineWidth = Math.max(2, S * 0.025); ctx.beginPath(); ctx.arc(x, y + r * 0.35, r * 0.55, Math.PI * 1.15, Math.PI * 1.85); ctx.stroke(); continue; }
    // pupil stays inside the eye (offset + radius < r), so no clip is needed; squinting eyes show a flatter pupil
    const pr = r * 0.48 * (open > 1 ? 0.85 : 1), py2 = Math.min(ry * 0.6, pr), px2 = x + look.x * r * 0.38, pyc = y + look.y * Math.max(0, ry - py2) * 0.6;
    ctx.fillStyle = ART.roverDark.dark; ctx.beginPath(); ctx.ellipse(px2, pyc, pr, py2, 0, 0, 7); ctx.fill();
    if (open >= 0.6) { ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(px2 - pr * 0.35, pyc - pr * 0.35, pr * 0.32, 0, 7); ctx.fill(); }
    if (open < 1) { ctx.strokeStyle = ROVER_OUT; ctx.lineWidth = Math.max(2, S * 0.022); ctx.beginPath(); ctx.moveTo(x - r * 1.1, y - ry); ctx.lineTo(x + r * 1.1, y - ry); ctx.stroke(); }
  }
}
function antennaLight(ctx: CanvasRenderingContext2D, S: number, t: number) {
  const on = reducedMotion || Math.sin(t * 6) > 0, T = ART.danger;
  if (on) { ctx.fillStyle = al(T.base, 0.25); ctx.beginPath(); ctx.arc(0.62 * S, -1.38 * S, 0.14 * S, 0, 7); ctx.fill(); }
  ctx.fillStyle = on ? T.base : T.dark; ctx.strokeStyle = T.dark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(0.62 * S, -1.38 * S, 0.055 * S, 0, 7); ctx.fill(); ctx.stroke();
}
function smokePuffs(ctx: CanvasRenderingContext2D, S: number, t: number) {
  for (let i = 0; i < 4; i++) { const k = (t * 0.8 + i / 4) % 1; ctx.globalAlpha = 0.55 * (1 - k); ctx.fillStyle = '#9a968e'; ctx.beginPath(); ctx.arc((0.55 + Math.sin(i * 2 + t) * 0.1) * S, (-0.95 - k * 1.1) * S, (0.1 + k * 0.18) * S, 0, 7); ctx.fill(); }
  ctx.globalAlpha = 1;
}
function drawGoo(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, S: number) {
  const r = 0.42 * S; ctx.fillStyle = ART.slime.base; ctx.strokeStyle = ART.slime.dark; ctx.lineWidth = 1.5;
  for (let k = 0; k < 3; k++) { const an = k * 2.1 - ang; ctx.beginPath(); ctx.arc(x + Math.cos(an) * r * 0.85, y + Math.sin(an) * r * 0.85, r * 0.2, 0, 7); ctx.fill(); ctx.stroke(); }
}

function drawUfo(ctx: CanvasRenderingContext2D, sim: Sim, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const u = sim.ufo!, ux = X(u.x), uy = Y(u.y) + Math.sin(t * 3) * 3 * motion(1), k = S / 44;
  if (u.beam > 0) { // tractor beam: flat translucent cone + rising rings
    const gy = Y(sim.groundY(u.x)), hw = 1.3 * S;
    ctx.fillStyle = al(ART.slime.light, 0.22 * u.beam); ctx.beginPath(); ctx.moveTo(ux - 26 * k, uy + 10 * k); ctx.lineTo(ux + 26 * k, uy + 10 * k); ctx.lineTo(ux + hw, gy); ctx.lineTo(ux - hw, gy); ctx.closePath(); ctx.fill();
    ctx.fillStyle = al(ART.slime.light, 0.18 * u.beam); ctx.beginPath(); ctx.moveTo(ux - 14 * k, uy + 10 * k); ctx.lineTo(ux + 14 * k, uy + 10 * k); ctx.lineTo(ux + hw * 0.55, gy); ctx.lineTo(ux - hw * 0.55, gy); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = al('#f4ffe0', 0.55 * u.beam); ctx.lineWidth = 3;
    for (let i = 0; i < 4; i++) { const f = ((t * 0.8 + i / 4) % 1), yy = gy + (uy - gy) * f, w = hw + (26 * k - hw) * f; ctx.beginPath(); ctx.ellipse(ux, yy, w, 6 * k, 0, 0, 7); ctx.stroke(); }
  }
  // dome with a little alien pilot
  ctx.save(); ctx.beginPath(); ctx.ellipse(ux, uy - 10 * k, 28 * k, 24 * k, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = al(ART.ufoDome.base, 0.9); ctx.fill(); ctx.clip();
  ctx.fillStyle = ART.slime.base; ctx.strokeStyle = ART.slime.dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(ux, uy - 12 * k, 11 * k, 12 * k, 0, 0, 7); ctx.fill(); ctx.stroke();
  for (const ex of [-4, 4]) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(ux + ex * k, uy - 16 * k, 3.4 * k, 0, 7); ctx.fill(); ctx.fillStyle = '#1d2a14'; ctx.beginPath(); ctx.arc(ux + ex * k + 1, uy - 15.5 * k, 1.8 * k, 0, 7); ctx.fill(); }
  ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.ellipse(ux - 13 * k, uy - 24 * k, 7 * k, 4 * k, -0.5, 0, 7); ctx.fill();
  ctx.restore();
  ctx.lineWidth = 3; ctx.strokeStyle = ART.ufoDome.dark; ctx.beginPath(); ctx.ellipse(ux, uy - 10 * k, 28 * k, 24 * k, 0, Math.PI, 0); ctx.stroke();
  // saucer: flat base, one shadow shape, one highlight, outline
  shape(ctx, () => { ctx.beginPath(); ctx.ellipse(ux, uy, 70 * k, 18 * k, 0, 0, 7); }, ART.ufo, S);
  ctx.fillStyle = ART.ufo.dark; ctx.beginPath(); ctx.ellipse(ux, uy + 9 * k, 40 * k, 8 * k, 0, 0, 7); ctx.fill();
  for (let i = 0; i < 5; i++) { const on = (Math.floor(t * 6) + i) % 2 === 0; ctx.fillStyle = on ? ART.coin.base : ART.coin.dark; ctx.strokeStyle = ART.coin.dark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ux - 48 * k + i * 24 * k, uy + 2 * k, 4.5 * k, 0, 7); ctx.fill(); ctx.stroke(); }
}

function drawMarker(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, m: number) {
  const P = ART.roverMetal, T = ART.station;
  ctx.fillStyle = P.dark; ctx.fillRect(x - 3.5, y - 1.3 * S, 7, 1.3 * S); ctx.fillStyle = P.base; ctx.fillRect(x - 1.5, y - 1.3 * S, 3, 1.3 * S);
  shape(ctx, () => rr(ctx, x - 0.46 * S, y - 1.78 * S, 0.92 * S, 0.5 * S, 0.1 * S), T, S, { noShade: true });
  ctx.fillStyle = ART.roverAccent.base; ctx.fillRect(x - 0.4 * S, y - 1.72 * S, 0.8 * S, 0.06 * S);
  ctx.fillStyle = '#4a4438'; ctx.font = `700 ${0.27 * S | 0}px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(m), x, y - 1.5 * S);
}
function drawSign(ctx: CanvasRenderingContext2D, x: number, y: number, S: number) {
  const P = ART.roverMetal, T = ART.sign;
  ctx.fillStyle = P.dark; ctx.fillRect(x - 3.5, y - 1.1 * S, 7, 1.1 * S);
  ctx.save(); ctx.translate(x, y - 1.45 * S); ctx.rotate(Math.PI / 4);
  shape(ctx, () => rr(ctx, -0.3 * S, -0.3 * S, 0.6 * S, 0.6 * S, 0.07 * S), T, S); ctx.restore();
  ctx.strokeStyle = T.dark; ctx.lineWidth = 0.07 * S; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(x - 0.16 * S, y - 1.3 * S); ctx.lineTo(x + 0.12 * S, y - 1.58 * S); ctx.moveTo(x - 0.02 * S, y - 1.6 * S); ctx.lineTo(x + 0.13 * S, y - 1.6 * S); ctx.lineTo(x + 0.13 * S, y - 1.45 * S); ctx.stroke();
}
/** delivery point: landing pad, a little station with a dish and a waving flag; celebrates on arrival */
function drawOutpost(ctx: CanvasRenderingContext2D, sim: Sim, X: (x: number) => number, Y: (y: number) => number, S: number, t: number) {
  const e = sim.L.length, gx = X(e), gy = Y(sim.groundY(e)), T = ART.station, O = ART.roverAccent, win = sim.state === 'win';
  if (gx < -14 * S || gx > W + 4 * S) return;
  // station module
  const dx = X(e + 7.5), dy = Y(sim.groundY(e + 7.5));
  shape(ctx, () => rr(ctx, dx - 2.6 * S, dy - 2.2 * S, 5.2 * S, 2.2 * S, 0.9 * S), T, S);
  ctx.fillStyle = O.base; ctx.fillRect(dx - 2.55 * S, dy - 0.75 * S, 5.1 * S, 0.22 * S); ctx.fillStyle = O.dark; ctx.fillRect(dx - 2.55 * S, dy - 0.55 * S, 5.1 * S, 0.04 * S);
  for (let i = -1; i <= 1; i++) shape(ctx, () => { ctx.beginPath(); ctx.arc(dx + i * 1.3 * S, dy - 1.35 * S, 0.3 * S, 0, 7); }, ART.glass, S, { noShade: true });
  if (win) for (let i = -1; i <= 1; i++) { ctx.fillStyle = al(ART.coin.base, 0.5 + 0.5 * Math.sin(t * 8 + i)); ctx.beginPath(); ctx.arc(dx + i * 1.3 * S, dy - 1.35 * S, 0.22 * S, 0, 7); ctx.fill(); }
  ctx.strokeStyle = T.dark; ctx.lineWidth = 0.07 * S; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(dx + 1.4 * S, dy - 2.1 * S); ctx.lineTo(dx + 1.8 * S, dy - 3.1 * S); ctx.stroke();
  ctx.save(); ctx.translate(dx + 1.8 * S, dy - 3.2 * S); ctx.rotate(-0.5 + Math.sin(t * 0.8) * 0.15 * motion(1)); shape(ctx, () => { ctx.beginPath(); ctx.ellipse(0, 0, 0.55 * S, 0.24 * S, 0, Math.PI, 0); ctx.closePath(); }, ART.roverMetal, S); ctx.restore();
  // landing pad
  const p0 = e - 1, pw = 6.4;
  shape(ctx, () => rr(ctx, X(p0), gy - 0.14 * S, pw * S, 0.28 * S, 0.08 * S), ART.roverMetal, S);
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? O.base : ART.sign.base; ctx.beginPath(); const x = X(p0) + (0.2 + i * 0.75) * S; ctx.moveTo(x, gy - 0.1 * S); ctx.lineTo(x + 0.35 * S, gy - 0.1 * S); ctx.lineTo(x + 0.2 * S, gy + 0.08 * S); ctx.lineTo(x - 0.15 * S, gy + 0.08 * S); ctx.closePath(); ctx.fill(); }
  for (const lx of [p0 + 0.15, p0 + pw - 0.15]) { const on = win ? Math.sin(t * 10) > 0 : Math.sin(t * 3) > 0; ctx.fillStyle = on ? ART.energy.base : ART.energy.dark; ctx.strokeStyle = ART.energy.dark; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(X(lx), gy - 0.2 * S, 0.08 * S, 0, 7); ctx.fill(); ctx.stroke(); }
  // flag pole + waving flag (waves faster on arrival)
  const fx = gx + 0.2 * S, ph = 3.4 * S, sp = win ? 9 : 3;
  ctx.fillStyle = ART.roverMetal.dark; ctx.fillRect(fx - 4, gy - ph, 8, ph); ctx.fillStyle = ART.roverMetal.light; ctx.fillRect(fx - 2, gy - ph, 2.5, ph);
  ctx.fillStyle = ART.coin.base; ctx.strokeStyle = ART.coin.dark; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(fx, gy - ph, 0.12 * S, 0, 7); ctx.fill(); ctx.stroke();
  const fw = 1.5 * S, fh = 0.9 * S, wav = (u: number) => Math.sin(u * 5 - t * sp) * 0.09 * S * u * motion(1);
  const flag = () => { ctx.beginPath(); ctx.moveTo(fx, gy - ph + 0.1 * S); for (let i = 0; i <= 10; i++) { const u = i / 10; ctx.lineTo(fx + fw * u, gy - ph + 0.1 * S + wav(u)); } for (let i = 10; i >= 0; i--) { const u = i / 10; ctx.lineTo(fx + fw * u, gy - ph + 0.1 * S + fh + wav(u)); } ctx.closePath(); };
  shape(ctx, flag, ART.flag, S);
  ctx.fillStyle = ART.station.base; ctx.beginPath(); const mx = fx + fw * 0.5, my = gy - ph + 0.1 * S + fh / 2 + wav(0.5); ctx.arc(mx, my, 0.24 * S, 0, 7); ctx.arc(mx + 0.1 * S, my - 0.05 * S, 0.2 * S, 0, 7, true); ctx.fill('evenodd');
}

// ======================================================================
// Menu rover (title, garage lift, map marker, reactions)
// ======================================================================
export interface PreviewOpts { crates?: number; bedH?: number; up?: Up; look?: { x: number; y: number }; mood?: 'idle' | 'dizzy' | 'happy'; compress?: number; angle?: number; blink?: boolean; wheelSpin?: number; smoke?: boolean; }
/** Rover for menus. x, y = chassis centre in screen px, S = px per metre. */
export function drawRoverPreview(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number, o: PreviewOpts = {}) {
  const up = o.up ?? save.up, bedH = o.bedH ?? 0.4 + 0.0625 * up.bed, comp = o.compress ?? Math.sin(t * 3) * 0.015 * motion(1), n = Math.min(o.crates ?? 3, 4);
  ctx.save(); ctx.translate(x, y); if (o.angle) ctx.rotate(o.angle);
  ctx.fillStyle = 'rgba(20,16,12,.28)'; ctx.beginPath(); ctx.ellipse(0, 0.88 * S, 1.6 * S, 0.12 * S, 0, 0, 7); ctx.fill();
  const wheel = sprite('wheel3:' + up.tires, [-0.5, -0.5, 0.5, 0.5], (g, s) => drawWheelSpr(g, s, up.tires));
  for (const wx of [-0.95, 0.95]) drawSpring(ctx, wx * S, 0.05 * S + comp * S, wx * S, 0.46 * S, S, up.suspension);
  for (const wx of [-0.95, 0.95]) blit(ctx, wheel, wx * S, 0.46 * S, -(o.wheelSpin ?? 0), S);
  blit(ctx, sprite(`hull3:${up.bumper}:${up.turbo}:${up.battery}`, [-1.7, -0.26, 1.72, 0.26], (g, s) => roverHull(g, s, up)), 0, comp * S, 0, S);
  const h = n >= 4 ? 0.2 : 0.22, gap = (1.69 - n * 2 * h) / (n + 1);
  for (let i = 0; i < n; i++) { const cx = -1.27 + gap + h + i * (2 * h + gap); blit(ctx, crateSpr(h, false, i), cx * S, (comp - 0.18 - h) * S, 0, S); }
  blit(ctx, sprite(`cab3:${bedH.toFixed(3)}:${up.engine}:${up.shield}`, [-1.45, -1.42, 1.5, -0.08], (g, s) => roverCab(g, s, bedH, up)), 0, comp * S, 0, S);
  ctx.translate(0, comp * S);
  const blink = o.blink ?? ((t % 3.6) < 0.12);
  drawEyes(ctx, S, o.look ?? { x: 0.6, y: 0 }, blink ? 0.1 : 1, o.mood ?? 'idle', t);
  antennaLight(ctx, S, t);
  if (o.smoke) smokePuffs(ctx, S, t);
  ctx.restore();
}
/** slime for menus (peeking out, map hazards) with live googly eyes */
export function drawSlimePreview(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, t: number, lookX = 0) {
  const sq = 1 + Math.sin(t * 4) * 0.05 * motion(1);
  blit(ctx, slimeSpr(), x, y, 0, S, 1 / sq, sq);
  googly(ctx, x, y - (sq - 1) * 0.2 * S, S, lookX, t * 3, (t % 3.1) < 0.12);
}
export function drawCratePreview(ctx: CanvasRenderingContext2D, x: number, y: number, S: number, glass = false, idx = 0, ang = 0) { blit(ctx, crateSpr(0.22, glass, idx), x, y, ang, S); }

/** Build every sprite a run can need up front, so nothing is generated mid-drive (no first-appearance hitches). */
export function warmSprites(sim: Sim) {
  wheelSpr(); hullSpr(save.up); cabSpr(sim.wallH, save.up); slimeSpr();
  sprite('meteor3', [-0.7, -0.7, 0.7, 0.7], meteorRock); sprite('coin3', [-0.32, -0.32, 0.32, 0.32], coinSprDraw);
  for (const c of sim.crates) crateSpr(sim.crateHalf, c.glass, c.idx);
}
export type { WorldArt };
