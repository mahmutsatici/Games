/**
 * Calibrates LEVEL_GEN.levelGold (economy per level: start gold, bounties, wave bonus; enemy HP stays as designed) so the smart bot lands in the lives-left band of each level:
 * levels 1-5 → 18, 6-20 → a smooth ramp 15 → 11, 21-30 → 10 → 8. Bisection per level on a few seeds, then writes
 * the result into config.ts and regenerates the level data. Usage: npm run calibrate [-- --from 1 --to 30 --seeds 6]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Sim } from '../src/sim/sim';
import { LEVEL_GEN, NO_PERKS, TICK_HZ } from '../src/sim/config';
import { buildLevels, writeLevels } from './gen-levels';
import { lookaheadBot } from './bots';

export function targetLives(g: number) { return g <= 5 ? 18 : g <= 20 ? 15 - (g - 6) * (4 / 14) : 10 - (g - 21) * (2 / 9); }
function play(mult: number[], g: number, seeds: number) {
  const L = buildLevels(LEVEL_GEN.levelMult, LEVEL_GEN.levelHp, mult)[g - 1]; let lives = 0, wins = 0;
  for (let seed = 1; seed <= seeds; seed++) { const s = new Sim(L, { seed, perks: NO_PERKS, events: false }), bot = lookaheadBot();
    while (s.state === 'run' && s.tick < TICK_HZ * 2400) { if (s.tick % 15 === 0) bot.decide(s); s.step(); }
    if (s.state === 'won') { wins++; lives += s.lives; } }
  return { lives: lives / seeds, wins: wins / seeds };
}
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { fileURLToPath } from 'node:url';
function calibrateLevel(g: number, seeds: number, start: number[]) {
  const mult = [...start], want = targetLives(g); let lo = 0.4, hi = 6;
  for (let k = 0; k < 7; k++) { const m = Math.sqrt(lo * hi); mult[g - 1] = m; const r = play(mult, g, seeds); if (r.wins === 1 && r.lives >= want) hi = m; else lo = m; }
  mult[g - 1] = +hi.toFixed(3); const r = play(mult, g, seeds);
  return { g, m: mult[g - 1], line: `L${g}: gold x${mult[g - 1]} → smart lives ${r.lives.toFixed(1)} (target ${want.toFixed(1)}), wins ${Math.round(r.wins * 100)}%` };
}
if (!isMainThread) { const { levels, seeds, start } = workerData; for (const g of levels) parentPort!.postMessage(calibrateLevel(g, seeds, start)); parentPort!.postMessage(null); }
else if (process.argv[1]?.endsWith('calibrate.mjs')) (async () => {
  const arg = (k: string, d: number) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
  const from = arg('from', 1), to = arg('to', 30), seeds = arg('seeds', 2), workers = arg('workers', 4), mult = [...LEVEL_GEN.levelGold];
  const levels = Array.from({ length: to - from + 1 }, (_, i) => from + i), self = fileURLToPath(import.meta.url), lines: string[] = [];
  await Promise.all(Array.from({ length: workers }, (_, w) => new Promise<void>(res => { const wk = new Worker(self, { workerData: { levels: levels.filter((_, i) => i % workers === w), seeds, start: mult } });
    wk.on('message', m => { if (m === null) { wk.terminate(); res(); } else { mult[m.g - 1] = m.m; lines[m.g] = m.line; console.log(m.line); } }); })));
  const cfg = new URL('../src/sim/config.ts', import.meta.url), src = readFileSync(cfg, 'utf8');
  writeFileSync(cfg, src.replace(/levelGold: [^\n]*\n/, `levelGold: [${mult.join(', ')}] as number[],\n`));
  writeLevels(buildLevels(LEVEL_GEN.levelMult, LEVEL_GEN.levelHp, mult));
})();
