/**
 * Toy Fort: screens, HUD, input, flow. The simulation (src/sim) is deterministic and separate; this file only reads it
 * and calls the player API. Ads and saves only through the platform layer.
 */
import { createPlatform } from './platform';
import type { Platform } from './platform/types';
import { setLang, t, Key } from './i18n';
import { Sim, Tower } from './sim/sim';
import { DT, TOWERS, TOWER_KINDS, TowerKind, TargetMode, BranchId, ENEMIES, EnemyKind, ALBUM, perksFrom, REWARD, ABILITIES, SCALE } from './sim/config';
import { LEVELS } from './sim/levels/data';
import type { LevelDef } from './sim/levels/types';
import { boardSvg } from './art/board';
import { drawKey } from './art/teddy';
import { preloadAll, loadBoard, drawSprite, towerKey, setSpriteRatio, clearBoards } from './render/sprites';
import { drawGame, consume, view, clearFx, setCoinTarget, takeCoinsArrived, burstAt, T } from './render/game';
import { C, ease, clamp01, motion, reducedMotion, loadFonts, FONT_DISPLAY } from './ui/theme';
import { W, H, rr, text, fit, beginFrame, modal, down, move, up, setButtonSound, button, lidPanel, slate, tray, intro, lidTo, lidBusy, drawLid, area, contact, screw } from './ui/widgets';
import { icon, IconName } from './ui/icons';
import { initAudio, setMuted, isMuted, setAdMuted, sfx } from './audio';
import { save, loadSave, persist, totalStars, levelOpen, endlessOpen } from './save';
import { TOY, JUNK } from './art/palette';

type Scene = 'loading' | 'title' | 'map' | 'album' | 'level' | 'result';
const cv = document.getElementById('c') as HTMLCanvasElement, ctx = cv.getContext('2d')!;
let platform: Platform, scene: Scene = 'loading', sceneT = 0, now = 0;
let page = 0, pre: LevelDef | null = null, preT = 0, settingsOpen = false, settingsT = 0;
let sim: Sim | null = null, level: LevelDef | null = null, boardKey = '', speed = 1, acc = 0, paused = false, pauseT = 0, adBusy = false;
let radial: { pad: number; t: number; pick: string } | null = null, aimBall = false, card: { kinds: EnemyKind[]; t: number } | null = null;
let offerContinue = false, offerT = 0, result: { won: boolean; stars: number; stickers: number; doubled: boolean; wave: number } | null = null, resT = 0, starShown = 0, goldShown = 0, endless = false;
let loadP = 0, loadDone = false, safe = { t: 0, l: 0, r: 0, b: 0 };

// ---------------------------------------------------------------- scaling + safe areas
function resize() {
  const dpr = Math.min(devicePixelRatio || 1, 2), sw = innerWidth, sh = innerHeight, s = Math.min(sw / W, sh / H);
  cv.style.width = W * s + 'px'; cv.style.height = H * s + 'px'; const k = Math.min(dpr, 2560 / (W * s)); cv.width = Math.round(W * s * k); cv.height = Math.round(H * s * k);
  const cs = getComputedStyle(document.documentElement), px = (v: string) => parseFloat(cs.getPropertyValue(v)) || 0, mx = (sw - W * s) / 2, my = (sh - H * s) / 2;
  safe = { t: Math.max(0, px('--sat') - my) / s, l: Math.max(0, px('--sal') - mx) / s, r: Math.max(0, px('--sar') - mx) / s, b: Math.max(0, px('--sab') - my) / s };
  setSpriteRatio(Math.min(2, cv.width / W * 1.0));
}
addEventListener('resize', resize); resize();
const toL = (e: PointerEvent) => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };

// ---------------------------------------------------------------- input
setButtonSound(k => k === 'press' ? sfx.press() : sfx.release());
cv.addEventListener('pointerdown', e => { initAudio(); if (adBusy || lidBusy()) return; const p = toL(e); if (down(p.x, p.y)) return; tapWorld(p.x, p.y); });
cv.addEventListener('pointermove', e => { const p = toL(e); move(p.x, p.y); if (scene === 'level' && sim) view.hoverPad = padAt(p.x, p.y); });
cv.addEventListener('pointerup', e => { const p = toL(e); up(p.x, p.y); });
cv.addEventListener('contextmenu', e => e.preventDefault());
addEventListener('keydown', e => { initAudio(); if (scene === 'level' && (e.code === 'Escape' || e.code === 'KeyP')) setPaused(!paused); if (scene === 'level' && e.code === 'Space' && sim && !paused) callWave(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && scene === 'level') setPaused(true); });
const padAt = (x: number, y: number) => sim ? sim.L.map.pads.findIndex(([px, py]) => Math.hypot(px * T - x, py * T + 6 - y) < 38) : -1;
function tapWorld(x: number, y: number) {
  if (scene === 'title' && !settingsOpen) { go('map'); return; }
  if (scene !== 'level' || !sim || paused || card || offerContinue) return;
  if (aimBall) { aimBall = false; if (sim.ability('ball', x / T, y / T)) sfx.boom(); return; }
  const i = padAt(x, y);
  if (i >= 0) { radial = { pad: i, t: 0, pick: '' }; view.selPad = i; view.placing = null; sfx.pop(); return; }
  radial = null; view.selPad = -1; view.placing = null;
}

// ---------------------------------------------------------------- flow
function go(s: Scene) { if (lidBusy()) return; sfx.whoosh(); lidTo(() => { scene = s; sceneT = 0; settingsOpen = false; pre = null; }); }
async function ad<T>(f: () => Promise<T>) { adBusy = true; try { return await f(); } finally { adBusy = false; } }
async function startLevel(L: LevelDef, bonusGold = 0, isEndless = false) {
  platform.gameplayStop(); await ad(() => platform.commercialBreak());
  clearBoards(); boardKey = `board:${L.map.id}`; await loadBoard(boardKey, boardSvg(L));
  lidTo(() => {
    level = L; endless = isEndless; sim = new Sim(L, { seed: (Math.random() * 1e9) | 0, perks: perksFrom(save.album), extraGold: bonusGold, endless: isEndless });
    scene = 'level'; sceneT = 0; speed = 1; acc = 0; paused = false; radial = null; aimBall = false; offerContinue = false; result = null; pre = null; clearFx(); view.selPad = -1; view.hoverPad = -1; view.placing = null;
    const fresh = (L.intro ?? []).filter(k => !save.seenIntro.includes(k)); card = fresh.length && !isEndless ? { kinds: fresh, t: 0 } : null;
    platform.gameplayStart();
  });
}
function setPaused(p: boolean) { if (scene !== 'level' || !sim || result) return; paused = p; pauseT = 0; p ? platform.gameplayStop() : platform.gameplayStart(); }
function callWave() { if (!sim) return; const before = Math.floor(sim.gold); if (sim.callWave()) { sfx.horn(); const bonus = Math.floor(sim.gold) - before; if (bonus > 0) burstAt(1.4, 0.9, 'confetti', 8, [TOY.yellow.top], 2); } }
function finish(won: boolean) {
  if (!sim || !level) return; platform.gameplayStop();
  let stars = 0, stickers = 0;
  if (endless) { save.endlessBest = Math.max(save.endlessBest, sim.wave); }
  else if (won) { stars = sim.lives >= SCALE.star3 ? 3 : sim.lives >= SCALE.star2 ? 2 : 1; const old = save.stars[level.g] ?? 0; if (stars > old) { stickers = stars - old; save.stars[level.g] = stars; save.stickers += stickers; } if (stars === 3) platform.happyMoment(); }
  persist(); result = { won, stars, stickers, doubled: false, wave: sim.wave }; resT = 0; starShown = 0; goldShown = 0; scene = 'result'; sceneT = 0;
  won ? sfx.jingle() : sfx.sad();
}

// ---------------------------------------------------------------- shared drawing
const ic = (n: IconName, x: number, y: number, s: number, tint?: typeof TOY.red) => icon(ctx, n, x, y, s, tint ? { tint } : {});
function iconBtn(id: string, x: number, y: number, s: number, c: typeof TOY.red, n: IconName, cb: () => void, pulse = false) { button(ctx, id, x, y, s, s, c, cb, (cx, cy) => ic(n, cx, cy, s * 0.58), { pulse }); }
function bigBtn(id: string, x: number, y: number, w: number, h: number, c: typeof TOY.red, n: IconName, label: string, cb: () => void, pulse = false) {
  button(ctx, id, x, y, w, h, c, cb, (cx, cy) => { const s = Math.min(70, h * 0.56); if (!label) { ic(n, cx, cy, s); return; } const fs = fit(ctx, label, Math.min(42, h * 0.4), w - s - 50); ic(n, x + 24 + s / 2, cy, s); text(ctx, label, x + 34 + s + (w - s - 44) / 2, cy, fs, '#fff'); }, { pulse });
}
/** rewarded-ad button: toy purple (never green) with a drawn film icon + what you get */
function rewardBtn(id: string, x: number, y: number, w: number, h: number, gain: () => void, cb: () => void) { button(ctx, id, x, y, w, h, C.reward, cb, (cx, cy) => { const s = Math.min(64, h * 0.5); ic('film', cx - s * 0.65, cy, s); ctx.save(); ctx.translate(cx + s * 0.65, cy); gain(); ctx.restore(); }); }
const dim = (a = 0.45) => { ctx.fillStyle = `rgba(42,26,18,${a})`; ctx.fillRect(0, 0, W, H); };
function starsRow(cx: number, cy: number, n: number, size: number, popT = -1) {
  for (let i = 0; i < 3; i++) { const x = cx + (i - 1) * size * 1.1, y = cy + (i === 1 ? -size * 0.18 : 0), k = popT < 0 ? 1 : i < n ? ease.outBack(clamp01((popT - i * 0.35) / 0.35)) : 1;
    ctx.save(); ctx.translate(x, y); ctx.scale(k, k); ic(i < n ? 'star' : 'starOff', 0, 0, size); ctx.restore(); }
}
function teddyAt(x: number, y: number, s: number, pose: 'idle' | 'happy' | 'sad', keyAng: number, keyOut = 0) {
  drawSprite(ctx, `teddy:${pose}`, x, y, s);
  if (keyOut <= 0) drawKey(ctx, x + 30 * s, y - 60 * s, s * 1.4, keyAng);
  else { const k = keyOut, kx = x + 30 * s + k * 220, ky = y - 60 * s - Math.sin(k * Math.PI) * 140 + k * k * 90; drawKey(ctx, kx, ky, s * 1.4, keyAng * 4); }
}
/** the room behind menus: floor planks, rug, bed edge, night light */
function room(w: 1 | 2 | 3 = 1) {
  const pal = w === 1 ? ['#d6a96f', '#bf8f58'] : w === 2 ? ['#e5cfa6', '#d2b98c'] : ['#e8cf9a', '#d7b97f'];
  for (let i = 0; i < 9; i++) { ctx.fillStyle = i % 2 ? pal[0] : pal[1]; ctx.fillRect(0, i * 80, W, 80); }
  ctx.fillStyle = 'rgba(255,214,150,.18)'; ctx.beginPath(); ctx.arc(160, 120, 340, 0, 7); ctx.fill();
}

// ---------------------------------------------------------------- loading: blocks stacking up
function drawLoading(dt: number) {
  room(); loadP += (Math.min(1, loadDone ? 1 : 0.92) * 1 - loadP) * Math.min(1, dt * 4);
  const cols = [TOY.red, TOY.blue, TOY.yellow, TOY.green, TOY.purple], n = 10, shown = loadP * n;
  for (let i = 0; i < n; i++) { const k = clamp01(shown - i); if (k <= 0) break; const x = W / 2 - 44 + (i % 2) * 8, y = 540 - i * 34 - (1 - ease.outBounce(k)) * 200, c = cols[i % 5];
    contact(ctx, x, y, 88, 32, 6); rr(ctx, x, y + 6, 88, 32, 6); ctx.fillStyle = c.dark; ctx.fill(); rr(ctx, x, y, 88, 32, 6); ctx.fillStyle = c.top; ctx.fill();
    ctx.fillStyle = c.side; ctx.beginPath(); ctx.arc(x + 24, y + 6, 8, 0, 7); ctx.arc(x + 64, y + 6, 8, 0, 7); ctx.fill(); }
  if (loadDone && loadP > 0.98 && sceneT > 0.5) { scene = 'title'; sceneT = 0; }
}

// ---------------------------------------------------------------- title
function logo(cx: number, cy: number) {
  const word = t('title'), cols = [TOY.red, TOY.blue, TOY.yellow, TOY.green, TOY.purple];
  const size = Math.min(84, 980 / Math.max(6, word.length)); ctx.font = `800 ${size}px ${FONT_DISPLAY}`;
  const widths = [...word].map(ch => ch === ' ' ? size * 0.35 : Math.max(size * 0.78, ctx.measureText(ch).width + 18)), total = widths.reduce((a, b) => a + b, 0);
  let x = cx - total / 2, k = 0;
  [...word].forEach((ch, i) => { const w = widths[i]; if (ch === ' ') { x += w; return; }
    const c = cols[k++ % 5], d = clamp01((sceneT - 0.15 - i * 0.07) / 0.5), drop = (1 - ease.outBounce(d)) * -420, wob = motion(Math.sin(now * 2 + i) * 2), y = cy + drop + wob + (i % 2 ? 6 : 0);
    if (d <= 0) { x += w; return; }
    contact(ctx, x + 2, y + 4, w - 4, size * 1.05, 10);
    rr(ctx, x + 2, y + 9, w - 4, size * 1.05, 10); ctx.fillStyle = c.dark; ctx.fill(); rr(ctx, x + 2, y, w - 4, size * 1.05, 10); ctx.fillStyle = c.side; ctx.fill(); rr(ctx, x + 2, y, w - 4, size * 0.85, 10); ctx.fillStyle = c.top; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; rr(ctx, x + 10, y + 6, w * 0.3, 6, 3); ctx.fill();
    text(ctx, ch, x + w / 2, y + size * 0.48, size * 0.82, '#fff', { drop: c.dark }); x += w; });
}
function drawTitle(dt: number) {
  room(); void dt;
  // bed with hanging blanket (top-left), dust bunnies peeking from under it, night light glow
  ctx.fillStyle = '#3c4a6e'; rr(ctx, -40, 120, 470, 230, 30); ctx.fill(); ctx.fillStyle = '#7b8fc4'; ctx.beginPath(); ctx.moveTo(-40, 300); ctx.bezierCurveTo(120, 360, 260, 300, 430, 330); ctx.lineTo(430, 360); ctx.lineTo(-40, 360); ctx.fill();
  ctx.fillStyle = '#20263a'; ctx.fillRect(-40, 360, 470, 30);
  for (let i = 0; i < 3; i++) { const pk = clamp01(Math.sin(now * 0.9 + i * 2.1) * 1.5 + 0.2) * motion(1) + (reducedMotion ? 0.5 : 0), x = 90 + i * 120;
    ctx.save(); ctx.beginPath(); ctx.rect(x - 50, 300, 100, 92); ctx.clip(); drawSprite(ctx, `e:bunny:0`, x, 400 - pk * 34, 0.9, i % 2 === 1); ctx.restore(); }
  const glow = 0.5 + 0.2 * Math.sin(now * 2); ctx.fillStyle = `rgba(255,226,150,${0.25 * glow})`; ctx.beginPath(); ctx.arc(520, 330, 120, 0, 7); ctx.fill(); ctx.fillStyle = '#ffe6a0'; ctx.beginPath(); ctx.arc(520, 330, 26, 0, 7); ctx.fill(); ctx.fillStyle = '#cfa36b'; ctx.fillRect(508, 352, 24, 22);
  // the toy box with the teddy captain on top (key turning)
  const bx = 960, by = 620; contact(ctx, bx - 120, by - 120, 240, 120, 16);
  rr(ctx, bx - 120, by - 120, 240, 126, 16); ctx.fillStyle = '#8a5a2e'; ctx.fill(); rr(ctx, bx - 120, by - 120, 240, 110, 16); ctx.fillStyle = '#d9a066'; ctx.fill(); ctx.fillStyle = TOY.red.side; ctx.fillRect(bx - 120, by - 80, 240, 18);
  ctx.fillStyle = '#ffd84a'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 9 : 20; ctx.lineTo(bx + Math.cos(a) * r, by - 72 + Math.sin(a) * r); } ctx.fill();
  teddyAt(bx, by - 116, 1, 'idle', now * 3);
  logo(W / 2, 70 + safe.t);
  const pk = intro(sceneT, 0.9, 0.5); ctx.save(); ctx.translate(640, 460); ctx.scale(pk, pk); ctx.translate(-640, -460);
  bigBtn('play', 470, 400, 340, 128, C.primary, 'play', t('play'), () => go('map'), true); ctx.restore();
  iconBtn('settings', 20 + safe.l, H - 92 - safe.b, 70, C.secondary, 'settings', () => { settingsOpen = true; settingsT = 0; });
  iconBtn('snd', W - 90 - safe.r, H - 92 - safe.b, 70, C.secondary, isMuted() ? 'soundOff' : 'sound', toggleSound);
}
function toggleSound() { setMuted(!isMuted()); save.muted = isMuted(); persist(); }

// ---------------------------------------------------------------- map: a race-car track across the room
const WORLD_NAME: Key[] = ['bedroom', 'desk', 'sandbox'];
const station = (i: number) => ({ x: 130 + i * 113, y: 400 + Math.sin(i * 0.9 + 0.4) * 120 });
function drawMap(dt: number) {
  room((page + 1) as 1 | 2 | 3); void dt;
  // track
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const path = () => { ctx.beginPath(); for (let i = 0; i < 10; i++) { const p = station(i); i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y); } };
  ctx.save(); ctx.filter = 'blur(6px)'; path(); ctx.strokeStyle = 'rgba(55,32,12,.3)'; ctx.lineWidth = 70; ctx.translate(4, 10); ctx.stroke(); ctx.restore();
  path(); ctx.strokeStyle = '#4f5560'; ctx.lineWidth = 64; ctx.translate(0, 6); ctx.stroke(); ctx.translate(0, -6);
  path(); ctx.strokeStyle = '#6d7480'; ctx.lineWidth = 60; ctx.stroke();
  path(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.setLineDash([16, 14]); ctx.stroke(); ctx.setLineDash([]);
  let cur = 0;
  for (let i = 0; i < 10; i++) { const g = page * 10 + i + 1, open = levelOpen(g), st = save.stars[g] ?? 0, p = station(i), k = intro(sceneT, 0.04 * i, 0.4); if (open) cur = i;
    ctx.save(); ctx.translate(p.x, p.y); ctx.scale(k, k); ctx.translate(-p.x, -p.y);
    button(ctx, 'lv' + g, p.x - 44, p.y - 44, 88, 88, open ? (st ? C.go : C.primary) : C.locked, () => { if (open) { pre = LEVELS[g - 1]; preT = 0; sfx.pop(); } }, (cx, cy) => { if (open) text(ctx, g, cx, cy, 40, '#fff'); else ic('lock', cx, cy, 46); }, { r: 44, pulse: open && !st });
    if (open && st) starsRow(p.x, p.y + 64, st, 26);
    ctx.restore(); }
  const cp = station(cur); drawSprite(ctx, 'teddy:idle', cp.x, cp.y - 52, 0.42);
  // header: world plaque, arrows, top bar
  const name = t(WORLD_NAME[page]); tray(ctx, W / 2 - 170, 20 + safe.t, 340, 70, C.secondary); text(ctx, name, W / 2, 54 + safe.t, fit(ctx, name, 40, 300), '#fff', { drop: C.secondary.dark });
  if (page > 0) iconBtn('pgL', 20 + safe.l, 300, 78, C.secondary, 'back', () => { page--; sfx.whoosh(); });
  if (page < 2 && levelOpen(page * 10 + 11)) iconBtn('pgR', W - 98 - safe.r, 300, 78, C.secondary, 'next', () => { page++; sfx.whoosh(); });
  iconBtn('home', 20 + safe.l, 20 + safe.t, 70, C.secondary, 'back', () => go('title'));
  tray(ctx, W - 300 - safe.r, 24 + safe.t, 190, 62, C.secondary); ic('sticker', W - 268 - safe.r, 55 + safe.t, 44); text(ctx, save.stickers, W - 238 - safe.r, 56 + safe.t, 34, '#fff', { align: 'left', drop: C.secondary.dark });
  iconBtn('album', W - 96 - safe.r, 20 + safe.t, 76, C.reward, 'sticker', () => go('album'));
  if (endlessOpen()) bigBtn('endless', W - 260 - safe.r, H - 110 - safe.b, 236, 88, C.info, 'inf', String(save.endlessBest || ''), () => startLevel({ ...LEVELS[9], g: 0 }, 0, true));
  if (pre) drawPre(dt);
}
/** pre-level panel: green PLAY and an equal-size purple "film + 150 gold" rewarded start */
function drawPre(dt: number) {
  preT += dt; modal(); dim(0.45); const L = pre!, k = intro(preT, 0, 0.35); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  lidPanel(ctx, W / 2 - 330, 150, 660, 420); text(ctx, `${t('level')} ${L.g}`, W / 2, 230, 44, '#fff', { drop: '#8a5a2e' });
  slate(ctx, W / 2 - 280, 270, 560, 110); const kinds = [...new Set(L.waves.flatMap(w => w.groups.map(g => g.e)))];
  kinds.forEach((e, i) => drawSprite(ctx, `e:${e}:0`, W / 2 + (i - (kinds.length - 1) / 2) * 76, 362, e === 'king' ? 0.45 : 0.85));
  text(ctx, `${L.waves.length}`, W / 2 + 250, 294, 26, C.chalkLine, { drop: null, font: 'ui' });
  bigBtn('pre-play', W / 2 - 290, 410, 280, 120, C.go, 'play', '', () => startLevel(L));
  rewardBtn('pre-gold', W / 2 + 10, 410, 280, 120, () => { ic('coin', -6, 0, 50); text(ctx, '+' + REWARD.startGold, 40, 2, 30, '#fff', { drop: TOY.purple.dark }); }, async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) startLevel(L, REWARD.startGold); });
  iconBtn('pre-x', W / 2 + 290, 130, 64, C.primary, 'close', () => { pre = null; });
  ctx.restore();
}

// ---------------------------------------------------------------- sticker album
const ALBUM_POS: Record<string, [number, number]> = { gold1: [640, 190], soldier: [400, 320], catapult: [640, 320], life: [880, 320], bubble: [300, 460], band: [560, 460], hangar: [820, 460], cooldown: [300, 600], refund: [560, 600], gold2: [880, 600] };
const ALBUM_ICON: Record<string, () => void> = {};
function drawAlbum(dt: number) {
  room(); void dt; lidPanel(ctx, 120, 110, 1040, 590); ctx.fillStyle = C.paper; rr(ctx, 150, 160, 980, 520, 18); ctx.fill();
  ctx.strokeStyle = 'rgba(160,120,80,.35)'; ctx.lineWidth = 4; ctx.setLineDash([8, 8]);
  for (const n of ALBUM) if (n.req) { const [x0, y0] = ALBUM_POS[n.req], [x1, y1] = ALBUM_POS[n.id]; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); } ctx.setLineDash([]);
  for (const n of ALBUM) {
    const [x, y] = ALBUM_POS[n.id], owned = save.album.includes(n.id), can = !owned && (!n.req || save.album.includes(n.req)) && save.stickers >= n.cost;
    const ok = !owned && (!n.req || save.album.includes(n.req));
    area('al-' + n.id, x - 55, y - 55, 110, 110, () => { if (can) { save.stickers -= n.cost; save.album.push(n.id); persist(); sfx.slap(); burstAt(x / T, y / T, 'confetti', 18, [TOY.red.top, TOY.yellow.top, TOY.purple.top], 3); ALBUM_ICON[n.id] = () => {}; } });
    if (owned) { // sticker slapped on with a shine
      ctx.save(); ctx.translate(x, y); ctx.rotate(((n.id.length * 7) % 9 - 4) * 0.03); ctx.fillStyle = 'rgba(55,32,12,.2)'; rr(ctx, -50, -46, 104, 104, 22); ctx.fill(); ctx.fillStyle = '#fff'; rr(ctx, -52, -52, 104, 104, 22); ctx.fill();
      perkIcon(n.id, 0, 0, 72); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(-52, -20); ctx.lineTo(-20, -52); ctx.lineTo(0, -52); ctx.lineTo(-52, 0); ctx.fill(); ctx.restore();
    } else { ctx.strokeStyle = ok ? 'rgba(154,107,216,.8)' : 'rgba(160,140,120,.5)'; ctx.lineWidth = 3; ctx.setLineDash([7, 6]); rr(ctx, x - 50, y - 50, 100, 100, 22); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = ok ? 0.55 : 0.25; perkIcon(n.id, x, y - 6, 60); ctx.globalAlpha = 1;
      for (let i = 0; i < n.cost; i++) ic('sticker', x + (i - (n.cost - 1) / 2) * 26, y + 40, 26); if (can) { ctx.strokeStyle = 'rgba(92,191,90,.9)'; ctx.lineWidth = 4; rr(ctx, x - 54, y - 54, 108, 108, 24); ctx.stroke(); } }
  }
  iconBtn('al-back', 20 + safe.l, 20 + safe.t, 70, C.secondary, 'back', () => go('map'));
  tray(ctx, W / 2 - 110, 26 + safe.t, 220, 62, C.reward); ic('sticker', W / 2 - 70, 57 + safe.t, 44); text(ctx, save.stickers, W / 2 - 38, 58 + safe.t, 34, '#fff', { align: 'left', drop: TOY.purple.dark });
}
function perkIcon(id: string, x: number, y: number, s: number) {
  const tw = ['soldier', 'catapult', 'bubble', 'band', 'hangar'].includes(id) ? id as TowerKind : null;
  if (tw) { drawSprite(ctx, towerKey(tw, 1, null), x, y + s * 0.45, s / 130); ic('up', x + s * 0.32, y + s * 0.3, s * 0.38); return; }
  const m: Record<string, IconName> = { gold1: 'coin', gold2: 'coin', life: 'life', cooldown: 'ball', refund: 'sell' }; ic(m[id], x, y, s * 0.8);
  if (id === 'gold1' || id === 'gold2' || id === 'life') ic('plus', x + s * 0.32, y + s * 0.3, s * 0.36);
}

// ---------------------------------------------------------------- level: HUD, radial menus, cards
const TICON: Record<TargetMode, IconName> = { first: 'tFirst', last: 'tLast', strong: 'tStrong', close: 'tClose' };
const TNEXT: Record<TargetMode, TargetMode> = { first: 'last', last: 'strong', strong: 'close', close: 'first' };
function drawLevel(dt: number) {
  const s = sim!;
  if (!paused && !card && !offerContinue && !adBusy) { acc += dt * speed; let n = 0; while (acc >= DT && n < 8) { s.step(); acc -= DT; n++; } if (acc > DT) acc = DT; }
  const evs = s.drainEvents(); consume(s, evs); sounds(evs);
  if (s.state === 'lost' && !offerContinue && !result) { if (!s.continued) { offerContinue = true; offerT = 0; platform.gameplayStop(); } else finish(false); }
  if (s.state === 'won' && !result) finish(true);
  setCoinTarget(250 + safe.l, 44 + safe.t);
  drawGame(ctx, s, boardKey, now, paused || card ? 0 : dt);
  if (takeCoinsArrived()) { sfx.coin(); goldPop = 1; }
  drawHud(s, dt);
  if (radial) drawRadial(s, dt);
  if (card) drawCard(dt);
  if (offerContinue) drawContinue(dt);
  if (paused) drawPause(dt);
}
let goldPop = 0;
function drawHud(s: Sim, dt: number) {
  goldPop = Math.max(0, goldPop - dt * 4);
  const x0 = 16 + safe.l, y0 = 12 + safe.t;
  // lives + gold
  tray(ctx, x0, y0, 330, 62, C.metal); ic('life', x0 + 34, y0 + 30, 46); text(ctx, s.lives, x0 + 62, y0 + 32, 34, TOY.red.dark, { align: 'left', drop: 'rgba(255,255,255,.6)' });
  ctx.save(); ctx.translate(x0 + 200, y0 + 30); ctx.scale(1 + goldPop * 0.25, 1 + goldPop * 0.25); ic('coin', 0, 0, 44); ctx.restore(); text(ctx, Math.floor(s.gold), x0 + 228, y0 + 32, 34, TOY.yellow.dark, { align: 'left', drop: 'rgba(255,255,255,.6)' });
  // wave counter + next wave preview
  const wx = W / 2 - 170; tray(ctx, wx, y0, 340, 62, C.metal);
  text(ctx, endless ? `${s.wave}` : `${s.wave}/${s.L.waves.length}`, wx + 50, y0 + 32, 32, TOY.blue.dark, { drop: 'rgba(255,255,255,.6)' });
  const nw = s.wave < s.totalWaves ? s.L.waves[s.wave % s.L.waves.length] : null;
  if (nw) [...new Set(nw.groups.map(g => g.e))].slice(0, 4).forEach((e, i) => drawSprite(ctx, `e:${e}:0`, wx + 130 + i * 50, y0 + 54, e === 'king' ? 0.3 : 0.55));
  // call next wave: countdown ring + bonus
  if (nw) { const bx = wx + 350, cd = Math.max(0, Math.min(s.countdown, 20)), bonus = Math.floor(Math.max(0, Math.min(s.countdown, 12)) * SCALE.earlyBonusPerSec);
    button(ctx, 'call', bx, y0, 64, 62, C.go, callWave, (cx, cy) => { ic('fast', cx, cy, 36); ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(cx, cy, 27, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (cd / 20)); ctx.stroke(); }, { pulse: s.wave === 0 });
    if (bonus > 0) { ic('coin', bx + 80, y0 + 18, 22); text(ctx, '+' + bonus, bx + 94, y0 + 19, 20, TOY.yellow.dark, { align: 'left', font: 'ui', drop: 'rgba(255,255,255,.7)' }); } }
  // speed + pause
  button(ctx, 'speed', W - 166 - safe.r, y0, 70, 62, speed === 2 ? C.gold : C.secondary, () => { speed = speed === 1 ? 2 : 1; }, (cx, cy) => { ic(speed === 2 ? 'fast' : 'play', cx, cy, 36); });
  iconBtn('pause', W - 86 - safe.r, y0, 66, C.secondary, 'pause', () => setPaused(true));
  // abilities with cooldown rings
  const ab = (id: string, x: number, n: IconName, cd: number, max: number, cb: () => void) => { const ready = cd <= 0;
    button(ctx, id, x, H - 96 - safe.b, 80, 80, ready ? (id === 'ab-ball' ? C.primary : C.gold) : C.locked, cb, (cx, cy) => { ic(n, cx, cy, 48); if (!ready) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 33, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (1 - cd / max)); ctx.stroke(); } }, { pulse: id === 'ab-ball' && aimBall }); };
  const cdm = 1 - s.perks.cooldown;
  ab('ab-ball', W - 186 - safe.r, 'ball', s.ballCd, ABILITIES.ball.cooldown * cdm, () => { if (s.ballCd <= 0) aimBall = !aimBall; });
  ab('ab-flash', W - 96 - safe.r, 'flash', s.flashCd, ABILITIES.flash.cooldown * cdm, () => { if (s.ability('flash')) sfx.flash(); });
  if (aimBall) { ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 4; ctx.setLineDash([10, 8]); ctx.beginPath(); ctx.arc(lastPointer.x, lastPointer.y, ABILITIES.ball.radius * T, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
}
const lastPointer = { x: 640, y: 360 }; addEventListener('pointermove', e => { const p = toL(e); lastPointer.x = p.x; lastPointer.y = p.y; });
/** radial menu around a pad: build (5 towers) or tower actions (upgrade / branches / sell / targeting) */
function drawRadial(s: Sim, dt: number) {
  const R0 = radial!; R0.t += dt; const [px, py] = s.L.map.pads[R0.pad], cx = px * T, cy = py * T - 10, k = intro(R0.t, 0, 0.25), tw = s.pads[R0.pad];
  const items: { id: string; draw: (x: number, y: number) => void; cost: number; can: boolean; act: () => void; preview?: () => void }[] = [];
  if (!tw) for (const kind of TOWER_KINDS) { const c = TOWERS[kind].cost; items.push({ id: kind, cost: c, can: s.gold >= c, draw: (x, y) => drawSprite(ctx, towerKey(kind, 1, null), x, y + 26, 0.42), act: () => { if (s.build(R0.pad, kind)) { radial = null; view.selPad = -1; view.placing = null; } }, preview: () => { view.placing = kind; } }); }
  else {
    if (tw.level < 3) { const c = s.upgradeCost(tw); items.push({ id: 'up', cost: c, can: s.gold >= c, draw: (x, y) => { drawSprite(ctx, towerKey(tw.kind, tw.level + 1, null), x, y + 26, 0.42); ic('up', x + 20, y + 14, 26); }, act: () => { s.upgrade(tw); } }); }
    else if (tw.level === 3) for (const b of TOWERS[tw.kind].branches) { const c = s.upgradeCost(tw); items.push({ id: b, cost: c, can: s.gold >= c, draw: (x, y) => drawSprite(ctx, towerKey(tw.kind, 4, b), x, y + 26, 0.42), act: () => { s.branch(tw, b as BranchId); } }); }
    items.push({ id: 'target', cost: 0, can: true, draw: (x, y) => ic(TICON[tw.target], x, y, 44), act: () => { s.setTarget(tw, TNEXT[tw.target]); } });
    items.push({ id: 'sell', cost: -s.sellValue(tw), can: true, draw: (x, y) => ic('sell', x, y, 44), act: () => { s.sell(tw); radial = null; view.selPad = -1; } });
  }
  const n = items.length, rad = 104;
  items.forEach((it, i) => {
    const a = -Math.PI / 2 + (i - (n - 1) / 2) * (Math.PI * 1.7 / Math.max(n, 5)) * (n > 3 ? 1 : 1.4), x = cx + Math.cos(a) * rad * k, y = Math.max(70, Math.min(H - 60, cy + Math.sin(a) * rad * k));
    const armed = R0.pick === it.id;
    button(ctx, 'rad-' + it.id, x - 40, y - 40, 80, 80, armed ? C.go : it.can ? C.secondary : C.locked, () => {
      if (!it.can) { sfx.leak(); return; }
      if (it.preview && R0.pick !== it.id) { R0.pick = it.id; it.preview(); return; }    // first tap: preview range + coverage, second tap: build
      it.act(); if (it.id === 'up' || it.id.length > 6) sfx.ratchet();
    }, (bx, by) => { it.draw(bx, by - 6); if (it.cost) { const g = it.cost > 0; ic('coin', bx - 16, by + 30, 20); text(ctx, Math.abs(it.cost), bx + 4, by + 31, 20, g ? (it.can ? TOY.yellow.dark : TOY.red.dark) : TOY.green.dark, { font: 'ui', align: 'left', drop: 'rgba(255,255,255,.7)' }); } }, { r: 40 });
  });
}
function drawCard(dt: number) {
  const c = card!; c.t += dt; modal(); dim(0.5); const k = intro(c.t, 0, 0.4), e = c.kinds[0], E = ENEMIES[e];
  ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  lidPanel(ctx, W / 2 - 300, 130, 600, 460); slate(ctx, W / 2 - 250, 190, 500, 250);
  drawSprite(ctx, `e:${e}:${Math.floor(now * 3) % 2}`, W / 2 - 110, 400, e === 'king' ? 1.4 : 2.6);
  const bar = (y: number, n: IconName, v: number) => { ic(n, W / 2 + 60, y, 40); for (let i = 0; i < 5; i++) { rr(ctx, W / 2 + 92 + i * 26, y - 9, 20, 18, 5); ctx.fillStyle = i < v ? '#ffe9a8' : 'rgba(255,255,255,.15)'; ctx.fill(); } };
  bar(240, 'speed', Math.round(E.speed / 0.4)); bar(300, 'armor', Math.min(5, Math.ceil(E.armor / 2))); bar(360, 'hp', Math.min(5, Math.ceil(Math.log2(E.hp / 8))));
  if (E.air) ic('wing', W / 2 + 200, 410, 50);
  bigBtn('card-ok', W / 2 - 110, 470, 220, 96, C.go, 'check', '', () => { save.seenIntro.push(e); persist(); c.kinds.shift(); c.t = 0; if (!c.kinds.length) card = null; }, true);
  ctx.restore();
}
function drawContinue(dt: number) {
  offerT += dt; modal(); dim(0.55); const k = intro(offerT, 0, 0.4); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  lidPanel(ctx, W / 2 - 320, 160, 640, 400); teddyAt(W / 2, 380, 0.9, 'sad', now * 2);
  // Poki: the green normal option is next to the rewarded one and at least as big
  bigBtn('cont-no', W / 2 - 290, 430, 280, 110, C.go, 'next', '', () => { offerContinue = false; finish(false); });
  rewardBtn('cont-yes', W / 2 + 10, 430, 280, 110, () => { ic('life', -6, 0, 50); text(ctx, '+' + REWARD.continueLives, 40, 2, 30, '#fff', { drop: TOY.purple.dark }); }, async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok && sim) { sim.continueRun(REWARD.continueLives); offerContinue = false; platform.gameplayStart(); } });
  ctx.restore();
}
function drawPause(dt: number) {
  pauseT += dt; modal(); dim(0.45); const y = -420 + 540 * intro(pauseT, 0, 0.3, ease.outCubic);
  lidPanel(ctx, W / 2 - 300, y, 600, 380); teddyAt(W / 2 + 210, y + 150, 0.55, 'idle', now * 2);
  bigBtn('resume', W / 2 - 250, y + 80, 380, 120, C.go, 'play', '', () => setPaused(false), true);
  iconBtn('p-retry', W / 2 - 250, y + 236, 96, C.secondary, 'retry', () => { if (level) startLevel(level, 0, endless); });
  iconBtn('p-map', W / 2 - 134, y + 236, 96, C.secondary, 'map', () => { platform.gameplayStop(); paused = false; go('map'); });
  iconBtn('p-snd', W / 2 - 18, y + 236, 96, C.secondary, isMuted() ? 'soundOff' : 'sound', toggleSound);
}

// ---------------------------------------------------------------- result
function drawResult(dt: number) {
  const s = sim!, r = result!; resT += dt; drawGame(ctx, s, boardKey, now, 0); dim(0.45);
  const y = -560 + 660 * intro(resT, 0, 0.55), win = r.won;
  lidPanel(ctx, W / 2 - 360, y, 720, 560);
  if (endless) { ic('inf', W / 2 - 80, y + 130, 70); text(ctx, r.wave, W / 2 + 10, y + 132, 60, '#fff', { align: 'left', drop: '#8a5a2e' }); }
  else if (win) { const due = Math.min(r.stars, resT > 0.45 ? Math.floor((resT - 0.45) / 0.35) + 1 : 0); while (starShown < due) { starShown++; sfx.star(starShown); burstAt((W / 2 + (starShown - 2) * 104) / T, (y + 130) / T, 'confetti', 14, [TOY.yellow.top, TOY.red.top, '#fff'], 3); } starsRow(W / 2, y + 140, starShown, 94, resT - 0.45); }
  // teddy reacts: happy jump, or its key spins out and it slumps
  const keyOut = win ? 0 : clamp01((resT - 0.3) / 1.0); teddyAt(W / 2 - 250, y + 330 - (win ? Math.abs(Math.sin(now * 5)) * 18 * motion(1) : 0), 0.8, win ? 'happy' : keyOut > 0.5 ? 'sad' : 'idle', now * (win ? 4 : 1), keyOut);
  slate(ctx, W / 2 - 130, y + 220, 400, 150);
  ic('life', W / 2 - 80, y + 262, 42); text(ctx, s.lives, W / 2 - 50, y + 264, 34, C.chalkLine, { align: 'left', drop: null });
  goldShown = Math.min(Math.floor(s.gold), goldShown + dt * Math.max(60, s.gold * 1.4)); if (goldShown < s.gold && now % 0.06 < dt) sfx.tick();
  ic('coin', W / 2 + 80, y + 262, 42); text(ctx, Math.floor(goldShown), W / 2 + 110, y + 264, 34, C.chalkLine, { align: 'left', drop: null });
  if (r.stickers > 0) { ic('sticker', W / 2 - 80, y + 326, 42); text(ctx, '+' + r.stickers * (r.doubled ? 2 : 1), W / 2 - 50, y + 328, 34, C.chalkLine, { align: 'left', drop: null }); }
  const by = y + 410;
  if (win && !endless) {
    const nextG = level!.g + 1, hasNext = nextG <= 30;
    bigBtn('r-next', W / 2 - 310, by, 300, 112, C.go, hasNext ? 'next' : 'map', '', () => hasNext ? (pre = null, startLevel(LEVELS[nextG - 1])) : go('map'), true);
    if (r.stickers > 0 && !r.doubled) rewardBtn('r-x2', W / 2 + 10, by, 300, 112, () => ic('x2', 0, 0, 56), async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { save.stickers += r.stickers; r.doubled = true; persist(); sfx.slap(); } });
    else iconBtn('r-retry', W / 2 + 10, by + 8, 96, C.secondary, 'retry', () => startLevel(level!));
    iconBtn('r-map', W / 2 + 250, by + 8, 96, C.secondary, 'map', () => go('map'));
  } else {
    // defeat: retry first and biggest
    bigBtn('r-retry', W / 2 - 310, by, 380, 112, C.go, 'retry', '', () => startLevel(level!, 0, endless), true);
    iconBtn('r-map', W / 2 + 110, by + 8, 96, C.secondary, 'map', () => go('map'));
    iconBtn('r-album', W / 2 + 220, by + 8, 96, C.reward, 'sticker', () => go('album'));
  }
}
function drawSettings(dt: number) {
  settingsT += dt; modal(); dim(0.5); const k = intro(settingsT, 0, 0.35); ctx.save(); ctx.translate(W / 2, H / 2); ctx.scale(k, k); ctx.translate(-W / 2, -H / 2);
  lidPanel(ctx, W / 2 - 280, 190, 560, 320); text(ctx, t('settings'), W / 2, 260, 40, '#fff', { drop: '#8a5a2e' });
  slate(ctx, W / 2 - 220, 300, 440, 110); ic(isMuted() ? 'soundOff' : 'sound', W / 2 - 150, 355, 60);
  button(ctx, 'set-snd', W / 2 + 20, 320, 140, 70, isMuted() ? C.locked : C.go, toggleSound, (cx, cy) => ic(isMuted() ? 'close' : 'check', cx, cy, 40));
  iconBtn('set-x', W / 2 + 230, 170, 64, C.primary, 'close', () => { settingsOpen = false; });
  ctx.restore();
}

// ---------------------------------------------------------------- sounds from sim events
function sounds(evs: ReturnType<Sim['drainEvents']>) {
  for (const e of evs) switch (e.t) {
    case 'fire': ({ soldier: sfx.cork, catapult: sfx.clack, bubble: sfx.blub, band: sfx.twang, hangar: sfx.whoosh } as Record<TowerKind, () => void>)[e.tower.kind](); break;
    case 'kill': sfx.pop(); break; case 'leak': sfx.leak(); break; case 'build': sfx.ratchet(); break; case 'sell': sfx.coin(); break;
    case 'wave': if (e.n > 1) sfx.horn(); break; case 'drop': sfx.boom(); break;
  }
}

// ---------------------------------------------------------------- loop
let last = 0;
function frame(ts: number) {
  requestAnimationFrame(frame); const dt = Math.min(0.1, (ts - last) / 1000); last = ts; now += dt; sceneT += dt;
  const k = cv.width / W; ctx.setTransform(k, 0, 0, k, 0, 0); beginFrame();
  switch (scene) { case 'loading': drawLoading(dt); break; case 'title': drawTitle(dt); break; case 'map': drawMap(dt); break; case 'album': drawAlbum(dt); break; case 'level': drawLevel(dt); break; case 'result': drawResult(dt); break; }
  if (settingsOpen) drawSettings(dt);
  drawLid(ctx, dt);
  if (adBusy) dim(0.5);
  void screw; void JUNK;
}

(async () => {
  requestAnimationFrame(t0 => { last = t0; frame(t0); });
  platform = await createPlatform(); await platform.init();
  setLang(platform.language()); document.documentElement.lang = platform.language();
  const rt = document.getElementById('rotate-text'); if (rt) rt.textContent = t('rotate');
  platform.onAdStart = () => { setAdMuted(true); adBusy = true; }; platform.onAdEnd = () => setAdMuted(false);
  loadSave(platform); setMuted(save.muted);
  await loadFonts(p => { loadP = Math.max(loadP, p * 0.2); });
  await preloadAll(p => { loadP = Math.max(loadP, 0.2 + p * 0.75); });
  loadDone = true; platform.loadingFinished();
  if (import.meta.env.DEV || import.meta.env.VITE_TEST) (window as any).__kule = { get sim() { return sim; }, get scene() { return scene; }, save, LEVELS, startLevel: (g: number) => startLevel(LEVELS[g - 1]), go: (s: Scene) => { scene = s; sceneT = 0; }, setPaused, set speed(v: number) { speed = v; }, get view() { return view; }, set page(p: number) { page = p; } };
})();
