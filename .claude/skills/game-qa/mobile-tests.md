# Mobile Input & Layout Tests

Use the `phone-landscape` project (Pixel 5 landscape, touch enabled). The games use a 1280x720 logical canvas scaled to fit; portrait shows a "rotate device" hint.

```ts
test('canvas fits the landscape viewport', async ({ gamePage }) => {
  const r = await gamePage.locator('canvas').boundingBox();
  const vp = gamePage.viewportSize()!;
  expect(r!.width).toBeLessThanOrEqual(vp.width + 1);
  expect(Math.max(r!.width / vp.width, r!.height / vp.height)).toBeGreaterThan(0.95); // letterboxed, not tiny
});

test('portrait shows the rotate hint', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto('/');
  await expect(page.locator('#rotate')).toBeVisible();
});

test('touch pedals drive the rover', async ({ gamePage }) => {
  // ay-kargo: right half bottom = gas pad. Tap-and-hold with touchscreen down/up:
  await gamePage.evaluate(() => { const g = (window as any).__GAME__; g.setTouch(true); g.startRun(g.makeLevel(0, 0)); });
  const box = (await gamePage.locator('canvas').boundingBox())!;
  const x = box.x + box.width * 0.93, y = box.y + box.height * 0.88;
  await gamePage.mouse.move(x, y); await gamePage.mouse.down(); await gamePage.waitForTimeout(2000); await gamePage.mouse.up();
  expect(await gamePage.evaluate(() => (window as any).__GAME__.sim.distance)).toBeGreaterThan(3);
});
```

Notes

- Pads are ~90 css px; check they don't overlap HUD chips at 740x360.
- The HUD must stay readable at a 360 px tall landscape screen: take a screenshot at that size and judge it.
