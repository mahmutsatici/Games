/** Immediate-mode toy UI: plastic buttons pushed into a base, toy-box lid / chalkboard / plastic-tray panels, text without outlines. */
import { C, SIDE, FONT_DISPLAY, FONT_UI, ease, clamp01, motion } from './theme';
import type { Shade } from '../art/palette';

export const W = 1280, H = 720;
export function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
/** text lit from the top-left: a soft darker drop below instead of an outline */
export function text(ctx: CanvasRenderingContext2D, s: string | number, x: number, y: number, size: number, col = C.paper, o: { font?: 'display' | 'ui'; align?: CanvasTextAlign; drop?: string | null } = {}) {
  const disp = (o.font ?? 'display') === 'display'; ctx.font = `800 ${size}px ${disp ? FONT_DISPLAY : FONT_UI}`; ctx.textAlign = o.align ?? 'center'; ctx.textBaseline = 'middle';
  const str = String(s); if (o.drop !== null) { ctx.fillStyle = o.drop ?? 'rgba(40,20,10,.35)'; ctx.fillText(str, x, y + Math.max(2, size * 0.07)); }
  ctx.fillStyle = col; ctx.fillText(str, x, y + (disp ? size * 0.06 : 0));
}
export function fit(ctx: CanvasRenderingContext2D, s: string, size: number, maxW: number, font: 'display' | 'ui' = 'display') { ctx.font = `800 ${size}px ${font === 'display' ? FONT_DISPLAY : FONT_UI}`; const w = ctx.measureText(s).width; return w > maxW ? size * maxW / w : size; }
/** soft contact shadow under UI pieces (they sit on the table too) */
export function contact(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { ctx.save(); ctx.filter = 'blur(6px)'; rr(ctx, x + 4, y + 8, w, h, r); ctx.fillStyle = C.shadow; ctx.fill(); ctx.restore(); }

// ---------------- pointer + buttons ----------------
interface Btn { id: string; x: number; y: number; w: number; h: number; cb: () => void; disabled?: boolean; }
let frame: Btn[] = [], last: Btn[] = [];
export const pointer = { x: -1, y: -1, down: false, on: '' };
let sound: (k: 'press' | 'release') => void = () => {};
export const setButtonSound = (f: typeof sound) => { sound = f; };
export function beginFrame() { last = frame; frame = []; }
export function modal() { frame = []; }
export function area(id: string, x: number, y: number, w: number, h: number, cb: () => void) { frame.push({ id, x, y, w, h, cb }); }
const inside = (b: Btn, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y - 4 && y <= b.y + b.h + SIDE;
export function down(x: number, y: number) { pointer.x = x; pointer.y = y; pointer.down = true; for (let i = last.length - 1; i >= 0; i--) if (inside(last[i], x, y)) { pointer.on = last[i].id; if (!last[i].disabled) sound('press'); return true; } pointer.on = ''; return false; }
export function move(x: number, y: number) { pointer.x = x; pointer.y = y; }
export function up(x: number, y: number) { pointer.down = false; const id = pointer.on; pointer.on = ''; const b = last.find(k => k.id === id); if (b && inside(b, x, y) && !b.disabled) { sound('release'); b.cb(); return true; } return false; }
export const pressed = (id: string) => pointer.down && pointer.on === id;
export const hovered = (id: string) => { const b = last.find(k => k.id === id); return !!b && inside(b, pointer.x, pointer.y); };

/** chunky plastic toy button: darker side face below, top face, specular streak, no outline; pressed = pushed into its base */
export function button(ctx: CanvasRenderingContext2D, id: string, x: number, y: number, w: number, h: number, c: Shade, cb: () => void, content: (cx: number, cy: number) => void, o: { pulse?: boolean; disabled?: boolean; r?: number } = {}) {
  frame.push({ id, x, y, w, h, cb, disabled: o.disabled });
  const p = pressed(id) && !o.disabled, t = performance.now() / 1000, pulse = o.pulse && !p ? 1 + motion(0.03) * Math.sin(t * 4.2) : 1;
  const r = o.r ?? Math.min(22, h * 0.32), dy = p ? SIDE - 1 : 0, cx = x + w / 2, cy = y + h / 2;
  ctx.save(); ctx.translate(cx, cy); ctx.scale(pulse, pulse); ctx.translate(-cx, -cy); if (o.disabled) ctx.globalAlpha = 0.55;
  rr(ctx, x - 3, y + 4, w + 6, h + SIDE + 2, r + 3); ctx.fillStyle = 'rgba(55,32,12,.28)'; ctx.fill();          // base socket
  rr(ctx, x, y + SIDE, w, h, r); ctx.fillStyle = c.dark; ctx.fill();                                              // side face
  rr(ctx, x, y + dy, w, h, r); ctx.fillStyle = c.side; ctx.fill();
  rr(ctx, x, y + dy, w, h * 0.82, r); ctx.fillStyle = c.top; ctx.fill();                                           // lit top face
  ctx.fillStyle = 'rgba(255,255,255,.55)'; rr(ctx, x + w * 0.1, y + dy + h * 0.1, w * 0.36, Math.max(4, h * 0.1), h * 0.05); ctx.fill();  // specular streak
  content(cx, cy + dy - 2); ctx.restore();
}
/** toy-box lid panel: painted wood with a red band, metal corner caps and screw heads */
export function lidPanel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  contact(ctx, x, y, w, h, 26);
  rr(ctx, x, y + 8, w, h, 26); ctx.fillStyle = '#8a5a2e'; ctx.fill();
  rr(ctx, x, y, w, h, 26); ctx.fillStyle = '#d9a066'; ctx.fill();
  ctx.save(); rr(ctx, x, y, w, h, 26); ctx.clip();
  for (let i = 1; i < 6; i++) { ctx.strokeStyle = 'rgba(120,70,30,.12)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y + h * i / 6); ctx.bezierCurveTo(x + w * 0.3, y + h * i / 6 - 6, x + w * 0.6, y + h * i / 6 + 8, x + w, y + h * i / 6); ctx.stroke(); }
  ctx.fillStyle = '#c4302b'; ctx.fillRect(x, y + 18, w, 14); ctx.fillStyle = '#e8473f'; ctx.fillRect(x, y + 18, w, 6);
  ctx.fillStyle = 'rgba(255,255,255,.25)'; rr(ctx, x + 30, y + 6, w - 60, 6, 3); ctx.fill(); ctx.restore();
  for (const [sx, sy] of [[x + 20, y + 50], [x + w - 20, y + 50], [x + 20, y + h - 20], [x + w - 20, y + h - 20]]) screw(ctx, sx, sy);
}
export function screw(ctx: CanvasRenderingContext2D, x: number, y: number) { ctx.fillStyle = '#9aa1ad'; ctx.beginPath(); ctx.arc(x, y + 1, 6, 0, 7); ctx.fill(); ctx.fillStyle = '#d6dae1'; ctx.beginPath(); ctx.arc(x, y, 6, 0, 7); ctx.fill(); ctx.strokeStyle = '#7b8290'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - 3.5, y - 1.5); ctx.lineTo(x + 3.5, y + 1.5); ctx.stroke(); }
/** chalkboard slate in a wooden frame (lists, numbers) */
export function slate(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  rr(ctx, x, y, w, h, 14); ctx.fillStyle = '#b8804a'; ctx.fill(); rr(ctx, x, y, w, h * 0.5, 14); ctx.fillStyle = '#d9a066'; ctx.fill();
  rr(ctx, x + 9, y + 9, w - 18, h - 18, 8); ctx.fillStyle = C.chalk; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.05)'; ctx.fillRect(x + 12, y + 12, w - 24, (h - 24) * 0.4);
}
/** plastic tray (HUD pieces): rounded tray with a lip and two screws */
export function tray(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: Shade = C.metal) {
  rr(ctx, x, y + 4, w, h, 16); ctx.fillStyle = c.dark; ctx.fill(); rr(ctx, x, y, w, h, 16); ctx.fillStyle = c.side; ctx.fill();
  rr(ctx, x + 4, y + 3, w - 8, h - 8, 13); ctx.fillStyle = c.top; ctx.fill(); ctx.fillStyle = 'rgba(255,255,255,.45)'; rr(ctx, x + 12, y + 6, w * 0.3, 4, 2); ctx.fill();
}
export const intro = (now: number, t0: number, dur: number, f = ease.outBack) => f(clamp01((now - t0) / Math.max(0.001, motion(dur) || 0.001)));

// ---------------- toy-box lid transition (250-350 ms): lid slams shut, then opens ----------------
let lid = { t: -1, mid: null as null | (() => void), fired: false };
export function lidTo(mid: () => void) { lid = { t: 0, mid, fired: false }; }
export const lidBusy = () => lid.t >= 0;
export function drawLid(ctx: CanvasRenderingContext2D, dt: number) {
  if (lid.t < 0) return; lid.t += dt; const D = motion(0.3) || 0.05, k = lid.t / D;
  if (k >= 0.5 && !lid.fired) { lid.fired = true; lid.mid?.(); }
  if (k >= 1) { lid.t = -1; return; }
  const p = k < 0.5 ? ease.outBounce(k / 0.5) : 1 - ease.outCubic((k - 0.5) / 0.5), h = H / 2 * p;
  for (const [y0, dir] of [[0, 1], [H, -1]] as [number, number][]) { const y = dir > 0 ? y0 : y0 - h;
    ctx.fillStyle = '#b8804a'; ctx.fillRect(0, y, W, h); ctx.fillStyle = '#d9a066'; ctx.fillRect(0, dir > 0 ? y : y, W, h - 12);
    ctx.fillStyle = '#c4302b'; ctx.fillRect(0, dir > 0 ? y + h - 40 : y + 24, W, 16); }
}
