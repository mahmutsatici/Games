import { createPlatform } from './platform';
import type { Platform } from './platform/types';
import { setLang, t } from './i18n';
import { loadSave, save, persist, buy, upgradeCost, UPGRADES, MAX_LEVEL, starsOf, levelUnlocked, endlessUnlocked, dailyAvailable, dailyNextDay, claimDaily, DAILY_COINS, UpgradeId } from './game/save';
import { initAudio, setMuted, setAdMuted, isMuted, engine, ufoHum, wind, sfx } from './game/audio';
import { makeLevel, LevelDef } from './game/levels';
import { Sim, Input } from './game/world';
import { Camera, drawWorld, backdrop, skyCss, setPixelScale, drawRoverPreview, drawSlimePreview, warmSprites, W, H } from './game/render';
import { WORLD_ART, ART } from './art/palette';
import { C, Tri, ease, clamp01, motion, reducedMotion, loadFonts, FONT_DISPLAY } from './ui/theme';
import { drawIcon, IconName } from './ui/icons';
import { rr, alpha, label, fitSize, beginFrame, clearFrameButtons, pointerDown, pointerMove, pointerUp, setButtonSound, button, metalPanel, cratePanel, inset, plaque, chip, toggle, intro, irisTo, irisBusy, drawIris, burst, drawUiParticles } from './ui/widgets';

type Scene = 'loading' | 'title' | 'map' | 'pre' | 'drive' | 'result' | 'garage' | 'daily' | 'recharge';
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!; // transparent: the sky is the canvas' CSS background
let platform: Platform;
let scene: Scene = 'loading', sceneT = 0, now = 0;
let wi = 0; let sel: LevelDef = makeLevel(0, 0); let selShield = false;
let sim: Sim | null = null; const cam = new Camera();
let paused = false, pauseT = 0, adBusy = false, doubled = false, earned = 0, shown = 0, newBest = false, dailyShown = false, dailyMsg = 0, flashT = 0;
let coinShown = 0, coinPop = 0, starShown = 0, lastTick = 0, settingsOpen = false, settingsT = 0;
let loadP = 0, loadDone = false, pageAnim = 0, swipeX = -1;
let bought: { id: UpgradeId; t: number } | null = null;
type Pad = 'gas' | 'brake' | 'turbo' | 'tiltL' | 'tiltR';
const keys: Record<string, boolean> = {}; const touches = new Map<number, Pad>();
let touchUI = matchMedia('(pointer: coarse)').matches;
let usedKeys = false;

// ---------- layout / scaling / safe areas ----------
/** renderScale < 1 lowers the backing-store resolution on slow devices (adapted from measured frame times). */
let renderScale = 1, perfT = 0, adaptOn = true, safe = { t: 0, l: 0, r: 0, b: 0 };
const stormEl = document.getElementById('storm') as HTMLDivElement; let stormShown = -1;
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), sw = window.innerWidth, sh = window.innerHeight, s = Math.min(sw / W, sh / H);
  canvas.style.width = W * s + 'px'; canvas.style.height = H * s + 'px';
  Object.assign(stormEl.style, { width: W * s + 'px', height: H * s + 'px', left: (sw - W * s) / 2 + 'px', top: (sh - H * s) / 2 + 'px' });
  const k = Math.min(dpr, 2560 / (W * s)) * renderScale; // full device resolution (up to 2560 px wide) for crisp art
  canvas.width = Math.round(W * s * Math.max(k, 0.5)); canvas.height = Math.round(H * s * Math.max(k, 0.5));
  // CSS safe-area insets (notches) in logical px; only the part that overlaps the canvas matters
  const cs = getComputedStyle(document.documentElement), px = (v: string) => parseFloat(cs.getPropertyValue(v)) || 0, mx = (sw - W * s) / 2, my = (sh - H * s) / 2;
  safe = { t: Math.max(0, px('--sat') - my) / s, l: Math.max(0, px('--sal') - mx) / s, r: Math.max(0, px('--sar') - mx) / s, b: Math.max(0, px('--sab') - my) / s };
}
function adaptResolution(dt: number) {
  // react to the share of slow frames (not the average, which vsync jitter inflates); hold 2.5 s between steps
  perfT += dt; if (!adaptOn || perfT < 2.5 || frameTimes.length < 90 || scene !== 'drive' || paused) return;
  const recent = frameTimes.slice(-90), slow = recent.filter(x => x > 25).length / recent.length;
  // only ever steps down (each resize costs a hitch, so never oscillate) and never below 0.7
  if (slow > 0.2 && renderScale > 0.7) { renderScale = Math.max(0.7, Math.round((renderScale - 0.15) * 100) / 100); resize(); perfT = -5; }
}
window.addEventListener('resize', resize); resize();
const cssScale = () => canvas.getBoundingClientRect().width / W || 1;
const toLogical = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };
/** touch pedals: left thumb tilt back / forward; right thumb brake, gas, turbo above gas */
function pedals() {
  const sz = Math.max(100, Math.min(176, 88 / cssScale())), m = 22, r = sz / 2, y = H - m - r - safe.b;
  const P: Record<Pad, { x: number; y: number; r: number }> = {
    tiltL: { x: m + r + safe.l, y, r }, tiltR: { x: m + r * 3 + 16 + safe.l, y, r },
    brake: { x: W - m - r * 3 - 16 - safe.r, y, r }, gas: { x: W - m - r - safe.r, y, r }, turbo: { x: W - m - r - safe.r, y: y - r * 2 - 14, r: r * 0.8 },
  };
  return P;
}

// ---------- input ----------
setButtonSound(k => k === 'press' ? sfx.press() : sfx.release());
window.addEventListener('keydown', e => { keys[e.code] = true; initAudio();
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(e.code)) { e.preventDefault(); usedKeys = true; touchUI = false; }
  if (scene === 'drive' && (e.code === 'Escape' || e.code === 'KeyP')) setPaused(!paused);
  if (scene === 'title' && (e.code === 'Enter' || e.code === 'Space') && !settingsOpen) go('map');
  if (scene === 'map' && !settingsOpen) { if (e.code === 'ArrowRight') turnPage(1); if (e.code === 'ArrowLeft') turnPage(-1); } });
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', e => { initAudio(); canvas.focus(); if (e.pointerType === 'touch') touchUI = true;
  const p = toLogical(e); if (adBusy || irisBusy()) return;
  if (pointerDown(p.x, p.y)) return;
  if (scene === 'title' && !settingsOpen) { go('map'); return; }
  if (scene === 'map' && !settingsOpen) swipeX = p.x;
  if (scene === 'drive' && !paused) {
    // nearest pedal on the touched half of the screen
    const P = pedals(); let best: Pad = p.x < W / 2 ? 'tiltL' : 'gas', bd = 1e9;
    for (const k of Object.keys(P) as Pad[]) { if ((P[k].x < W / 2) !== (p.x < W / 2)) continue; const d = Math.hypot(p.x - P[k].x, p.y - P[k].y) / P[k].r; if (d < bd) { bd = d; best = k; } }
    touches.set(e.pointerId, best); canvas.setPointerCapture(e.pointerId);
  } });
canvas.addEventListener('pointermove', e => { const p = toLogical(e); pointerMove(p.x, p.y); });
const up = (e: PointerEvent) => { touches.delete(e.pointerId); const p = toLogical(e); pointerUp(p.x, p.y);
  if (swipeX >= 0 && scene === 'map') { const d = p.x - swipeX; if (Math.abs(d) > 90) turnPage(d < 0 ? 1 : -1); } swipeX = -1; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', e => e.preventDefault());
function readInput(): Input {
  const v = [...touches.values()];
  // Up/W = gas, Down/S = brake & reverse, Left/A + Right/D = rotate the rover, Space/Shift = turbo
  return { gas: !!(keys.ArrowUp || keys.KeyW || v.includes('gas')), brake: !!(keys.ArrowDown || keys.KeyS || v.includes('brake')), tiltL: !!(keys.ArrowLeft || keys.KeyA || v.includes('tiltL')), tiltR: !!(keys.ArrowRight || keys.KeyD || v.includes('tiltR')), turbo: !!(keys.Space || keys.ShiftLeft || keys.ShiftRight || v.includes('turbo')) };
}
document.addEventListener('visibilitychange', () => { if (document.hidden && scene === 'drive') setPaused(true); });
window.addEventListener('blur', () => { if (scene === 'drive') setPaused(true); });

// ---------- flow ----------
/** switch screens; `iris` = circle wipe (~300 ms) with a whoosh, otherwise an in-place overlay */
function go(s: Scene, iris = true) {
  const sw = () => { scene = s; sceneT = 0; settingsOpen = false; starShown = 0; if (s === 'map' && !dailyShown && dailyAvailable()) { dailyShown = true; scene = 'daily'; } };
  if (!iris || reducedMotion) { sw(); return; } if (irisBusy()) return; sfx.swoosh(); irisTo(sw);
}
function setPaused(p: boolean) { if (scene !== 'drive' || !sim) return; if (p && !paused) { snapshot(); sfx.swoosh(); } paused = p; pauseT = 0; touches.clear(); p ? platform.gameplayStop() : platform.gameplayStart(); }
async function ad<T>(fn: () => Promise<T>): Promise<T> { adBusy = true; try { return await fn(); } finally { adBusy = false; } }
async function startRun(lv: LevelDef, shield = false) {
  platform.gameplayStop(); await ad(() => platform.commercialBreak());
  const begin = () => { sim = new Sim(lv, shield); warmSprites(sim); sel = lv; cam.init = false; paused = false; doubled = false; shown = 0; newBest = false; touches.clear(); coinShown = 0; scene = 'drive'; sceneT = 0; settingsOpen = false; platform.gameplayStart(); };
  if (reducedMotion) begin(); else { sfx.swoosh(); irisTo(begin); }
}
function finishRun() {
  if (!sim) return; platform.gameplayStop(); engine(0, false, false); ufoHum(false); wind(0);
  earned = sim.coinsEarned; save.coins += earned; doubled = false; shown = 0; newBest = false;
  if (sim.state === 'win') { const k = `${sel.world}-${sel.index}`; if ((save.stars[k] || 0) < sim.stars) save.stars[k] = sim.stars; if (sim.stars === 3) platform.happyMoment(); }
  if (sel.endless && sim.distance > save.endlessBest) { save.endlessBest = Math.floor(sim.distance); newBest = true; }
  persist(); snapshot(); go('result', false); sfx.pop();
}
const nextLevel = (): LevelDef => { if (sel.endless) return makeLevel(sel.world, 9, true, (Math.random() * 1e6) | 0); const n = sel.world * 10 + sel.index + 1; return n >= 30 ? makeLevel(2, 9, true, (Math.random() * 1e6) | 0) : makeLevel(Math.floor(n / 10), n % 10); };
const flashMsg = () => { flashT = 0.6; };
const worldOpen = (w: number) => w === 0 || starsOf(w - 1, 9) > 0;
function turnPage(d: number) { const np = Math.max(0, Math.min(2, wi + d)); if (np !== wi) { wi = np; pageAnim = d; sfx.swoosh(); } }
function toggleSound() { setMuted(!isMuted()); save.muted = isMuted(); persist(); }
function openSettings() { settingsOpen = true; settingsT = 0; sfx.pop(); }

// ---------- drawing helpers ----------
const ic = (n: IconName, x: number, y: number, s: number, o?: { tint?: Tri; mono?: Tri; alpha?: number }) => drawIcon(ctx, n, x, y, s, o);
const dim = (a = 0.5) => { ctx.fillStyle = `rgba(16,20,34,${a})`; ctx.fillRect(0, 0, W, H); };
/** frozen, blurred copy of the current frame (pause, result, offers): a tiny canvas scaled back up */
const snapC = document.createElement('canvas'); snapC.width = 256; snapC.height = 144; const snapG = snapC.getContext('2d')!;
function snapshot() { snapG.clearRect(0, 0, 256, 144); snapG.imageSmoothingEnabled = true; snapG.drawImage(canvas, 0, 0, 256, 144); }
function drawSnapshot(dark = 0.35) { ctx.imageSmoothingEnabled = true; ctx.drawImage(snapC, 0, 0, W, H); dim(dark); }
function iconBtn(id: string, x: number, y: number, s: number, tone: Tri, name: IconName, cb: () => void, pulse = false) { button(ctx, id, x, y, s, s, tone, cb, (cx, cy) => ic(name, cx, cy, s * 0.58), { pulse }); }
function bigBtn(id: string, x: number, y: number, w: number, h: number, tone: Tri, name: IconName, txt: string, cb: () => void, pulse = false) {
  button(ctx, id, x, y, w, h, tone, cb, (cx, cy) => { const s = Math.min(h * 0.55, 72); if (txt) { const size = fitSize(ctx, txt, Math.min(44, h * 0.38), w - s - 56); ic(name, x + 22 + s / 2, cy, s); label(ctx, txt, x + 34 + s + (w - s - 44) / 2, cy + 2, size, { stroke: tone.dark }); } else ic(name, cx, cy, s * 1.1); }, { pulse });
}
/** rewarded-ad button: blue (never green), drawn film icon + what you get */
function rewardBtn(id: string, x: number, y: number, w: number, h: number, gain: IconName, cb: () => void, gainTint?: Tri) {
  button(ctx, id, x, y, w, h, C.reward, cb, (cx, cy) => { const s = Math.min(h * 0.52, 70); ic('clapper', cx - s * 0.62, cy, s); ic(gain, cx + s * 0.62, cy, s, gainTint ? { tint: gainTint } : undefined); });
}
function coinChip(x: number, y: number) { chip(ctx, x, y, 196, 56); ic('coin', x + 32, y + 28, 40); label(ctx, save.coins, x + 62, y + 30, 32, { fill: C.gold.base, stroke: C.gold.dark, align: 'left' }); }
const soundBtn = (x: number, y: number) => iconBtn('snd', x, y, 64, C.secondary, isMuted() ? 'soundOff' : 'sound', toggleSound);
/** crate-stars: 3 crates, earned ones solid, the rest empty outlines */
function crateStars(cx: number, cy: number, n: number, size: number, popT = -1) {
  for (let i = 0; i < 3; i++) { const x = cx + (i - 1) * size * 1.12, y = cy + (i === 1 ? -size * 0.16 : 0);
    const k = popT < 0 ? 1 : i < n ? ease.outBack(clamp01((popT - i * 0.35) / 0.35)) : 1;
    if (i < n) { ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ctx.rotate((1 - k) * 0.6); ic('crate', 0, 0, size); ctx.restore(); } else ic('crateOff', x, y, size); }
}
/** a crate that fills up from the bottom (loading bar) */
function fillingCrate(cx: number, cy: number, s: number, p: number) {
  ic('crateOff', cx, cy, s);
  ctx.save(); ctx.beginPath(); ctx.rect(cx - s, cy + s / 2 - s * 0.86 * clamp01(p) - s * 0.07, s * 2, s); ctx.clip(); ic('crate', cx, cy, s); ctx.restore();
}
/** game logo: chunky outlined title with a highlight streak, gently floating */
function logo(cx: number, cy: number) {
  const f = motion(Math.sin(now * 1.6) * 7), txt = t('title');
  ctx.save(); ctx.translate(cx, cy + f); ctx.rotate(-0.03 + motion(Math.sin(now * 1.1) * 0.012));
  const size = fitSize(ctx, txt, 104, 760); ctx.font = `700 ${size}px ${FONT_DISPLAY}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.lineJoin = 'round';
  ctx.strokeStyle = C.shadow; ctx.lineWidth = 26; ctx.strokeText(txt, 5, 14);
  ctx.strokeStyle = C.primary.dark; ctx.lineWidth = 24; ctx.strokeText(txt, 0, 7); ctx.strokeText(txt, 0, 0);
  ctx.fillStyle = C.primary.base; ctx.fillText(txt, 0, 0);
  ctx.save(); ctx.beginPath(); ctx.rect(-800, -size, 1600, size * 0.62); ctx.clip(); ctx.fillStyle = ART.roverBody.base; ctx.fillText(txt, 0, 0); ctx.restore();
  ctx.save(); ctx.beginPath(); ctx.rect(-800, -size * 0.36, 1600, size * 0.08); ctx.clip(); ctx.fillStyle = '#ffffff'; ctx.fillText(txt, 0, 0); ctx.restore();
  for (let i = 0; i < 3; i++) ic('crate', -54 + i * 54, size * 0.72, 44 + (i === 1 ? 6 : 0));
  ctx.restore();
}
/** little moon hill for menus (world ground palette) */
function hill(cx: number, cy: number, rx: number, ry: number, w = 0) {
  const G = WORLD_ART[w].ground; ctx.lineJoin = 'round';
  ctx.beginPath(); ctx.ellipse(cx, cy + ry, rx, ry * 1.6, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = G.top; ctx.fill();
  ctx.save(); ctx.clip(); ctx.fillStyle = G.deep; ctx.beginPath(); ctx.ellipse(cx + rx * 0.2, cy + ry * 1.2, rx * 1.05, ry * 1.2, 0, Math.PI, 0); ctx.fill(); ctx.restore();
  ctx.strokeStyle = G.rim; ctx.lineWidth = 6; ctx.beginPath(); ctx.ellipse(cx, cy + ry + 3, rx - 3, ry * 1.6 - 3, 0, Math.PI * 1.08, Math.PI * 1.75); ctx.stroke();
  ctx.strokeStyle = G.line; ctx.lineWidth = 3.5; ctx.beginPath(); ctx.ellipse(cx, cy + ry, rx, ry * 1.6, 0, Math.PI, 0); ctx.stroke();
  for (const [dx, r] of [[-0.45, 0.07], [0.35, 0.05]]) { ctx.fillStyle = G.band; ctx.beginPath(); ctx.ellipse(cx + dx * rx, cy + ry * 0.45, rx * r * 1.6, rx * r * 0.5, 0, 0, 7); ctx.fill(); }
}

// ---------- scenes ----------
function drawLoading(dt: number) {
  backdrop(ctx, 0, now * 0.3, 0, now, dt);
  loadP += (Math.min(1, loadP < 0.9 || loadDone ? 1 : 0.9) - loadP) * Math.min(1, dt * 5);
  fillingCrate(W / 2, H / 2 - 20, 150, loadP);
  if (loadDone && loadP > 0.985 && sceneT > 0.6) { scene = 'title'; sceneT = 0; sfx.pop(); }
}

function drawTitle(dt: number) {
  backdrop(ctx, 0, now * 0.25, 0, now, dt);
  // the rover idling on a small moon hill with crates on the back, a slime peeking out from behind a rock
  hill(380, 610, 420, 70);
  const sx = 690, sy = 596, peek = reducedMotion ? 0.6 : clamp01(Math.sin(now * 0.7) * 1.6 + 0.4);
  ctx.save(); ctx.beginPath(); ctx.rect(sx - 80, 0, 160, sy + 8); ctx.clip(); drawSlimePreview(ctx, sx, sy + 40 - peek * 52, 70, now, -1); ctx.restore();
  const R = WORLD_ART[0].rock; ctx.beginPath(); ctx.ellipse(sx, sy + 10, 58, 34, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = R.base; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = R.dark; ctx.stroke();
  ctx.fillStyle = alpha(R.light, 0.8); ctx.beginPath(); ctx.ellipse(sx - 18, sy - 12, 18, 6, -0.3, 0, 7); ctx.fill();
  drawRoverPreview(ctx, 360, 494, 92, now, { crates: 3, look: { x: 0.5 + 0.5 * Math.sin(now * 0.6), y: 0.1 } });
  const k = intro(sceneT, 0, 0.6);
  ctx.save(); ctx.translate(W / 2, 150); ctx.scale(k, k); ctx.translate(-W / 2, -150); logo(W / 2, 150); ctx.restore();
  const pk = intro(sceneT, 0.25, 0.5);
  ctx.save(); ctx.translate(950, 470); ctx.scale(pk, pk); ctx.translate(-950, -470);
  bigBtn('play', 770, 400, 360, 140, C.go, 'play', t('play'), () => go('map'), true); ctx.restore();
  iconBtn('settings', 22 + safe.l, 20 + safe.t, 64, C.secondary, 'settings', openSettings);
  soundBtn(W - 86 - safe.r, 20 + safe.t);
}

const mapNode = (i: number) => ({ x: 150 + i * 108, y: 430 + Math.sin(i * 0.85 + 0.6) * 58 });
function drawMap(dt: number) {
  pageAnim *= Math.exp(-dt * 10);
  const off = pageAnim * 260, A = WORLD_ART[wi], G = A.ground, open = worldOpen(wi);
  backdrop(ctx, wi, now * 0.4 + wi * 40, 0, now, dt);
  ctx.save(); ctx.translate(off, 0);
  // the route runs over the world's ground
  const gy = (x: number) => 380 + Math.sin(x / 170 + wi) * 18 + Math.sin(x / 61) * 7;
  ctx.beginPath(); ctx.moveTo(-300, H); for (let x = -300; x <= W + 300; x += 16) ctx.lineTo(x, gy(x)); ctx.lineTo(W + 300, H); ctx.closePath(); ctx.fillStyle = G.top; ctx.fill();
  ctx.fillStyle = G.deep; ctx.beginPath(); ctx.moveTo(-300, H); for (let x = -300; x <= W + 300; x += 16) ctx.lineTo(x, gy(x) + 150); ctx.lineTo(W + 300, H); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = G.rim; ctx.lineWidth = 6; ctx.beginPath(); for (let x = -300; x <= W + 300; x += 16) x > -300 ? ctx.lineTo(x, gy(x) + 4) : ctx.moveTo(x, gy(x) + 4); ctx.stroke();
  ctx.strokeStyle = G.line; ctx.lineWidth = 3.5; ctx.beginPath(); for (let x = -300; x <= W + 300; x += 16) x > -300 ? ctx.lineTo(x, gy(x)) : ctx.moveTo(x, gy(x)); ctx.stroke();
  for (let i = 0; i < 9; i++) { const x = 90 + i * 140 + (i * 53 % 40), y = gy(x) + 80 + (i % 3) * 60; ctx.fillStyle = G.band; ctx.beginPath(); ctx.ellipse(x, y, 34 + (i % 2) * 20, 9, 0, 0, 7); ctx.fill(); }
  // tire track route
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const road = () => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const n = mapNode(i); i ? ctx.lineTo(n.x, n.y) : ctx.moveTo(n.x, n.y); } };
  road(); ctx.strokeStyle = G.band; ctx.lineWidth = 30; ctx.stroke();
  road(); ctx.strokeStyle = alpha(G.line, 0.5); ctx.lineWidth = 4; ctx.setLineDash([6, 12]); ctx.translate(0, -8); ctx.stroke(); ctx.translate(0, 16); ctx.stroke(); ctx.translate(0, -8); ctx.setLineDash([]);
  let cur = 0; for (let i = 0; i < 10; i++) if (levelUnlocked(wi, i)) cur = i;
  for (let i = 0; i < 10; i++) {
    const { x, y } = mapNode(i), ok = open && levelUnlocked(wi, i), st = starsOf(wi, i), isCur = ok && i === cur && !st, r = 40, pk = intro(sceneT, 0.04 * i, 0.4);
    ctx.save(); ctx.translate(x, y); ctx.scale(pk, pk); ctx.translate(-x, -y);
    const bob = isCur ? motion(Math.sin(now * 3) * 4) : 0;
    button(ctx, 'lv' + i, x - r, y - r + bob, r * 2, r * 2, !ok ? C.steel : isCur ? C.primary : C.secondary, () => { if (ok) { sel = makeLevel(wi, i); selShield = false; go('pre', false); sfx.pop(); } else flashMsg(); },
      (cx, cy) => { if (ok) label(ctx, i + 1, cx, cy + 2, 36, { fill: isCur ? C.textLight : C.ink, stroke: isCur ? C.primary.dark : undefined, shadow: false }); else ic('lock', cx, cy, 44); }, { radius: r, pulse: isCur });
    if (ok && st) for (let k = 0; k < 3; k++) ic(k < st ? 'crate' : 'crateOff', x + (k - 1) * 25, y + r + 22, 22);
    ctx.restore();
  }
  if (open) { const cn = mapNode(cur); drawRoverPreview(ctx, cn.x, cn.y - 84, 26, now, { crates: 3 }); }
  ctx.restore();
  // world plaque + page arrows + dots
  const names = ['moon', 'mars', 'ice'] as const;
  plaque(ctx, W / 2 + off, 118, 300, t(names[wi]), 38, open ? C.primary : C.steel);
  if (!open) ic('lock', W / 2 + 175 + off, 118, 48);
  if (wi > 0) iconBtn('pgL', 24 + safe.l, 250, 72, C.secondary, 'arrowL', () => turnPage(-1));
  if (wi < 2) iconBtn('pgR', W - 96 - safe.r, 250, 72, C.secondary, 'arrowR', () => turnPage(1));
  for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(W / 2 + (k - 1) * 34, 168, k === wi ? 10 : 7, 0, 7); ctx.fillStyle = k === wi ? C.primary.base : C.secondary.base; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = k === wi ? C.primary.dark : C.secondary.dark; ctx.stroke(); }
  // top bar
  coinChip(22 + safe.l, 24 + safe.t);
  soundBtn(W - 86 - safe.r, 20 + safe.t);
  iconBtn('settings', W - 162 - safe.r, 20 + safe.t, 64, C.secondary, 'settings', openSettings);
  iconBtn('garage', W - 238 - safe.r, 20 + safe.t, 64, C.primary, 'garage', () => go('garage'));
  iconBtn('daily', W - 314 - safe.r, 20 + safe.t, 64, dailyAvailable() ? C.go : C.secondary, 'gift', () => go('daily', false), dailyAvailable());
  if (endlessUnlocked()) button(ctx, 'endless', W - 250 - safe.r, 610 - safe.b, 226, 88, C.primary, () => { sel = makeLevel(wi, 9, true, (Math.random() * 1e6) | 0); selShield = false; go('pre', false); }, (cx, cy) => { ic('inf', cx - 60, cy, 56); label(ctx, (save.endlessBest || 0) + 'm', cx + 30, cy + 2, 30, { stroke: C.primary.dark }); });
}

function infoInset(x: number, y: number, w: number, name: IconName, val: string | number, col: Tri = C.gold) { inset(ctx, x, y, w, 84); ic(name, x + 50, y + 42, 54); label(ctx, val, x + 92, y + 44, 38, { fill: col.base, stroke: col.dark, align: 'left' }); }
function drawPre(dt: number) {
  drawMap(dt); clearFrameButtons(); dim(0.5);
  const k = intro(sceneT, 0, 0.4), x = 250, y = 70;
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  metalPanel(ctx, x, y, 780, 590);
  plaque(ctx, W / 2, y + 74, 380, sel.endless ? t('endless') : `${t('level')} ${sel.world * 10 + sel.index + 1}`, 38);
  infoInset(x + 50, y + 140, 330, sel.glass ? 'glassCrate' : 'crate', sel.crates + (sel.glass ? ` (${sel.glass})` : ''), C.secondary);
  if (sel.endless) infoInset(x + 400, y + 140, 330, 'trophy', (save.endlessBest || 0) + 'm'); else infoInset(x + 400, y + 140, 330, 'flag', `${sel.length}m`, C.secondary);
  const hz: IconName[] = []; if (sel.slime > 0) hz.push('slime'); if (sel.meteor > 0) hz.push('meteor'); if (sel.ufo > 0) hz.push('ufo');
  inset(ctx, x + 50, y + 244, 680, 96, C.steel); hz.forEach((h, i) => ic(h, W / 2 + (i - (hz.length - 1) / 2) * 120, y + 292, 72));
  // Poki: the green normal button is at least as big as the rewarded one next to it
  bigBtn('go', x + 50, y + 380, 340, 136, C.go, 'play', t('drive'), () => startRun(sel, selShield), true);
  rewardBtn('shield', x + 410, y + 380, 320, 136, 'shield', async () => { if (adBusy) return; const ok = await ad(() => platform.rewardedBreak()); if (ok) { selShield = true; startRun(sel, true); } else flashMsg(); });
  ctx.restore();
  iconBtn('back', x - 20, y - 16, 64, C.secondary, 'back', () => { go('map', false); sfx.pop(); });
}

const UP_ICON: Record<UpgradeId, IconName> = { engine: 'engine', suspension: 'suspension', tires: 'tires', battery: 'battery', bed: 'bed', bumper: 'bumper', shield: 'shield', turbo: 'turbo' };
/** where each upgrade shows on the rover (rover-local metres, y down) for the purchase sparkle */
const UP_SPOT: Record<UpgradeId, [number, number]> = { engine: [0.53, -0.95], suspension: [0.95, 0.2], tires: [-0.95, 0.46], battery: [-0.37, 0.1], bed: [-0.42, -0.6], bumper: [1.55, 0], shield: [0.92, -1.0], turbo: [-1.55, -0.03] };
function drawGarage(dt: number) {
  backdrop(ctx, 0, now * 0.2, 0, now, dt); dim(0.2);
  // hangar floor + lift with the rover in the middle
  const fx = W / 2, S = 104, ly = 520, lift = 18 + motion(Math.sin(now * 1.4) * 4), bk = bought ? ease.outBack(clamp01((now - bought.t) / 0.5)) : 1;
  ctx.fillStyle = WORLD_ART[0].ground.deep; ctx.fillRect(0, ly + 60, W, H); ctx.fillStyle = WORLD_ART[0].ground.top; ctx.fillRect(0, ly + 60, W, 14); ctx.fillStyle = WORLD_ART[0].ground.line; ctx.fillRect(0, ly + 58, W, 3);
  ctx.fillStyle = alpha('#fff3c4', 0.12); ctx.beginPath(); ctx.moveTo(fx - 60, 0); ctx.lineTo(fx + 60, 0); ctx.lineTo(fx + 260, ly + 60); ctx.lineTo(fx - 260, ly + 60); ctx.closePath(); ctx.fill();
  const M = C.metal;
  rr(ctx, fx - 28, ly - lift + 20, 56, lift + 44, 8); ctx.fillStyle = M.base; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = M.dark; ctx.stroke();
  rr(ctx, fx - 220, ly - lift, 440, 26, 10); ctx.fillStyle = C.steel.base; ctx.fill(); ctx.stroke();
  for (let i = 0; i < 8; i++) { ctx.fillStyle = i % 2 ? C.primary.base : ART.sign.base; ctx.fillRect(fx - 210 + i * 52, ly - lift + 8, 26, 10); }
  rr(ctx, fx - 150, ly + 50, 300, 22, 8); ctx.fillStyle = C.steel.base; ctx.fill(); ctx.strokeStyle = C.steel.dark; ctx.stroke();
  const roverY = ly - lift - 0.88 * S - (1 - bk) * 14;
  drawRoverPreview(ctx, fx, roverY, S, now, { crates: 3, look: { x: Math.sin(now * 0.8), y: 0 } });
  if (bought && now - bought.t < 0.9) { const [ux, uy] = UP_SPOT[bought.id], k = (now - bought.t) / 0.9; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + now * 3, r = 20 + k * 40; ctx.globalAlpha = 1 - k; ctx.fillStyle = C.gold.light; ctx.save(); ctx.translate(fx + ux * S + Math.cos(a) * r, roverY + uy * S + Math.sin(a) * r); ctx.rotate(a); ctx.fillRect(-6, -2, 12, 4); ctx.fillRect(-2, -6, 4, 12); ctx.restore(); } ctx.globalAlpha = 1; }
  // upgrade cards around the lift: 4 left, 4 right
  UPGRADES.forEach((id, i) => {
    const left = i < 4, row = i % 4, x = left ? 20 + safe.l : W - 380 - safe.r, y = 104 + row * 148, lvl = save.up[id], mx = MAX_LEVEL[id], maxed = lvl >= mx, cost = maxed ? 0 : upgradeCost(id, lvl), can = !maxed && save.coins >= cost;
    const k = intro(sceneT, 0.05 * i, 0.4); ctx.save(); ctx.translate(x + 180, y + 64); ctx.scale(k, k); ctx.translate(-(x + 180), -(y + 64));
    chip(ctx, x, y, 360, 128, C.metal);
    inset(ctx, x + 12, y + 14, 100, 100, C.steel); ic(UP_ICON[id], x + 62, y + 64, 74);
    label(ctx, t(id), x + 126, y + 32, fitSize(ctx, t(id), 24, 220, 'ui'), { font: 'ui', fill: C.ink, shadow: false, align: 'left' });
    const pw = Math.min(26, 220 / mx - 4); for (let p = 0; p < mx; p++) { rr(ctx, x + 126 + p * (pw + 4), y + 52, pw, 12, 4); ctx.fillStyle = p < lvl ? C.energy.base : alpha(C.steel.dark, 0.25); ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = p < lvl ? C.energy.dark : alpha(C.steel.dark, 0.4); ctx.stroke(); }
    button(ctx, 'up-' + id, x + 126, y + 74, 218, 44, maxed ? C.go : can ? C.primary : C.locked, () => { if (maxed) return; if (buy(id)) { sfx.ding(); bought = { id, t: now }; const [ux, uy] = UP_SPOT[id]; burst(fx + ux * S, roverY + uy * S, 22, [C.gold.base, C.primary.light, '#ffffff']); } else { flashMsg(); } },
      (cx, cy) => { if (maxed) ic('check', cx, cy, 34); else { ic('coin', cx - 52, cy, 30); label(ctx, cost, cx - 30, cy + 2, 26, { stroke: (can ? C.primary : C.locked).dark, align: 'left' }); } }, { disabled: maxed });
    ctx.restore();
  });
  coinChip(W / 2 - 98, 24 + safe.t); plaque(ctx, W / 2, 112, 280, t('garage'), 34);
  iconBtn('back', 20 + safe.l, 20 + safe.t, 64, C.secondary, 'back', () => go('map'));
}

function drawDaily(dt: number) {
  drawMap(dt); clearFrameButtons(); dim(0.55);
  const k = intro(sceneT, 0, 0.45); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  cratePanel(ctx, 130, 110, 1020, 500); ic('gift', W / 2, 172, 84);
  const next = dailyNextDay(), avail = dailyAvailable();
  for (let i = 0; i < 7; i++) { const x = 164 + i * 136, cur = i + 1 === next && avail, done = avail ? i + 1 < next : i + 1 <= save.streak, y = 232 + (cur ? motion(Math.sin(now * 4) * 4) : 0);
    chip(ctx, x, y, 118, 176, cur ? C.go : C.secondary); label(ctx, i + 1, x + 59, y + 30, 26, { font: 'ui', fill: cur ? C.textLight : C.ink, stroke: cur ? C.go.dark : undefined, shadow: false });
    ic('coin', x + 59, y + 88, 56); label(ctx, DAILY_COINS[i], x + 59, y + 142, 28, { fill: C.gold.base, stroke: C.gold.dark }); if (done) ic('check', x + 59, y + 88, 62); }
  if (avail) bigBtn('claim', W / 2 - 170, 450, 340, 124, C.go, 'coin', '+' + DAILY_COINS[next - 1], () => { dailyMsg = claimDaily(); sfx.ding(); burst(W / 2, 470, 30, [C.gold.base, C.gold.light, '#ffffff']); go('map', false); }, true);
  else bigBtn('close', W / 2 - 110, 456, 220, 110, C.secondary, 'back', '', () => go('map', false));
  ctx.restore();
}

let failT = 0;
function drawDrive(dt: number) {
  const s = sim!; const inp = readInput();
  if (!paused && !adBusy) {
    s.update(dt, inp);
    const ws = Math.abs(s.wheels[1].getAngularVelocity()) / 26;
    engine(Math.min(1, ws), inp.gas, s.state === 'run' && s.battery > 0); ufoHum(!!s.ufo && s.ufo.beam > 0.1); wind(s.storm);
    cam.follow(s, dt);
    if (s.state === 'win' && s.winT > 1.6) finishRun();
    else if (s.state === 'fail') { if (s.failReason === 'battery' && !s.rechargeUsed) { platform.gameplayStop(); engine(0, false, false); drawWorld(ctx, s, cam, now, dt); snapshot(); go('recharge', false); sfx.pop(); return; } else { failT += dt; if (failT > 1.2) { failT = 0; finishRun(); } } }
  } else { engine(0, false, false); ufoHum(false); wind(0); }
  if (paused) { pauseT += dt; drawSnapshot(0.3); drawPause(); return; }
  drawWorld(ctx, s, cam, now, dt);
  drawHud(s, dt, inp);
}
function drawPause() {
  const k = intro(pauseT, 0, 0.35, ease.outCubic), y = -460 + 560 * k;
  metalPanel(ctx, W / 2 - 330, y, 660, 420);
  plaque(ctx, W / 2, y + 74, 300, t('paused'), 36);
  bigBtn('resume', W / 2 - 280, y + 140, 560, 120, C.go, 'play', t('resume'), () => setPaused(false), true);
  iconBtn('p-retry', W / 2 - 280, y + 292, 92, C.secondary, 'retry', () => { platform.gameplayStop(); startRun(sel, false); });
  iconBtn('p-garage', W / 2 - 170, y + 292, 92, C.primary, 'garage', () => { platform.gameplayStop(); paused = false; go('garage'); });
  iconBtn('p-home', W / 2 - 60, y + 292, 92, C.secondary, 'map', () => { platform.gameplayStop(); paused = false; go('map'); });
  ic(isMuted() ? 'soundOff' : 'sound', W / 2 + 92, y + 338, 48); toggle(ctx, 'p-snd', W / 2 + 132, y + 311, !isMuted(), toggleSound);
}

// The top bar is drawn into an offscreen canvas and only redrawn when a displayed value changes.
const hudCanvas = document.createElement('canvas'); let hudKey = '';
function hudTop(s: Sim, g: CanvasRenderingContext2D) {
  const Y0 = 14 + safe.t, X0 = 14 + safe.l, low = s.energy < 0.25, blink = low && Math.sin(now * 10) > 0;
  const I = (n: IconName, x: number, y: number, sz: number, o?: { tint?: Tri; mono?: Tri; alpha?: number }) => drawIcon(g, n, x, y, sz, o);
  const ch = (x: number, y: number, w: number, h = 56, T: Tri = C.secondary) => chipOn(g, x, y, w, h, T);
  // battery gauge
  ch(X0, Y0, 236); I(blink ? 'batteryEmpty' : 'battery', X0 + 34, Y0 + 28, 44);
  inset(g, X0 + 62, Y0 + 15, 160, 26, C.steel);
  for (let i = 0; i < 10; i++) { const on = s.energy > i / 10 + 0.001; rr(g, X0 + 67 + i * 15.3, Y0 + 19, 12, 18, 3); g.fillStyle = on ? (low ? C.danger.base : C.energy.base) : alpha(C.steel.dark, 0.6); g.fill(); }
  // crates: lost ones become empty outlines with a short shake
  const n = s.L.crates, cw = 20 + n * 42, cx0 = X0 + 248; ch(cx0, Y0, cw);
  for (let i = 0; i < n; i++) { const c = s.crates[i], x = cx0 + 31 + i * 42, y = Y0 + 28;
    if (!c.lost) I(c.glass ? 'glassCrate' : 'crate', x, y, 36);
    else { const k = s.t - c.lostT, sh = k < 0.5 ? Math.sin(k * 60) * 5 * (1 - k * 2) * motion(1) : 0; I('crateOff', x + sh, y, 36, k < 0.5 ? { mono: C.danger } : undefined); } }
  // distance bar with the delivery flag / endless distance
  const px0 = Math.max(cx0 + cw + 14, 600), pw = 290; ch(px0, Y0, pw);
  if (!s.L.endless) {
    inset(g, px0 + 16, Y0 + 20, pw - 70, 16, C.steel); rr(g, px0 + 18, Y0 + 22, (pw - 74) * s.progress, 12, 6); g.fillStyle = C.primary.base; g.fill();
    I('flag', px0 + pw - 30, Y0 + 26, 40); const mx = px0 + 18 + (pw - 74) * s.progress;
    g.beginPath(); g.arc(mx, Y0 + 28, 11, 0, 7); g.fillStyle = ART.roverBody.base; g.fill(); g.lineWidth = 3; g.strokeStyle = C.primary.dark; g.stroke();
  } else { I('inf', px0 + 40, Y0 + 28, 44); labelOn(g, Math.floor(s.distance) + 'm', px0 + 76, Y0 + 30, 30, C.gold, 'left'); }
  // coins
  const kx = W - 300 - safe.r; ch(kx, Y0, 190); g.save(); g.translate(kx + 32, Y0 + 28); g.scale(1 + coinPop * 0.25, 1 + coinPop * 0.25); I('coin', 0, 0, 40); g.restore(); labelOn(g, Math.floor(coinShown), kx + 60, Y0 + 30, 30, C.gold, 'left');
  // second row: turbo gauge (keyboard) + shields
  let ux = X0;
  if (!touchUI) { ch(ux, Y0 + 66, 176, 46); I('turbo', ux + 26, Y0 + 89, 34, s.turboOn ? undefined : { alpha: 0.9 }); inset(g, ux + 48, Y0 + 81, 114, 16, C.steel); rr(g, ux + 50, Y0 + 83, 110 * s.turbo, 12, 6); g.fillStyle = C.gold.base; g.fill(); ux += 188; }
  if (s.shields > 0) { ch(ux, Y0 + 66, 18 + s.shields * 38, 46); for (let i = 0; i < s.shields; i++) I('shield', ux + 28 + i * 38, Y0 + 89, 32); }
}
function chipOn(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, T: Tri) {
  rr(g, x, y + 4, w, h, 16); g.fillStyle = T.dark; g.fill(); rr(g, x, y, w, h, 16); g.fillStyle = T.base; g.fill();
  g.save(); rr(g, x, y, w, h, 16); g.clip(); g.fillStyle = alpha(T.light, 0.8); rr(g, x + 10, y + 4, w - 20, 5, 2.5); g.fill(); g.restore();
  rr(g, x, y, w, h, 16); g.lineWidth = 2.5; g.strokeStyle = T.dark; g.stroke();
}
function labelOn(g: CanvasRenderingContext2D, s: string | number, x: number, y: number, size: number, T: Tri, align: CanvasTextAlign) { label(g, s, x, y, size, { fill: T.base, stroke: T.dark, align }); }
function drawHud(s: Sim, dt: number, inp: Input) {
  const target = s.coinsRun; if (coinShown < target) { coinShown = Math.min(target, coinShown + dt * Math.max(12, (target - coinShown) * 8)); coinPop = 1; } coinPop = Math.max(0, coinPop - dt * 4);
  const k = canvas.width / W, low = s.energy < 0.25;
  const key = [canvas.width, Math.ceil(s.energy * 10 - 0.001), low && Math.sin(now * 10) > 0, touchUI, s.turboOn, Math.round(s.turbo * 50), s.shields, s.crates.map(c => c.lost ? (s.t - c.lostT < 0.5 ? 'L' + Math.round((s.t - c.lostT) * 30) : 'x') : 'o').join(''),
    s.L.endless ? Math.floor(s.distance) : Math.round(s.progress * 150), Math.floor(coinShown), Math.round(coinPop * 8), safe.t, safe.l, safe.r].join('|');
  if (key !== hudKey) {
    hudKey = key; const hh = Math.ceil((140 + safe.t) * k);
    if (hudCanvas.width !== canvas.width || hudCanvas.height !== hh) { hudCanvas.width = canvas.width; hudCanvas.height = hh; }
    const hc = hudCanvas.getContext('2d')!; hc.setTransform(1, 0, 0, 1, 0, 0); hc.clearRect(0, 0, hudCanvas.width, hudCanvas.height); hc.setTransform(k, 0, 0, k, 0, 0);
    hudTop(s, hc);
  }
  ctx.drawImage(hudCanvas, 0, 0, W, hudCanvas.height / k); // redrawn only when values change
  iconBtn('pause', W - 82 - safe.r, 12 + safe.t, 64, C.secondary, 'pause', () => setPaused(true));
  // warnings: wheel being chewed, UFO
  const hp = Math.min(s.wheelGone[0] ? 1 : s.wheelHP[0], s.wheelGone[1] ? 1 : s.wheelHP[1]);
  if (hp < 0.75 && Math.floor(now * 6) % 2 === 0) { chip(ctx, W / 2 - 112, 140 + safe.t, 72, 64, C.danger); ic('tires', W / 2 - 76, 172 + safe.t, 48); }
  if (s.ufo && !s.ufo.leaving && Math.floor(now * 5) % 2 === 0) { chip(ctx, W / 2 - 30, 140 + safe.t, 72, 64, C.danger); ic('ufo', W / 2 + 6, 172 + safe.t, 54); }
  if (touchUI) {
    const P = pedals();
    const pedal = (k: Pad, name: IconName, on: boolean, round = false, ring = -1) => { const { x, y, r } = P[k], dy = on ? 3 : 0, T = round ? C.primary : C.metal;
      ctx.globalAlpha = 0.92;
      if (round) { ctx.beginPath(); ctx.arc(x, y + 5, r, 0, 7); ctx.fillStyle = T.dark; ctx.fill(); ctx.beginPath(); ctx.arc(x, y + dy, r, 0, 7); ctx.fillStyle = on ? T.dark : T.base; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.dark; ctx.stroke(); }
      else { rr(ctx, x - r * 0.8, y - r + 5, r * 1.6, r * 2, r * 0.35); ctx.fillStyle = T.dark; ctx.fill(); rr(ctx, x - r * 0.8, y - r + dy, r * 1.6, r * 2, r * 0.35); ctx.fillStyle = on ? C.steel.light : T.base; ctx.fill(); ctx.lineWidth = 3; ctx.strokeStyle = T.dark; ctx.stroke();
        ctx.strokeStyle = alpha(T.dark, 0.35); ctx.lineWidth = 3; for (const f of [-0.62, 0.62]) { ctx.beginPath(); ctx.moveTo(x - r * 0.55, y + dy + f * r); ctx.lineTo(x + r * 0.55, y + dy + f * r); ctx.stroke(); } }
      if (ring >= 0) { ctx.strokeStyle = C.gold.base; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(x, y + dy, r - 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ring); ctx.stroke(); }
      ic(name, x, y + dy, r * 0.95); ctx.globalAlpha = 1; };
    pedal('tiltL', 'tiltL', !!inp.tiltL); pedal('tiltR', 'tiltR', !!inp.tiltR);
    pedal('brake', 'down', inp.brake); pedal('gas', 'up', inp.gas); pedal('turbo', 'turbo', inp.turbo, true, s.turbo);
  } else if (sel.world === 0 && sel.index === 0 && !sel.endless && s.t < 10) {
    // key hint on the first level only
    const y = H - 62, a = Math.min(1, (10 - s.t) / 1.5); ctx.globalAlpha = a; chip(ctx, W / 2 - 330, y - 38, 660, 76);
    const cap = (x: number, w: number, name: IconName) => { rr(ctx, x, y - 21, w, 48, 10); ctx.fillStyle = C.metal.dark; ctx.fill(); rr(ctx, x, y - 25, w, 48, 10); ctx.fillStyle = C.metal.light; ctx.fill(); ctx.strokeStyle = C.metal.dark; ctx.lineWidth = 2.5; ctx.stroke(); ic(name, x + w / 2, y - 1, 30, { tint: C.steel }); };
    cap(W / 2 - 312, 48, 'up'); ic('speed', W / 2 - 236, y, 40);
    cap(W / 2 - 190, 48, 'down'); ic('back', W / 2 - 114, y, 36);
    cap(W / 2 - 66, 48, 'arrowL'); cap(W / 2 - 12, 48, 'arrowR'); ic('tiltR', W / 2 + 70, y, 40);
    cap(W / 2 + 116, 110, 'turbo'); ic('turbo', W / 2 + 270, y, 40); ctx.globalAlpha = 1;
  }
}

function drawResult(dt: number) {
  const s = sim!, win = s.state === 'win'; drawSnapshot(0.4);
  const k = intro(sceneT, 0, 0.55), y = -600 + 660 * k, x = W / 2 - 370;
  metalPanel(ctx, x, y, 740, 600);
  plaque(ctx, W / 2, y + 74, 360, s.L.endless ? t('endless') : `${t('level')} ${sel.world * 10 + sel.index + 1}`, 36, win || s.L.endless ? C.primary : C.steel);
  const target = earned * (doubled ? 2 : 1), t0 = s.L.endless ? 0.5 : win ? 0.45 + s.stars * 0.35 + 0.2 : 0.6;
  if (sceneT > t0 && shown < target) { shown = Math.min(target, shown + dt * Math.max(30, target * 1.6)); if (now - lastTick > 0.05) { sfx.tick(); lastTick = now; } }
  if (s.L.endless) { ic('inf', W / 2 - 150, y + 190, 80); label(ctx, Math.floor(s.distance) + 'm', W / 2 - 90, y + 194, 70, { fill: newBest ? C.energy.base : C.gold.base, stroke: newBest ? C.energy.dark : C.gold.dark, align: 'left' }); }
  else if (win) {
    // delivered crates pop in one by one as stars
    const due = Math.min(s.stars, sceneT > 0.45 ? Math.floor((sceneT - 0.45) / 0.35) + 1 : 0);
    while (starShown < due) { starShown++; sfx.star(starShown); burst(W / 2 + (starShown - 2) * 120, y + 180, 18, [C.gold.base, C.primary.light, '#ffffff']); }
    crateStars(W / 2, y + 190, starShown, 104, sceneT - 0.45);
  } else {
    // funny rover reaction: dizzy eyes and smoke
    inset(ctx, W / 2 - 300, y + 124, 600, 150, C.steel);
    ctx.save(); ctx.beginPath(); rr(ctx, W / 2 - 300, y + 124, 600, 150, 14); ctx.clip();
    drawRoverPreview(ctx, W / 2 - 40, y + 196, 60, now, { crates: 0, mood: 'dizzy', smoke: true, angle: 0.18 + motion(Math.sin(now * 3) * 0.05), compress: 0.04 });
    ctx.restore();
    const why: IconName = s.failReason === 'flip' ? 'tiltR' : s.failReason === 'battery' ? 'batteryEmpty' : s.failReason === 'wheel' ? 'tires' : 'crateOff';
    chip(ctx, W / 2 + 160, y + 152, 96, 92, C.danger); ic(why, W / 2 + 208, y + 196, 64, why === 'crateOff' ? { mono: C.secondary } : undefined);
  }
  inset(ctx, W / 2 - 300, y + 296, 600, 84, C.steel);
  if (!s.L.endless) { ic('crate', W / 2 - 250, y + 338, 50); label(ctx, `${s.delivered} / ${s.L.crates}`, W / 2 - 214, y + 341, 40, { fill: win ? C.secondary.base : C.danger.light, stroke: C.steel.dark, align: 'left' }); }
  ic('coin', W / 2 + 70, y + 338, 52); label(ctx, `+${Math.floor(shown)}`, W / 2 + 106, y + 341, 44, { fill: C.gold.base, stroke: C.gold.dark, align: 'left' });
  const by = y + 404, rew = !doubled && earned > 0;
  if (win || s.L.endless) {
    bigBtn('next', rew ? W / 2 - 310 : W / 2 - 150, by, 300, 112, C.go, 'next', t('next'), () => startRun(nextLevel(), false), true);
    if (rew) rewardBtn('x2', W / 2 + 10, by, 300, 112, 'x2', async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { save.coins += earned; doubled = true; persist(); sfx.ding(); burst(W / 2 + 160, by + 50, 26, [C.gold.base, C.gold.light, '#ffffff']); } else flashMsg(); });
    iconBtn('r-retry', x + 30, y + 524, 64, C.secondary, 'retry', () => startRun(sel, false));
    iconBtn('r-garage', W / 2 - 32, y + 524, 64, C.primary, 'garage', () => go('garage'));
    iconBtn('r-map', x + 740 - 94, y + 524, 64, C.secondary, 'map', () => go('map'));
  } else {
    // failed: retry is the big first action, garage second
    bigBtn('retry', W / 2 - 310, by, 360, 112, C.go, 'retry', t('retry'), () => startRun(sel, false), true);
    bigBtn('f-garage', W / 2 + 70, by, 240, 112, C.primary, 'garage', '', () => go('garage'));
    if (rew) rewardBtn('x2', W / 2 - 110, y + 524, 220, 64, 'x2', async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { save.coins += earned; doubled = true; persist(); sfx.ding(); } else flashMsg(); });
    iconBtn('r-map', x + 740 - 94, y + 524, 64, C.secondary, 'map', () => go('map'));
  }
}

function drawRecharge() {
  const s = sim!; drawSnapshot(0.4);
  const k = intro(sceneT, 0, 0.45), y = 110; ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  metalPanel(ctx, W / 2 - 350, y, 700, 480);
  inset(ctx, W / 2 - 290, y + 66, 580, 200, C.steel);
  drawRoverPreview(ctx, W / 2 - 60, y + 162, 72, now, { crates: s.cratesLeft, mood: 'idle', blink: Math.sin(now * 2) > 0.6, look: { x: 0, y: 0.8 }, compress: 0.05 });
  const bl = Math.sin(now * 6) > 0; ic(bl ? 'batteryEmpty' : 'battery', W / 2 + 190, y + 164, 104, bl ? undefined : { mono: C.locked });
  // equal size: green finish (no ad) and blue recharge (rewarded)
  bigBtn('finish', W / 2 - 290, y + 300, 280, 132, C.go, 'next', '', () => { s.rechargeUsed = true; finishRun(); }, true);
  rewardBtn('recharge', W / 2 + 10, y + 300, 280, 132, 'battery', async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { s.recharge(); scene = 'drive'; sceneT = 0; platform.gameplayStart(); } else flashMsg(); });
  ctx.restore();
}

function drawSettings(dt: number) {
  settingsT += dt; const k = intro(settingsT, 0, 0.4); dim(0.55 * Math.min(1, settingsT * 4));
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  metalPanel(ctx, W / 2 - 300, 170, 600, 360);
  plaque(ctx, W / 2, 244, 320, t('settings'), 34);
  inset(ctx, W / 2 - 240, 310, 480, 100, C.steel);
  ic(isMuted() ? 'soundOff' : 'sound', W / 2 - 180, 360, 64); label(ctx, t('sound'), W / 2 - 132, 362, fitSize(ctx, t('sound'), 32, 150, 'ui'), { font: 'ui', fill: C.textLight, stroke: C.steel.dark, align: 'left' });
  toggle(ctx, 'set-snd', W / 2 + 90, 333, !isMuted(), toggleSound);
  iconBtn('set-close', W / 2 + 236, 156, 72, C.primary, 'close', () => { settingsOpen = false; sfx.pop(); });
  ctx.restore();
}

// ---------- loop ----------
let last = 0, lastSky = -1;
const frameTimes: number[] = [], workTimes: number[] = [];
function frame(ts: number) {
  requestAnimationFrame(frame); const w0 = performance.now();
  const raw = (ts - last) / 1000, dt = Math.min(0.1, raw); last = ts; sceneT += dt; now += dt;
  if (frameTimes.length > 600) frameTimes.shift(); frameTimes.push(raw * 1000); if (raw < 0.25) adaptResolution(dt);
  const s = canvas.width / W; ctx.setTransform(s, 0, 0, s, 0, 0); setPixelScale(s); beginFrame(); ctx.clearRect(0, 0, W, H);
  const skyW = scene === 'drive' || scene === 'result' || scene === 'recharge' ? sim?.L.world ?? 0 : scene === 'map' || scene === 'daily' ? wi : scene === 'pre' ? sel.world : 0;
  if (skyW !== lastSky) { lastSky = skyW; canvas.style.background = skyCss(skyW); }
  switch (scene) {
    case 'loading': drawLoading(dt); break; case 'title': drawTitle(dt); break; case 'map': drawMap(dt); break; case 'pre': drawPre(dt); break;
    case 'drive': drawDrive(dt); break; case 'result': drawResult(dt); break; case 'garage': drawGarage(dt); break;
    case 'daily': drawDaily(dt); break; case 'recharge': drawRecharge(); break;
  }
  if (settingsOpen) { clearFrameButtons(); drawSettings(dt); }   // modal: only its buttons are active
  if (dailyMsg > 0 && scene === 'map') { label(ctx, `+${dailyMsg}`, W / 2, 230 - Math.min(40, sceneT * 40), 54, { fill: C.gold.base, stroke: C.gold.dark }); if (sceneT > 2) dailyMsg = 0; }
  drawUiParticles(ctx, dt);
  if (flashT > 0) { flashT -= dt; ctx.fillStyle = alpha(C.danger.base, Math.min(0.18, flashT * 0.15)); ctx.fillRect(0, 0, W, H); }
  drawIris(ctx, dt);
  if (adBusy) dim(0.5);
  const st = scene === 'drive' && sim ? Math.round(Math.min(1, sim.storm) * 20) / 20 : 0; if (st !== stormShown) { stormShown = st; stormEl.style.opacity = String(st); }
  if (workTimes.length > 600) workTimes.shift(); workTimes.push(performance.now() - w0);
}

// ---------- boot ----------
(async () => {
  requestAnimationFrame(t0 => { last = t0; frame(t0); });
  platform = await createPlatform(); await platform.init();
  setLang(platform.language()); document.documentElement.lang = platform.language();
  const rt = document.getElementById('rotate-text'); if (rt) rt.textContent = t('rotate');
  platform.onAdStart = () => { setAdMuted(true); adBusy = true; }; platform.onAdEnd = () => { setAdMuted(false); };
  loadSave(platform); setMuted(save.muted);
  await loadFonts(p => { loadP = Math.max(loadP, p * 0.9); });
  loadDone = true; platform.loadingFinished();
  (window as any).__game = { get renderScale() { return renderScale; }, setScale: (v: number) => { adaptOn = false; renderScale = v; resize(); }, get scene() { return scene; }, get sim() { return sim; }, get cam() { return cam; }, save, go: (s: Scene) => go(s, false), startRun, makeLevel, frameTimes, workTimes, setTouch: (v: boolean) => { touchUI = v; }, get usedKeys() { return usedKeys; },
    setPaused, setWorld: (w: number) => { wi = w; }, openSettings, closeSettings: () => { settingsOpen = false; }, preview: (lv: LevelDef) => { sel = lv; go('pre', false); } };
})();
