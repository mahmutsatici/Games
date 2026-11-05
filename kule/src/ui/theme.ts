/** UI tokens for Toy Fort: plastic toy-remote buttons, toy-box / chalkboard / tray panels, no outlines anywhere. */
import balooUrl from './fonts/Baloo2-ExtraBold.woff2?url';
import nunitoUrl from './fonts/Nunito-ExtraBold.woff2?url';
import { TOY, Shade } from '../art/palette';

export const FONT_DISPLAY = '"Baloo 2", "Nunito", system-ui, sans-serif';
export const FONT_UI = '"Nunito", system-ui, sans-serif';
export const C = {
  primary: TOY.red, secondary: TOY.wood, reward: TOY.purple, go: TOY.green, info: TOY.blue, gold: TOY.yellow, metal: TOY.metal, locked: { top: '#b9b2a6', side: '#9a9387', dark: '#6f695f', hi: '#e6e1d8' } as Shade,
  ink: '#3a2a22', paper: '#fbf6ea', chalk: '#2f4a3b', chalkLine: 'rgba(255,255,255,.85)', shadow: 'rgba(55,32,12,.32)',
};
export const SIDE = 5;   // plastic side face depth (px)
export const ease = {
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  outBack: (t: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); },
  outBounce: (t: number) => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375; return n * (t -= 2.625 / d) * t + 0.984375; },
};
export const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
export const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
export const motion = (full: number) => reducedMotion ? full * 0.15 : full;
export async function loadFonts(onProgress?: (p: number) => void) {
  const list: [string, string, string][] = [['Baloo 2', balooUrl, '800'], ['Nunito', nunitoUrl, '800']]; let n = 0;
  await Promise.all(list.map(async ([f, u, w]) => { try { const ff = new FontFace(f, `url(${u})`, { weight: w }); await ff.load(); (document.fonts as FontFaceSet & { add(f: FontFace): void }).add(ff); } catch { /* system font */ } n++; onProgress?.(n / list.length); }));
}
