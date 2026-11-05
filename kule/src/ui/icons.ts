/**
 * Icons as little plastic / wooden pieces: SVG path data (64 box) rendered with an extruded side face,
 * a lit top face and a specular streak. No outlines, no emoji.
 */
import { TOY, Shade } from '../art/palette';

type K = 'w' | 'r' | 'b' | 'y' | 'g' | 'p' | 'm' | 'k' | 'wd';
const S: Record<K, Shade> = { w: TOY.white, r: TOY.red, b: TOY.blue, y: TOY.yellow, g: TOY.green, p: TOY.purple, m: TOY.metal, k: { top: '#4a4458', side: '#3a3446', dark: '#2a2433', hi: '#8a83a0' }, wd: TOY.wood };
interface Part { d: string; c: K; stroke?: number; }
const rect = (x: number, y: number, w: number, h: number, r: number) => `M${x + r} ${y}H${x + w - r}A${r} ${r} 0 0 1 ${x + w} ${y + r}V${y + h - r}A${r} ${r} 0 0 1 ${x + w - r} ${y + h}H${x + r}A${r} ${r} 0 0 1 ${x} ${y + h - r}V${y + r}A${r} ${r} 0 0 1 ${x + r} ${y}Z`;
const circ = (cx: number, cy: number, r: number) => `M${cx - r} ${cy}A${r} ${r} 0 1 0 ${cx + r} ${cy}A${r} ${r} 0 1 0 ${cx - r} ${cy}Z`;
const poly = (p: number[][]) => 'M' + p.map(q => q.join(' ')).join('L') + 'Z';
const line = (p: number[][]) => 'M' + p.map(q => q.join(' ')).join('L');
function star(cx: number, cy: number, R: number, r: number) { const p: number[][] = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; p.push([+(cx + Math.cos(a) * q).toFixed(1), +(cy + Math.sin(a) * q).toFixed(1)]); } return poly(p); }
const arc = (cx: number, cy: number, r: number, a0: number, a1: number) => `M${(cx + Math.cos(a0) * r).toFixed(1)} ${(cy + Math.sin(a0) * r).toFixed(1)}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${(cx + Math.cos(a1) * r).toFixed(1)} ${(cy + Math.sin(a1) * r).toFixed(1)}`;
function head(cx: number, cy: number, r: number, a: number, s: number) { const ex = cx + Math.cos(a) * r, ey = cy + Math.sin(a) * r, tx = -Math.sin(a), ty = Math.cos(a); return poly([[ex + tx * s, ey + ty * s], [ex + Math.cos(a) * s, ey + Math.sin(a) * s], [ex - Math.cos(a) * s, ey - Math.sin(a) * s]].map(p => p.map(v => +v.toFixed(1)))); }

const ICONS = {
  play: [{ d: poly([[20, 12], [52, 32], [20, 52]]), c: 'w' }],
  pause: [{ d: rect(15, 12, 13, 40, 5) + rect(36, 12, 13, 40, 5), c: 'w' }],
  retry: [{ d: arc(32, 34, 16, -1.0, -1.0 + Math.PI * 1.6), c: 'w', stroke: 8 }, { d: head(32, 34, 16, -1.0 + Math.PI * 1.6, 11), c: 'w' }],
  next: [{ d: poly([[12, 12], [38, 32], [12, 52]]), c: 'w' }, { d: rect(41, 12, 10, 40, 4), c: 'w' }],
  fast: [{ d: poly([[8, 14], [32, 32], [8, 50]]) + poly([[32, 14], [56, 32], [32, 50]]), c: 'w' }],
  back: [{ d: poly([[8, 32], [30, 11], [30, 23], [56, 23], [56, 41], [30, 41], [30, 53]]), c: 'w' }],
  close: [{ d: line([[17, 17], [47, 47]]) + line([[47, 17], [17, 47]]), c: 'w', stroke: 11 }],
  check: [{ d: line([[13, 33], [27, 47], [52, 18]]), c: 'w', stroke: 11 }],
  up: [{ d: poly([[32, 8], [55, 32], [41, 32], [41, 56], [23, 56], [23, 32], [9, 32]]), c: 'g' }],
  lock: [{ d: 'M21 30V22A11 11 0 0 1 43 22V30', c: 'm', stroke: 7 }, { d: rect(12, 28, 40, 28, 7), c: 'y' }, { d: circ(32, 40, 5) + rect(30, 41, 4, 9, 1.5), c: 'k' }],
  star: [{ d: star(32, 34, 26, 12), c: 'y' }],
  starOff: [{ d: star(32, 34, 26, 12), c: 'k' }],
  coin: [{ d: circ(32, 32, 24), c: 'y' }, { d: star(32, 33, 11, 5), c: 'y' }],
  life: [{ d: rect(10, 26, 44, 28, 6), c: 'wd' }, { d: poly([[10, 26], [16, 12], [48, 12], [54, 26]]), c: 'r' }, { d: star(32, 22, 9, 4), c: 'y' }],
  sound: [{ d: poly([[10, 25], [20, 25], [33, 13], [33, 51], [20, 39], [10, 39]]), c: 'w' }, { d: arc(34, 32, 10, -0.9, 0.9), c: 'w', stroke: 5 }, { d: arc(34, 32, 18, -0.9, 0.9), c: 'w', stroke: 5 }],
  soundOff: [{ d: poly([[10, 25], [20, 25], [33, 13], [33, 51], [20, 39], [10, 39]]), c: 'w' }, { d: line([[40, 22], [56, 42]]) + line([[56, 22], [40, 42]]), c: 'r', stroke: 7 }],
  settings: [{ d: (() => { const p: number[][] = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, s = 0.22; for (const [r, d] of [[17, -1.3], [25, -0.8], [25, 0.8], [17, 1.3]]) p.push([+(32 + Math.cos(a + s * d) * r).toFixed(1), +(32 + Math.sin(a + s * d) * r).toFixed(1)]); } return poly(p) + circ(32, 32, 7); })(), c: 'w' }],
  map: [{ d: poly([[8, 16], [24, 10], [40, 16], [56, 10], [56, 48], [40, 54], [24, 48], [8, 54]]), c: 'y' }, { d: line([[14, 40], [26, 30], [36, 36], [50, 22]]), c: 'r', stroke: 5 }],
  ball: [{ d: circ(32, 32, 24), c: 'r' }, { d: rect(8, 28, 48, 9, 4), c: 'y' }],
  flash: [{ d: circ(32, 26, 17), c: 'y' }, { d: rect(23, 40, 18, 14, 4), c: 'm' }],
  sell: [{ d: circ(26, 34, 18), c: 'y' }, { d: poly([[42, 10], [58, 26], [50, 26], [50, 40], [34, 40], [34, 26], [26, 26]]), c: 'g' }],
  tFirst: [{ d: rect(36, 16, 20, 32, 4), c: 'wd' }, { d: poly([[6, 26], [26, 26], [26, 18], [36, 32], [26, 46], [26, 38], [6, 38]]), c: 'r' }],
  tLast: [{ d: rect(8, 16, 20, 32, 4), c: 'k' }, { d: poly([[58, 26], [38, 26], [38, 18], [28, 32], [38, 46], [38, 38], [58, 38]]), c: 'r' }],
  tStrong: [{ d: rect(10, 22, 44, 30, 8), c: 'k' }, { d: rect(22, 10, 20, 16, 5), c: 'k' }, { d: star(32, 37, 9, 4), c: 'y' }],
  tClose: [{ d: circ(32, 32, 22), c: 'r' }, { d: circ(32, 32, 14), c: 'w' }, { d: circ(32, 32, 6), c: 'r' }],
  film: [{ d: rect(8, 24, 48, 32, 5), c: 'k' }, { d: poly([[8, 12], [52, 6], [54, 17], [10, 23]]), c: 'k' }, { d: poly([[16, 11], [24, 10], [20, 21], [12, 22]]) + poly([[32, 8], [40, 7], [36, 18], [28, 19]]), c: 'w' }, { d: poly([[27, 32], [41, 40], [27, 48]]), c: 'w' }],
  x2: [{ d: line([[8, 24], [22, 40]]) + line([[22, 24], [8, 40]]), c: 'w', stroke: 6 }, { d: 'M30 24C31 13 54 13 53 24C52 32 36 37 31 48H55', c: 'w', stroke: 8 }],
  plus: [{ d: line([[32, 12], [32, 52]]) + line([[12, 32], [52, 32]]), c: 'w', stroke: 11 }],
  inf: [{ d: 'M32 32C25 20 10 21 10 32C10 43 25 44 32 32C39 20 54 21 54 32C54 43 39 44 32 32Z', c: 'w', stroke: 8 }],
  sticker: [{ d: star(32, 33, 26, 13), c: 'p' }, { d: circ(32, 33, 8), c: 'y' }],
  armor: [{ d: 'M32 6L54 14V30C54 44 44 53 32 58C20 53 10 44 10 30V14Z', c: 'm' }],
  wing: [{ d: 'M6 40C14 18 34 10 58 12C48 22 46 30 50 40C38 36 28 40 22 50C18 44 12 42 6 40Z', c: 'w' }],
  speed: [{ d: line([[6, 20], [26, 20]]) + line([[2, 32], [24, 32]]) + line([[6, 44], [26, 44]]), c: 'w', stroke: 5 }, { d: circ(42, 32, 16), c: 'w' }],
  hp: [{ d: 'M32 54C10 38 6 28 10 20C14 12 26 10 32 20C38 10 50 12 54 20C58 28 54 38 32 54Z', c: 'r' }],
} satisfies Record<string, Part[]>;
export type IconName = keyof typeof ICONS;
const cache = new Map<IconName, Path2D[]>();
/** draw an icon centred at (x, y), `size` px; `tint` recolours the white glyph parts */
export function icon(ctx: CanvasRenderingContext2D, n: IconName, x: number, y: number, size: number, o: { tint?: Shade; alpha?: number } = {}) {
  let ps = cache.get(n); if (!ps) { ps = (ICONS[n] as Part[]).map(p => new Path2D(p.d)); cache.set(n, ps); }
  const k = size / 64, parts = ICONS[n] as Part[];
  ctx.save(); ctx.translate(x - 32 * k, y - 32 * k); ctx.scale(k, k); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; if (o.alpha !== undefined) ctx.globalAlpha *= o.alpha;
  parts.forEach((p, i) => {
    const c = p.c === 'w' && o.tint ? o.tint : S[p.c], path = ps![i];
    if (p.stroke) { ctx.translate(0, 3.5); ctx.strokeStyle = c.dark; ctx.lineWidth = p.stroke; ctx.stroke(path); ctx.translate(0, -3.5); ctx.strokeStyle = c.top; ctx.stroke(path); return; }
    ctx.translate(0, 4); ctx.fillStyle = c.dark; ctx.fill(path, 'evenodd'); ctx.translate(0, -4);                       // extruded side face
    ctx.fillStyle = c.top; ctx.fill(path, 'evenodd');
    ctx.save(); ctx.clip(path, 'evenodd'); ctx.fillStyle = c.side; ctx.globalAlpha *= 0.5; ctx.fillRect(0, 44, 64, 20); ctx.globalAlpha /= 0.5;  // lower half a touch darker
    ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(22, 18, 10, 4, -0.5, 0, 7); ctx.fill(); ctx.restore();   // specular streak
  });
  ctx.restore();
}
export const ICON_LIST = Object.keys(ICONS) as IconName[];
