/** Tower sprites (SVG strings). Origin = centre of the build pad on the table. View box is 120 x 150 px per tile-ish. */
import type { BranchId } from '../sim/config';
import { TOY } from './palette';
import { svgDoc, shadow, cylinder, box, gloss, face } from './svg';

export const TOWER_VB: [number, number, number, number] = [-60, -132, 120, 150];

/** wooden coaster base; grows a ring per level, branch = gold rim */
function base(level: number, branch: boolean) {
  let s = shadow(40, 16, 5, 0.42) + cylinder(0, 8, 36, 10, TOY.wood, { grain: true, chip: true });
  if (level >= 2) s += `<ellipse cx="0" cy="-1" rx="30" ry="12.6" fill="none" stroke="${TOY.red.side}" stroke-width="3" opacity="0.9"/>`;
  if (level >= 3) s += `<ellipse cx="0" cy="-1" rx="22" ry="9.2" fill="none" stroke="${TOY.yellow.top}" stroke-width="2.5"/>`;
  if (branch) s += `<path d="M-36 -1 A36 15 0 0 0 36 -1" stroke="${TOY.yellow.side}" stroke-width="3" fill="none"/>`;
  return s;
}

/** chipped paint: little spots of bare wood on an edge */
const chips = (pts: number[][]) => pts.map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.7}" fill="${TOY.wood.top}"/>`).join('');
/** faint wood grain lines over painted wood */
const grain = (x: number, y: number, w: number, h: number) => { let g = ''; for (let i = 1; i < 4; i++) g += `<path d="M${x + 2} ${y + h * i / 4} q${w / 2} ${-2 + i} ${w - 4} 0" stroke="#000" stroke-width="0.8" fill="none" opacity="0.08"/>`; return g; };

/** tin soldier drummer (painted wood, chibi proportions) with a cork popgun; levels add epaulettes / medal / plume; branches change the gear */
export function soldier(level: number, branch: BranchId | null) {
  const R = TOY.red, B = TOY.blue, W = TOY.white, Y = TOY.yellow, S = TOY.skin, K = TOY.woodDark;
  let s = base(level, !!branch);
  // short legs + boots
  s += `<rect x="-12" y="-18" width="10" height="16" rx="4" fill="${B.side}"/><rect x="2" y="-18" width="10" height="16" rx="4" fill="${B.dark}"/>`;
  s += `<ellipse cx="-7" cy="-2" rx="7" ry="4" fill="#2b2a33"/><ellipse cx="7" cy="-2" rx="7" ry="4" fill="#23222a"/>`;
  // chunky coat: front (lit left half) + shaded right side + top shoulders
  s += `<rect x="-19" y="-50" width="38" height="36" rx="11" fill="${R.side}"/><path d="M6 -50 h3 a11 11 0 0 1 10 11 v14 a11 11 0 0 1 -11 11 h-2 Z" fill="${R.dark}" opacity="0.4"/>`;
  s += `<ellipse cx="0" cy="-48" rx="18" ry="7" fill="${R.top}"/>` + grain(-17, -44, 30, 26) + chips([[-18, -30, 1.6], [16, -46, 1.4], [-10, -16, 1.2]]);
  s += `<path d="M-16 -46 L12 -19 M16 -46 L-12 -19" stroke="${W.top}" stroke-width="4.5" stroke-linecap="round"/><path d="M-16 -46 L12 -19" stroke="${W.side}" stroke-width="1.5" stroke-linecap="round" opacity="0.6" transform="translate(1.5 1.5)"/>`;
  s += `<rect x="-19" y="-22" width="38" height="5" rx="2" fill="${K.side}"/><rect x="-3.5" y="-23" width="7" height="7" rx="1.5" fill="${Y.top}"/>`;
  if (level >= 2) s += `<ellipse cx="-18" cy="-47" rx="7" ry="4.2" fill="${Y.top}"/><ellipse cx="18" cy="-47" rx="7" ry="4.2" fill="${Y.side}"/><path d="M-24 -45 v5 M-20 -44 v5 M-16 -44 v5" stroke="${Y.side}" stroke-width="1.4"/>`;
  if (level >= 3) s += `<circle cx="-9" cy="-34" r="3.6" fill="${Y.top}"/><circle cx="-9" cy="-34" r="1.6" fill="${R.top}"/>`;
  // big head + painted face (light from top-left)
  s += `<circle cx="0" cy="-64" r="15" fill="${S.side}"/><circle cx="-2" cy="-66" r="13.5" fill="${S.top}"/>` + face(0, -63, 1.25) + `<ellipse cx="-7" cy="-72" rx="3.5" ry="2" fill="#fff" opacity="0.35"/>`;
  // shako hat seen slightly from above: front + top ellipse
  s += `<rect x="-14" y="-102" width="28" height="28" rx="6" fill="#2f3a6b"/><path d="M6 -102 h2 a6 6 0 0 1 6 6 v16 a6 6 0 0 1 -6 6 h-2 Z" fill="#1d254a" opacity="0.6"/>`;
  s += `<ellipse cx="0" cy="-102" rx="14" ry="6.5" fill="#4a5899"/><ellipse cx="-3" cy="-103" rx="7" ry="2.5" fill="#6676b8" opacity="0.6"/>`;
  s += `<rect x="-17" y="-79" width="34" height="6" rx="3" fill="#1d254a"/><path d="M0 -97 l5 6 l-5 6 l-5 -6 Z" fill="${Y.top}"/>` + chips([[11, -99, 1.3]]);
  s += `<path d="M0 -108 v29" stroke="#ffffff" stroke-width="0.8" opacity="0.18"/>` + gloss(-8, -93, 2.2, 7, 0.4, 6); // mold seam + soft sheen
  if (level >= 3) s += `<ellipse cx="0" cy="-112" rx="5" ry="10" fill="${R.top}"/><ellipse cx="-1.5" cy="-114" rx="1.8" ry="5" fill="#fff" opacity="0.55"/>`;
  // gear
  if (branch === 'drumSquad') {
    s += cylinder(0, -6, 19, 16, Y, { band: R.top }); s += `<path d="M-17 -15 L17 -15" stroke="${W.top}" stroke-width="2"/><path d="M-24 -40 L-8 -24 M24 -40 L8 -24" stroke="${K.top}" stroke-width="3.5" stroke-linecap="round"/><circle cx="-24" cy="-40" r="3.5" fill="${W.top}"/><circle cx="24" cy="-40" r="3.5" fill="${W.top}"/>`;
  } else if (branch === 'dartGun') {
    s += `<rect x="12" y="-42" width="32" height="12" rx="6" fill="${Y.side}"/><rect x="12" y="-44" width="32" height="6" rx="3" fill="${Y.top}"/><rect x="42" y="-42" width="6" height="12" rx="3" fill="${B.top}"/><circle cx="51" cy="-36" r="5.5" fill="${R.top}"/>` + gloss(25, -41, 8, 1.8, 0.85, 0);
  } else {
    s += cylinder(-20, -10, 10, 10, Y, { band: R.top });
    s += `<rect x="12" y="-40" width="30" height="8" rx="4" fill="${K.top}"/><rect x="12" y="-36" width="30" height="4" rx="2" fill="${K.side}"/><rect x="39" y="-41" width="8" height="10" rx="3.5" fill="#dcb68c"/><ellipse cx="45" cy="-36" rx="1.5" ry="3" fill="#b78f63"/>`;
  }
  s += `<rect x="9" y="-46" width="10" height="16" rx="5" fill="${R.top}"/><circle cx="15" cy="-32" r="4.8" fill="${S.top}"/>`;
  return svgDoc(TOWER_VB, s);
}

/** block catapult: wooden frame + arm on a pin (arm drawn separately so it can rotate), plastic block in the cup */
export function catapult(level: number, branch: BranchId | null) {
  const W = TOY.wood, K = TOY.woodDark, Y = TOY.yellow, R = TOY.red, B = TOY.blue, G = TOY.green;
  let s = base(level, !!branch);
  // frame: two wooden uprights on a plank, blue plastic wheels
  s += box(-28, -14, 56, 10, 4, K, 3);
  s += cylinder(-22, 0, 7, 6, B) + cylinder(22, 0, 7, 6, B);
  s += `<rect x="-6" y="-46" width="8" height="34" rx="3" fill="${W.side}"/><rect x="4" y="-46" width="8" height="34" rx="3" fill="${W.dark}"/>`;
  s += `<circle cx="3" cy="-44" r="5" fill="${Y.top}"/><circle cx="2" cy="-45" r="2" fill="${Y.hi}"/>`;
  if (level >= 2) s += box(-30, -24, 14, 10, 3, R, 2);       // counterweight block
  if (level >= 3) s += box(18, -24, 12, 10, 3, G, 2);
  if (branch === 'crane') s += `<rect x="-2" y="-92" width="6" height="50" rx="3" fill="${Y.side}"/><rect x="-2" y="-94" width="30" height="6" rx="3" fill="${Y.top}"/><path d="M26 -88 v18" stroke="#555" stroke-width="1.5"/><path d="M22 -70 h8 l-4 6 Z" fill="#666"/>`;
  if (branch === 'slimeBlocks') s += `<ellipse cx="-20" cy="-14" rx="8" ry="3.5" fill="#86d36b" opacity="0.9"/><ellipse cx="18" cy="-12" rx="6" ry="2.6" fill="#86d36b" opacity="0.9"/>`;
  return svgDoc(TOWER_VB, s);
}
/** catapult arm (pivot at origin), with a plastic block in its cup; drawn rotated by the renderer */
export function catapultArm(level: number, branch: BranchId | null) {
  const W = TOY.wood, cup = branch === 'slimeBlocks' ? TOY.green : level >= 3 ? TOY.red : TOY.yellow;
  let s = `<rect x="-4" y="-46" width="8" height="52" rx="4" fill="${W.top}"/><rect x="1" y="-46" width="3" height="52" rx="1.5" fill="${W.side}"/>`;
  s += `<ellipse cx="0" cy="-48" rx="11" ry="6" fill="${TOY.woodDark.side}"/>` + box(-8, -58, 16, 12, 4, cup, 2) + gloss(-3, -60, 4, 1.4, 0.8, 0);
  s += `<circle cx="-2" cy="-55" r="1.8" fill="${cup.top}"/><circle cx="3" cy="-55" r="1.8" fill="${cup.top}"/>`;
  return svgDoc([-30, -70, 60, 80], s);
}

/** bubble blower: glossy plastic tub with a wand and a bubble; level adds bubbles, foam machine is a boxy foam gun */
export function bubble(level: number, branch: BranchId | null) {
  const P = TOY.purple, B = TOY.blue, Y = TOY.yellow, Wt = TOY.white;
  let s = base(level, !!branch);
  if (branch === 'foamMachine') {
    s += box(-22, -40, 44, 34, 8, B, 6) + gloss(-12, -46, 9, 2, 0.8, 0) + `<rect x="18" y="-34" width="18" height="12" rx="6" fill="${Y.side}"/><circle cx="38" cy="-28" r="7" fill="${Wt.top}"/><circle cx="44" cy="-34" r="5" fill="${Wt.top}"/><circle cx="-6" cy="-22" r="6" fill="${P.top}"/><circle cx="8" cy="-22" r="6" fill="${Y.top}"/>`;
  } else {
    s += cylinder(0, -4, 24, 26, P, { band: P.top }) + gloss(-12, -24, 3, 9, 0.75, 6);
    s += `<ellipse cx="0" cy="-30" rx="18" ry="8" fill="#c9e7f7"/><ellipse cx="-4" cy="-31" rx="10" ry="3.5" fill="#fff" opacity="0.6"/>`;
    s += `<path d="M6 -32 L22 -70" stroke="${Y.side}" stroke-width="4" stroke-linecap="round"/><circle cx="24" cy="-76" r="8" fill="none" stroke="${Y.top}" stroke-width="3.5"/>`;
    const n = branch === 'giantBubble' ? 1 : level; for (let i = 0; i < n; i++) { const r = branch === 'giantBubble' ? 22 : 9 - i * 2, bx = branch === 'giantBubble' ? -14 : -18 + i * 13, by = branch === 'giantBubble' ? -86 : -62 - i * 16;
      s += `<circle cx="${bx}" cy="${by}" r="${r}" fill="rgba(200,235,255,.35)"/><circle cx="${bx}" cy="${by}" r="${r}" fill="none" stroke="rgba(255,255,255,.75)" stroke-width="1.6"/><ellipse cx="${bx - r * 0.35}" cy="${by - r * 0.4}" rx="${r * 0.3}" ry="${r * 0.18}" fill="#fff" opacity="0.85"/>`; }
  }
  return svgDoc(TOWER_VB, s);
}

/** rubber-band rifle: wooden toy rifle on a tripod, red band; slingshot ace = big Y slingshot; triple band = three barrels */
export function band(level: number, branch: BranchId | null) {
  const W = TOY.wood, K = TOY.woodDark, R = TOY.red, Y = TOY.yellow, M = TOY.metal;
  let s = base(level, !!branch);
  s += `<path d="M0 -30 L-16 0 M0 -30 L16 0 M0 -30 L0 2" stroke="${K.side}" stroke-width="5" stroke-linecap="round"/>`;
  s += `<circle cx="0" cy="-32" r="6" fill="${M.top}"/>`;
  if (branch === 'slingAce') {
    s += `<path d="M-2 -34 L-2 -60 M-2 -60 L-16 -84 M-2 -60 L12 -84" stroke="${W.top}" stroke-width="8" stroke-linecap="round"/><path d="M-16 -84 Q-2 -64 12 -84" stroke="${R.top}" stroke-width="4" fill="none"/><circle cx="-2" cy="-70" r="5" fill="${R.side}"/>`;
  } else {
    const barrels = branch === 'tripleBand' ? 3 : 1;
    for (let i = 0; i < barrels; i++) { const dy = (i - (barrels - 1) / 2) * 9;
      s += `<rect x="-22" y="${-44 + dy}" width="58" height="8" rx="4" fill="${W.top}"/><rect x="-22" y="${-40 + dy}" width="58" height="4" rx="2" fill="${W.side}"/>`; }
    s += `<path d="M-26 -42 L-10 -36 L-26 -26 Z" fill="${K.top}"/>`;
    s += `<path d="M34 -44 L-14 -44" stroke="${R.top}" stroke-width="3"/><circle cx="34" cy="-41" r="3" fill="${R.side}"/>`;
    if (level >= 2) s += `<rect x="4" y="-52" width="14" height="7" rx="3" fill="${Y.top}"/><circle cx="18" cy="-49" r="3" fill="#7cc7ff"/>`;   // scope
    if (level >= 3) s += `<rect x="-6" y="-38" width="10" height="6" rx="2" fill="${R.top}"/>`;
  }
  return svgDoc(TOWER_VB, s);
}

/** paper-plane hangar: little cardboard hangar with a paper plane on top; origami squadron = three planes; desk fan = toy fan */
export function hangar(level: number, branch: BranchId | null) {
  const Wt = TOY.white, B = TOY.blue, Y = TOY.yellow, R = TOY.red, M = TOY.metal;
  let s = base(level, !!branch);
  if (branch === 'deskFan') {
    s += `<rect x="-4" y="-40" width="8" height="34" rx="3" fill="${M.side}"/>` + cylinder(0, -2, 16, 6, B);
    s += `<circle cx="0" cy="-58" r="26" fill="none" stroke="${M.top}" stroke-width="3"/>`;
    for (let i = 0; i < 3; i++) s += `<ellipse cx="0" cy="-70" rx="7" ry="13" fill="${[R, Y, B][i].top}" opacity="0.92" transform="rotate(${i * 120} 0 -58)"/>`;
    s += `<circle cx="0" cy="-58" r="5" fill="${Y.side}"/>`;
    return svgDoc(TOWER_VB, s);
  }
  // half-cylinder hangar (painted cardboard)
  s += `<path d="M-30 -2 L-30 -24 A30 26 0 0 1 30 -24 L30 -2 Z" fill="${B.side}"/><path d="M-30 -24 A30 26 0 0 1 30 -24" fill="none" stroke="${B.top}" stroke-width="5"/>`;
  s += `<path d="M-12 -2 L-12 -22 A12 10 0 0 1 12 -22 L12 -2 Z" fill="#2e3550"/>`;
  for (let i = -2; i <= 2; i++) s += `<path d="M${i * 11} -48 v8" stroke="${B.dark}" stroke-width="1.2" opacity="0.5"/>`;
  const planes = branch === 'origami' ? 3 : 1;
  for (let i = 0; i < planes; i++) { const px = (i - (planes - 1) / 2) * 22, py = -60 - Math.abs(i - (planes - 1) / 2) * -6 - (level >= 3 ? 4 : 0), col = i === 1 ? Y : i === 2 ? R : Wt;
    s += `<path d="M${px - 18} ${py + 6} L${px + 20} ${py - 2} L${px - 8} ${py - 8} Z" fill="${col.top}"/><path d="M${px - 18} ${py + 6} L${px + 20} ${py - 2} L${px - 4} ${py + 4} Z" fill="${col.side}"/><path d="M${px - 4} ${py + 4} L${px - 6} ${py + 10}" stroke="${col.dark}" stroke-width="1.4"/>`; }
  if (level >= 2) s += `<rect x="24" y="-40" width="5" height="18" fill="${M.side}"/><path d="M29 -40 l10 4 l-10 4 Z" fill="${R.top}"/>`;  // windsock flag
  return svgDoc(TOWER_VB, s);
}
