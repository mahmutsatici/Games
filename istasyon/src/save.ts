// Save / load through the platform layer, with strict validation & seamless migration of v1 saves.
import type { Platform } from './platform';
import {
  ECON_CAP,
  MAX_CELLS,
  MAX_TIER,
  PERKS,
  PERK_IDS,
  UPGRADES,
  UPGRADE_IDS,
  type FamilyId,
} from './economy';
import { emptyParts, initialContracts, newState, type ContractSlot, type GameState } from './state';

export const SAVE_KEY = 'istasyon.save.v1';

function num(v: unknown, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new Error('bad number');
  return v;
}

function int(v: unknown, min: number, max: number): number {
  const n = num(v, min, max);
  if (!Number.isInteger(n)) throw new Error('bad int');
  return n;
}

function validateContract(raw: unknown, fallback: ContractSlot): ContractSlot {
  if (!raw || typeof raw !== 'object') return fallback;
  const c = raw as Record<string, unknown>;
  try {
    const kind = c.kind === 'deliver' || c.kind === 'prod' || c.kind === 'adjacent' ? c.kind : fallback.kind;
    const rewardKind =
      c.rewardKind === 'energy' || c.rewardKind === 'star' || c.rewardKind === 'part'
        ? c.rewardKind
        : fallback.rewardKind;
    return {
      id: int(c.id ?? fallback.id, 1, 1e9),
      kind,
      targetFamily: int(c.targetFamily ?? 0, 0, 3) as FamilyId,
      targetTier: int(c.targetTier ?? 1, 1, MAX_TIER),
      targetValue: num(c.targetValue ?? 1, 0, ECON_CAP),
      rewardKind,
      rewardValue: num(c.rewardValue ?? 1, 0, ECON_CAP),
      rewardFamily: int(c.rewardFamily ?? 0, 0, 3) as FamilyId,
      cooldown: num(c.cooldown ?? 0, 0, 3600),
    };
  } catch {
    return fallback;
  }
}

export function validate(raw: unknown): GameState {
  if (!raw || typeof raw !== 'object') throw new Error('not an object');
  const o = raw as Record<string, unknown>;
  const s = newState();
  s.energy = num(o.energy, 0, ECON_CAP);
  if (!Array.isArray(o.parts) || o.parts.length < 12 || o.parts.length > MAX_CELLS) {
    throw new Error('bad parts');
  }
  s.parts = emptyParts();
  for (let i = 0; i < o.parts.length; i++) {
    s.parts[i] = int(o.parts[i], 0, MAX_TIER);
  }

  // Migrate or validate families array
  if (Array.isArray(o.families) && o.families.length === MAX_CELLS) {
    s.families = o.families.map((f) => (typeof f === 'number' && f >= 0 && f <= 3 ? (f | 0) : 0) as FamilyId);
  }
  for (let i = 0; i < MAX_CELLS; i++) {
    if (s.parts[i] === 0) s.families[i] = 0;
  }

  if (typeof o.selectedShopFamily === 'number' && o.selectedShopFamily >= 0 && o.selectedShopFamily <= 3) {
    s.selectedShopFamily = (o.selectedShopFamily | 0) as FamilyId;
  }

  const up = o.upgrades as Record<string, unknown> | undefined;
  if (!up || typeof up !== 'object') throw new Error('bad upgrades');
  for (const id of UPGRADE_IDS) s.upgrades[id] = int(up[id], 0, UPGRADES[id].max);

  s.stars = int(o.stars, 0, 1e15);
  s.orbit = typeof o.orbit === 'number' && o.orbit >= 0 && o.orbit <= 100 ? (o.orbit | 0) : 0;

  if (o.perks && typeof o.perks === 'object') {
    const pk = o.perks as Record<string, unknown>;
    for (const id of PERK_IDS) {
      const v = pk[id];
      if (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= PERKS[id].max) {
        s.perks[id] = v;
      }
    }
  }

  if (Array.isArray(o.contracts) && o.contracts.length === 3) {
    const defaults = initialContracts();
    s.contracts = o.contracts.map((c, idx) => validateContract(c, defaults[idx]));
  }
  if (typeof o.contractsCompleted === 'number' && o.contractsCompleted >= 0) {
    s.contractsCompleted = Math.min(1e6, o.contractsCompleted | 0);
  }
  if (typeof o.planetProgress === 'number' && Number.isFinite(o.planetProgress)) {
    s.planetProgress = Math.max(0, Math.min(100, o.planetProgress));
  }
  if (typeof o.bossDefeated === 'boolean') {
    s.bossDefeated = o.bossDefeated;
  }
  if (typeof o.score === 'number' && Number.isFinite(o.score) && o.score >= 0) {
    s.score = Math.min(ECON_CAP, Math.floor(o.score));
  }

  s.highestTierEver = int(o.highestTierEver, 1, MAX_TIER);
  s.highestTierRun = int(o.highestTierRun, 1, MAX_TIER);
  s.totalEnergyThisRun = num(o.totalEnergyThisRun, 0, ECON_CAP);
  if (!Array.isArray(o.bought) || o.bought.length !== MAX_TIER + 1) throw new Error('bad bought');
  s.bought = o.bought.map((b) => int(b, 0, 1e9));
  s.boostEnd = num(o.boostEnd, 0, 1e15);
  s.dailyStreak = int(o.dailyStreak, 0, 7);
  if (typeof o.lastClaimDay !== 'string' || !/^(\d{4}-\d{2}-\d{2})?$/.test(o.lastClaimDay)) throw new Error('bad day');
  s.lastClaimDay = o.lastClaimDay;
  s.lastSeen = num(o.lastSeen, 0, 1e15);
  if (typeof o.sound !== 'boolean') throw new Error('bad sound');
  s.sound = o.sound;
  if (typeof o.volume === 'number' && Number.isFinite(o.volume)) {
    s.volume = Math.max(0, Math.min(1, o.volume));
  }
  if (typeof o.lang !== 'string' || o.lang.length > 5) throw new Error('bad lang');
  s.lang = o.lang;
  s.onboarding = int(o.onboarding, 0, 2);
  s.freePartAt = num(o.freePartAt, 0, 1e15);

  // Consistency
  for (const p of s.parts) if (p > s.highestTierRun) s.highestTierRun = p;
  if (s.highestTierRun > s.highestTierEver) s.highestTierEver = s.highestTierRun;
  return s;
}

/** Returns the saved state, or null if there is none / it is corrupt. */
export function loadState(platform: Platform): GameState | null {
  try {
    const txt = platform.getItem(SAVE_KEY);
    if (!txt) return null;
    return validate(JSON.parse(txt));
  } catch (e) {
    console.warn('[save] ignoring corrupt save', e);
    return null;
  }
}

export function saveState(platform: Platform, s: GameState): void {
  try {
    s.lastSeen = Date.now();
    platform.setItem(SAVE_KEY, JSON.stringify(s));
  } catch {
    /* never throw from saving */
  }
}
