/**
 * Hand-made levels. Units: metres, y up. Rectangles are given by centre (x, y), width, height.
 * Kinds: counter/board/shelf/cabinet (sticky), butter (slippery, no stick), jelly (bouncy, no stick),
 * grill/knife (hazards: back to the last flag). The bun is the goal.
 */
export type Kind = 'counter' | 'board' | 'shelf' | 'cabinet' | 'butter' | 'jelly' | 'grill' | 'knife';
export interface Plat { x: number; y: number; w: number; h: number; kind: Kind; a?: number; move?: { dx: number; dy: number; period: number; phase?: number }; spin?: number; }
export interface LevelDef {
  id: number;
  spawn: [number, number];        // point on a surface top where the sucuk starts standing
  finish: [number, number];       // bottom-centre of the bun (sits on a surface)
  flags: [number, number][];      // checkpoints: bottom of the flag pole (on a surface top)
  coins: [number, number][];
  plats: Plat[];
  par: number;                    // jumps for 3 stars
  killY: number;
  theme: 'counter' | 'shelves' | 'stove' | 'fridge';
}

/** helper: a rectangle whose TOP edge is at `top`, spanning x0..x1 */
const top = (x0: number, x1: number, topY: number, kind: Kind, h = 1): Plat => ({ x: (x0 + x1) / 2, y: topY - h / 2, w: x1 - x0, h, kind });
const arc = (x0: number, y0: number, x1: number, y1: number, n: number, lift: number): [number, number][] =>
  Array.from({ length: n }, (_, i) => { const t = (i + 1) / (n + 1); return [x0 + (x1 - x0) * t, y0 + (y1 - y0) * t + Math.sin(Math.PI * t) * lift] as [number, number]; });

export const LEVELS: LevelDef[] = [
  // 1 — the counter: learn hold & release
  {
    id: 1, theme: 'counter', par: 4, killY: -7,
    spawn: [0, 0], finish: [27.5, 0.5], flags: [[12, 0]],
    plats: [top(-4, 5, 0, 'counter', 12), top(9, 15, 0, 'counter', 12), top(17, 20, 1.5, 'board', 4.5), top(22.5, 30, 0.5, 'counter', 12)],
    coins: [...arc(3, 0.8, 10, 0.8, 4, 2.4), ...arc(14, 0.8, 18.5, 2.3, 3, 2), ...arc(19.5, 2.3, 24, 1.3, 3, 1.8)],
  },
  // 2 — shelves: climb up, walls are sticky too
  {
    id: 2, theme: 'shelves', par: 7, killY: -7,
    spawn: [1, 0], finish: [6.4, 13.8], flags: [[2.6, 5.8], [2.6, 11.4]],
    plats: [
      top(-2, 10, 0, 'counter', 12), { x: -2.6, y: 8, w: 1.2, h: 20, kind: 'cabinet' }, { x: 10.6, y: 8, w: 1.2, h: 20, kind: 'cabinet' },
      top(5.5, 9.4, 3, 'shelf', 0.4), top(0.2, 4.6, 5.8, 'shelf', 0.4), top(5.6, 9.6, 8.6, 'shelf', 0.4), top(0.2, 4.4, 11.4, 'shelf', 0.4), top(5.0, 9.6, 13.8, 'shelf', 0.4),
    ],
    coins: [[7.5, 4.2], [2.4, 7], [7.6, 9.8], [2.3, 12.6], [4.8, 14.6], [5, 2], [5.2, 7.2]],
  },
  // 3 — butter slides, jelly bounces
  {
    id: 3, theme: 'counter', par: 6, killY: -7,
    spawn: [0, 0], finish: [26, 3.6], flags: [[15.5, 0]],
    plats: [
      top(-3, 4, 0, 'counter', 12), top(6, 12, 0, 'butter', 0.6), { x: 9, y: -1.5, w: 6, h: 2.4, kind: 'counter' },
      top(13.5, 18, 0, 'counter', 12), top(20.5, 22.5, -0.4, 'jelly', 0.8), { x: 21.5, y: -4.8, w: 2.4, h: 8, kind: 'counter' }, top(23.5, 28, 3.6, 'shelf', 0.5),
    ],
    coins: [...arc(3, 0.8, 7, 0.6, 3, 2), [9, 1.2], [11, 1.2], ...arc(17, 0.8, 21.5, 0.2, 3, 2.2), [21.5, 2.4], [21.5, 4.2], [24.5, 4.8]],
  },
  // 4 — the hot grill and a moving cutting board
  {
    id: 4, theme: 'stove', par: 5, killY: -7,
    spawn: [0, 0], finish: [28, 0], flags: [[14, 0]],
    plats: [
      top(-3, 3, 0, 'counter', 12), top(3, 11.5, -0.6, 'grill', 2.4), { x: 7, y: 0.3, w: 2.8, h: 0.35, kind: 'board', move: { dx: 2.6, dy: 0, period: 3.6 } },
      top(11.5, 16, 0, 'counter', 12), top(16, 25, -0.6, 'grill', 2.4), top(19.2, 20.6, 1.4, 'board', 2), top(25, 31, 0, 'counter', 12),
    ],
    coins: [...arc(2, 0.8, 7, 0.9, 2, 1.8), ...arc(7, 0.9, 12.5, 0.8, 2, 1.8), ...arc(15, 0.8, 19.9, 2.1, 2, 2), ...arc(19.9, 2.1, 26, 0.8, 3, 2)],
  },
  // 5 — spinning board and knives
  {
    id: 5, theme: 'stove', par: 7, killY: -7,
    spawn: [0, 0], finish: [26.5, 1], flags: [[12.5, 3]],
    plats: [
      top(-3, 3, 0, 'counter', 12), top(3, 11, -2.5, 'grill', 1), { x: 7, y: 1.6, w: 3.6, h: 0.35, kind: 'board', spin: 0.55 },
      top(10.8, 14.2, 3, 'counter', 12), top(14.2, 15.5, -1, 'grill', 1), top(15.5, 28, 1, 'counter', 12),
      { x: 18.2, y: 1.7, w: 0.16, h: 1.4, kind: 'knife' }, { x: 21.4, y: 1.7, w: 0.16, h: 1.4, kind: 'knife' }, { x: 24.4, y: 1.7, w: 0.16, h: 1.4, kind: 'knife' },
    ],
    coins: [...arc(2, 0.8, 7, 2.4, 2, 1.6), ...arc(7, 2.4, 12, 3.8, 2, 1.6), [16.6, 2.4], [19.8, 2.4], [22.9, 2.4], [18.2, 3.6], [21.4, 3.6]],
  },
  // 6 — the fridge: a tall mixed climb
  {
    id: 6, theme: 'fridge', par: 10, killY: -7,
    spawn: [1, 0], finish: [2.2, 17.4], flags: [[7.5, 5.6], [2.4, 11.6]],
    plats: [
      top(-2, 10, 0, 'counter', 12), { x: -2.6, y: 9, w: 1.2, h: 22, kind: 'cabinet' }, { x: 10.6, y: 9, w: 1.2, h: 22, kind: 'cabinet' },
      top(7.8, 9.6, 0.4, 'jelly', 0.5), top(5.8, 9.4, 5.6, 'shelf', 0.4), top(0.4, 4.4, 8.4, 'butter', 0.4),
      { x: 6.5, y: 10.4, w: 2.4, h: 0.35, kind: 'board', move: { dx: 0, dy: 1.3, period: 4 } },
      top(0.4, 4.4, 11.6, 'shelf', 0.4), top(5.6, 9.6, 14.4, 'shelf', 0.4), top(4.6, 5.6, 14.0, 'grill', 0.6), top(0.2, 3.8, 17.4, 'shelf', 0.4),
    ],
    coins: [[8.7, 2.4], [7.6, 7], [2.4, 9.6], [6.5, 12.2], [2.4, 13], [7.6, 15.8], [4.6, 18.4], [5, 3]],
  },
];
