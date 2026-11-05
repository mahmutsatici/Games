/**
 * SVG helpers for the toy-diorama style: fake 3D with face shading (top lighter, sides darker), no outlines,
 * glossy plastic streaks, painted wood with grain and chips, soft blurred contact shadows. Light from the top-left.
 * Every sprite's origin (0, 0) is the point where it touches the table (centre of its footprint).
 */
import type { Shade } from './palette';

export const SVG_DEFS = `<defs>
<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
<filter id="soft2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4"/></filter>
<filter id="fuzz" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/><feDisplacementMap in="SourceGraphic" scale="3.5"/></filter>
</defs>`;
/** wrap shapes into a standalone svg document; vb = [x, y, w, h] */
export const svgDoc = (vb: [number, number, number, number], body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb.join(' ')}" width="${vb[2]}" height="${vb[3]}">${SVG_DEFS}${body}</svg>`;

/** soft contact shadow on the table */
export const shadow = (rx: number, ry = rx * 0.38, dx = 4, a = 0.35) => `<ellipse cx="${dx}" cy="${ry * 0.3}" rx="${rx}" ry="${ry}" fill="rgba(55,32,12,${a})" filter="url(#soft)"/>`;
/** a short curved specular streak (glossy plastic) */
export const gloss = (x: number, y: number, w: number, h: number, a = 0.75, rot = -20) => `<ellipse cx="${x}" cy="${y}" rx="${w}" ry="${h}" fill="rgba(255,255,255,${a})" transform="rotate(${rot} ${x} ${y})"/>`;
/** cylinder standing on the table (wooden coaster, drum, tin can): top ellipse + side band */
export function cylinder(cx: number, bottom: number, r: number, h: number, c: Shade, opts: { grain?: boolean; band?: string; chip?: boolean } = {}) {
  const ry = r * 0.5, top = bottom - h;
  let s = `<path d="M${cx - r} ${top} L${cx - r} ${bottom} A${r} ${ry} 0 0 0 ${cx + r} ${bottom} L${cx + r} ${top} Z" fill="${c.side}"/>`;
  s += `<path d="M${cx + r * 0.35} ${top + ry * 0.9} L${cx + r * 0.35} ${bottom + ry * 0.9} A${r} ${ry} 0 0 0 ${cx + r} ${bottom} L${cx + r} ${top} Z" fill="${c.dark}" opacity="0.35"/>`;
  if (opts.band) s += `<path d="M${cx - r} ${top + h * 0.35} L${cx - r} ${top + h * 0.6} A${r} ${ry} 0 0 0 ${cx + r} ${top + h * 0.6} L${cx + r} ${top + h * 0.35} A${r} ${ry} 0 0 1 ${cx - r} ${top + h * 0.35} Z" fill="${opts.band}"/>`;
  s += `<ellipse cx="${cx}" cy="${top}" rx="${r}" ry="${ry}" fill="${c.top}"/>`;
  if (opts.grain) for (let i = 1; i <= 3; i++) s += `<ellipse cx="${cx - r * 0.08}" cy="${top + 0.5}" rx="${r * (0.25 * i)}" ry="${ry * (0.25 * i)}" fill="none" stroke="${c.side}" stroke-width="1" opacity="0.45"/>`;
  if (opts.chip) s += `<path d="M${cx + r * 0.62} ${top - ry * 0.7} q${r * 0.12} ${ry * 0.25} ${r * 0.3} ${ry * 0.15}" stroke="${c.hi}" stroke-width="2" fill="none" opacity="0.8"/>`;
  s += `<path d="M${cx - r * 0.75} ${top - ry * 0.35} A${r * 0.8} ${ry * 0.8} 0 0 1 ${cx - r * 0.1} ${top - ry * 0.85}" stroke="${c.hi}" stroke-width="2.4" fill="none" opacity="0.7" stroke-linecap="round"/>`;
  return s;
}
/** rounded box seen from the 3/4 view: front face + top face (+ a darker right side strip) */
export function box(x: number, y: number, w: number, h: number, depth: number, c: Shade, r = 3) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${c.side}"/>`
    + `<rect x="${x + w * 0.72}" y="${y}" width="${w * 0.28}" height="${h}" rx="${r}" fill="${c.dark}" opacity="0.35"/>`
    + `<rect x="${x}" y="${y - depth}" width="${w}" height="${depth * 2}" rx="${Math.min(r * 1.5, depth)}" fill="${c.top}"/>`;
}
/** painted face: two dot eyes, rosy cheeks, small smile */
export const face = (x: number, y: number, s = 1, eye = '#2b2233') => `<circle cx="${x - 3.2 * s}" cy="${y}" r="${1.6 * s}" fill="${eye}"/><circle cx="${x + 3.2 * s}" cy="${y}" r="${1.6 * s}" fill="${eye}"/>`
  + `<circle cx="${x - 5 * s}" cy="${y + 3 * s}" r="${1.7 * s}" fill="#f08a8a" opacity="0.6"/><circle cx="${x + 5 * s}" cy="${y + 3 * s}" r="${1.7 * s}" fill="#f08a8a" opacity="0.6"/>`
  + `<path d="M${x - 2 * s} ${y + 3.4 * s} q${2 * s} ${1.8 * s} ${4 * s} 0" stroke="${eye}" stroke-width="${1.1 * s}" fill="none" stroke-linecap="round"/>`;
/** a few short fuzzy hair strokes around a felt shape (cx, cy, rx, ry) */
export function fuzz(cx: number, cy: number, rx: number, ry: number, color: string, n = 26, seed = 1) {
  let s = ''; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 + Math.sin(i * 7.3 + seed) * 0.2, l = 2.2 + ((i * 37 + seed) % 5) * 0.5, x0 = cx + Math.cos(a) * rx, y0 = cy + Math.sin(a) * ry;
    s += `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)} l${(Math.cos(a + 0.4) * l).toFixed(1)} ${(Math.sin(a + 0.4) * l).toFixed(1)}" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>`; }
  return s;
}
