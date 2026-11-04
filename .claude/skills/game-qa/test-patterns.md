# Test Patterns

Fixture, boot, input and win/lose tests for this repo's games. Examples use ay-kargo (Canvas 2D + planck.js); for a DOM game (istasyon) replace the canvas selector and read state from `window.__GAME__` the same way.

## Fixture

```ts
// tests/fixtures.ts
import { test as base, expect } from '@playwright/test';

export const test = base.extend<{ gamePage: import('@playwright/test').Page; errors: string[] }>({
  errors: async ({}, use) => { await use([]); },
  gamePage: async ({ page, errors }, use) => {
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await page.addInitScript({ path: './tests/helpers/seed-random.js' });
    await page.goto('/');
    // canvas exists and the hook is up = booted
    await page.waitForFunction(() => !!(window as any).__GAME__ && !!document.querySelector('canvas'), null, { timeout: 10000 });
    await use(page);
  },
});
export { expect };

// ay-kargo helper: start a level directly instead of clicking through menus
export const startLevel = (page: import('@playwright/test').Page, world: number, index: number) =>
  page.evaluate(([w, i]) => { const g = (window as any).__GAME__; g.startRun(g.makeLevel(w, i)); }, [world, index]);
export const state = async (page: import('@playwright/test').Page) => JSON.parse(await page.evaluate(() => (window as any).render_game_to_text()));
```

## 1. Boot

```ts
test('boots to the title screen without errors', async ({ gamePage, errors }) => {
  expect(await gamePage.evaluate(() => (window as any).__GAME__.scene)).toBe('title');
  expect(errors).toEqual([]);
});
```

## 2. Input changes state

ay-kargo: Up/W = gas, Down/S = brake & reverse, Left/Right = rotate, Space = turbo.

```ts
test('holding gas moves the rover forward', async ({ gamePage }) => {
  await startLevel(gamePage, 0, 0);
  await gamePage.waitForFunction(() => (window as any).__GAME__.scene === 'drive');
  const x0 = await gamePage.evaluate(() => (window as any).__GAME__.sim.chassis.getPosition().x);
  await gamePage.keyboard.down('ArrowUp'); await gamePage.waitForTimeout(2000); await gamePage.keyboard.up('ArrowUp');
  const x1 = await gamePage.evaluate(() => (window as any).__GAME__.sim.chassis.getPosition().x);
  expect(x1 - x0).toBeGreaterThan(5);
});

test('tilt rotates the rover in the air', async ({ gamePage }) => {
  // lift the rover, hold Left for 1 s, expect a clear rotation (> 1 rad)
});
```

## 3. Win and lose

```ts
test('level 1 can be won by holding gas', async ({ gamePage }) => {
  await startLevel(gamePage, 0, 0);
  await gamePage.keyboard.down('ArrowUp');
  await gamePage.waitForFunction(() => (window as any).__GAME__.scene === 'result', null, { timeout: 90000 });
  await gamePage.keyboard.up('ArrowUp');
  expect(await gamePage.evaluate(() => (window as any).__GAME__.sim.state)).toBe('win');
});

test('doing nothing never wins', async ({ gamePage }) => {
  await startLevel(gamePage, 0, 0);
  await gamePage.waitForTimeout(15000);
  expect(await gamePage.evaluate(() => (window as any).__GAME__.sim.state)).not.toBe('win');
});
```

## 4. Faster than real time: drive the simulation headless

Physics and level generation in ay-kargo have no DOM dependency (`src/game/world.ts`, `levels.ts`), so balance sweeps can run in Node without a browser:

```bash
npx esbuild bot.ts --bundle --platform=node --format=esm --outfile=/tmp/bot.mjs && node /tmp/bot.mjs
```

```ts
import { Sim } from './src/game/world';
import { makeLevel } from './src/game/levels';
const s = new Sim(makeLevel(0, 0));
let t = 0; while (s.state === 'run' && t < 120) { s.update(1 / 60, { gas: true, brake: false, turbo: false }); t += 1 / 60; }
console.log(s.state, s.failReason, s.cratesLeft, s.coinsEarned);
```

Use this for difficulty/economy checks (e.g. "first upgrade affordable after two runs of level 1"), then confirm one case in the browser.
