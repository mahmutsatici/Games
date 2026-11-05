import type { Platform } from '../platform/types';
import { CFG } from '../config';

export interface SaveData {
  v: 1; coins: number;
  stars: Record<number, number>;   // level id -> 1..3
  best: Record<number, number>;    // level id -> fewest jumps
  skin: string; owned: string[]; muted: boolean; music: boolean;
}
const KEY = 'zipsucuk.save.v1';
let plat: Platform;
const fresh = (): SaveData => ({ v: 1, coins: 0, stars: {}, best: {}, skin: 'sucuk', owned: ['sucuk'], muted: false, music: true });
export let save: SaveData = fresh();

export function loadSave(p: Platform) {
  plat = p;
  try { const raw = p.getItem(KEY); if (raw) { const d = JSON.parse(raw); save = { ...fresh(), ...d, stars: d.stars || {}, best: d.best || {}, owned: Array.isArray(d.owned) ? d.owned : ['sucuk'] }; } }
  catch { save = fresh(); }
}
export function persist() { try { plat.setItem(KEY, JSON.stringify(save)); } catch { /* storage unavailable */ } }
/** level index i (0-based) is open when the previous level (id = i) has been finished */
export const levelOpen = (i: number) => i === 0 || (save.stars[i] || 0) > 0;
export function skinDef(id = save.skin) { return CFG.skins.find(s => s.id === id) || CFG.skins[0]; }
export function buySkin(id: string): boolean {
  const s = CFG.skins.find(k => k.id === id); if (!s || save.owned.includes(id) || save.coins < s.cost) return false;
  save.coins -= s.cost; save.owned.push(id); save.skin = id; persist(); return true;
}
