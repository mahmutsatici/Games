/**
 * Balance harness: runs the real sim headless with bot players on every level, many seeds, with and without perks,
 * checks the design targets and writes the results into BALANCE.md (between the results markers).
 * Usage: npm run balance [-- --levels 1-10 --bots smart,greedy --seeds 5 --workers 4]
 */
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Sim } from '../src/sim/sim';
import { LEVELS } from '../src/sim/levels/data';
import { NO_PERKS, ALL_PERKS, TOWER_KINDS, TowerKind, BranchId, TOWERS, Perks, ENEMIES, EnemyKind, TICK_HZ } from '../src/sim/config';
import type { LevelDef } from '../src/sim/levels/types';
import { naiveBot, greedyBot, smartBot, Bot } from './bots';

interface Job { lvl: number; bot: string; perks: boolean; seed: number; }
interface Res extends Job { won: boolean; lives: number; spent: Record<TowerKind, number>; branches: BranchId[]; worstWave: number; worstIdx: number; abilities: number; secs: number; }

const BOTS = ['naive', 'greedy', 'smart', ...TOWER_KINDS.map(k => `only-${k}`)];
function makeBot(name: string, seed: number): Bot { if (name === 'naive') return naiveBot(seed); if (name === 'greedy') return greedyBot(seed); if (name === 'smart') return smartBot(); return smartBot(name.slice(5) as TowerKind); }

export function run(j: Job): Res {
  const L = LEVELS[j.lvl - 1], perks = j.perks ? ALL_PERKS() : NO_PERKS;
  const s = new Sim(L, { seed: j.seed, perks, events: false }), bot = makeBot(j.bot, j.seed);
  const limit = TICK_HZ * 60 * 40;
  while (s.state === 'run' && s.tick < limit) { if (s.tick % 15 === 0) bot.decide(s); s.step(); }
  let worst = 0, wi = -1; s.stats.waveLives.forEach((v, i) => { if ((v ?? 0) > worst) { worst = v; wi = i; } });
  return { ...j, won: s.state === 'won', lives: s.state === 'won' ? s.lives : 0, spent: { ...s.stats.spent }, branches: [...s.stats.branches], worstWave: worst, worstIdx: wi + 1, abilities: s.stats.abilities, secs: s.time };
}

// ---------------------------------------------------------------- DPS-per-gold bench
/**
 * Kill capacity: the largest enemy HP (stream of 24 of the tower's intended target) that a small reference team
 * (2 level-1 soldiers) plus the tested tower stops with at most one leak. The tower's value = extra capacity it adds,
 * as effective DPS (HP per enemy / spawn gap), per gold. This measures control (bubbles) the same way as damage.
 */
export const SCENARIO: Record<TowerKind, { e: EnemyKind; gap: number; label: string; team?: { kind: TowerKind; level: number }[] }> = {
  soldier: { e: 'bunny', gap: 1.0, label: 'single (dust bunnies)' }, catapult: { e: 'marble', gap: 0.32, label: 'groups (marble swarm)' },
  bubble: { e: 'marble', gap: 0.6, label: 'control: extra HP/s a level-2 catapult removes from a loose marble stream thanks to the slow', team: [{ kind: 'catapult', level: 2 }] }, band: { e: 'beetle', gap: 1.7, label: 'armored (beetles)' }, hangar: { e: 'bat', gap: 0.85, label: 'air (sock bats)' },
};
/** HP removed from a stream of 24 enemies (each with `hp`) by the reference team (+ tested tower) */
function removed(tower: { kind: TowerKind; level: number } | null, sc: { e: EnemyKind; gap: number; team?: { kind: TowerKind; level: number }[] }, hp: number) {
  const lane: LevelDef = { g: 1, world: 1, map: { id: 'bench', world: 1, paths: [[[-0.5, 4.5], [16.5, 4.5]]], air: [[[-0.5, 4.5], [16.5, 4.5]]], pads: [[12, 3.5], [10.5, 5.5], [13.5, 5.5]] }, waves: [{ groups: [{ e: sc.e, n: 24, gap: sc.gap, delay: 0 }] }] };
  const s = new Sim(lane, { seed: 3, events: false }); s.gold = 1e9;
  const up = (t: ReturnType<Sim['build']>, lvl: number) => { if (t) while (t.level < Math.min(3, lvl)) s.upgrade(t); };
  const team = sc.team ?? [{ kind: 'soldier' as TowerKind, level: 1 }, { kind: 'soldier' as TowerKind, level: 1 }]; team.forEach((m, i) => up(s.build(1 + i, m.kind), m.level)); if (tower) up(s.build(0, tower.kind), tower.level);
  s.callWave(); s.lives = 1e9; const seen = new Set<number>();
  while (s.state === 'run' && s.tick < TICK_HZ * 200) { for (const e of s.enemies) if (e.alive && !seen.has(e.id)) { seen.add(e.id); e.hp = e.maxHp = hp; } s.step(); }
  const d = s.stats.dmg; return d.soldier + d.catapult + d.bubble + d.band + d.hangar;
}
/** enemy HP at which the reference team alone removes half of the stream's HP */
export function halfHp(sc: { e: EnemyKind; gap: number; team?: { kind: TowerKind; level: number }[] }) { let lo = 1, hi = 5000; for (let k = 0; k < 22; k++) { const m = Math.sqrt(lo * hi); if (removed(null, sc, m) / (24 * m) > 0.5) lo = m; else hi = m; } return lo; }
/** damage per second dealt by one tower alone to an endless stream of immortal targets (armor, splash, chains, range all count) */
function sustained(tower: { kind: TowerKind; level: number }, sc: { e: EnemyKind; gap: number }) {
  const lane: LevelDef = { g: 1, world: 1, map: { id: 'bench', world: 1, paths: [[[-0.5, 4.5], [16.5, 4.5]]], air: [[[-0.5, 4.5], [16.5, 4.5]]], pads: [[12, 3.5]] }, waves: [{ groups: [{ e: sc.e, n: 600, gap: sc.gap, delay: 0 }] }] };
  const s = new Sim(lane, { seed: 3, events: false }); s.gold = 1e9;
  const t = s.build(0, tower.kind); while (t && t.level < tower.level) s.upgrade(t);
  s.callWave(); s.lives = 1e9; let busy = 0; for (let i = 0; i < TICK_HZ * 80; i++) { for (const e of s.enemies) if (e.alive) e.hp = Math.max(e.hp, 1e7); s.step(); }
  const d = s.stats.dmg; void busy; return (d.soldier + d.catapult + d.bubble + d.band + d.hangar) / 80;
}
export function bench(): { kind: TowerKind; target: string; perGold: number[] }[] {
  const out: { kind: TowerKind; target: string; perGold: number[] }[] = [];
  for (const k of TOWER_KINDS) {
    const sc = SCENARIO[k], pg: number[] = [];
    if (k === 'bubble') { const hp = halfHp(sc), base = removed(null, sc, hp), secs = 24 * sc.gap; for (let lvl = 1; lvl <= 3; lvl++) pg.push((removed({ kind: k, level: lvl }, sc, hp) - base) / secs / (TOWERS[k].cost * [1, 1.75, 3.0][lvl - 1])); }
    else for (let lvl = 1; lvl <= 3; lvl++) pg.push(sustained({ kind: k, level: lvl }, sc) / (TOWERS[k].cost * [1, 1.75, 3.0][lvl - 1]));
    out.push({ kind: k, target: sc.label, perGold: pg });
  }
  return out;
}

if (!isMainThread) { const jobs: Job[] = workerData.jobs; for (const j of jobs) parentPort!.postMessage(run(j)); parentPort!.postMessage(null); }
else if (process.argv[1]?.endsWith('balance.mjs')) main();

async function main() {
  const arg = (k: string, d: string) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
  const [l0, l1] = arg('levels', '1-30').split('-').map(Number), seeds = +arg('seeds', '20'), workers = +arg('workers', '4');
  const bots = arg('bots', BOTS.join(',')).split(','), perkModes = arg('perks', 'off,on').split(',').map(x => x === 'on');
  const jobs: Job[] = [];
  for (let lvl = l0; lvl <= (l1 || l0); lvl++) for (const bot of bots) for (const perks of perkModes) for (let seed = 1; seed <= seeds; seed++) jobs.push({ lvl, bot, perks, seed });
  const t0 = Date.now(), results: Res[] = [];
  const self = fileURLToPath(import.meta.url);
  await Promise.all(Array.from({ length: workers }, (_, w) => new Promise<void>(res => {
    const wk = new Worker(self, { workerData: { jobs: jobs.filter((_, i) => i % workers === w) } });
    wk.on('message', m => { if (m === null) { wk.terminate(); res(); } else results.push(m); });
  })));
  console.log(`${jobs.length} runs in ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  report(results, bots, perkModes, l0, l1 || l0);
}

function report(R: Res[], bots: string[], perkModes: boolean[], l0: number, l1: number) {
  const agg = (lvl: number, bot: string, perks: boolean) => { const r = R.filter(x => x.lvl === lvl && x.bot === bot && x.perks === perks); if (!r.length) return null;
    return { win: r.filter(x => x.won).length / r.length, lives: r.reduce((a, x) => a + x.lives, 0) / r.length, worst: r.reduce((a, x) => a + x.worstWave, 0) / r.length, worstIdx: mode(r.map(x => x.worstIdx)), runs: r }; };
  const mode = (a: number[]) => { const m = new Map<number, number>(); a.forEach(v => m.set(v, (m.get(v) ?? 0) + 1)); return [...m.entries()].sort((x, y) => y[1] - x[1])[0]?.[0] ?? 0; };
  const fmt = (a: ReturnType<typeof agg>) => a ? `${Math.round(a.win * 100)}% / ${a.lives.toFixed(1)}` : '-';
  const lines: string[] = [];
  const fails: string[] = [];
  for (const perks of perkModes) {
    lines.push(`\n### Per level, ${perks ? 'all perks' : 'no perks'} (win rate / average lives left)\n`);
    lines.push(`| Lvl | ${bots.join(' | ')} | smart hardest wave (avg lives lost) |`); lines.push(`|---|${bots.map(() => '---').join('|')}|---|`);
    for (let lvl = l0; lvl <= l1; lvl++) { const sm = agg(lvl, 'smart', perks); lines.push(`| ${lvl} | ${bots.map(b => fmt(agg(lvl, b, perks))).join(' | ')} | ${sm ? `wave ${sm.worstIdx}: ${sm.worst.toFixed(1)}` : '-'} |`); }
  }
  // ---- targets ----
  const check = (ok: boolean, msg: string) => { if (!ok) fails.push(msg); return ok; };
  const off = false;
  for (let lvl = l0; lvl <= l1; lvl++) {
    const sm = agg(lvl, 'smart', off), smP = agg(lvl, 'smart', true);
    if (sm) { check(sm.win === 1, `L${lvl}: smart win rate ${Math.round(sm.win * 100)}% (needs 100%)`);
      const [lo, hi] = lvl <= 5 ? [16, 20] : lvl <= 20 ? [10, 16] : [6, 12]; check(sm.lives >= lo && sm.lives <= hi, `L${lvl}: smart lives ${sm.lives.toFixed(1)} outside ${lo}-${hi}`);
      if (lvl <= 10) check(sm.runs.some(r => r.lives >= 18), `L${lvl}: smart never reaches 3 stars`);
      check(sm.worst <= 0.6 * 20, `L${lvl}: smart loses ${sm.worst.toFixed(1)} lives in wave ${sm.worstIdx}`); }
    if (smP && lvl >= 15) check(20 + ALL_PERKS().lives - smP.lives >= 2, `L${lvl}: with all perks smart loses only ${(21 - smP.lives).toFixed(1)} lives`);
    const nv = agg(lvl, 'naive', off); if (nv) { if (lvl <= 3) check(nv.win >= 0.5, `L${lvl}: naive should win (win ${Math.round(nv.win * 100)}%)`); if (lvl >= 6) check(nv.win <= 0.2, `L${lvl}: naive should lose (win ${Math.round(nv.win * 100)}%)`); }
    for (const k of TOWER_KINDS) { const a = agg(lvl, `only-${k}`, off); if (a && lvl > 5) check(a.win <= 0.2, `L${lvl}: only-${k} wins ${Math.round(a.win * 100)}%`); }
  }
  const greedyWorld = (w: number) => { const v: number[] = []; for (let l = (w - 1) * 10 + 1; l <= w * 10; l++) { const a = agg(l, 'greedy', off); if (a) v.push(a.win); } return v.length ? v.reduce((x, y) => x + y, 0) / v.length : -1; };
  const gw = [1, 2, 3].map(greedyWorld);
  if (gw[0] >= 0) check(gw[0] >= 0.6, `greedy wins only ${Math.round(gw[0] * 100)}% of world 1 (should win most)`);
  if (gw[1] >= 0) check(gw[1] > 0.2 && gw[1] < 0.75, `greedy wins ${Math.round(gw[1] * 100)}% of world 2 (should struggle)`);
  if (gw[2] >= 0) check(gw[2] <= 0.35, `greedy wins ${Math.round(gw[2] * 100)}% of world 3 (should lose most)`);
  // tower families and branches in smart runs
  const smartRuns = R.filter(r => r.bot === 'smart' && !r.perks);
  const spent: Record<string, number> = {}; let tot = 0; for (const r of smartRuns) for (const k of TOWER_KINDS) { spent[k] = (spent[k] ?? 0) + r.spent[k]; tot += r.spent[k]; }
  const br: Record<string, number> = {}; for (const r of smartRuns) for (const b of r.branches) br[b] = (br[b] ?? 0) + 1;
  lines.push(`\n### Gold spent per tower family (smart, no perks)\n`); lines.push('| Tower | share |'); lines.push('|---|---|');
  for (const k of TOWER_KINDS) { const sh = tot ? spent[k] / tot : 0; lines.push(`| ${k} | ${(sh * 100).toFixed(1)}% |`); if (smartRuns.length) check(sh >= 0.12, `smart spends only ${(sh * 100).toFixed(1)}% on ${k}`); }
  lines.push(`\n### Level-4 branch choices (smart, no perks)\n`); lines.push('| Tower | branch A | branch B |'); lines.push('|---|---|---|');
  for (const k of TOWER_KINDS) { const [a, b] = TOWERS[k].branches, na = br[a] ?? 0, nb = br[b] ?? 0, n = na + nb; lines.push(`| ${k} | ${a} ${n ? Math.round(na / n * 100) : 0}% | ${b} ${n ? Math.round(nb / n * 100) : 0}% |`); if (n >= 10) check(Math.min(na, nb) / n >= 0.25, `branch split ${k}: ${a} ${na} vs ${b} ${nb}`); }
  // dps per gold bench
  const B = bench(), avg = B.map(b => b.perGold.reduce((x, y) => x + y, 0) / 3), mean = avg.reduce((x, y) => x + y, 0) / avg.length;
  lines.push(`\n### Effective DPS per gold vs intended target (damage towers: sustained DPS on a stream of their target; bubbles: extra HP/s the team removes thanks to the slow; levels 1/2/3)\n`); lines.push('| Tower | target | L1 | L2 | L3 | avg vs mean |'); lines.push('|---|---|---|---|---|---|');
  B.forEach((b, i) => { const dev = avg[i] / mean - 1; lines.push(`| ${b.kind} | ${b.target} | ${b.perGold.map(v => v.toFixed(2)).join(' | ')} | ${dev >= 0 ? '+' : ''}${Math.round(dev * 100)}% |`); check(Math.abs(dev) <= 0.2, `DPS/gold ${b.kind} ${Math.round(dev * 100)}% from the mean`); });
  // smoothness: lives-left curve without big jumps (smart, no perks)
  let prev: number | null = null; for (let lvl = l0; lvl <= l1; lvl++) { const a = agg(lvl, 'smart', off); if (!a) continue; if (prev !== null && Math.abs(a.lives - prev) > 5) fails.push(`L${lvl}: smart lives jump ${prev.toFixed(1)} → ${a.lives.toFixed(1)}`); prev = a.lives; }
  lines.push(`\n### Targets\n`); lines.push(fails.length ? fails.map(f => `- [ ] ${f}`).join('\n') : '- [x] all targets pass');
  const body = lines.join('\n');
  console.log(body);
  const path = new URL('../BALANCE.md', import.meta.url);
  const head = existsSync(path) ? readFileSync(path, 'utf8').split('<!-- results -->')[0] : '# Toy Fort — balance\n\nGenerated by `npm run balance` (bots play the real sim headless).\n\n';
  writeFileSync(path, `${head}<!-- results -->\n_Last run: levels ${l0}-${l1}, bots ${bots.join(', ')}._\n${body}\n`);
  void ENEMIES;
}
export type { Perks };
