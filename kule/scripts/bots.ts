/**
 * Bot players for the balance harness. They act only through the player API of Sim
 * (build / upgrade / branch / sell / setTarget / callWave / ability), like a human would.
 */
import { Sim, Tower, Enemy } from '../src/sim/sim';
import { TOWERS, TOWER_KINDS, TowerKind, BranchId, ENEMIES, EnemyKind, BRANCHES, ABILITIES, LEVEL_GEN, ARMOR_PER_LEVEL } from '../src/sim/config';
import { rng } from '../src/sim/rng';
import type { P } from '../src/sim/levels/types';

export interface Bot { name: string; decide(s: Sim): void; }
const KINDS = Object.keys(ENEMIES) as EnemyKind[];
/** how bunched up each enemy kind travels (other enemies near one target): drives splash / chain / pierce value */
const DENS: Record<EnemyKind, number> = { bunny: 0.9, marble: 2.6, bat: 0.8, beetle: 0.5, clay: 0.25, robot: 0.6, king: 0.6 };

// ---------------------------------------------------------------- coverage (path length inside a circle)
const covCache = new WeakMap<Sim, Map<string, number>>();
function cover(s: Sim, x: number, y: number, r: number, air: boolean): number {
  let m = covCache.get(s); if (!m) { m = new Map(); covCache.set(s, m); }
  const key = `${x},${y},${r.toFixed(2)},${air}`; const v = m.get(key); if (v !== undefined) return v;
  let c = 0;
  for (const p of air ? s.airPaths : s.paths) for (let i = 1; i < p.pts.length; i++) { const a = p.pts[i - 1], b = p.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 0.1);
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t; if ((px - x) ** 2 + (py - y) ** 2 <= r * r) c += L / n; } }
  // with several entrances an enemy only walks one of them: average, not sum
  c /= (air ? s.airPaths : s.paths).length;
  m.set(key, c); return c;
}

// ---------------------------------------------------------------- threat profile of the next waves
interface Threat { k: EnemyKind; n: number; hp: number; }
function threats(s: Sim, ahead = 2): Threat[] {
  const map = new Map<EnemyKind, Threat>();
  const add = (k: EnemyKind, n: number, hp: number) => { const t = map.get(k) ?? { k, n: 0, hp: 0 }; t.hp = (t.hp * t.n + hp * n) / (t.n + n); t.n += n; map.set(k, t); };
  for (const e of s.enemies) if (e.alive) add(e.kind, 1, e.hp);
  for (let i = s.wave; i < Math.min(s.wave + ahead, s.endless ? s.wave + ahead : s.L.waves.length); i++) {
    const w = s.L.waves[i % s.L.waves.length]; for (const g of w.groups) add(g.e, g.n, ENEMIES[g.e].hp * s.hpMult(i));
    if (w.groups.some(g => g.e === 'king')) add('bunny', 12, ENEMIES.bunny.hp * s.hpMult(i));
  }
  return [...map.values()];
}

// ---------------------------------------------------------------- tower model: damage dealt to one passing enemy of kind k
type Fake = Pick<Tower, 'kind' | 'level' | 'branch' | 'x' | 'y'>;
/** damage a slow multiplies: mostly splash (slowed enemies bunch up), a little single-target (smoother bursts) */
function teamDps(s: Sim) { let d = 0; for (const t of s.towers) d += s.dps(t as Tower) * (t.kind === 'catapult' ? 1 : t.kind === 'bubble' ? 0 : 0.2); return d; }
export function potential(s: Sim, t: Fake, k: EnemyKind, team = 0): number {
  const st = s.stats4(t as Tower), E = ENEMIES[k], br = t.branch ? BRANCHES[t.branch] : null;
  if (E.air ? !st.air : !st.ground) return 0;
  const armor = Math.round(E.armor * (1 + ARMOR_PER_LEVEL * (s.g - 1))), raw = st.ignoreArmor ? st.dmg : Math.max(1, st.dmg - armor), dens = DENS[k];
  // overkill: a 55-damage band shot on a 30-HP bunny only counts 30
  const hp = Math.max(1, E.hp * s.hpMult(s.wave)), per = hp / Math.ceil(hp / raw);
  let dps = per * st.rate;
  if (t.kind === 'catapult') dps *= 1 + st.splashFrac * dens + (br?.slowOnSplash ? 0.15 : 0);
  if (t.kind === 'hangar' && !br?.coneDeg) { let f = 1, c = 0; for (let j = 0; j < st.chain; j++) { f *= st.chainFrac; c += f * Math.min(1, dens * 0.7); } dps *= 1 + c; }
  if (br?.coneDeg) dps *= (E.air ? 1 : br.groundFrac ?? 0.5) * (1 + dens * 0.8);
  if (br?.multi) dps *= (br.multiFrac ?? 1) * Math.min(br.multi, 1 + dens * 1.5);
  if (br?.pierce) dps *= 1 + (br.pierce - 1) * Math.min(1, dens * 0.6);
  if (br?.dotDps) dps += br.dotDps;
  if (t.kind === 'bubble') dps += st.slow * (E.boss ? 0.5 : 1) * team * 0.45 + (br?.trapEvery ? team * (br.trapT ?? 1) / br.trapEvery * 0.6 : 0);
  const speed = E.speed * (s.L.world === 3 ? 0.9 : 1), inRange = cover(s, t.x, t.y, st.range, E.air) / speed;
  // throughput: in a stream a tower can only spend about one spacing gap of its time on each enemy
  const gap = LEVEL_GEN.gap[k] || inRange;
  return dps * Math.min(inRange, gap * 1.15);
}

// ---------------------------------------------------------------- shared helpers
function emptyPads(s: Sim) { const out: number[] = []; s.pads.forEach((t, i) => { if (!t) out.push(i); }); return out; }
function padXY(s: Sim, i: number): P { return s.L.map.pads[i]; }
/** abilities: bouncy ball on the biggest cluster near the toy box, night-light when lives are in danger */
export function useAbilities(s: Sim) {
  const danger = (e: Enemy) => s.remaining(e);
  if (s.ballCd <= 0) {
    let best: Enemy | null = null, bv = 0;
    for (const e of s.enemies) { if (!e.alive || danger(e) > 5) continue; let v = 0; for (const q of s.enemies) if (q.alive && (q.x - e.x) ** 2 + (q.y - e.y) ** 2 <= ABILITIES.ball.radius ** 2) v += q.lives * Math.min(1, q.hp / 60); if (v > bv) { bv = v; best = e; } }
    if (best && bv >= 2.5) s.ability('ball', best.x, best.y);
  }
  if (s.flashCd <= 0) { let v = 0; for (const e of s.enemies) if (e.alive && danger(e) < 2.5) v += e.lives; if (v >= 3) s.ability('flash'); }
}

// ---------------------------------------------------------------- naive
export function naiveBot(seed: number): Bot {
  const r = rng(seed * 7 + 1);
  return { name: 'naive', decide(s) {
    const cheapest = TOWER_KINDS.reduce((a, b) => TOWERS[a].cost <= TOWERS[b].cost ? a : b);
    const pads = emptyPads(s); if (pads.length && s.gold >= TOWERS[cheapest].cost) s.build(pads[Math.floor(r() * pads.length)], cheapest);
  } };
}

// ---------------------------------------------------------------- greedy: raw DPS per gold, random pads, ignores air / armor / coverage
export function greedyBot(seed: number): Bot {
  const r = rng(seed * 13 + 5);
  /** raw DPS, weighted by the share of upcoming enemies the tower can hit at all (no armor / coverage / counter logic) */
  const raw = (s: Sim, t: Fake) => { const st = s.stats4(t as Tower), th = threats(s, 1); let n = 0, can = 0; for (const q of th) { n += q.n; if (ENEMIES[q.k].air ? st.air : st.ground) can += q.n; }
    return st.dmg * st.rate * (t.kind === 'catapult' ? 1.6 : 1) * (n ? can / n : 1); };
  return { name: 'greedy', decide(s) {
    for (let guard = 0; guard < 4; guard++) {
      const pads = emptyPads(s); let best: { v: number; cost: number; go: () => void } | null = null;
      if (pads.length) for (const k of TOWER_KINDS) { const cost = TOWERS[k].cost, pad = pads[Math.floor(r() * pads.length)], [x, y] = padXY(s, pad), v = raw(s, { kind: k, level: 1, branch: null, x, y }) / cost; if (!best || v > best.v) best = { v, cost, go: () => s.build(pad, k) }; }
      for (const t of s.towers) { if (t.level >= 4) continue; const cost = s.upgradeCost(t), cur = raw(s, t);
        const opts: { lvl: 2 | 3 | 4; b: BranchId | null }[] = t.level < 3 ? [{ lvl: (t.level + 1) as 2 | 3, b: null }] : TOWERS[t.kind].branches.map(b => ({ lvl: 4 as const, b }));
        for (const o of opts) { const v = (raw(s, { ...t, level: o.lvl, branch: o.b }) - cur) / cost; if (!best || v > best.v) best = { v, cost, go: () => o.b ? s.branch(t, o.b) : s.upgrade(t) }; } }
      if (!best || best.cost > s.gold) return; best.go();
    }
  } };
}

// ---------------------------------------------------------------- smart (and single-type variants)
export function smartBot(only?: TowerKind): Bot {
  return { name: only ? `only-${only}` : 'smart', decide(s) {
    useAbilities(s);
    for (let guard = 0; guard < 4; guard++) {
      const th = threats(s, 3); if (!th.length) return;
      const team = teamDps(s);
      // current team potential per enemy kind vs what is needed to kill one (1.6x safety)
      const have = new Map<EnemyKind, number>(); for (const q of th) { let p = 0; for (const t of s.towers) p += potential(s, t, q.k, team); have.set(q.k, p); }
      const value = (t: Fake, base?: Fake) => { let v = 0; for (const q of th) { const add = potential(s, t, q.k, team) - (base ? potential(s, base, q.k, team) : 0), need = q.hp * 1.6, def = Math.max(0, need - have.get(q.k)!);
        v += q.n * (Math.min(add, def) + 0.12 * add) / q.hp * ENEMIES[q.k].lives; } return v; };
      const opts: { v: number; cost: number; go: () => void }[] = [];
      const kinds = only ? [only] : TOWER_KINDS;
      for (const pad of emptyPads(s)) { const [x, y] = padXY(s, pad); for (const k of kinds) { const c = TOWERS[k].cost; opts.push({ v: value({ kind: k, level: 1, branch: null, x, y }) / c, cost: c, go: () => s.build(pad, k) }); } }
      for (const t of s.towers) { if (t.level >= 4) continue; const c = s.upgradeCost(t);
        if (t.level < 3) opts.push({ v: value({ ...t, level: (t.level + 1) as 2 | 3 }, t) / c, cost: c, go: () => s.upgrade(t) });
        else for (const b of TOWERS[t.kind].branches) opts.push({ v: value({ ...t, level: 4, branch: b }, t) / c, cost: c, go: () => s.branch(t, b) }); }
      if (!opts.length) return;
      opts.sort((a, b) => b.v - a.v);
      const best = opts[0]; if (best.v <= 0) return;
      const pick = best.cost <= s.gold ? best : opts.find(o => o.cost <= s.gold && o.v >= best.v * 0.7);
      if (!pick) return; pick.go();
    }
  } };
}
