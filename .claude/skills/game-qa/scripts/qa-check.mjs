#!/usr/bin/env node
// Quick local QA check for a running game: screenshot + state JSON + console errors + frame-time sample.
// Local only: it talks to the URL you pass (normally localhost) and writes files to --out. Nothing is uploaded.
// Usage: node qa-check.mjs --url http://localhost:5173 [--out dir] [--setup js] [--actions json] [--wait ms]
//        [--width 1280 --height 720] [--mobile] [--throttle 4]
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1] && !arr[i + 1].startsWith('--') ? arr[i + 1] : 'true']);
  return acc;
}, []));
if (!args.url || args.help) {
  console.log('usage: qa-check.mjs --url <url> [--out dir] [--setup js] [--actions json] [--wait ms] [--width n --height n] [--mobile] [--throttle n]');
  process.exit(args.help ? 0 : 1);
}

// Find Playwright: local node_modules first, then the global install (cloud sessions ship it globally).
async function loadPlaywright() {
  try { return await import('playwright'); } catch { /* fall through */ }
  const req = createRequire(join(process.cwd(), 'noop.js'));
  try { return req('playwright'); } catch { /* fall through */ }
  const globalRoot = execSync('npm root -g').toString().trim();
  return createRequire(join(globalRoot, 'noop.js'))('playwright');
}

const { chromium, devices } = await loadPlaywright();
const out = resolve(args.out || 'qa-out'); mkdirSync(out, { recursive: true });
const errors = [];
const browser = await chromium.launch({ headless: true });
const ctxOpts = args.mobile ? { ...devices['Pixel 5 landscape'] } : { viewport: { width: +(args.width || 1280), height: +(args.height || 720) }, deviceScaleFactor: 1 };
const context = await browser.newContext(ctxOpts);
const page = await context.newPage();
page.on('pageerror', e => errors.push({ type: 'pageerror', text: e.message }));
page.on('console', m => { if (m.type() === 'error') errors.push({ type: 'console', text: m.text() }); });

const t0 = Date.now();
await page.goto(args.url);
await page.waitForTimeout(+(args.wait || 1500));
const bootMs = Date.now() - t0;
await page.screenshot({ path: join(out, 'shot-boot.png') });

if (args.throttle) { const cdp = await context.newCDPSession(page); await cdp.send('Emulation.setCPUThrottlingRate', { rate: +args.throttle }); }
if (args.setup) { await page.evaluate(src => { (0, eval)(src); }, args.setup); await page.waitForTimeout(400); }

// sample rAF intervals while actions run
await page.evaluate(() => { const w = window; w.__qaFrames = []; let l = 0; const f = t => { if (l) w.__qaFrames.push(t - l); l = t; if (w.__qaFrames.length < 3000) requestAnimationFrame(f); }; requestAnimationFrame(f); });
const actions = args.actions ? JSON.parse(args.actions) : [];
for (const a of actions) {
  for (const k of a.keys || []) await page.keyboard.down(k);
  await page.waitForTimeout(a.ms || 500);
  for (const k of a.keys || []) await page.keyboard.up(k);
}
await page.waitForTimeout(300);
await page.screenshot({ path: join(out, 'shot-final.png') });

const state = await page.evaluate(() => {
  const w = window;
  if (typeof w.render_game_to_text === 'function') { try { return JSON.parse(w.render_game_to_text()); } catch (e) { return { error: String(e) }; } }
  const g = w.__GAME__ || w.__game;
  if (!g) return { note: 'no __GAME__ / __game hook and no render_game_to_text()' };
  const s = g.sim;
  return {
    note: 'summary of the legacy __game hook (add render_game_to_text for a richer state)',
    scene: g.scene,
    sim: s ? { state: s.state, failReason: s.failReason, x: +s.chassis.getPosition().x.toFixed(2), speed: +s.speed.toFixed(2), cratesLeft: s.cratesLeft, crates: s.L.crates, coinsRun: s.coinsRun, energy: +s.energy.toFixed(2) } : null,
  };
});
const ft = await page.evaluate(() => (window.__qaFrames || []).slice());
ft.sort((a, b) => a - b);
const frames = ft.length ? { count: ft.length, avg: +(ft.reduce((a, b) => a + b, 0) / ft.length).toFixed(1), p95: +ft[Math.floor(ft.length * 0.95)].toFixed(1), max: +ft[ft.length - 1].toFixed(1), over33: ft.filter(x => x > 33.5).length } : null;

writeFileSync(join(out, 'state.json'), JSON.stringify(state, null, 2));
writeFileSync(join(out, 'frames.json'), JSON.stringify(frames, null, 2));
if (errors.length) writeFileSync(join(out, 'errors.json'), JSON.stringify(errors, null, 2));
await browser.close();

console.log(JSON.stringify({ url: args.url, bootMs, out, errors: errors.length, frames, state }, null, 2));
process.exit(errors.length ? 2 : 0);
