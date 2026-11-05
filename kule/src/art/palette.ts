/**
 * Tabletop toy diorama palette. Environment = warm, calm, slightly muted; defenders = bright plastic primaries + wood;
 * enemies = grey / dusty / rusty with one accent (purple glow eyes). Defender and enemy colours are the same in every world.
 * Light: one warm lamp at the top-left (top faces lighter, side faces darker, no outlines).
 */
export interface Shade { top: string; side: string; dark: string; hi: string; }
const sh = (top: string, side: string, dark: string, hi = '#ffffff'): Shade => ({ top, side, dark, hi });

/** defenders: glossy plastic primaries and painted wood */
export const TOY = {
  red: sh('#e8473f', '#c4302b', '#8f1f1d', '#ffd9d2'),
  blue: sh('#3f8fe0', '#2b6fbf', '#1d4c87', '#d9ecff'),
  yellow: sh('#f7c834', '#dda515', '#a5760c', '#fff6cf'),
  green: sh('#5cbf5a', '#3f9a3e', '#2a6b2a', '#e2f7dc'),
  purple: sh('#9a6bd8', '#7b4fbb', '#563487', '#efe2ff'),
  white: sh('#f7f2e8', '#ddd5c5', '#b4aa96', '#ffffff'),
  wood: sh('#d9a066', '#b8804a', '#8a5a2e', '#f3cf9f'),
  woodDark: sh('#a8693a', '#865128', '#5c351a', '#d49a68'),
  skin: sh('#f6d2b0', '#e0b48e', '#b8875f', '#fff1e3'),
  metal: sh('#c9ced6', '#a3aab5', '#737b88', '#ffffff'),
};
/** enemies: dusty greys, rust, one purple accent glow */
export const JUNK = {
  dust: sh('#b3aea6', '#958f86', '#6e6a63', '#dcd8d1'),
  marble: sh('#8fb7c4', '#6a95a3', '#46707d', '#e9f6fa'),
  sock: sh('#8d7f8f', '#706272', '#4f4351', '#c4b8c6'),
  rust: sh('#b07a4d', '#8d5c35', '#613c21', '#e2b48a'),
  clay: sh('#c48a6a', '#a46d50', '#7a4c37', '#ecc2a9'),
  tin: sh('#9ea6ad', '#7d858c', '#585f66', '#e6ecf0'),
  king: sh('#6f6a86', '#555069', '#3a364a', '#b3aec9'),
  eye: '#b26bff', eyeGlow: 'rgba(178,107,255,.55)', white: '#fbf8f2', pupil: '#2b2233', tooth: '#fffdf6',
};

export interface WorldPal {
  floor: string; floorDark: string; floorLine: string; rug: string; rugDark: string;
  path: string; pathSide: string; pathMark: string; wall: string; wallDark: string; accent: string; light: string; shadow: string;
}
export const WORLD_PAL: Record<1 | 2 | 3, WorldPal> = {
  // Bedroom floor: honey wood, warm rug red, night-blue window light
  1: { floor: '#d6a96f', floorDark: '#bf8f58', floorLine: '#a77a47', rug: '#b9534a', rugDark: '#94403a', path: '#efe3c6', pathSide: '#cdbd98', pathMark: '#e2b13c', wall: '#3c4a6e', wallDark: '#2b3552', accent: '#7fa7d9', light: 'rgba(255,214,150,.35)', shadow: 'rgba(60,35,15,.32)' },
  // Study desk: light birch, paper white, pencil yellow, ink blue
  2: { floor: '#e5cfa6', floorDark: '#d2b98c', floorLine: '#bfa37a', rug: '#f4efe4', rugDark: '#dcd4c2', path: '#f6d24a', pathSide: '#d7ad2a', pathMark: '#3b5b95', wall: '#6f8fb0', wallDark: '#526f8f', accent: '#3b5b95', light: 'rgba(255,240,190,.35)', shadow: 'rgba(70,50,25,.3)' },
  // Backyard sandbox: sand beige, bucket teal, grass green, sunset orange
  3: { floor: '#e8cf9a', floorDark: '#d7b97f', floorLine: '#c5a46a', rug: '#7fae5a', rugDark: '#5f8f44', path: '#f3e2b8', pathSide: '#d9c08c', pathMark: '#3fa6a0', wall: '#f09a5b', wallDark: '#d97b44', accent: '#3fa6a0', light: 'rgba(255,190,120,.35)', shadow: 'rgba(90,55,20,.3)' },
};
