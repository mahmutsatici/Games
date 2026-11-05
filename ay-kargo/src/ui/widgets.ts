/** Immediate-mode UI widgets in the rover-hardware style: physical buttons, riveted metal panels, crate panels, plaques. */
import { C, Tri, R, EDGE, FONT_DISPLAY, FONT_UI, ease, clamp01, motion } from './theme';

export const W = 1280, H = 720;

export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
/** colour string with alpha (accepts #rrggbb) */
export function alpha(hex: string, a: number) { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; }

// ---------------- text ----------------
export interface TextOpts { font?: 'display' | 'ui'; fill?: string; stroke?: string; strokeW?: number; shadow?: boolean; align?: CanvasTextAlign; }
/** outlined text: outline is a darker shade of the fill (pass it), small drop shadow for chunky depth */
export function label(ctx: CanvasRenderingContext2D, s: string | number, x: number, y: number, size: number, o: TextOpts = {}) {
  const disp = (o.font ?? 'display') === 'display';
  ctx.font = `${disp ? 700 : 800} ${size}px ${disp ? FONT_DISPLAY : FONT_UI}`;
  ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  const str = String(s), sw = o.strokeW ?? Math.max(3, size * 0.14);
  if (o.shadow !== false && o.stroke) { ctx.fillStyle = C.shadow; ctx.strokeStyle = C.shadow; ctx.lineWidth = sw; ctx.strokeText(str, x, y + size * 0.08); ctx.fillText(str, x, y + size * 0.08); }
  if (o.stroke) { ctx.strokeStyle = o.stroke; ctx.lineWidth = sw; ctx.strokeText(str, x, y); }
  ctx.fillStyle = o.fill ?? C.textLight; ctx.fillText(str, x, y);
}
/** fit text into maxW by shrinking the size */
export function fitSize(ctx: CanvasRenderingContext2D, s: string, size: number, maxW: number, font: 'display' | 'ui' = 'display') {
  ctx.font = `${font === 'display' ? 700 : 800} ${size}px ${font === 'display' ? FONT_DISPLAY : FONT_UI}`;
  const w = ctx.measureText(s).width; return w > maxW ? Math.max(10, size * maxW / w) : size;
}

// ---------------- pointer + button registry ----------------
interface Btn { id: string; x: number; y: number; w: number; h: number; cb: () => void; disabled?: boolean; }
let frameBtns: Btn[] = [], lastBtns: Btn[] = [];
export const pointer = { x: -1, y: -1, down: false, downOn: '' };
let onButtonSound: (kind: 'press' | 'release') => void = () => {};
export function setButtonSound(f: typeof onButtonSound) { onButtonSound = f; }
export function beginFrame() { lastBtns = frameBtns; frameBtns = []; }
/** drop the buttons registered so far this frame (a modal on top takes over) */
export function clearFrameButtons() { frameBtns = []; }
/** register a hit area without drawing (e.g. for custom-drawn things) */
export function hitArea(id: string, x: number, y: number, w: number, h: number, cb: () => void) { frameBtns.push({ id, x, y, w, h, cb }); }
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

// ---------------- physical button ----------------
export interface BtnOpts { pulse?: boolean; disabled?: boolean; radius?: number; }
/**
 * Chunky physical button: rounded body, darker bottom edge, darker outline, glossy top streak.
 * Pressing pushes it down 3 px and squashes it slightly.
 */
export function button(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, tone: Tri, cb: () => void, content: (cx: number, cy: number) => void, o: BtnOpts = {}) {
  frameBtns.push({ id, x, y, w, h, cb, disabled: o.disabled });
  const pressed = isPressed(id) && !o.disabled, t = performance.now() / 1000;
  const pulse = o.pulse && !pressed ? 1 + motion(0.035) * Math.sin(t * 4.2) : 1;
  const r = o.radius ?? Math.min(R.btn, h * 0.3), dy = pressed ? 3 : 0, sq = pressed ? 0.96 : 1;
  const cx = x + w / 2, cy = y + h / 2;
  ctx.save(); ctx.translate(cx, cy + dy); ctx.scale(pulse * (pressed ? 1.02 : 1), pulse * sq); ctx.translate(-cx, -cy);
  if (o.disabled) ctx.globalAlpha = 0.6;
  rr(ctx, x + 2, y + EDGE + 5 - dy, w, h, r); ctx.fillStyle = C.shadow; ctx.fill();
  rr(ctx, x, y + EDGE - dy, w, h, r); ctx.fillStyle = tone.dark; ctx.fill();
  rr(ctx, x, y, w, h, r); ctx.fillStyle = tone.base; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  ctx.fillStyle = alpha(tone.dark, 0.2); ctx.fillRect(x, y + h * 0.7, w, h * 0.3);
  ctx.fillStyle = alpha(tone.light, 0.75); rr(ctx, x + Math.min(14, w * 0.1), y + 6, w - Math.min(28, w * 0.2), Math.max(5, h * 0.13), h * 0.07); ctx.fill();
  ctx.restore();
  rr(ctx, x, y, w, h, r); ctx.lineWidth = 3; ctx.strokeStyle = tone.dark; ctx.stroke();
  content(cx, cy - 1);
  ctx.restore();
}

// ---------------- panels ----------------
function rivet(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, T: Tri) {
  ctx.beginPath(); ctx.arc(x, y + 1, r, 0, 7); ctx.fillStyle = T.dark; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = T.light; ctx.fill();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.lineWidth = 1.5; ctx.strokeStyle = T.dark; ctx.stroke();
}
/** riveted metal plate (rover / station hardware) with panel lines, an orange stripe and a drop shadow */
export function metalPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, o: { tone?: Tri; stripe?: boolean; seams?: boolean } = {}) {
  const T = o.tone ?? C.metal, r = R.panel;
  rr(ctx, x + 6, y + 12, w, h, r); ctx.fillStyle = C.shadow; ctx.fill();
  rr(ctx, x, y + 6, w, h, r); ctx.fillStyle = T.dark; ctx.fill();
  rr(ctx, x, y, w, h, r); ctx.fillStyle = T.base; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  ctx.fillStyle = alpha(T.dark, 0.14); ctx.fillRect(x, y + h - 26, w, 26);
  if (o.seams !== false) { ctx.strokeStyle = alpha(T.dark, 0.28); ctx.lineWidth = 2; for (const k of [0.34, 0.68]) { ctx.beginPath(); ctx.moveTo(x + w * k, y + 34); ctx.lineTo(x + w * k, y + h - 8); ctx.stroke(); } }
  ctx.fillStyle = alpha(T.light, 0.8); rr(ctx, x + 22, y + 8, w - 44, 7, 3.5); ctx.fill();
  if (o.stripe !== false) { ctx.fillStyle = C.primary.base; ctx.fillRect(x, y + 20, w, 10); ctx.fillStyle = C.primary.dark; ctx.fillRect(x, y + 30, w, 3);
    ctx.fillStyle = alpha('#ffffff', 0.25); ctx.fillRect(x, y + 20, w, 3); }
  ctx.restore();
  rr(ctx, x, y, w, h, r); ctx.lineWidth = 3.5; ctx.strokeStyle = T.dark; ctx.stroke();
  for (const [rx, ry] of [[x + 16, y + 46], [x + w - 16, y + 46], [x + 16, y + h - 16], [x + w - 16, y + h - 16]]) rivet(ctx, rx, ry, 5, T);
}
/** cargo-crate panel: wooden planks, corner brackets, nails */
export function cratePanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  const T = C.wood, r = 14;
  rr(ctx, x + 6, y + 12, w, h, r); ctx.fillStyle = C.shadow; ctx.fill();
  rr(ctx, x, y + 6, w, h, r); ctx.fillStyle = T.dark; ctx.fill();
  rr(ctx, x, y, w, h, r); ctx.fillStyle = T.base; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, r); ctx.clip();
  const n = Math.max(3, Math.round(h / 70)), ph = h / n;
  for (let i = 0; i < n; i++) { const py = y + i * ph; ctx.fillStyle = alpha(T.light, 0.5); ctx.fillRect(x, py + 3, w, 4); ctx.fillStyle = alpha(T.dark, 0.35); ctx.fillRect(x, py + ph - 3, w, 3);
    ctx.strokeStyle = alpha(T.dark, 0.16); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x + 30 + i * 47 % 90, py + ph * 0.5); ctx.lineTo(x + w * 0.5, py + ph * 0.45); ctx.stroke(); }
  ctx.restore();
  rr(ctx, x, y, w, h, r); ctx.lineWidth = 3.5; ctx.strokeStyle = T.dark; ctx.stroke();
  const M = C.metal;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    ctx.beginPath(); ctx.moveTo(cx, cy + sy * 46); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * 46, cy); ctx.lineTo(cx + sx * 46, cy + sy * 16); ctx.lineTo(cx + sx * 16, cy + sy * 16); ctx.lineTo(cx + sx * 16, cy + sy * 46); ctx.closePath();
    ctx.fillStyle = M.base; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = M.dark; ctx.stroke();
    rivet(ctx, cx + sx * 9, cy + sy * 9, 3.5, M);
  }
}
/** dark display inset ("screen" on the hardware) for numbers and lists */
export function inset(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, T: Tri = C.steel) {
  rr(ctx, x, y, w, h, 14); ctx.fillStyle = T.base; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, 14); ctx.clip(); ctx.fillStyle = alpha(T.dark, 0.5); ctx.fillRect(x, y, w, 7); ctx.fillStyle = alpha(T.light, 0.25); ctx.fillRect(x, y + h - 4, w, 4); ctx.restore();
  rr(ctx, x, y, w, h, 14); ctx.lineWidth = 3; ctx.strokeStyle = T.dark; ctx.stroke();
}
/** orange title plaque bolted to a panel */
export function plaque(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number, text: string, size = 40, T: Tri = C.primary) {
  const h = size * 1.45;
  size = fitSize(ctx, text, size, w - 40);
  rr(ctx, cx - w / 2 + 3, cy - h / 2 + 8, w, h, 16); ctx.fillStyle = C.shadow; ctx.fill();
  rr(ctx, cx - w / 2, cy - h / 2 + 5, w, h, 16); ctx.fillStyle = T.dark; ctx.fill();
  rr(ctx, cx - w / 2, cy - h / 2, w, h, 16); ctx.fillStyle = T.base; ctx.fill();
  ctx.save(); rr(ctx, cx - w / 2, cy - h / 2, w, h, 16); ctx.clip(); ctx.fillStyle = alpha(T.light, 0.7); rr(ctx, cx - w / 2 + 16, cy - h / 2 + 6, w - 32, 6, 3); ctx.fill(); ctx.restore();
  rr(ctx, cx - w / 2, cy - h / 2, w, h, 16); ctx.lineWidth = 3; ctx.strokeStyle = T.dark; ctx.stroke();
  for (const s of [-1, 1]) rivet(ctx, cx + s * (w / 2 - 14), cy, 4, T);
  label(ctx, text, cx, cy + 1, size, { stroke: T.dark });
}
/** compact HUD piece: cream metal with darker outline and a physical edge */
export function chip(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h = 56, T: Tri = C.secondary) {
  rr(ctx, x, y + 4, w, h, R.chip); ctx.fillStyle = T.dark; ctx.fill();
  rr(ctx, x, y, w, h, R.chip); ctx.fillStyle = T.base; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, R.chip); ctx.clip(); ctx.fillStyle = alpha(T.light, 0.8); rr(ctx, x + 10, y + 4, w - 20, 5, 2.5); ctx.fill(); ctx.restore();
  rr(ctx, x, y, w, h, R.chip); ctx.lineWidth = 2.5; ctx.strokeStyle = T.dark; ctx.stroke();
}
/** sliding switch (sound / music) */
export function toggle(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, on: boolean, cb: () => void) {
  const w = 116, h = 54, T = on ? C.go : C.locked; frameBtns.push({ id, x, y, w, h, cb });
  rr(ctx, x, y + 4, w, h, h / 2); ctx.fillStyle = T.dark; ctx.fill();
  rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = T.base; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.dark; ctx.stroke();
  const kx = on ? x + w - h / 2 : x + h / 2;
  ctx.beginPath(); ctx.arc(kx, y + h / 2 + 3, h / 2 - 6, 0, 7); ctx.fillStyle = C.metal.dark; ctx.fill();
  ctx.beginPath(); ctx.arc(kx, y + h / 2, h / 2 - 6, 0, 7); ctx.fillStyle = C.metal.light; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = C.metal.dark; ctx.stroke();
}

// ---------------- animation helpers ----------------
/** eased 0..1 progress of an intro that started at t0 and lasts dur seconds */
export const intro = (now: number, t0: number, dur: number, f = ease.outBack) => f(clamp01((now - t0) / Math.max(0.001, motion(dur) || 0.001)));

// ---------------- screen transition: circle iris (~300 ms) ----------------
let iris = { t: -1, dur: 0.3, mid: null as null | (() => void), cx: W / 2, cy: H / 2, fired: false };
export function irisTo(mid: () => void, cx = W / 2, cy = H / 2) { iris = { t: 0, dur: motion(0.3) || 0.05, mid, cx, cy, fired: false }; }
export const irisBusy = () => iris.t >= 0;
export function drawIris(ctx: CanvasRenderingContext2D, dt: number) {
  if (iris.t < 0) return;
  iris.t += dt; const k = iris.t / iris.dur;
  if (k >= 0.5 && !iris.fired) { iris.fired = true; iris.mid?.(); }
  if (k >= 1) { iris.t = -1; return; }
  const p = k < 0.5 ? 1 - ease.outCubic(k / 0.5) : ease.outCubic((k - 0.5) / 0.5), r = Math.hypot(W, H) * p;
  ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(iris.cx, iris.cy, Math.max(0.1, r), 0, Math.PI * 2, true); ctx.fillStyle = '#20263a'; ctx.fill('evenodd');
  if (r > 2) { ctx.beginPath(); ctx.arc(iris.cx, iris.cy, r, 0, 7); ctx.lineWidth = 10; ctx.strokeStyle = C.primary.base; ctx.stroke(); }
  ctx.restore();
}

// ---------------- UI particles (screen space): stars, purchases, coins ----------------
interface UP { x: number; y: number; vx: number; vy: number; life: number; max: number; col: string; s: number; rot: number; star: boolean; }
const ups: UP[] = [];
export function burst(x: number, y: number, n: number, cols: string[], speed = 380, star = true) {
  if (motion(1) < 1) n = Math.ceil(n / 3);
  for (let i = 0; i < n; i++) { const a = Math.random() * Math.PI * 2, s = speed * (0.35 + Math.random() * 0.65), life = 0.6 + Math.random() * 0.5;
    ups.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 120, life, max: life, col: cols[i % cols.length], s: 6 + Math.random() * 8, rot: Math.random() * 6, star }); }
}
export function drawUiParticles(ctx: CanvasRenderingContext2D, dt: number) {
  for (let i = ups.length - 1; i >= 0; i--) {
    const p = ups[i]; p.life -= dt; if (p.life <= 0) { ups.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 700 * dt; p.vx *= 1 - dt * 1.5; p.rot += dt * 6;
    ctx.globalAlpha = Math.min(1, p.life / p.max * 1.6); ctx.fillStyle = p.col; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
    if (p.star) { ctx.beginPath(); for (let k = 0; k < 8; k++) { const r = k % 2 ? p.s * 0.45 : p.s; ctx.lineTo(Math.cos(k * Math.PI / 4) * r, Math.sin(k * Math.PI / 4) * r); } ctx.closePath(); ctx.fill(); }
    else ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}
