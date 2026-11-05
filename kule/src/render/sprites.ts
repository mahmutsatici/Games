/** Rasterises SVG art once into cached canvases at the device pixel ratio; draws them with an origin offset. */
import { TOWER_KINDS, TowerKind, TOWERS, BranchId } from '../sim/config';
import { soldier, catapult, catapultArm, bubble, band, hangar, TOWER_VB } from '../art/towers';
import { bunny, marble, bat, beetle, clay, robot, king, ENEMY_VB, KING_VB } from '../art/enemies';
import { teddy, TEDDY_VB } from '../art/teddy';

export interface Sprite { c: HTMLCanvasElement; ox: number; oy: number; w: number; h: number; }
const cache = new Map<string, Sprite>();
let pxRatio = 2;
export function setSpriteRatio(r: number) { pxRatio = Math.max(1, Math.min(3, r)); }

export function svgToSprite(svg: string, vb: [number, number, number, number], scale = 1): Promise<Sprite> {
  return new Promise((res, rej) => {
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { const w = vb[2] * scale, h = vb[3] * scale, c = document.createElement('canvas'); c.width = Math.ceil(w * pxRatio); c.height = Math.ceil(h * pxRatio);
      c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height); res({ c, ox: vb[0] * scale, oy: vb[1] * scale, w, h }); };
    im.onerror = rej; im.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
export const sprite = (key: string) => cache.get(key);
export function drawSprite(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, s = 1, flip = false, rot = 0) {
  const sp = cache.get(key); if (!sp) return;
  ctx.save(); ctx.translate(x, y); if (rot) ctx.rotate(rot); if (flip) ctx.scale(-s, s); else if (s !== 1) ctx.scale(s, s);
  ctx.drawImage(sp.c, sp.ox, sp.oy, sp.w, sp.h); ctx.restore();
}
export const towerKey = (k: TowerKind, level: number, branch: BranchId | null) => `t:${k}:${level}:${branch ?? ''}`;
const DRAW: Record<TowerKind, (l: number, b: BranchId | null) => string> = { soldier, catapult, bubble, band, hangar };
export const ENEMY_ART = { bunny, marble, bat, beetle, clay, robot, king } as const;

/** every sprite a level can need (towers at all levels and branches, enemies with 2 frames, mascot poses) */
export async function preloadAll(onProgress?: (p: number) => void) {
  const jobs: [string, () => Promise<Sprite>][] = [];
  for (const k of TOWER_KINDS) {
    for (let l = 1; l <= 3; l++) jobs.push([towerKey(k, l, null), () => svgToSprite(DRAW[k](l, null), TOWER_VB)]);
    for (const b of TOWERS[k].branches) jobs.push([towerKey(k, 4, b), () => svgToSprite(DRAW[k](4, b), TOWER_VB)]);
  }
  for (let l = 1; l <= 3; l++) jobs.push([`arm:${l}:`, () => svgToSprite(catapultArm(l, null), [-30, -70, 60, 80])]);
  for (const b of TOWERS.catapult.branches) jobs.push([`arm:4:${b}`, () => svgToSprite(catapultArm(4, b), [-30, -70, 60, 80])]);
  for (const [k, f] of Object.entries(ENEMY_ART)) for (let fr = 0; fr < 2; fr++) jobs.push([`e:${k}:${fr}`, () => svgToSprite(f(fr), k === 'king' ? KING_VB : ENEMY_VB)]);
  for (const pose of ['idle', 'happy', 'sad'] as const) jobs.push([`teddy:${pose}`, () => svgToSprite(teddy(pose), TEDDY_VB)]);
  let done = 0;
  // a few at a time: keeps the main thread responsive and the loading bar moving
  for (let i = 0; i < jobs.length; i += 6) {
    await Promise.all(jobs.slice(i, i + 6).map(async ([key, f]) => { try { cache.set(key, await f()); } catch { /* skip broken art */ } done++; onProgress?.(done / jobs.length); }));
  }
}
export async function loadBoard(key: string, svg: string) { if (!cache.has(key)) cache.set(key, await svgToSprite(svg, [0, 0, 1280, 720])); return cache.get(key)!; }
export function clearBoards() { for (const k of [...cache.keys()]) if (k.startsWith('board:')) cache.delete(k); }
