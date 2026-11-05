/**
 * Design tokens for Zıp Sucuk: one art style for menus, HUD and the game world (see UI_REVIEW.md §2).
 * Rules: outline = darker shade of the object's own colour (never black); flat base + one shadow + one glossy highlight;
 * chunky rounded shapes; desaturated background, saturated foreground.
 */
import ericaUrl from './fonts/EricaOne-Regular.ttf?url';
import outfitBoldUrl from './fonts/Outfit-Bold.ttf?url';
import outfitUrl from './fonts/Outfit-Regular.ttf?url';

export const FONT_DISPLAY = '"Erica One", "Outfit", system-ui, sans-serif';
export const FONT_UI = '"Outfit", system-ui, "Segoe UI", sans-serif';

/** colour triples: base, dark (outline/edge), light (highlight) */
export interface Tri { base: string; dark: string; light: string; }
export const C = {
  cream: { base: '#f6ead2', dark: '#b98d55', light: '#fffaf0' } as Tri,
  wood: { base: '#c98a4f', dark: '#7a4521', light: '#e8b47c' } as Tri,
  woodDark: { base: '#8f5530', dark: '#4e2611', light: '#b9774a' } as Tri,
  sausage: { base: '#a3321e', dark: '#5a150a', light: '#d4603f' } as Tri,
  primary: { base: '#e2582b', dark: '#8f2a10', light: '#ff9a62' } as Tri,     // warm orange/red: main actions
  secondary: { base: '#f1d9ad', dark: '#a5713c', light: '#fff4dc' } as Tri,   // cream / wood: secondary actions
  go: { base: '#4fb548', dark: '#21681d', light: '#8be37c' } as Tri,          // green: "continue / next" (Poki rule)
  reward: { base: '#7b5cd6', dark: '#3d2785', light: '#b39cff' } as Tri,      // purple: rewarded ad (never green)
  mustard: { base: '#f2b52c', dark: '#9a6608', light: '#ffe28a' } as Tri,
  chili: { base: '#e2412b', dark: '#8a1a0e', light: '#ff8a6e' } as Tri,
  leaf: { base: '#4caf50', dark: '#1f6b22', light: '#93e08f' } as Tri,
  ice: { base: '#bfe6f6', dark: '#5aa6c8', light: '#ffffff' } as Tri,
  steel: { base: '#aeb7c4', dark: '#5c6574', light: '#f2f6fb' } as Tri,
  locked: { base: '#b9ab98', dark: '#6f6252', light: '#e3d8c8' } as Tri,
  ink: '#3b1c10',            // text on light surfaces
  textLight: '#fff8ec',      // text on dark/coloured surfaces
  shadow: 'rgba(60,25,10,.28)',
  dim: 'rgba(42,18,8,.55)',
};

export const R = { btn: 22, panel: 28, chip: 18 };        // corner radii (logical px)
export const EDGE = 5;                                      // physical bottom edge of candy buttons (px)
export const SAFE = { top: 14, side: 16 };                  // HUD safe margins (logical px), plus CSS safe-area insets

export const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outBack: (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outElastic: (t: number) => t === 0 || t === 1 ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI) / 3) + 1,
  inOutCubic: (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
};
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** prefers-reduced-motion: smaller bounces, no shake, instant-ish transitions */
export const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const motion = (full: number) => reducedMotion ? full * 0.15 : full;

/** load the bundled fonts (local files, no network); resolves even if a font fails */
export async function loadFonts(onProgress?: (p: number) => void): Promise<void> {
  const list: [string, string, string][] = [['Erica One', ericaUrl, '400'], ['Outfit', outfitBoldUrl, '700'], ['Outfit', outfitUrl, '400']];
  let done = 0;
  await Promise.all(list.map(async ([family, url, weight]) => {
    try { const f = new FontFace(family, `url(${url})`, { weight }); await f.load(); (document.fonts as FontFaceSet & { add(f: FontFace): void }).add(f); } catch { /* fall back to system font */ }
    done++; onProgress?.(done / list.length);
  }));
}
