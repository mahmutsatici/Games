import { W, H, rr } from './render';
export interface Btn { x: number; y: number; w: number; h: number; cb: () => void; }
export let buttons: Btn[] = [];
export const resetButtons = () => { buttons = []; };
export const FONT = 'system-ui, "Segoe UI", Roboto, Arial, sans-serif';

export function text(c: CanvasRenderingContext2D, s: string | number, x: number, y: number, size: number, color = '#fff', align: CanvasTextAlign = 'center', stroke = true) {
  c.font = `800 ${size}px ${FONT}`; c.textAlign = align; c.textBaseline = 'middle';
  if (stroke) { c.lineWidth = Math.max(3, size / 6); c.strokeStyle = 'rgba(10,12,24,.85)'; c.lineJoin = 'round'; c.strokeText(String(s), x, y); }
  c.fillStyle = color; c.fillText(String(s), x, y);
}
/** One panel style for every overlay (pause, result, garage, daily, briefing). */
export function panel(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  rr(c, x, y + 8, w, h, 28); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, 'rgba(30,38,64,.96)'); g.addColorStop(1, 'rgba(14,18,34,.96)');
  rr(c, x, y, w, h, 28); c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.16)'; c.stroke();
  c.strokeStyle = 'rgba(255,138,61,.85)'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + 40, y + 2); c.lineTo(x + w - 40, y + 2); c.stroke();
}
export type Tone = 'green' | 'amber' | 'blue' | 'gray' | 'red';
const TONES: Record<Tone, [string, string]> = { green: ['#5ee06a', '#1f9a3a'], amber: ['#ffc247', '#d4780a'], blue: ['#5ab4ff', '#2260c4'], gray: ['#7b8499', '#454c60'], red: ['#ff6b5e', '#b42318'] };
export function button(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, tone: Tone, cb: () => void, draw: (cx: number, cy: number) => void, pulse = false) {
  const k = pulse ? 1 + 0.04 * Math.sin(performance.now() / 180) : 1, cx = x + w / 2, cy = y + h / 2;
  c.save(); c.translate(cx, cy); c.scale(k, k); c.translate(-cx, -cy);
  rr(c, x, y + 6, w, h, 22); c.fillStyle = 'rgba(0,0,0,.35)'; c.fill();
  const g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, TONES[tone][0]); g.addColorStop(1, TONES[tone][1]);
  rr(c, x, y, w, h, 22); c.fillStyle = g; c.fill(); c.lineWidth = 3; c.strokeStyle = 'rgba(255,255,255,.55)'; c.stroke();
  rr(c, x + 5, y + 5, w - 10, Math.max(8, h * 0.4), Math.min(18, h / 3)); c.fillStyle = 'rgba(255,255,255,.14)'; c.fill();
  draw(cx, cy); c.restore();
  buttons.push({ x, y, w, h, cb });
}
export function hit(px: number, py: number): boolean {
  for (let i = buttons.length - 1; i >= 0; i--) { const b = buttons[i]; if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) { b.cb(); return true; } }
  return false;
}
export function overButton(px: number, py: number) { return buttons.some(b => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h); }


export type Icon = 'play' | 'retry' | 'next' | 'garage' | 'map' | 'clapper' | 'coin' | 'star' | 'starOff' | 'battery' | 'crate' | 'shield' | 'bolt' | 'slime' | 'meteor' | 'ufo' | 'sound' | 'soundOff' | 'gift' | 'lock' | 'pause' | 'check' | 'left' | 'right' | 'back' | 'engine' | 'suspension' | 'tires' | 'bed' | 'bumper' | 'flip' | 'inf' | 'plus' | 'x2' | 'home' | 'flag' | 'glassCrate' | 'brakeIc' | 'gasIc' | 'turboIc' | 'tiltL' | 'tiltR' | 'up' | 'down' | 'heart' | 'trophy' | 'speed';

// ---- icon helpers (all geometry lives in a 40x40 unit box centred on 0,0) ----
const paths = new Map<string, Path2D>();
const P = (d: string) => { let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p); } return p; };
const OW = 2.6, DK = '#1b2140';
const rgbCache = new Map<string, [number, number, number, number]>();
function parse(col: string): [number, number, number, number] {
  let v = rgbCache.get(col);
  if (!v) {
    let r = 255, g = 255, b = 255, a = 1;
    if (col[0] === '#') { let h = col.slice(1); if (h.length === 3) h = h.replace(/./g, '$&$&'); const n = parseInt(h.slice(0, 6), 16); r = (n >> 16) & 255; g = (n >> 8) & 255; b = n & 255; }
    else { const m = col.match(/[\d.]+/g); if (m && m.length >= 3) { r = +m[0]; g = +m[1]; b = +m[2]; if (m[3] !== undefined) a = +m[3]; } }
    v = [r, g, b, a]; rgbCache.set(col, v);
  }
  return v;
}
const shadeCache = new Map<string, string>();
/** k<0 mixes toward dark navy, k>0 toward white; k=0 returns opaque rgb(). */
function shade(col: string, k: number): string {
  const key = col + '|' + k; let s = shadeCache.get(key);
  if (!s) {
    const [r, g, b] = parse(col), t = k < 0 ? [16, 20, 42] : [255, 255, 255], f = Math.abs(k);
    s = `rgb(${Math.round(r + (t[0] - r) * f)},${Math.round(g + (t[1] - g) * f)},${Math.round(b + (t[2] - b) * f)})`; shadeCache.set(key, s);
  }
  return s;
}
const f1 = (n: number) => String(Math.round(n * 10) / 10);
const circ = (r: number, cx = 0, cy = 0) => `M${f1(cx + r)} ${f1(cy)}A${r} ${r} 0 1 0 ${f1(cx - r)} ${f1(cy)}A${r} ${r} 0 1 0 ${f1(cx + r)} ${f1(cy)}Z`;
/** Filled shape: base + bottom-right shadow crescent + top-left highlight line + dark outline. */
function solid(c: CanvasRenderingContext2D, d: string, base: string, line = shade(base, -0.62), rule: CanvasFillRule = 'nonzero') {
  const p = P(d);
  c.save(); c.clip(p, rule);
  c.fillStyle = shade(base, -0.28); c.fill(p, rule);
  c.translate(-1.5, -2); c.fillStyle = base; c.fill(p, rule);
  c.translate(3.5, 4.4); c.lineWidth = 2; c.strokeStyle = shade(base, 0.5); c.stroke(p);
  c.restore();
  c.lineWidth = OW; c.strokeStyle = line; c.stroke(p);
}
/** Chunky stroked line(s) with outline, shadow and highlight passes. */
function thick(c: CanvasRenderingContext2D, ds: string[], base: string, w: number, line = shade(base, -0.62)) {
  c.strokeStyle = line; c.lineWidth = w + OW; for (const d of ds) c.stroke(P(d));
  c.strokeStyle = base; c.lineWidth = w; for (const d of ds) c.stroke(P(d));
  c.save(); c.lineWidth = w * 0.3;
  c.translate(0.9, 1.1); c.strokeStyle = shade(base, -0.28); for (const d of ds) c.stroke(P(d));
  c.translate(-1.8, -2.2); c.strokeStyle = shade(base, 0.55); for (const d of ds) c.stroke(P(d));
  c.restore();
}
function arcArrow(r: number, a0: number, a1: number, cy = 0): [string, string] {
  const k = Math.PI / 180, x0 = r * Math.cos(a0 * k), y0 = r * Math.sin(a0 * k) + cy, x1 = r * Math.cos(a1 * k), y1 = r * Math.sin(a1 * k) + cy;
  const large = ((a1 - a0 + 720) % 360) > 180 ? 1 : 0;
  const tx = -Math.sin(a1 * k), ty = Math.cos(a1 * k), nx = Math.cos(a1 * k), ny = Math.sin(a1 * k), hw = 7, hl = 9;
  return [`M${f1(x0)} ${f1(y0)}A${r} ${r} 0 ${large} 1 ${f1(x1)} ${f1(y1)}`,
    `M${f1(x1 + tx * hl)} ${f1(y1 + ty * hl)}L${f1(x1 + nx * hw)} ${f1(y1 + ny * hw)}L${f1(x1 - nx * hw)} ${f1(y1 - ny * hw)}Z`];
}
const starD = (() => { let d = ''; for (let i = 0; i < 10; i++) { const r = i % 2 ? 8.4 : 18.5, a = -Math.PI / 2 + i * Math.PI / 5; d += (i ? 'L' : 'M') + f1(Math.cos(a) * r) + ' ' + f1(Math.sin(a) * r); } return d + 'Z'; })();
const gearD = (() => {
  let d = ''; const n = 8;
  for (let i = 0; i < n; i++) {
    const a = i * 2 * Math.PI / n;
    for (const [da, r] of [[-0.3, 8.6], [-0.18, 12], [0.18, 12], [0.3, 8.6]] as const) d += (d ? 'L' : 'M') + f1(Math.cos(a + da) * r) + ' ' + f1(Math.sin(a + da) * r);
  }
  return d + 'Z' + circ(3.6);
})();
const RETRY = arcArrow(11.5, 8, 310), FLIP = arcArrow(11.5, 120, 420), TILT = arcArrow(14, 200, 335, 6);
const ARROW = 'M-16.5 0L-2.5 -13V-6H16.5V6H-2.5V13Z';
const C16 = circ(16), C10 = circ(10), C8 = circ(8), C3 = circ(3);
const BTRI = 'M0 -14L-14 0L0 14Z', GTRI = 'M0 -14L14 0L0 14Z';
/** Draw text centred on its ink box (not its em box). */
function glyph(c: CanvasRenderingContext2D, s: string, size: number, col: string) {
  c.font = `900 ${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic';
  const m = c.measureText(s), x = -(m.actualBoundingBoxRight - m.actualBoundingBoxLeft) / 2, y = (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  c.lineWidth = OW * 2; c.strokeStyle = shade(col, -0.62); c.strokeText(s, x, y);
  c.fillStyle = col; c.fillText(s, x, y);
  c.fillStyle = shade(col, 0.5); c.save(); c.beginPath(); c.rect(-30, y - m.actualBoundingBoxAscent, 60, m.actualBoundingBoxAscent * 0.35); c.clip(); c.fillText(s, x, y); c.restore();
}

export function icon(c: CanvasRenderingContext2D, n: Icon, x: number, y: number, s: number, col = '#fff') {
  c.save(); c.translate(x, y); c.scale(s / 40, s / 40); c.lineCap = 'round'; c.lineJoin = 'round';
  const a = parse(col)[3]; if (a < 1) c.globalAlpha *= a;
  const M = shade(col, 0);
  switch (n) {
    case 'play': solid(c, 'M-9.5 -15L-9.5 15L17.5 0Z', M); break;
    case 'left': solid(c, 'M9.5 -15L9.5 15L-17.5 0Z', M); break;
    case 'right': solid(c, 'M-9.5 -15L-9.5 15L17.5 0Z', M); break;
    case 'next': solid(c, 'M-15 -13L4 0L-15 13Z', M); solid(c, 'M8.5 -13H15V13H8.5Z', M); break;
    case 'back': solid(c, ARROW, M); break;
    case 'up': c.rotate(Math.PI / 2); solid(c, ARROW, M); break;
    case 'down': c.rotate(-Math.PI / 2); solid(c, ARROW, M); break;
    case 'retry': thick(c, [RETRY[0]], M, 5.5); solid(c, RETRY[1], M); break;
    case 'flip': thick(c, [FLIP[0]], M, 5.5); solid(c, FLIP[1], M); break;
    case 'tiltR': thick(c, [TILT[0]], M, 5.5); solid(c, TILT[1], M); break;
    case 'tiltL': c.scale(-1, 1); thick(c, [TILT[0]], M, 5.5); solid(c, TILT[1], M); break;
    case 'home': solid(c, 'M0 -16.5L18 -0.5H13V15.5H-13V-0.5H-18Z', M); solid(c, 'M-3.6 15.5V6H3.6V15.5Z', shade(M, -0.45)); break;
    case 'garage':
      thick(c, ['M5 -5L-9 9', 'M14.4 -9.1A6.5 6.5 0 1 1 9.1 -14.4'], M, 5);
      c.save(); c.translate(-7, 7); c.scale(0.85, 0.85); solid(c, gearD, M, undefined, 'evenodd'); c.restore(); break;
    case 'map': solid(c, 'M0 17C-3 12-13 4-13 -4A13 13 0 0 1 13 -4C13 4 3 12 0 17Z', M); c.fillStyle = shade(M, -0.62); c.fill(P(circ(5, 0, -4))); break;
    case 'clapper': {
      const bar = 'M0 -9H32V0H0Z';
      solid(c, 'M-16 -4H16V15Q16 17 14 17H-14Q-16 17 -16 15Z', '#4a5580');
      c.save(); c.translate(-16, -5); c.rotate(-0.12);
      solid(c, bar, '#f4f6fb', '#2a3150');
      c.save(); c.clip(P(bar)); c.fillStyle = '#2f3858'; for (let i = 0; i < 4; i++) { c.fill(P('M7 -9H12L8 0H3Z')); c.translate(8, 0); } c.restore();
      c.lineWidth = OW; c.strokeStyle = '#2a3150'; c.stroke(P(bar)); c.restore(); break;
    }
    case 'coin':
      solid(c, C16, '#ffd23a', '#9a5f08'); c.lineWidth = 2.4; c.strokeStyle = '#d9a01c'; c.stroke(P(C10));
      c.fillStyle = '#c98a10'; c.fill(P('M-2.8 -6H2.8V6H-2.8Z')); c.fillStyle = '#fff3b0'; c.fillRect(-2.8, -6, 1.4, 12); break;
    case 'star': solid(c, starD, '#ffd23a', '#9a5f08'); break;
    case 'starOff': {
      c.translate(0, 0.5); const p = P(starD);
      c.save(); c.clip(p); c.fillStyle = 'rgba(8,12,30,.55)'; c.fill(p); c.translate(1.6, 2.2); c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.5)'; c.stroke(p); c.restore();
      c.lineWidth = OW; c.strokeStyle = 'rgba(170,184,220,.55)'; c.stroke(p); break;
    }
    case 'battery':
      solid(c, 'M-17.5 -8.5Q-17.5 -11 -15 -11H9.5Q12 -11 12 -8.5V8.5Q12 11 9.5 11H-15Q-17.5 11 -17.5 8.5Z', M);
      solid(c, 'M12 -4H16Q17.5 -4 17.5 -2.5V2.5Q17.5 4 16 4H12Z', M);
      c.fillStyle = DK; c.fill(P('M-13.5 -6.5H8V6.5H-13.5Z'));
      c.fillStyle = M; for (let i = 0; i < 3; i++) c.fillRect(-12 + i * 6.8, -5, 5, 10); break;
    case 'crate':
      solid(c, 'M-15 -15H15V15H-15Z', '#dc9a50', '#5e3413');
      c.lineWidth = 2.6; c.strokeStyle = '#9a5f26'; c.stroke(P('M-9 -9H9V9H-9Z')); c.stroke(P('M-9 -9L9 9M9 -9L-9 9')); break;
    case 'glassCrate':
      solid(c, 'M-15 -15H15V15H-15Z', 'rgb(170,236,255)', '#2f7ea8');
      c.lineWidth = 2.2; c.strokeStyle = 'rgba(70,150,200,.8)'; c.stroke(P('M-9.5 -9.5H9.5V9.5H-9.5Z'));
      c.lineWidth = 3; c.strokeStyle = '#fff'; c.stroke(P('M-5 6L4 -6')); c.stroke(P('M3 8L8 1')); break;
    case 'shield':
      solid(c, 'M0 -17L15 -11V3C15 11 7 15 0 18.5C-7 15-15 11-15 3V-11Z', M);
      c.save(); c.clip(P('M0 -17L15 -11V3C15 11 7 15 0 18.5C-7 15-15 11-15 3V-11Z')); c.fillStyle = 'rgba(10,14,40,.16)'; c.fillRect(0, -20, 20, 40); c.restore();
      c.lineWidth = OW; c.strokeStyle = shade(M, -0.62); c.stroke(P('M0 -17L15 -11V3C15 11 7 15 0 18.5C-7 15-15 11-15 3V-11Z')); break;
    case 'bolt': solid(c, 'M5 -18L-11 3H-2L-6 18L11 -4H2Z', M); break;
    case 'slime':
      solid(c, 'M-16 14C-19 14-18 2-12 -6C-6 -16 6 -16 12 -6C18 2 19 14 16 14Z', '#5be35b', '#1b6b2a');
      c.fillStyle = '#fff'; c.fill(P(circ(3.8, -6, -2))); c.fill(P(circ(3.8, 6, -2)));
      c.fillStyle = '#10300f'; c.fill(P(circ(1.9, -5.4, -1.6))); c.fill(P(circ(1.9, 6.6, -1.6)));
      c.lineWidth = 2; c.strokeStyle = '#1b6b2a'; c.stroke(P('M-4 6Q0 9.5 4 6')); break;
    case 'meteor':
      solid(c, 'M-17 -17C-8 -16 0 -12 8 -3L-3 8C-9 -2-14 -9-17 -17Z', '#ff9a2e', '#a3400a');
      solid(c, 'M-12 -12C-6 -10-2 -7 2 -2L-3 3C-6 -2-9 -6-12 -12Z', '#ffe27a', '#d9780a');
      solid(c, circ(11, 5, 5), '#8f7a6c', '#3d2f28'); c.fillStyle = '#6a584d'; c.fill(P(circ(2.6, 2, 3))); c.fill(P(circ(2, 9, 8))); break;
    case 'ufo':
      c.translate(0, -2);
      solid(c, 'M-10.5 3A10.5 10.5 0 0 1 10.5 3Z', '#82e6ff', '#2a6f94');
      solid(c, 'M-18.5 6C-18.5 -2 18.5 -2 18.5 6C18.5 14 -18.5 14 -18.5 6Z', '#aab4cc', '#3a4366');
      c.fillStyle = '#ffd23a'; for (const px of [-9, 0, 9]) c.fill(P(circ(2, px, 7))); break;
    case 'sound': case 'soundOff': {
      const off = n === 'soundOff';
      c.translate(off ? -2 : 0, 0);
      solid(c, 'M-17 -5H-10L-2 -13V13L-10 5H-17Z', M);
      if (off) thick(c, ['M5 -7L15 7', 'M15 -7L5 7'], M, 3.6);
      else thick(c, ['M3 -7A8 8 0 0 1 3 7', 'M5 -13A15 15 0 0 1 5 13'], M, 3.2);
      break;
    }
    case 'gift':
      solid(c, 'M-14 -3H14V15H-14Z', '#ff5a7a', '#8f1c3a'); solid(c, 'M-3.5 -3H3.5V15H-3.5Z', '#ffd23a', '#9a5f08');
      solid(c, 'M-16 -9H16V-3H-16Z', '#ff7d96', '#8f1c3a'); solid(c, 'M-3.5 -9H3.5V-3H-3.5Z', '#ffd23a', '#9a5f08');
      solid(c, 'M0 -9C-3 -20-14 -18-11 -13C-9 -9-3 -9 0 -9Z', '#ffd23a', '#9a5f08'); solid(c, 'M0 -9C3 -20 14 -18 11 -13C9 -9 3 -9 0 -9Z', '#ffd23a', '#9a5f08'); break;
    case 'lock':
      thick(c, ['M-7 -3V-7A7 7 0 0 1 7 -7V-3'], M, 4);
      solid(c, 'M-12 -3H12V16H-12Z', M); c.fillStyle = shade(M, -0.62); c.fill(P(circ(3, 0, 5))); c.fillRect(-1.4, 5, 2.8, 5); break;
    case 'pause': solid(c, 'M-12 -14H-4V14H-12Z', M); solid(c, 'M4 -14H12V14H4Z', M); break;
    case 'check': thick(c, ['M-12.5 1L-4 9.5L13 -9.5'], M, 7); break;
    case 'plus': solid(c, 'M-4 -14H4V-4H14V4H4V14H-4V4H-14V-4H-4Z', M); break;
    case 'x2': glyph(c, 'x2', 26, M); break;
    case 'inf': thick(c, ['M0 0C6 -12 16 -12 16 0C16 12 6 12 0 0C-6 -12-16 -12-16 0C-16 12-6 12 0 0Z'], M, 5); break;
    case 'engine':
      c.translate(0, 1);
      solid(c, 'M-18 -3H-12V5H-18Z', '#6f7a96'); solid(c, 'M10 -2H18V6H10Z', '#6f7a96');
      solid(c, 'M-8 -15H4V-6H-8Z', '#ff6b5e', '#7a1d14'); solid(c, 'M-12 -7H10V12H-12Z', '#9aa6bd', '#2f3858');
      c.fillStyle = '#2f3858'; c.fill(P(circ(3, -1, 2.5))); break;
    case 'suspension': thick(c, ['M0 -17V-13L9 -9L-9 -3L9 3L-9 9L0 13V17'], M, 4.2); break;
    case 'tires':
      solid(c, C16, '#474e68', '#161a2e'); solid(c, C8, '#d5dcf0', '#2f3858'); c.fillStyle = '#7b86a3'; c.fill(P(C3));
      c.lineWidth = 2; c.strokeStyle = '#7b86a3'; for (let i = 0; i < 5; i++) { c.beginPath(); c.moveTo(0, 0); const t = i * 1.2566; c.lineTo(Math.sin(t) * 6.5, -Math.cos(t) * 6.5); c.stroke(); } break;
    case 'bed':
      solid(c, 'M-18 -13H-11V5H11V-2H18V13H-18Z', M);
      solid(c, 'M-7 -5H3.5V5H-7Z', '#dc9a50', '#5e3413'); break;
    case 'bumper':
      solid(c, 'M-11 4H-5V11H-11Z', shade(M, -0.4)); solid(c, 'M5 4H11V11H5Z', shade(M, -0.4));
      solid(c, 'M-18 -11H18V1Q18 5 14 5H-14Q-18 5 -18 1Z', M); break;
    case 'flag': {
      const ban = 'M-11 -16C-4 -20 4 -12 15 -16V2C4 6-4 -2-11 2Z';
      thick(c, ['M-13 -18V18'], '#cfd6e6', 3.2); solid(c, ban, '#fff', '#1d2336');
      c.save(); c.clip(P(ban)); c.fillStyle = '#1d2336'; for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) if ((r + k) % 2) c.fillRect(-11 + k * 6.6, -19 + r * 7, 6.6, 7); c.restore();
      c.lineWidth = OW; c.strokeStyle = '#1d2336'; c.stroke(P(ban)); break;
    }
    case 'brakeIc': solid(c, BTRI, M); c.translate(14, 0); solid(c, BTRI, M); break;
    case 'gasIc': solid(c, GTRI, M); c.translate(-14, 0); solid(c, GTRI, M); break;
    case 'turboIc':
      solid(c, 'M0 -18C3 -10 12 -6 12 4C12 12 6 17 0 17C-6 17-12 12-12 4C-12 -2-8 -6-6 -10C-4 -6-2 -6 0 -18Z', '#ff8a2a', '#8f2a0a');
      solid(c, 'M0 -2C2 3 6 5 6 9C6 13 3 14 0 14C-3 14-6 13-6 9C-6 5-2 3 0 -2Z', '#ffe27a', '#d9780a'); break;
    case 'heart': solid(c, 'M0 16C-18 4-18 -6-17 -9C-14 -16-4 -16 0 -8C4 -16 14 -16 17 -9C18 -6 18 4 0 16Z', '#ff4d6a', '#8f1530'); break;
    case 'trophy':
      thick(c, ['M-10 -12H-14C-14 -4-11 -1-7 0', 'M10 -12H14C14 -4 11 -1 7 0'], '#ffd23a', 3.2, '#9a5f08');
      solid(c, 'M-10 -16H10V-6C10 2 5 6 0 6C-5 6-10 2-10 -6Z', '#ffd23a', '#9a5f08');
      solid(c, 'M-3 6H3V11H-3Z', '#e0a21a', '#9a5f08'); solid(c, 'M-9 11H9V16H-9Z', '#ffd23a', '#9a5f08'); break;
    case 'speed':
      c.translate(0, 2);
      thick(c, ['M-13 7.5A15 15 0 1 1 13 7.5', 'M0 4L8 -8'], M, 4.4);
      solid(c, circ(4.2, 0, 4), M); break;
  }
  c.restore();
}
