/**
 * Kitchen backdrops: each level theme is a place (home kitchen, pantry, stove corner, freezer) built from
 * three parallax layers of soft, desaturated, low-contrast prop silhouettes (UI_REVIEW.md §2.5).
 *
 * Performance: every static layer is painted ONCE per theme into an offscreen strip that tiles horizontally
 * (period SW px, 1x logical resolution). Per frame we only blit the strips (2 blits per row, wrap-around)
 * plus a handful of cheap animated bits (light shimmer, heat haze, mist, frost sparkle). No per-frame
 * gradients, no shadowBlur, no filters. Reduced motion: the animated bits are drawn static or skipped.
 */
import { CFG } from '../config';
import { reducedMotion } from '../ui/theme';

export type BackdropTheme = 'counter' | 'shelves' | 'stove' | 'fridge';

const W = 1280, H = 720;
const SW = 2048;                 // horizontal period of every strip (px)
const S = CFG.camera.ppm;        // world → screen scale used for parallax offsets
const CAM_Y0 = 1.2;              // camera y at a level start (spawn y 0 + 1.2): layers sit at their designed height here
const PAR = { wall: [0.15, 0.03], mid: [0.3, 0.2], near: [0.5, 0.35] } as const;   // [horizontal, vertical] parallax
const ANIM = { beamPulse: 0.6, motes: 9, hazeLines: 7, mistBlobs: 3, sparkles: 10 };

type G = CanvasRenderingContext2D;
type Rnd = () => number;
interface Layer { c: HTMLCanvasElement; f: number; fy: number; y0: number; lo: number; hi: number; rep: boolean; }
/** floor: y (near-layer design coords) above which a repeating row's shelf (at row-local `cut`) must stay */
interface Built { theme: BackdropTheme; layers: Layer[]; fx: HTMLCanvasElement[]; floor?: number; cut?: number; }

// ---------------- helpers ----------------
const mod = (a: number, n: number) => ((a % n) + n) % n;
const clamp = (v: number, lo: number, hi: number) => v < lo ? lo : v > hi ? hi : v;
function mk(w: number, h: number) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function rng(seed: number): Rnd { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (x: number, y: number) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
function rgb(h: string) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function mix(a: string, b: string, t: number) { const A = rgb(a), B = rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join(''); }
const dk = (c: string, k = 0.2) => mix(c, '#000000', k);         // outline: darker shade of the own colour
const lt = (c: string, k = 0.3) => mix(c, '#ffffff', k);
function rr(g: G, x: number, y: number, w: number, h: number, r: number) {
  r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
  g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
/** fill the current path and outline it in a darker shade of the same colour (low contrast) */
function fo(g: G, col: string, k = 0.16, lw = 3) { g.fillStyle = col; g.fill(); g.strokeStyle = dk(col, k); g.lineWidth = lw; g.lineJoin = 'round'; g.stroke(); }
/** full-width band (worktop, board, glass shelf) with darker top/bottom edges: seamless across the strip wrap */
function band(g: G, y: number, h: number, col: string, k = 0.16) { g.fillStyle = col; g.fillRect(0, y, SW, h); g.fillStyle = dk(col, k); g.fillRect(0, y, SW, 2); g.fillRect(0, y + h - 2, SW, 2); }
function hi(g: G, x: number, y: number, w: number, h: number, a = 0.4) { g.fillStyle = `rgba(255,255,255,${a})`; rr(g, x, y, w, h, Math.min(w, h) / 2); g.fill(); }
function ell(g: G, x: number, y: number, rx: number, ry: number) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); }

/** paint a periodic layer: paint() is called at the neighbouring periods so props crossing an edge wrap */
function layer(h: number, y0: number, par: readonly [number, number], lo: number, hi: number, rep: boolean, seed: number, paint: (g: G, r: Rnd) => void, haze?: [string, number]): Layer {
  const c = mk(SW, h), g = c.getContext('2d')!;
  // own period first, neighbours after: their full-width fills land off-canvas, only their overflow wraps in
  const dys = rep ? [0, -h, h] : [0];
  for (const dy of dys) for (const dx of [0, -SW, SW]) { g.save(); g.translate(dx, dy - y0); paint(g, rng(seed)); g.restore(); }
  if (haze) { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = haze[1]; g.fillStyle = haze[0]; g.fillRect(0, 0, SW, h); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over'; }
  return { c, f: par[0], fy: par[1], y0, lo, hi, rep };
}

// ---------------- props (shared) ----------------
function jar(g: G, x: number, by: number, w: number, h: number, content: string, lid: string, glass = '#e9ece4') {
  const lh = Math.max(8, h * 0.14);
  rr(g, x, by - h + lh - 3, w, h - lh + 3, w * 0.24); fo(g, glass, 0.12);
  rr(g, x + 4, by - (h - lh) * 0.7, w - 8, (h - lh) * 0.7 - 4, w * 0.2); g.fillStyle = content; g.fill();
  g.fillStyle = dk(content, 0.12); g.fillRect(x + 4, by - 12, w - 8, 6);
  rr(g, x + w * 0.06, by - h, w * 0.88, lh, 3); fo(g, lid);
  hi(g, x + w * 0.16, by - h + lh + 6, Math.max(4, w * 0.12), h * 0.45, 0.45);
}
function can(g: G, x: number, by: number, w: number, h: number, col: string, band: string) {
  rr(g, x, by - h, w, h, 4); fo(g, '#c9c8c2', 0.16);
  g.fillStyle = col; g.fillRect(x + 2, by - h * 0.78, w - 4, h * 0.56);
  g.fillStyle = band; g.fillRect(x + 2, by - h * 0.56, w - 4, h * 0.12);
  hi(g, x + 5, by - h + 4, 4, h - 8, 0.35);
}
function bottle(g: G, x: number, by: number, w: number, h: number, col: string, cap: string) {
  const nw = w * 0.36, sh = h * 0.62;
  g.beginPath(); g.moveTo(x + w * 0.25, by); g.arcTo(x, by, x, by - sh, w * 0.24); g.lineTo(x, by - sh + w * 0.3);
  g.quadraticCurveTo(x, by - sh - w * 0.2, x + (w - nw) / 2, by - h * 0.82); g.lineTo(x + (w - nw) / 2, by - h + 8); g.lineTo(x + (w + nw) / 2, by - h + 8); g.lineTo(x + (w + nw) / 2, by - h * 0.82);
  g.quadraticCurveTo(x + w, by - sh - w * 0.2, x + w, by - sh + w * 0.3); g.arcTo(x + w, by, x + w * 0.75, by, w * 0.24); g.closePath(); fo(g, col, 0.15);
  rr(g, x + (w - nw) / 2 - 1, by - h, nw + 2, 10, 3); fo(g, cap);
  hi(g, x + w * 0.18, by - sh + 6, 5, sh - 16, 0.4);
}
function carton(g: G, x: number, by: number, w: number, h: number, col: string, band: string) {
  const roof = w * 0.42;
  g.beginPath(); g.moveTo(x, by); g.lineTo(x, by - h + roof); g.lineTo(x + w / 2, by - h + 6); g.lineTo(x + w, by - h + roof); g.lineTo(x + w, by); g.closePath(); fo(g, col, 0.14);
  rr(g, x + w / 2 - 4, by - h, 8, 10, 2); fo(g, col, 0.14);
  g.fillStyle = band; g.fillRect(x + 2, by - h * 0.5, w - 4, h * 0.22);
  g.fillStyle = 'rgba(60,80,100,.08)'; g.fillRect(x + w * 0.62, by - h + roof, w * 0.38 - 2, h - roof - 2);
}
function pot(g: G, x: number, by: number, w: number, h: number, col: string) {
  rr(g, x - 12, by - h * 0.78, 16, 10, 5); fo(g, dk(col, 0.1)); rr(g, x + w - 4, by - h * 0.78, 16, 10, 5); fo(g, dk(col, 0.1));
  rr(g, x, by - h, w, h, 12); fo(g, col);
  g.fillStyle = dk(col, 0.12); g.fillRect(x + 3, by - h * 0.3, w - 6, h * 0.3 - 4);
  rr(g, x - 4, by - h - 8, w + 8, 12, 6); fo(g, lt(col, 0.1));
  ell(g, x + w / 2, by - h - 12, 10, 6); fo(g, dk(col, 0.15));
  hi(g, x + 10, by - h + 8, w * 0.35, 6, 0.35);
}
function sack(g: G, x: number, by: number, w: number, h: number, col: string, mark: string) {
  g.beginPath(); g.moveTo(x + w * 0.1, by); g.quadraticCurveTo(x - w * 0.06, by - h * 0.5, x + w * 0.22, by - h * 0.86);
  g.lineTo(x + w * 0.4, by - h * 0.8); g.lineTo(x + w * 0.36, by - h); g.lineTo(x + w * 0.64, by - h); g.lineTo(x + w * 0.6, by - h * 0.8); g.lineTo(x + w * 0.78, by - h * 0.86);
  g.quadraticCurveTo(x + w * 1.06, by - h * 0.5, x + w * 0.9, by); g.closePath(); fo(g, col, 0.18);
  g.strokeStyle = dk(col, 0.25); g.lineWidth = 4; g.beginPath(); g.moveTo(x + w * 0.36, by - h * 0.8); g.lineTo(x + w * 0.64, by - h * 0.8); g.stroke();
  // stencilled wheat ear
  g.strokeStyle = mark; g.lineWidth = 3; g.lineCap = 'round'; const cx = x + w / 2, cy = by - h * 0.38;
  g.beginPath(); g.moveTo(cx, cy + h * 0.2); g.lineTo(cx, cy - h * 0.18); g.stroke(); g.fillStyle = mark;
  for (let i = 0; i < 3; i++) for (const s of [-1, 1]) { ell(g, cx + s * 7, cy - h * 0.12 + i * h * 0.1, 5, 8); g.fill(); }
  g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(x + w * 0.55, by - h * 0.7, w * 0.3, h * 0.66);
}
function hook(g: G, x: number, y: number, col: string) { g.strokeStyle = col; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y - 6); g.lineTo(x, y + 6); g.arc(x + 4, y + 8, 4, Math.PI, 0, true); g.stroke(); }
function ladle(g: G, x: number, y: number, col: string) {
  g.strokeStyle = dk(col, 0.16); g.lineWidth = 9; g.lineCap = 'round'; g.beginPath(); g.moveTo(x, y + 6); g.lineTo(x, y + 100); g.stroke();
  g.strokeStyle = col; g.lineWidth = 5; g.stroke();
  g.beginPath(); g.moveTo(x - 22, y + 100); g.arc(x, y + 100, 22, Math.PI, 0, true); g.closePath(); fo(g, col);
  ell(g, x, y + 10, 5, 5); fo(g, col);
}
function whisk(g: G, x: number, y: number, col: string, handle: string) {
  rr(g, x - 6, y + 4, 12, 46, 6); fo(g, handle);
  g.strokeStyle = dk(col, 0.1); g.lineWidth = 2.5;
  for (const rx of [5, 11, 17]) { ell(g, x, y + 86, rx, 38); g.stroke(); }
}
function spatula(g: G, x: number, y: number, col: string, handle: string) {
  rr(g, x - 6, y + 4, 12, 56, 6); fo(g, handle);
  g.fillStyle = dk(col, 0.1); g.fillRect(x - 2, y + 58, 4, 14);
  rr(g, x - 18, y + 70, 36, 50, 7); fo(g, col);
  g.fillStyle = dk(col, 0.14); for (let i = -1; i <= 1; i++) { rr(g, x + i * 10 - 2, y + 78, 4, 30, 2); g.fill(); }
}
function pan(g: G, x: number, y: number, r: number, col: string, handle: string) {
  rr(g, x - 7, y + 2, 14, r * 1.3, 7); fo(g, handle);
  ell(g, x, y + r * 1.3 + r - 4, r, r); fo(g, col, 0.18, 4);
  ell(g, x, y + r * 1.3 + r - 4, r * 0.72, r * 0.72); g.fillStyle = dk(col, 0.1); g.fill();
  hi(g, x - r * 0.6, y + r * 1.3 + r * 0.3, 6, r * 0.6, 0.18);
}
function saucepan(g: G, x: number, y: number, w: number, col: string) {
  rr(g, x - 6, y + 2, 12, 56, 6); fo(g, dk(col, 0.1));
  rr(g, x - w / 2, y + 56, w, w * 0.7, 10); fo(g, col);
  g.fillStyle = dk(col, 0.1); g.fillRect(x - w / 2 + 3, y + 56 + w * 0.48, w - 6, w * 0.2);
  hi(g, x - w / 2 + 8, y + 64, 6, w * 0.35, 0.3);
}

// ---------------- counter: home kitchen ----------------
const KC = { wall: '#efe3cf', tileA: '#f1e6d3', tileB: '#e9dcc4', grout: '#dccab0', teal: '#a9bfb6', terra: '#d6ab8e', cab: '#cfae8c', frame: '#dcc7a8', glass: '#e2ecea', steel: '#b9b8b2', wood: '#c9a17a', top: '#e6d8c2' };

function counterWall(g: G) {
  g.fillStyle = KC.grout; g.fillRect(0, -64, SW, 860);
  // backsplash: slightly uneven hand-made tiles, a decorative border row, a few patterned tiles
  for (let ty = 214; ty < 800; ty += 64) for (let tx = 0; tx < SW; tx += 64) {
    const v = hash(tx, ty), j = (hash(ty, tx) - 0.5) * 1.2;
    g.fillStyle = mix(KC.tileA, KC.tileB, v); rr(g, tx + 2 + j, ty + 2, 60, 60, 4); g.fill();
    g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(tx + 6, ty + 5, 50, 3);
    g.fillStyle = 'rgba(140,100,60,.05)'; g.fillRect(tx + 3, ty + 54, 58, 7);
    if (v > 0.9) { g.save(); g.translate(tx + 32, ty + 32); g.globalAlpha = 0.55;
      for (let k = 0; k < 4; k++) { g.rotate(Math.PI / 2); ell(g, 0, -12, 6, 11); g.fillStyle = v > 0.95 ? KC.teal : KC.terra; g.fill(); }
      ell(g, 0, 0, 5, 5); g.fillStyle = KC.terra; g.fill(); g.restore(); }
  }
  for (let tx = 0; tx < SW; tx += 32) { // border row of small diamond tiles
    g.fillStyle = mix(KC.tileA, KC.teal, 0.25); rr(g, tx + 1.5, 184, 29, 28, 3); g.fill();
    g.fillStyle = mix(KC.tileA, KC.terra, 0.55); g.beginPath(); g.moveTo(tx + 16, 189); g.lineTo(tx + 25, 198); g.lineTo(tx + 16, 207); g.lineTo(tx + 7, 198); g.closePath(); g.fill();
  }
  // upper cabinets with a gap for the window
  const wx = 744, ww = 368;
  g.fillStyle = KC.wall; g.fillRect(0, -64, SW, 248);
  for (const [x0, x1] of [[wx + ww + 40, SW + wx - 40]]) {
    const n = Math.round((x1 - x0) / 124), dw = (x1 - x0) / n;
    g.fillStyle = dk(KC.cab, 0.08); g.fillRect(x0, -64, x1 - x0, 238);
    for (let i = 0; i < n; i++) { const dx = x0 + i * dw + 3, w = dw - 6;
      rr(g, dx, -54, w, 218, 10); fo(g, KC.cab, 0.12);
      rr(g, dx + 14, -36, w - 28, 182, 8); g.strokeStyle = lt(KC.cab, 0.25); g.lineWidth = 3; g.stroke();
      g.fillStyle = 'rgba(120,80,40,.06)'; g.fillRect(dx + 14, 120, w - 28, 26);
      rr(g, dx + (i % 2 ? 12 : w - 20), 120, 8, 30, 4); fo(g, '#d9c08c', 0.2); }
    g.fillStyle = 'rgba(130,90,50,.10)'; g.fillRect(x0, 174, x1 - x0, 10);
  }
  // window with valance, sill and a little plant
  rr(g, wx, 8, ww, 316, 12); fo(g, KC.frame, 0.12, 4);
  const gl = g.createLinearGradient(0, 24, 0, 300); gl.addColorStop(0, '#dfeef2'); gl.addColorStop(1, '#f3efe0'); g.fillStyle = gl; g.fillRect(wx + 16, 24, ww - 32, 284);
  g.fillStyle = '#d5e2d6'; for (let i = 0; i < 6; i++) { ell(g, wx + 40 + i * 60, 300, 46, 34 + (i % 3) * 14); g.fill(); }   // far trees
  g.fillStyle = '#e3e6dc'; g.fillRect(wx + 16, 288, ww - 32, 20);
  g.fillStyle = KC.frame; g.fillRect(wx + ww / 2 - 6, 24, 12, 284); g.fillRect(wx + 16, 150, ww - 32, 10);
  g.fillStyle = '#e2c3b0'; g.beginPath(); g.moveTo(wx - 10, 4); g.lineTo(wx + ww + 10, 4); g.lineTo(wx + ww + 10, 52);
  for (let i = 7; i >= 0; i--) { const sx = wx - 10 + (ww + 20) * i / 8; g.quadraticCurveTo(sx + (ww + 20) / 16, 70, sx, 52); }
  g.closePath(); fo(g, '#e2c3b0', 0.1);
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 6; for (let i = 0; i < 9; i++) { const sx = wx + 10 + i * 44; g.beginPath(); g.moveTo(sx, 8); g.lineTo(sx, 46); g.stroke(); }
  rr(g, wx - 18, 320, ww + 36, 18, 6); fo(g, KC.frame, 0.12);
  rr(g, wx + 40, 278, 40, 40, 8); fo(g, KC.terra, 0.15);
  g.fillStyle = '#a7bc9c'; for (const [lx, ly, a] of [[60, 262, -0.5], [52, 252, -1.1], [68, 248, 0.3], [76, 262, 0.8]] as const) { g.save(); g.translate(wx + lx, ly); g.rotate(a); ell(g, 0, 0, 7, 18); g.restore(); g.fill(); }
}
function counterRails(g: G, r: Rnd) {
  for (const [x0, x1] of [[90, 640], [1230, 1900]]) {
    rr(g, x0, 230, x1 - x0, 8, 4); fo(g, KC.steel, 0.15); ell(g, x0, 234, 7, 7); fo(g, KC.steel); ell(g, x1, 234, 7, 7); fo(g, KC.steel);
    let k = Math.floor(r() * 4);
    for (let x = x0 + 50; x < x1 - 30; x += 78 + r() * 14) {
      hook(g, x, 238, dk(KC.steel, 0.1)); const y = 246;
      switch (k++ % 6) {
        case 0: ladle(g, x, y, KC.steel); break;
        case 1: whisk(g, x, y, KC.steel, KC.wood); break;
        case 2: spatula(g, x, y, '#c7c3b8', KC.wood); break;
        case 3: pan(g, x, y, 34, '#9a9792', '#7e756d'); break;
        case 4: { rr(g, x - 5, y + 4, 10, 70, 5); fo(g, KC.wood); ell(g, x, y + 92, 12, 22); fo(g, KC.wood); break; }   // wooden spoon
        default: { rr(g, x - 20, y + 10, 40, 80, 8); fo(g, '#c7c3b8'); g.fillStyle = dk('#c7c3b8', 0.12); for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) g.fillRect(x - 13 + j * 10, y + 24 + i * 15, 6, 4); break; } // grater
      }
    }
  }
}
function counterBack(g: G, r: Rnd) {
  g.fillStyle = KC.wood; g.fillRect(0, 612, SW, 260);
  for (let x = 0; x < SW; x += 204) { rr(g, x + 8, 630, 188, 230, 10); fo(g, mix(KC.wood, KC.wall, 0.15), 0.14); rr(g, x + 92, 650, 20, 8, 4); fo(g, '#d9c08c', 0.2); }
  band(g, 596, 20, KC.top, 0.14); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(0, 598, SW, 3);
  const spice = ['#c9845e', '#d6b25e', '#a9b46e', '#b6726a'];
  const group = (x: number) => { for (let i = 0; i < 3; i++) jar(g, x + i * 46, 596, 40, 56 + ((i * 17) % 30), spice[(i + Math.floor(x)) % 4], '#c79f78'); };
  group(110); group(1420);
  pot(g, 470, 596, 150, 96, '#b9afa6');
  g.save(); g.translate(860, 596); g.rotate(-0.12); rr(g, 0, -170, 120, 170, 22); fo(g, '#d7b48a', 0.14); ell(g, 60, -146, 9, 9); g.fillStyle = KC.wall; g.fill(); g.restore();
  bottle(g, 1020, 596, 44, 150, '#d9c47e', '#a99a6a');
  // kettle
  ell(g, 1250, 556, 58, 42); fo(g, '#b7c2bd'); g.fillRect(1192, 556, 116, 40); rr(g, 1192, 550, 116, 46, 10); fo(g, '#b7c2bd');
  g.strokeStyle = dk('#b7c2bd', 0.2); g.lineWidth = 6; g.beginPath(); g.arc(1250, 520, 34, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
  g.beginPath(); g.moveTo(1306, 570); g.lineTo(1336, 540); g.lineTo(1340, 548); g.lineTo(1308, 586); g.closePath(); fo(g, '#b7c2bd');
  // fruit bowl
  for (let i = 0; i < 4; i++) { ell(g, 1740 + i * 30 - 10 * (i % 2), 560 - (i % 2) * 14, 18, 17); fo(g, i % 2 ? '#e0bf6e' : '#cc8a70'); }
  g.beginPath(); g.moveTo(1700, 566); g.lineTo(1860, 566); g.quadraticCurveTo(1850, 600, 1780, 600); g.quadraticCurveTo(1710, 600, 1700, 566); g.closePath(); fo(g, '#a9bfb6');
  void r;
}

// ---------------- shelves: pantry ----------------
const PC = { wall: '#e8dec8', board: '#c79a6c', boardDk: '#a87b52', panel: '#cfab84', red: '#c98c7c', green: '#a5b38a', honey: '#dcb46a', cream: '#efe5d1', sack: '#d4bc96' };

function pantryWall(g: G, r: Rnd) {
  g.fillStyle = PC.wall; g.fillRect(0, -64, SW, 860);
  for (let i = 0; i < 420; i++) { const x = r() * SW, y = -64 + r() * 860, s = 6 + r() * r() * 60; g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,.06)' : 'rgba(150,110,70,.03)'; ell(g, x, y, s, s * (0.5 + r() * 0.4)); g.fill(); }
  // calendar (no text: header band, ring dots, day grid, one ringed day)
  const cx = 330, cy = 70;
  ell(g, cx + 85, cy - 8, 4, 4); g.fillStyle = PC.boardDk; g.fill();
  rr(g, cx, cy, 170, 226, 8); fo(g, '#f4ecdc', 0.12);
  g.fillStyle = PC.red; g.fillRect(cx + 3, cy + 3, 164, 52);
  g.fillStyle = lt(PC.red, 0.35); ell(g, cx + 85, cy + 30, 18, 14); g.fill();
  for (let i = 0; i < 7; i++) { ell(g, cx + 22 + i * 21, cy + 2, 3, 6); g.fillStyle = '#b6a48a'; g.fill(); }
  g.fillStyle = '#ddd1bb'; for (let row = 0; row < 5; row++) for (let col = 0; col < 7; col++) g.fillRect(cx + 14 + col * 21, cy + 72 + row * 29, 15, 20);
  g.strokeStyle = PC.red; g.lineWidth = 3; ell(g, cx + 14 + 4 * 21 + 7.5, cy + 72 + 2 * 29 + 10, 13, 13); g.stroke();
  // framed still life: a pepper
  const fx = 1350, fy = 90;
  rr(g, fx, fy, 200, 150, 8); fo(g, PC.board, 0.18, 4); g.fillStyle = '#e4e3cf'; g.fillRect(fx + 14, fy + 14, 172, 122);
  g.save(); g.translate(fx + 100, fy + 80); g.rotate(-0.4); ell(g, 0, 0, 52, 22); fo(g, '#d39a84', 0.12); g.fillStyle = '#a5b38a'; g.fillRect(48, -6, 20, 10); g.restore();
  // small vent high on the wall
  rr(g, 1700, 40, 120, 70, 8); fo(g, '#ddd2bb', 0.12); g.fillStyle = '#cbbfa6'; for (let i = 0; i < 5; i++) g.fillRect(1712, 52 + i * 11, 96, 5);
}
function pantryShelves(g: G, r: Rnd) {
  // vertically repeating (period 400): one shelf row per period, onion strings in the gaps
  const segs = [[40, 900], [1130, 1990]];
  const jarsC = [PC.green, PC.red, PC.honey, '#c58a5c'];
  for (const [x0, x1] of segs) {
    let x = x0 + 18;
    while (x < x1 - 70) {
      const k = r();
      if (k < 0.35) { const w = 44 + r() * 18; jar(g, x, 340, w, 70 + r() * 40, jarsC[Math.floor(r() * 4)], '#bf9a74'); x += w + 10; }
      else if (k < 0.6) { const w = 38; const n = 1 + Math.floor(r() * 3), col = r() < 0.5 ? '#c99b86' : '#a9b7a0'; for (let i = 0; i < n; i++) can(g, x, 340 - i * 50, w, 50, col, PC.cream); x += w + 10; }
      else if (k < 0.82) { const w = 60 + r() * 20, h = 100 + r() * 30, col = r() < 0.5 ? '#d8c08e' : '#bcc6b4'; rr(g, x, 340 - h, w, h, 4); fo(g, col, 0.14);
        g.fillStyle = lt(col, 0.3); ell(g, x + w / 2, 340 - h * 0.55, w * 0.28, w * 0.28); g.fill(); g.fillStyle = 'rgba(0,0,0,.05)'; g.fillRect(x + w * 0.66, 340 - h + 2, w * 0.32, h - 4); x += w + 10; }
      else { const w = 34; bottle(g, x, 340, w, 120 + r() * 20, r() < 0.5 ? '#c8b07a' : '#b88577', '#9f8a6a'); x += w + 12; }
    }
    // board + brackets
    rr(g, x0, 340, x1 - x0, 16, 3); fo(g, PC.board, 0.16); g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(x0 + 4, 342, x1 - x0 - 8, 3);
    for (const bx of [x0 + 40, x1 - 60]) { g.beginPath(); g.moveTo(bx, 356); g.lineTo(bx + 20, 356); g.lineTo(bx + 20, 390); g.closePath(); fo(g, PC.boardDk, 0.15); }
  }
  // onion & garlic strings hanging from pegs in the gaps
  for (const ox of [985, 1050, 2020]) {
    ell(g, ox, 20, 6, 6); fo(g, PC.boardDk);
    g.strokeStyle = '#b89d72'; g.lineWidth = 3; g.beginPath(); g.moveTo(ox, 24); g.lineTo(ox, 250); g.stroke();
    const onion = ox === 1050 ? '#e8e0cc' : '#cf9a6c';
    for (let i = 0; i < 7; i++) { const y = 60 + i * 28, s = i % 2 ? 1 : -1; ell(g, ox + s * 12, y, 15, 14); fo(g, onion, 0.15); g.fillStyle = 'rgba(255,255,255,.25)'; ell(g, ox + s * 12 - 5, y - 4, 4, 5); g.fill(); }
  }
}
function pantryFloor(g: G) {
  // wainscot boards (part of this layer so they slide away when climbing)
  g.fillStyle = PC.panel; g.fillRect(0, 520, SW, 360);
  for (let x = 0; x < SW; x += 64) { g.fillStyle = mix(PC.panel, PC.boardDk, hash(x, 3) * 0.25); g.fillRect(x + 2, 534, 60, 340); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 4, 538, 4, 330); }
  band(g, 514, 22, PC.board, 0.14);
  g.fillStyle = '#b89470'; g.fillRect(0, 676, SW, 200); g.fillStyle = 'rgba(255,255,255,.12)'; g.fillRect(0, 676, SW, 4);
  sack(g, 80, 690, 140, 170, PC.sack, '#c0a47c'); sack(g, 200, 694, 120, 140, lt(PC.sack, 0.08), '#c0a47c');
  // crate of potatoes
  const crate = (x: number) => {
    for (let i = 0; i < 6; i++) { ell(g, x + 24 + i * 30, 594 - (i % 2) * 8, 20, 16); fo(g, '#c9a27a', 0.15); }
    rr(g, x, 596, 200, 96, 6); fo(g, '#c49a6e', 0.16); g.fillStyle = dk('#c49a6e', 0.12); for (let i = 0; i < 3; i++) g.fillRect(x + 6, 616 + i * 26, 188, 6);
  };
  crate(560); crate(1520);
  jar(g, 900, 694, 110, 180, PC.green, '#bf9a74');
  sack(g, 1180, 690, 150, 180, PC.sack, '#c0a47c');
  sack(g, 1830, 692, 130, 150, lt(PC.sack, 0.06), '#c0a47c');
}

// ---------------- stove: hot corner ----------------
const SC = { tileA: '#3b3a41', tileB: '#413f46', grout: '#323137', hood: '#64666d', copper: '#8a6553', iron: '#4b4a50', steel: '#6d7078', top: '#2c2c32' };

function stoveWall(g: G) {
  g.fillStyle = SC.grout; g.fillRect(0, -64, SW, 860);
  for (let row = 0, ty = -64; ty < 800; ty += 34, row++) for (let tx = (row % 2) * -32; tx < SW; tx += 64) {
    const v = hash(tx + 7, ty);
    g.fillStyle = mix(SC.tileA, SC.tileB, v); rr(g, tx + 2, ty + 2, 60, 30, 5); g.fill();
    g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(tx + 6, ty + 5, 52, 3);
  }
  // range hood with chimney and warm lamps
  const hx = 600, hw = 520;
  rr(g, hx + 180, -70, 160, 140, 4); fo(g, SC.hood, 0.18);
  g.beginPath(); g.moveTo(hx + 90, 60); g.lineTo(hx + hw - 90, 60); g.lineTo(hx + hw, 176); g.lineTo(hx, 176); g.closePath(); fo(g, SC.hood, 0.18);
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.moveTo(hx + 110, 64); g.lineTo(hx + 150, 64); g.lineTo(hx + 70, 172); g.lineTo(hx + 30, 172); g.closePath(); g.fill();
  rr(g, hx - 10, 172, hw + 20, 22, 6); fo(g, lt(SC.hood, 0.08), 0.2);
  for (const lx of [hx + 150, hx + hw - 150]) { const gr = g.createRadialGradient(lx, 196, 2, lx, 196, 120); gr.addColorStop(0, 'rgba(255,190,120,.22)'); gr.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = gr; g.fillRect(lx - 120, 196, 240, 130); ell(g, lx, 196, 14, 5); g.fillStyle = '#e8c48e'; g.fill(); }
  // spice shelf
  rr(g, 1380, 236, 420, 12, 3); fo(g, '#5a4a42', 0.2);
  for (let i = 0; i < 8; i++) jar(g, 1396 + i * 50, 236, 36, 48 + (i % 3) * 8, ['#7a5a4a', '#6d6a4c', '#7e4c44'][i % 3], '#55504c', '#57565c');
}
function stovePans(g: G, r: Rnd) {
  for (const [x0, x1] of [[40, 560], [1240, 2000]]) {
    rr(g, x0, 232, x1 - x0, 8, 4); fo(g, SC.steel, 0.2);
    let k = Math.floor(r() * 3);
    for (let x = x0 + 54; x < x1 - 40; x += 96 + r() * 20) {
      hook(g, x, 240, SC.steel); const y = 248;
      switch (k++ % 5) {
        case 0: pan(g, x, y, 44, SC.iron, '#3c3b40'); break;
        case 1: saucepan(g, x, y, 70, SC.copper); break;
        case 2: pan(g, x, y, 32, SC.copper, '#6e5040'); break;
        case 3: ladle(g, x, y, SC.steel); break;
        default: spatula(g, x, y, SC.steel, '#5a4436'); break;
      }
    }
  }
}
function stoveBack(g: G) {
  g.fillStyle = '#35343a'; g.fillRect(0, 612, SW, 260);
  const range = (x: number, w: number) => {
    rr(g, x, 612, w, 260, 6); fo(g, '#3e3e45', 0.2);
    rr(g, x + 12, 620, w - 24, 34, 6); fo(g, '#46464d', 0.2);
    for (let i = 0; i < 5; i++) { ell(g, x + 40 + i * (w - 80) / 4, 637, 9, 9); fo(g, '#6a6a72', 0.2); }
    rr(g, x + 30, 672, w - 60, 170, 10); fo(g, '#2f2f35', 0.25);
    rr(g, x + 60, 694, w - 120, 70, 8); g.fillStyle = '#4a352d'; g.fill();   // oven window with a faint glow
    g.fillStyle = 'rgba(255,140,60,.18)'; rr(g, x + 66, 740, w - 132, 20, 6); g.fill();
  };
  range(180, 520); range(1260, 520);
  band(g, 596, 20, SC.top, 0.2); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(0, 598, SW, 3);
  // grates + pots on top
  for (const x0 of [180, 1260]) for (let i = 0; i < 2; i++) { g.strokeStyle = '#4c4c54'; g.lineWidth = 5; g.beginPath(); g.moveTo(x0 + 40 + i * 250, 594); g.lineTo(x0 + 230 + i * 250, 594); g.stroke(); }
  pot(g, 240, 590, 170, 130, SC.steel);
  pot(g, 520, 590, 110, 70, SC.copper);
  pot(g, 1340, 590, 130, 96, SC.iron);
  g.strokeStyle = '#4c4c54'; g.lineWidth = 6; g.beginPath(); g.moveTo(1560, 588); g.lineTo(1700, 588); g.stroke();
  ell(g, 1630, 580, 70, 10); fo(g, SC.iron); rr(g, 1696, 574, 80, 12, 6); fo(g, '#3c3b40');
  // wooden utensil crock
  rr(g, 940, 520, 70, 76, 10); fo(g, '#6d5a50', 0.2);
  for (const [dx, a] of [[14, -0.2], [32, 0.05], [52, 0.25]] as const) { g.save(); g.translate(940 + dx, 524); g.rotate(a); rr(g, -4, -90, 8, 90, 4); fo(g, '#7d6250'); ell(g, 0, -96, 9, 14); fo(g, '#7d6250'); g.restore(); }
}

// ---------------- fridge: freezer ----------------
const FC = { wall: '#e3eef5', rib: '#d3e3ee', glass: '#d8ebf5', edge: '#b3d0e0', milk: '#f3f6f8', blue: '#9fc2da', juice: '#e7c79a', green: '#b2cdb0', red: '#dba7a2', cheese: '#ecd79a' };

function fridgeWall(g: G) {
  const gr = g.createLinearGradient(0, -64, 0, 796); gr.addColorStop(0, '#f1f7fb'); gr.addColorStop(0.5, FC.wall); gr.addColorStop(1, '#d4e4ef');
  g.fillStyle = gr; g.fillRect(0, -64, SW, 860);
  for (let x = 0; x < SW; x += 32) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x, -64, 3, 860); g.fillStyle = 'rgba(120,160,190,.07)'; g.fillRect(x + 3, -64, 2, 860); }
  for (let x = 0; x < SW; x += 512) { g.fillStyle = 'rgba(110,150,180,.12)'; g.fillRect(x, -64, 6, 860); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(x + 6, -64, 3, 860); }
  // cold light bar with soft halo
  for (const lx of [700, 1724]) {
    const h = g.createRadialGradient(lx, 10, 10, lx, 10, 380); h.addColorStop(0, 'rgba(255,255,255,.55)'); h.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = h; g.fillRect(lx - 380, -64, 760, 460);
    rr(g, lx - 160, 0, 320, 22, 11); fo(g, '#fbfdff', 0.08);
  }
}
function fridgeShelves(g: G, r: Rnd) {
  // vertically repeating (period 400): a frosted glass shelf with groceries
  let x = 20;
  while (x < SW - 90) {
    const k = r();
    if (k < 0.25) { const w = 46; bottle(g, x, 330, w, 150 + r() * 20, [FC.juice, FC.blue, FC.green][Math.floor(r() * 3)], '#c8d3dc'); x += w + 14; }
    else if (k < 0.47) { const w = 64; carton(g, x, 330, w, 136, FC.milk, FC.blue); x += w + 14; }
    else if (k < 0.62) { const n = 2 + Math.floor(r() * 2); for (let i = 0; i < n; i++) { rr(g, x + i * 40, 284, 34, 46, 6); fo(g, '#f2f2ee', 0.12); g.fillStyle = [FC.red, FC.blue, FC.cheese][i % 3]; g.fillRect(x + i * 40 + 2, 284, 30, 8); } x += n * 40 + 14; }
    else if (k < 0.75) { const w = 160; rr(g, x, 300, w, 30, 5); fo(g, '#e6e0d2', 0.12); for (let i = 0; i < 5; i++) { ell(g, x + 18 + i * 31, 296, 13, 16); fo(g, '#f2ead8', 0.1); } x += w + 14; }
    else if (k < 0.87) { const w = 56; jar(g, x, 330, w, 86, FC.red, '#c3d0d8', '#eef4f7'); x += w + 14; }
    else { g.beginPath(); g.moveTo(x, 330); g.lineTo(x + 110, 330); g.lineTo(x + 110, 280); g.closePath(); fo(g, FC.cheese, 0.12); g.fillStyle = dk(FC.cheese, 0.08); ell(g, x + 80, 316, 6, 5); g.fill(); ell(g, x + 98, 300, 4, 4); g.fill(); x += 124; }
  }
  // frosted glass shelf
  g.fillStyle = 'rgba(214,234,246,.85)'; g.fillRect(0, 330, SW, 14); g.fillStyle = FC.edge; g.fillRect(0, 342, SW, 2);
  g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(0, 331, SW, 3);
  for (let i = 0; i < 90; i++) { g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(r() * SW, 336 + r() * 6, 2 + r() * 6, 2); }
  for (let bx = 100; bx < SW; bx += 512) { rr(g, bx, 344, 24, 20, 4); fo(g, '#cddfea', 0.12); }
}
function fridgeDrawer(g: G) {
  const veg = (x: number) => {
    for (let i = 0; i < 3; i++) { ell(g, x + 60 + i * 60, 600, 40, 36); fo(g, '#b9d1a8', 0.15); }               // lettuce
    for (let i = 0; i < 4; i++) { ell(g, x + 270 + i * 46, 610, 24, 22); fo(g, '#dca59c', 0.12); }             // tomatoes
    for (let i = 0; i < 3; i++) { g.save(); g.translate(x + 500 + i * 34, 620); g.rotate(-0.5 + i * 0.25); g.beginPath(); g.moveTo(-10, 0); g.lineTo(10, 0); g.lineTo(0, -90); g.closePath(); fo(g, '#e2b58a', 0.12); g.restore(); }
    rr(g, x + 640, 580, 220, 60, 30); fo(g, '#c9d9a6', 0.15);                                                  // cucumber pile
  };
  veg(60); veg(1084);
  for (const x of [20, 1044]) {
    rr(g, x, 600, 984, 280, 18); g.fillStyle = 'rgba(222,238,248,.78)'; g.fill(); g.strokeStyle = FC.edge; g.lineWidth = 3; g.stroke();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(x + 20, 606, 944, 4);
    rr(g, x + 392, 626, 200, 18, 9); fo(g, '#c6dbe8', 0.14);
    g.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 3; i++) { g.save(); g.translate(x + 120 + i * 300, 700); g.rotate(-0.6); g.fillRect(0, 0, 10, 90); g.restore(); }
  }
}

// ---------------- screen-space extras ----------------
function frostCorner(): HTMLCanvasElement {
  const c = mk(380, 300), g = c.getContext('2d')!, r = rng(77);
  const gr = g.createRadialGradient(0, 0, 10, 0, 0, 300); gr.addColorStop(0, 'rgba(250,253,255,.75)'); gr.addColorStop(0.45, 'rgba(235,246,252,.35)'); gr.addColorStop(1, 'rgba(235,246,252,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 380, 300);
  g.strokeStyle = 'rgba(255,255,255,.4)'; g.lineCap = 'round';
  const branch = (x: number, y: number, a: number, len: number, d: number) => {
    if (d > 4 || len < 6) return;
    const x2 = x + Math.cos(a) * len, y2 = y + Math.sin(a) * len; g.lineWidth = Math.max(1, 3 - d * 0.6);
    g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
    for (let i = 1; i <= 3; i++) { const t = i / 4, bx = x + (x2 - x) * t, by = y + (y2 - y) * t; branch(bx, by, a + (i % 2 ? 0.8 : -0.8) + (r() - 0.5) * 0.3, len * 0.38, d + 1); }
    branch(x2, y2, a + (r() - 0.5) * 0.5, len * 0.6, d + 1);
  };
  for (let i = 0; i < 5; i++) branch(0, 0, 0.12 + i * 0.3 + (r() - 0.5) * 0.1, 110 + r() * 80, 0);
  return c;
}
function softBlob(col: string, a: number): HTMLCanvasElement {
  const c = mk(256, 256), g = c.getContext('2d')!;
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128); gr.addColorStop(0, `rgba(${col},${a})`); gr.addColorStop(1, `rgba(${col},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256); return c;
}
/** light shafts, in wall coordinates: top edge x..x+top at y, slanting down-right by `slant` over h px */
const BEAMS = { counter: { x: 760, y: 30, top: 340, slant: 300, h: 700, a: 1 }, shelves: { x: 1705, y: 100, top: 110, slant: 260, h: 560, a: 0.8 } };
function beam(b: typeof BEAMS.counter): HTMLCanvasElement {
  const c = mk(b.top + b.slant, b.h), g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, b.h); gr.addColorStop(0, 'rgba(255,246,220,.30)'); gr.addColorStop(0.6, 'rgba(255,246,220,.10)'); gr.addColorStop(1, 'rgba(255,246,220,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.lineTo(b.top, 0); g.lineTo(b.top + b.slant, b.h); g.lineTo(b.slant, b.h); g.closePath(); g.fill();
  return c;
}
function bottomGlow(rgbStr: string, a: number, h: number): HTMLCanvasElement {
  const c = mk(64, h), g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, h, 0, 0); gr.addColorStop(0, `rgba(${rgbStr},${a})`); gr.addColorStop(1, `rgba(${rgbStr},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 64, h); return c;
}

// ---------------- build + draw ----------------
let built: Built | null = null;

function build(theme: BackdropTheme): Built {
  const wallL = (paint: (g: G, r: Rnd) => void, seed: number) => layer(860, -70, PAR.wall, -64, 64, false, seed, paint);
  const midL = (paint: (g: G, r: Rnd) => void, seed: number, haze: [string, number]) => layer(240, 200, PAR.mid, -9999, 9999, false, seed, paint, haze);
  const repL = (paint: (g: G, r: Rnd) => void, seed: number, haze: [string, number]) => layer(400, 0, PAR.mid, -9999, 9999, true, seed, paint, haze);
  const nearL = (paint: (g: G, r: Rnd) => void, seed: number, haze: [string, number]) => layer(470, 400, PAR.near, -130, 9999, false, seed, paint, haze);
  switch (theme) {
    case 'counter': return { theme, fx: [beam(BEAMS.counter)], layers: [wallL(counterWall, 1), midL(counterRails, 2, [KC.wall, 0.38]), nearL(counterBack, 3, [KC.wall, 0.3])] };
    case 'shelves': return { theme, floor: 514, cut: 356, fx: [beam(BEAMS.shelves)], layers: [wallL(pantryWall, 4), repL(pantryShelves, 5, [PC.wall, 0.42]), nearL(pantryFloor, 6, [PC.wall, 0.28])] };
    case 'stove': return { theme, fx: [bottomGlow('255,120,40', 0.26, 300)], layers: [wallL(stoveWall, 7), midL(stovePans, 8, ['#3a3940', 0.32]), nearL(stoveBack, 9, ['#3a3940', 0.22])] };
    case 'fridge': return { theme, floor: 600, cut: 344, fx: [frostCorner(), softBlob('255,255,255', 0.5)], layers: [wallL(fridgeWall, 10), repL(fridgeShelves, 11, [FC.wall, 0.4]), nearL(fridgeDrawer, 12, [FC.wall, 0.25])] };
  }
}

function blitRow(ctx: G, c: HTMLCanvasElement, ox: number, y: number) {
  ctx.drawImage(c, -ox, y);
  if (SW - ox < W) ctx.drawImage(c, SW - ox, y);
}

/** Full 1280x720 logical background for a theme. camX/camY in world metres, t in seconds. */
export function drawBackdrop(ctx: CanvasRenderingContext2D, theme: BackdropTheme, camX: number, camY: number, t: number): void {
  if (!built || built.theme !== theme) built = build(theme);
  const B = built, dy = camY - CAM_Y0, anim = !reducedMotion;
  const nl = B.layers[B.layers.length - 1], floor = (B.floor ?? 1e9) + clamp(dy * S * nl.fy, nl.lo, nl.hi) - (B.cut ?? 0);
  let wox = 0, woy = 0;
  for (let i = 0; i < B.layers.length; i++) {
    const L = B.layers[i], ox = mod(camX * S * L.f, SW), oy = clamp(dy * S * L.fy, L.lo, L.hi);
    if (L.rep) { const P = L.c.height; for (let y = mod(oy, P) - P; y < H && y < floor; y += P) if (y + P > 0) blitRow(ctx, L.c, ox, y); }
    else { const y = L.y0 + oy; if (y < H && y + L.c.height > 0) blitRow(ctx, L.c, ox, y); }
    if (i === 0) { wox = ox; woy = oy; fxAfterWall(ctx, B, wox, woy, t, anim); }
  }
  fxTop(ctx, B, camX, t, anim);
}

function fxAfterWall(ctx: G, B: Built, ox: number, oy: number, t: number, anim: boolean) {
  if (B.theme !== 'counter' && B.theme !== 'shelves') return;
  // daylight shaft (counter: from the window; pantry: from the high vent), with drifting dust motes
  const b = BEAMS[B.theme], img = B.fx[0], by = b.y + oy, a = b.a, pulse = anim ? 0.85 + 0.15 * Math.sin(t * ANIM.beamPulse) : 0.9;
  for (const px of [b.x - ox, b.x - ox + SW]) {
    if (px > W || px + img.width < 0) continue;
    ctx.globalAlpha = a * pulse; ctx.drawImage(B.fx[0], px, by);
    if (anim) { ctx.fillStyle = '#fff8e6';
      for (let i = 0; i < ANIM.motes; i++) { const v = mod(t * 0.025 + i * 0.137, 1), yy = 20 + v * b.h * 0.8, u = hash(i, 9);
        ctx.globalAlpha = 0.45 * Math.sin(v * Math.PI) * a; ctx.fillRect(px + yy * (b.slant / b.h) + u * b.top + Math.sin(t * 0.6 + i) * 10, by + yy, 3, 3); } }
  }
  ctx.globalAlpha = 1;
}

function fxTop(ctx: G, B: Built, camX: number, t: number, anim: boolean) {
  if (B.theme === 'stove') {
    const gh = B.fx[0].height;
    ctx.globalAlpha = anim ? 0.8 + 0.2 * Math.sin(t * 1.3) : 0.9; ctx.drawImage(B.fx[0], 0, H - gh, W, gh); ctx.globalAlpha = 1;
    if (!anim) return;
    // heat haze: a few wavy lines rising from the stove
    ctx.lineWidth = 3; ctx.lineCap = 'round';
    for (let i = 0; i < ANIM.hazeLines; i++) {
      const p = mod(t * 0.22 + i * 0.37, 1), x = mod(i * 233 - camX * S * PAR.near[0], W + 100) - 50, y = H - 90 - p * 380;
      ctx.strokeStyle = `rgba(255,205,160,${(0.13 * Math.sin(p * Math.PI)).toFixed(3)})`;
      const s = Math.sin(t * 2 + i) * 8;
      ctx.beginPath(); ctx.moveTo(x, y + 60); ctx.quadraticCurveTo(x + 12 + s, y + 40, x, y + 20); ctx.quadraticCurveTo(x - 12 - s, y, x, y - 20); ctx.stroke();
    }
  } else if (B.theme === 'fridge') {
    const fc = B.fx[0], mist = B.fx[1];
    // cold mist drifting along the bottom
    for (let i = 0; i < ANIM.mistBlobs; i++) {
      const x = anim ? mod(i * 560 + t * 14, W + 700) - 350 : i * 520 - 100, y = H - 190 + (anim ? Math.sin(t * 0.4 + i * 2) * 10 : 0);
      ctx.globalAlpha = 0.75; ctx.drawImage(mist, x - 300, y - 60, 600, 240);
    }
    ctx.globalAlpha = 1;
    // frost on the screen corners (one cached image, mirrored)
    ctx.drawImage(fc, 0, 0);
    ctx.save(); ctx.scale(-1, 1); ctx.drawImage(fc, -W, 0); ctx.restore();
    ctx.save(); ctx.globalAlpha = 0.7; ctx.scale(1, -1); ctx.drawImage(fc, 0, -H, 300, 236); ctx.scale(-1, 1); ctx.drawImage(fc, -W, -H, 300, 236); ctx.restore();
    if (!anim) return;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < ANIM.sparkles; i++) {
      const tw = Math.pow(Math.max(0, Math.sin(t * 1.6 + i * 2.3)), 8); if (tw < 0.05) continue;
      const left = i % 2 === 0, x = left ? 20 + hash(i, 1) * 200 : W - 20 - hash(i, 1) * 200, y = 16 + hash(i, 2) * 150, s = 2 + tw * 5;
      ctx.globalAlpha = tw * 0.9; ctx.fillRect(x - s, y - 1, s * 2, 2); ctx.fillRect(x - 1, y - s, 2, s * 2);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------------- vignette + warm key light ----------------
let vig: HTMLCanvasElement | null = null;
/** drawn last over the world: soft warm vignette plus one warm light from the upper left (cached, half resolution) */
export function drawVignette(ctx: CanvasRenderingContext2D): void {
  if (!vig) {
    vig = mk(640, 360); const g = vig.getContext('2d')!;
    const l = g.createRadialGradient(0, 0, 0, 0, 0, 420); l.addColorStop(0, 'rgba(255,228,180,.16)'); l.addColorStop(1, 'rgba(255,228,180,0)');
    g.fillStyle = l; g.fillRect(0, 0, 640, 360);
    const v = g.createRadialGradient(330, 170, 190, 320, 180, 440); v.addColorStop(0, 'rgba(70,32,12,0)'); v.addColorStop(1, 'rgba(70,32,12,.24)');
    g.fillStyle = v; g.fillRect(0, 0, 640, 360);
  }
  ctx.drawImage(vig, 0, 0, W, H);
}
