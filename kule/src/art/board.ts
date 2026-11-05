/**
 * The playfield as one big SVG per level (rasterised once): world floor, rug / paper / grass, the path with a 2.5D edge,
 * build pads (wooden coasters), the toy box at the goal and the story props around the play area.
 * Tilt-shift: props at the far top edge and the near bottom edge are blurred and slightly desaturated.
 */
import type { LevelDef, P } from '../sim/levels/types';
import { WORLD_PAL, TOY, JUNK } from './palette';
import { SVG_DEFS, shadow, cylinder, gloss } from './svg';

const T = 80;
const pts = (p: P[]) => p.map(([x, y]) => `${(x * T).toFixed(1)},${(y * T).toFixed(1)}`).join(' ');
const blurDefs = `<defs><filter id="far" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="4"/><feColorMatrix type="saturate" values="0.75"/></filter>
<filter id="near" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/><feColorMatrix type="saturate" values="0.7"/></filter>
<pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r="1.1" fill="rgba(120,80,30,.18)"/><circle cx="10" cy="11" r="0.9" fill="rgba(255,255,255,.25)"/></pattern></defs>`;

function floor(w: 1 | 2 | 3) {
  const C = WORLD_PAL[w]; let s = `<rect width="1280" height="720" fill="${C.floor}"/>`;
  if (w === 1) { for (let i = 0; i < 9; i++) { s += `<rect x="0" y="${i * 80}" width="1280" height="80" fill="${i % 2 ? C.floor : C.floorDark}" opacity="0.55"/><path d="M0 ${i * 80 + 0.5} H1280" stroke="${C.floorLine}" stroke-width="2" opacity="0.5"/>`;
      for (let k = 0; k < 3; k++) { const x = ((i * 397 + k * 523) % 1280); s += `<path d="M${x} ${i * 80} v80" stroke="${C.floorLine}" stroke-width="2" opacity="0.45"/><path d="M${x + 60} ${i * 80 + 30} q60 -6 120 0" stroke="${C.floorLine}" stroke-width="1.4" fill="none" opacity="0.25"/>`; } }
    s += `<rect x="150" y="150" width="980" height="460" rx="60" fill="${C.rug}" opacity="0.85"/><rect x="170" y="170" width="940" height="420" rx="48" fill="none" stroke="${C.rugDark}" stroke-width="5" stroke-dasharray="10 9"/><rect x="190" y="190" width="900" height="380" rx="38" fill="none" stroke="#e8c58a" stroke-width="3" opacity="0.5"/>`;
  } else if (w === 2) { for (let i = 0; i < 18; i++) s += `<path d="M0 ${i * 40 + 12} q320 ${(i % 3) * 4 - 4} 640 0 t640 0" stroke="${C.floorLine}" stroke-width="2" fill="none" opacity="0.28"/>`;
    for (const [x, y, r, c] of [[210, 260, -6, '#f4efe4'], [960, 470, 5, '#fff3b0'], [600, 110, 3, '#e8f1fb']] as [number, number, number, string][]) s += `<g transform="rotate(${r} ${x} ${y})"><rect x="${x - 120}" y="${y - 90}" width="240" height="180" fill="${c}" opacity="0.9"/>${Array.from({ length: 6 }, (_, k) => `<path d="M${x - 100} ${y - 60 + k * 24} h200" stroke="#9fb6d8" stroke-width="1.5" opacity="0.6"/>`).join('')}</g>`;
  } else { s += `<rect width="1280" height="720" fill="url(#dots)"/>`; for (let i = 0; i < 40; i++) s += `<ellipse cx="${(i * 331) % 1280}" cy="${(i * 197) % 720}" rx="${18 + (i % 4) * 8}" ry="5" fill="${C.floorDark}" opacity="0.35"/>`;
    s += `<path d="M0 0 H1280 V40 Q960 70 640 46 T0 54 Z" fill="${C.rug}"/><path d="M0 720 H1280 V690 Q900 666 640 684 T0 678 Z" fill="${C.rugDark}"/>`; }
  return s;
}
/** the path: 2.5D strip (side band below, lit top) in the world's style */
function pathStrip(L: LevelDef) {
  const C = WORLD_PAL[L.world], st = L.map.style ?? 'tape'; let s = '';
  for (const p of L.map.paths) {
    const P = pts(p);
    s += `<polyline points="${P}" fill="none" stroke="rgba(60,35,15,.25)" stroke-width="64" stroke-linejoin="round" stroke-linecap="butt" transform="translate(5 9)" filter="url(#far)"/>`;
    s += `<polyline points="${P}" fill="none" stroke="${C.pathSide}" stroke-width="60" stroke-linejoin="round" transform="translate(0 6)"/>`;
    s += `<polyline points="${P}" fill="none" stroke="${C.path}" stroke-width="58" stroke-linejoin="round"/>`;
    if (st === 'track') s += `<polyline points="${P}" fill="none" stroke="#6d7480" stroke-width="58" stroke-linejoin="round"/><polyline points="${P}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="14 12" stroke-linejoin="round"/><polyline points="${P}" fill="none" stroke="#e8473f" stroke-width="62" stroke-dasharray="10 10" stroke-linejoin="round" opacity="0.9" mask=""/><polyline points="${P}" fill="none" stroke="#6d7480" stroke-width="52" stroke-linejoin="round"/><polyline points="${P}" fill="none" stroke="#fff" stroke-width="3" stroke-dasharray="14 12" stroke-linejoin="round"/>`;
    else if (st === 'ruler') s += `<polyline points="${P}" fill="none" stroke="${C.pathMark}" stroke-width="2" stroke-dasharray="2 10" stroke-linejoin="round" transform="translate(0 -20)"/><polyline points="${P}" fill="none" stroke="${C.pathMark}" stroke-width="2" stroke-dasharray="2 10" stroke-linejoin="round" transform="translate(0 20)"/>`;
    else if (st === 'string') s += `<polyline points="${P}" fill="none" stroke="${C.pathMark}" stroke-width="4" stroke-dasharray="12 7" stroke-linejoin="round"/>`;
    else s += `<polyline points="${P}" fill="none" stroke="rgba(255,255,255,.35)" stroke-width="8" stroke-linejoin="round" transform="translate(-6 -16)"/><polyline points="${P}" fill="none" stroke="rgba(120,90,40,.12)" stroke-width="2" stroke-dasharray="3 9" stroke-linejoin="round" transform="translate(0 14)"/>`;
    // second entrance over a ruler bridge on the study desk
    if (L.world === 2 && L.map.paths.length > 1 && p === L.map.paths[1]) { const [x0, y0] = p[0], [x1, y1] = p[1]; s += `<line x1="${x0 * T}" y1="${Math.max(0, y0) * T}" x2="${x1 * T}" y2="${y1 * T - 40}" stroke="#e9c24a" stroke-width="70"/><line x1="${x0 * T}" y1="${Math.max(0, y0) * T}" x2="${x1 * T}" y2="${y1 * T - 40}" stroke="#a5760c" stroke-width="2" stroke-dasharray="2 10" transform="translate(-24 0)"/>`; }
  }
  return s;
}
function pad([x, y]: P) {
  const cx = x * T, cy = y * T + 10;
  return `<g transform="translate(${cx} ${cy})">${shadow(33, 12, 4, 0.3)}${cylinder(0, 6, 31, 8, TOY.wood, { grain: true, chip: true })}<ellipse cx="0" cy="-2" rx="19" ry="9" fill="none" stroke="${TOY.woodDark.side}" stroke-width="2" stroke-dasharray="4 4" opacity="0.5"/></g>`;
}
/** the toy box with the shiny star sticker */
export function toyBox([x, y]: P, pulse = 0) {
  const cx = x * T, cy = y * T + 22, W = TOY.wood, R = TOY.red;
  let s = `<g transform="translate(${cx} ${cy})">${shadow(52, 16, 6, 0.4)}`;
  s += `<rect x="-46" y="-52" width="92" height="52" rx="8" fill="${W.side}"/><rect x="18" y="-52" width="28" height="52" rx="8" fill="${W.dark}" opacity="0.35"/>`;
  s += `<rect x="-46" y="-30" width="92" height="9" fill="${R.side}"/><circle cx="0" cy="-26" r="7" fill="${TOY.yellow.top}"/>`;
  s += `<path d="M-46 -52 L-40 -86 L40 -86 L46 -52 Z" fill="${W.top}"/><path d="M-40 -86 L-34 -98 L34 -98 L40 -86 Z" fill="${R.top}"/>`;
  s += `<path d="M-30 -58 L-26 -80 L26 -80 L30 -58 Z" fill="#5b3a22"/>`;
  s += `<path d="M0 ${-86 - pulse * 4} l6 12 l13 1 l-10 8 l4 13 l-13 -7 l-13 7 l4 -13 l-10 -8 l13 -1 Z" fill="#ffd84a" transform="translate(0 6)"/><circle cx="0" cy="-74" r="${22 + pulse * 6}" fill="rgba(255,226,120,.25)"/>`;
  return s + `</g>`;
}
/** blurred story props around the play area */
function props(w: 1 | 2 | 3, L: LevelDef) {
  const C = WORLD_PAL[w]; let far = '', near = '';
  if (w === 1) {
    far += `<rect x="-20" y="-40" width="560" height="96" rx="20" fill="${C.wall}"/><path d="M-20 40 Q100 76 220 46 T460 50 T560 40 V56 H-20 Z" fill="#7b8fc4"/>`;   // bed + blanket
    far += `<circle cx="600" cy="22" r="26" fill="#ffe6a0"/><circle cx="600" cy="22" r="60" fill="${C.light}"/><rect x="590" y="40" width="20" height="16" fill="#cfa36b"/>`;   // night light
    far += `<rect x="900" y="-30" width="400" height="84" fill="#7a5134"/>${[0, 1, 2, 3, 4, 5, 6].map(i => `<rect x="${920 + i * 50}" y="${-20 + (i % 2) * 8}" width="34" height="${60 - (i % 2) * 8}" fill="${['#e8473f', '#3f8fe0', '#f7c834', '#5cbf5a', '#9a6bd8', '#e8473f', '#3f8fe0'][i]}" opacity="0.8"/>`).join('')}`; // bookshelf
    near += `<rect x="40" y="690" width="120" height="70" rx="12" fill="${TOY.blue.top}"/><rect x="1080" y="680" width="150" height="90" rx="14" fill="${TOY.yellow.top}"/><circle cx="700" cy="740" r="60" fill="${TOY.red.top}"/>`;
  } else if (w === 2) {
    far += `<path d="M960 -40 L1180 -40 L1250 70 L900 70 Z" fill="${C.light}"/><rect x="1040" y="-40" width="40" height="40" fill="#3b5b95"/>`;   // lamp cone
    far += `<rect x="60" y="10" width="380" height="22" rx="11" fill="#f7c834"/><path d="M440 10 l30 11 l-30 11 Z" fill="#f6d2b0"/><rect x="60" y="10" width="40" height="22" fill="#e8a0b0"/>`;   // pencil
    far += `<rect x="560" y="0" width="110" height="46" rx="8" fill="#f4a0b0"/><rect x="600" y="0" width="70" height="46" rx="8" fill="#5d8fd6"/>`;   // eraser
    near += `<rect x="-20" y="676" width="420" height="80" rx="14" fill="#3b5b95"/><rect x="980" y="682" width="360" height="70" rx="10" fill="#f4efe4"/>`;
  } else {
    far += `<rect width="1280" height="56" fill="${C.wall}" opacity="0.8"/><circle cx="1120" cy="30" r="40" fill="#ffd27a"/><path d="M0 56 Q300 20 600 50 T1280 40 V70 H0 Z" fill="${C.rug}"/>`;  // sunset + grass
    far += `<path d="M120 -10 L200 -10 L190 60 L130 60 Z" fill="${C.accent}"/><ellipse cx="160" cy="-10" rx="40" ry="10" fill="#2f8a85"/>`;  // bucket
    far += `<path d="M700 30 q120 -40 260 -6" stroke="#5aa64c" stroke-width="16" fill="none"/>`;   // hose
    near += `<path d="M1000 760 L1060 660 L1100 670 L1050 770 Z" fill="${TOY.red.top}"/><ellipse cx="200" cy="720" rx="140" ry="50" fill="${C.rugDark}"/>`;
  }
  void L;
  return `<g filter="url(#far)">${far}</g><g filter="url(#near)">${near}</g>`;
}
/** entrance holes (dark gaps under the bed / behind the shelf) where the junk gang comes from */
function entrances(L: LevelDef) {
  return L.map.paths.map(p => { const [x, y] = p[0], cx = Math.min(1270, Math.max(10, x * T)), cy = Math.min(712, Math.max(8, y * T));
    return `<ellipse cx="${cx}" cy="${cy}" rx="46" ry="30" fill="#2a2238" opacity="0.55" filter="url(#far)"/><circle cx="${cx + 8}" cy="${cy - 4}" r="3" fill="${JUNK.eye}"/><circle cx="${cx + 18}" cy="${cy - 4}" r="3" fill="${JUNK.eye}"/>`; }).join('');
}

export function boardSvg(L: LevelDef) {
  const goal = L.map.paths[0][L.map.paths[0].length - 1];
  const body = floor(L.world) + pathStrip(L) + entrances(L) + L.map.pads.map(pad).join('') + toyBox(goal) + props(L.world, L)
    + `<rect width="1280" height="720" fill="${WORLD_PAL[L.world].light}" opacity="0.35" style="mix-blend-mode:soft-light"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720">${SVG_DEFS}${blurDefs}${body}</svg>`;
}
export { gloss };
