// Serializable game state, backwards-compatible with v1 saves.
import {
  MAX_CELLS,
  MAX_TIER,
  PERK_IDS,
  type FamilyId,
  type PerkId,
  type UpgradeId,
} from './economy';

export type ContractKind = 'deliver' | 'prod' | 'adjacent';
export type ContractRewardKind = 'energy' | 'star' | 'part';

export interface ContractSlot {
  id: number;
  kind: ContractKind;
  targetFamily: FamilyId;
  targetTier: number;
  targetValue: number;
  rewardKind: ContractRewardKind;
  rewardValue: number;
  rewardFamily: FamilyId;
  /** Cooldown remaining in seconds if waiting for next crew transmission (0 = active). */
  cooldown: number;
}

export interface GameState {
  energy: number;
  /** 6x4 storage, index = row * 6 + col, 0 = empty, otherwise tier 1..20. */
  parts: number[];
  /** Module family per cell (0=Gen, 1=Amp, 2=Col, 3=Bat). */
  families: FamilyId[];
  selectedShopFamily: FamilyId;
  upgrades: Record<UpgradeId, number>;
  stars: number;
  orbit: number;
  perks: Record<PerkId, number>;
  contracts: ContractSlot[];
  contractsCompleted: number;
  /** Planet terraforming percentage 0..100 for the current planet. */
  planetProgress: number;
  /** Whether the current planet's Final Boss has been defeated. */
  bossDefeated: boolean;
  /** Total player score across levels. */
  score: number;
  highestTierEver: number;
  highestTierRun: number;
  totalEnergyThisRun: number;
  /** Parts bought this run, index = tier (0 unused). */
  bought: number[];
  /** Epoch ms when the production boost ends (0 = none). */
  boostEnd: number;
  dailyStreak: number;
  /** Local date 'YYYY-MM-DD' of the last daily claim ('' = never). */
  lastClaimDay: string;
  /** Epoch ms of the last save. */
  lastSeen: number;
  sound: boolean;
  volume: number;
  /** '' = automatic (portal / browser). */
  lang: string;
  /** 0 = show merge hand, 1 = point at BUY, 2 = done. */
  onboarding: number;
  /** Epoch ms of the last rewarded free part. */
  freePartAt: number;
}

export function emptyParts(): number[] {
  return new Array<number>(MAX_CELLS).fill(0);
}

export function emptyFamilies(): FamilyId[] {
  return new Array<FamilyId>(MAX_CELLS).fill(0);
}

export function defaultPerks(): Record<PerkId, number> {
  const out = {} as Record<PerkId, number>;
  for (const id of PERK_IDS) out[id] = 0;
  return out;
}

export function initialContracts(): ContractSlot[] {
  return [
    {
      id: 1,
      kind: 'prod',
      targetFamily: 0,
      targetTier: 2,
      targetValue: 48,
      rewardKind: 'energy',
      rewardValue: 220,
      rewardFamily: 0,
      cooldown: 0,
    },
    {
      id: 2,
      kind: 'adjacent',
      targetFamily: 0,
      targetTier: 1,
      targetValue: 8,
      rewardKind: 'part',
      rewardValue: 2,
      rewardFamily: 1,
      cooldown: 0,
    },
    {
      id: 3,
      kind: 'deliver',
      targetFamily: 0,
      targetTier: 3,
      targetValue: 1,
      rewardKind: 'star',
      rewardValue: 1,
      rewardFamily: 0,
      cooldown: 0,
    },
  ];
}

export function newState(): GameState {
  const parts = emptyParts();
  const families = emptyFamilies();
  // Four tier-1 Generators to start with.
  parts[1] = 1;
  parts[2] = 1;
  parts[7] = 1;
  parts[8] = 1;
  return {
    energy: 20,
    parts,
    families,
    selectedShopFamily: 0,
    upgrades: { speed: 0, quality: 0, grid: 0, offline: 0 },
    stars: 0,
    orbit: 0,
    perks: defaultPerks(),
    contracts: initialContracts(),
    contractsCompleted: 0,
    planetProgress: 0,
    bossDefeated: false,
    score: 0,
    highestTierEver: 1,
    highestTierRun: 1,
    totalEnergyThisRun: 0,
    bought: new Array<number>(MAX_TIER + 1).fill(0),
    boostEnd: 0,
    dailyStreak: 0,
    lastClaimDay: '',
    lastSeen: Date.now(),
    sound: true,
    volume: 0.75,
    lang: '',
    onboarding: 0,
    freePartAt: 0,
  };
}
