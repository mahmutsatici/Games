/**
 * Game renderer: reads sim state only. Board (cached), pads, range circle, towers and enemies sorted by depth,
 * projectiles, particles (from sim events), ability effects. 1 tile = 80 px.
 */
import type { Sim, Enemy, Tower, SimEvent } from '../sim/sim';
import { TOWERS, TowerKind, ABILITIES } from '../sim/config';
import { drawSprite, towerKey, sprite } from './sprites';
import { TOY, JUNK } from '../art/palette';
import { motion, reducedMotion } from '../ui/theme';

export const T = 80;
interface Part { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; kind: 'puff' | 'screw' | 'spring' | 'confetti' | 'bubble' | 'spark' | 'block'; c: string; r: number; rot: number; }
interface Coin { x: number; y: number; t: number; n: number; }
export interface View { hoverPad: number; selPad: number; placing: TowerKind | null; shake: number; flash: number; ball: { x: number; y: number; t: number } | null; }
export const view: View = { hoverPad: -1, selPad: -1, placing: null, shake: 0, flash: 0, ball: null };
const parts: Part[] = []; const coins: Coin[] = [];
let coinTarget = { x: 300, y: 40 }; export function setCoinTarget(x: number, y: number) { coinTarget = { x, y }; }
/** called by the HUD: coins that just arrived (for the counter pop) */
export let coinsArrived = 0; export function takeCoinsArrived() { const n = coinsArrived; coinsArrived = 0; return n; }

const POOL = 240;
function part(p: Omit<Part, 'max'>) { if (parts.length >= POOL) parts.shift(); parts.push({ ...p, max: p.life }); }
const R = () => Math.random();
export function burstAt(x: number, y: number, kind: Part['kind'], n: number, cols: string[], sp = 2.2) {
  if (reducedMotion) n = Math.ceil(n / 2);
  for (let i = 0; i < n; i++) { const a = R() * Math.PI * 2, s = sp * (0.4 + R() * 0.6); part({ x, y, z: 0.15, vx: Math.cos(a) * s, vy: Math.sin(a) * s * 0.6, vz: 1.5 + R() * 2.5, life: 0.6 + R() * 0.6, kind, c: cols[i % cols.length], r: 0.06 + R() * 0.06, rot: R() * 6 }); }
}

/** consume sim events → particles, coins, shake; returns the events for the audio layer */
export function consume(s: Sim, events: SimEvent[]) {
  for (const e of events) {
    if (e.t === 'kill') { const q = e.e; burstAt(q.x, q.y, 'puff', q.boss ? 24 : 7, [JUNK.dust.top, JUNK.dust.hi, '#fff'], 1.4);
      burstAt(q.x, q.y, q.kind === 'beetle' || q.kind === 'robot' || q.kind === 'king' ? 'spring' : 'screw', q.boss ? 10 : 3, [TOY.metal.top, TOY.metal.side], 2.5);
      coins.push({ x: q.x, y: q.y, t: 0, n: e.gold }); if (q.boss) view.shake = Math.max(view.shake, 0.6); }
    else if (e.t === 'hit') { if (e.kind === 'block') burstAt(e.x, e.y, 'block', 4, [TOY.yellow.top, TOY.red.top, TOY.blue.top], 2); else if (e.kind === 'bubble') burstAt(e.x, e.y, 'bubble', 3, ['rgba(200,235,255,.8)'], 1); else if (e.kind === 'trap') burstAt(e.x, e.y, 'bubble', 14, ['rgba(200,235,255,.8)'], 3); else burstAt(e.x, e.y, 'spark', 2, ['#fff3c4'], 1.5); }
    else if (e.t === 'build' || e.t === 'upgrade') burstAt(e.tower.x, e.tower.y, 'confetti', 14, [TOY.red.top, TOY.yellow.top, TOY.blue.top, TOY.green.top], 2.6);
    else if (e.t === 'sell') burstAt(e.tower.x, e.tower.y, 'puff', 8, [TOY.wood.top, '#fff'], 1.6);
    else if (e.t === 'ability') { if (e.kind === 'ball') { view.ball = { x: e.x, y: e.y, t: 0 }; view.shake = Math.max(view.shake, 0.45); } else { view.flash = 1; view.shake = Math.max(view.shake, 0.2); } }
    else if (e.t === 'drop') { burstAt(e.e.x, e.e.y, 'puff', 12, [JUNK.dust.top], 2); view.shake = Math.max(view.shake, 0.35); }
    else if (e.t === 'leak') burstAt(e.e.x, e.e.y, 'spark', 6, [JUNK.eye], 2);
  }
  void s;
}

function rangeRing(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, ok = true) {
  ctx.beginPath(); ctx.ellipse(x * T, y * T, r * T, r * T, 0, 0, 7); ctx.fillStyle = ok ? 'rgba(255,250,230,.16)' : 'rgba(229,72,77,.14)'; ctx.fill();
  ctx.setLineDash([10, 8]); ctx.lineWidth = 3; ctx.strokeStyle = ok ? 'rgba(255,255,255,.75)' : 'rgba(229,72,77,.8)'; ctx.stroke(); ctx.setLineDash([]);
}
/** which path stretches a range circle covers (bright dashes along the path) */
function coverage(ctx: CanvasRenderingContext2D, s: Sim, x: number, y: number, r: number) {
  ctx.strokeStyle = 'rgba(255,233,120,.95)'; ctx.lineWidth = 7; ctx.lineCap = 'round';
  for (const p of s.paths) { ctx.beginPath(); let on = false;
    for (let i = 1; i < p.pts.length; i++) { const a = p.pts[i - 1], b = p.pts[i], L = Math.hypot(b[0] - a[0], b[1] - a[1]), n = Math.ceil(L / 0.1);
      for (let k = 0; k <= n; k++) { const t = k / n, px = a[0] + (b[0] - a[0]) * t, py = a[1] + (b[1] - a[1]) * t, inside = (px - x) ** 2 + (py - y) ** 2 <= r * r;
        if (inside && !on) { ctx.moveTo(px * T, py * T); on = true; } else if (inside) ctx.lineTo(px * T, py * T); else on = false; } }
    ctx.stroke(); }
}

export function drawGame(ctx: CanvasRenderingContext2D, s: Sim, boardKey: string, t: number, dt: number) {
  const sh = view.shake * motion(1); view.shake = Math.max(0, view.shake - dt * 1.8);
  ctx.save(); if (sh > 0) ctx.translate((R() - 0.5) * 16 * sh, (R() - 0.5) * 16 * sh);
  const b = sprite(boardKey); if (b) ctx.drawImage(b.c, 0, 0, 1280, 720);
  // pads: hover / selected rings
  s.L.map.pads.forEach(([x, y], i) => { if (s.pads[i]) return; if (i === view.hoverPad || i === view.selPad) { ctx.beginPath(); ctx.ellipse(x * T, y * T + 6, 30, 13, 0, 0, 7); ctx.lineWidth = 4; ctx.strokeStyle = i === view.selPad ? '#fff' : 'rgba(255,255,255,.6)'; ctx.stroke(); } });
  // range preview
  const selT = view.selPad >= 0 ? s.pads[view.selPad] : null;
  if (selT) { const st = s.stats4(selT); coverage(ctx, s, selT.x, selT.y, st.range); rangeRing(ctx, selT.x, selT.y, st.range); }
  else if (view.placing && view.selPad >= 0) { const [x, y] = s.L.map.pads[view.selPad], r = TOWERS[view.placing].range; coverage(ctx, s, x, y, r); rangeRing(ctx, x, y, r); }
  // depth-sorted entities
  const ents: { y: number; f: () => void }[] = [];
  for (const tw of s.towers) ents.push({ y: tw.y, f: () => drawTower(ctx, s, tw, t) });
  aliveCount = 0; for (const e of s.enemies) if (e.alive) aliveCount++;
  for (const e of s.enemies) if (e.alive) ents.push({ y: e.y + (e.air ? 0.6 : 0), f: () => drawEnemy(ctx, s, e, t) });
  ents.sort((a, b) => a.y - b.y); for (const e of ents) e.f();
  drawProjectiles(ctx, s);
  drawParts(ctx, dt);
  // bouncy ball ability: drops, squashes, bounces away
  if (view.ball) { const B = view.ball; B.t += dt; const k = B.t / 0.6; if (k > 1) view.ball = null; else { const z = k < 0.5 ? (1 - k / 0.5) * 300 : Math.sin((k - 0.5) / 0.5 * Math.PI) * 60, sq = k > 0.45 && k < 0.6 ? 0.7 : 1;
    ctx.fillStyle = 'rgba(60,35,15,.3)'; ctx.beginPath(); ctx.ellipse(B.x * T, B.y * T + 8, 40, 14, 0, 0, 7); ctx.fill();
    ctx.save(); ctx.translate(B.x * T, B.y * T - z - 34 * sq); ctx.scale(1 / sq, sq); ctx.fillStyle = TOY.red.top; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill(); ctx.fillStyle = TOY.yellow.top; ctx.fillRect(-34, -6, 68, 12); ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.beginPath(); ctx.ellipse(-12, -16, 10, 5, -0.5, 0, 7); ctx.fill(); ctx.restore();
    if (k > 0.45 && k < 0.5) { ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(B.x * T, B.y * T, ABILITIES.ball.radius * T, ABILITIES.ball.radius * T * 0.5, 0, 0, 7); ctx.stroke(); } } }
  drawCoins(ctx, dt);
  ctx.restore();
  // night-light flash: warm screen glow
  if (view.flash > 0) { ctx.fillStyle = `rgba(255,236,170,${view.flash * 0.55})`; ctx.fillRect(0, 0, 1280, 720); view.flash = Math.max(0, view.flash - dt * 1.4); }
  if (s.flashT > 0) { ctx.fillStyle = `rgba(255,230,160,${Math.min(0.18, s.flashT * 0.1)})`; ctx.fillRect(0, 0, 1280, 720); }
}

function drawTower(ctx: CanvasRenderingContext2D, s: Sim, tw: Tower, t: number) {
  const since = s.time - tw.fireT, recoil = since < 0.15 ? (1 - since / 0.15) * 6 * motion(1) : 0, flip = Math.cos(tw.aim) < -0.1;
  const wob = motion(Math.sin(t * 3 + tw.id) * 0.02), x = tw.x * T - Math.cos(tw.aim) * recoil, y = tw.y * T + 6;
  ctx.save(); ctx.translate(x, y); ctx.rotate(wob); ctx.translate(-x, -y);
  drawSprite(ctx, towerKey(tw.kind, tw.level, tw.branch), x, y, 1, flip);
  if (tw.kind === 'catapult') { const swing = since < 0.4 ? -1.6 * Math.sin(Math.min(1, since / 0.25) * Math.PI / 2) * (1 - Math.max(0, since - 0.25) / 0.15) : 0;
    drawSprite(ctx, `arm:${tw.level}:${tw.branch ?? ''}`, x + (flip ? -3 : 3), y - 38, 1, flip, (flip ? -1 : 1) * (0.35 + swing)); }
  if (tw.kind === 'hangar' && tw.branch === 'deskFan') { ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 2; for (let i = 0; i < 3; i++) { const a = t * 14 + i * 2.1; ctx.beginPath(); ctx.arc(x, y - 58, 20, a, a + 0.6); ctx.stroke(); } }
  ctx.restore();
}
/** soap bubble around slowed / trapped enemies, rendered once */
let bubbleC: HTMLCanvasElement | null = null;
function bubbleSprite() {
  if (bubbleC) return bubbleC; const c = bubbleC = document.createElement('canvas'); c.width = c.height = 120; const g = c.getContext('2d')!; g.scale(2, 2);
  g.fillStyle = 'rgba(200,235,255,.28)'; g.beginPath(); g.arc(30, 30, 26, 0, 7); g.fill(); g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2; g.stroke();
  g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(21, 19, 6.5, 3.6, -0.5, 0, 7); g.fill(); return c;
}
let aliveCount = 0;
function drawEnemy(ctx: CanvasRenderingContext2D, s: Sim, e: Enemy, t: number) {
  const fr = Math.floor((t * (e.air ? 8 : 5) + e.id * 0.37) % 2), flip = Math.cos(e.a) < -0.1;
  const hop = e.kind === 'bunny' || e.kind === 'clay' ? Math.abs(Math.sin(t * 6 + e.id)) * 6 * motion(1) : 0;
  const x = e.x * T, y = e.y * T + (e.air ? -10 : 8) - hop, scale = e.kind === 'king' ? 1 : e.size / 0.3;
  if (e.air) { ctx.fillStyle = 'rgba(60,35,15,.18)'; ctx.beginPath(); ctx.ellipse(x, e.y * T + 22, 16 * scale, 6 * scale, 0, 0, 7); ctx.fill(); }
  const stuck = e.slow > 0 || e.stopT > 0;
  drawSprite(ctx, `e:${e.kind}:${fr}`, x, y, Math.min(1.35, Math.max(0.65, scale)), flip);
  if (s.time - e.hitT < 0.08 && (e.boss || aliveCount < 40)) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.35; drawSprite(ctx, `e:${e.kind}:${fr}`, x, y, Math.min(1.35, Math.max(0.65, scale)), flip); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; }
  if (stuck) { const k = Math.max(0.8, scale); ctx.drawImage(bubbleSprite(), x - 30 * k, y - 52 * k, 60 * k, 60 * k); }
  if (e.hp < e.maxHp) { const w = e.boss ? 90 : 34, yy = y - (e.boss ? 130 : e.air ? 70 : 58) * Math.max(0.8, Math.min(1.2, scale)); ctx.fillStyle = 'rgba(40,30,40,.55)'; ctx.fillRect(x - w / 2 - 2, yy - 2, w + 4, 9);
    ctx.fillStyle = e.hp / e.maxHp > 0.4 ? '#7fd36b' : '#ff8a5c'; ctx.fillRect(x - w / 2, yy, w * Math.max(0, e.hp / e.maxHp), 5); }
}
function drawProjectiles(ctx: CanvasRenderingContext2D, s: Sim) {
  for (const p of s.proj) {
    if (!p.alive) continue; const x = p.x * T, y = p.y * T;
    switch (p.kind) {
      case 'block': { const k = Math.min(1, p.t / p.ttl), z = Math.sin(k * Math.PI) * 90; ctx.fillStyle = 'rgba(60,35,15,.25)'; ctx.beginPath(); ctx.ellipse(x, y + 8, 10, 4, 0, 0, 7); ctx.fill();
        const c = p.tower.branch === 'slimeBlocks' ? TOY.green : p.tower.level >= 3 ? TOY.red : TOY.yellow; ctx.save(); ctx.translate(x, y - z); ctx.rotate(k * 5); ctx.fillStyle = c.side; ctx.fillRect(-9, -6, 18, 14); ctx.fillStyle = c.top; ctx.fillRect(-9, -10, 18, 6); ctx.restore(); break; }
      case 'bubble': ctx.fillStyle = 'rgba(200,235,255,.45)'; ctx.beginPath(); ctx.arc(x, y - 24, 9, 0, 7); ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5; ctx.stroke(); break;
      case 'band': ctx.strokeStyle = TOY.red.top; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y - 30); ctx.lineTo(x - (p.tx - p.x) * 6, y - 30 - (p.ty - p.y) * 6); ctx.stroke(); break;
      case 'plane': { const a = Math.atan2(p.ty - p.y, p.tx - p.x); ctx.save(); ctx.translate(x, y - 34); ctx.rotate(a); ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-10, -7); ctx.lineTo(-6, 0); ctx.lineTo(-10, 7); ctx.closePath(); ctx.fill(); ctx.fillStyle = '#d8d3c8'; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-6, 0); ctx.lineTo(-10, 7); ctx.closePath(); ctx.fill(); ctx.restore(); break; }
      case 'dart': ctx.fillStyle = TOY.yellow.top; ctx.fillRect(x - 7, y - 32, 14, 4); ctx.fillStyle = TOY.red.top; ctx.beginPath(); ctx.arc(x + 8, y - 30, 4, 0, 7); ctx.fill(); break;
      default: ctx.fillStyle = '#d9b48a'; ctx.beginPath(); ctx.ellipse(x, y - 30, 5, 4, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#b78f63'; ctx.fillRect(x - 2, y - 33, 3, 6);
    }
  }
}
function drawParts(ctx: CanvasRenderingContext2D, dt: number) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]; p.life -= dt; if (p.life <= 0) { parts.splice(i, 1); continue; }
    p.x += p.vx * dt; p.y += p.vy * dt; p.z = Math.max(0, p.z + p.vz * dt); p.vz -= 9 * dt; if (p.z === 0) { p.vz = Math.abs(p.vz) * 0.4; p.vx *= 0.6; p.vy *= 0.6; } p.rot += dt * 8;
    const a = Math.min(1, p.life / p.max * 1.5), x = p.x * T, y = p.y * T, z = p.z * T, r = p.r * T;
    if (parts.length < 120) { ctx.globalAlpha = a * 0.25; ctx.fillStyle = '#3c230f'; ctx.fillRect(x - r, y + 3, r * 2, r * 0.6); }   // tiny shadow (skipped when busy)
    ctx.globalAlpha = a; ctx.fillStyle = p.c;
    if (p.kind === 'puff') { const k = 1 + (1 - p.life / p.max) * 1.6; ctx.beginPath(); ctx.arc(x, y - z - r, r * k, 0, 7); ctx.fill(); }
    else if (p.kind === 'bubble') { ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y - z - r * 2, r * 1.4, 0, 7); ctx.stroke(); }
    else if (p.kind === 'spring') { ctx.strokeStyle = p.c; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 6; k++) ctx.lineTo(x + (k % 2 ? 4 : -4), y - z - k * 2.5); ctx.stroke(); }
    else { ctx.save(); ctx.translate(x, y - z); ctx.rotate(p.rot); ctx.fillRect(-r, -r * 0.6, r * 2, r * 1.2); ctx.restore(); }
  }
  ctx.globalAlpha = 1;
}
function drawCoins(ctx: CanvasRenderingContext2D, dt: number) {
  for (let i = coins.length - 1; i >= 0; i--) {
    const c = coins[i]; c.t += dt * 1.6; if (c.t >= 1) { coinsArrived += c.n; coins.splice(i, 1); continue; }
    const k = c.t * c.t, sx = c.x * T, sy = c.y * T - 40, x = sx + (coinTarget.x - sx) * k, y = sy + (coinTarget.y - sy) * k - Math.sin(c.t * Math.PI) * 60;
    ctx.fillStyle = TOY.yellow.side; ctx.beginPath(); ctx.ellipse(x, y + 2, 11, 11, 0, 0, 7); ctx.fill(); ctx.fillStyle = TOY.yellow.top; ctx.beginPath(); ctx.ellipse(x, y, 11, 11, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(x - 4, y - 4, 4, 2, -0.6, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  }
}
export function clearFx() { parts.length = 0; coins.length = 0; view.ball = null; view.flash = 0; view.shake = 0; }
