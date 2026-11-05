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

const DEFS: LevelDef[] = [
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
  // ---------------- more levels (ids 7–20); LEVELS below orders everything by world ----------------
  // 7 — kitchen: stepping boards over the soup
  {
    id: 7, theme: 'counter', par: 4, killY: -7,
    spawn: [0, 0], finish: [24, 0.5], flags: [[14.2, 2.4]],
    plats: [top(-3, 4, 0, 'counter', 12), top(7.5, 10, 1.2, 'board', 0.5), top(13, 15.5, 2.4, 'board', 0.5), top(18.5, 26, 0.5, 'counter', 12)],
    coins: [...arc(3, 0.8, 8.7, 1.9, 3, 1.8), ...arc(8.7, 1.9, 14.2, 3.1, 3, 1.8), ...arc(14.2, 3.1, 20, 1.2, 3, 1.8)],
  },
  // 8 — kitchen: butter slide, a jelly hop, then up the boards
  {
    id: 8, theme: 'counter', par: 6, killY: -7,
    spawn: [0, 0], finish: [33, 1], flags: [[21.5, 2]],
    plats: [
      top(-3, 3, 0, 'counter', 12), top(3, 9, 0, 'butter', 0.6), { x: 6, y: -1.5, w: 6, h: 2.4, kind: 'counter' }, top(11, 13.5, 1.5, 'board', 0.5),
      top(15.5, 17.5, -0.4, 'jelly', 0.8), { x: 16.5, y: -4.8, w: 2, h: 8, kind: 'counter' }, top(20, 23, 2, 'counter', 12), top(25, 27, 3.4, 'board', 0.5), top(29.5, 35, 1, 'counter', 12),
    ],
    coins: [[5, 1], [7, 1], ...arc(9, 0.8, 12.2, 2.2, 2, 1.6), ...arc(12.2, 2.2, 16.5, 0.6, 2, 1.6), [16.5, 2.6], ...arc(21.5, 2.7, 26, 4.1, 2, 1.6), ...arc(26, 4.1, 31, 1.7, 2, 1.6)],
  },
  // 9 — kitchen: a sliding board, a spinning board and a knife
  {
    id: 9, theme: 'counter', par: 8, killY: -7,
    spawn: [0, 0], finish: [28.8, 1.5], flags: [[13.5, 1]],
    plats: [
      top(-3, 3, 0, 'counter', 12), { x: 7.5, y: 0.3, w: 2.8, h: 0.35, kind: 'board', move: { dx: 2.4, dy: 0, period: 3.6 } }, top(11.5, 15, 1, 'counter', 12),
      { x: 18.8, y: 2.4, w: 3.6, h: 0.35, kind: 'board', spin: 0.5 }, top(22.5, 31, 1.5, 'counter', 12), { x: 25.6, y: 2.2, w: 0.16, h: 1.4, kind: 'knife' },
    ],
    coins: [...arc(2, 0.8, 7.5, 1, 2, 1.8), ...arc(7.5, 1, 12.5, 1.8, 2, 1.8), ...arc(14.5, 1.8, 18.8, 3.2, 2, 1.6), ...arc(18.8, 3.2, 23.5, 2.2, 2, 1.6), [25.6, 3.8]],
  },
  // 10 — pantry: the mirrored climb, with a knife guarding a shelf
  {
    id: 10, theme: 'shelves', par: 11, killY: -7,
    spawn: [7, 0], finish: [1.6, 13.8], flags: [[5.4, 5.8], [5.4, 11.4]],
    plats: [
      top(-2, 10, 0, 'counter', 12), { x: -2.6, y: 8, w: 1.2, h: 20, kind: 'cabinet' }, { x: 10.6, y: 8, w: 1.2, h: 20, kind: 'cabinet' },
      top(-1.4, 2.5, 3, 'shelf', 0.4), top(3.4, 7.8, 5.8, 'shelf', 0.4), top(-1.6, 2.4, 8.6, 'shelf', 0.4), top(3.6, 7.8, 11.4, 'shelf', 0.4), top(-1.6, 3, 13.8, 'shelf', 0.4),
      { x: -1.2, y: 9.3, w: 0.16, h: 1.4, kind: 'knife' },
    ],
    coins: [[0.5, 4.2], [5.6, 7], [0.4, 9.8], [5.7, 12.6], [3.2, 14.6], [3, 2], [2.8, 7.2], [8.6, 3]],
  },
  // 11 — pantry: ride the lift board up
  {
    id: 11, theme: 'shelves', par: 8, killY: -7,
    spawn: [1, 0], finish: [2.2, 13], flags: [[1.8, 7.4]],
    plats: [
      top(-2, 10, 0, 'counter', 12), { x: -2.6, y: 8, w: 1.2, h: 20, kind: 'cabinet' }, { x: 10.6, y: 8, w: 1.2, h: 20, kind: 'cabinet' },
      top(5.6, 9.4, 2.8, 'shelf', 0.4), { x: 5, y: 4.8, w: 2.4, h: 0.35, kind: 'board', move: { dx: 0, dy: 1.3, period: 4 } },
      top(0.2, 3.6, 7.4, 'shelf', 0.4), top(6.4, 9.4, 10.2, 'shelf', 0.4), top(0.2, 4.4, 13, 'shelf', 0.4),
    ],
    coins: [[7.5, 4], [5, 7], [1.9, 8.6], [7.9, 11.4], [2.3, 14.2], [5, 2], [5.2, 12]],
  },
  // 12 — pantry: across the high shelves
  {
    id: 12, theme: 'shelves', par: 5, killY: -7,
    spawn: [0, 0], finish: [26.5, 5], flags: [[12.5, 4.6]],
    plats: [
      top(-3, 4, 0, 'counter', 12), top(6, 9, 2.6, 'shelf', 0.4), top(11, 14, 4.6, 'shelf', 0.4), top(16.5, 19.5, 3, 'shelf', 0.4),
      top(19.5, 22, 3, 'butter', 0.4), top(24, 28.5, 5, 'shelf', 0.4),
    ],
    coins: [...arc(2, 0.8, 7.5, 3.3, 2, 1.6), ...arc(7.5, 3.3, 12.5, 5.3, 2, 1.6), ...arc(12.5, 5.3, 18, 3.7, 2, 1.6), [20.7, 4], ...arc(18, 3.7, 25.5, 5.7, 2, 2)],
  },
  // 13 — pantry: the tall climb
  {
    id: 13, theme: 'shelves', par: 13, killY: -7,
    spawn: [1, 0], finish: [2.2, 16.8], flags: [[2, 5.6], [2, 11.2]],
    plats: [
      top(-2, 10, 0, 'counter', 12), { x: -2.6, y: 10, w: 1.2, h: 24, kind: 'cabinet' }, { x: 10.6, y: 10, w: 1.2, h: 24, kind: 'cabinet' },
      top(6, 9.6, 2.8, 'shelf', 0.4), top(0.2, 4, 5.6, 'shelf', 0.4), top(6, 9.6, 8.4, 'shelf', 0.4), top(0.2, 4, 11.2, 'shelf', 0.4),
      top(6, 9.6, 14, 'shelf', 0.4), top(0.2, 4.4, 16.8, 'shelf', 0.4), { x: 9.0, y: 9.1, w: 0.16, h: 1.4, kind: 'knife' },
    ],
    coins: [[7.8, 4], [2, 6.8], [7.4, 9.6], [2, 12.4], [7.8, 15.2], [2.3, 18], [5, 4.2], [5, 12.6]],
  },
  // 14 — stove: boards over a long grill
  {
    id: 14, theme: 'stove', par: 5, killY: -7,
    spawn: [0, 0], finish: [26.8, 0.5], flags: [[17, 2.2]],
    plats: [
      top(-3, 3, 0, 'counter', 12), top(3, 21, -0.6, 'grill', 2.4), top(6, 8, 1, 'board', 0.4),
      { x: 12, y: 1.4, w: 2.6, h: 0.35, kind: 'board', move: { dx: 1.8, dy: 0, period: 3.2 } }, top(16, 18, 2.2, 'board', 0.4),
      top(21, 29, 0.5, 'counter', 12), { x: 24, y: 1.2, w: 0.16, h: 1.4, kind: 'knife' },
    ],
    coins: [...arc(2, 0.8, 7, 1.7, 2, 1.6), ...arc(7, 1.7, 12, 2.1, 2, 1.6), ...arc(12, 2.1, 17, 2.9, 2, 1.6), ...arc(17, 2.9, 22, 1.2, 2, 1.6), [24, 2.8]],
  },
  // 15 — stove: spinning boards over the burner
  {
    id: 15, theme: 'stove', par: 6, killY: -7,
    spawn: [0, 0], finish: [26.5, 1], flags: [[12.2, 0.8]],
    plats: [
      top(-3, 2, 0, 'counter', 12), top(2, 22, -2.5, 'grill', 1), { x: 6.5, y: 1.4, w: 3.6, h: 0.35, kind: 'board', spin: 0.5 },
      top(11, 13.5, 0.8, 'counter', 12), { x: 17.5, y: 1.8, w: 3.6, h: 0.35, kind: 'board', spin: -0.55 }, top(22, 28.5, 1, 'counter', 12),
    ],
    coins: [...arc(1, 0.8, 6.5, 2.2, 2, 1.6), ...arc(6.5, 2.2, 12, 1.6, 2, 1.6), ...arc(12.5, 1.6, 17.5, 2.6, 2, 1.6), ...arc(17.5, 2.6, 23, 1.8, 2, 1.6)],
  },
  // 16 — stove: climb the boards over the burner, a sliding board, knives
  {
    id: 16, theme: 'stove', par: 6, killY: -7,
    spawn: [0, 0], finish: [30, 2], flags: [[14.5, 3.4]],
    plats: [
      top(-3, 3, 0, 'counter', 12), top(3, 16, -0.6, 'grill', 2.4), top(6, 8, 1, 'board', 0.4), top(9.8, 11.8, 2.2, 'board', 0.4),
      top(13.5, 16, 3.4, 'counter', 1.2), top(16, 23.5, -0.6, 'grill', 2.4), { x: 19.5, y: 2.6, w: 2.6, h: 0.35, kind: 'board', move: { dx: 1.6, dy: 0, period: 3.4 } },
      top(23.5, 32, 2, 'counter', 12), { x: 26, y: 2.7, w: 0.16, h: 1.4, kind: 'knife' }, { x: 28.4, y: 2.7, w: 0.16, h: 1.4, kind: 'knife' },
    ],
    coins: [...arc(2, 0.8, 7, 1.7, 2, 1.6), ...arc(7, 1.7, 10.8, 2.9, 2, 1.6), [12.6, 4.4], ...arc(15, 4.1, 19.5, 3.3, 2, 1.6), ...arc(19.5, 3.3, 24.5, 2.7, 2, 1.6), [27.2, 3.4]],
  },
  // 17 — freezer: frozen steps and slippery shelves
  {
    id: 17, theme: 'fridge', par: 6, killY: -7,
    spawn: [0, 0], finish: [29.5, 1], flags: [[16.5, 3.6]],
    plats: [
      top(-3, 3, 0, 'counter', 12), top(3, 8, 0, 'butter', 0.6), { x: 5.5, y: -1.5, w: 5, h: 2.4, kind: 'counter' }, top(10, 13, 2, 'shelf', 0.4),
      top(15.5, 18, 3.6, 'shelf', 0.4), top(20, 23, 2.4, 'butter', 0.4), top(25, 31, 1, 'counter', 12),
    ],
    coins: [[5, 1], [7, 1], ...arc(8, 0.8, 11.5, 2.7, 2, 1.6), ...arc(11.5, 2.7, 16.7, 4.3, 2, 1.6), [21.5, 3.4], ...arc(16.7, 4.3, 26, 1.7, 3, 2)],
  },
  // 18 — freezer: up the fridge door
  {
    id: 18, theme: 'fridge', par: 7, killY: -7,
    spawn: [1, 0], finish: [2.2, 17.6], flags: [[2.2, 6.2], [2.2, 12]],
    plats: [
      top(-2, 10, 0, 'counter', 12), { x: -2.6, y: 10, w: 1.2, h: 24, kind: 'cabinet' }, { x: 10.6, y: 10, w: 1.2, h: 24, kind: 'cabinet' },
      top(5.8, 9.6, 3.2, 'shelf', 0.4), top(0.4, 4.2, 6.2, 'shelf', 0.4), { x: 7.5, y: 9, w: 2.4, h: 0.35, kind: 'board', move: { dx: 0, dy: 1.2, period: 4 } },
      top(0.4, 4.2, 12, 'shelf', 0.4), top(5.8, 9.6, 14.8, 'shelf', 0.4), top(0.4, 4.2, 17.6, 'shelf', 0.4),
    ],
    coins: [[7.7, 4.4], [2.3, 7.4], [7.5, 10.6], [2.3, 13.2], [7.7, 16], [2.3, 18.8], [5, 2], [5, 9]],
  },
  // 19 — freezer: the icy gauntlet
  {
    id: 19, theme: 'fridge', par: 6, killY: -7,
    spawn: [0, 0], finish: [31, 1.5], flags: [[16.2, 3]],
    plats: [
      top(-3, 2, 0, 'counter', 12), top(4.5, 7, 1.6, 'shelf', 0.4), top(9, 13, 1.6, 'butter', 0.4), top(15, 17.5, 3, 'shelf', 0.4),
      { x: 21, y: 3, w: 3.6, h: 0.35, kind: 'board', spin: 0.5 }, top(24.5, 32.5, 1.5, 'counter', 12),
      { x: 27, y: 2.2, w: 0.16, h: 1.4, kind: 'knife' }, { x: 29.4, y: 2.2, w: 0.16, h: 1.4, kind: 'knife' },
    ],
    coins: [...arc(1, 0.8, 5.7, 2.3, 2, 1.6), [11, 2.6], ...arc(5.7, 2.3, 16.2, 3.7, 3, 2.2), ...arc(16.2, 3.7, 21, 3.8, 2, 1.6), ...arc(21, 3.8, 25.5, 2.2, 2, 1.6), [28.2, 3.4]],
  },
  // 20 — freezer: the grand finale climb
  {
    id: 20, theme: 'fridge', par: 10, killY: -7,
    spawn: [1, 0], finish: [8, 19.4], flags: [[2, 5.6], [2, 11.2], [2, 16.6]],
    plats: [
      top(-2, 10, 0, 'counter', 12), { x: -2.6, y: 11, w: 1.2, h: 26, kind: 'cabinet' }, { x: 10.6, y: 11, w: 1.2, h: 26, kind: 'cabinet' },
      top(7.8, 9.6, 0.4, 'jelly', 0.5), top(6, 9.6, 2.8, 'shelf', 0.4), top(0.2, 4, 5.6, 'shelf', 0.4), top(6, 9.6, 8.4, 'butter', 0.4),
      top(0.2, 4, 11.2, 'shelf', 0.4), { x: 6.8, y: 13.4, w: 2.4, h: 0.35, kind: 'board', move: { dx: 0, dy: 1.2, period: 4 } },
      top(0.2, 4, 16.6, 'shelf', 0.4), top(4.6, 5.6, 16.2, 'grill', 0.6), top(5.6, 9.6, 19.4, 'shelf', 0.4),
    ],
    coins: [[8.7, 2], [7.8, 4], [2, 6.8], [7.8, 9.6], [2, 12.4], [6.8, 15.4], [2, 17.8], [7.6, 20.6]],
  },
];

/** play order: 4 worlds of 5 (Kitchen, Pantry, Hot Stove, Freezer). Ids stay stable so saves keep their stars. */
const ORDER = [1, 3, 7, 8, 9, 2, 10, 11, 12, 13, 4, 5, 14, 15, 16, 6, 17, 18, 19, 20];
export const LEVELS: LevelDef[] = ORDER.map(id => DEFS.find(l => l.id === id)!);
