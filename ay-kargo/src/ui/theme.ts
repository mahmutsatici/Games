/**
 * UI design tokens for Moon Cargo: one style for menus, HUD and the game world (UI_REVIEW.md §2).
 * Panels look like rover/station hardware, buttons are chunky physical keys.
 */
import fredokaUrl from './fonts/Fredoka-Bold.woff2?url';
import nunitoUrl from './fonts/Nunito-ExtraBold.woff2?url';
import type { Tri } from '../art/palette';
export type { Tri } from '../art/palette';

export const FONT_DISPLAY = '"Fredoka", "Nunito", system-ui, sans-serif';
export const FONT_UI = '"Nunito", system-ui, "Segoe UI", sans-serif';

const t3 = (base: string, dark: string, light: string): Tri => ({ base, dark, light });
export const C = {
  primary: t3('#e8743b', '#8a3e1c', '#ffa36e'),    // rover orange: main actions
  secondary: t3('#efe4cf', '#8f7d5f', '#fffaf0'),  // cream / metal: secondary actions
  metal: t3('#c9d0da', '#5d6677', '#f2f5f9'),      // hardware panels
  steel: t3('#5a6378', '#2f3546', '#7d879c'),      // dark display insets
  go: t3('#5cb85c', '#2d6a2d', '#a3e39b'),          // green: continue / next / finish (Poki rule)
  reward: t3('#4a8fd9', '#22507f', '#9cc9f5'),      // blue: rewarded ad (never green), always with the film icon
  gold: t3('#f4c542', '#b07d12', '#fff0a8'),
  wood: t3('#c98a4b', '#5e3a1c', '#e6b47e'),
  slime: t3('#8fd14f', '#3f7a1f', '#c8f08c'),
  danger: t3('#e5484d', '#8c1f23', '#ff9a9c'),
  energy: t3('#5fd67a', '#226b35', '#b8f5c4'),
  shield: t3('#7fdcf2', '#2b7f99', '#d9f7ff'),
  locked: t3('#8d94a3', '#4a505d', '#c4c9d3'),
  ink: '#2b2f3a',            // text on light surfaces
  textLight: '#fffaf0',      // text on dark / coloured surfaces
  shadow: 'rgba(14,17,28,.38)',
  dim: 'rgba(16,20,34,.55)',
};

export const R = { btn: 20, panel: 22, chip: 16 };   // corner radii (logical px)
export const EDGE = 4;                                // physical bottom edge of buttons (px)

export const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outBack: (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  inOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** prefers-reduced-motion: smaller bounces, no shake, near-instant transitions */
export const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const motion = (full: number) => reducedMotion ? full * 0.15 : full;

/** load the bundled fonts (local files, no network); resolves even if a font fails */
export async function loadFonts(onProgress?: (p: number) => void): Promise<void> {
  const list: [string, string, string][] = [['Fredoka', fredokaUrl, '700'], ['Nunito', nunitoUrl, '800']];
  let done = 0;
  await Promise.all(list.map(async ([family, url, weight]) => {
    try { const f = new FontFace(family, `url(${url})`, { weight }); await f.load(); (document.fonts as FontFaceSet & { add(f: FontFace): void }).add(f); } catch { /* fall back to a system font */ }
    done++; onProgress?.(done / list.length);
  }));
}
