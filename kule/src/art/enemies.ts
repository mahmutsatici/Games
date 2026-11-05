/** Enemy sprites (SVG strings): cute-mischievous junk creatures, grey/dusty/rusty with a purple glow-eye accent. */
import { JUNK } from './palette';
import { svgDoc, shadow, fuzz, gloss } from './svg';

export const ENEMY_VB: [number, number, number, number] = [-40, -64, 80, 76];

/** googly eye (big white, pupil looking down-right, purple rim glow) */
const eye = (x: number, y: number, r: number, look = 0.3) => `<circle cx="${x}" cy="${y}" r="${r + 1.6}" fill="${JUNK.eyeGlow}" filter="url(#soft2)"/><circle cx="${x}" cy="${y}" r="${r}" fill="${JUNK.white}"/>`
  + `<circle cx="${x + r * look}" cy="${y + r * 0.25}" r="${r * 0.52}" fill="${JUNK.pupil}"/><circle cx="${x + r * look - r * 0.2}" cy="${y + r * 0.05}" r="${r * 0.16}" fill="#fff"/>`;

/** dust bunny: a round fuzzy grey felt puff with long floppy ears, big googly eyes and two little teeth */
export function bunny(frame = 0) {
  const C = JUNK.dust, hop = frame ? -5 : 0, sq = frame ? 0.94 : 1;
  let s = shadow(22, 8, 3, frame ? 0.24 : 0.36);
  s += `<g transform="translate(0 ${hop}) scale(${2 - sq} ${sq})">`;
  s += `<ellipse cx="-10" cy="-40" rx="5.5" ry="12" fill="${C.side}" transform="rotate(-18 -10 -42)" filter="url(#fuzz)"/><ellipse cx="-10" cy="-42" rx="2.8" ry="8.5" fill="#cfa9b8" transform="rotate(-18 -10 -42)" opacity="0.85"/>`;
  s += `<ellipse cx="11" cy="-39" rx="5.5" ry="12" fill="${C.dark}" transform="rotate(24 11 -41)" filter="url(#fuzz)"/><ellipse cx="11" cy="-41" rx="2.8" ry="8.5" fill="#b8919f" transform="rotate(24 11 -41)" opacity="0.8"/>`;
  s += `<ellipse cx="0" cy="-17" rx="23" ry="19" fill="${C.side}" filter="url(#fuzz)"/>`;
  s += `<ellipse cx="-3" cy="-21" rx="19" ry="14" fill="${C.top}" filter="url(#fuzz)"/><ellipse cx="-9" cy="-27" rx="7" ry="4" fill="${C.hi}" opacity="0.6" filter="url(#soft2)"/>`;
  s += fuzz(0, -17, 23, 19, C.dark, 34, 2) + fuzz(-3, -22, 16, 11, C.hi, 16, 5);
  s += eye(-7, -21, 6.5) + eye(7.5, -21, 6.5);
  s += `<path d="M-4 -9 q4 3 8 0" stroke="${JUNK.pupil}" stroke-width="1.6" fill="none" stroke-linecap="round"/><rect x="-2.4" y="-9" width="2.2" height="3.2" rx="0.6" fill="${JUNK.tooth}"/><rect x="0.4" y="-9" width="2.2" height="3.2" rx="0.6" fill="${JUNK.tooth}"/>`;
  s += `<ellipse cx="-14" cy="-3" rx="5" ry="3" fill="${C.side}"/><ellipse cx="13" cy="-3" rx="5" ry="3" fill="${C.dark}"/>`;
  s += `</g>`;
  return svgDoc(ENEMY_VB, s);
}
export { gloss };

/** marble: glassy swirl ball rolling (frame = rotation step) */
export function marble(frame = 0) {
  const C = JUNK.marble, r = 13;
  let s = shadow(13, 4.5, 2, 0.32) + `<circle cx="0" cy="${-r}" r="${r}" fill="${C.side}"/><circle cx="-2" cy="${-r - 2}" r="${r - 2}" fill="${C.top}"/>`;
  s += `<path d="M${-r + 3} ${-r} q${r * 0.6} ${-r * 0.9 + frame * 3} ${r * 1.5} ${-2 + frame}" stroke="${JUNK.eye}" stroke-width="3" fill="none" opacity="0.75"/>`;
  s += eye(-4, -r - 1, 3.6) + eye(4.5, -r - 1, 3.6) + `<ellipse cx="-6" cy="${-r - 7}" rx="4" ry="2" fill="#fff" opacity="0.85"/>`;
  return svgDoc(ENEMY_VB, s);
}
/** sock bat: a striped sock with felt wings, flapping (frame) */
export function bat(frame = 0) {
  const C = JUNK.sock, up = frame ? -10 : 6;
  let s = shadow(14, 5, 2, 0.2);
  s += `<g transform="translate(0 -30)">`;
  s += `<path d="M-6 -4 Q-24 ${up - 8} -34 ${up} Q-22 ${up + 2} -10 6 Z" fill="${C.side}" filter="url(#fuzz)"/><path d="M6 -4 Q24 ${up - 8} 34 ${up} Q22 ${up + 2} 10 6 Z" fill="${C.dark}" filter="url(#fuzz)"/>`;
  s += `<rect x="-11" y="-16" width="22" height="30" rx="11" fill="${C.top}"/><rect x="-11" y="-6" width="22" height="4" fill="${JUNK.eye}" opacity="0.6"/><rect x="-11" y="4" width="22" height="4" fill="${JUNK.eye}" opacity="0.6"/>`;
  s += fuzz(0, -1, 11, 15, C.dark, 18, 3) + eye(-4.5, -9, 4.4) + eye(4.5, -9, 4.4) + `<path d="M-3 -2 l1.5 2.5 l1.5 -2.5 l1.5 2.5 l1.5 -2.5" stroke="${JUNK.tooth}" stroke-width="1.3" fill="none"/>`;
  s += `</g>`;
  return svgDoc(ENEMY_VB, s);
}
/** wind-up beetle tank: tin shell with rivets, wind-up key, little wheels */
export function beetle(frame = 0) {
  const C = JUNK.tin, R = JUNK.rust;
  let s = shadow(26, 8, 3, 0.38);
  s += `<circle cx="-14" cy="-4" r="5" fill="#3b3a40"/><circle cx="0" cy="-4" r="5" fill="#3b3a40"/><circle cx="14" cy="-4" r="5" fill="#3b3a40"/>`;
  s += `<path d="M-26 -8 Q-26 -40 0 -40 Q26 -40 26 -8 Z" fill="${C.side}"/><path d="M-22 -14 Q-20 -36 0 -37 Q14 -36 20 -20 Z" fill="${C.top}"/><path d="M0 -40 L0 -8" stroke="${C.dark}" stroke-width="2"/>`;
  for (const [x, y] of [[-16, -16], [-8, -28], [8, -28], [16, -16]]) s += `<circle cx="${x}" cy="${y}" r="2" fill="${C.hi}"/>`;
  s += `<path d="M-18 -10 h8 M10 -10 h8" stroke="${R.top}" stroke-width="3" opacity="0.7"/>` + gloss(-10, -32, 6, 2, 0.6, -20);
  s += `<g transform="rotate(${frame * 45} 0 -46)"><rect x="-2" y="-52" width="4" height="10" fill="${R.side}"/><path d="M-10 -56 h20 v-6 h-20 Z" fill="${R.top}"/></g>`;
  s += `<ellipse cx="22" cy="-18" rx="9" ry="8" fill="${C.dark}"/>` + eye(20, -20, 3.6) + eye(26, -19, 3.2);
  return svgDoc(ENEMY_VB, s);
}
/** clay blob: soft lumpy modelling-clay creature (frame = squish) */
export function clay(frame = 0) {
  const C = JUNK.clay, sx = frame ? 1.06 : 0.96, sy = frame ? 0.94 : 1.04;
  let s = shadow(28, 9, 3, 0.4) + `<g transform="scale(${sx} ${sy})">`;
  s += `<path d="M-28 0 Q-34 -30 -12 -40 Q0 -50 14 -40 Q34 -30 28 0 Z" fill="${C.side}"/><path d="M-22 -8 Q-26 -30 -8 -36 Q6 -42 18 -32 Q12 -16 -22 -8 Z" fill="${C.top}"/>`;
  s += `<path d="M-14 -20 q4 -3 8 0 M6 -14 q4 -3 8 0" stroke="${C.dark}" stroke-width="1.2" fill="none" opacity="0.4"/>`;
  s += eye(-8, -24, 6) + eye(8, -24, 5.4) + `<path d="M-6 -10 q6 4 12 0" stroke="${JUNK.pupil}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  s += `</g>`;
  return svgDoc(ENEMY_VB, s);
}
/** propeller robot: boxy tin robot with a spinning propeller hat (frame = propeller angle) */
export function robot(frame = 0) {
  const C = JUNK.tin, R = JUNK.rust;
  let s = shadow(16, 5, 2, 0.2) + `<g transform="translate(0 -28)">`;
  s += `<rect x="-14" y="-18" width="28" height="26" rx="5" fill="${C.side}"/><rect x="-14" y="-22" width="28" height="8" rx="4" fill="${C.top}"/><rect x="4" y="-18" width="10" height="26" rx="4" fill="${C.dark}" opacity="0.4"/>`;
  s += `<rect x="-9" y="-12" width="18" height="11" rx="3" fill="#3a3346"/>` + eye(-4, -7, 3.4) + eye(4, -7, 3.4);
  s += `<rect x="-6" y="2" width="12" height="3" fill="${R.top}"/><rect x="-1.5" y="-30" width="3" height="9" fill="${C.dark}"/>`;
  s += `<ellipse cx="0" cy="-31" rx="${frame ? 6 : 20}" ry="3" fill="${R.top}"/><ellipse cx="0" cy="-31" rx="${frame ? 20 : 6}" ry="3" fill="${R.side}" opacity="0.8"/>`;
  s += `<path d="M-14 -4 h-6 M14 -4 h6" stroke="${C.dark}" stroke-width="3" stroke-linecap="round"/></g>`;
  return svgDoc(ENEMY_VB, s);
}
/** Junk King: a vacuum-cleaner robot throne with a crowned dust king on top */
export const KING_VB: [number, number, number, number] = [-70, -120, 140, 132];
export function king(frame = 0) {
  const K = JUNK.king, D = JUNK.dust, Y = '#e9c24a';
  let s = shadow(56, 16, 5, 0.42);
  s += `<ellipse cx="0" cy="-10" rx="56" ry="20" fill="${K.dark}"/><path d="M-56 -10 L-56 -30 A56 20 0 0 1 56 -30 L56 -10 A56 20 0 0 1 -56 -10 Z" fill="${K.side}"/><ellipse cx="0" cy="-30" rx="56" ry="20" fill="${K.top}"/>`;
  s += `<ellipse cx="-14" cy="-34" rx="22" ry="5" fill="#fff" opacity="0.18"/>`;
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + frame; s += `<circle cx="${Math.cos(a) * 44}" cy="${-30 + Math.sin(a) * 15}" r="3" fill="${JUNK.eye}" opacity="${0.5 + 0.5 * Math.sin(a)}"/>`; }
  s += `<ellipse cx="0" cy="-58" rx="26" ry="24" fill="${D.side}" filter="url(#fuzz)"/><ellipse cx="-3" cy="-62" rx="22" ry="18" fill="${D.top}" filter="url(#fuzz)"/>` + fuzz(0, -58, 26, 24, D.dark, 30, 9);
  s += eye(-9, -62, 7.5) + eye(9, -62, 7.5) + `<path d="M-8 -46 q8 5 16 0" stroke="${JUNK.pupil}" stroke-width="2.2" fill="none" stroke-linecap="round"/><rect x="-3" y="-46" width="2.6" height="4" fill="${JUNK.tooth}"/><rect x="1" y="-46" width="2.6" height="4" fill="${JUNK.tooth}"/>`;
  s += `<path d="M-18 -80 L-18 -96 L-9 -86 L0 -100 L9 -86 L18 -96 L18 -80 Z" fill="${Y}"/><path d="M-18 -80 L18 -80 L18 -84 L-18 -84 Z" fill="#c79c2a"/><circle cx="0" cy="-90" r="3" fill="${JUNK.eye}"/>`;
  return svgDoc(KING_VB, s);
}
