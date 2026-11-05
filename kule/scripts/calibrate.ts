/**
 * Calibrates LEVEL_GEN.levelMult (wave strength per level) so the smart bot lands in the lives-left band of each level:
 * levels 1-5 → 18, 6-20 → a smooth ramp 15 → 11, 21-30 → 10 → 8. Bisection per level on a few seeds, then writes
 * the result into config.ts and regenerates the level data. Usage: npm run calibrate [-- --from 1 --to 30 --seeds 6]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Sim } from '../src/sim/sim';
import { LEVEL_GEN, NO_PERKS, TICK_HZ } from '../src/sim/config';
import { buildLevels, writeLevels } from './gen-levels';
import { smartBot } from './bots';

export function targetLives(g: number) { return g <= 5 ? 18 : g <= 20 ? 15 - (g - 6) * (4 / 14) : 10 - (g - 21) * (2 / 9); }
function play(mult: number[], g: number, seeds: number) {
  const L = buildLevels(mult)[g - 1]; let lives = 0, wins = 0;
  for (let seed = 1; seed <= seeds; seed++) { const s = new Sim(L, { seed, perks: NO_PERKS, events: false }), bot = smartBot();
    while (s.state === 'run' && s.tick < TICK_HZ * 2400) { if (s.tick % 15 === 0) bot.decide(s); s.step(); }
    if (s.state === 'won') { wins++; lives += s.lives; } }
  return { lives: lives / seeds, wins: wins / seeds };
}
const arg = (k: string, d: number) => { const i = process.argv.indexOf('--' + k); return i > 0 ? +process.argv[i + 1] : d; };
const from = arg('from', 1), to = arg('to', 30), seeds = arg('seeds', 6);
const mult = [...LEVEL_GEN.levelMult];
for (let g = from; g <= to; g++) {
  const want = targetLives(g); let lo = 0.15, hi = 4;
  for (let k = 0; k < 9; k++) { const m = Math.sqrt(lo * hi); mult[g - 1] = m; const r = play(mult, g, seeds); if (r.wins === 1 && r.lives >= want) lo = m; else hi = m; }
  mult[g - 1] = +lo.toFixed(3); const r = play(mult, g, seeds);
  console.log(`L${g}: mult ${mult[g - 1]} → smart lives ${r.lives.toFixed(1)} (target ${want.toFixed(1)}), wins ${Math.round(r.wins * 100)}%`);
}
const cfg = new URL('../src/sim/config.ts', import.meta.url), src = readFileSync(cfg, 'utf8');
writeFileSync(cfg, src.replace(/levelMult: [^\n]*\n/, `levelMult: [${mult.join(', ')}] as number[],\n`));
writeLevels(buildLevels(mult));
