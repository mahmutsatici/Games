---
name: game-qa
description: Local game QA with Playwright for this repo's HTML5 games (ay-kargo = Canvas 2D + planck.js, istasyon = Canvas/DOM) — boot checks, gameplay invariants, deterministic runs (seeded RNG, controlled clock), visual-regression screenshots, console-error and frame-time checks. Use when writing or running game tests, verifying a change in the browser, or debugging a failing check. Everything runs locally; nothing is uploaded.
license: MIT (adapted from OpusGameLabs/game-creator, see ATTRIBUTION.md)
compatibility: Node.js + Playwright with a local Chromium. No game engine required.
---

# Game QA with Playwright (local only)

You are the QA engineer for the games in this monorepo. Verify that a change actually works in a real browser: the game boots, input changes state, the player can win and lose, nothing logs errors, and the frame time stays inside budget. A passing `npm run typecheck` is **not** verification.

All testing is local: a Vite dev/preview server on localhost plus a local Chromium. Never send game state, screenshots or telemetry anywhere, never add analytics or third-party SDKs for testing, and mock portal SDK URLs with `page.route()` if a portal build is under test.

## Companion files

- `test-patterns.md` — fixture, boot test, input→state test, win/lose tests for our games
- `gameplay-invariants.md` — the invariants every game must keep passing
- `visual-regression.md` — screenshot baselines, freezing animation, performance and frame-time checks
- `clock-control.md` — Playwright Clock API for frame-precise runs
- `playwright-mcp.md` — interactive inspection through the project's Playwright MCP server (`.mcp.json`)
- `iterate-client.md` — `scripts/qa-check.mjs`, the quick check to run after every change
- `mobile-tests.md` — touch pedals, landscape layout, rotate hint

## Browser

Use the Chromium that is already installed. In cloud sessions it is at `/opt/pw-browsers/chromium` and `require('playwright')` finds it automatically. Do **not** run `npx playwright install` when a browser already exists. Only on a machine without any Chromium run `npx playwright install chromium` once.

## Testability contract (what a game must expose)

Expose test hooks **only in dev/test builds**, never in portal builds:

```ts
// src/main.ts
if (import.meta.env.DEV || import.meta.env.VITE_TEST) {
  (window as any).__GAME__ = { /* getters for scene, sim/state, save, helpers like startRun(level) */ };
  (window as any).render_game_to_text = () => JSON.stringify(stateForAgents());
  (window as any).advanceTime = (ms: number) => new Promise<void>(r => { const t0 = performance.now(); const f = () => performance.now() - t0 >= ms ? r() : requestAnimationFrame(f); requestAnimationFrame(f); });
}
```

### `render_game_to_text()`

A short JSON string an agent can reason about without reading pixels:

- `coords`: the coordinate system, e.g. `"world metres, x right, y up"` (planck) or `"css px, origin top-left"` (DOM)
- `mode`: `title | map | playing | paused | win | fail` (plus the fail reason)
- player state: position, velocity, angle, grounded/airborne
- the objective: progress/distance, crates or items remaining, coins this run, battery/energy
- visible entities only (hazards, pickups) with position and type
- no histories, no full save files

### Determinism

- Seeded RNG: our games already generate levels from a seed (`levels.ts` in ay-kargo). Anything that still calls `Math.random()` (particles, hazard timing jitter) can be pinned with the mulberry32 init script in `visual-regression.md`.
- Fixed physics step: ay-kargo steps planck at 1/60 s with interpolation, so `page.clock` control gives reproducible runs.

### Current state of the games

- **ay-kargo** exposes `window.__game` (lowercase) in every build: `scene`, `sim` (the planck `Sim`), `save`, `startRun(makeLevel(w, i))`, `go(scene)`, `setTouch()`, `setScale()`, `frameTimes`, `workTimes`. It has no `render_game_to_text()` yet. When you next touch `main.ts`, migrate this to the contract above (`__GAME__`, gated to dev/test) and keep `__game` working until tests are updated.
- **istasyon** is not in the repo yet. Apply the contract when it is added.

## Setting up the test suite in a game

```bash
cd <game> && npm install -D @playwright/test
```

`playwright.config.ts` (one per game):

```ts
import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests',
  reporter: [['list']],
  use: { baseURL: 'http://localhost:5173', screenshot: 'only-on-failure', trace: 'retain-on-failure' },
  expect: { toHaveScreenshot: { maxDiffPixels: 300, threshold: 0.3 } },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 720 } } },
    { name: 'phone-landscape', use: { ...devices['Pixel 5 landscape'] } },
  ],
  webServer: { command: 'npm run dev -- --port 5173 --strictPort', url: 'http://localhost:5173', reuseExistingServer: true, timeout: 30000 },
});
```

Scripts: `"test": "playwright test"`, `"test:update-snapshots": "playwright test --update-snapshots"`.

Layout: `tests/game.spec.ts` (boot, input, win/lose), `tests/visual.spec.ts` (screenshots), `tests/perf.spec.ts` (frame time), `tests/helpers/seed-random.js`.

## Workflow after every change

1. `npm run typecheck`
2. Start the dev server (or `vite preview` for a build) and run `node .claude/skills/game-qa/scripts/qa-check.mjs --url http://localhost:5173 ...` (see `iterate-client.md`), then look at the screenshot and read the state JSON and console errors.
3. For anything gameplay-related, run the relevant invariant from `gameplay-invariants.md`.
4. Before a release: full `npm test` plus the frame-time check in `visual-regression.md`.

## What not to automate

- Exact pixel positions of moving objects without clock control
- Pixel-exact screenshots of active gameplay (use the MCP server and judge visually)
- Audio output (assert the mute state and that the AudioContext exists instead)
- Portal SDK behaviour (mock the SDK URL; the `none` platform build needs no mocking)
- Subjective quality ("does it look good?"): screenshot it and judge it, don't assert it
