// Economy, Module Families, Adjacency Synergy Solver, and Star Tech Tree.
export const MAX_TIER = 20;
export const ECON_CAP = 1e300;

export const MAX_COLS = 6;
export const MAX_ROWS = 4;
export const MAX_CELLS = MAX_COLS * MAX_ROWS;
export const GRID_SIZES: ReadonlyArray<readonly [number, number]> = [
  [4, 3],
  [5, 3],
  [5, 4],
  [6, 4],
];

// ---------- 4 Module Families ----------
// 0: Generator (Orange) - High base energy production
// 1: Amplifier (Amber)  - Boosts adjacent Generators/Collectors/Batteries
// 2: Collector (Cyan)   - Auto-collects meteors in its row + boosts neighbors
// 3: Battery   (Lime)   - Stores capacitor charge (global board multiplier + offline boost)
export type FamilyId = 0 | 1 | 2 | 3;
export const FAMILY_IDS: readonly FamilyId[] = [0, 1, 2, 3];

export function unlockedFamilies(highestTierEver: number): FamilyId[] {
  const out: FamilyId[] = [0];
  if (highestTierEver >= 2) out.push(1); // Amplifier unlocks early (~45s-2m)
  if (highestTierEver >= 4) out.push(2); // Collector unlocks at Tier 4 (~3m)
  if (highestTierEver >= 6) out.push(3); // Battery unlocks at Tier 6 (~6m)
  return out;
}

// ---------- Star Tech Tree (8 Perks) ----------
export type PerkId =
  | 'core_flux'
  | 'amp_link'
  | 'drone_bay'
  | 'start_tier'
  | 'col_beam'
  | 'cap_bank'
  | 'contract_vip'
  | 'diagonal_bus';

export const PERK_IDS: readonly PerkId[] = [
  'core_flux',
  'amp_link',
  'drone_bay',
  'start_tier',
  'col_beam',
  'cap_bank',
  'contract_vip',
  'diagonal_bus',
];

export interface PerkDef {
  id: PerkId;
  max: number;
  baseCost: number;
  costStep: number;
  familyIcon: FamilyId;
}

export const PERKS: Record<PerkId, PerkDef> = {
  core_flux: { id: 'core_flux', max: 5, baseCost: 1, costStep: 1, familyIcon: 0 },
  amp_link: { id: 'amp_link', max: 5, baseCost: 1, costStep: 1, familyIcon: 1 },
  drone_bay: { id: 'drone_bay', max: 3, baseCost: 2, costStep: 2, familyIcon: 2 },
  start_tier: { id: 'start_tier', max: 3, baseCost: 2, costStep: 2, familyIcon: 0 },
  col_beam: { id: 'col_beam', max: 3, baseCost: 2, costStep: 2, familyIcon: 2 },
  cap_bank: { id: 'cap_bank', max: 3, baseCost: 3, costStep: 2, familyIcon: 3 },
  contract_vip: { id: 'contract_vip', max: 3, baseCost: 3, costStep: 3, familyIcon: 1 },
  diagonal_bus: { id: 'diagonal_bus', max: 1, baseCost: 5, costStep: 5, familyIcon: 1 },
};

export function perkCost(id: PerkId, level: number): number {
  const p = PERKS[id];
  return p.baseCost + level * p.costStep;
}

// ---------- Base Production & Adjacency Synergy ----------
export function prod(tier: number): number {
  if (tier <= 0) return 0;
  return 1.6 * Math.pow(2.5, tier - 1);
}

export function familyBaseFactor(family: FamilyId): number {
  switch (family) {
    case 0:
      return 1.0; // Generator: full direct output
    case 1:
      return 0.4; // Amplifier: lower direct output, high neighbor boost
    case 2:
      return 0.65; // Collector: medium output + row auto-collector
    case 3:
      return 0.55; // Battery: medium output + global capacitor & offline
  }
}

export interface AdjacencyLink {
  fromCell: number;
  toCell: number;
  family: FamilyId;
  bonusPct: number;
}

export interface BoardSimResult {
  totalBase: number;
  cellOutputs: number[];
  links: AdjacencyLink[];
  batteryBonusMult: number;
  adjacentGenPairs: number;
}

export function evaluateBoard(
  parts: readonly number[],
  families: readonly FamilyId[],
  cols: number,
  rows: number,
  perks: Record<PerkId, number>,
  orbit: number,
  flareFamily: number, // -1 if none, else 0..3
): BoardSimResult {
  const cellOutputs = new Array<number>(MAX_CELLS).fill(0);
  const links: AdjacencyLink[] = [];
  let batteryBonusPct = 0;
  let adjacentGenPairs = 0;

  const diag = (perks.diagonal_bus || 0) > 0;
  const orbitLinkMult = 1 + orbit * 0.15;
  const genPerkMult = 1 + (perks.core_flux || 0) * 0.3;
  const ampPerkAdd = (perks.amp_link || 0) * 0.15;
  const batPerkAdd = (perks.cap_bank || 0) * 0.08;

  const neighbors = (r: number, c: number): number[] => {
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        if (!diag && Math.abs(dr) + Math.abs(dc) > 1) continue;
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          out.push(nr * MAX_COLS + nc);
        }
      }
    }
    return out;
  };

  // First pass: calculate battery global boost & amplifier/collector link bonuses
  const boostMult = new Array<number>(MAX_CELLS).fill(1);

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * MAX_COLS + c;
      const tier = parts[idx];
      if (tier <= 0) continue;
      const fam = families[idx] ?? 0;

      if (fam === 3) {
        // Battery adds global capacitor bonus + boosts adjacent cells slightly
        batteryBonusPct += (0.06 + batPerkAdd) * tier;
      }

      if (fam === 1) {
        // Amplifier boosts neighbors
        const pct = (0.3 + 0.12 * tier + ampPerkAdd) * orbitLinkMult;
        for (const nIdx of neighbors(r, c)) {
          if (parts[nIdx] > 0) {
            boostMult[nIdx] += pct;
            links.push({ fromCell: idx, toCell: nIdx, family: 1, bonusPct: Math.round(pct * 100) });
          }
        }
      } else if (fam === 2) {
        // Collector links to adjacent Generators or Batteries
        const pct = (0.18 + 0.05 * tier) * orbitLinkMult;
        for (const nIdx of neighbors(r, c)) {
          if (parts[nIdx] > 0 && (families[nIdx] === 0 || families[nIdx] === 3)) {
            boostMult[nIdx] += pct;
            links.push({ fromCell: idx, toCell: nIdx, family: 2, bonusPct: Math.round(pct * 100) });
          }
        }
      } else if (fam === 0) {
        // Check adjacent generator pairs (for contracts & synergy)
        for (const nIdx of neighbors(r, c)) {
          if (nIdx > idx && parts[nIdx] > 0 && (families[nIdx] ?? 0) === 0) {
            adjacentGenPairs++;
            boostMult[idx] += 0.1;
            boostMult[nIdx] += 0.1;
            links.push({ fromCell: idx, toCell: nIdx, family: 0, bonusPct: 10 });
          }
        }
      }
    }
  }

  const batteryBonusMult = 1 + batteryBonusPct;
  let totalBase = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * MAX_COLS + c;
      const tier = parts[idx];
      if (tier <= 0) continue;
      const fam = families[idx] ?? 0;
      let out = prod(tier) * familyBaseFactor(fam) * boostMult[idx] * batteryBonusMult;
      if (fam === 0) out *= genPerkMult;
      if (flareFamily === fam) out *= 2.0; // Solar flare doubles output of active family
      cellOutputs[idx] = out;
      totalBase += out;
    }
  }

  return { totalBase, cellOutputs, links, batteryBonusMult, adjacentGenPairs };
}

export function clampEcon(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, ECON_CAP);
}

// ---------- Shop & Upgrades ----------
export function shopTier(highestTierRun: number, startTierPerk = 0): number {
  return Math.min(MAX_TIER - 2, Math.max(1, highestTierRun - 3 + startTierPerk));
}

export function buyCost(tier: number, n: number): number {
  return clampEcon(4 * Math.pow(2.42, tier - 1) * Math.pow(1.075, n));
}

export type UpgradeId = 'speed' | 'quality' | 'grid' | 'offline';
export const UPGRADE_IDS: readonly UpgradeId[] = ['speed', 'quality', 'grid', 'offline'];

export const UPGRADES: Record<UpgradeId, { max: number; base: number; growth: number }> = {
  speed: { max: 10, base: 40, growth: 2.05 },
  quality: { max: 10, base: 140, growth: 2.25 },
  grid: { max: 3, base: 600, growth: 18 },
  offline: { max: 6, base: 350, growth: 2.8 },
};

export function upgradeCost(id: UpgradeId, level: number): number {
  const u = UPGRADES[id];
  return clampEcon(u.base * Math.pow(u.growth, level));
}

export function dropInterval(speedLevel: number, droneBayPerk = 0): number {
  const raw = 6.4 - 0.44 * speedLevel - 0.35 * droneBayPerk;
  return Math.max(1.5, raw);
}

export function rollDropTier(qualityLevel: number, highestTierRun = 1, startTierPerk = 0, r: number = Math.random()): number {
  const base = Math.max(1, highestTierRun - 4 + startTierPerk);
  const pPlus2 = qualityLevel >= 5 ? 0.05 * (qualityLevel - 4) : 0;
  const pPlus1 = 0.06 * qualityLevel;
  let t = base;
  if (r < pPlus2) t = base + 2;
  else if (r < pPlus2 + pPlus1) t = base + 1;
  return Math.min(MAX_TIER - 1, Math.max(1, t));
}

export function offlineCapSeconds(batteryCount = 0, capBankPerk = 0): number {
  return Math.min(12, 3 + batteryCount * 1.2 + capBankPerk * 1.5) * 3600;
}

export const OFFLINE_RATE = 0.5;

// ---------- Boost & Cooldowns ----------
export const BOOST_DURATION_MS = 4 * 60 * 1000;
export const BOOST_MAX_MS = 12 * 60 * 1000;
export const FREE_PART_COOLDOWN_MS = 3 * 60 * 1000;

// ---------- Prestige ----------
export const PRESTIGE_MIN_TIER = 11;

export function prestigeStars(totalEnergyThisRun: number): number {
  if (totalEnergyThisRun < 5e5) return 1;
  return Math.max(1, Math.floor(Math.sqrt(totalEnergyThisRun / 1.5e6)));
}

// ---------- Daily Reward Date Helper ----------
export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isNextDay(prevDateStr: string, todayStr: string): boolean {
  if (!prevDateStr) return false;
  const prev = new Date(prevDateStr);
  const cur = new Date(todayStr);
  const diffTime = cur.getTime() - prev.getTime();
  const diffDays = Math.round(diffTime / (1000 * 3600 * 24));
  return diffDays === 1;
}

export function isSameDay(prevDateStr: string, todayStr: string): boolean {
  return prevDateStr === todayStr;
}
