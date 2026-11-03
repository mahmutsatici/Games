export interface Palette { top: string; mid: string; deep: string; line: string; rim: string; shade: string; }
export interface WorldDef {
  id: number; gravity: number; friction: number; coinMult: number;
  sky: [string, string, string]; ground: Palette; ridges: [string, string, string]; ridgeRim: string;
  accent: string; star: string; dust: string; rock: [string, string, string];
}
// Moon gravity is the approved prototype value (6.2); Mars heavier, ice moon in between.
export const WORLDS: WorldDef[] = [
  { id: 0, gravity: 6.2, friction: 0.9, coinMult: 1, sky: ['#02040b', '#0a1124', '#1a2442'],
    ground: { top: '#b4bac6', mid: '#878e9d', deep: '#4d5465', line: '#3a4050', rim: '#eef1f7', shade: '#6c7383' },
    ridges: ['#161d33', '#222b45', '#323c5a'], ridgeRim: '#4a5578', accent: '#ff8a3d', star: '#e8eeff', dust: '#cfd4de', rock: ['#9aa1af', '#6e7584', '#c9ced8'] },
  { id: 1, gravity: 7.4, friction: 0.8, coinMult: 1.5, sky: ['#1a0704', '#5a1f12', '#c0603a'],
    ground: { top: '#d9824d', mid: '#b05a31', deep: '#6e2e17', line: '#4a1d0e', rim: '#ffc39b', shade: '#8f4524' },
    ridges: ['#4d1b0f', '#6e2a17', '#934025'], ridgeRim: '#b85a35', accent: '#ffd25a', star: '#ffe6d6', dust: '#e3a077', rock: ['#a5502c', '#73341b', '#d98a5e'] },
  { id: 2, gravity: 6.6, friction: 0.55, coinMult: 2, sky: ['#010816', '#0b2a52', '#2f6fa6'],
    ground: { top: '#f2f9ff', mid: '#c3dcef', deep: '#7aa6c8', line: '#3f6789', rim: '#ffffff', shade: '#9cc0dc' },
    ridges: ['#0f2f55', '#184472', '#255d92'], ridgeRim: '#6fa8d6', accent: '#ff8a3d', star: '#e6f7ff', dust: '#e8f6ff', rock: ['#8fb3cf', '#5f86a6', '#d6ebf8'] },
];

export interface LevelDef {
  world: number; index: number; endless: boolean; seed: number;
  length: number; crates: number; glass: number; rough: number;
  slime: number; meteor: number; ufo: number; rocks: number; gaps: boolean; storm: number; ice: boolean;
  crateValue: number;
}

/** Deterministic level definition. world 0..2, index 0..9. */
export function makeLevel(world: number, index: number, endless = false, seed?: number): LevelDef {
  const n = world * 10 + index, lvl = index + 1, d = endless ? 1.1 : n / 29;
  return {
    world, index, endless, seed: seed ?? (n * 7919 + 13),
    length: endless ? 12000 : Math.round(160 + n * 22 + world * 20),
    crates: endless ? 5 : n < 8 ? 3 : n < 18 ? 4 : n < 26 ? 5 : 6,
    glass: endless ? 2 : n >= 13 ? Math.min(3, 1 + Math.floor((n - 13) / 6)) : 0,
    rough: 0.7 + d * 0.9,
    // hazards per world: slime from level 1, meteors from 5, UFO from 8 (scaled by difficulty)
    slime: endless ? 0.9 : 0.35 + 0.06 * lvl + world * 0.1,
    meteor: endless ? 0.8 : lvl >= 5 ? 0.25 + 0.12 * (lvl - 5) + world * 0.12 : 0,
    ufo: endless ? 0.7 : lvl >= 8 ? 0.4 + 0.2 * (lvl - 8) + world * 0.1 : 0,
    rocks: lvl >= 4 || world > 0 ? 0.3 + d * 0.5 : 0,
    gaps: endless || lvl >= 3 || world > 0,
    storm: world === 1 && (lvl >= 3 || endless) ? 0.5 + 0.05 * lvl : 0,
    ice: world === 2,
    crateValue: 6,
  };
}

// ---- seeded noise ----
export function hash(n: number): number { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export function rng(seed: number) { let s = (seed >>> 0) || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function vnoise(x: number, seed: number) { const i = Math.floor(x), f = x - i; const a = hash(i + seed), b = hash(i + 1 + seed); const u = f * f * (3 - 2 * f); return a + (b - a) * u; }
const sstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export type Feat =
  | { k: 'ramp'; x: number; len: number; rise: number }
  | { k: 'ditch'; x: number; w: number; d: number }
  | { k: 'bowl'; x: number; r: number; d: number; steep: boolean }
  | { k: 'hill'; x: number; r: number; h: number };
export interface Pickup { x: number; y: number; k: 'coin' | 'energy'; taken: boolean; }
export interface Spawn { x: number; n: number; done: boolean; }

export const FLAT_START = 12;
const CELL = 25;

export class Terrain {
  feats: Feat[] = []; ice: { x0: number; x1: number }[] = []; pickups: Pickup[] = [];
  slimes: Spawn[] = []; rocks: Spawn[] = [];
  private cells = new Map<number, Feat[]>();
  private s: number;
  constructor(public L: LevelDef) {
    this.s = L.seed * 31 % 9973;
    this.generate();
  }
  private add(f: Feat) {
    this.feats.push(f);
    const [a, b] = f.k === 'ramp' ? [f.x - 1, f.x + f.len + 2] : f.k === 'ditch' ? [f.x - 1, f.x + f.w + 1] : [f.x - f.r * 1.4, f.x + f.r * 1.4];
    for (let c = Math.floor(a / CELL); c <= Math.floor(b / CELL); c++) { let l = this.cells.get(c); if (!l) this.cells.set(c, l = []); l.push(f); }
  }
  /** rolling hills + small bumps (crates bounce on these) */
  base(x: number): number {
    const L = this.L, s = this.s, ramp = sstep(FLAT_START, FLAT_START + 22, x);
    const a = L.rough * ramp;
    return a * ((vnoise(x / 26, s) - 0.5) * 4.4 + (vnoise(x / 9.5, s + 41) - 0.5) * 1.5 + Math.sin(x * 0.05 + s) * 0.8)
      + ramp * (vnoise(x / 2.2, s + 97) - 0.5) * (0.08 + 0.06 * L.rough);
  }
  h(x: number): number {
    const e = this.L.length;
    if (x < 0) return this.base(0) - x * 0.9;
    let y = this.base(Math.min(x, e - 12));
    if (x > e - 24) { const t = sstep(e - 24, e - 12, x); y = y * (1 - t) + this.base(e - 12) * t; }
    const list = this.cells.get(Math.floor(x / CELL));
    if (list) for (const f of list) y += this.feat(f, x);
    return y;
  }
  private feat(f: Feat, x: number): number {
    switch (f.k) {
      case 'ramp': { const t = (x - f.x) / f.len; if (t < 0) return 0; if (t <= 1) return f.rise * Math.pow(t, 1.25); const u = (x - f.x - f.len) / 0.9; return u < 1 ? f.rise * (1 - u) * (1 - u) : 0; }
      case 'ditch': { const u = (x - f.x) / f.w; if (u <= 0 || u >= 1) return 0; return -f.d * Math.min(1, u / 0.1) * (1 - sstep(0.4, 1, u)); }
      case 'bowl': { const q = Math.abs(x - f.x) / f.r; let y = 0.32 * f.d * Math.exp(-(((q - 1) / 0.16) ** 2)); if (q < 1) y -= f.d * (1 - (f.steep ? q ** 3 : q * q)); return y; }
      case 'hill': { const q = Math.abs(x - f.x) / f.r; return q < 1 ? f.h * (1 - q * q) ** 2 : 0; }
    }
  }
  isIce(x: number) { for (const p of this.ice) if (x >= p.x0 && x <= p.x1) return true; return false; }
  nearFeature(x: number, pad: number) {
    for (const f of this.feats) { const a = f.k === 'ramp' ? f.x : f.k === 'ditch' ? f.x : f.x - f.r, b = f.k === 'ramp' ? f.x + f.len + 1 : f.k === 'ditch' ? f.x + f.w : f.x + f.r; if (x > a - pad && x < b + pad) return true; }
    return false;
  }

  private generate() {
    const L = this.L, r = rng(L.seed), end = L.length - 30, lvl = L.index + 1;
    // guaranteed opening: small hill, then a jump ramp within the first ~10 s of driving
    this.add({ k: 'hill', x: 24, r: 7, h: 1.1 });
    let x = 40;
    while (x < end) {
      const len = 5.5 + r() * 1.5, rise = 0.9 + r() * 0.5 + 0.25 * Math.min(1, L.rough - 0.7);
      this.add({ k: 'ramp', x, len, rise });
      const lip = x + len;
      let landing = lip + 9;
      if (L.gaps && x > 60 && r() < 0.55) { const w = 4 + r() * 1.5; this.add({ k: 'ditch', x: lip + 0.9, w, d: 1.8 + r() * 0.7 }); landing = lip + w + 6; }
      // coin arc along the jump
      const yl = this.h(lip - 0.05);
      for (let i = 0; i < 7; i++) { const t = i / 6, cx = lip + 0.8 + t * 8.5; this.pickups.push({ x: cx, y: yl + 0.9 + Math.sin(Math.PI * t) * 0.9, k: 'coin', taken: false }); }
      const next = x + 80 + r() * 70;
      // bowl craters between ramps (steeper from level 5)
      const bowls = lvl >= 2 || L.world > 0 ? 1 + (r() < 0.4 ? 1 : 0) : 0;
      for (let b = 0; b < bowls; b++) {
        const bx = landing + 8 + r() * Math.max(5, next - landing - 30), rad = 5 + r() * 2.5;
        if (bx + rad < next - 10) this.add({ k: 'bowl', x: bx, r: rad, d: 0.6 + r() * 0.4 + 0.3 * Math.min(1, L.rough - 0.7), steep: lvl >= 5 && r() < 0.5 });
      }
      x = next;
    }
    // finalize pickups on top of terrain
    for (const p of this.pickups) p.y = Math.max(p.y, this.h(p.x) + 0.9);
    // coin lines + energy cells
    let cx = 13, nE = 75;
    while (cx < end + 15) {
      if (!this.nearFeature(cx, 2) && !this.nearFeature(cx + 6, 2)) for (let i = 0; i < 5; i++) { const px = cx + i * 1.3; this.pickups.push({ x: px, y: this.h(px) + 1.0, k: 'coin', taken: false }); }
      cx += 26 + r() * 22;
      if (cx > nE) { const ex = cx - 10; if (!this.nearFeature(ex, 2)) this.pickups.push({ x: ex, y: this.h(ex) + 1.2, k: 'energy', taken: false }); nE += 110 + r() * 50; }
    }
    this.pickups.sort((a, b) => a.x - b.x);
    // slime groups: first one early so level 1 is never empty
    let sx = 30;
    while (sx < end + 10) {
      if (!this.nearFeature(sx, 4)) this.slimes.push({ x: sx, n: 2 + Math.floor(r() * (1.5 + L.slime * 3)), done: false });
      sx += (58 - 30 * Math.min(1, L.slime)) * (0.7 + 0.6 * r());
    }
    if (L.rocks > 0) { let rx = 70; while (rx < end) { if (!this.nearFeature(rx, 4)) this.rocks.push({ x: rx, n: 1 + Math.floor(r() * (1 + L.rocks * 2)), done: false }); rx += (110 - 50 * L.rocks) * (0.7 + 0.6 * r()); } }
    if (L.ice) { let ix = 32; while (ix < end) { const w = 6 + r() * 8; if (!this.nearFeature(ix, 1) && !this.nearFeature(ix + w, 1)) this.ice.push({ x0: ix, x1: ix + w }); ix += 30 + r() * 40; } }
  }
}
