/**
 * Art palette: soft cartoon space diorama (see UI_REVIEW.md §2).
 * Backgrounds are calm and desaturated; everything the player interacts with is saturated and outlined
 * in a darker shade of its own colour (never black). Rendering only: physics and gameplay never read these.
 */

/** colour triple: base fill, dark (outline / physical edge / shadow), light (glossy highlight) */
export interface Tri { base: string; dark: string; light: string; }
const tri = (base: string, dark: string, light: string): Tri => ({ base, dark, light });

/** shared actors (same in every world) */
export const ART = {
  roverBody: tri('#f2e6cf', '#8a7a5e', '#fffaf0'),     // cream hull
  roverAccent: tri('#e8743b', '#8a3e1c', '#ffa36e'),   // rover orange
  roverMetal: tri('#a9b1be', '#4e5666', '#e3e8ef'),    // frame, springs' mounts, antenna
  roverDark: tri('#4a5262', '#262b36', '#6f7889'),     // chassis rail, bumper rubber
  tire: tri('#3d4250', '#1f232c', '#5c6373'),
  rim: tri('#d7dce4', '#5b6372', '#ffffff'),
  spring: tri('#e8743b', '#8a3e1c', '#ffb487'),
  glass: tri('#8fd3ec', '#2f6f8c', '#e6f8ff'),
  headlight: tri('#fff3c4', '#b3842e', '#ffffff'),
  crate: tri('#c98a4b', '#5e3a1c', '#e6b47e'),
  crateShade: '#9a6332',
  glassCrate: tri('#a8e4f2', '#3b85a3', '#f2fcff'),
  slime: tri('#8fd14f', '#3f7a1f', '#c8f08c'),
  coin: tri('#f4c542', '#b07d12', '#fff0a8'),
  danger: tri('#e5484d', '#8c1f23', '#ff9a9c'),
  energy: tri('#5fd67a', '#226b35', '#b8f5c4'),
  meteor: tri('#8a6f5c', '#45342a', '#b89a83'),
  ember: '#ffb04a',
  ufo: tri('#b9c3d3', '#4f5a6e', '#eef3fa'),
  ufoDome: tri('#a6e6f5', '#3b7f99', '#ffffff'),
  shield: tri('#7fdcf2', '#2b7f99', '#d9f7ff'),
  station: tri('#e7e2d6', '#6f6a5f', '#ffffff'),
  flag: tri('#e8743b', '#8a3e1c', '#ffa36e'),
  sign: tri('#f4c542', '#8a6410', '#fff0a8'),
};

export interface WorldArt {
  /** sky from top to horizon (CSS background, so the canvas never paints it) */
  sky: [string, string, string];
  stars: string; starAlpha: number;
  /** far / mid / near parallax layers (far is the lightest and least contrasted) */
  layers: [string, string, string]; layerRim: string;
  ground: { top: string; deep: string; rim: string; line: string; band: string; spot: string };
  rock: Tri; dust: string; pebble: string;
  ice: Tri;
  planet: 'earth' | 'sun' | 'ringed';
  haze: string;
}

export const WORLD_ART: WorldArt[] = [
  { // Moon: cool grey-blue sky, warm grey ground, Earth in the sky
    sky: ['#2b3245', '#3a4359', '#4c5670'], stars: '#dfe5f2', starAlpha: 0.75,
    layers: ['#5a6480', '#4a536c', '#3d4559'], layerRim: '#76809c',
    ground: { top: '#9a9488', deep: '#7d776c', rim: '#c9c3b5', line: '#5f5a51', band: '#6e695f', spot: '#8a8478' },
    rock: tri('#a39d91', '#5f5a51', '#cfc9bc'), dust: '#bdb7aa', pebble: '#857f73',
    ice: tri('#bfe3f0', '#5e8fa6', '#ffffff'), planet: 'earth', haze: 'rgba(120,140,190,.10)',
  },
  { // Mars: dusty orange sky, distant dunes
    sky: ['#4a2f2c', '#6e4436', '#94604a'], stars: '#f6dccb', starAlpha: 0.35,
    layers: ['#a46e55', '#8c5a45', '#764a39'], layerRim: '#c38a6c',
    ground: { top: '#c98a5e', deep: '#a86b45', rim: '#e8b991', line: '#6e4128', band: '#93593a', spot: '#b9784e' },
    rock: tri('#b77a52', '#6e4128', '#dba57c'), dust: '#deaa82', pebble: '#9a6240',
    ice: tri('#bfe3f0', '#5e8fa6', '#ffffff'), planet: 'sun', haze: 'rgba(230,150,100,.14)',
  },
  { // Ice moon: blue-white cliffs, ringed planet
    sky: ['#26344b', '#34496a', '#4d6a8e'], stars: '#e6f4ff', starAlpha: 0.8,
    layers: ['#8aa7c4', '#6f8fb0', '#5a7a9c'], layerRim: '#b9d3ea',
    ground: { top: '#dfe8ef', deep: '#b7c8d6', rim: '#f7fbff', line: '#6f8aa3', band: '#a4b8c9', spot: '#c9d7e2' },
    rock: tri('#9fb6c9', '#5a7690', '#d8e6f1'), dust: '#eef6fc', pebble: '#8ea7bd',
    ice: tri('#a9e3f7', '#4a8fb0', '#ffffff'), planet: 'ringed', haze: 'rgba(170,215,255,.12)',
  },
];
