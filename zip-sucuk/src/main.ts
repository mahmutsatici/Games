import { createPlatform } from './platform';
import type { Platform } from './platform/types';
import { setLang, t } from './i18n';
import { CFG } from './config';
import { LEVELS } from './game/levels';
import { Sim } from './game/world';
import { Camera, drawWorld, drawBackground, drawSausage, W, H, rr } from './game/render';
import { buttons, resetButtons, button, hit, text, panel, icon, Icon, Tone } from './game/ui';
import { loadSave, save, persist, levelOpen, buySkin } from './game/save';
import { initAudio, setMuted, setAdMuted, isMuted, music, sfx } from './game/audio';

type Scene = 'title' | 'levels' | 'play' | 'result' | 'skins';
const canvas = document.getElementById('c') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let platform: Platform;
let scene: Scene = 'title', sceneT = 0, paused = false, adBusy = false;
let sim: Sim | null = null, levelIdx = 0, earned = 0, doubled = false, shown = 0;
let demo: Sim | null = null; const cam = new Camera(), demoCam = new Camera();
let down = false; const keys = new Set<string>(); let pointerDown = false;

// ---------- layout ----------
function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2), sw = innerWidth, sh = innerHeight, s = Math.min(sw / W, sh / H);
  canvas.style.width = W * s + 'px'; canvas.style.height = H * s + 'px';
  const k = Math.min(dpr, 2560 / (W * s)); canvas.width = Math.round(W * s * k); canvas.height = Math.round(H * s * k);
}
addEventListener('resize', resize); resize();
const toLogical = (e: PointerEvent) => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; };

// ---------- input: one button (mouse / touch / Space / Up / W) ----------
const HOLD_KEYS = ['Space', 'ArrowUp', 'KeyW', 'Enter'];
addEventListener('keydown', e => { initAudio(); if (HOLD_KEYS.includes(e.code)) { e.preventDefault(); keys.add(e.code); }
  if (scene === 'play' && (e.code === 'Escape' || e.code === 'KeyP')) setPaused(!paused);
  if (scene === 'play' && e.code === 'KeyR' && !paused) restart();
  if (scene === 'title' && e.code === 'Space') go('levels'); });
addEventListener('keyup', e => keys.delete(e.code));
canvas.addEventListener('pointerdown', e => { initAudio(); canvas.focus(); if (adBusy) return; const p = toLogical(e);
  if (hit(p.x, p.y)) { sfx.click(); return; }
  if (scene === 'title') { go('levels'); return; }
  if (scene === 'play' && !paused) { pointerDown = true; canvas.setPointerCapture(e.pointerId); } });
const up = () => { pointerDown = false; };
canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
canvas.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden && scene === 'play') setPaused(true); });
addEventListener('blur', () => { if (scene === 'play') setPaused(true); });

// ---------- flow ----------
function go(s: Scene) { scene = s; sceneT = 0; pointerDown = false; }
function setPaused(p: boolean) { if (scene !== 'play' || !sim) return; paused = p; pointerDown = false; p ? platform.gameplayStop() : platform.gameplayStart(); }
async function ad<T>(fn: () => Promise<T>): Promise<T> { adBusy = true; try { return await fn(); } finally { adBusy = false; } }
async function startLevel(i: number, withAd = true) {
  platform.gameplayStop(); if (withAd) await ad(() => platform.commercialBreak());
  levelIdx = i; sim = new Sim(LEVELS[i]); cam.init = false; paused = false; doubled = false; shown = 0;
  go('play'); platform.gameplayStart(); music(true);
}
function restart() { if (sim) startLevel(levelIdx, false); }
function finish() {
  if (!sim) return; platform.gameplayStop();
  const id = LEVELS[levelIdx].id; earned = sim.coinsEarned; save.coins += earned;
  if ((save.stars[id] || 0) < sim.stars) save.stars[id] = sim.stars;
  if (!save.best[id] || sim.jumps < save.best[id]) save.best[id] = sim.jumps;
  if (sim.stars === 3) platform.happyMoment();
  persist(); go('result');
}

// ---------- ui helpers ----------
const CHIP = 'rgba(40,20,12,.72)';
function chip(x: number, y: number, w: number, h = 60) { rr(ctx, x, y, w, h, 20); ctx.fillStyle = CHIP; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,.16)'; ctx.stroke(); }
const iconBtn = (x: number, y: number, s: number, tone: Tone, ic: Icon, cb: () => void) => button(ctx, x, y, s, s, tone, cb, (cx, cy) => icon(ctx, ic, cx, cy, s * 0.6));
const coinBar = (x = 24, y = 20) => { chip(x, y, 190); icon(ctx, 'coin', x + 34, y + 30, 36); text(ctx, save.coins, x + 62, y + 31, 30, '#ffe27a', 'left'); };
const soundBtn = (x: number, y: number) => button(ctx, x, y, 64, 64, 'gray', () => { setMuted(!isMuted()); save.muted = isMuted(); persist(); }, (cx, cy) => icon(ctx, isMuted() ? 'soundOff' : 'sound', cx, cy, 36));
const stars3 = (cx: number, cy: number, n: number, size: number) => { for (let i = 0; i < 3; i++) icon(ctx, i < n ? 'star' : 'starOff', cx + (i - 1) * size * 1.15, cy + (i === 1 ? -size * 0.2 : 0), size); };
const dim = (a = 0.6) => { ctx.fillStyle = `rgba(20,8,4,${a})`; ctx.fillRect(0, 0, W, H); };

// ---------- scenes ----------
function drawTitle(dt: number) {
  // attract mode: the sucuk hops on level 1 by itself
  if (!demo || demo.state === 'win' || demo.center.x > 24) { demo = new Sim(LEVELS[0]); demoCam.init = false; }
  const lean = demo.swayLean, wantJump = !!demo.stuck && lean < -0.45 && lean > -0.75;
  demo.update(dt, wantJump || (demo.charging && demo.charge < 0.45));
  demoCam.follow(demo, dt); drawWorld(ctx, demo, demoCam, sceneT);
  const g = ctx.createLinearGradient(0, 0, 0, 300); g.addColorStop(0, 'rgba(40,16,8,.75)'); g.addColorStop(1, 'rgba(40,16,8,0)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, 300);
  const y = 130 + Math.sin(sceneT * 2.4) * 6;
  ctx.save(); ctx.translate(W / 2, y); ctx.rotate(Math.sin(sceneT * 1.3) * 0.03);
  rr(ctx, -320, -72, 640, 144, 36); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fill();
  rr(ctx, -320, -80, 640, 144, 36); const lg = ctx.createLinearGradient(0, -80, 0, 64); lg.addColorStop(0, '#c4402a'); lg.addColorStop(1, '#7d1f12'); ctx.fillStyle = lg; ctx.fill(); ctx.lineWidth = 6; ctx.strokeStyle = '#ffd9a8'; ctx.stroke();
  text(ctx, t('title'), 0, -8, 92, '#fff4e6'); ctx.restore();
  button(ctx, W / 2 - 130, 520, 260, 150, 'green', () => go('levels'), (cx, cy) => icon(ctx, 'play', cx, cy, 96), true);
  soundBtn(W - 88, 24);
}

function drawLevels() {
  drawBackground(ctx, 'counter', sceneT * 0.2, 0, sceneT); dim(0.25);
  coinBar(); soundBtn(W - 88, 20); iconBtn(W - 168, 20, 64, 'amber', 'garage', () => go('skins')); iconBtn(W - 248, 20, 64, 'gray', 'home', () => go('title'));
  text(ctx, t('levels'), W / 2, 60, 52, '#fff4e6');
  LEVELS.forEach((L, i) => {
    const col = i % 3, row = Math.floor(i / 3), x = 190 + col * 310, y = 130 + row * 270, open = levelOpen(i), st = save.stars[L.id] || 0;
    panel(ctx, x, y, 280, 240);
    button(ctx, x + 40, y + 30, 200, 120, open ? (st ? 'green' : 'amber') : 'gray', () => { if (open) startLevel(i); }, (cx, cy) => open ? text(ctx, L.id, cx, cy, 64) : icon(ctx, 'lock', cx, cy, 60), open && !st);
    if (open) { stars3(x + 140, y + 190, st, 30); if (save.best[L.id]) { icon(ctx, 'up', x + 40, y + 215, 22, '#cfd6f5'); text(ctx, save.best[L.id], x + 56, y + 216, 20, '#cfd6f5', 'left'); } }
  });
}

function drawSkins() {
  drawBackground(ctx, 'counter', 0, 0, sceneT); dim(0.35);
  coinBar(); iconBtn(W - 100, 20, 64, 'green', 'back', () => go('levels'));
  text(ctx, t('skins'), W / 2, 60, 52, '#fff4e6');
  CFG.skins.forEach((s, i) => {
    const x = 60 + i * 236, y = 150, owned = save.owned.includes(s.id), on = save.skin === s.id;
    panel(ctx, x, y, 216, 400);
    // preview: a small standing sausage drawn with the skin colours
    ctx.lineCap = 'round'; const px = x + 108, py0 = y + 250, py1 = y + 90 + Math.sin(sceneT * 3 + i) * 6;
    for (const [w, c] of [[64, s.dark], [56, s.body]] as const) { ctx.strokeStyle = c; ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(px, py0); ctx.quadraticCurveTo(px + 14 * Math.sin(sceneT * 2 + i), (py0 + py1) / 2, px, py1); ctx.stroke(); }
    ctx.strokeStyle = s.light; ctx.lineWidth = 18; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(px - 10, py0 - 6); ctx.lineTo(px - 10, py1 + 6); ctx.stroke(); ctx.globalAlpha = 1;
    for (const k of [-1, 1]) { ctx.fillStyle = '#fff'; ctx.strokeStyle = '#2a120a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px + k * 12, py1 + 14, 10, 0, 7); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#1a0a05'; ctx.beginPath(); ctx.arc(px + k * 12 + 2, py1 + 16, 5, 0, 7); ctx.fill(); }
    button(ctx, x + 20, y + 300, 176, 76, on ? 'blue' : owned ? 'green' : save.coins >= s.cost ? 'amber' : 'gray', () => {
      if (owned) { save.skin = s.id; persist(); } else if (buySkin(s.id)) sfx.coin(); },
      (cx, cy) => { if (on) icon(ctx, 'check', cx, cy, 40); else if (owned) icon(ctx, 'play', cx, cy, 36); else { icon(ctx, 'coin', cx - 36, cy, 34); text(ctx, s.cost, cx - 14, cy + 1, 30, '#fff', 'left'); } });
  });
}

function drawPlay(dt: number) {
  const s = sim!;
  down = !paused && !adBusy && (pointerDown || [...keys].some(k => HOLD_KEYS.includes(k)));
  if (!paused && !adBusy) { s.update(dt, down); cam.follow(s, dt); if (s.state === 'win' && s.winT > 1.2) finish(); }
  drawWorld(ctx, s, cam, sceneT);
  // HUD
  chip(16, 16, 150); text(ctx, LEVELS[levelIdx].id, 46, 47, 30, '#ffd9a8'); icon(ctx, 'flag', 120, 46, 34);
  chip(178, 16, 170); icon(ctx, 'up', 212, 46, 34); text(ctx, `${s.jumps}/${s.L.par}`, 238, 47, 30, s.jumps <= s.L.par ? '#fff' : '#ffb3a0', 'left');
  chip(360, 16, 140); icon(ctx, 'coin', 394, 46, 34); text(ctx, s.coinsRun, 420, 47, 30, '#ffe27a', 'left');
  iconBtn(W - 160, 16, 64, 'amber', 'retry', () => restart());
  iconBtn(W - 84, 16, 64, 'gray', 'pause', () => setPaused(true));
  // charge meter around the button-less screen: a bar at the bottom
  if (s.charging) { rr(ctx, W / 2 - 160, H - 44, 320, 20, 10); ctx.fillStyle = 'rgba(40,20,12,.6)'; ctx.fill(); rr(ctx, W / 2 - 160, H - 44, 320 * s.power, 20, 10); ctx.fillStyle = s.power > 0.9 ? '#ff7a2f' : '#ffd23a'; ctx.fill(); }
  // first-level hint: hold, then release
  if (levelIdx === 0 && s.jumps < 2 && !paused) { const pulse = 0.85 + 0.15 * Math.sin(sceneT * 5); chip(W / 2 - 230, H - 120, 460, 70);
    icon(ctx, 'down', W / 2 - 190, H - 85, 34 * pulse); text(ctx, t('tapHold'), W / 2 + 10, H - 84, 26, '#fff4e6'); }
  if (paused) {
    dim(0.6); panel(ctx, W / 2 - 330, 150, 660, 370); text(ctx, t('paused'), W / 2, 218, 58);
    button(ctx, W / 2 - 290, 280, 170, 170, 'green', () => setPaused(false), (cx, cy) => icon(ctx, 'play', cx, cy, 86));
    button(ctx, W / 2 - 85, 280, 170, 170, 'amber', () => restart(), (cx, cy) => icon(ctx, 'retry', cx, cy, 86));
    button(ctx, W / 2 + 120, 280, 170, 170, 'blue', () => { platform.gameplayStop(); music(false); go('levels'); }, (cx, cy) => icon(ctx, 'home', cx, cy, 86));
    // stuck? after a few falls a rewarded "skip level" appears (not green, clapper icon)
    if (s.falls >= 5 && levelIdx < LEVELS.length - 1) button(ctx, W / 2 - 110, 470, 220, 90, 'amber', async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { const id = LEVELS[levelIdx].id; if (!save.stars[id]) save.stars[id] = 1; persist(); startLevel(levelIdx + 1, false); } },
      (cx, cy) => { icon(ctx, 'clapper', cx - 40, cy, 54); icon(ctx, 'next', cx + 44, cy, 50); });
  }
}

function drawResult(dt: number) {
  const s = sim!; drawWorld(ctx, s, cam, sceneT); dim(0.6);
  panel(ctx, 270, 70, 740, 580);
  const ns = Math.min(s.stars, Math.floor(sceneT * 2.5)); if (ns > (drawResult as any).ls) sfx.star(ns); (drawResult as any).ls = ns; stars3(W / 2, 150, ns, 84);
  shown = Math.min(earned * (doubled ? 2 : 1), shown + dt * Math.max(30, earned * 1.5));
  icon(ctx, 'up', W / 2 - 150, 255, 50); text(ctx, `${s.jumps}`, W / 2 - 112, 257, 52, s.jumps <= s.L.par ? '#9cf09c' : '#fff', 'left');
  icon(ctx, 'retry', W / 2 + 60, 255, 46, '#ffb3a0'); text(ctx, `${s.falls}`, W / 2 + 96, 257, 52, '#fff', 'left');
  icon(ctx, 'coin', W / 2 - 100, 345, 66); text(ctx, `+${Math.floor(shown)}`, W / 2 - 60, 347, 66, '#ffe27a', 'left');
  const last = levelIdx >= LEVELS.length - 1, bw = 230, rew = !doubled && earned > 0;
  button(ctx, rew ? W / 2 - bw - 12 : W / 2 - bw / 2, 430, bw, 140, 'green', () => last ? go('levels') : startLevel(levelIdx + 1), (cx, cy) => icon(ctx, last ? 'home' : 'next', cx, cy, 86), true);
  if (rew) button(ctx, W / 2 + 12, 430, bw, 140, 'amber', async () => { const ok = await ad(() => platform.rewardedBreak()); if (ok) { save.coins += earned; doubled = true; persist(); sfx.coin(); } }, (cx, cy) => { icon(ctx, 'clapper', cx - 44, cy, 64); icon(ctx, 'x2', cx + 50, cy, 56, '#fff'); });
  iconBtn(310, 584, 60, 'amber', 'retry', () => startLevel(levelIdx)); iconBtn(W - 370, 584, 60, 'blue', 'home', () => { music(false); go('levels'); });
}

// ---------- loop ----------
let last = 0;
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000); last = now; sceneT += dt;
  const k = canvas.width / W; ctx.setTransform(k, 0, 0, k, 0, 0); resetButtons();
  switch (scene) { case 'title': drawTitle(dt); break; case 'levels': drawLevels(); break; case 'skins': drawSkins(); break; case 'play': drawPlay(dt); break; case 'result': drawResult(dt); break; }
  if (adBusy) dim(0.5);
  void drawSausage; void buttons;
}

// ---------- boot ----------
(async () => {
  platform = await createPlatform(); await platform.init();
  setLang(platform.language()); document.documentElement.lang = platform.language();
  const rt = document.getElementById('rotate-text'); if (rt) rt.textContent = t('rotate');
  platform.onAdStart = () => { setAdMuted(true); adBusy = true; }; platform.onAdEnd = () => setAdMuted(false);
  loadSave(platform); setMuted(save.muted);
  // test hooks: dev and test builds only (game-qa contract), never in portal builds
  if (import.meta.env.DEV || import.meta.env.VITE_TEST) {
    const w = window as any;
    w.__GAME__ = { get scene() { return scene; }, get sim() { return sim; }, save, LEVELS, startLevel: (i: number) => startLevel(i, false), go, setPaused };
    w.render_game_to_text = () => {
      const s = sim; if (scene !== 'play' && scene !== 'result' || !s) return JSON.stringify({ coords: 'world metres, x right, y up', mode: scene });
      const c = s.center, v = s.velocity;
      return JSON.stringify({ coords: 'world metres, x right, y up', mode: s.state === 'win' ? 'win' : paused ? 'paused' : 'playing', level: LEVELS[levelIdx].id,
        sucuk: { x: +c.x.toFixed(2), y: +c.y.toFixed(2), vx: +v.x.toFixed(2), vy: +v.y.toFixed(2), standing: !!s.stuck, lean: +s.swayLean.toFixed(2), charging: s.charging, power: +s.power.toFixed(2) },
        jumps: s.jumps, par: s.L.par, falls: s.falls, coins: s.coinsRun, checkpoint: s.checkpoint, finish: s.L.finish,
        coinsLeft: s.coins.filter(k => !k.taken).length });
    };
  }
  requestAnimationFrame(t0 => { last = t0; frame(t0); platform.loadingFinished(); });
})();
