/** Saves only through the platform layer (never localStorage directly). */
import type { Platform } from './platform/types';
export interface SaveData { v: 1; stars: Record<number, number>; stickers: number; album: string[]; endlessBest: number; muted: boolean; seenIntro: string[]; }
const KEY = 'toyfort.save.v1';
let plat: Platform | null = null;
const fresh = (): SaveData => ({ v: 1, stars: {}, stickers: 0, album: [], endlessBest: 0, muted: false, seenIntro: [] });
export let save: SaveData = fresh();
export function loadSave(p: Platform) { plat = p; try { const r = p.getItem(KEY); if (r) { const d = JSON.parse(r); save = { ...fresh(), ...d, stars: d.stars || {}, album: Array.isArray(d.album) ? d.album : [], seenIntro: Array.isArray(d.seenIntro) ? d.seenIntro : [] }; } } catch { save = fresh(); } }
export function persist() { try { plat?.setItem(KEY, JSON.stringify(save)); } catch { /* storage unavailable */ } }
export const totalStars = () => Object.values(save.stars).reduce((a, b) => a + b, 0);
export const levelOpen = (g: number) => g === 1 || (save.stars[g - 1] ?? 0) > 0;
export const endlessOpen = () => (save.stars[10] ?? 0) > 0;
