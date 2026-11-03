export interface WorldDef { id: number; gravity: number; friction: number; coinMult: number;
  sky: [string, string]; ground: [string, string]; rim: string; far: string; accent: string; star: string; }
export const WORLDS: WorldDef[] = [
  { id: 0, gravity: 4.0, friction: 0.9, coinMult: 1, sky: ['#05060f', '#1d2233'], ground: ['#8d9099', '#4b4e58'], rim: '#d5d8e0', far: '#2a2e3d', accent: '#9fb4ff', star: '#fff' },
  { id: 1, gravity: 6.5, friction: 0.8, coinMult: 1.5, sky: ['#2a0c08', '#8a3a22'], ground: ['#c2512f', '#6e2514'], rim: '#ff9f6e', far: '#5a1f12', accent: '#ffb48a', star: '#ffe3d0' },
  { id: 2, gravity: 5.0, friction: 0.35, coinMult: 2, sky: ['#0a1f3a', '#4f86b8'], ground: ['#e8f4ff', '#8fb6d9'], rim: '#ffffff', far: '#3b6a94', accent: '#9de7ff', star: '#e6f7ff' },
];

export interface LevelDef {
  world: number; index: number; endless: boolean; seed: number;
  length: number; crates: number; rough: number; // 0..1.6 difficulty
  slime: number; meteor: number; ufo: number; rocks: number; ramps: number; // density 0..1 (0 = off)
  crateValue: number;
}

/** Deterministic level definition. index 0..9; world 0..2. endless -> pass endless=true. */
export function makeLevel(world: number, index: number, endless = false, seed?: number): LevelDef {
  const n = world * 10 + index; // 0..29
  const d = endless ? 1.15 : n / 29;
  const lvl = index + 1; // per-world level 1..10
  // hazards come gradually per world: slime from lvl 1, meteors from 5, UFO from 8, scaled by difficulty
  const slime = endless ? 0.8 : 0.25 + 0.5 * (lvl / 10) + world * 0.1;
  const meteor = endless ? 0.7 : lvl >= 5 ? 0.25 + 0.15 * (lvl - 5) + world * 0.12 : 0;
  const ufo = endless ? 0.6 : lvl >= 8 ? 0.4 + 0.2 * (lvl - 8) + world * 0.1 : 0;
  return {
    world, index, endless, seed: seed ?? (n * 7919 + 13),
    length: endless ? 1e9 : Math.round(150 + n * 24 + world * 20),
    crates: endless ? 6 : Math.min(8, 4 + Math.floor(n / 6)),
    rough: 0.2 + d * 0.65,
    slime, meteor, ufo,
    rocks: 0.2 + d * 0.5, ramps: lvl >= 3 || world > 0 ? 0.3 + d * 0.4 : 0,
    crateValue: 8,
  };
}

// ---- seeded noise ----
export function hash(n: number): number { let x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }
export function rng(seed: number) { let s = seed >>> 0 || 1; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function vnoise(x: number, seed: number) { const i = Math.floor(x), f = x - i; const a = hash(i + seed), b = hash(i + 1 + seed); const u = f * f * (3 - 2 * f); return a + (b - a) * u; }

export interface Terrain { h(x: number): number; ramps: { x: number; len: number; rise: number }[]; }
export const FLAT_START = 14;

export function makeTerrain(L: LevelDef): Terrain {
  const s = L.seed * 31;
  const r = rng(L.seed);
  // ramps: pre-placed jump ramps along the course
  const ramps: { x: number; len: number; rise: number }[] = [];
  if (L.ramps > 0) {
    const count = L.endless ? 400 : Math.floor(L.length / 70);
    let x = 60;
    for (let i = 0; i < count; i++) { x += 45 + r() * 70 / Math.max(0.4, L.ramps); ramps.push({ x, len: 6 + r() * 3, rise: 1.0 + r() * 1.0 * L.rough }); }
  }
  const baseH = (x: number) => {
    const ramp = Math.min(1, Math.max(0, (x - FLAT_START) / 40));
    const a = L.rough * ramp;
    return a * (vnoise(x * 0.038, s) * 5.5 + vnoise(x * 0.11, s + 77) * 1.8 + vnoise(x * 0.31, s + 9) * 0.55 * L.rough) ;
  };
  return {
    ramps,
    h(x: number) {
      if (x < 0) return baseH(0) + Math.min(6, -x * 0.5);
      let y = baseH(x);
      // flat finish pad
      if (!L.endless) { const e = L.length; if (x > e - 6) y = baseH(e - 6); }
      // start pad blend
      for (const rp of ramps) {
        if (x > rp.x - 8 && x < rp.x + rp.len + 14) {
          const t = (x - rp.x) / rp.len;
          if (t >= 0 && t <= 1) y += rp.rise * t;
          else if (t > 1) y += Math.max(0, rp.rise * (1 - (x - rp.x - rp.len) / 2.2)); // abrupt drop
        }
      }
      return y;
    },
  };
}
