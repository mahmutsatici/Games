import './ui/fonts.css';
import { createPlatform } from './platform';
import type { Platform } from './platform/types';
import { setLang, t, Key } from './i18n';
import { CFG } from './config';
import { LEVELS, LevelDef } from './game/levels';
import { Sim } from './game/world';
import { Camera, drawWorld, drawSausageShape, fallReaction, W, H } from './game/render';
import { drawBackdrop } from './game/backdrop';
import { loadSave, save, persist, levelOpen, buySkin } from './game/save';
import { initAudio, setMuted, setAdMuted, isMuted, music, sfx } from './game/audio';
import { C, Tri, ease, clamp01, motion, reducedMotion, loadFonts, FONT_DISPLAY } from './ui/theme';
import { drawIcon, IconName } from './ui/icons';
import { beginFrame, pointerDown, pointerMove, pointerUp, setButtonSound, candy, boardPanel, tileInset, ribbon, chip, toggle, label, rr, irisTo, irisBusy, drawIris, burst, drawUiParticles, intro, shade } from './ui/widgets';

type Scene = 'loading' | 'title' | 'levels' | 'play' | 'result' | 'skins';
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let platform: Platform;
let scene: Scene = 'loading', sceneT = 0, now = 0, paused = false, pauseT = 0, adBusy = false;
let settingsOpen = false, settingsT = 0;
let sim: Sim | null = null, levelIdx = 0, earned = 0, doubled = false, shown = 0, lastTick = 0;
let demo: Sim | null = null; const cam = new Camera(), demoCam = new Camera();
let down = false, pointerHeld = false; const keys = new Set<string>();
let loadP = 0, loadDone = false;
let page = 0, pageAnim = 0, swipeX = -1;
let starShown = 0;

/** worlds = pages in level select, each with its own place */
const WORLDS: { key: Key; theme: LevelDef['theme']; levels: number[] }[] = [
  { key: 'worldKitchen', theme: 'counter', levels: [0, 1, 2] },
  { key: 'worldStove', theme: 'stove', levels: [3, 4] },
  { key: 'worldFreezer', theme: 'fridge', levels: [5] },
];

// ---------- layout + safe areas ----------
let css = 1, safe = { t: 0, l: 0, r: 0 };
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), sw = innerWidth, sh = innerHeight, s = Math.min(sw / W, sh / H);
  canvas.style.width = W * s + 'px'; canvas.style.height = H * s + 'px';
  const k = Math.min(dpr, 2560 / (W * s)); canvas.width = Math.round(W * s * k); canvas.height = Math.round(H * s * k);
  css = s; const cs = getComputedStyle(document.documentElement), px = (v: string) => parseFloat(cs.getPropertyValue(v)) || 0;
  safe = { t: px('--sat') / s, l: px('--sal') / s, r: px('--sar') / s };
}
addEventListener('resize', resize); resize();
const toLogical = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };

// ---------- input: buttons via widgets, gameplay = one hold button ----------
const HOLD_KEYS = ['Space', 'ArrowUp', 'KeyW', 'Enter'];
setButtonSound(k => k === 'press' ? sfx.press() : sfx.release());
addEventListener('keydown', e => { initAudio(); startMusic(); if (HOLD_KEYS.includes(e.code)) { e.preventDefault(); keys.add(e.code); }
  if (scene === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) setPaused(!paused);
  if (scene === 'play' && e.code === 'KeyR' && !paused) restart();
  if (scene === 'title' && e.code === 'Space') go('levels');
  if (scene === 'levels' && e.code === 'ArrowRight') turnPage(1); if (scene === 'levels' && e.code === 'ArrowLeft') turnPage(-1); });
addEventListener('keyup', e => keys.delete(e.code));
canvas.addEventListener('pointerdown', e => { initAudio(); startMusic(); canvas.focus(); if (adBusy || irisBusy()) return; const p = toLogical(e);
  if (pointerDown(p.x, p.y)) return;
  if (scene === 'levels' && !settingsOpen) swipeX = p.x;
  if (scene === 'play' && !paused) { pointerHeld = true; canvas.setPointerCapture(e.pointerId); } });
canvas.addEventListener('pointermove', e => { const p = toLogical(e); pointerMove(p.x, p.y); });
const up = (e: PointerEvent) => { const p = toLogical(e); pointerUp(p.x, p.y); pointerHeld = false;
  if (swipeX >= 0 && scene === 'levels') { const d = p.x - swipeX; if (Math.abs(d) > 90) turnPage(d < 0 ? 1 : -1); } swipeX = -1; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && scene === 'play') setPaused(true); });
addEventListener('blur', () => { if (scene === 'play') setPaused(true); });

// ---------- flow ----------
function go(s: Scene) { if (s === scene || irisBusy()) return; sfx.whoosh(); irisTo(() => { scene = s; sceneT = 0; pointerHeld = false; settingsOpen = false; }); }
function startMusic() { music(!isMuted() && save.music && scene !== 'loading'); }
function setPaused(p: boolean) { if (scene !== 'play' || !sim) return; paused = p; pauseT = 0; pointerHeld = false; if (p) sfx.whoosh(); p ? platform.gameplayStop() : platform.gameplayStart(); }
async function ad<T>(fn: () => Promise<T>): Promise<T> { adBusy = true; try { return await fn(); } finally { adBusy = false; } }
async function startLevel(i: number, withAd = true) {
  platform.gameplayStop(); if (withAd) await ad(() => platform.commercialBreak());
  const begin = () => { levelIdx = i; sim = new Sim(LEVELS[i]); cam.init = false; paused = false; doubled = false; shown = 0; starShown = 0; scene = 'play'; sceneT = 0; settingsOpen = false; platform.gameplayStart(); startMusic(); };
  if (scene === 'play' && !paused) begin(); else { sfx.whoosh(); irisTo(begin); }
}
function restart() { if (sim) { paused = false; startLevel(levelIdx, false); } }
function finish() {
  if (!sim) return; platform.gameplayStop();
  const id = LEVELS[levelIdx].id; earned = sim.coinsEarned; save.coins += earned;
  if ((save.stars[id] || 0) < sim.stars) save.stars[id] = sim.stars;
  if (!save.best[id] || sim.jumps < save.best[id]) save.best[id] = sim.jumps;
  if (sim.stars === 3) platform.happyMoment();
  persist(); scene = 'result'; sceneT = 0; starShown = 0; sfx.pop();
}
function turnPage(d: number) { const np = Math.max(0, Math.min(WORLDS.length - 1, page + d)); if (np !== page) { page = np; pageAnim = d; sfx.whoosh(); } }

// ---------- shared drawing ----------
const ic = (name: IconName, x: number, y: number, s: number, tint?: Tri) => drawIcon(ctx, name, x, y, s, tint ? { tint } : undefined);
const dim = (a = 0.5) => { ctx.fillStyle = shade('#2a1208', a); ctx.fillRect(0, 0, W, H); };
/** cheap blur: draw a scene at 1/4 resolution into a small canvas, then scale it up */
const blurCanvas = document.createElement('canvas'); blurCanvas.width = 320; blurCanvas.height = 180; const bctx = blurCanvas.getContext('2d')!;
function blurred(draw: (c: CanvasRenderingContext2D) => void, darken = 0.35) {
  bctx.setTransform(0.25, 0, 0, 0.25, 0, 0); draw(bctx); ctx.imageSmoothingEnabled = true; ctx.drawImage(blurCanvas, 0, 0, W, H); dim(darken);
}
function iconBtn(id: string, x: number, y: number, s: number, tone: Tri, name: IconName, cb: () => void, pulse = false) { candy(ctx, id, x, y, s, s, tone, cb, (cx, cy) => ic(name, cx, cy, s * 0.56), { pulse }); }
function textBtn(id: string, x: number, y: number, w: number, h: number, tone: Tri, name: IconName | null, txt: string, cb: () => void, pulse = false) {
  candy(ctx, id, x, y, w, h, tone, cb, (cx, cy) => { const size = Math.min(46, h * 0.42); if (name) { ic(name, cx - w * 0.28, cy, h * 0.52); label(ctx, txt, cx + h * 0.22, cy + 2, size, { stroke: tone.dark }); } else label(ctx, txt, cx, cy + 2, size, { stroke: tone.dark }); }, { pulse });
}
function coinChip(x: number, y: number) { chip(ctx, x, y, 190); ic('coin', x + 32, y + 28, 40); label(ctx, save.coins, x + 62, y + 30, 32, { fill: C.mustard.base, stroke: C.mustard.dark, align: 'left' }); }
function soundBtn(x: number, y: number) { iconBtn('snd', x, y, 64, C.secondary, isMuted() ? 'soundOff' : 'sound', () => { setMuted(!isMuted()); save.muted = isMuted(); persist(); startMusic(); }); }
const stars3 = (cx: number, cy: number, n: number, size: number, popUntil = 3, t0 = 0) => {
  for (let i = 0; i < 3; i++) { const k = i < popUntil ? 1 : 0, sc = i < n && i < popUntil ? ease.outBack(clamp01((sceneT - t0 - i * 0.35) / 0.35)) : 1;
    ctx.save(); ctx.translate(cx + (i - 1) * size * 1.1, cy + (i === 1 ? -size * 0.22 : 0)); ctx.scale(sc, sc); ic(i < n && k ? 'chili' : 'chiliEmpty', 0, 0, size); ctx.restore(); }
};
/** a sausage-shaped progress bar (loading + charge meter) */
function sausageBar(x: number, y: number, w: number, h: number, p: number) {
  ctx.lineCap = 'round'; const a = x + h / 2, b = x + w - h / 2;
  ctx.strokeStyle = C.sausage.dark; ctx.lineWidth = h + 7; ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(b, y); ctx.stroke();
  ctx.strokeStyle = shade(C.cream.dark, 0.55); ctx.lineWidth = h; ctx.stroke();
  if (p > 0.01) { const e = a + (b - a) * clamp01(p); ctx.strokeStyle = C.sausage.base; ctx.lineWidth = h; ctx.beginPath(); ctx.moveTo(a, y); ctx.lineTo(e, y); ctx.stroke();
    ctx.strokeStyle = C.sausage.light; ctx.lineWidth = h * 0.3; ctx.beginPath(); ctx.moveTo(a, y - h * 0.18); ctx.lineTo(e, y - h * 0.18); ctx.stroke(); }
}
/** puppet sausage for menus: a curved standing sucuk that wobbles, blinks and sometimes flips */
function puppet(x: number, y: number, size: number, skin?: string, seed = 0, flips = true, look = { x: 0.3, y: 0.1 }) {
  const tt = now + seed, flipPh = flips ? ((tt % 5.5) - 4.6) / 0.9 : -1, jumping = flipPh > 0 && flipPh < 1 && !reducedMotion;
  const hop = jumping ? Math.sin(flipPh * Math.PI) * size * 0.9 : 0, rot = jumping ? ease.inOutCubic(flipPh) * Math.PI * 2 : 0;
  const lean = motion(Math.sin(tt * 2.1) * 0.18), len = size * 1.25, n = 7, pts: { x: number; y: number }[] = [];
  for (let i = 0; i < n; i++) { const f = i / (n - 1), a = -Math.PI / 2 + lean * f * 1.4 + motion(Math.sin(tt * 3 + f * 2) * 0.05) * f; pts.push({ x: Math.cos(a) * len * f, y: Math.sin(a) * len * f * (jumping ? 1 : 1 - 0.04 * Math.sin(tt * 6)) }); }
  ctx.fillStyle = `rgba(60,25,10,${0.28 * (1 - hop / (size * 1.4))})`; ctx.beginPath(); ctx.ellipse(x, y + size * 0.06, size * 0.42, size * 0.08, 0, 0, 7); ctx.fill();
  ctx.save(); ctx.translate(x, y - hop); ctx.translate(0, -len / 2); ctx.rotate(rot); ctx.translate(0, len / 2);
  drawSausageShape(ctx, pts, size * 0.32, skin, { look, blink: (tt % 3.3) < 0.12, mood: jumping ? 'grin' : 'calm' }, tt);
  ctx.restore();
}
/** game logo: chunky outlined title with highlight, gently bouncing */
function logo(cx: number, cy: number, scale = 1) {
  const b = motion(Math.sin(now * 2.4) * 6), s = scale * (1 + motion(Math.sin(now * 2.4 + 1) * 0.015));
  ctx.save(); ctx.translate(cx, cy + b); ctx.scale(s, s); ctx.rotate(-0.04);
  const txt = t('title'), size = 112;
  ctx.font = `400 ${size}px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.fillStyle = C.shadow; ctx.strokeStyle = C.shadow; ctx.lineWidth = 26; ctx.strokeText(txt, 4, 12);
  ctx.strokeStyle = C.sausage.dark; ctx.lineWidth = 24; ctx.strokeText(txt, 0, 6); ctx.lineWidth = 24; ctx.strokeText(txt, 0, 0);
  ctx.fillStyle = C.primary.base; ctx.fillText(txt, 0, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(-700, -size, 1400, size * 0.62); ctx.clip(); ctx.fillStyle = C.mustard.base; ctx.fillText(txt, 0, 0); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(-700, -size * 0.42, 1400, size * 0.1); ctx.clip(); ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.fillText(txt, 0, 0); ctx.restore();
  ctx.restore();
  // badge: a little chili + sausage mark
  ic('sausage', cx - 330 * scale, cy - 70 * scale + b, 70 * scale);
}

// ---------- scenes ----------
function drawLoading(dt: number) {
  ctx.fillStyle = C.cream.base; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = shade(C.cream.dark, 0.18); for (let x = 0; x < W; x += 64) for (let y = 0; y < H; y += 64) if (((x + y) / 64) % 2 === 0) ctx.fillRect(x, y, 64, 64);
  loadP += (Math.min(1, loadP < 0.9 || loadDone ? 1 : 0.9) - loadP) * Math.min(1, dt * 5);
  ic('sausage', W / 2, H / 2 - 80, 150);
  sausageBar(W / 2 - 220, H / 2 + 60, 440, 46, loadP);
  if (loadDone && loadP > 0.985 && sceneT > 0.6) { scene = 'title'; sceneT = 0; sfx.pop(); }
}

function drawTitle(dt: number) {
  if (!demo) { demo = new Sim(LEVELS[0]); demoCam.init = false; }
  demo.update(dt, false); demoCam.follow(demo, dt); demoCam.x = 6 + Math.sin(now * 0.12) * 4;
  blurred(c => drawWorld(c, demo!, demoCam, now, dt), 0.3);
  // soft spotlight behind the logo
  const g = ctx.createRadialGradient(W / 2, 170, 40, W / 2, 170, 520); g.addColorStop(0, 'rgba(255,240,200,.45)'); g.addColorStop(1, 'rgba(255,240,200,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const k = intro(sceneT, 0, 0.6);
  ctx.save(); ctx.translate(W / 2, 175); ctx.scale(k, k); ctx.translate(-W / 2, -175); logo(W / 2, 175); ctx.restore();
  // the hero, idling on a cutting board
  boardPanel(ctx, 180, 560, 300, 40);
  puppet(330, 562, 170, save.skin, 0, true, { x: 0.6, y: 0.15 });
  const pk = intro(sceneT, 0.25, 0.5);
  ctx.save(); ctx.translate(W / 2, 470); ctx.scale(pk, pk); ctx.translate(-W / 2, -470);
  textBtn('play', W / 2 - 170, 400, 340, 136, C.primary, 'play', t('play'), () => go('levels'), true); ctx.restore();
  iconBtn('settings', 24 + safe.l, 24 + safe.t, 68, C.secondary, 'settings', () => { settingsOpen = true; settingsT = 0; });
  soundBtn(W - 92 - safe.r, 26 + safe.t);
}

function plate(cx: number, cy: number, r: number, i: number, open: boolean, stars: number, current: boolean, id: string) {
  const bob = current ? motion(Math.sin(now * 3) * 4) : 0;
  candy(ctx, id, cx - r, cy - r + bob, r * 2, r * 2, open ? C.cream : C.locked, () => { if (open) startLevel(i); else sfx.press(); }, (x, y) => {
    ctx.beginPath(); ctx.arc(x, y + 2, r * 0.66, 0, 7); ctx.fillStyle = open ? '#ffffff' : shade(C.locked.dark, 0.25); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = open ? C.cream.dark : C.locked.dark; ctx.stroke();
    if (open) label(ctx, LEVELS[i].id, x, y + 4, r * 0.72, { fill: C.sausage.base, stroke: C.sausage.dark, strokeW: 6 }); else ic('lock', x, y + 2, r * 0.8);
  }, { radius: r, pulse: current });
  if (open) stars3(cx, cy + r + 30, stars, 34);
}

function drawLevels(dt: number) {
  const wd = WORLDS[page];
  pageAnim *= Math.exp(-dt * 10);
  blurred(c => drawBackdrop(c, wd.theme, page * 30 + now * 0.4, 0, now), 0.12);
  // top bar
  iconBtn('home', 24 + safe.l, 22 + safe.t, 64, C.secondary, 'home', () => go('title'));
  coinChip(104 + safe.l, 26 + safe.t);
  iconBtn('skins', W - 172 - safe.r, 22 + safe.t, 64, C.primary, 'skins', () => go('skins'));
  iconBtn('settings', W - 92 - safe.r, 22 + safe.t, 64, C.secondary, 'settings', () => { settingsOpen = true; settingsT = 0; });
  const off = pageAnim * 300;
  ctx.save(); ctx.translate(off, 0);
  ribbon(ctx, W / 2, 130, 420, t(wd.key), 46);
  // a cutting board "map" with plates along a sausage-string path
  boardPanel(ctx, 150, 200, 980, 410, { handle: true });
  const n = wd.levels.length, pos = wd.levels.map((_, k) => ({ x: W / 2 + (k - (n - 1) / 2) * 300, y: 390 + (k % 2 ? -46 : 30) }));
  ctx.strokeStyle = '#efe0bf'; ctx.lineWidth = 6; ctx.setLineDash([4, 14]); ctx.lineCap = 'round'; ctx.beginPath(); pos.forEach((p, k) => k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.setLineDash([]);
  let cur = -1; wd.levels.forEach(i => { if (levelOpen(i) && !save.stars[LEVELS[i].id] && cur < 0) cur = i; });
  wd.levels.forEach((i, k) => { const p = pos[k], open = levelOpen(i); const pk = intro(sceneT, 0.08 * k, 0.45);
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(pk, pk); ctx.translate(-p.x, -p.y);
    plate(p.x, p.y, 70, i, open, save.stars[LEVELS[i].id] || 0, i === cur, 'lv' + i); ctx.restore();
    if (i === cur) puppet(p.x + 72, p.y - 40, 70, save.skin, i, false, { x: -0.6, y: 0.2 }); });
  ctx.restore();
  // page arrows + dots
  if (page > 0) iconBtn('pgL', 40 + safe.l, 360, 76, C.secondary, 'arrowL', () => turnPage(-1));
  if (page < WORLDS.length - 1) iconBtn('pgR', W - 116 - safe.r, 360, 76, C.secondary, 'arrowR', () => turnPage(1));
  WORLDS.forEach((_, k) => { ctx.beginPath(); ctx.arc(W / 2 + (k - (WORLDS.length - 1) / 2) * 34, 660, k === page ? 11 : 8, 0, 7); ctx.fillStyle = k === page ? C.primary.base : shade(C.cream.base, 0.7); ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k === page ? C.primary.dark : C.cream.dark; ctx.stroke(); });
}

function drawSkins() {
  blurred(c => drawBackdrop(c, 'shelves', now * 0.4, 0, now), 0.12);
  iconBtn('back', 24 + safe.l, 22 + safe.t, 64, C.secondary, 'back', () => go('levels'));
  coinChip(104 + safe.l, 26 + safe.t);
  ribbon(ctx, W / 2, 110, 380, t('skins'), 46);
  CFG.skins.forEach((s, i) => {
    const x = 60 + i * 236, y = 180, owned = save.owned.includes(s.id), on = save.skin === s.id, k = intro(sceneT, 0.06 * i, 0.45);
    ctx.save(); ctx.translate(x + 108, y + 210); ctx.scale(k, k); ctx.translate(-(x + 108), -(y + 210));
    boardPanel(ctx, x, y, 216, 420, { tone: on ? C.wood : C.woodDark });
    tileInset(ctx, x + 18, y + 26, 180, 250);
    puppet(x + 108, y + 250, 120, s.id, i * 0.7, false, { x: 0.4, y: 0.2 });
    const tone = on ? C.go : owned ? C.secondary : save.coins >= s.cost ? C.primary : C.locked;
    candy(ctx, 'skin' + i, x + 20, y + 300, 176, 84, tone, () => {
      if (owned) { save.skin = s.id; persist(); sfx.pop(); } else if (buySkin(s.id)) { sfx.ding(); burst(x + 108, y + 200, 26, [C.mustard.base, C.primary.light, C.cream.light]); } },
      (cx, cy) => { if (on) ic('check', cx, cy, 46); else if (owned) label(ctx, t('equip'), cx, cy + 2, 30, { stroke: tone.dark }); else { ic('coin', cx - 40, cy, 40); label(ctx, s.cost, cx + 14, cy + 2, 34, { stroke: tone.dark }); } });
    ctx.restore();
  });
}

function hudChip(x: number, y: number, w: number, icon: IconName, txt: string, col: Tri, pop = 0) {
  chip(ctx, x, y, w); ic(icon, x + 30, y + 28, 38);
  const s = 1 + pop * 0.25; ctx.save(); ctx.translate(x + 58, y + 30); ctx.scale(s, s); label(ctx, txt, 0, 0, 30, { fill: col.base, stroke: col.dark, align: 'left' }); ctx.restore();
}
let coinPopT = 0, lastCoins = 0;
function drawPlay(dt: number) {
  const s = sim!;
  down = !paused && !adBusy && !settingsOpen && (pointerHeld || [...keys].some(k => HOLD_KEYS.includes(k)));
  if (!paused && !adBusy) { s.update(dt, down); cam.follow(s, dt); if (s.state === 'win' && s.winT > 1.3) finish(); }
  if (paused) { pauseT += dt; blurred(c => drawWorld(c, s, cam, now, 0), 0.25); }
  else drawWorld(ctx, s, cam, now, dt);
  if (s.coinsRun !== lastCoins) { coinPopT = 1; lastCoins = s.coinsRun; } coinPopT = Math.max(0, coinPopT - dt * 4);
  // HUD (top-left: level, jumps, coins; top-right: retry, pause)
  const x0 = 16 + safe.l, y0 = 14 + safe.t;
  hudChip(x0, y0, 120, 'flag', String(LEVELS[levelIdx].id), C.sausage);
  hudChip(x0 + 132, y0, 160, 'jump', `${s.jumps}/${s.L.par}`, s.jumps <= s.L.par ? C.go : C.chili);
  hudChip(x0 + 304, y0, 140, 'coin', String(s.coinsRun), C.mustard, coinPopT);
  if (!paused) { iconBtn('retry', W - 160 - safe.r, y0, 64, C.secondary, 'retry', () => restart()); iconBtn('pause', W - 84 - safe.r, y0, 64, C.primary, 'pause', () => setPaused(true)); }
  // charge meter: the sausage fills up
  if (s.charging && !paused) { chip(ctx, W / 2 - 190, H - 70 - 0, 380, 50); sausageBar(W / 2 - 170, H - 45, 340, 26, s.power); }
  // first-level hint
  if (levelIdx === 0 && s.jumps < 2 && !paused && !s.charging) { const k = 1 + motion(Math.sin(now * 5) * 0.04); ctx.save(); ctx.translate(W / 2, H - 70); ctx.scale(k, k);
    chip(ctx, -250, -34, 500, 64); ic('jump', -205, -2, 40); label(ctx, t('tapHold'), 30, 0, 28, { font: 'ui', fill: C.ink, shadow: false }); ctx.restore(); }
  // funny fall reaction: dizzy sucuk pops up in a comic burst
  const fr = fallReaction(s); if (fr > 0 && !paused) { const k = ease.outBack(clamp01((1 - fr) * 4)) * (fr < 0.2 ? fr / 0.2 : 1);
    ctx.save(); ctx.translate(W / 2, 200); ctx.scale(k, k); ctx.rotate(-0.06);
    ctx.beginPath(); for (let i = 0; i < 24; i++) { const r = i % 2 ? 110 : 150; ctx.lineTo(Math.cos(i / 24 * Math.PI * 2) * r, Math.sin(i / 24 * Math.PI * 2) * r * 0.7); } ctx.closePath();
    ctx.fillStyle = C.mustard.base; ctx.fill(); ctx.lineWidth = 5; ctx.strokeStyle = C.mustard.dark; ctx.stroke();
    const pts = Array.from({ length: 7 }, (_, i) => ({ x: -60 + i * 20, y: 30 + Math.sin(i * 0.9 + now * 10) * 8 }));
    drawSausageShape(ctx, pts, 34, save.skin, { look: { x: 0, y: 0 }, blink: false, mood: 'dizzy' }, now); ic('splash', 70, 34, 60); ctx.restore(); }
  if (paused) drawPause();
}

function drawPause() {
  const k = intro(pauseT, 0, 0.35, ease.outCubic), y = -480 + 560 * k;
  boardPanel(ctx, W / 2 - 330, y, 660, 440, { handle: true });
  ribbon(ctx, W / 2, y + 30, 340, t('paused'), 42);
  textBtn('resume', W / 2 - 250, y + 100, 500, 120, C.go, 'play', t('resume'), () => setPaused(false), true);
  iconBtn('p-retry', W / 2 - 250, y + 250, 100, C.secondary, 'retry', () => restart());
  iconBtn('p-home', W / 2 - 130, y + 250, 100, C.secondary, 'home', () => { platform.gameplayStop(); paused = false; go('levels'); });
  ic(isMuted() ? 'soundOff' : 'sound', W / 2 + 40, y + 300, 46); toggle(ctx, 'p-snd', W / 2 + 80, y + 272, !isMuted(), () => { setMuted(!isMuted()); save.muted = isMuted(); persist(); startMusic(); });
  // stuck? after 5 falls a rewarded "skip level" (purple + clapper, never green; the green resume is bigger)
  const s = sim!;
  if (s.falls >= 5 && levelIdx < LEVELS.length - 1) candy(ctx, 'skip', W / 2 + 230, y + 250, 100, 100, C.reward, async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { const id = LEVELS[levelIdx].id; if (!save.stars[id]) save.stars[id] = 1; persist(); paused = false; startLevel(levelIdx + 1, false); } },
    (cx, cy) => { ic('clapper', cx - 14, cy - 8, 50); ic('next', cx + 22, cy + 22, 34); });
}

function drawResult(dt: number) {
  const s = sim!; drawWorld(ctx, s, cam, now, dt); dim(0.35);
  const k = intro(sceneT, 0, 0.55), y = -560 + 640 * k;
  boardPanel(ctx, W / 2 - 360, y, 720, 560, { handle: true });
  ribbon(ctx, W / 2, y + 26, 380, `${t('level')} ${LEVELS[levelIdx].id}`, 40);
  // stars pop in one by one with sound and particles
  const due = Math.min(s.stars, Math.floor(Math.max(0, sceneT - 0.45) / 0.35) + (sceneT > 0.45 ? 1 : 0));
  while (starShown < due) { starShown++; sfx.star(starShown); burst(W / 2 + (starShown - 2) * 92, y + 140, 18, [C.chili.base, C.mustard.base, C.cream.light]); }
  stars3(W / 2, y + 140, starShown, 92, 3, 0.45);
  tileInset(ctx, W / 2 - 290, y + 220, 580, 140);
  ic('jump', W / 2 - 230, y + 262, 50); label(ctx, `${s.jumps}`, W / 2 - 190, y + 264, 46, { fill: s.jumps <= s.L.par ? C.go.base : C.sausage.base, stroke: s.jumps <= s.L.par ? C.go.dark : C.sausage.dark, align: 'left' });
  ic('splash', W / 2 + 70, y + 262, 50); label(ctx, `${s.falls}`, W / 2 + 110, y + 264, 46, { fill: C.sausage.base, stroke: C.sausage.dark, align: 'left' });
  // coin counter rolls up with ticks
  const target = earned * (doubled ? 2 : 1);
  if (sceneT > 1.4 && shown < target) { shown = Math.min(target, shown + dt * Math.max(25, target * 1.6)); if (now - lastTick > 0.05) { sfx.tick(); lastTick = now; } }
  ic('coin', W / 2 - 80, y + 322, 52); label(ctx, `+${Math.floor(shown)}`, W / 2 - 44, y + 324, 46, { fill: C.mustard.base, stroke: C.mustard.dark, align: 'left' });
  // buttons: big green next (pulses), rewarded x2 (purple, same size), small retry/home
  const last = levelIdx >= LEVELS.length - 1, rew = !doubled && earned > 0, bw = 270, by = y + 392;
  textBtn('next', rew ? W / 2 - bw - 10 : W / 2 - bw / 2, by, bw, 110, C.go, last ? 'home' : 'next', last ? t('menu') : t('next'), () => last ? go('levels') : startLevel(levelIdx + 1), true);
  if (rew) candy(ctx, 'x2', W / 2 + 10, by, bw, 110, C.reward, async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { save.coins += earned; doubled = true; persist(); sfx.ding(); burst(W / 2 + 145, by + 50, 24, [C.mustard.base, C.cream.light]); } },
    (cx, cy) => { ic('clapper', cx - 52, cy, 64); ic('x2', cx + 50, cy, 60); });
  iconBtn('r-retry', W / 2 - 360 + 26, y + 470, 70, C.secondary, 'retry', () => startLevel(levelIdx));
  iconBtn('r-home', W / 2 + 360 - 96, y + 470, 70, C.secondary, 'home', () => go('levels'));
}

function drawSettings(dt: number) {
  settingsT += dt; const k = intro(settingsT, 0, 0.4); dim(0.6 * Math.min(1, settingsT * 4));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  boardPanel(ctx, W / 2 - 300, 170, 600, 400, { handle: true });
  ribbon(ctx, W / 2, 200, 360, t('settings'), 40);
  ic(isMuted() ? 'soundOff' : 'sound', W / 2 - 200, 320, 64); label(ctx, t('sound'), W / 2 - 150, 322, 34, { font: 'ui', fill: C.ink, shadow: false, align: 'left' });
  toggle(ctx, 'set-snd', W / 2 + 110, 292, !isMuted(), () => { setMuted(!isMuted()); save.muted = isMuted(); persist(); startMusic(); });
  ic(save.music ? 'music' : 'musicOff', W / 2 - 200, 410, 64); label(ctx, t('music'), W / 2 - 150, 412, 34, { font: 'ui', fill: C.ink, shadow: false, align: 'left' });
  toggle(ctx, 'set-mus', W / 2 + 110, 382, save.music, () => { save.music = !save.music; persist(); startMusic(); });
  iconBtn('set-close', W / 2 + 240, 160, 72, C.primary, 'close', () => { settingsOpen = false; });
  ctx.restore();
}

// ---------- loop ----------
let last = 0;
function frame(ts: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (ts - last) / 1000); last = ts; now += dt; sceneT += dt;
  const k = canvas.width / W; ctx.setTransform(k, 0, 0, k, 0, 0); beginFrame();
  switch (scene) {
    case 'loading': drawLoading(dt); break; case 'title': drawTitle(dt); break; case 'levels': drawLevels(dt); break;
    case 'skins': drawSkins(); break; case 'play': drawPlay(dt); break; case 'result': drawResult(dt); break;
  }
  if (settingsOpen) { beginFrame(); drawSettings(dt); }   // modal: only its buttons are active
  drawUiParticles(ctx, dt);
  drawIris(ctx, dt);
  if (adBusy) dim(0.5);
}

// ---------- boot ----------
(async () => {
  requestAnimationFrame(t0 => { last = t0; frame(t0); });
  platform = await createPlatform(); await platform.init();
  setLang(platform.language()); document.documentElement.lang = platform.language();
  const rt = document.getElementById('rotate-text'); if (rt) rt.textContent = t('rotate');
  platform.onAdStart = () => { setAdMuted(true); adBusy = true; }; platform.onAdEnd = () => setAdMuted(false);
  loadSave(platform); setMuted(save.muted);
  await loadFonts(p => { loadP = Math.max(loadP, p * 0.9); });
  loadDone = true; platform.loadingFinished();
  // test hooks: dev and test builds only (game-qa contract), never in portal builds
  if (import.meta.env.DEV || import.meta.env.VITE_TEST) {
    const w = window as any;
    w.__GAME__ = { get scene() { return scene; }, get sim() { return sim; }, save, LEVELS, startLevel: (i: number) => startLevel(i, false), go: (s: Scene) => { scene = s; sceneT = 0; }, setPaused,
      openSettings: () => { settingsOpen = true; settingsT = 0; }, closeSettings: () => { settingsOpen = false; }, setPage: (p: number) => { page = p; } };
    w.render_game_to_text = () => {
      const s = sim; if (scene !== 'play' && scene !== 'result' || !s) return JSON.stringify({ coords: 'world metres, x right, y up', mode: scene });
      const c = s.center, v = s.velocity;
      return JSON.stringify({ coords: 'world metres, x right, y up', mode: s.state === 'win' ? 'win' : paused ? 'paused' : 'playing', level: LEVELS[levelIdx].id,
        sucuk: { x: +c.x.toFixed(2), y: +c.y.toFixed(2), vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), standing: !!s.stuck, lean: +s.swayLean.toFixed(2), charging: s.charging, power: +s.power.toFixed(2) },
        jumps: s.jumps, par: s.L.par, falls: s.falls, coins: s.coinsRun, checkpoint: s.checkpoint, finish: s.L.finish, coinsLeft: s.coins.filter(k => !k.taken).length });
    };
  }
})();
void css;
