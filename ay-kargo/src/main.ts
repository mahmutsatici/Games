import { createPlatform } from './platform';
import type { Platform } from './platform/types';
import { setLang, t } from './i18n';
import { loadSave, save, persist, buy, upgradeCost, UPGRADES, MAX_LEVEL, starsOf, levelUnlocked, endlessUnlocked, dailyAvailable, dailyNextDay, claimDaily, DAILY_COINS } from './game/save';
import { initAudio, setMuted, setAdMuted, isMuted, engine, ufoHum, wind, sfx } from './game/audio';
import { WORLDS, makeLevel, LevelDef } from './game/levels';
import { Sim, Input } from './game/world';
import { Camera, drawWorld, backdrop, skyCss, setPixelScale, W, H, rr } from './game/render';
import { buttons, resetButtons, button, hit, text, panel, icon, Icon, Tone } from './game/ui';

type Scene = 'title' | 'map' | 'pre' | 'drive' | 'result' | 'garage' | 'daily' | 'recharge';
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!; // transparent: the sky is the canvas' CSS background
let platform: Platform;
let scene: Scene = 'title', sceneT = 0;
let wi = 0; let sel: LevelDef = makeLevel(0, 0); let selShield = false;
let sim: Sim | null = null; const cam = new Camera();
let demo: Sim | null = null; const demoCam = new Camera();
let paused = false, adBusy = false, doubled = false, earned = 0, shown = 0, newBest = false, dailyShown = false, dailyMsg = 0, flashT = 0;
let coinShown = 0, coinPop = 0;
const keys: Record<string, boolean> = {}; const touches = new Map<number, 'gas' | 'brake' | 'turbo'>();
let touchUI = matchMedia('(pointer: coarse)').matches;
let usedKeys = false;

// ---------- layout / scaling ----------
/** renderScale < 1 lowers the backing-store resolution on slow devices (adapted from measured frame times). */
let renderScale = 1, perfT = 0, adaptOn = true;
const stormEl = document.getElementById('storm') as HTMLDivElement; let stormShown = -1;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), sw = window.innerWidth, sh = window.innerHeight, s = Math.min(sw / W, sh / H);
  canvas.style.width = W * s + 'px'; canvas.style.height = H * s + 'px';
  Object.assign(stormEl.style, { width: W * s + 'px', height: H * s + 'px', left: (sw - W * s) / 2 + 'px', top: (sh - H * s) / 2 + 'px' });
  const k = Math.min(dpr, 1280 / (W * s)) * renderScale; // never render more than 1280 px wide
  canvas.width = Math.round(W * s * Math.max(k, 0.5)); canvas.height = Math.round(H * s * Math.max(k, 0.5));
}
function adaptResolution(dt: number) {
  // react to the share of slow frames (not the average, which vsync jitter inflates); hold 2.5 s between steps
  perfT += dt; if (!adaptOn || perfT < 2.5 || frameTimes.length < 90 || scene !== 'drive' || paused) return;
  const recent = frameTimes.slice(-90), slow = recent.filter(x => x > 25).length / recent.length;
  if (slow > 0.12 && renderScale > 0.55) { renderScale = Math.max(0.55, Math.round((renderScale - 0.15) * 100) / 100); resize(); perfT = 0; }
  else if (slow < 0.01 && renderScale < 1) { renderScale = Math.min(1, Math.round((renderScale + 0.1) * 100) / 100); resize(); perfT = -3; }
}
window.addEventListener('resize', resize); resize();
const cssScale = () => canvas.getBoundingClientRect().width / W || 1;
const toLogical = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
/** touch pedals: ~90 css px, never smaller than 100 logical px */
function pedals() {
  const sz = Math.max(100, Math.min(190, 90 / cssScale())), m = 22;
  return { sz, brake: { x: m + sz / 2, y: H - m - sz / 2 }, gas: { x: W - m - sz / 2, y: H - m - sz / 2 }, turbo: { x: W - m - sz / 2, y: H - m - sz * 1.42, r: sz * 0.4 } };
}

// ---------- input ----------
window.addEventListener('keydown', e => { keys[e.code] = true; initAudio();
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) { e.preventDefault(); usedKeys = true; touchUI = false; }
  if (scene === 'drive' && (e.code === 'Escape' || e.code === 'KeyP')) setPaused(!paused);
  if (scene === 'title' && (e.code === 'Enter' || e.code === 'Space')) go('map'); });
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', e => { initAudio(); canvas.focus(); if (e.pointerType === 'touch') touchUI = true;
  const p = toLogical(e); if (adBusy) return;
  if (hit(p.x, p.y)) { sfx.click(); return; }
  if (scene === 'title') { go('map'); return; }
  if (scene === 'drive' && !paused) {
    const P = pedals(); const zone = touchUI && Math.hypot(p.x - P.turbo.x, p.y - P.turbo.y) < P.turbo.r * 1.25 ? 'turbo' : p.x < W / 2 ? 'brake' : 'gas';
    touches.set(e.pointerId, zone); canvas.setPointerCapture(e.pointerId);
  } });
const up = (e: PointerEvent) => { touches.delete(e.pointerId); };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', e => e.preventDefault());
function readInput(): Input {
  const v = [...touches.values()];
  return { gas: !!(keys.ArrowRight || keys.KeyD || v.includes('gas')), brake: !!(keys.ArrowLeft || keys.KeyA || v.includes('brake')), turbo: !!(keys.Space || keys.ShiftLeft || keys.ArrowUp || keys.KeyW || v.includes('turbo')) };
}
document.addEventListener('visibilitychange', () => { if (document.hidden && scene === 'drive') setPaused(true); });
window.addEventListener('blur', () => { if (scene === 'drive') setPaused(true); });

// ---------- flow ----------
function go(s: Scene) { scene = s; sceneT = 0; }
function setPaused(p: boolean) { if (scene !== 'drive' || !sim) return; paused = p; touches.clear(); p ? platform.gameplayStop() : platform.gameplayStart(); }
async function ad<T>(fn: () => Promise<T>): Promise<T> { adBusy = true; try { return await fn(); } finally { adBusy = false; } }
async function startRun(lv: LevelDef, shield = false) {
  platform.gameplayStop(); await ad(() => platform.commercialBreak());
  sim = new Sim(lv, shield); sel = lv; cam.init = false; paused = false; doubled = false; shown = 0; newBest = false; touches.clear(); coinShown = 0;
  go('drive'); platform.gameplayStart();
}
function finishRun() {
  if (!sim) return; platform.gameplayStop(); engine(0, false, false); ufoHum(false); wind(0);
  earned = sim.coinsEarned; save.coins += earned; doubled = false; shown = 0; newBest = false;
  if (sim.state === 'win') { const k = `${sel.world}-${sel.index}`; if ((save.stars[k] || 0) < sim.stars) save.stars[k] = sim.stars; if (sim.stars === 3) platform.happyMoment(); }
  if (sel.endless && sim.distance > save.endlessBest) { save.endlessBest = Math.floor(sim.distance); newBest = true; }
  persist(); go('result');
}
const nextLevel = (): LevelDef => { if (sel.endless) return makeLevel(sel.world, 9, true, (Math.random() * 1e6) | 0); const n = sel.world * 10 + sel.index + 1; return n >= 30 ? makeLevel(2, 9, true, (Math.random() * 1e6) | 0) : makeLevel(Math.floor(n / 10), n % 10); };
const flashMsg = () => { flashT = 0.6; };

// ---------- drawing helpers ----------
const CHIP = 'rgba(12,16,30,.72)';
function chipOn(c: CanvasRenderingContext2D, x: number, y: number, w: number, h = 64) { rr(c, x, y, w, h, 20); c.fillStyle = CHIP; c.fill(); c.lineWidth = 2; c.strokeStyle = 'rgba(255,255,255,.14)'; c.stroke(); }
const chip = (x: number, y: number, w: number, h = 64) => chipOn(ctx, x, y, w, h);
const coinBar = (x = 24, y = 20) => { chip(x, y, 200); icon(ctx, 'coin', x + 36, y + 32, 38); text(ctx, save.coins, x + 66, y + 33, 32, '#ffe27a', 'left'); };
const soundBtn = (x: number, y: number) => button(ctx, x, y, 64, 64, 'gray', () => { setMuted(!isMuted()); save.muted = isMuted(); persist(); }, (cx, cy) => icon(ctx, isMuted() ? 'soundOff' : 'sound', cx, cy, 36));
const iconBtn = (x: number, y: number, s: number, tone: Tone, ic: Icon, cb: () => void) => button(ctx, x, y, s, s, tone, cb, (cx, cy) => icon(ctx, ic, cx, cy, s * 0.6));
const stars3 = (cx: number, cy: number, n: number, size: number) => { for (let i = 0; i < 3; i++) icon(ctx, i < n ? 'star' : 'starOff', cx + (i - 1) * size * 1.15, cy + (i === 1 ? -size * 0.2 : 0), size); };
const dim = (a = 0.62) => { ctx.fillStyle = `rgba(4,6,16,${a})`; ctx.fillRect(0, 0, W, H); };

// ---------- scenes ----------
function drawTitle(dt: number) {
  // attract mode: the real game drives itself behind the title
  if (!demo || demo.state !== 'run' || demo.distance > 140) { demo = new Sim(makeLevel(0, 0)); demoCam.init = false; }
  const a = demo.chassis.getAngle();
  demo.update(dt, { gas: Math.cos(a) > 0.85 || demo.grounded === 0 ? demo.grounded > 0 || a < 0.3 : false, brake: demo.grounded === 0 && a > 0.4, turbo: false });
  demoCam.follow(demo, dt); drawWorld(ctx, demo, demoCam, sceneT, dt);
  const g = ctx.createLinearGradient(0, 0, 0, 330); g.addColorStop(0, 'rgba(2,4,12,.75)'); g.addColorStop(1, 'rgba(2,4,12,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 330);
  const y = 150 + Math.sin(sceneT * 2) * 5; text(ctx, t('title'), W / 2, y, 112, '#fff');
  ctx.fillStyle = WORLDS[0].accent; ctx.fillRect(W / 2 - 140, y + 66, 280, 8);
  button(ctx, W / 2 - 120, 540, 240, 140, 'green', () => go('map'), (cx, cy) => icon(ctx, 'play', cx, cy, 92), true);
  soundBtn(W - 88, 24);
}

function drawMap(dt: number) {
  const w = WORLDS[wi]; backdrop(ctx, wi, sceneT * 0.5, 0, sceneT, dt);
  ctx.fillStyle = w.ground.mid; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 600 + Math.sin(x / 140 + wi) * 18 + Math.sin(x / 47) * 6); ctx.lineTo(W, H); ctx.fill();
  ctx.strokeStyle = w.ground.rim; ctx.lineWidth = 5; ctx.beginPath(); for (let x = 0; x <= W; x += 20) { const yy = 600 + Math.sin(x / 140 + wi) * 18 + Math.sin(x / 47) * 6; x ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke();
  coinBar(); soundBtn(W - 88, 20);
  iconBtn(W - 168, 20, 64, 'amber', 'garage', () => go('garage'));
  const avail = dailyAvailable(); iconBtn(W - 248, 20, 64, avail ? 'green' : 'gray', 'gift', () => { dailyShown = true; go('daily'); });
  if (wi > 0) iconBtn(28, 300, 88, 'blue', 'left', () => { wi--; });
  if (wi < 2 && starsOf(wi, 9) > 0) iconBtn(W - 116, 300, 88, 'blue', 'right', () => { wi++; });
  text(ctx, t((['moon', 'mars', 'ice'] as const)[wi]), W / 2, 66, 56, w.accent);
  for (let i = 0; i < 10; i++) {
    const x = 170 + i * 104, y = 360 + Math.sin(i * 0.9 + 0.5) * 70, ok = levelUnlocked(wi, i), st = starsOf(wi, i);
    if (i < 9) { ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 8; ctx.setLineDash([2, 14]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(170 + (i + 1) * 104, 360 + Math.sin((i + 1) * 0.9 + 0.5) * 70); ctx.stroke(); ctx.setLineDash([]); }
    button(ctx, x - 44, y - 44, 88, 88, ok ? (st ? 'green' : 'blue') : 'gray', () => { if (ok) { sel = makeLevel(wi, i); selShield = false; go('pre'); } else flashMsg(); }, (cx, cy) => ok ? text(ctx, i + 1, cx, cy, 44) : icon(ctx, 'lock', cx, cy, 44), ok && !st);
    if (ok) stars3(x, y + 66, st, 22);
  }
  if (endlessUnlocked()) button(ctx, W - 250, 610, 210, 92, 'amber', () => { sel = makeLevel(wi, 9, true, (Math.random() * 1e6) | 0); selShield = false; go('pre'); }, (cx, cy) => { icon(ctx, 'inf', cx - 44, cy, 56); if (save.endlessBest) text(ctx, save.endlessBest + 'm', cx + 40, cy, 28); });
  if (!dailyShown && avail && sceneT > 0.4) { dailyShown = true; go('daily'); }
}

function drawPre(dt: number) {
  drawMap(dt); dim(); buttons.length = 0;
  panel(ctx, 240, 100, 800, 520);
  if (sel.endless) icon(ctx, 'inf', W / 2, 160, 90); else text(ctx, `${t('level')} ${sel.world * 10 + sel.index + 1}`, W / 2, 160, 46, WORLDS[sel.world].accent);
  icon(ctx, 'crate', 420, 255, 60); text(ctx, sel.crates, 470, 257, 46, '#fff', 'left');
  if (sel.endless) text(ctx, save.endlessBest + 'm', 760, 257, 46, '#ffe27a');
  else { icon(ctx, 'map', 690, 255, 54); text(ctx, `${sel.length}m`, 730, 257, 42, '#fff', 'left'); }
  const hz: Icon[] = []; if (sel.slime > 0) hz.push('slime'); if (sel.meteor > 0) hz.push('meteor'); if (sel.ufo > 0) hz.push('ufo');
  hz.forEach((h, i) => icon(ctx, h, 640 + (i - (hz.length - 1) / 2) * 96, 345, 66));
  button(ctx, 300, 430, 330, 140, 'green', () => { startRun(sel, selShield); }, (cx, cy) => icon(ctx, 'play', cx, cy, 92), true);
  button(ctx, 650, 430, 330, 140, 'amber', async () => { if (adBusy) return; const ok = await ad(() => platform.rewardedBreak()); if (ok) { selShield = true; startRun(sel, true); } else flashMsg(); },
    (cx, cy) => { icon(ctx, 'clapper', cx - 70, cy, 70); icon(ctx, 'plus', cx - 6, cy, 34); icon(ctx, 'shield', cx + 60, cy, 70, '#8ff0ff'); });
  iconBtn(262, 122, 64, 'gray', 'back', () => go('map'));
}

function drawGarage(dt: number) {
  backdrop(ctx, 0, 0, 0, sceneT, dt); dim(0.5);
  coinBar(); iconBtn(W - 100, 20, 64, 'green', 'back', () => go('map'));
  text(ctx, t('garage'), W / 2, 54, 52, '#ffd9a8');
  UPGRADES.forEach((id, i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 40 + col * 305, y = 116 + row * 296, lvl = save.up[id], mx = MAX_LEVEL[id], maxed = lvl >= mx, cost = maxed ? 0 : upgradeCost(id, lvl), can = !maxed && save.coins >= cost;
    panel(ctx, x, y, 285, 276);
    icon(ctx, id === 'shield' ? 'shield' : id === 'turbo' ? 'bolt' : id === 'battery' ? 'battery' : (id as Icon), x + 142, y + 62, 84, '#fff');
    text(ctx, t(id), x + 142, y + 120, 26, '#cfd6f5');
    for (let k = 0; k < mx; k++) { const px = x + 142 + (k - (mx - 1) / 2) * 25; ctx.fillStyle = k < lvl ? '#5ee06a' : 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(px, y + 152, 8, 0, 7); ctx.fill(); }
    button(ctx, x + 26, y + 182, 233, 76, maxed ? 'gray' : can ? 'green' : 'gray', () => { if (maxed) return; if (buy(id)) sfx.coin(); else flashMsg(); },
      (cx, cy) => { if (maxed) text(ctx, t('max'), cx, cy, 34, '#ddd'); else { icon(ctx, 'coin', cx - 52, cy, 40); text(ctx, cost, cx - 22, cy + 1, 34, can ? '#fff' : '#ff9a9a', 'left'); } });
  });
}

function drawDaily(dt: number) {
  drawMap(dt); dim(0.66); buttons.length = 0;
  panel(ctx, 140, 100, 1000, 520); icon(ctx, 'gift', W / 2, 165, 74);
  const next = dailyNextDay(), avail = dailyAvailable();
  for (let i = 0; i < 7; i++) { const x = 168 + i * 136, cur = i + 1 === next && avail, done = avail ? i + 1 < next : i + 1 <= save.streak;
    rr(ctx, x, 236, 116, 174, 18); ctx.fillStyle = cur ? '#2b7a3a' : done ? '#27304d' : '#1b2038'; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = cur ? '#5ee06a' : 'rgba(255,255,255,.18)'; ctx.stroke();
    text(ctx, i + 1, x + 58, 266, 28, '#9fb4ff'); icon(ctx, 'coin', x + 58, 328, 54); text(ctx, DAILY_COINS[i], x + 58, 384, 30, '#ffe27a'); if (done) icon(ctx, 'check', x + 58, 328, 60, '#5ee06a'); }
  if (avail) button(ctx, W / 2 - 160, 446, 320, 130, 'green', () => { dailyMsg = claimDaily(); sfx.coin(); go('map'); }, (cx, cy) => { icon(ctx, 'plus', cx - 74, cy, 40); icon(ctx, 'coin', cx - 12, cy, 54); text(ctx, DAILY_COINS[next - 1], cx + 28, cy, 40, '#fff', 'left'); }, true);
  else button(ctx, W / 2 - 110, 456, 220, 110, 'blue', () => go('map'), (cx, cy) => icon(ctx, 'back', cx, cy, 58));
}

let failT = 0;
function drawDrive(dt: number) {
  const s = sim!; const inp = readInput();
  if (!paused && !adBusy) {
    s.update(dt, inp);
    const ws = Math.abs(s.wheels[1].getAngularVelocity()) / 26;
    engine(Math.min(1, ws), inp.gas, s.state === 'run' && s.battery > 0); ufoHum(!!s.ufo && s.ufo.beam > 0.1); wind(s.storm);
    cam.follow(s, dt);
    if (s.state === 'win' && s.winT > 1.2) finishRun();
    else if (s.state === 'fail') { if (s.failReason === 'battery' && !s.rechargeUsed) { platform.gameplayStop(); engine(0, false, false); go('recharge'); } else { failT += dt; if (failT > 1.0) { failT = 0; finishRun(); } } }
  } else { engine(0, false, false); ufoHum(false); wind(0); }
  drawWorld(ctx, s, cam, sceneT, paused ? 0 : dt);
  drawHud(s, dt, inp);
  if (paused) { dim(0.6); panel(ctx, W / 2 - 300, 150, 600, 340); text(ctx, t('paused'), W / 2, 220, 62);
    button(ctx, W / 2 - 250, 290, 160, 160, 'green', () => setPaused(false), (cx, cy) => icon(ctx, 'play', cx, cy, 84));
    button(ctx, W / 2 - 80, 290, 160, 160, 'amber', () => { platform.gameplayStop(); startRun(sel, false); }, (cx, cy) => icon(ctx, 'retry', cx, cy, 84));
    button(ctx, W / 2 + 90, 290, 160, 160, 'blue', () => { platform.gameplayStop(); go('map'); }, (cx, cy) => icon(ctx, 'map', cx, cy, 84)); }
}

// The top bar is drawn into an offscreen canvas and only redrawn when a displayed value changes.
const hudCanvas = document.createElement('canvas'); let hudKey = '';
function hudTop(s: Sim, ctx: CanvasRenderingContext2D) {
  const Y0 = 16, Hc = 64;
  // battery (+ turbo + shields underneath)
  chipOn(ctx, 16, Y0, 252, Hc); const low = s.energy < 0.25, blink = low && Math.sin(sceneT * 10) > 0;
  icon(ctx, 'battery', 54, Y0 + 32, 40, blink ? '#ff6b5e' : '#fff');
  for (let i = 0; i < 10; i++) { const on = s.energy > i / 10 + 0.001; rr(ctx, 86 + i * 17.5, Y0 + 20, 14, 24, 4); ctx.fillStyle = on ? (low ? '#ff5a4d' : i < 3 ? '#9be36a' : '#5ee06a') : 'rgba(255,255,255,.12)'; ctx.fill(); }
  let ux = 16;
  if (!touchUI) { chipOn(ctx, ux, Y0 + Hc + 10, 170, 48); icon(ctx, 'bolt', ux + 30, Y0 + Hc + 34, 30, s.turboOn ? '#ffd23a' : '#fff'); rr(ctx, ux + 52, Y0 + Hc + 26, 104, 16, 6); ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fill(); rr(ctx, ux + 52, Y0 + Hc + 26, 104 * s.turbo, 16, 6); ctx.fillStyle = '#ffd23a'; ctx.fill(); ux += 180; }
  if (s.shields > 0) { chipOn(ctx, ux, Y0 + Hc + 10, 14 + s.shields * 40, 48); for (let i = 0; i < s.shields; i++) icon(ctx, 'shield', ux + 27 + i * 40, Y0 + Hc + 34, 32, '#8ff0ff'); }
  // crates: icons turn into empty outlines with a short shake when lost
  const n = s.L.crates, cw = 26 + n * 44; chipOn(ctx, 280, Y0, cw, Hc);
  for (let i = 0; i < n; i++) { const c = s.crates[i], x = 280 + 35 + i * 44, y = Y0 + 32;
    if (!c.lost) icon(ctx, c.glass ? 'glassCrate' : 'crate', x, y, 38);
    else { const k = s.t - c.lostT, sh = k < 0.5 ? Math.sin(k * 60) * 5 * (1 - k * 2) : 0; ctx.setLineDash([5, 4]); ctx.strokeStyle = k < 0.5 ? '#ff6b5e' : 'rgba(255,255,255,.4)'; ctx.lineWidth = 2.5; ctx.strokeRect(x - 15 + sh, y - 15, 30, 30); ctx.setLineDash([]); } }
  // progress to goal flag / endless distance
  const px0 = 590, px1 = 890; chipOn(ctx, px0 - 14, Y0, px1 - px0 + 28, Hc);
  if (!s.L.endless) {
    rr(ctx, px0, Y0 + 26, px1 - px0 - 34, 12, 6); ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill();
    rr(ctx, px0, Y0 + 26, (px1 - px0 - 34) * s.progress, 12, 6); ctx.fillStyle = '#5ab4ff'; ctx.fill();
    icon(ctx, 'flag', px1 - 14, Y0 + 30, 36); const mx = px0 + (px1 - px0 - 34) * s.progress; ctx.fillStyle = '#ff8a3d'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(mx, Y0 + 32, 11, 0, 7); ctx.fill(); ctx.stroke();
  } else text(ctx, Math.floor(s.distance) + 'm', (px0 + px1) / 2, Y0 + 33, 38, '#ffe27a');
  // coins earned this run (count-up + pop)
  chipOn(ctx, 906, Y0, 178, Hc); ctx.save(); ctx.translate(944, Y0 + 32); ctx.scale(1 + coinPop * 0.25, 1 + coinPop * 0.25); icon(ctx, 'coin', 0, 0, 38); ctx.restore(); text(ctx, Math.floor(coinShown), 974, Y0 + 33, 34, '#ffe27a', 'left');
  button(ctx, W - 80, Y0, 64, 64, 'gray', () => setPaused(true), (cx, cy) => icon(ctx, 'pause', cx, cy, 38));
}
function drawHud(s: Sim, dt: number, inp: Input) {
  const target = s.coinsRun; if (coinShown < target) { coinShown = Math.min(target, coinShown + dt * Math.max(12, (target - coinShown) * 8)); coinPop = 1; } coinPop = Math.max(0, coinPop - dt * 4);
  const k = canvas.width / W, low = s.energy < 0.25;
  const key = [canvas.width, Math.ceil(s.energy * 10 - 0.001), low && Math.sin(sceneT * 10) > 0, touchUI, s.turboOn, Math.round(s.turbo * 50), s.shields, s.crates.map(c => c.lost ? (s.t - c.lostT < 0.5 ? 'L' + Math.round((s.t - c.lostT) * 30) : 'x') : 'o').join(''),
    s.L.endless ? Math.floor(s.distance) : Math.round(s.progress * 150), Math.floor(coinShown), Math.round(coinPop * 8)].join('|');
  if (key !== hudKey) {
    hudKey = key; const hh = Math.ceil(150 * k);
    if (hudCanvas.width !== canvas.width || hudCanvas.height !== hh) { hudCanvas.width = canvas.width; hudCanvas.height = hh; }
    const hc = hudCanvas.getContext('2d', { willReadFrequently: true })!; hc.setTransform(1, 0, 0, 1, 0, 0); hc.clearRect(0, 0, hudCanvas.width, hudCanvas.height); hc.setTransform(k, 0, 0, k, 0, 0);
    hudTop(s, hc);
  }
  ctx.drawImage(hudCanvas, 0, 0, W, hudCanvas.height / k); // dynamic: redrawn only when values change
  buttons.push({ x: W - 16 - 64, y: 16, w: 64, h: 64, cb: () => setPaused(true) });
  // ufo warning
  if (s.ufo && !s.ufo.leaving && Math.floor(sceneT * 5) % 2 === 0) icon(ctx, 'ufo', W / 2, 128, 54, '#ff6b5e');
  // touch pedals (compact, semi-transparent, same style)
  if (touchUI) {
    const P = pedals(), down = [...touches.values()];
    const pedal = (x: number, y: number, r: number, ic: Icon, on: boolean, ring = -1) => {
      ctx.fillStyle = on ? 'rgba(90,180,255,.45)' : 'rgba(12,16,30,.45)'; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = on ? '#9fd4ff' : 'rgba(255,255,255,.35)'; ctx.stroke();
      if (ring >= 0) { ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(x, y, r - 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring); ctx.stroke(); }
      ctx.globalAlpha = 0.9; icon(ctx, ic, x, y, r * 0.9); ctx.globalAlpha = 1; };
    pedal(P.brake.x, P.brake.y, P.sz / 2, 'left', down.includes('brake') || inp.brake && !keys.ArrowLeft);
    pedal(P.gas.x, P.gas.y, P.sz / 2, 'right', down.includes('gas'));
    pedal(P.turbo.x, P.turbo.y, P.turbo.r, 'bolt', down.includes('turbo'), s.turbo);
  } else if (sel.world === 0 && sel.index === 0 && !sel.endless && s.distance < 30 && s.t < 9) {
    // key hint on the first level only
    const y = H - 70, al = Math.min(1, (9 - s.t) / 1.5); ctx.globalAlpha = al; chip(W / 2 - 290, y - 38, 580, 76);
    const cap = (x: number, w: number, lbl: string | Icon, ic = false) => { rr(ctx, x, y - 24, w, 48, 10); ctx.fillStyle = '#e9edf5'; ctx.fill(); ctx.strokeStyle = '#7a8296'; ctx.lineWidth = 2; ctx.stroke(); if (ic) icon(ctx, lbl as Icon, x + w / 2, y, 26, '#2a3142'); else text(ctx, lbl, x + w / 2, y + 1, 24, '#2a3142', 'center', false); };
    cap(W / 2 - 270, 48, 'left', true); cap(W / 2 - 216, 48, 'A'); icon(ctx, 'brakeIc', W / 2 - 132, y, 40);
    cap(W / 2 - 80, 48, 'right', true); cap(W / 2 - 26, 48, 'D'); icon(ctx, 'gasIc', W / 2 + 58, y, 40);
    cap(W / 2 + 110, 110, 'bolt', true); icon(ctx, 'turboIc', W / 2 + 252, y, 40); ctx.globalAlpha = 1;
  }
}

function drawResult(dt: number) {
  const s = sim!; drawWorld(ctx, s, cam, sceneT, 0); dim(0.66);
  const win = s.state === 'win'; panel(ctx, 250, 60, 780, 600);
  shown = Math.min(earned * (doubled ? 2 : 1), shown + dt * Math.max(40, earned * 1.6));
  if (s.L.endless) { icon(ctx, 'inf', W / 2, 135, 74); text(ctx, Math.floor(s.distance) + 'm', W / 2, 215, 66, newBest ? '#5ee06a' : '#ffe27a'); }
  else {
    const ns = win ? Math.min(s.stars, Math.floor(sceneT * 2.5)) : 0; if (ns > (drawResult as any).ls) { sfx.star(ns); } (drawResult as any).ls = ns; stars3(W / 2, 145, ns, 84);
    icon(ctx, 'crate', W / 2 - 96, 250, 58); text(ctx, `${s.delivered} / ${s.L.crates}`, W / 2 - 52, 252, 56, win ? '#fff' : '#ff9a9a', 'left');
    if (!win) icon(ctx, s.failReason === 'flip' ? 'flip' : s.failReason === 'battery' ? 'battery' : 'crate', W / 2 + 200, 250, 50, '#ff6b5e');
  }
  icon(ctx, 'coin', W / 2 - 110, 345, 70); text(ctx, `+${Math.floor(shown)}`, W / 2 - 64, 347, 72, '#ffe27a', 'left');
  const bw = 230, by = 430, rew = !doubled && earned > 0;
  button(ctx, rew ? W / 2 - bw - 12 : W / 2 - bw / 2, by, bw, 140, 'green', () => startRun(win ? nextLevel() : sel, false), (cx, cy) => icon(ctx, win ? 'next' : 'retry', cx, cy, 88), true);
  if (rew) button(ctx, W / 2 + 12, by, bw, 140, 'amber', async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { save.coins += earned; doubled = true; persist(); sfx.coin(); } else flashMsg(); }, (cx, cy) => { icon(ctx, 'clapper', cx - 44, cy, 66); icon(ctx, 'x2', cx + 50, cy, 58, '#fff'); });
  iconBtn(290, 586, 60, 'amber', 'garage', () => go('garage')); iconBtn(W - 350, 586, 60, 'blue', 'map', () => go('map'));
}

function drawRecharge() {
  const s = sim!; drawWorld(ctx, s, cam, sceneT, 0); dim(0.66); panel(ctx, 300, 150, 680, 420);
  icon(ctx, 'battery', W / 2, 245, 116, '#ff6b5e');
  button(ctx, 340, 340, 285, 160, 'amber', async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { s.recharge(); go('drive'); platform.gameplayStart(); } else flashMsg(); }, (cx, cy) => { icon(ctx, 'clapper', cx - 52, cy, 72); icon(ctx, 'battery', cx + 52, cy, 72, '#5ee06a'); });
  button(ctx, 655, 340, 285, 160, 'green', () => { s.rechargeUsed = true; finishRun(); }, (cx, cy) => icon(ctx, 'next', cx, cy, 84), true);
}

// ---------- loop ----------
let last = 0, lastSky = -1;
const frameTimes: number[] = [], workTimes: number[] = [];
function frame(now: number) {
  requestAnimationFrame(frame); const w0 = performance.now();
  const raw = (now - last) / 1000, dt = Math.min(0.1, raw); last = now; sceneT += dt;
  if (frameTimes.length > 600) frameTimes.shift(); frameTimes.push(raw * 1000); if (raw < 0.25) adaptResolution(dt);
  const s = canvas.width / W; ctx.setTransform(s, 0, 0, s, 0, 0); setPixelScale(s); resetButtons(); ctx.clearRect(0, 0, W, H);
  const skyW = scene === 'drive' || scene === 'result' || scene === 'recharge' ? sim?.L.world ?? 0 : scene === 'title' || scene === 'garage' ? 0 : scene === 'pre' ? sel.world : wi;
  if (skyW !== lastSky) { lastSky = skyW; canvas.style.background = skyCss(skyW); }
  switch (scene) {
    case 'title': drawTitle(dt); break; case 'map': drawMap(dt); break; case 'pre': drawPre(dt); break;
    case 'drive': drawDrive(dt); break; case 'result': drawResult(dt); break; case 'garage': drawGarage(dt); break;
    case 'daily': drawDaily(dt); break; case 'recharge': drawRecharge(); break;
  }
  if (dailyMsg > 0 && scene === 'map') { text(ctx, `+${dailyMsg}`, W / 2, 140 - Math.min(40, sceneT * 40), 54, '#ffe27a'); if (sceneT > 2) dailyMsg = 0; }
  if (flashT > 0) { flashT -= dt; ctx.fillStyle = `rgba(255,40,40,${Math.min(0.18, flashT * 0.15)})`; ctx.fillRect(0, 0, W, H); }
  if (adBusy) dim(0.5);
  const st = scene === 'drive' && sim ? Math.round(Math.min(1, sim.storm) * 20) / 20 : 0; if (st !== stormShown) { stormShown = st; stormEl.style.opacity = String(st); }
  if (workTimes.length > 600) workTimes.shift(); workTimes.push(performance.now() - w0);
}

// ---------- boot ----------
(async () => {
  platform = await createPlatform(); await platform.init();
  setLang(platform.language()); document.documentElement.lang = platform.language();
  const rt = document.getElementById('rotate-text'); if (rt) rt.textContent = t('rotate');
  platform.onAdStart = () => { setAdMuted(true); adBusy = true; }; platform.onAdEnd = () => { setAdMuted(false); };
  loadSave(platform); setMuted(save.muted);
  (window as any).__game = { get renderScale() { return renderScale; }, setScale: (v: number) => { adaptOn = false; renderScale = v; resize(); }, get scene() { return scene; }, get sim() { return sim; }, get cam() { return cam; }, save, go, startRun, makeLevel, frameTimes, workTimes, setTouch: (v: boolean) => { touchUI = v; }, get usedKeys() { return usedKeys; } };
  requestAnimationFrame(t => { last = t; frame(t); platform.loadingFinished(); });
})();
