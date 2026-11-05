/** The wind-up teddy bear captain (felt + stitches + button eyes). Poses: idle, happy (arms up), sad (slumped). Key drawn separately. */
import { TOY } from './palette';
import { svgDoc, shadow, fuzz } from './svg';

export const TEDDY_VB: [number, number, number, number] = [-70, -170, 140, 182];
const FUR = { top: '#c98d5a', side: '#a8703f', dark: '#7d5029', hi: '#e8b88a' };

export function teddy(pose: 'idle' | 'happy' | 'sad') {
  const sad = pose === 'sad', happy = pose === 'happy', dy = sad ? 16 : 0, tilt = sad ? 12 : 0;
  let s = shadow(52, 15, 5, 0.38);
  s += `<g transform="translate(0 ${dy}) rotate(${tilt} 0 -40)">`;
  // legs
  s += `<ellipse cx="-22" cy="-10" rx="18" ry="14" fill="${FUR.side}" filter="url(#fuzz)"/><ellipse cx="22" cy="-10" rx="18" ry="14" fill="${FUR.dark}" filter="url(#fuzz)"/>`;
  s += `<ellipse cx="-24" cy="-8" rx="9" ry="7" fill="#e9c9a6"/><ellipse cx="24" cy="-8" rx="9" ry="7" fill="#d9b48f"/>`;
  // body + captain's jacket (felt, stitched)
  s += `<ellipse cx="0" cy="-48" rx="36" ry="40" fill="${FUR.side}" filter="url(#fuzz)"/>`;
  s += `<path d="M-30 -66 Q0 -82 30 -66 L28 -24 Q0 -14 -28 -24 Z" fill="${TOY.blue.side}"/><path d="M-30 -66 Q0 -82 30 -66 L28 -58 Q0 -72 -30 -58 Z" fill="${TOY.blue.top}"/>`;
  s += `<path d="M-26 -62 Q0 -76 26 -62" stroke="#fff" stroke-width="1.2" stroke-dasharray="3 3" fill="none" opacity="0.7"/>`;
  s += `<circle cx="-8" cy="-50" r="3" fill="${TOY.yellow.top}"/><circle cx="-8" cy="-36" r="3" fill="${TOY.yellow.top}"/><circle cx="8" cy="-50" r="3" fill="${TOY.yellow.top}"/><circle cx="8" cy="-36" r="3" fill="${TOY.yellow.top}"/>`;
  s += `<ellipse cx="-28" cy="-66" rx="9" ry="4.5" fill="${TOY.yellow.top}"/><ellipse cx="28" cy="-66" rx="9" ry="4.5" fill="${TOY.yellow.side}"/>`;
  // arms
  const arm = (side: number) => happy ? `<ellipse cx="${side * 40}" cy="-86" rx="11" ry="22" fill="${side < 0 ? FUR.side : FUR.dark}" transform="rotate(${side * 30} ${side * 40} -86)" filter="url(#fuzz)"/>`
    : `<ellipse cx="${side * 38}" cy="-46" rx="11" ry="22" fill="${side < 0 ? FUR.side : FUR.dark}" transform="rotate(${side * (sad ? 8 : -14)} ${side * 38} -46)" filter="url(#fuzz)"/>`;
  s += arm(-1) + arm(1);
  // head
  s += `<circle cx="-24" cy="-122" r="13" fill="${FUR.side}" filter="url(#fuzz)"/><circle cx="24" cy="-122" r="13" fill="${FUR.dark}" filter="url(#fuzz)"/><circle cx="-24" cy="-122" r="6" fill="#e9c9a6"/><circle cx="24" cy="-122" r="6" fill="#d9b48f"/>`;
  s += `<circle cx="0" cy="-104" r="30" fill="${FUR.side}" filter="url(#fuzz)"/><circle cx="-3" cy="-108" r="26" fill="${FUR.top}" filter="url(#fuzz)"/>` + fuzz(0, -104, 30, 30, FUR.dark, 34, 4);
  s += `<ellipse cx="0" cy="-94" rx="14" ry="10" fill="#e9c9a6"/><ellipse cx="0" cy="-99" rx="5" ry="3.5" fill="#3a2a22"/>`;
  s += `<path d="M0 -96 v5 ${sad ? 'M-6 -86 q6 -5 12 0' : 'M-6 -90 q6 5 12 0'}" stroke="#3a2a22" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
  // button eyes (stitched)
  for (const ex of [-11, 11]) s += `<circle cx="${ex}" cy="-112" r="5.5" fill="#2b2233"/><circle cx="${ex - 1.5}" cy="-114" r="1.6" fill="#fff" opacity="0.8"/><path d="M${ex - 2} -112 h4 M${ex} -114 v4" stroke="#5a4a5a" stroke-width="0.8"/>`;
  if (sad) s += `<path d="M-17 -121 l10 3 M17 -121 l-10 3" stroke="#3a2a22" stroke-width="2" stroke-linecap="round"/>`;
  // captain's hat
  s += `<ellipse cx="0" cy="-132" rx="26" ry="8" fill="${TOY.blue.dark}"/><path d="M-20 -134 Q0 -160 20 -134 Z" fill="${TOY.blue.top}"/><path d="M-6 -146 l6 -6 l6 6 l-6 6 Z" fill="${TOY.yellow.top}"/>`;
  // stitch on the belly
  s += `<path d="M-12 -20 q12 6 24 0" stroke="#7d5029" stroke-width="1.2" stroke-dasharray="3 3" fill="none"/>`;
  s += `</g>`;
  return svgDoc(TEDDY_VB, s);
}
/** the wind-up key (drawn by the renderer at the teddy's back, rotating) */
export function drawKey(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, ang: number) {
  ctx.save(); ctx.translate(x, y); ctx.scale(s, s);
  ctx.fillStyle = '#b8bec8'; ctx.fillRect(-3, -2, 18, 5);
  ctx.translate(18, 0); ctx.scale(Math.max(0.15, Math.abs(Math.cos(ang))), 1);
  ctx.fillStyle = '#d6dae1'; ctx.beginPath(); ctx.ellipse(0, -10, 6, 10, 0, 0, 7); ctx.ellipse(0, 10, 6, 10, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#9aa1ad'; ctx.beginPath(); ctx.ellipse(0, -10, 2.5, 5, 0, 0, 7); ctx.ellipse(0, 10, 2.5, 5, 0, 0, 7); ctx.fill();
  ctx.restore();
}
