/** Immediate-mode UI widgets in the game's art style: candy buttons, cutting-board panels, ribbons, outlined text. */
import { C, Tri, R, EDGE, FONT_DISPLAY, FONT_UI, ease, clamp01, motion } from './theme';

export const W = 1280, H = 720;

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

// ---------------- text ----------------
export interface TextOpts { font?: 'display' | 'ui'; weight?: number; fill?: string; stroke?: string; strokeW?: number; shadow?: boolean; align?: CanvasTextAlign; }
/** outlined text: outline is a darker shade (pass it), drop shadow below for chunky depth */
export function label(ctx: CanvasRenderingContext2D, s: string | number, x: number, y: number, size: number, o: TextOpts = {}) {
  // Erica One digits have tiny counters and blur into blobs: numbers always use the bold UI font
  const disp = (o.font ?? 'display') === 'display' && !/^[\d\s/+x×%-]+$/.test(String(s));
  ctx.font = `${disp ? 400 : o.weight ?? 700} ${size}px ${disp ? FONT_DISPLAY : FONT_UI}`;
  ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const str = String(s), sw = o.strokeW ?? Math.max(3, size * (disp ? 0.16 : 0.12));
  if (o.shadow !== false && o.stroke) { ctx.fillStyle = C.shadow; ctx.strokeStyle = C.shadow; ctx.lineWidth = sw; ctx.strokeText(str, x, y + size * 0.08); ctx.fillText(str, x, y + size * 0.08); }
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = sw; ctx.strokeText(str, x, y); }
  ctx.fillStyle = o.fill ?? C.textLight; ctx.fillText(str, x, y);
}

// ---------------- pointer + button registry ----------------
interface Btn { id: string; x: number; y: number; w: number; h: number; cb: () => void; disabled?: boolean; }
let frameBtns: Btn[] = [], lastBtns: Btn[] = [];
export const pointer = { x: -1, y: -1, down: false, downOn: '' };
export let onButtonSound: (kind: 'press' | 'release') => void = () => {};
export function setButtonSound(f: typeof onButtonSound) { onButtonSound = f; }
export function beginFrame() { lastBtns = frameBtns; frameBtns = []; }
const inside = (b: Btn, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y - 4 && y <= b.y + b.h + EDGE;
/** returns true if a button took the press (so gameplay should ignore it) */
export function pointerDown(x: number, y: number): boolean {
  pointer.x = x; pointer.y = y; pointer.down = true;
  for (let i = lastBtns.length - 1; i >= 0; i--) { const b = lastBtns[i]; if (inside(b, x, y)) { pointer.downOn = b.id; if (!b.disabled) onButtonSound('press'); return true; } }
  pointer.downOn = ''; return false;
}
export function pointerMove(x: number, y: number) { pointer.x = x; pointer.y = y; }
export function pointerUp(x: number, y: number) {
  pointer.down = false; const id = pointer.downOn; pointer.downOn = '';
  if (!id) return;
  const b = lastBtns.find(k => k.id === id); if (b && inside(b, x, y) && !b.disabled) { onButtonSound('release'); b.cb(); }
}
export const isPressed = (id: string) => pointer.down && pointer.downOn === id;

// ---------------- candy button ----------------
export interface BtnOpts { pulse?: boolean; disabled?: boolean; radius?: number; }
/**
 * Chunky candy button: rounded body, darker physical bottom edge, darker outline, glossy top highlight.
 * Pressing pushes it down 3 px and squashes it slightly.
 */
export function candy(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, tone: Tri, cb: () => void, content: (cx: number, cy: number) => void, o: BtnOpts = {}) {
  frameBtns.push({ id, x, y, w, h, cb, disabled: o.disabled });
  const pressed = isPressed(id) && !o.disabled, t = performance.now() / 1000;
  const pulse = o.pulse && !pressed ? 1 + motion(0.035) * Math.sin(t * 4.2) : 1;
  const r = o.radius ?? Math.min(R.btn, h * 0.32), dy = pressed ? 3 : 0, sq = pressed ? 0.97 : 1;
  const cx = x + w / 2, cy = y + h / 2;
  ctx.save(); ctx.translate(cx, cy + dy); ctx.scale(pulse / sq * (pressed ? 0.99 : 1), pulse * sq); ctx.translate(-cx, -cy);
  if (o.disabled) ctx.globalAlpha = 0.55;
  // drop shadow + physical edge
  rr(ctx, x, y + EDGE + 4 - dy, w, h, r); ctx.fillStyle = C.shadow; ctx.fill();
  rr(ctx, x, y + EDGE - dy, w, h, r); ctx.fillStyle = tone.dark; ctx.fill();
  // body: flat base + one shadow band + glossy highlight
  rr(ctx, x, y, w, h, r); ctx.fillStyle = tone.base; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  ctx.fillStyle = shade(tone.dark, 0.22); ctx.fillRect(x, y + h * 0.68, w, h * 0.32);
  ctx.fillStyle = 'rgba(255,255,255,.38)'; rr(ctx, x + w * 0.08, y + h * 0.1, w * 0.84, h * 0.3, h * 0.15); ctx.fill();
  ctx.restore();
  rr(ctx, x, y, w, h, r); ctx.lineWidth = 3.5; ctx.strokeStyle = tone.dark; ctx.stroke();
  content(cx, cy - 2);
  ctx.restore();
}
/** colour string with alpha (accepts #rrggbb) */
export function shade(hex: string, a: number) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

// ---------------- panels ----------------
/** wooden cutting board panel: flat wood, grain, darker outline, shadow band, top highlight, handle hole */
export function boardPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: { handle?: boolean; tone?: Tri } = {}) {
  const T = o.tone ?? C.wood, r = R.panel;
  rr(ctx, x + 6, y + 12, w, h, r); ctx.fillStyle = C.shadow; ctx.fill();
  rr(ctx, x, y + 7, w, h, r); ctx.fillStyle = T.dark; ctx.fill();
  rr(ctx, x, y, w, h, r); ctx.fillStyle = T.base; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  ctx.strokeStyle = shade(T.dark, 0.18); ctx.lineWidth = 3;
  for (let i = 0; i < 7; i++) { const yy = y + 30 + i * (h - 50) / 6; ctx.beginPath(); ctx.moveTo(x - 10, yy); ctx.bezierCurveTo(x + w * 0.3, yy - 10, x + w * 0.6, yy + 12, x + w + 10, yy - 4); ctx.stroke(); }
  ctx.fillStyle = shade(T.dark, 0.16); ctx.fillRect(x, y + h - 22, w, 22);
  ctx.fillStyle = shade(T.light, 0.55); rr(ctx, x + 18, y + 10, w - 36, 10, 5); ctx.fill();
  ctx.restore();
  rr(ctx, x, y, w, h, r); ctx.lineWidth = 4; ctx.strokeStyle = T.dark; ctx.stroke();
  if (o.handle) { ctx.fillStyle = T.dark; rr(ctx, x + w / 2 - 34, y + 16, 68, 18, 9); ctx.fill(); ctx.fillStyle = shade(T.dark, 0.5); rr(ctx, x + w / 2 - 30, y + 19, 60, 12, 6); ctx.fill(); }
}
/** inset cream "tile" area inside a panel (for stats, lists) */
export function tileInset(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  rr(ctx, x, y, w, h, 18); ctx.fillStyle = C.cream.base; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, 18); ctx.clip(); ctx.strokeStyle = shade(C.cream.dark, 0.25); ctx.lineWidth = 2;
  for (let gx = x + 40; gx < x + w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx, y + h); ctx.stroke(); }
  for (let gy = y + 40; gy < y + h; gy += 40) { ctx.beginPath(); ctx.moveTo(x, gy); ctx.lineTo(x + w, gy); ctx.stroke(); }
  ctx.fillStyle = shade(C.cream.dark, 0.25); ctx.fillRect(x, y, w, 6); ctx.restore();
  rr(ctx, x, y, w, h, 18); ctx.lineWidth = 3; ctx.strokeStyle = C.cream.dark; ctx.stroke();
}
/** sausage-red ribbon banner with a title */
export function ribbon(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, text: string, size = 44) {
  const h = size * 1.5, T = C.sausage;
  for (const s of [-1, 1]) { ctx.fillStyle = T.dark; ctx.beginPath(); ctx.moveTo(cx + s * (w / 2 - 20), cy - h * 0.3); ctx.lineTo(cx + s * (w / 2 + 34), cy - h * 0.3); ctx.lineTo(cx + s * (w / 2 + 16), cy + h * 0.1); ctx.lineTo(cx + s * (w / 2 + 34), cy + h * 0.5); ctx.lineTo(cx + s * (w / 2 - 20), cy + h * 0.5); ctx.closePath(); ctx.fill(); }
  rr(ctx, cx - w / 2, cy - h / 2 + 5, w, h, 14); ctx.fillStyle = T.dark; ctx.fill();
  rr(ctx, cx - w / 2, cy - h / 2, w, h, 14); ctx.fillStyle = T.base; ctx.fill();
  ctx.save(); rr(ctx, cx - w / 2, cy - h / 2, w, h, 14); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(cx - w / 2, cy - h / 2, w, h * 0.38); ctx.restore();
  rr(ctx, cx - w / 2, cy - h / 2, w, h, 14); ctx.lineWidth = 3.5; ctx.strokeStyle = T.dark; ctx.stroke();
  label(ctx, text, cx, cy + 2, size, { fill: C.textLight, stroke: T.dark });
}
/** compact outlined HUD chip */
export function chip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h = 56) {
  rr(ctx, x, y + 4, w, h, R.chip); ctx.fillStyle = C.wood.dark; ctx.fill();
  rr(ctx, x, y, w, h, R.chip); ctx.fillStyle = C.cream.base; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, R.chip); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.fillRect(x, y, w, h * 0.32); ctx.restore();
  rr(ctx, x, y, w, h, R.chip); ctx.lineWidth = 3; ctx.strokeStyle = C.wood.dark; ctx.stroke();
}
/** pill toggle (sound/music) */
export function toggle(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, on: boolean, cb: () => void) {
  const w = 120, h = 56; frameBtns.push({ id, x, y, w, h, cb });
  rr(ctx, x, y + 4, w, h, h / 2); ctx.fillStyle = (on ? C.go : C.locked).dark; ctx.fill();
  rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = (on ? C.go : C.locked).base; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = (on ? C.go : C.locked).dark; ctx.stroke();
  const kx = on ? x + w - h / 2 : x + h / 2;
  ctx.beginPath(); ctx.arc(kx, y + h / 2 + 2, h / 2 - 6, 0, 7); ctx.fillStyle = C.wood.dark; ctx.fill();
  ctx.beginPath(); ctx.arc(kx, y + h / 2, h / 2 - 6, 0, 7); ctx.fillStyle = C.cream.light; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = C.cream.dark; ctx.stroke();
}

// ---------------- animation helpers ----------------
/** 0..1 progress of an intro that started at t0 and lasts dur seconds, eased */
export const intro = (now: number, t0: number, dur: number, f = ease.outBack) => f(clamp01((now - t0) / Math.max(0.001, motion(dur) || 0.001)));

// ---------------- screen transitions: circle iris ----------------
let iris = { t: -1, dur: 0.3, mid: null as null | (() => void), cx: W / 2, cy: H / 2, fired: false };
/** close the iris, run `mid` (switch screen) at full cover, open again; total ~300 ms */
export function irisTo(mid: () => void, cx = W / 2, cy = H / 2) { iris = { t: 0, dur: motion(0.3) || 0.05, mid, cx, cy, fired: false }; }
export const irisBusy = () => iris.t >= 0;
export function drawIris(ctx: CanvasRenderingContext2D, dt: number) {
  if (iris.t < 0) return;
  iris.t += dt; const k = iris.t / iris.dur, half = 0.5;
  if (k >= half && !iris.fired) { iris.fired = true; iris.mid?.(); }
  if (k >= 1) { iris.t = -1; return; }
  const maxR = Math.hypot(W, H), p = k < half ? 1 - ease.outCubic(k / half) : ease.outCubic((k - half) / half), r = maxR * p;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(iris.cx, iris.cy, Math.max(0.1, r), 0, Math.PI * 2, true); ctx.fillStyle = C.sausage.dark; ctx.fill('evenodd');
  if (r > 2) { ctx.beginPath(); ctx.arc(iris.cx, iris.cy, r, 0, 7); ctx.lineWidth = 10; ctx.strokeStyle = C.primary.base; ctx.stroke(); }
  ctx.restore();
}

// ---------------- UI particles (screen space): stars, purchases, coins ----------------
interface UP { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; s: number; rot: number; star: boolean; }
const ups: UP[] = [];
export function burst(x: number, y: number, n: number, cols: string[], speed = 380, star = true) {
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65), life = 0.6 + Math.random() * 0.5;
    ups.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life, max: life, col: cols[i % cols.length], s: 6 + Math.random() * 8, rot: Math.random() * 6, star }); }
}
export function drawUiParticles(ctx: CanvasRenderingContext2D, dt: number) {
  for (let i = ups.length - 1; i >= 0; i--) {
    const p = ups[i]; p.life -= dt; if (p.life <= 0) { ups.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt; p.vx *= 1 - dt * 1.5; p.rot += dt * 6;
    ctx.globalAlpha = Math.min(1, p.life / p.max * 1.6); ctx.fillStyle = p.col; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    if (p.star) { ctx.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? p.s * 0.45 : p.s; ctx.lineTo(Math.cos(k * Math.PI / 4) * r, Math.sin(k * Math.PI / 4) * r); } ctx.closePath(); ctx.fill(); }
    else { ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
