/**
 * Generates src/sim/levels/data.ts (literal level data) from maps.ts + LEVEL_GEN in config.ts.
 * Deterministic: same inputs → same file. Run: npm run gen
 */
import { writeFileSync } from 'node:fs';
import { MAP_PATHS } from '../src/sim/levels/maps';
import { LEVEL_GEN, EnemyKind, GRID } from '../src/sim/config';
import type { LevelDef, P, WaveDef, Group } from '../src/sim/levels/types';

const segDist = (x: number, y: number, a: P, b: P) => { const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)); return Math.hypot(x - a[0] - dx * t, y - a[1] - dy * t); };
const distPath = (x: number, y: number, p: P[]) => { let m = Infinity; for (let i = 1; i < p.length; i++) m = Math.min(m, segDist(x, y, p[i - 1], p[i])); return m; };
/** path length within r of (x, y), sampled */
function coverage(x: number, y: number, r: number, paths: P[][]) { let c = 0; for (const p of paths) for (let i = 1; i < p.length; i++) { const L = Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]), n = Math.ceil(L / 0.1); for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, px = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * t, py = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t; if ((px - x) ** 2 + (py - y) ** 2 <= r * r) c += L / n; } } return c; }
/** reserved screen areas (HUD): top row, bottom-right ability buttons, bottom-left wave button */
const reserved = (x: number, y: number) => y < 1.4 || (x > 13.6 && y > 6.6) || (x < 2.4 && y > 7.6);

function pads(paths: P[][], g: number): P[] {
  const airs = paths.map(p => [p[0], p[p.length - 1]] as P[]);
  const goal = paths[0][paths[0].length - 1];
  const n = Math.min(LEVEL_GEN.pads.max, LEVEL_GEN.pads.base + Math.floor((g - 1) / LEVEL_GEN.pads.per) + (paths.length > 1 ? 1 : 0));
  const cand: { x: number; y: number; s: number; exit: boolean; air: number }[] = [];
  for (let c = 0; c < GRID.cols; c++) for (let r = 0; r < GRID.rows; r++) {
    const x = c + 0.5, y = r + 0.5; if (reserved(x, y)) continue;
    const d = Math.min(...paths.map(p => distPath(x, y, p))); if (d < 0.9 || d > 1.6) continue;
    const air = g >= LEVEL_GEN.unlock.bat ? coverage(x, y, 2.6, airs) : 0;
    const s = coverage(x, y, 2.6, paths) + 0.6 * air, exit = Math.hypot(x - goal[0], y - goal[1]) < 3.2; cand.push({ x, y, s, exit, air });
  }
  cand.sort((a, b) => b.s - a.s || a.x - b.x || a.y - b.y);
  const out: P[] = [], ok = (q: { x: number; y: number }) => out.every(([x, y]) => Math.hypot(x - q.x, y - q.y) >= LEVEL_GEN.pads.minSpacing);
  const ex = cand.find(q => q.exit); if (ex) out.push([ex.x, ex.y]);              // a last line of defence near the toy box
  // at least two pads that see the flight line once flyers exist
  if (g >= LEVEL_GEN.unlock.bat) for (const q of [...cand].sort((a, b) => b.air - a.air || a.x - b.x)) { if (out.length >= 3) break; if (ok(q)) out.push([q.x, q.y]); }
  for (const q of cand) { if (out.length >= n) break; if (ok(q)) out.push([q.x, q.y]); }
  return out;
}

function waves(g: number, world: number, nPaths: number, levelMult: number[]): WaveDef[] {
  const n = LEVEL_GEN.waves[world - 1], B = LEVEL_GEN.budget[world - 1], boss = g % 5 === 0, unlocked = (k: EnemyKind) => LEVEL_GEN.unlock[k] <= g;
  const pressure = (['marble', 'bat', 'beetle', 'robot', 'clay'] as EnemyKind[]).filter(unlocked);
  const out: WaveDef[] = [];
  for (let i = 1; i <= n; i++) {
    const budget = (B.base + B.perWave * (i - 1)) * levelMult[g - 1];
    const groups: Group[] = []; let delay = 0, side = 0;
    const add = (e: EnemyKind, hpUnits: number, minN = 1) => {
      let cnt = Math.max(minN, Math.round(hpUnits / LEVEL_GEN.threat[e])); const SW = LEVEL_GEN.swarm[world - 1]; if (e === 'marble') cnt = Math.max(SW.min, cnt);
      while (cnt > 0) { const k = e === 'marble' ? Math.min(cnt, SW.max) : cnt; groups.push({ e, n: k, gap: LEVEL_GEN.gap[e], delay: +delay.toFixed(2), ...(nPaths > 1 ? { path: side++ % nPaths } : {}) }); delay += k * LEVEL_GEN.gap[e] * 0.6 + 1; cnt -= k; }
    };
    if (i <= 2 || !pressure.length) add('bunny', budget, 3);
    else {
      const primary = pressure[(i * 7 + g * 3) % pressure.length];
      // from world 2 most waves pair two different threats, so no single tower solves them
      let second = pressure.length > 1 && i > 4 && g >= 4 ? pressure[(i * 5 + g) % pressure.length] : null;
      if (world >= 2 && pressure.length > 1 && i > 2 && (!second || second === primary)) second = pressure[(pressure.indexOf(primary) + 1 + (i % (pressure.length - 1))) % pressure.length];
      if (second === primary) second = null;
      add('bunny', budget * Math.max(0.1, 1 - LEVEL_GEN.primaryShare - (second ? 0.25 : 0)), 2);
      if (second) add(second, budget * 0.25);
      add(primary, budget * (second ? LEVEL_GEN.primaryShare - 0.1 : LEVEL_GEN.primaryShare));
    }
    if (boss && i === n) { add('bunny', budget * LEVEL_GEN.bossEscort, 3); groups.push({ e: 'king', n: 1, gap: 0, delay: +(delay + 2).toFixed(2) }); }
    out.push({ groups });
  }
  return out;
}

/** all 30 levels for a given per-level budget multiplier (the calibrator calls this in memory) */
export function buildLevels(levelMult: number[] = LEVEL_GEN.levelMult, levelHp: number[] = LEVEL_GEN.levelHp): LevelDef[] { return MAP_PATHS.map((paths, i) => {
  const g = i + 1, world = (Math.floor(i / 10) + 1) as 1 | 2 | 3;
  const intro = (Object.keys(LEVEL_GEN.unlock) as EnemyKind[]).filter(k => LEVEL_GEN.unlock[k] === g);
  return { g, world, map: { id: `m${g}`, world, paths, pads: pads(paths, g), style: world === 1 ? (g % 2 ? 'tape' : 'track') : world === 2 ? 'ruler' : 'string' }, waves: waves(g, world, paths.length, levelMult), hp: levelHp[g - 1], ...(intro.length ? { intro } : {}) };
}); }
export function writeLevels(levels: LevelDef[]) {
const src = `// GENERATED by scripts/gen-levels.ts from maps.ts and LEVEL_GEN (config.ts). Do not edit by hand: change the inputs and run \`npm run gen\`.\nimport type { LevelDef } from './types';\nexport const LEVELS: LevelDef[] = ${JSON.stringify(levels)};\n`;
writeFileSync(new URL('../src/sim/levels/data.ts', import.meta.url), src);
console.log(`wrote ${levels.length} levels, ${levels.reduce((s, l) => s + l.waves.length, 0)} waves, pads ${levels.map(l => l.map.pads.length).join(',')}`);
}
if (process.argv[1]?.endsWith('gen.mjs')) writeLevels(buildLevels());
