/**
 * Every gameplay number lives here (CLAUDE.md: tunables in config.ts). The balance harness tunes these.
 * Units: tiles (1 tile = 80 px), seconds, gold.
 */
export const TICK_HZ = 30;
export const DT = 1 / TICK_HZ;
export const GRID = { cols: 16, rows: 9, tile: 80 };

export type TowerKind = 'soldier' | 'catapult' | 'bubble' | 'band' | 'hangar';
export const TOWER_KINDS: TowerKind[] = ['soldier', 'catapult', 'bubble', 'band', 'hangar'];
export type BranchId =
  | 'drumSquad' | 'dartGun' | 'crane' | 'slimeBlocks' | 'giantBubble' | 'foamMachine' | 'slingAce' | 'tripleBand' | 'origami' | 'deskFan';

export interface TowerBase {
  cost: number; dmg: number; rate: number; range: number; ground: boolean; air: boolean;
  /** projectile speed in tiles/s (0 = instant hit) */
  shot: number;
  splash?: number; splashFrac?: number;           // catapult
  slow?: number; slowT?: number; slowRadius?: number; // bubble (bursts into a small cloud)
  ignoreArmor?: boolean;                          // rubber band
  chain?: number; chainFrac?: number;             // hangar
  defaultTarget: TargetMode;
  branches: [BranchId, BranchId];
}
export type TargetMode = 'first' | 'last' | 'strong' | 'close';

export const TOWERS: Record<TowerKind, TowerBase> = {
  soldier: { cost: 100, dmg: 8, rate: 1.25, range: 2.5, ground: true, air: true, shot: 9, defaultTarget: 'first', branches: ['drumSquad', 'dartGun'] },
  catapult: { cost: 150, dmg: 14, rate: 0.5, range: 2.8, ground: true, air: false, shot: 0, splash: 0.9, splashFrac: 0.5, defaultTarget: 'first', branches: ['crane', 'slimeBlocks'] },
  bubble: { cost: 110, dmg: 3, rate: 1.6, range: 2.5, ground: true, air: true, shot: 6, slow: 0.45, slowT: 2.0, slowRadius: 0.6, defaultTarget: 'first', branches: ['giantBubble', 'foamMachine'] },
  band: { cost: 200, dmg: 55, rate: 0.4, range: 4.5, ground: true, air: true, shot: 18, ignoreArmor: true, defaultTarget: 'strong', branches: ['slingAce', 'tripleBand'] },
  hangar: { cost: 140, dmg: 11, rate: 1.0, range: 3.0, ground: false, air: true, shot: 8, chain: 1, chainFrac: 0.7, defaultTarget: 'first', branches: ['origami', 'deskFan'] },
};
/** catapult lob flight time (s): the block lands where the target will be */
export const LOB_TIME = 0.7;

/** cost of reaching level L (index = level-1; level 1 is the build cost) as a multiple of base cost */
export const UPGRADE_COST = [1, 0.75, 1.25, 2.0];
export const LEVEL_DMG_MULT = 1.4;          // per level above 1
export const LEVEL_RANGE_ADD = 0.25;        // tiles per level above 1
export const L3_RATE_MULT = 1.15;           // level 3 and 4
export const SELL_REFUND = 0.7;

export const BRANCHES: Record<BranchId, Partial<{ rateMult: number; dmgMult: number; rangeAdd: number; splashAdd: number; slowOnSplash: number; slowSet: number; pierce: number; dotDps: number; dotT: number; trapEvery: number; trapT: number; multi: number; multiFrac: number; chain: number; coneDeg: number; groundFrac: number }>> = {
  drumSquad: { rateMult: 2, dotDps: 2, dotT: 3 },
  dartGun: { pierce: 3 },
  crane: { rangeAdd: 1.5, splashAdd: 0.4 },
  slimeBlocks: { slowOnSplash: 0.2 },
  giantBubble: { trapEvery: 6, trapT: 1 },
  foamMachine: { slowSet: 0.55, rangeAdd: 0.75 },
  slingAce: { dmgMult: 1.8 },
  tripleBand: { multi: 3, multiFrac: 0.6 },
  origami: { chain: 3 },
  deskFan: { coneDeg: 70, groundFrac: 0.5 },
};
/** slow time added by slime blocks on splash */
export const SLIME_SLOW_T = 1.2;
/** dart pierce: enemies within this distance of the dart's line are hit too */
export const PIERCE_WIDTH = 0.45;

export type EnemyKind = 'bunny' | 'marble' | 'bat' | 'beetle' | 'clay' | 'robot' | 'king';
export interface EnemyBase { hp: number; speed: number; armor: number; bounty: number; lives: number; air: boolean; size: number; boss?: boolean; }
export const ENEMIES: Record<EnemyKind, EnemyBase> = {
  bunny: { hp: 30, speed: 1.0, armor: 0, bounty: 5, lives: 1, air: false, size: 0.3 },
  marble: { hp: 10, speed: 1.3, armor: 0, bounty: 2, lives: 1, air: false, size: 0.18 },
  bat: { hp: 22, speed: 1.6, armor: 0, bounty: 6, lives: 1, air: true, size: 0.28 },
  beetle: { hp: 90, speed: 0.7, armor: 8, bounty: 12, lives: 2, air: false, size: 0.36 },
  clay: { hp: 220, speed: 0.45, armor: 0, bounty: 25, lives: 3, air: false, size: 0.42 },
  robot: { hp: 70, speed: 1.2, armor: 4, bounty: 14, lives: 2, air: true, size: 0.34 },
  king: { hp: 1500, speed: 0.5, armor: 6, bounty: 150, lives: 10, air: false, size: 0.6, boss: true },
};
/** seeded per-enemy speed variation (±3%) so runs differ by seed */
export const SPEED_JITTER = 0.06;
/** armor grows with the level (fraction per level above 1), so upgrades don't make it irrelevant */
export const ARMOR_PER_LEVEL = 0.03;
export const CLAY_REGEN = 0.02;            // of max HP per second
export const CLAY_REGEN_DELAY = 2;         // seconds without a hit
export const KING_DROPS = [0.75, 0.5, 0.25];
export const KING_DROP_COUNT = 4;
export const BOSS_SLOW_RESIST = 0.5;       // bosses take 50% of any slow
export const BOSS_STOP_MULT = 0.5;         // and half of any stop/trap time

/** scaling (g = global level index 1..30) */
export const SCALE = {
  hpPerWave: 0.06,
  hpPerLevel: 1.06,
  bountyPerLevel: 1.035,
  startGold: 250, startGoldPerLevel: 15,
  waveBonusBase: 20, waveBonusPerWave: 4,
  earlyBonusPerSec: 3,
  lives: 20,
  star3: 18, star2: 10,
  /** endless: HP growth per wave after the base */
  endlessHpPerWave: 0.13, endlessG: 10,
};
export const WAVE_GAP = 12;          // seconds of countdown between waves
export const FIRST_WAVE_GAP = 20;    // before wave 1 (player builds; can call early)

export const ABILITIES = {
  ball: { dmg: 120, perLevel: 1.10, radius: 1.2, cooldown: 45 },
  flash: { stop: 2.5, bossStop: 1.25, cooldown: 70 },
};
export const WORLD_TWIST = {
  sandSpeed: 0.9,          // world 3: all enemies 10% slower
  sandBubbleWeaker: 0.75,  // world 3: bubble slows 25% weaker
};

export interface Perks {
  dmg: Record<TowerKind, number>;   // +fraction per family
  startGold: number; lives: number; cooldown: number; refund: number;
}
export const NO_PERKS: Perks = { dmg: { soldier: 0, catapult: 0, bubble: 0, band: 0, hangar: 0 }, startGold: 0, lives: 0, cooldown: 0, refund: 0 };

/** sticker album: 10 nodes, star costs, effects; `req` = node that must be owned first */
export const ALBUM: { id: string; cost: number; req?: string; apply: (p: Perks) => void }[] = [
  { id: 'gold1', cost: 1, apply: p => { p.startGold += 50; } },
  { id: 'soldier', cost: 2, req: 'gold1', apply: p => { p.dmg.soldier += 0.05; } },
  { id: 'catapult', cost: 2, req: 'gold1', apply: p => { p.dmg.catapult += 0.05; } },
  { id: 'life', cost: 2, req: 'gold1', apply: p => { p.lives += 1; } },
  { id: 'bubble', cost: 2, req: 'soldier', apply: p => { p.dmg.bubble += 0.05; } },
  { id: 'band', cost: 3, req: 'catapult', apply: p => { p.dmg.band += 0.05; } },
  { id: 'hangar', cost: 2, req: 'life', apply: p => { p.dmg.hangar += 0.05; } },
  { id: 'cooldown', cost: 3, req: 'bubble', apply: p => { p.cooldown += 0.1; } },
  { id: 'refund', cost: 3, req: 'band', apply: p => { p.refund = 0.8; } },
  { id: 'gold2', cost: 3, req: 'hangar', apply: p => { p.startGold += 50; } },
];
export function perksFrom(owned: string[]): Perks {
  const p: Perks = JSON.parse(JSON.stringify(NO_PERKS));
  for (const n of ALBUM) if (owned.includes(n.id)) n.apply(p);
  return p;
}
export const ALL_PERKS = () => perksFrom(ALBUM.map(n => n.id));

/** rewarded: start with extra gold; continue with lives */
export const REWARD = { startGold: 150, continueLives: 10 };

/**
 * Level generator settings (scripts/gen-levels.ts turns these + maps.ts into the literal data in levels/data.ts).
 * Budget = base HP units per wave (before the HP scaling above): base + perWave * (wave - 1).
 */
export const LEVEL_GEN = {
  waves: [10, 15, 20] as number[],
  budget: [{ base: 120, perWave: 24 }, { base: 150, perWave: 22 }, { base: 170, perWave: 20 }],
  /** per-level fine tuning of the budget (index g-1), 1 = neutral */
  levelMult: Array(30).fill(1) as number[],
  /** per-level enemy HP multiplier (index g-1), written by scripts/calibrate.ts */
  levelHp: Array(30).fill(1) as number[],
  /** per-level economy multiplier (index g-1), written by scripts/calibrate.ts */
  levelGold: [0.743, 0.759, 0.716, 0.813, 1.965, 1.116, 0.947, 1.582, 1.301, 1.566, 1.004, 1.591, 1.541, 1.122, 1.816, 1.945, 1.759, 2.072, 1.196, 2.34, 1.059, 1.329, 1.825, 1.796, 2.303, 1.845, 1.35, 1.533, 1.533, 1.704] as number[],
  /** global level at which each enemy first appears */
  unlock: { bunny: 1, marble: 2, bat: 3, beetle: 5, robot: 7, clay: 9, king: 5 } as Record<EnemyKind, number>,
  primaryShare: 0.7,
  /** threat units per enemy (budgets are spent in these, not in raw HP: swarms stay groups of 8-12) */
  threat: { bunny: 30, marble: 24, bat: 32, beetle: 110, clay: 240, robot: 95, king: 0 } as Record<EnemyKind, number>,
  gap: { bunny: 1.0, marble: 0.32, bat: 0.85, beetle: 1.7, clay: 3.2, robot: 1.3, king: 0 } as Record<EnemyKind, number>,
  /** marble swarm group size per world */
  swarm: [{ min: 8, max: 12 }, { min: 10, max: 16 }, { min: 14, max: 20 }],
  /** pads per map: base + g/perPads, capped; +1 for two-entrance maps */
  pads: { base: 8, per: 4, max: 14, minSpacing: 1.45 },
  bossEscort: 0.35,
};
