# Gameplay Invariants

Every game must keep passing these. They check that the game is actually playable, not just that it renders. Read the game's code (and `src/config.ts`, `features.md`) to pick real thresholds instead of trivial `> 0` checks.

## 1. Progress is possible

Normal input earns the game's reward. ay-kargo: holding gas on level 1 reaches the finish with at least one crate, and `coinsEarned > 0`.

## 2. A fail condition triggers

ay-kargo has four: `flip` (upside down > 1.4 s), `battery` (empty and stopped), `crates` (all crates lost), `wheel` (wheels torn off by slimes). Each needs a test that provokes it, e.g. flip by lifting and rotating the chassis through `__GAME__.sim`, battery by setting `sim.battery = 0`.

## 3. No-input never wins

Doing nothing must not complete a level. If it does, that is a bug; never write a passing test for a no-input win.

## 4. `render_game_to_text()` is valid

```ts
const s = JSON.parse(await page.evaluate(() => (window as any).render_game_to_text()));
expect(s).toHaveProperty('mode');
expect(s).toHaveProperty('coords');
```

## 5. Design intent: mechanics are strong enough to matter

Check magnitudes, not just existence. Examples from ay-kargo:

- Tilt: one second of Left in the air rotates the rover by more than 1 rad.
- A crate is lost **only** after it leaves the bed and touches the ground, and then it is removed (shattered) at once; a crate that falls back into the bed is not lost.
- A slime hit above the crush speed squashes it; below it, the slime latches on and the rover's top speed drops; two latched slimes on one wheel tear it off within a few seconds; turbo shakes them off.
- Economy: two runs of level 1 afford the first upgrade (cost 50), one run does not.

Thresholds live in the game's `src/config.ts`; read them from there in tests rather than hard-coding.

## 6. Entity interaction audit

Read the collision/contact code (`world.ts` contact listeners, proximity checks) and map entity-to-entity interactions. Flag a moving, visible entity that affects one thing but not another the player would expect it to (e.g. slimes passing through crates by design is fine but must be documented). Add a `// QA FLAG:` comment in the spec; it is informational.

## 7. Mute and pause

- Mute is stored in the save (`save.muted`) and toggled by the speaker button; assert the flag flips and the master gain follows.
- Pause (Esc/P or the pause button) stops the simulation: `sim.t` must not advance while paused, and `platform.gameplayStop()` is called.

## 8. Hard rules

- No network requests other than the selected portal SDK: record `page.on('request')` during a run of the `none` build and assert every URL is same-origin.
- Saves go through the platform layer only (`Platform.getItem/setItem`), and the game keeps working when `localStorage` throws (incognito).
- Gameplay screens are text-free (icons and numbers); menu text comes from `src/i18n.ts`.
