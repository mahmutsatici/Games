import type { Platform } from '../platform/types';

export const UPGRADES = ['engine', 'suspension', 'tires', 'battery', 'bed', 'bumper', 'shield', 'turbo'] as const;
export type UpgradeId = typeof UPGRADES[number];
export const MAX_LEVEL: Record<UpgradeId, number> = { engine: 8, suspension: 8, tires: 8, battery: 8, bed: 8, bumper: 5, shield: 3, turbo: 5 };
const BASE_COST: Record<UpgradeId, number> = { engine: 50, suspension: 50, tires: 50, battery: 50, bed: 50, bumper: 60, shield: 90, turbo: 100 };
export const upgradeCost = (id: UpgradeId, lvl: number) => Math.round(BASE_COST[id] * Math.pow(1.6, lvl));

export const DAILY_COINS = [40, 60, 90, 130, 180, 250, 400];

export interface SaveData {
  v: 1;
  coins: number;
  up: Record<UpgradeId, number>;
  stars: Record<string, number>; // "w-l" -> 1..3
  endlessBest: number;
  streak: number;
  lastDay: string;
  muted: boolean;
}

const KEY = 'aykargo.save.v1';
let plat: Platform;
export let save: SaveData = fresh();

function fresh(): SaveData {
  const up = {} as Record<UpgradeId, number>;
  for (const u of UPGRADES) up[u] = 0;
  return { v: 1, coins: 0, up, stars: {}, endlessBest: 0, streak: 0, lastDay: '', muted: false };
}

export function loadSave(p: Platform) {
  plat = p;
  try {
    const raw = p.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw);
      const f = fresh();
      save = { ...f, ...d, up: { ...f.up, ...(d.up || {}) }, stars: d.stars || {} };
    }
  } catch { save = fresh(); }
}
export function persist() {
  try { plat.setItem(KEY, JSON.stringify(save)); } catch { /* ignore */ }
}
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
export function dailyAvailable(): boolean { return save.lastDay !== today(); }
/** Next streak day (1..7) that would be claimed. */
export function dailyNextDay(): number {
  if (save.lastDay === '') return 1;
  const last = new Date(save.lastDay.split('-').map(Number).join('/') ).getTime();
  const diff = Math.round((new Date(today().split('-').join('/')).getTime() - last) / 86400000);
  return diff === 1 ? (save.streak % 7) + 1 : 1;
}
export function claimDaily(): number {
  if (!dailyAvailable()) return 0;
  const day = dailyNextDay();
  save.streak = day; save.lastDay = today();
  const c = DAILY_COINS[day - 1]; save.coins += c; persist();
  return c;
}
export function buy(id: UpgradeId): boolean {
  const l = save.up[id];
  if (l >= MAX_LEVEL[id]) return false;
  const c = upgradeCost(id, l);
  if (save.coins < c) return false;
  save.coins -= c; save.up[id]++; persist(); return true;
}
export const starsOf = (w: number, l: number) => save.stars[`${w}-${l}`] || 0;
export function levelUnlocked(w: number, l: number): boolean {
  if (w === 0 && l === 0) return true;
  if (l > 0) return starsOf(w, l - 1) > 0;
  return starsOf(w - 1, 9) > 0;
}
export const endlessUnlocked = () => starsOf(2, 9) > 0 || save.endlessBest > 0;
