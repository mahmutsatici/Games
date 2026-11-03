import { createPlatform } from './platform';
import type { Platform } from './platform/types';
import { setLang, t } from './i18n';
import { loadSave, save, persist, buy, upgradeCost, UPGRADES, MAX_LEVEL, UpgradeId, starsOf, levelUnlocked, endlessUnlocked, dailyAvailable, dailyNextDay, claimDaily, DAILY_COINS } from './game/save';
import { initAudio, setMuted, setAdMuted, isMuted, engine, ufoHum, sfx } from './game/audio';
import { WORLDS, makeLevel, LevelDef } from './game/levels';
import { Sim, Input } from './game/world';
import { Camera, drawWorld, worldBackdrop, W, H } from './game/render';
import { buttons, resetButtons, button, hit, text, panel, icon, Icon } from './game/ui';

type Scene = 'title' | 'map' | 'pre' | 'drive' | 'result' | 'garage' | 'daily' | 'recharge';
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let platform: Platform;
let scene: Scene = 'title', t0 = 0, sceneT = 0;
let wi = 0; let sel: LevelDef = makeLevel(0, 0); let selShield = false;
let sim: Sim | null = null; const cam = new Camera();
let paused = false, adBusy = false, doubled = false, earned = 0, shown = 0, newBest = false, dailyShown = false, dailyMsg = 0, flashT = 0;
const keys: Record<string, boolean> = {}; const touches = new Map<number, 'gas' | 'brake' | 'turbo'>();
let backdropT = 0, hintT = 0;

// ---------- layout / scaling ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), sw = window.innerWidth, sh = window.innerHeight, s = Math.min(sw / W, sh / H);
  canvas.style.width = W * s + 'px'; canvas.style.height = H * s + 'px';
  canvas.width = Math.round(W * s * dpr); canvas.height = Math.round(H * s * dpr);
}
window.addEventListener('resize', resize); resize();
const toLogical = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };

// ---------- input ----------
window.addEventListener('keydown', e => { keys[e.code] = true; initAudio();
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) e.preventDefault();
  if (scene === 'drive' && (e.code === 'Escape' || e.code === 'KeyP')) setPaused(!paused);
  if (scene === 'title' && (e.code === 'Enter' || e.code === 'Space')) go('map'); });
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', e => { initAudio(); canvas.focus(); const p = toLogical(e); if (adBusy) return;
  if (hit(p.x, p.y)) { sfx.click(); return; }
  if (scene === 'title') { go('map'); return; }
  if (scene === 'drive' && !paused) { touches.set(e.pointerId, p.x < W / 2 ? 'brake' : 'gas'); canvas.setPointerCapture(e.pointerId); } });
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
function setPaused(p: boolean) { if (scene !== 'drive' || !sim) return; paused = p; p ? platform.gameplayStop() : platform.gameplayStart(); }
async function ad<T>(fn: () => Promise<T>): Promise<T> { adBusy = true; try { return await fn(); } finally { adBusy = false; } }
async function startRun(lv: LevelDef, shield = false) {
  platform.gameplayStop(); await ad(() => platform.commercialBreak());
  sim = new Sim(lv, shield); sel = lv; cam.init = false; paused = false; doubled = false; shown = 0; newBest = false; hintT = 0; touches.clear();
  go('drive'); platform.gameplayStart();
}
function finishRun() {
  if (!sim) return; platform.gameplayStop();
  earned = sim.coinsEarned; save.coins += earned; doubled = false; shown = 0; newBest = false;
  if (sim.state === 'win') { const k = `${sel.world}-${sel.index}`; if ((save.stars[k] || 0) < sim.stars) save.stars[k] = sim.stars; if (sim.stars === 3) platform.happyMoment(); }
  if (sel.endless && sim.distance > save.endlessBest) { save.endlessBest = Math.floor(sim.distance); newBest = true; }
  persist(); go('result');
}
const nextLevel = (): LevelDef | null => { if (sel.endless) return sel; const n = sel.world * 10 + sel.index + 1; return n >= 30 ? makeLevel(0, 0, true, (Math.random() * 1e6) | 0) : makeLevel(Math.floor(n / 10), n % 10); };
const flashMsg = (_s: string) => { flashT = 0.6; };

// ---------- drawing helpers ----------
const coinBar = (x = 28, y = 22) => { panel(ctx, x, y, 190, 56, 'rgba(10,14,30,.7)'); icon(ctx, 'coin', x + 32, y + 28, 36); text(ctx, save.coins, x + 62, y + 29, 30, '#ffe27a', 'left'); };
const soundBtn = (x: number, y: number) => button(ctx, x, y, 56, 56, 'gray', () => { setMuted(!isMuted()); save.muted = isMuted(); persist(); }, (cx, cy) => icon(ctx, isMuted() ? 'soundOff' : 'sound', cx, cy, 34));
const iconBtn = (x: number, y: number, s: number, tone: 'green' | 'amber' | 'blue' | 'gray' | 'red', ic: Icon, cb: () => void) => button(ctx, x, y, s, s, tone, cb, (cx, cy) => icon(ctx, ic, cx, cy, s * 0.62));
const stars3 = (cx: number, cy: number, n: number, size: number) => { for (let i = 0; i < 3; i++) icon(ctx, i < n ? 'star' : 'starOff', cx + (i - 1) * size * 1.15, cy + (i === 1 ? -size * 0.2 : 0), size); };

// ---------- scenes ----------
function drawTitle(dt: number) {
  backdropT += dt; worldBackdrop(ctx, 0, backdropT * 2, 0, backdropT);
  ctx.fillStyle = '#8d9099'; ctx.beginPath(); ctx.moveTo(0, H); for (let x = 0; x <= W; x += 20) ctx.lineTo(x, 560 + Math.sin(x / 90 + backdropT * 0.3) * 24 + Math.sin(x / 31) * 8); ctx.lineTo(W, H); ctx.fill();
  const y = 190 + Math.sin(backdropT * 2) * 6; text(ctx, t('title'), W / 2, y, 110, '#fff'); 
  icon(ctx, 'crate', W / 2 - 150, 330, 70); icon(ctx, 'crate', W / 2, 322, 70); icon(ctx, 'crate', W / 2 + 150, 330, 70);
  button(ctx, W / 2 - 110, 420, 220, 130, 'green', () => go('map'), (cx, cy) => icon(ctx, 'play', cx, cy, 90), true);
  soundBtn(W - 84, 28);
}

function drawMap() {
  const w = WORLDS[wi]; worldBackdrop(ctx, wi, 0, 0, sceneT);
  ctx.fillStyle = w.ground[1]; ctx.globalAlpha = 0.9; ctx.fillRect(0, 560, W, 160); ctx.globalAlpha = 1;
  coinBar(); soundBtn(W - 84, 22);
  iconBtn(W - 160, 22, 56, 'amber', 'garage', () => go('garage'));
  const avail = dailyAvailable(); iconBtn(W - 236, 22, 56, avail ? 'green' : 'gray', 'gift', () => { dailyShown = true; go('daily'); });
  if (wi > 0) iconBtn(40, 300, 84, 'blue', 'left', () => { wi--; });
  if (wi < 2 && starsOf(wi, 9) > 0) iconBtn(W - 124, 300, 84, 'blue', 'right', () => { wi++; });
  text(ctx, t(['moon', 'mars', 'ice'][wi] as 'moon'), W / 2, 70, 54, w.accent);
  for (let i = 0; i < 10; i++) {
    const x = 170 + i * 104, y = 360 + Math.sin(i * 0.9 + 0.5) * 70, ok = levelUnlocked(wi, i), st = starsOf(wi, i);
    if (i < 9) { ctx.strokeStyle = 'rgba(255,255,255,.25)'; ctx.lineWidth = 8; ctx.setLineDash([2, 14]); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(170 + (i + 1) * 104, 360 + Math.sin((i + 1) * 0.9 + 0.5) * 70); ctx.stroke(); ctx.setLineDash([]); }
    button(ctx, x - 44, y - 44, 88, 88, ok ? (st ? 'green' : 'blue') : 'gray', () => { if (ok) { sel = makeLevel(wi, i); selShield = false; go('pre'); } else flashMsg('lock') }, (cx, cy) => ok ? text(ctx, i + 1, cx, cy, 44) : icon(ctx, 'lock', cx, cy, 44), ok && !st);
    if (ok) stars3(x, y + 66, st, 22);
  }
  if (endlessUnlocked()) button(ctx, W - 240, 590, 200, 100, 'amber', () => { sel = makeLevel(wi, 9, true, (Math.random() * 1e6) | 0); selShield = false; go('pre'); }, (cx, cy) => { icon(ctx, 'inf', cx - 40, cy, 56); if (save.endlessBest) text(ctx, save.endlessBest + 'm', cx + 40, cy, 26); });
  if (!dailyShown && avail && sceneT > 0.4) { dailyShown = true; go('daily'); }
}

function drawPre() {
  drawMap(); ctx.fillStyle = 'rgba(0,0,10,.6)'; ctx.fillRect(0, 0, W, H); buttons.length = 0;
  panel(ctx, 240, 110, 800, 500);
  text(ctx, sel.endless ? '' : `${t('level')} ${sel.world * 10 + sel.index + 1}`, W / 2, 160, 44, WORLDS[sel.world].accent);
  if (sel.endless) icon(ctx, 'inf', W / 2, 160, 90);
  // info row
  icon(ctx, 'crate', 400, 250, 56); text(ctx, sel.crates, 450, 252, 44, '#fff', 'left');
  if (!sel.endless) { icon(ctx, 'map', 640, 250, 52); text(ctx, `${sel.length}m`, 680, 252, 40, '#fff', 'left'); }
  const hz: Icon[] = []; if (sel.slime > 0) hz.push('slime'); if (sel.meteor > 0) hz.push('meteor'); if (sel.ufo > 0) hz.push('ufo');
  hz.forEach((h, i) => icon(ctx, h, 640 + (i - (hz.length - 1) / 2) * 90 + (sel.endless ? 0 : 0), 340, 62));
  if (sel.endless) text(ctx, save.endlessBest + 'm', 640, 250, 44, '#ffe27a');
  button(ctx, 300, 430, 330, 130, 'green', () => { startRun(sel, selShield); }, (cx, cy) => icon(ctx, 'play', cx, cy, 90), true);
  button(ctx, 650, 430, 330, 130, 'amber', async () => { if (adBusy) return; const ok = await ad(() => platform.rewardedBreak()); if (ok) { selShield = true; startRun(sel, true); } else flashMsg('no'); },
    (cx, cy) => { icon(ctx, 'clapper', cx - 70, cy, 70); icon(ctx, 'plus', cx - 6, cy, 34); icon(ctx, 'shield', cx + 60, cy, 70, '#8ff0ff'); });
  iconBtn(260, 124, 64, 'gray', 'back', () => go('map'));
}

function drawGarage() {
  worldBackdrop(ctx, 0, 0, 0, sceneT); ctx.fillStyle = 'rgba(0,0,10,.55)'; ctx.fillRect(0, 0, W, H);
  coinBar(); iconBtn(W - 100, 22, 64, 'green', 'back', () => go('map'));
  text(ctx, t('garage'), W / 2, 56, 50, '#ffd9a8');
  UPGRADES.forEach((id, i) => {
    const col = i % 4, row = Math.floor(i / 4), x = 40 + col * 305, y = 120 + row * 290, lvl = save.up[id], mx = MAX_LEVEL[id], maxed = lvl >= mx, cost = maxed ? 0 : upgradeCost(id, lvl), can = !maxed && save.coins >= cost;
    panel(ctx, x, y, 285, 270);
    icon(ctx, id === 'shield' ? 'shield' : id === 'turbo' ? 'bolt' : id === 'battery' ? 'battery' : (id as Icon), x + 142, y + 62, 84, '#fff');
    text(ctx, t(id), x + 142, y + 118, 24, '#cfd6f5');
    for (let k = 0; k < mx; k++) { const px = x + 142 + (k - (mx - 1) / 2) * 24; ctx.fillStyle = k < lvl ? '#5ee06a' : 'rgba(255,255,255,.2)'; ctx.beginPath(); ctx.arc(px, y + 148, 8, 0, 7); ctx.fill(); }
    button(ctx, x + 30, y + 180, 225, 72, maxed ? 'gray' : can ? 'green' : 'gray', () => { if (maxed) return; if (buy(id)) { sfx.coin(); } else flashMsg('no'); },
      (cx, cy) => { if (maxed) text(ctx, t('max'), cx, cy, 34, '#ddd'); else { icon(ctx, 'coin', cx - 50, cy, 38); text(ctx, cost, cx - 20, cy + 1, 32, can ? '#fff' : '#ff9a9a', 'left'); } });
  });
}

function drawDaily() {
  drawMap(); ctx.fillStyle = 'rgba(0,0,10,.65)'; ctx.fillRect(0, 0, W, H); buttons.length = 0;
  panel(ctx, 140, 110, 1000, 500); icon(ctx, 'gift', W / 2, 170, 70);
  const next = dailyNextDay(), avail = dailyAvailable();
  for (let i = 0; i < 7; i++) { const x = 170 + i * 135, cur = i + 1 === next && avail, done = (avail ? i + 1 < next : i + 1 <= save.streak);
    rr2(x, 240, 115, 170, cur ? '#2b7a3a' : done ? '#27304d' : '#1b2038', cur ? '#5ee06a' : 'rgba(255,255,255,.18)');
    text(ctx, i + 1, x + 57, 270, 26, '#9fb4ff'); icon(ctx, 'coin', x + 57, 330, 52); text(ctx, DAILY_COINS[i], x + 57, 385, 28, '#ffe27a'); if (done) icon(ctx, 'check', x + 57, 330, 60, '#5ee06a'); }
  if (avail) button(ctx, W / 2 - 150, 450, 300, 120, 'green', () => { const c = claimDaily(); dailyMsg = c; sfx.coin(); go('map'); }, (cx, cy) => { icon(ctx, 'plus', cx - 70, cy, 40); icon(ctx, 'coin', cx - 10, cy, 52); text(ctx, DAILY_COINS[next - 1], cx + 30, cy, 38, '#fff', 'left'); }, true);
  else button(ctx, W / 2 - 100, 460, 200, 100, 'blue', () => go('map'), (cx, cy) => icon(ctx, 'back', cx, cy, 56));
}
function rr2(x: number, y: number, w: number, h: number, fill: string, stroke: string) { ctx.beginPath(); ctx.roundRect(x, y, w, h, 16); ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = stroke; ctx.stroke(); }

function drawDrive(dt: number) {
  const s = sim!; const inp = readInput();
  if (!paused && !adBusy) {
    s.update(dt, inp); hintT += dt;
    engine(Math.min(1, Math.abs(s.speed) / 15), inp.gas, s.state === 'run' && s.energySec > 0); ufoHum(s.beamActive, 0);
    cam.follow(s, dt);
    if (s.state === 'win' && s.t > 0 && sceneT > 0) { winT += dt; if (winT > 1.1) { winT = 0; finishRun(); } }
    if (s.state === 'fail') { if (s.failReason === 'battery' && !s.rechargeUsed) { platform.gameplayStop(); go('recharge'); } else { failT += dt; if (failT > 0.9) { failT = 0; finishRun(); } } }
  } else engine(0, false, false);
  drawWorld(ctx, s, cam, sceneT);
  drawHud(s);
  if (paused) { ctx.fillStyle = 'rgba(0,0,10,.6)'; ctx.fillRect(0, 0, W, H); text(ctx, t('paused'), W / 2, 200, 70);
    button(ctx, W / 2 - 220, 280, 140, 140, 'green', () => setPaused(false), (cx, cy) => icon(ctx, 'play', cx, cy, 80));
    button(ctx, W / 2 - 70, 280, 140, 140, 'amber', () => { platform.gameplayStop(); startRun(sel, false); }, (cx, cy) => icon(ctx, 'retry', cx, cy, 80));
    button(ctx, W / 2 + 80, 280, 140, 140, 'blue', () => { platform.gameplayStop(); go('map'); }, (cx, cy) => icon(ctx, 'map', cx, cy, 80)); }
}
let winT = 0, failT = 0;

function drawHud(s: Sim) {
  // battery
  panel(ctx, 20, 18, 270, 56, 'rgba(10,14,30,.65)'); icon(ctx, 'battery', 52, 46, 34, s.energy < 0.25 ? '#ff6b5e' : '#fff');
  ctx.fillStyle = 'rgba(255,255,255,.15)'; ctx.fillRect(84, 34, 190, 24); ctx.fillStyle = s.energy < 0.25 ? '#ff4a3d' : '#5ee06a'; ctx.fillRect(84, 34, 190 * s.energy, 24);
  // crates + shields
  for (let i = 0; i < s.L.crates; i++) icon(ctx, 'crate', 40 + i * 34, 104, 30, s.crates[i].dropped || s.crates[i].stolen ? 'rgba(255,255,255,.25)' : '#fff'), (s.crates[i].dropped || s.crates[i].stolen) && (ctx.fillStyle = 'rgba(0,0,0,.6)', ctx.fillRect(40 + i * 34 - 14, 104 - 14, 28, 28));
  for (let i = 0; i < s.shields; i++) icon(ctx, 'shield', 40 + i * 36, 146, 30, '#8ff0ff');
  // progress
  if (!s.L.endless) { const x0 = 400, x1 = 880, y = 44; ctx.fillStyle = 'rgba(10,14,30,.65)'; ctx.fillRect(x0 - 10, y - 14, x1 - x0 + 20, 28); ctx.fillStyle = '#3a4150'; ctx.fillRect(x0, y - 4, x1 - x0, 8); ctx.fillStyle = '#5ee06a'; ctx.fillRect(x0, y - 4, (x1 - x0) * s.progress, 8);
    icon(ctx, 'map', x1 + 8, y, 30, '#fff'); ctx.fillStyle = '#ffd23a'; ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * s.progress, y, 10, 0, 7); ctx.fill(); }
  else text(ctx, Math.floor(s.distance) + 'm', 640, 46, 40, '#ffe27a');
  iconBtn(W - 84, 18, 60, 'gray', 'pause', () => setPaused(true));
  // turbo
  if (save.up.turbo > 0) { const x = W - 170, y = H - 170, on = readInput().turbo;
    ctx.fillStyle = on ? 'rgba(255,200,60,.85)' : 'rgba(10,14,30,.6)'; ctx.beginPath(); ctx.arc(x, y, 62, 0, 7); ctx.fill(); ctx.strokeStyle = '#ffd23a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.arc(x, y, 62, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * s.turboCharge); ctx.stroke(); icon(ctx, 'bolt', x, y, 62, '#fff');
    buttons.push({ x: x - 70, y: y - 70, w: 140, h: 140, cb: () => {} }); }
  // ufo warning
  if (s.ufo && Math.floor(sceneT * 5) % 2 === 0) icon(ctx, 'ufo', 640, 110, 56, '#ff6b5e');
  // hint arrows
  if (hintT < 5) { ctx.globalAlpha = Math.max(0, 1 - hintT / 5) * 0.7; icon(ctx, 'left', 160, 380, 70); icon(ctx, 'right', W - 160, 380, 70); ctx.globalAlpha = 1; }
}

function drawResult(dt: number) {
  if (sim) drawWorld(ctx, sim, cam, sceneT); ctx.fillStyle = 'rgba(0,0,10,.65)'; ctx.fillRect(0, 0, W, H);
  const s = sim!, win = s.state === 'win'; panel(ctx, 260, 70, 760, 580);
  shown = Math.min(earned * (doubled ? 2 : 1), shown + dt * Math.max(40, earned * 1.5));
  if (s.L.endless) { icon(ctx, 'inf', W / 2, 140, 70); text(ctx, Math.floor(s.distance) + 'm', W / 2, 220, 64, newBest ? '#5ee06a' : '#ffe27a'); }
  else { stars3(W / 2, 150, win ? Math.min(s.stars, Math.floor(sceneT * 2.5)) : 0, 80);
    icon(ctx, 'crate', W / 2 - 80, 250, 56); text(ctx, `${s.delivered} / ${s.L.crates}`, W / 2 - 40, 252, 52, win ? '#fff' : '#ff9a9a', 'left');
    if (!win) icon(ctx, s.failReason === 'flip' ? 'flip' : s.failReason === 'battery' ? 'battery' : 'crate', W / 2 + 190, 250, 46, '#ff6b5e'); }
  icon(ctx, 'coin', W / 2 - 100, 340, 64); text(ctx, `+${Math.floor(shown)}`, W / 2 - 60, 342, 64, '#ffe27a', 'left');
  const bw = 210, by = 430, rew = !doubled && earned > 0;
  button(ctx, W / 2 - bw - 10 - (rew ? 0 : -bw / 2 - 5), by, bw, 130, 'green', async () => { const nl = win ? nextLevel() : sel; if (nl) { startRun(nl, false); } }, (cx, cy) => icon(ctx, win ? 'next' : 'retry', cx, cy, 84), true);
  if (rew) button(ctx, W / 2 + 10, by, bw, 130, 'amber', async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { save.coins += earned; doubled = true; persist(); sfx.coin(); } else flashMsg('no'); }, (cx, cy) => { icon(ctx, 'clapper', cx - 40, cy, 62); icon(ctx, 'x2', cx + 50, cy, 56, '#fff'); });
  iconBtn(300, 580, 56, 'amber', 'garage', () => go('garage')); iconBtn(W - 356, 580, 56, 'blue', 'map', () => go('map'));
  if (!win && sel !== null && false) text(ctx, '', 0, 0, 1);
}

function drawRecharge() {
  const s = sim!; drawWorld(ctx, s, cam, sceneT); ctx.fillStyle = 'rgba(0,0,10,.65)'; ctx.fillRect(0, 0, W, H); panel(ctx, 300, 160, 680, 400);
  icon(ctx, 'battery', W / 2, 250, 110, '#ff6b5e');
  button(ctx, 340, 340, 280, 150, 'amber', async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { s.recharge(); go('drive'); platform.gameplayStart(); } else flashMsg('no'); }, (cx, cy) => { icon(ctx, 'clapper', cx - 50, cy, 70); icon(ctx, 'battery', cx + 50, cy, 70, '#5ee06a'); });
  button(ctx, 660, 340, 280, 150, 'green', () => { s.rechargeUsed = true; finishRun(); }, (cx, cy) => icon(ctx, 'next', cx, cy, 80), true);
}

// ---------- loop ----------
let last = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now; sceneT += dt;
  const s = canvas.width / W; ctx.setTransform(s, 0, 0, s, 0, 0); resetButtons();
  ctx.clearRect(0, 0, W, H);
  switch (scene) {
    case 'title': drawTitle(dt); break; case 'map': drawMap(); break; case 'pre': drawPre(); break;
    case 'drive': drawDrive(dt); break; case 'result': drawResult(dt); break; case 'garage': drawGarage(); break;
    case 'daily': drawDaily(); break; case 'recharge': drawRecharge(); break;
  }
  if (dailyMsg > 0 && scene === 'map') { text(ctx, `+${dailyMsg}`, W / 2, 140 - Math.min(40, sceneT * 40), 52, '#ffe27a'); if (sceneT > 2) dailyMsg = 0; }
  if (flashT > 0) { flashT -= dt; ctx.fillStyle = `rgba(255,40,40,${Math.min(0.18, flashT * 0.15)})`; ctx.fillRect(0, 0, W, H); }
  if (adBusy) { ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(0, 0, W, H); }
}

// ---------- boot ----------
(async () => {
  platform = await createPlatform(); await platform.init();
  setLang(platform.language()); document.documentElement.lang = platform.language();
  const rt = document.getElementById('rotate-text'); if (rt) rt.textContent = t('rotate');
  platform.onAdStart = () => { setAdMuted(true); adBusy = true; }; platform.onAdEnd = () => { setAdMuted(false); };
  loadSave(platform); setMuted(save.muted);
  (window as any).__game = { get scene() { return scene; }, get sim() { return sim; }, save, go, startRun, makeLevel };
  requestAnimationFrame(t => { last = t; frame(t); platform.loadingFinished(); });
})();
