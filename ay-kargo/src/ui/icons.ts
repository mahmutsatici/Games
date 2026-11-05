/**
 * Icon set in the game's art style, defined as SVG path data (64x64 box) and drawn with cached Path2D.
 * Every part: outline in a darker shade of its own colour, flat base, one shadow shape (bottom-right),
 * one highlight (top-left). No emoji, no image files.
 */
import { ART, Tri } from '../art/palette';
import { C } from './theme';

type ToneKey = 'g' | 'o' | 'm' | 'k' | 't' | 'w' | 'gl' | 'y' | 's' | 'r' | 'e' | 'b' | 'p' | 'u' | 'mt' | 'l';
const TONES: Record<ToneKey, Tri> = {
  g: { base: '#fffaf0', dark: '#7d6a4f', light: '#ffffff' },   // glyph on buttons (cream)
  o: C.primary, m: ART.roverMetal, k: ART.roverDark, t: ART.tire, w: ART.crate, gl: ART.glassCrate, y: ART.coin,
  s: ART.slime, r: ART.danger, e: ART.energy, b: ART.shield, p: { base: '#ffffff', dark: '#5d6677', light: '#ffffff' },
  u: ART.ufo, mt: ART.meteor, l: C.locked,
};
interface Part { d: string; tone: ToneKey; stroke?: number; evenodd?: boolean; }

// ---------- geometry helpers (64 box, y down) ----------
const f = (n: number) => +n.toFixed(2);
const rect = (x: number, y: number, w: number, h: number, r: number) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
const poly = (p: number[][]) => 'M' + p.map(q => `${f(q[0])} ${f(q[1])}`).join('L') + 'Z';
const line = (p: number[][]) => 'M' + p.map(q => `${f(q[0])} ${f(q[1])}`).join('L');
const pt = (cx: number, cy: number, r: number, a: number) => [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
function arc(cx: number, cy: number, r: number, a0: number, a1: number) { const [x0, y0] = pt(cx, cy, r, a0), [x1, y1] = pt(cx, cy, r, a1); return `M${f(x0)} ${f(y0)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${f(x1)} ${f(y1)}`; }
/** arrowhead at angle a on a circle, pointing clockwise (dir 1) or anticlockwise (-1) */
function head(cx: number, cy: number, r: number, a: number, s: number, dir = 1) {
  const [ex, ey] = pt(cx, cy, r, a), tx = -Math.sin(a) * dir, ty = Math.cos(a) * dir, nx = Math.cos(a), ny = Math.sin(a);
  return poly([[ex + tx * s, ey + ty * s], [ex + nx * s * 0.95, ey + ny * s * 0.95], [ex - nx * s * 0.95, ey - ny * s * 0.95]]);
}
function star(cx: number, cy: number, R: number, r: number, n = 5) { const p: number[][] = []; for (let i = 0; i < n * 2; i++) p.push(pt(cx, cy, i % 2 ? r : R, -Math.PI / 2 + i * Math.PI / n)); return poly(p); }
function gear(cx: number, cy: number, R: number, r: number, n: number) { const p: number[][] = []; for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, s = Math.PI / n * 0.55; p.push(pt(cx, cy, r, a - s * 1.25), pt(cx, cy, R, a - s * 0.7), pt(cx, cy, R, a + s * 0.7), pt(cx, cy, r, a + s * 1.25)); } return poly(p); }

const speaker = poly([[11, 25], [21, 25], [33, 14], [33, 50], [21, 39], [11, 39]]);
const note = circ(21, 46, 7) + circ(43, 41, 7) + rect(25, 15, 5, 32, 2) + rect(47, 11, 5, 31, 2) + poly([[25, 15], [52, 9], [52, 17], [25, 23]]);
const crateParts: Part[] = [
  { d: rect(9, 9, 46, 46, 6), tone: 'w' }, { d: rect(16, 16, 32, 32, 3), tone: 'w' },
  { d: poly([[16, 42], [42, 16], [48, 22], [22, 48]]), tone: 'w' },
  { d: circ(13, 13, 2.2) + circ(51, 13, 2.2) + circ(13, 51, 2.2) + circ(51, 51, 2.2), tone: 'm' },
];

const ICONS = {
  play: [{ d: poly([[21, 13], [51, 32], [21, 51]]), tone: 'g' }],
  pause: [{ d: rect(16, 13, 12, 38, 4) + rect(36, 13, 12, 38, 4), tone: 'g' }],
  settings: [{ d: gear(32, 32, 25, 18, 8) + circ(32, 32, 8), tone: 'g', evenodd: true }],
  sound: [{ d: speaker, tone: 'g' }, { d: arc(34, 32, 9, -0.85, 0.85), tone: 'g', stroke: 4.5 }, { d: arc(34, 32, 17, -0.85, 0.85), tone: 'g', stroke: 4.5 }],
  soundOff: [{ d: speaker, tone: 'g' }, { d: line([[40, 22], [56, 42]]) + line([[56, 22], [40, 42]]), tone: 'r', stroke: 6 }],
  music: [{ d: note, tone: 'g' }],
  musicOff: [{ d: note, tone: 'g' }, { d: line([[10, 10], [54, 54]]), tone: 'r', stroke: 6 }],
  home: [{ d: poly([[32, 9], [57, 32], [50, 32], [50, 55], [14, 55], [14, 32], [7, 32]]), tone: 'g' }, { d: rect(26, 37, 12, 18, 3), tone: 'o' }],
  retry: [{ d: arc(32, 33, 16, -1.1, -1.1 + Math.PI * 1.62), tone: 'g', stroke: 7 }, { d: head(32, 33, 16, -1.1 + Math.PI * 1.62, 10), tone: 'g' }],
  next: [{ d: poly([[14, 13], [40, 32], [14, 51]]), tone: 'g' }, { d: rect(42, 13, 9, 38, 3), tone: 'g' }],
  back: [{ d: poly([[8, 32], [29, 12], [29, 24], [55, 24], [55, 40], [29, 40], [29, 52]]), tone: 'g' }],
  arrowL: [{ d: line([[39, 12], [20, 32], [39, 52]]), tone: 'g', stroke: 10 }],
  arrowR: [{ d: line([[25, 12], [44, 32], [25, 52]]), tone: 'g', stroke: 10 }],
  up: [{ d: poly([[32, 8], [54, 32], [41, 32], [41, 56], [23, 56], [23, 32], [10, 32]]), tone: 'g' }],
  down: [{ d: poly([[32, 56], [54, 32], [41, 32], [41, 8], [23, 8], [23, 32], [10, 32]]), tone: 'g' }],
  tiltL: [{ d: arc(32, 38, 19, Math.PI * 1.08, Math.PI * 1.86), tone: 'g', stroke: 7 }, { d: head(32, 38, 19, Math.PI * 1.08, 10, -1), tone: 'g' }],
  tiltR: [{ d: arc(32, 38, 19, Math.PI * 1.14, Math.PI * 1.92), tone: 'g', stroke: 7 }, { d: head(32, 38, 19, Math.PI * 1.92, 10), tone: 'g' }],
  check: [{ d: line([[13, 33], [27, 47], [52, 18]]), tone: 'g', stroke: 10 }],
  close: [{ d: line([[17, 17], [47, 47]]) + line([[47, 17], [17, 47]]), tone: 'g', stroke: 10 }],
  plus: [{ d: line([[32, 13], [32, 51]]) + line([[13, 32], [51, 32]]), tone: 'g', stroke: 10 }],
  inf: [{ d: 'M32 32C25 20 10 21 10 32C10 43 25 44 32 32C39 20 54 21 54 32C54 43 39 44 32 32Z', tone: 'g', stroke: 7 }],
  x2: [{ d: line([[8, 25], [22, 41]]) + line([[22, 25], [8, 41]]), tone: 'g', stroke: 6 }, { d: 'M30 24C31 13 54 13 53 25C52 33 36 38 31 49H55', tone: 'g', stroke: 7.5 }],
  lock: [{ d: 'M21 30V22A11 11 0 0 1 43 22V30', tone: 'm', stroke: 6 }, { d: rect(13, 28, 38, 27, 7), tone: 'y' }, { d: circ(32, 39, 4.5) + rect(30, 40, 4, 9, 1.5), tone: 'k' }],
  coin: [{ d: circ(32, 32, 23), tone: 'y' }, { d: 'M37 19A13 13 0 1 0 37 45A10 10 0 1 1 37 19Z', tone: 'y' }],
  star: [{ d: star(32, 34, 25, 11), tone: 'y' }],
  crate: crateParts,
  crateOff: [{ d: rect(10, 10, 44, 44, 6), tone: 'l', stroke: 3.5 }],
  glassCrate: [{ d: rect(9, 9, 46, 46, 6), tone: 'gl' }, { d: rect(26, 22, 12, 26, 5) + rect(29, 15, 6, 9, 2), tone: 'b' }],
  battery: [{ d: rect(6, 17, 46, 30, 7), tone: 'm' }, { d: rect(52, 25, 7, 14, 2.5), tone: 'm' }, { d: rect(12, 23, 9, 18, 2.5) + rect(24, 23, 9, 18, 2.5) + rect(36, 23, 9, 18, 2.5), tone: 'e' }],
  batteryEmpty: [{ d: rect(6, 17, 46, 30, 7), tone: 'm' }, { d: rect(52, 25, 7, 14, 2.5), tone: 'm' }, { d: rect(12, 23, 7, 18, 2.5), tone: 'r' }],
  shield: [{ d: 'M32 7L53 15V30C53 44 44 52 32 58C20 52 11 44 11 30V15Z', tone: 'b' }, { d: 'M32 17V48C25 44 20 38 20 30V21Z', tone: 'b' }],
  turbo: [{ d: poly([[37, 5], [13, 36], [29, 36], [24, 59], [51, 25], [34, 25], [41, 5]]), tone: 'y' }],
  engine: [{ d: rect(17, 12, 11, 12, 2.5) + rect(32, 12, 11, 12, 2.5), tone: 'm' }, { d: rect(10, 21, 40, 28, 5), tone: 'o' }, { d: rect(49, 28, 8, 14, 2.5), tone: 'k' }, { d: rect(16, 29, 20, 5, 2) + rect(16, 38, 20, 5, 2), tone: 'k' }],
  suspension: [{ d: rect(14, 7, 36, 8, 3) + rect(14, 49, 36, 8, 3), tone: 'm' }, { d: line([[22, 16], [42, 22], [22, 28], [42, 34], [22, 40], [42, 46]]), tone: 'o', stroke: 6 }],
  tires: [{ d: circ(32, 32, 25), tone: 't' }, { d: circ(32, 32, 13), tone: 'm' }, { d: circ(32, 32, 5), tone: 'o' }],
  bed: [{ d: rect(20, 26, 11, 14, 2) + rect(33, 24, 12, 16, 2), tone: 'w' }, { d: 'M7 20H15V42H49V20H57V50H7Z', tone: 'o' }],
  bumper: [{ d: poly([[12, 18], [42, 18], [56, 32], [42, 46], [12, 46]]), tone: 'k' }, { d: rect(12, 28, 34, 8, 2), tone: 'o' }, { d: circ(20, 23, 2.5) + circ(20, 41, 2.5), tone: 'm' }],
  clapper: [{ d: rect(8, 25, 48, 31, 5), tone: 'k' }, { d: poly([[8, 13], [52, 6], [54, 17], [10, 24]]), tone: 'k' }, { d: poly([[16, 12], [24, 11], [20, 22], [12, 23]]) + poly([[32, 9], [40, 8], [36, 19], [28, 20]]), tone: 'g' }, { d: poly([[27, 33], [41, 40], [27, 48]]), tone: 'g' }],
  gift: [{ d: rect(11, 28, 42, 27, 4), tone: 'r' }, { d: rect(8, 19, 48, 11, 3), tone: 'r' }, { d: rect(29, 19, 6, 36, 1), tone: 'y' }, { d: circ(24, 14, 6) + circ(40, 14, 6), tone: 'y' }],
  garage: [{ d: line([[14, 50], [36, 28]]), tone: 'm', stroke: 11 }, { d: poly([[34, 30], [31, 19], [39, 9], [47, 8], [41, 16], [45, 21], [52, 16], [56, 9], [57, 19], [51, 28], [42, 32]]), tone: 'm' }],
  map: [{ d: 'M32 57C22 43 13 35 13 24A19 19 0 1 1 51 24C51 35 42 43 32 57Z', tone: 'o' }, { d: circ(32, 24, 8), tone: 'g' }],
  flag: [{ d: rect(12, 7, 6, 51, 3), tone: 'm' }, { d: poly([[18, 9], [52, 15], [43, 24], [52, 33], [18, 35]]), tone: 'o' }],
  slime: [{ d: 'M9 50C7 30 19 15 32 15C45 15 57 30 55 50Z', tone: 's' }, { d: circ(24, 32, 6) + circ(40, 32, 6), tone: 'p' }, { d: circ(25, 33, 2.8) + circ(41, 33, 2.8), tone: 'k' }],
  meteor: [{ d: line([[34, 30], [57, 7]]) + line([[40, 37], [60, 18]]), tone: 'y', stroke: 5 }, { d: poly([[10, 38], [16, 26], [30, 22], [42, 30], [42, 44], [32, 54], [16, 52]]), tone: 'mt' }],
  ufo: [{ d: 'M20 30A12 12 0 0 1 44 30Z', tone: 'gl' }, { d: 'M5 35C5 25 59 25 59 35C59 44 5 44 5 35Z', tone: 'u' }, { d: circ(18, 35, 2.5) + circ(32, 37, 2.5) + circ(46, 35, 2.5), tone: 'y' }],
  trophy: [{ d: 'M18 10H46V24C46 34 40 40 32 40C24 40 18 34 18 24Z', tone: 'y' }, { d: rect(28, 39, 8, 9, 1) + rect(19, 47, 26, 9, 3), tone: 'y' }, { d: arc(18, 22, 8, Math.PI * 0.5, Math.PI * 1.5) + arc(46, 22, 8, -Math.PI * 0.5, Math.PI * 0.5), tone: 'y', stroke: 4 }],
  speed: [{ d: arc(32, 40, 22, Math.PI, Math.PI * 2), tone: 'g', stroke: 7 }, { d: line([[32, 40], [45, 24]]), tone: 'o', stroke: 5 }, { d: circ(32, 40, 5), tone: 'o' }],
} satisfies Record<string, Part[]>;
export type IconName = keyof typeof ICONS;
export const ICON_NAMES = Object.keys(ICONS) as IconName[];

// ---------- rendering ----------
interface Prepared { p: Path2D; sh: Path2D; hi: Path2D; part: Part; }
const cache = new Map<IconName, Prepared[]>();
function prep(name: IconName): Prepared[] {
  let v = cache.get(name); if (v) return v;
  v = (ICONS[name] as Part[]).map(part => {
    const p = new Path2D(part.d), sh = new Path2D(), hi = new Path2D();
    // shadow = inside the part but outside a copy shifted up-left; highlight = outside a copy shifted down-right
    sh.rect(-20, -20, 104, 104); sh.addPath(p, new DOMMatrix([1, 0, 0, 1, -3, -4]));
    hi.rect(-20, -20, 104, 104); hi.addPath(p, new DOMMatrix([1, 0, 0, 1, 2, 3]));
    return { p, sh, hi, part };
  });
  cache.set(name, v); return v;
}
export interface IconOpts { tint?: Tri; mono?: Tri; alpha?: number; }
/** draw an icon centred at (x, y), `size` px wide. `tint` replaces the cream glyph colour; `mono` recolours every part. */
export function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number, size: number, o: IconOpts = {}) {
  const parts = prep(name), k = size / 64, ow = 5;
  ctx.save(); ctx.translate(x - 32 * k, y - 32 * k); ctx.scale(k, k); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  const T = (pt: Part) => o.mono ?? (pt.tone === 'g' && o.tint ? o.tint : TONES[pt.tone]);
  for (const q of parts) {
    const t = T(q.part);
    if (q.part.stroke) {
      ctx.strokeStyle = t.dark; ctx.lineWidth = q.part.stroke + ow; ctx.stroke(q.p);
      ctx.strokeStyle = t.base; ctx.lineWidth = q.part.stroke; ctx.stroke(q.p);
      continue;
    }
    ctx.strokeStyle = t.dark; ctx.lineWidth = ow; ctx.stroke(q.p);
    const rule: CanvasFillRule = q.part.evenodd ? 'evenodd' : 'nonzero';
    ctx.fillStyle = t.base; ctx.fill(q.p, rule);
    ctx.save(); ctx.clip(q.p, rule);
    ctx.globalAlpha *= 0.3; ctx.fillStyle = t.dark; ctx.fill(q.sh, 'evenodd');
    ctx.globalAlpha /= 0.3; ctx.globalAlpha *= 0.85; ctx.fillStyle = t.light; ctx.fill(q.hi, 'evenodd');
    ctx.restore();
  }
  ctx.restore();
}
