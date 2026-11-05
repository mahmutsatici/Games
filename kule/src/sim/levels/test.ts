import type { LevelDef } from './types';
/** step-1 test level: one snaking tape path, 10 pads, a mix of every enemy */
export const TEST: LevelDef = {
  g: 1, world: 1,
  map: {
    id: 'test', world: 1, style: 'tape',
    paths: [[[-0.6, 2.5], [4.5, 2.5], [4.5, 6.5], [9.5, 6.5], [9.5, 2.5], [13.5, 2.5], [13.5, 5.5]]],
    pads: [[2.5, 3.5], [3.5, 1.5], [5.5, 4.5], [3.5, 5.5], [7.5, 5.5], [7.5, 7.5], [8.5, 3.5], [10.5, 4.5], [11.5, 1.5], [12.5, 3.5]],
  },
  waves: [
    { groups: [{ e: 'bunny', n: 8, gap: 1.2, delay: 0 }] },
    { groups: [{ e: 'marble', n: 10, gap: 0.4, delay: 0 }, { e: 'bunny', n: 4, gap: 1.5, delay: 3 }] },
    { groups: [{ e: 'bat', n: 6, gap: 1, delay: 0 }, { e: 'bunny', n: 6, gap: 1, delay: 1 }] },
    { groups: [{ e: 'beetle', n: 4, gap: 2, delay: 0 }, { e: 'marble', n: 8, gap: 0.4, delay: 4 }] },
    { groups: [{ e: 'clay', n: 2, gap: 5, delay: 0 }, { e: 'robot', n: 3, gap: 2, delay: 2 }, { e: 'king', n: 1, gap: 0, delay: 6 }] },
  ],
};
