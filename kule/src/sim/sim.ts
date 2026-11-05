/**
 * Deterministic tower-defense simulation. Pure TypeScript (no DOM): the browser and the Node balance harness run
 * exactly this code. Fixed 30 ticks/s, seeded RNG, pooled enemies/projectiles, a spatial grid for targeting.
 * Render and UI only READ this state and call the player API (build/upgrade/branch/sell/target/callWave/ability).
 */
import {
  DT, TOWERS, TowerKind, TargetMode, BranchId, BRANCHES, UPGRADE_COST, LEVEL_DMG_MULT, LEVEL_RANGE_ADD, L3_RATE_MULT, SELL_REFUND,
  ENEMIES, EnemyKind, CLAY_REGEN, CLAY_REGEN_DELAY, KING_DROPS, KING_DROP_COUNT, BOSS_SLOW_RESIST, BOSS_STOP_MULT, SCALE, WAVE_GAP, FIRST_WAVE_GAP,
  ABILITIES, WORLD_TWIST, Perks, NO_PERKS, LOB_TIME, SLIME_SLOW_T, PIERCE_WIDTH, GRID, SPEED_JITTER, ARMOR_PER_LEVEL,
} from './config';
import type { LevelDef, P } from './levels/types';

// ---------------------------------------------------------------- paths
export interface Path { pts: P[]; cum: number[]; len: number; }
function mkPath(pts: P[]): Path { const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); return { pts, cum, len: cum[cum.length - 1] }; }
/** position + heading at distance d along the path */
export function pathAt(p: Path, d: number, out: { x: number; y: number; a: number }) {
  if (d <= 0) { const [a, b] = [p.pts[0], p.pts[1]]; out.x = a[0]; out.y = a[1]; out.a = Math.atan2(b[1] - a[1], b[0] - a[0]); return out; }
  let i = 1; while (i < p.cum.length - 1 && p.cum[i] < d) i++;
  const a = p.pts[i - 1], b = p.pts[i], seg = p.cum[i] - p.cum[i - 1] || 1, k = Math.min(1, (d - p.cum[i - 1]) / seg);
  out.x = a[0] + (b[0] - a[0]) * k; out.y = a[1] + (b[1] - a[1]) * k; out.a = Math.atan2(b[1] - a[1], b[0] - a[0]); return out;
}

// ---------------------------------------------------------------- entities
export interface Enemy {
  id: number; alive: boolean; kind: EnemyKind; air: boolean; boss: boolean; size: number;
  hp: number; maxHp: number; armor: number; speed: number; bounty: number; lives: number;
  path: number; d: number; x: number; y: number; a: number;
  slow: number; slowT: number; stopT: number; dotDps: number; dotT: number; lastHit: number; drops: number; wave: number;
  /** render helpers: time of the last hit, spawn time */
  hitT: number; bornT: number;
}
export interface Tower {
  id: number; kind: TowerKind; pad: number; x: number; y: number; level: 1 | 2 | 3 | 4; branch: BranchId | null;
  target: TargetMode; cd: number; trapCd: number; spent: number; aim: number; fireT: number;
}
export type ProjKind = 'cork' | 'block' | 'bubble' | 'band' | 'plane' | 'dart';
export interface Projectile {
  alive: boolean; kind: ProjKind; tower: Tower; x: number; y: number; sx: number; sy: number; tx: number; ty: number;
  target: Enemy | null; tid: number; speed: number; dmg: number; t: number; ttl: number;
}
export type SimEvent =
  | { t: 'fire'; tower: Tower }
  | { t: 'hit'; x: number; y: number; kind: ProjKind | 'fan' | 'trap' | 'dot' }
  | { t: 'kill'; e: Enemy; gold: number }
  | { t: 'leak'; e: Enemy }
  | { t: 'build' | 'upgrade' | 'sell'; tower: Tower }
  | { t: 'wave'; n: number }
  | { t: 'drop'; e: Enemy }
  | { t: 'ability'; kind: 'ball' | 'flash'; x: number; y: number }
  | { t: 'end'; won: boolean };

export interface TowerStats { dmg: number; rate: number; range: number; splash: number; splashFrac: number; slow: number; slowT: number; chain: number; chainFrac: number; ignoreArmor: boolean; ground: boolean; air: boolean; }

export interface SimOptions { seed?: number; perks?: Perks; extraGold?: number; events?: boolean; endless?: boolean; }

export class Sim {
  readonly L: LevelDef; readonly perks: Perks; readonly paths: Path[]; readonly airPaths: Path[];
  tick = 0; time = 0; gold = 0; lives = 0; state: 'run' | 'won' | 'lost' = 'run';
  /** index of the next wave to start; waves started so far = wave */
  wave = 0; countdown = FIRST_WAVE_GAP; continued = false;
  enemies: Enemy[] = []; towers: Tower[] = []; proj: Projectile[] = [];
  pads: (Tower | null)[];
  ballCd = 0; flashCd = 0; flashT = 0;
  events: SimEvent[] = []; recordEvents: boolean;
  /** stats for the balance harness */
  stats = { spent: { soldier: 0, catapult: 0, bubble: 0, band: 0, hangar: 0 } as Record<TowerKind, number>, branches: [] as BranchId[], waveLives: [] as number[], leaked: 0, kills: 0, abilities: 0, dmg: { soldier: 0, catapult: 0, bubble: 0, band: 0, hangar: 0, ability: 0 } as Record<TowerKind | 'ability', number> };
  readonly endless: boolean;
  /** mulberry32 state kept on the sim (not in a closure) so clone() copies it */
  private rs = 1; private nextId = 1;
  private r() { this.rs = (this.rs + 0x6d2b79f5) >>> 0; let t = this.rs; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  private spawnQ: { tick: number; kind: EnemyKind; path: number; wave: number }[] = [];
  private waveLeft: number[] = []; private waveLivesStart: number[] = [];
  private grid: Enemy[][]; private gw = GRID.cols + 6; private gh = GRID.rows + 6;
  private tmp = { x: 0, y: 0, a: 0 };
  readonly g: number;
  /** economy multiplier of this level (start gold, bounties, wave bonus) */
  readonly econ: number;

  constructor(L: LevelDef, o: SimOptions = {}) {
    this.L = L; this.perks = o.perks ?? NO_PERKS; this.rs = (o.seed ?? 1) >>> 0; this.recordEvents = o.events ?? true; this.endless = !!o.endless;
    this.g = Math.max(1, L.g || SCALE.endlessG);
    this.paths = L.map.paths.map(mkPath);
    this.airPaths = L.map.paths.map((p, i) => mkPath(L.map.air?.[i] ?? [p[0], p[p.length - 1]]));
    this.pads = L.map.pads.map(() => null);
    this.econ = L.gold ?? 1;
    this.gold = (SCALE.startGold + SCALE.startGoldPerLevel * (this.g - 1)) * this.econ + this.perks.startGold + (o.extraGold ?? 0);
    this.lives = SCALE.lives + this.perks.lives;
    this.grid = Array.from({ length: this.gw * this.gh }, () => []);
  }
  get totalWaves() { return this.endless ? Infinity : this.L.waves.length; }
  get goal(): P { const p = this.L.map.paths[0]; return p[p.length - 1]; }
  private emit(e: SimEvent) { if (this.recordEvents) this.events.push(e); }
  drainEvents() { const e = this.events; this.events = []; return e; }

  /** deep copy for lookahead (bots): same future given the same actions; events are not recorded in the copy */
  clone(): Sim {
    const c = Object.create(Sim.prototype) as Sim; Object.assign(c, this);
    const tm = new Map<Tower, Tower>(), em = new Map<Enemy, Enemy>();
    c.towers = this.towers.map(t => { const n = { ...t }; tm.set(t, n); return n; });
    c.pads = this.pads.map(t => t ? tm.get(t)! : null);
    c.enemies = this.enemies.map(e => { const n = { ...e }; em.set(e, n); return n; });
    c.proj = this.proj.map(p => ({ ...p, tower: tm.get(p.tower) ?? p.tower, target: p.target ? em.get(p.target) ?? null : null }));
    c.events = []; c.recordEvents = false; c.stats = JSON.parse(JSON.stringify(this.stats));
    c.spawnQ = this.spawnQ.map(q => ({ ...q })); c.waveLeft = [...this.waveLeft]; c.waveLivesStart = [...this.waveLivesStart];
    c.grid = Array.from({ length: this.gw * this.gh }, () => []); c.tmp = { x: 0, y: 0, a: 0 };
    return c;
  }

  // ============================================================ player API
  towerCost(kind: TowerKind) { return TOWERS[kind].cost; }
  /** cost of the next level (2..4) of a tower, or 0 at max */
  upgradeCost(t: Tower) { return t.level >= 4 ? 0 : Math.round(TOWERS[t.kind].cost * UPGRADE_COST[t.level]); }
  sellValue(t: Tower) { return Math.floor(t.spent * (this.perks.refund || SELL_REFUND)); }
  build(pad: number, kind: TowerKind): Tower | null {
    if (this.state !== 'run' || pad < 0 || pad >= this.pads.length || this.pads[pad]) return null;
    const c = this.towerCost(kind); if (this.gold < c) return null;
    const [x, y] = this.L.map.pads[pad];
    const t: Tower = { id: this.nextId++, kind, pad, x, y, level: 1, branch: null, target: TOWERS[kind].defaultTarget, cd: 0, trapCd: 0, spent: c, aim: -Math.PI / 2, fireT: -9 };
    this.gold -= c; this.pads[pad] = t; this.towers.push(t); this.stats.spent[kind] += c; this.emit({ t: 'build', tower: t }); return t;
  }
  /** upgrade to level 2 or 3; level 4 needs `branch` */
  upgrade(t: Tower): boolean {
    if (this.state !== 'run' || t.level >= 3) return false;
    const c = this.upgradeCost(t); if (this.gold < c) return false;
    this.gold -= c; t.spent += c; this.stats.spent[t.kind] += c; t.level = (t.level + 1) as 2 | 3; this.emit({ t: 'upgrade', tower: t }); return true;
  }
  branch(t: Tower, b: BranchId): boolean {
    if (this.state !== 'run' || t.level !== 3 || !TOWERS[t.kind].branches.includes(b)) return false;
    const c = this.upgradeCost(t); if (this.gold < c) return false;
    this.gold -= c; t.spent += c; this.stats.spent[t.kind] += c; t.level = 4; t.branch = b; this.stats.branches.push(b); this.emit({ t: 'upgrade', tower: t }); return true;
  }
  sell(t: Tower) {
    if (this.state !== 'run' || this.pads[t.pad] !== t) return;
    this.gold += this.sellValue(t); this.pads[t.pad] = null; this.towers.splice(this.towers.indexOf(t), 1); this.emit({ t: 'sell', tower: t });
  }
  setTarget(t: Tower, m: TargetMode) { t.target = m; }
  /** start the next wave now; early calls pay remaining countdown x bonus */
  callWave(): boolean {
    if (this.state !== 'run' || this.wave >= this.totalWaves) return false;
    // bonus only for the waiting part of the countdown (not for time the current wave is still spawning)
    this.gold += Math.floor(Math.max(0, Math.min(this.countdown, WAVE_GAP)) * SCALE.earlyBonusPerSec); this.startWave(); return true;
  }
  ability(kind: 'ball' | 'flash', x = 0, y = 0): boolean {
    if (this.state !== 'run') return false;
    const cdm = 1 - this.perks.cooldown;
    if (kind === 'ball') {
      if (this.ballCd > 0) return false; this.ballCd = ABILITIES.ball.cooldown * cdm;
      const dmg = ABILITIES.ball.dmg * Math.pow(ABILITIES.ball.perLevel, this.g - 1), r = ABILITIES.ball.radius;
      for (const e of this.enemies) if (e.alive && (e.x - x) ** 2 + (e.y - y) ** 2 <= r * r) this.damage(e, dmg, false, 'ability');
    } else {
      if (this.flashCd > 0) return false; this.flashCd = ABILITIES.flash.cooldown * cdm;
      for (const e of this.enemies) if (e.alive) e.stopT = Math.max(e.stopT, e.boss ? ABILITIES.flash.bossStop : ABILITIES.flash.stop);
      this.flashT = ABILITIES.flash.stop;
    }
    this.stats.abilities++; this.emit({ t: 'ability', kind, x, y }); return true;
  }
  /** rewarded continue: once per level, after losing */
  continueRun(lives: number): boolean { if (this.state !== 'lost' || this.continued) return false; this.continued = true; this.lives = lives; this.state = 'run'; return true; }

  // ============================================================ stats
  stats4(t: Tower): TowerStats {
    const B = TOWERS[t.kind], br = t.branch ? BRANCHES[t.branch] : {}, up = t.level - 1;
    const dmg = B.dmg * Math.pow(LEVEL_DMG_MULT, up) * (1 + this.perks.dmg[t.kind]) * (br.dmgMult ?? 1);
    const rate = B.rate * (t.level >= 3 ? L3_RATE_MULT : 1) * (br.rateMult ?? 1);
    const range = B.range + LEVEL_RANGE_ADD * up + (br.rangeAdd ?? 0);
    let slow = br.slowSet ?? B.slow ?? 0; if (this.L.world === 3) slow *= WORLD_TWIST.sandBubbleWeaker;
    return { dmg, rate, range, splash: (B.splash ?? 0) + (br.splashAdd ?? 0), splashFrac: B.splashFrac ?? 0, slow, slowT: B.slowT ?? 0,
      chain: br.chain ?? B.chain ?? 0, chainFrac: B.chainFrac ?? 0, ignoreArmor: !!B.ignoreArmor, ground: B.ground || t.branch === 'deskFan', air: B.air };
  }
  /** expected damage per second against a target with `armor` (for bots and UI) */
  dps(t: Tower, armor = 0) { const s = this.stats4(t); const per = s.ignoreArmor ? s.dmg : Math.max(1, s.dmg - armor); return per * s.rate; }

  // ============================================================ simulation step
  step() {
    if (this.state !== 'run') return;
    this.tick++; this.time = this.tick * DT;
    this.ballCd = Math.max(0, this.ballCd - DT); this.flashCd = Math.max(0, this.flashCd - DT); this.flashT = Math.max(0, this.flashT - DT);
    // waves: countdown → next wave
    if (this.wave < this.totalWaves) { this.countdown -= DT; if (this.countdown <= 0 && this.spawnQ.length === 0) this.startWave(); }
    // spawns
    while (this.spawnQ.length && this.spawnQ[0].tick <= this.tick) { const s = this.spawnQ.shift()!; this.spawn(s.kind, s.path, s.wave, 0); }
    this.moveEnemies();
    this.buildGrid();
    for (const t of this.towers) this.towerStep(t);
    this.moveProjectiles();
    // end conditions
    if (this.lives <= 0) { this.lives = 0; this.state = 'lost'; this.emit({ t: 'end', won: false }); return; }
    if (!this.endless && this.wave >= this.totalWaves && this.spawnQ.length === 0 && !this.enemies.some(e => e.alive)) { this.state = 'won'; this.emit({ t: 'end', won: true }); }
  }

  private waveDef(i: number) {
    if (!this.endless) return this.L.waves[i];
    // endless: cycle the level's waves, each lap harder (HP scaled in spawn)
    return this.L.waves[i % this.L.waves.length];
  }
  private startWave() {
    const i = this.wave, w = this.waveDef(i); if (!w) return;
    this.wave++; this.countdown = WAVE_GAP + this.waveDuration(w);
    let n = 0;
    for (const g of w.groups) for (let k = 0; k < g.n; k++) { this.spawnQ.push({ tick: this.tick + Math.round((g.delay + k * g.gap) / DT), kind: g.e, path: Math.min(g.path ?? 0, this.paths.length - 1), wave: i }); n++; }
    this.spawnQ.sort((a, b) => a.tick - b.tick);
    this.waveLeft[i] = (this.waveLeft[i] ?? 0) + n; this.waveLivesStart[i] = this.lives;
    this.emit({ t: 'wave', n: this.wave });
  }
  /** seconds until the last enemy of a wave has spawned */
  waveDuration(w: { groups: { n: number; gap: number; delay: number }[] }) { let m = 0; for (const g of w.groups) m = Math.max(m, g.delay + (g.n - 1) * g.gap); return m; }
  /** HP multiplier for wave index i (0-based) */
  hpMult(i: number) { return this.hpMultRaw(i) * (this.L.hp ?? 1); }
  private hpMultRaw(i: number) {
    if (this.endless) { const lap = Math.floor(i / this.L.waves.length); return (1 + SCALE.hpPerWave * (i % this.L.waves.length)) * Math.pow(SCALE.hpPerLevel, this.g - 1) * Math.pow(1 + SCALE.endlessHpPerWave * this.L.waves.length, lap); }
    return (1 + SCALE.hpPerWave * i) * Math.pow(SCALE.hpPerLevel, this.g - 1);
  }
  private spawn(kind: EnemyKind, path: number, wave: number, d: number): Enemy {
    const B = ENEMIES[kind];
    let e = this.enemies.find(q => !q.alive);
    if (!e) { e = {} as Enemy; this.enemies.push(e); }
    // bosses scale with the level only (they always come on the last wave)
    const hp = B.boss ? B.hp * Math.pow(SCALE.hpPerLevel, this.g - 1) * (this.L.hp ?? 1) : B.hp * this.hpMult(wave);
    Object.assign(e, { id: this.nextId++, alive: true, kind, air: B.air, boss: !!B.boss, size: B.size, hp, maxHp: hp, armor: Math.round(B.armor * (1 + ARMOR_PER_LEVEL * (this.g - 1))),
      speed: B.speed * (this.L.world === 3 ? WORLD_TWIST.sandSpeed : 1) * (1 + (this.r() - 0.5) * SPEED_JITTER), bounty: Math.max(1, Math.round(B.bounty * Math.pow(SCALE.bountyPerLevel, this.g - 1) * this.econ)), lives: B.lives,
      path, d, x: 0, y: 0, a: 0, slow: 0, slowT: 0, stopT: 0, dotDps: 0, dotT: 0, lastHit: -9, drops: 0, wave, hitT: -9, bornT: this.time });
    pathAt(e.air ? this.airPaths[path] : this.paths[path], d, this.tmp); e.x = this.tmp.x; e.y = this.tmp.y; e.a = this.tmp.a;
    return e;
  }
  private moveEnemies() {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (e.dotT > 0) { e.dotT -= DT; this.damage(e, e.dotDps * DT, true, 'soldier', true); if (!e.alive) continue; }
      if (e.kind === 'clay' && this.time - e.lastHit > CLAY_REGEN_DELAY) e.hp = Math.min(e.maxHp, e.hp + e.maxHp * CLAY_REGEN * DT);
      if (e.slowT > 0) { e.slowT -= DT; if (e.slowT <= 0) e.slow = 0; }
      if (e.stopT > 0) { e.stopT -= DT; continue; }
      e.d += e.speed * (1 - e.slow) * DT;
      const p = e.air ? this.airPaths[e.path] : this.paths[e.path];
      if (e.d >= p.len) { e.alive = false; this.lives -= e.lives; this.stats.leaked += e.lives; this.waveDone(e.wave); this.emit({ t: 'leak', e }); continue; }
      pathAt(p, e.d, this.tmp); e.x = this.tmp.x; e.y = this.tmp.y; e.a = this.tmp.a;
    }
  }
  private waveDone(i: number) {
    this.waveLeft[i]--;
    if (this.waveLeft[i] === 0) { this.gold += Math.round((SCALE.waveBonusBase + SCALE.waveBonusPerWave * (i + 1)) * this.econ); this.stats.waveLives[i] = this.waveLivesStart[i] - this.lives; }
  }
  /** remaining distance to the toy box (for first/last targeting) */
  remaining(e: Enemy) { return (e.air ? this.airPaths[e.path] : this.paths[e.path]).len - e.d; }

  damage(e: Enemy, raw: number, ignoreArmor: boolean, src: TowerKind | 'ability', silent = false) {
    if (!e.alive) return;
    const d = ignoreArmor ? raw : Math.max(1, raw - e.armor);
    e.hp -= d; e.lastHit = this.time; if (!silent) e.hitT = this.time; this.stats.dmg[src] += Math.min(d, e.hp + d);
    if (e.boss) while (e.drops < KING_DROPS.length && e.hp > 0 && e.hp <= e.maxHp * KING_DROPS[e.drops]) {
      e.drops++; this.emit({ t: 'drop', e });
      for (let k = 0; k < KING_DROP_COUNT; k++) { const m = this.spawn('bunny', e.path, e.wave, Math.max(0, e.d - 0.25 - k * 0.3)); m.stopT = 0.3; this.waveLeft[e.wave]++; }
    }
    if (e.hp <= 0) { e.alive = false; this.gold += e.bounty; this.stats.kills++; this.waveDone(e.wave); this.emit({ t: 'kill', e, gold: e.bounty }); }
  }
  private slowE(e: Enemy, amt: number, t: number) {
    if (e.boss) amt *= BOSS_SLOW_RESIST;
    if (amt > e.slow + 1e-9) { e.slow = amt; e.slowT = t; } else if (Math.abs(amt - e.slow) < 1e-9) e.slowT = Math.max(e.slowT, t);
  }

  // ============================================================ targeting (spatial grid, 1 tile cells)
  private buildGrid() {
    for (const c of this.grid) c.length = 0;
    for (const e of this.enemies) if (e.alive) { const cx = Math.max(0, Math.min(this.gw - 1, Math.floor(e.x) + 3)), cy = Math.max(0, Math.min(this.gh - 1, Math.floor(e.y) + 3)); this.grid[cy * this.gw + cx].push(e); }
  }
  /** visit enemies within r of (x, y) */
  near(x: number, y: number, r: number, f: (e: Enemy, d2: number) => void) {
    const x0 = Math.max(0, Math.floor(x - r) + 3), x1 = Math.min(this.gw - 1, Math.floor(x + r) + 3), y0 = Math.max(0, Math.floor(y - r) + 3), y1 = Math.min(this.gh - 1, Math.floor(y + r) + 3), r2 = r * r;
    for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) for (const e of this.grid[cy * this.gw + cx]) { if (!e.alive) continue; const d2 = (e.x - x) ** 2 + (e.y - y) ** 2; if (d2 <= r2) f(e, d2); }
  }
  pick(t: Tower, s: TowerStats, exclude?: Set<Enemy>): Enemy | null {
    let best: Enemy | null = null, bv = Infinity;
    this.near(t.x, t.y, s.range, (e, d2) => {
      if ((e.air && !s.air) || (!e.air && !s.ground) || exclude?.has(e)) return;
      const v = t.target === 'first' ? this.remaining(e) : t.target === 'last' ? -this.remaining(e) : t.target === 'strong' ? -e.hp : d2;
      if (v < bv || (v === bv && best && e.id < best.id)) { bv = v; best = e; }
    });
    return best;
  }

  // ============================================================ towers
  private towerStep(t: Tower) {
    const s = this.stats4(t), br = t.branch ? BRANCHES[t.branch] : null;
    if (br?.trapEvery) { t.trapCd -= DT; if (t.trapCd <= 0) { let any = false; this.near(t.x, t.y, s.range, e => { any = true; e.stopT = Math.max(e.stopT, (br.trapT ?? 1) * (e.boss ? BOSS_STOP_MULT : 1)); }); if (any) { t.trapCd = br.trapEvery; this.emit({ t: 'hit', x: t.x, y: t.y, kind: 'trap' }); } } }
    t.cd -= DT; if (t.cd > 0) return;
    if (br?.multi) { // triple band: the N strongest in range
      const list: Enemy[] = []; this.near(t.x, t.y, s.range, e => { if ((e.air && s.air) || (!e.air && s.ground)) list.push(e); });
      if (!list.length) { t.cd = 0; return; }
      list.sort((a, b) => b.hp - a.hp || a.id - b.id);
      for (const e of list.slice(0, br.multi)) this.shoot(t, e, s.dmg * (br.multiFrac ?? 1), 'band');
      this.fired(t, list[0], s); return;
    }
    const e = this.pick(t, s); if (!e) { t.cd = 0; return; }
    if (br?.coneDeg) { // desk fan: cone of wind, instant
      const dir = Math.atan2(e.y - t.y, e.x - t.x), half = br.coneDeg * Math.PI / 360;
      this.near(t.x, t.y, s.range, q => { let da = Math.atan2(q.y - t.y, q.x - t.x) - dir; da = Math.atan2(Math.sin(da), Math.cos(da)); if (Math.abs(da) <= half) this.damage(q, s.dmg * (q.air ? 1 : br.groundFrac ?? 0.5), false, 'hangar'); });
      this.emit({ t: 'hit', x: e.x, y: e.y, kind: 'fan' }); this.fired(t, e, s); return;
    }
    const kind: ProjKind = t.kind === 'soldier' ? (t.branch === 'dartGun' ? 'dart' : 'cork') : t.kind === 'catapult' ? 'block' : t.kind === 'bubble' ? 'bubble' : t.kind === 'band' ? 'band' : 'plane';
    this.shoot(t, e, s.dmg, kind); this.fired(t, e, s);
  }
  private fired(t: Tower, e: Enemy, s: TowerStats) { t.cd = 1 / s.rate; t.aim = Math.atan2(e.y - t.y, e.x - t.x); t.fireT = this.time; this.emit({ t: 'fire', tower: t }); }
  private shoot(t: Tower, e: Enemy, dmg: number, kind: ProjKind) {
    let p = this.proj.find(q => !q.alive); if (!p) { p = {} as Projectile; this.proj.push(p); }
    const B = TOWERS[t.kind];
    Object.assign(p, { alive: true, kind, tower: t, x: t.x, y: t.y - 0.25, sx: t.x, sy: t.y - 0.25, tx: e.x, ty: e.y, target: e, tid: e.id, speed: B.shot, dmg, t: 0, ttl: 2 });
    if (kind === 'block') { // lob to where the target will be after LOB_TIME (deterministic lead)
      const path = e.air ? this.airPaths[e.path] : this.paths[e.path]; pathAt(path, e.stopT > 0 ? e.d : e.d + e.speed * (1 - e.slow) * LOB_TIME, this.tmp);
      p.tx = this.tmp.x; p.ty = this.tmp.y; p.ttl = LOB_TIME; p.target = null;
    }
  }
  private moveProjectiles() {
    for (const p of this.proj) {
      if (!p.alive) continue;
      p.t += DT;
      if (p.kind === 'block') { const k = Math.min(1, p.t / p.ttl); p.x = p.sx + (p.tx - p.sx) * k; p.y = p.sy + (p.ty - p.sy) * k; if (k >= 1) { p.alive = false; this.land(p); } continue; }
      const tg = p.target && p.target.alive && p.target.id === p.tid ? p.target : null;
      if (tg) { p.tx = tg.x; p.ty = tg.y; }
      const dx = p.tx - p.x, dy = p.ty - p.y, dist = Math.hypot(dx, dy), stepL = p.speed * DT;
      if (dist <= stepL || p.t > p.ttl) { p.alive = false; if (tg) this.impact(p, tg); continue; }
      p.x += dx / dist * stepL; p.y += dy / dist * stepL;
    }
  }
  private land(p: Projectile) {
    const t = p.tower, s = this.stats4(t), br = t.branch ? BRANCHES[t.branch] : null;
    let primary: Enemy | null = null, bd = Infinity;
    this.near(p.tx, p.ty, s.splash, (e, d2) => { if (!e.air && d2 < bd) { bd = d2; primary = e; } });
    this.near(p.tx, p.ty, s.splash, e => { if (e.air) return; this.damage(e, e === primary ? p.dmg : p.dmg * s.splashFrac, false, 'catapult'); if (br?.slowOnSplash && e.alive) this.slowE(e, br.slowOnSplash, SLIME_SLOW_T); });
    this.emit({ t: 'hit', x: p.tx, y: p.ty, kind: 'block' });
  }
  private impact(p: Projectile, e: Enemy) {
    const t = p.tower, s = this.stats4(t), br = t.branch ? BRANCHES[t.branch] : null;
    this.emit({ t: 'hit', x: e.x, y: e.y, kind: p.kind });
    if (p.kind === 'bubble') { const R = TOWERS.bubble.slowRadius ?? 0; this.near(e.x, e.y, Math.max(R, 0.01), q => this.slowE(q, s.slow, s.slowT)); this.damage(e, p.dmg, false, 'bubble'); return; }
    if (p.kind === 'plane') { // chain to extra flyers
      const hit = new Set<Enemy>([e]); let from = e, dmg = p.dmg; this.damage(e, dmg, false, 'hangar');
      for (let k = 0; k < s.chain; k++) { dmg *= s.chainFrac; let nb: Enemy | null = null, nd = Infinity; this.near(from.x, from.y, 1.6, (q, d2) => { if (q.air && !hit.has(q) && (d2 < nd || (d2 === nd && nb && q.id < nb.id))) { nd = d2; nb = q; } }); if (!nb) break; hit.add(nb); this.damage(nb, dmg, false, 'hangar'); from = nb; }
      return;
    }
    if (p.kind === 'dart') { // pierce: also hits enemies close to the dart's line beyond the target
      const dx = e.x - t.x, dy = e.y - t.y, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, extra: Enemy[] = [];
      this.near(t.x, t.y, s.range + 0.5, q => { if (q === e) return; const along = (q.x - t.x) * ux + (q.y - t.y) * uy, off = Math.abs((q.x - t.x) * uy - (q.y - t.y) * ux); if (along > 0.2 && off < PIERCE_WIDTH) extra.push(q); });
      extra.sort((a, b) => a.id - b.id);
      this.damage(e, p.dmg, false, 'soldier'); for (const q of extra.slice(0, (br?.pierce ?? 1) - 1)) this.damage(q, p.dmg, false, 'soldier');
      return;
    }
    if (p.kind === 'cork' && br?.dotDps && e.alive) { e.dotDps = br.dotDps; e.dotT = br.dotT ?? 3; }
    this.damage(e, p.dmg, p.kind === 'band', t.kind);
  }
}
