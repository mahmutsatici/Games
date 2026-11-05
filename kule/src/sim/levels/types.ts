import type { EnemyKind } from '../config';

/** a point in tile units: (0,0) is the top-left corner of the grid, tile centres are at (c + 0.5, r + 0.5) */
export type P = [number, number];

export interface MapDef {
  id: string;
  world: 1 | 2 | 3;
  /** ground paths: polylines from an entrance (may start off-grid) to the toy box */
  paths: P[][];
  /** flight paths for flyers, one per ground path (default: straight line entrance → toy box) */
  air?: P[][];
  /** build pads (tile centres) */
  pads: P[];
  /** which path segments are a bridge / track etc. is purely visual: see render */
  style?: 'tape' | 'track' | 'ruler' | 'string';
}
export interface Group { e: EnemyKind; n: number; gap: number; delay: number; path?: number; }
export interface WaveDef { groups: Group[]; }
export interface LevelDef {
  /** global index 1..30 (0 = endless) */
  g: number;
  world: 1 | 2 | 3;
  map: MapDef;
  waves: WaveDef[];
  /** per-level enemy HP multiplier (set by the calibrator; bounties are unaffected) */
  hp?: number;
  /** per-level economy multiplier on start gold, bounties and wave bonuses (set by the calibrator) */
  gold?: number;
  /** first appearance of an enemy kind (for the "new enemy" card) */
  intro?: EnemyKind[];
}
