# Zıp Sucuk / Sucuk Hop — features

Status from browser checks (Playwright via the game-qa skill) and the headless level solver (`npm run test:levels`), 2026-11-04.
**verified** = seen working in a browser run or proven by the headless solver; **not verified** = implemented but not checked end to end.

## Core mechanic (`src/game/world.ts`, tunables in `src/config.ts`)

- [x] verified: Soft-body sucuk (7 segments, soft weld joints) stands on one end and sways ±54°
- [x] verified: Hold (mouse / touch / Space / Up / W) to charge, release to hop along the lean; aim dots + charge bar while holding
- [x] verified: The end that lands on a sticky surface (counter, board, shelf, cabinet) sticks
- [x] verified (headless): A sucuk lying still stands up by itself (no softlock)
- [x] verified (headless): Butter is slippery, jelly bounces; neither sticks on landing
- [x] verified (headless): Grill / knife / soup send it back to the last checkpoint flag; flags set the checkpoint
- [x] verified: Reaching the hot-dog bun wins; result screen shows stars, jumps, falls, coins
- [x] verified (headless): Moving and spinning boards carry the sucuk
- [ ] not verified: Feel tuning with a human player (sway speed, charge time, launch speed)

## Levels (`src/game/levels.ts`)

- [x] verified: 6 levels (counter, shelves, butter & jelly, grill & moving board, spinner & knives, fridge climb), all solved by the beam-search bot in 3/6/5/3/5/8 jumps (par 4/7/6/5/7/10)
- [ ] not verified: Difficulty curve for real players

## Meta (`src/main.ts`, `src/game/save.ts`)

- [x] verified: Title (attract mode), level select with stars/locks, skins shop (5 skins), pause, result screens render without console errors
- [ ] not verified: Buying/equipping a skin through clicks persists after reload (`zipsucuk.save.v1`)
- [ ] not verified: Level unlock chain across a full playthrough
- [ ] not verified: Daily reward (values in config, screen not built yet)

## Platform and ads (`src/platform/`, copied from ay-kargo)

- [x] verified: Builds for crazygames, poki, gd, none (~70 KB zips)
- [ ] not verified: commercialBreak before a level, rewarded x2 coins, rewarded "skip level" (pause, after 5 falls) on a real portal
- [x] verified: Test hooks (`window.__GAME__`, `render_game_to_text()`) only in dev/test builds

## Audio, input, layout

- [ ] not verified: Synthesized sounds and music (not listened to by a human)
- [ ] not verified: Touch play on a real phone; rotate hint in portrait
- [x] verified: 60 fps unthrottled in headless Chromium (avg 16.8 ms per frame)

## UI / art redesign (`src/ui/`, `src/game/render.ts`, `src/game/backdrop.ts`, `src/main.ts`)

- [x] verified: Theme tokens + bundled fonts (Erica One, Outfit; local files, no network)
- [x] verified: Candy buttons with press state and sounds; SVG icon set (26 icons), no emoji
- [x] verified: Loading bar, title, world-paged level select, settings, skins, pause, result with star/coin sequence, fall reaction, HUD with safe areas, iris transitions
- [x] verified: Per-world backdrops (kitchen, pantry, stove, freezer) with vignette; platforms drawn as objects matching collider size
- [x] verified: Click-through flow with real pointer input; 60 fps; no console errors at 1280x720, 844x390, 640x360
- [ ] not verified: Safe-area insets on a notched phone; reduced-motion on a real device

## Known follow-ups

- Translations exist for 8 languages (`src/i18n.ts`); check them on screen.
- Store thumbnails (`store/thumbnails/`) not made yet.
- More levels; daily reward screen.
