/**
 * Icon set for Zıp Sucuk. Every icon is SVG path data on a 64x64 viewBox, rendered with Path2D
 * (so the same data can be exported as .svg via iconSVG). Style: chunky rounded shapes, flat base colour,
 * one shadow band, one glossy highlight, outline in a darker shade of the shape's own colour (UI_REVIEW.md §2).
 */
import { C, type Tri } from './theme';

export type IconName = 'play' | 'pause' | 'settings' | 'sound' | 'soundOff' | 'music' | 'musicOff' | 'home' | 'retry'
  | 'next' | 'arrowL' | 'arrowR' | 'back' | 'lock' | 'chili' | 'chiliEmpty' | 'coin' | 'check' | 'close' | 'clapper'
  | 'x2' | 'skins' | 'jump' | 'splash' | 'flag' | 'sausage';

/**
 * A layer is one path with optional fill (f) and stroke (s, width w). Colour tokens: base|dark|light (icon triple),
 * hi (white glint), sh (shadow band = dark at 40%), ink, or "<paletteKey>.<base|dark|light>"; "@a" overrides the alpha.
 * clip: draw only inside that path. t: [scale, translateX, translateY] applied to the layer.
 */
interface Layer { d: string; f?: string; s?: string; w?: number; clip?: string; t?: [number, number, number]; }
interface IconDef { tri: Tri; layers: Layer[]; o?: [number, number]; }

const OL = 3.5;                                              // outline thickness (viewBox px)
const GLYPH: Tri = { base: C.cream.base, dark: '#8a5a30', light: C.cream.light };   // cream UI glyph with brown outline
const SPLASH: Tri = { base: '#f28c2e', dark: '#9a4a0c', light: '#ffc27a' };
const SHD = 'M0 72L72 0V72Z';                               // shadow half-plane x+y >= 72 (lower right)
const SHD_Y = (y: number) => `M0 ${y}H72V72H0Z`;             // shadow band below y

const f1 = (n: number) => +n.toFixed(1);
const circ = (cx: number, cy: number, r: number) => `M${f1(cx - r)} ${f1(cy)}a${r} ${r} 0 1 0 ${f1(2 * r)} 0a${r} ${r} 0 1 0 ${f1(-2 * r)} 0Z`;
type Pt = [number, number];
/** closed polygon with rounded corners (quadratic corners, radius r) */
function rpoly(pts: Pt[], r: number): string {
  const n = pts.length; let d = '';
  for (let i = 0; i < n; i++) {
    const p = pts[i], a = pts[(i + n - 1) % n], b = pts[(i + 1) % n];
    const la = Math.hypot(a[0] - p[0], a[1] - p[1]), lb = Math.hypot(b[0] - p[0], b[1] - p[1]);
    const ra = Math.min(r, la / 2) / la, rb = Math.min(r, lb / 2) / lb;
    d += `${i ? 'L' : 'M'}${f1(p[0] + (a[0] - p[0]) * ra)} ${f1(p[1] + (a[1] - p[1]) * ra)}Q${p[0]} ${p[1]} ${f1(p[0] + (b[0] - p[0]) * rb)} ${f1(p[1] + (b[1] - p[1]) * rb)}`;
  }
  return d + 'Z';
}
const rect = (x1: number, y1: number, x2: number, y2: number, r: number) => rpoly([[x1, y1], [x2, y1], [x2, y2], [x1, y2]], r);
function capsule(x1: number, y1: number, x2: number, y2: number, r: number): string {
  const l = Math.hypot(x2 - x1, y2 - y1), nx = -(y2 - y1) / l * r, ny = (x2 - x1) / l * r;
  return `M${f1(x1 + nx)} ${f1(y1 + ny)}L${f1(x2 + nx)} ${f1(y2 + ny)}A${r} ${r} 0 0 0 ${f1(x2 - nx)} ${f1(y2 - ny)}L${f1(x1 - nx)} ${f1(y1 - ny)}A${r} ${r} 0 0 0 ${f1(x1 + nx)} ${f1(y1 + ny)}Z`;
}
/** half-plane on the n side of the line through (cx,cy)+n*off */
function halfPlane(cx: number, cy: number, nx: number, ny: number, off: number): string {
  const px = cx + nx * off, py = cy + ny * off, tx = -ny, ty = nx, L = 90;
  const A: Pt = [px + tx * L, py + ty * L], B: Pt = [px - tx * L, py - ty * L];
  return `M${f1(A[0])} ${f1(A[1])}L${f1(B[0])} ${f1(B[1])}L${f1(B[0] + nx * L)} ${f1(B[1] + ny * L)}L${f1(A[0] + nx * L)} ${f1(A[1] + ny * L)}Z`;
}

/** filled body: outline (outside only), fill, optional clipped shadow band */
function body(d: string, o: { f?: string; s?: string; shade?: string | null } = {}): Layer[] {
  const out: Layer[] = [{ d, s: o.s ?? 'dark', w: OL * 2 }, { d, f: o.f ?? 'base' }];
  const sh = o.shade === undefined ? SHD : o.shade;
  if (sh) out.push({ d: sh, f: 'sh', clip: d });
  return out;
}
/** stroked body (lines with round caps) with outline */
function strokeBody(d: string, w: number, o: { f?: string; s?: string } = {}): Layer[] {
  return [{ d, s: o.s ?? 'dark', w: w + OL * 2 }, { d, s: o.f ?? 'base', w }];
}
const hl = (d: string, w = 3): Layer => ({ d, s: 'hi', w });
const shift = (ls: Layer[], dx: number, dy: number): Layer[] => ls.map(l => ({ ...l, t: [1, dx, dy] as [number, number, number] }));
const mir = (pts: Pt[]): Pt[] => pts.map(([x, y]) => [64 - x, y] as Pt);

// ---- shared shapes -------------------------------------------------------------------------------------------------
const SPEAKER = rpoly([[10, 25], [20, 25], [33, 14], [33, 50], [20, 39], [10, 39]], 3);
const speaker = (): Layer[] => [...body(SPEAKER, { shade: SHD_Y(38) }), hl('M14 29.5H18', 2.6), hl('M24.5 23.5L29.5 19.2', 2.6)];
const WAVE1 = 'M40 26A8 8 0 0 1 40 38';
const WAVE2 = 'M45 17A17 17 0 0 1 45 47';
const SLASH = 'M14 12L50 52';
const slash = (): Layer[] => [{ d: SLASH, s: 'chili.dark', w: 10.5 }, { d: SLASH, s: 'chili.base', w: 4 }, hl('M15.5 14L24 23.5', 1.6)];
const musicLayers = (): Layer[] => {
  const heads = circ(21, 48, 7.5) + circ(43, 43, 7.5);
  const stems = rect(23, 18, 28.5, 48, 2) + rect(45, 11, 50.5, 43, 2);
  const beam = rpoly([[23, 18], [50.5, 11], [50.5, 22], [23, 29]], 2);
  return [...body(heads + stems + beam, { shade: SHD_Y(46) }), hl('M28.5 19.5L46 15', 2.4), hl('M17.5 47Q18 44 21 43', 2.4), hl('M39.5 42Q40 39 43 38', 2.4)];
};
function gearPath(): string {
  const pts: Pt[] = [];
  const pol = (R: number, deg: number): Pt => [f1(32 + R * Math.cos(deg * Math.PI / 180)), f1(32 + R * Math.sin(deg * Math.PI / 180))];
  for (let i = 0; i < 8; i++) { const a = i * 45; pts.push(pol(19.5, a - 13), pol(25.5, a - 8), pol(25.5, a + 8), pol(19.5, a + 13)); }
  return rpoly(pts, 3);
}
const CH_BODY = 'M35 22C48 18 56 30 51 42C46 54 28 59 11 55C22 50 28 44 31 36C33 30 31 24 35 22Z';
const CH_CAP = rect(31, 15, 48, 25, 4.5);
const CH_STEM = 'M40 16C40 12 43 10 47 10';

function clapperLayers(): Layer[] {
  const A: Pt = [10, 27], B: Pt = [54, 17], Cc: Pt = [51.8, 7.2], D: Pt = [7.8, 17.2];
  const stick = rpoly([A, B, Cc, D], 2.5);
  const dir: Pt = [0.976, -0.222];
  const at = (p: Pt, u: number): string => `${f1(p[0] + dir[0] * u)} ${f1(p[1] + dir[1] * u)}`;
  const bands = [8, 22, 36].map(u => `M${at(A, u)}L${at(A, u + 7)}L${at(D, u + 13)}L${at(D, u + 6)}Z`).join('');
  return [
    ...body(rect(10, 29, 54, 56, 5), { shade: SHD_Y(48) }),
    { d: rect(15, 37, 49, 41, 1.8), f: 'dark@.55' },
    hl('M15 33.5H26', 2.6),
    ...body(stick, { shade: SHD_Y(14) }),
    { d: bands, f: 'dark', clip: stick },
    hl('M14 22.6L22 20.8', 2.4),
  ];
}
function sausageLayers(): Layer[] {
  const x1 = 18, y1 = 43, x2 = 46, y2 = 21, r = 9.5;
  const l = Math.hypot(x2 - x1, y2 - y1), ax = (x2 - x1) / l, ay = (y2 - y1) / l, nx = -ay, ny = ax;     // n points lower right
  const cap = capsule(x1, y1, x2, y2, r);
  const q = { x: x1 + (x2 - x1) * 0.76, y: y1 + (y2 - y1) * 0.76 };
  const eye = (s: number): Layer[] => {
    const cx = q.x + nx * 4.6 * s, cy = q.y + ny * 4.6 * s;
    return [{ d: circ(cx, cy, 4.3), f: 'white', s: 'dark', w: 1.8 }, { d: circ(cx + 0.9, cy + 1.2, 1.9), f: 'dark' }];
  };
  const p = (u: number, off: number): string => `${f1(x1 + (x2 - x1) * u - nx * off)} ${f1(y1 + (y2 - y1) * u - ny * off)}`;
  return [...body(cap, { shade: halfPlane(32, 32, nx, ny, 4.5) }), hl(`M${p(0.1, 5.3)}L${p(0.5, 5.3)}`, 3), ...eye(-1), ...eye(1)];
}
function splashLayers(): Layer[] {
  const drop = (cx: number, cy: number, s: number) =>
    `M${f1(cx)} ${f1(cy - 14 * s)}C${f1(cx + 3 * s)} ${f1(cy - 8 * s)} ${f1(cx + 9 * s)} ${f1(cy - s)} ${f1(cx + 9 * s)} ${f1(cy + 4 * s)}A${f1(9 * s)} ${f1(9 * s)} 0 0 1 ${f1(cx - 9 * s)} ${f1(cy + 4 * s)}C${f1(cx - 9 * s)} ${f1(cy - s)} ${f1(cx - 3 * s)} ${f1(cy - 8 * s)} ${f1(cx)} ${f1(cy - 14 * s)}Z`;
  return [
    ...body('M7 50A25 7 0 0 1 57 50A25 7 0 0 1 7 50Z', { shade: SHD_Y(52) }),
    ...body(drop(32, 24, 1.3)), ...body(drop(12, 31, 0.7)), ...body(drop(52, 31, 0.7)), ...body(drop(20, 12, 0.42)), ...body(drop(45, 11, 0.42)),
    hl('M27 20C26 24 26 27 27.5 30', 3),
  ];
}

const ARROW: Pt[] = [[10, 25], [31, 25], [31, 13], [54, 32], [31, 51], [31, 39], [10, 39]];
const arrowLayers = (left: boolean): Layer[] => {
  const pts = left ? mir(ARROW) : ARROW;
  const hx = (x: number) => (left ? 64 - x : x);
  return [...body(rpoly(pts, 4), { shade: SHD_Y(36) }), hl(`M${hx(15)} 29.5H${hx(27)}`, 2.8), hl(`M${hx(36)} 21L${hx(44)} 27`, 2.8)];
};

const ICONS: Record<IconName, IconDef> = {
  play: { tri: GLYPH, layers: [...body(rpoly([[15, 9], [49, 32], [15, 55]], 6), { shade: 'M0 56L70 9V70H0Z' }), hl('M22 18.5L33 26', 3.2)] },
  pause: {
    tri: GLYPH, layers: [
      ...body(rect(14, 10, 28, 54, 5), { shade: 'M22 0H72V72H22Z' }), ...body(rect(36, 10, 50, 54, 5), { shade: 'M44 0H72V72H44Z' }),
      hl('M19 17V30', 3), hl('M41 17V30', 3),
    ],
  },
  settings: { tri: GLYPH, layers: [...body(gearPath()), { d: circ(32, 32, 8.5), f: 'dark' }, hl('M16.5 25Q19 18.5 26 15', 3.2)] },
  sound: { tri: GLYPH, layers: shift([...strokeBody(WAVE2, 4.5), ...strokeBody(WAVE1, 4.5), ...speaker()], -1, 0) },
  soundOff: { tri: GLYPH, layers: [...shift([...strokeBody(WAVE1, 4.5), ...speaker()], 3, 0), ...slash()] },
  music: { tri: GLYPH, layers: shift(musicLayers(), 0, -1) },
  musicOff: { tri: GLYPH, layers: [...shift(musicLayers(), 0, -1), ...slash()] },
  home: {
    tri: GLYPH, layers: [
      ...body(rect(14, 30, 50, 54, 4), { shade: SHD_Y(47) }), { d: rect(27, 39, 37, 54, 3), f: 'dark' },
      ...body(rpoly([[6, 34], [32, 8], [58, 34]], 4)), hl('M16.5 29L28.5 17', 3.2),
    ],
  },
  retry: {
    tri: GLYPH, layers: [
      { d: 'M41 16.4A18 18 0 1 0 47.6 41', s: 'dark', w: 12 }, { d: rpoly([[45.5, 8.6], [50.5, 21.9], [36.5, 24.2]], 2), s: 'dark', w: 7 },
      { d: 'M41 16.4A18 18 0 1 0 47.6 41', s: 'base', w: 5.5 }, { d: rpoly([[45.5, 8.6], [50.5, 21.9], [36.5, 24.2]], 2), f: 'base' },
      { d: 'M47.6 41A18 18 0 0 1 25.8 48.9', s: 'sh', w: 5.5 }, hl('M16.4 23A18 18 0 0 1 24.4 15.7', 2.2),
    ],
  },
  next: {
    tri: GLYPH, layers: [
      ...body(rpoly([[10, 11], [41, 32], [10, 53]], 5), { shade: 'M0 51L70 3.4V70H0Z' }), ...body(rect(43, 11, 53, 53, 4), { shade: 'M49 0H72V72H49Z' }),
      hl('M17 17.5L26.5 24', 3), hl('M46.5 17V27', 2.6),
    ],
  },
  arrowL: { tri: GLYPH, layers: arrowLayers(true) },
  arrowR: { tri: GLYPH, layers: arrowLayers(false) },
  back: {
    tri: GLYPH, layers: [
      ...strokeBody('M41 14L23 32L41 50', 11), { d: 'M21.3 33.6L38.5 50.8', s: 'sh', w: 2.8 }, hl('M37 12.8L25 24.8', 2.4),
    ],
  },
  lock: {
    tri: C.mustard, layers: [
      ...strokeBody('M21 30V22A11 11 0 0 1 43 22V30', 6.5, { f: 'steel.base', s: 'steel.dark' }), hl('M25 27V23A7 7 0 0 1 29 17.5', 2),
      ...body(rect(12, 29, 52, 55, 8), { shade: SHD_Y(47) }),
      { d: circ(32, 40, 4.3) + rpoly([[29.7, 42], [34.3, 42], [35.2, 50], [28.8, 50]], 1), f: 'dark' }, hl('M17.5 36V43', 3),
    ],
  },
  chili: {
    tri: C.chili, layers: [
      ...strokeBody(CH_STEM, 5.5, { f: 'leaf.base', s: 'leaf.dark' }), ...body(CH_BODY),
      ...body(CH_CAP, { f: 'leaf.base', s: 'leaf.dark', shade: SHD_Y(21) }), hl('M42 25C48 28 50 34 48.5 39', 3), hl('M34.5 18.5H40', 2),
    ],
  },
  chiliEmpty: {
    tri: C.chili, layers: [
      { d: CH_STEM, s: 'ink@.4', w: 5 }, { d: CH_BODY, f: 'ink@.28', s: 'ink@.42', w: 3.5 }, { d: CH_CAP, f: 'ink@.4', s: 'ink@.42', w: 3.5 },
    ],
  },
  coin: {
    tri: C.mustard, layers: [
      ...body(circ(32, 32, 24), { shade: 'M0 78L78 0V72H72Z' }), { d: circ(32, 32, 17.5), s: 'dark', w: 2.6 },
      { d: CH_BODY + CH_CAP, f: 'dark', t: [0.5, 16 + 1.2, 16 + 1.4] }, { d: CH_BODY + CH_CAP, f: 'light', t: [0.5, 16 - 0.9, 16 - 0.9] },
      { d: CH_BODY + CH_CAP, f: 'base', t: [0.5, 16, 16] }, hl('M13.2 25.2A20 20 0 0 1 25.2 13.2', 3.2),
    ],
  },
  check: {
    tri: GLYPH, layers: [...strokeBody('M14 34L27 47L51 17', 10), hl('M17 32.5L25 40.5', 2.4), hl('M29.5 39.5L46 18.5', 2.4)],
  },
  close: {
    tri: GLYPH, layers: [
      { d: 'M16 16L48 48M48 16L16 48', s: 'dark', w: 17 }, { d: 'M16 16L48 48M48 16L16 48', s: 'base', w: 10 },
      { d: 'M48 48L33 33', s: 'sh', w: 3 }, hl('M21.8 18.2L28 24.4', 2.4), hl('M42.2 18.2L37 23.4', 2.4),
    ],
  },
  clapper: { tri: GLYPH, layers: clapperLayers() },
  x2: {
    tri: GLYPH, layers: [
      ...strokeBody('M8 26L22 40M22 26L8 40', 6.5), ...strokeBody('M31 22C31 12 53 12 53 24C53 33 36 40 31 51H55', 7.5),
      hl('M35 20C37 15.5 43 14.5 47 17', 2.2),
    ],
  },
  skins: {
    tri: C.sausage, layers: [
      ...strokeBody('M32 26V19C32 11 42 11 42 17M32 26L10 40H54Z', 3.6, { f: 'steel.base', s: 'steel.dark' }),
      ...body(capsule(16, 45, 48, 45, 9), { shade: SHD_Y(48) }), hl('M16 41H34', 3),
    ],
  },
  jump: {
    tri: GLYPH, layers: [
      ...body(rpoly([[32, 8], [54, 32], [41, 32], [41, 54], [23, 54], [23, 32], [10, 32]], 4), { shade: 'M38 0H72V72H38Z' }),
      hl('M18.5 27.5L28 17', 3), hl('M27.5 38V47', 2.8),
    ],
  },
  splash: { tri: SPLASH, layers: splashLayers() },
  flag: {
    tri: C.go, layers: [
      ...body(rect(10, 10, 16, 56, 3), { f: 'wood.base', s: 'wood.dark', shade: 'M13 0H72V72H13Z' }),
      ...body('M16 12C26 8 32 16 52 14L45 25L52 37C34 39 26 31 16 35Z', { shade: SHD_Y(28) }),
      { d: circ(13, 9, 4.6), f: 'mustard.base', s: 'mustard.dark', w: 3 }, hl('M22 17C27 14.5 31 19.5 38 19', 3),
    ],
  },
  sausage: { tri: C.sausage, layers: sausageLayers() },
};

// ---- rendering -----------------------------------------------------------------------------------------------------
const paths = new Map<string, Path2D>();
const P = (d: string): Path2D => { let p = paths.get(d); if (!p) { p = new Path2D(d); paths.set(d, p); } return p; };

function rgba(hex: string, a: number): string {
  if (a >= 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function col(tok: string, tri: Tri): string {
  const [n, a] = tok.split('@');
  const alpha = a !== undefined ? +a : n === 'hi' ? 0.55 : n === 'sh' ? 0.4 : 1;
  let c: string;
  if (n === 'base' || n === 'dark' || n === 'light') c = tri[n];
  else if (n === 'sh') c = tri.dark;
  else if (n === 'hi' || n === 'white') c = '#ffffff';
  else if (n === 'ink') c = C.ink;
  else { const [k, v] = n.split('.'); c = ((C as unknown as Record<string, Tri>)[k])[v as keyof Tri]; }
  return rgba(c, alpha);
}

function render(ctx: CanvasRenderingContext2D, def: IconDef, tri: Tri, k: number, tx: number, ty: number): void {
  ctx.save();
  ctx.translate(tx + (def.o?.[0] ?? 0) * k, ty + (def.o?.[1] ?? 0) * k);
  ctx.scale(k, k);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  for (const l of def.layers) {
    ctx.save();
    if (l.t) { ctx.translate(l.t[1], l.t[2]); ctx.scale(l.t[0], l.t[0]); }
    if (l.clip) ctx.clip(P(l.clip));
    const p = P(l.d);
    if (l.f) { ctx.fillStyle = col(l.f, tri); ctx.fill(p); }
    if (l.s) { ctx.strokeStyle = col(l.s, tri); ctx.lineWidth = l.w ?? OL; ctx.stroke(p); }
    ctx.restore();
  }
  ctx.restore();
}

let scratch: HTMLCanvasElement | null = null;

/** draw icon `name` centred at (x,y), fitted into size x size */
export function drawIcon(ctx: CanvasRenderingContext2D, name: IconName, x: number, y: number, size: number, opts?: { tint?: Tri; alpha?: number }): void {
  const def = ICONS[name];
  const tri = opts?.tint ?? def.tri;
  const alpha = opts?.alpha ?? 1;
  if (alpha >= 1) { render(ctx, def, tri, size / 64, x - size / 2, y - size / 2); return; }
  if (alpha <= 0) return;
  // translucent: composite offscreen so overlapping layers do not show through each other
  const m = ctx.getTransform();
  const px = Math.max(1, Math.ceil(size * Math.hypot(m.a, m.b)));
  scratch ??= document.createElement('canvas');
  scratch.width = px; scratch.height = px;
  const sctx = scratch.getContext('2d');
  if (!sctx) return;
  render(sctx, def, tri, px / 64, 0, 0);
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.drawImage(scratch, x - size / 2, y - size / 2, size, size);
  ctx.restore();
}

/** standalone <svg> markup for an icon (default colours), for docs and thumbnails */
export function iconSVG(name: IconName): string {
  const def = ICONS[name];
  const tri = def.tri;
  let defs = '', body = '', n = 0;
  for (const l of def.layers) {
    let attrs = `d="${l.d}"`;
    attrs += l.f ? ` fill="${col(l.f, tri)}"` : ' fill="none"';
    if (l.s) attrs += ` stroke="${col(l.s, tri)}" stroke-width="${l.w ?? OL}"`;
    if (l.clip) { const id = `c-${name}-${n++}`; defs += `<clipPath id="${id}"><path d="${l.clip}"/></clipPath>`; attrs += ` clip-path="url(#${id})"`; }
    let el = `<path ${attrs}/>`;
    if (l.t) el = `<g transform="translate(${l.t[1]} ${l.t[2]}) scale(${l.t[0]})">${el}</g>`;
    body += el;
  }
  const o = def.o ?? [0, 0];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" stroke-linejoin="round" stroke-linecap="round">`
    + (defs ? `<defs>${defs}</defs>` : '') + `<g transform="translate(${o[0]} ${o[1]})">${body}</g></svg>`;
}
