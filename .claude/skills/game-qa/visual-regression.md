# Visual Regression, Performance and Determinism

## Screenshot baselines (static screens)

Menus are stable enough for baselines: title, map, briefing, garage, result, pause.

```ts
test('garage renders', async ({ gamePage }) => {
  await gamePage.evaluate(() => { const g = (window as any).__GAME__; g.save.coins = 640; g.go('garage'); });
  await gamePage.waitForTimeout(300);
  await expect(gamePage.locator('canvas')).toHaveScreenshot('garage.png', { maxDiffPixels: 300 });
});
```

Gameplay screenshots are not stable (particles, camera smoothing). For those, take a screenshot and judge it (or use the MCP server). Don't assert on them unless the clock is controlled and RNG is seeded.

Canvas games ignore CSS masks. To freeze animation for a baseline, add a test-only flag the game reads (e.g. `window.__TEST_MODE__` → no particles, fixed twinkle phase).

## Seeded randomness

Level layout is already seeded by level number. Pin the remaining `Math.random()` calls (particles, timing jitter) before the page loads:

```js
// tests/helpers/seed-random.js — mulberry32, injected with page.addInitScript()
(function () {
  let seed = 42;
  Math.random = function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
})();
```

## Frame-time check

Measure frame intervals while driving, not just average FPS. Budget: no frame over 33 ms in normal driving on a mid-range phone profile.

```ts
test('frame time stays in budget', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 }); // mid-range phone
  // start a level, hold gas ~8 s, then collect frame intervals:
  const ft = await page.evaluate(() => new Promise<number[]>(res => { const a: number[] = []; let l = 0;
    const f = (t: number) => { if (l) a.push(t - l); l = t; a.length < 400 ? requestAnimationFrame(f) : res(a); }; requestAnimationFrame(f); }));
  ft.sort((a, b) => a - b);
  console.log('avg', ft.reduce((a, b) => a + b, 0) / ft.length, 'p95', ft[Math.floor(ft.length * 0.95)], 'max', ft[ft.length - 1]);
});
```

ay-kargo also records `__game.frameTimes` (rAF intervals) and `__game.workTimes` (time inside the frame callback), which separate JS cost from rasterisation. Headless Chromium rasterises canvas on the CPU, so throttled numbers are pessimistic; always report them together with the unthrottled numbers.

To profile: CDP `Profiler.start/stop` for JS hot spots, `Tracing` with `devtools.timeline` to see raster/commit (`LayerTreeHost::DoUpdateLayers`) time.

## Load and size

- First interactive < 10 s: time from `goto` to the boot condition.
- Portal zip < 8 MB: `npm run build:portals` prints sizes.
