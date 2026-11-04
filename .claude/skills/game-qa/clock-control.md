# Clock Control for Frame-Precise Testing

Playwright's Clock API controls `Date`, `performance.now()` and `requestAnimationFrame`, so a game loop that uses rAF timestamps (both our games do) can be advanced exactly.

```ts
test('rover falls under gravity for exactly 1 s', async ({ page }) => {
  await page.clock.install();            // before goto
  await page.goto('/');
  await page.clock.runFor(500);          // let it boot
  await page.evaluate(() => { const g = (window as any).__GAME__; g.startRun(g.makeLevel(0, 0)); });
  await page.clock.runFor(100);
  const y0 = await page.evaluate(() => (window as any).__GAME__.sim.chassis.getPosition().y);
  await page.clock.runFor(1000);
  const y1 = await page.evaluate(() => (window as any).__GAME__.sim.chassis.getPosition().y);
  expect(y1).not.toBe(y0);
});
```

Notes

- `page.clock.install()` must run before `page.goto()`.
- ay-kargo clamps a frame's dt to 0.1 s and runs at most 4 physics steps per frame, so advance in small chunks (e.g. `runFor(16)` in a loop) when you need every physics step to happen.
- For balance and long runs, prefer the headless `Sim` in Node (see `test-patterns.md`): it is deterministic and much faster than real time.
