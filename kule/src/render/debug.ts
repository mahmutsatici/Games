/** step-1 debug renderer: plain shapes, top-down. Reads sim state only. */
import type { Sim } from '../sim/sim';
import { GRID, TOWERS } from '../sim/config';
const T = GRID.tile;
const COL: Record<string, string> = { soldier: '#d64541', catapult: '#e7a33e', bubble: '#4aa3df', band: '#8e5a2b', hangar: '#7d5fd3' };
const ECOL: Record<string, string> = { bunny: '#9a9a9a', marble: '#6fb3c9', bat: '#5b4a6e', beetle: '#7a6a4e', clay: '#a5735a', robot: '#7f8c8d', king: '#3d3d55' };
export function drawDebug(c: CanvasRenderingContext2D, s: Sim, sel: number) {
  c.fillStyle = '#e9dcc3'; c.fillRect(0, 0, GRID.cols * T, GRID.rows * T);
  c.strokeStyle = 'rgba(0,0,0,.06)'; for (let x = 0; x <= GRID.cols; x++) { c.beginPath(); c.moveTo(x * T, 0); c.lineTo(x * T, GRID.rows * T); c.stroke(); } for (let y = 0; y <= GRID.rows; y++) { c.beginPath(); c.moveTo(0, y * T); c.lineTo(GRID.cols * T, y * T); c.stroke(); }
  for (const p of s.L.map.paths) { c.strokeStyle = '#c8b48f'; c.lineWidth = T * 0.7; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); p.forEach(([x, y], i) => i ? c.lineTo(x * T, y * T) : c.moveTo(x * T, y * T)); c.stroke(); }
  for (const p of s.airPaths) { c.strokeStyle = 'rgba(125,95,211,.3)'; c.lineWidth = 2; c.setLineDash([8, 8]); c.beginPath(); p.pts.forEach(([x, y], i) => i ? c.lineTo(x * T, y * T) : c.moveTo(x * T, y * T)); c.stroke(); c.setLineDash([]); }
  const [gx, gy] = s.goal; c.fillStyle = '#b5651d'; c.fillRect(gx * T - 30, gy * T - 30, 60, 60);
  s.L.map.pads.forEach(([x, y], i) => { c.fillStyle = s.pads[i] ? '#cdb' : '#bba98a'; c.beginPath(); c.arc(x * T, y * T, 32, 0, 7); c.fill(); if (i === sel) { c.strokeStyle = '#000'; c.lineWidth = 3; c.stroke(); } });
  for (const t of s.towers) { const st = s.stats4(t); c.fillStyle = COL[t.kind]; c.beginPath(); c.arc(t.x * T, t.y * T, 24, 0, 7); c.fill();
    c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1; c.beginPath(); c.arc(t.x * T, t.y * T, st.range * T, 0, 7); c.stroke();
    c.fillStyle = '#fff'; c.font = 'bold 18px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(String(t.level) + (t.branch ? '*' : ''), t.x * T, t.y * T);
    c.strokeStyle = '#000'; c.lineWidth = 3; c.beginPath(); c.moveTo(t.x * T, t.y * T); c.lineTo(t.x * T + Math.cos(t.aim) * 30, t.y * T + Math.sin(t.aim) * 30); c.stroke(); }
  for (const e of s.enemies) { if (!e.alive) continue; const r = e.size * T; c.fillStyle = ECOL[e.kind]; c.globalAlpha = e.air ? 0.8 : 1; c.beginPath(); c.arc(e.x * T, e.y * T, r, 0, 7); c.fill(); c.globalAlpha = 1;
    if (e.slow > 0) { c.strokeStyle = '#4aa3df'; c.lineWidth = 3; c.stroke(); }
    c.fillStyle = '#300'; c.fillRect(e.x * T - r, e.y * T - r - 8, 2 * r, 4); c.fillStyle = '#5c5'; c.fillRect(e.x * T - r, e.y * T - r - 8, 2 * r * Math.max(0, e.hp / e.maxHp), 4); }
  for (const p of s.proj) { if (!p.alive) continue; c.fillStyle = p.kind === 'block' ? '#e7a33e' : '#222'; c.beginPath(); c.arc(p.x * T, p.y * T, p.kind === 'block' ? 9 : 4, 0, 7); c.fill(); }
  c.fillStyle = '#222'; c.font = 'bold 22px sans-serif'; c.textAlign = 'left';
  c.fillText(`gold ${Math.floor(s.gold)}  lives ${s.lives}  wave ${s.wave}/${s.totalWaves}  next ${Math.max(0, s.countdown).toFixed(1)}  ${s.state}`, 12, 24);
  c.fillText(Object.keys(TOWERS).map((k, i) => `${i + 1}:${k}`).join('  '), 12, GRID.rows * T - 14);
}
