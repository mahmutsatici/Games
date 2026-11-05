# Ay Kargo — features

Status is based on reading the code (2026-11-04) and on browser/headless checks run during development.
**verified** = seen working in a browser run (Playwright screenshot/state) or a headless `Sim` test; **not verified** = implemented in code but not checked end to end. Tick a feature only after verifying it in the browser.

## Core driving (`src/game/world.ts`)

- [x] verified: Rover on planck.js (chassis + 2 wheel joints, prototype constants), fixed 1/60 step with interpolation
- [x] verified: Level 1 completable by holding gas (3/3 crates, ~30 s, 43–48 coins)
- [x] verified: Controls Up/W gas, Down/S brake/reverse, Left/Right rotate (~1.7 rad in 1 s in the air), Space turbo
- [x] verified: Crate lost only when it leaves the bed and hits the ground; it shatters into planks
- [x] verified: Fail conditions flip, crates, wheel (headless); battery fail reached in a bot run
- [ ] not verified: Glass crates break on hard impacts (later levels)
- [x] verified: Perfect-landing bonus and landing dust/shake (seen in runs)
- [ ] not verified: Anti-flip assist feels right to a human player

## Terrain and worlds (`src/game/levels.ts`, `render.ts`)

- [x] verified: Seeded terrain per level: hills, bumps, opening hill + ramp, ramps every 80–150 m, ditches from level 3, crater bowls
- [x] verified: Coin lines/arcs and energy cells collected while driving
- [x] verified: Moon / Mars / ice moon look (screenshots)
- [ ] not verified: Mars dust storm overlay (moved to a CSS overlay; not re-checked visually)
- [x] verified: Ice patches drawn on the ice moon (screenshot); [ ] not verified: their low friction feel
- [ ] not verified: Endless mode (unlock after world 3, best distance saved)

## Hazards

- [x] verified: Slimes hop, squash on fast hits, latch on slow hits, tear off a wheel with 2+ latched, turbo shakes them off
- [x] verified: Meteors from level 5 (warning ring, falling rock with fire trail, crater, shockwave, debris)
- [x] verified: UFO tractor beam from level 8 (screenshot); [ ] not verified: escape-by-turbo timing
- [x] verified: Shield absorbs a meteor hit (bubble shown); [ ] not verified: rewarded "start with shield" flow on a real portal

## Meta game (`src/main.ts`, `src/game/save.ts`)

- [x] verified: Title (attract mode), map with world tabs and level road, briefing, garage, result, pause screens render
- [x] verified: Garage shows 8 upgrades with costs; [ ] not verified: buying through clicks persists after reload
- [ ] not verified: Save `aykargo.save.v1` survives reload; works when localStorage throws
- [ ] not verified: Daily reward 7-day streak logic across real days
- [ ] not verified: Stars per level and unlocking the next level/world in a full playthrough
- [ ] not verified: Menu texts in all 8 languages (`src/i18n.ts`) look right on screen

## Platform and ads (`src/platform/`)

- [x] verified: `none` adapter (rewarded resolves true for testing); builds for crazygames, poki, gd, none produce zips (~86 KB)
- [x] verified: CrazyGames build falls back to no-ads when the SDK is blocked
- [ ] not verified: CrazyGames / Poki / GameDistribution SDK calls against the official docs and a real portal sandbox
- [ ] not verified: commercialBreak on result → drive, rewarded double coins, rewarded recharge on a real portal
- [x] verified: GitHub Pages deploy of the `none` build (workflow green)

## Audio, input, layout

- [ ] not verified: Synthesized engine (gears/RPM) and effects sound right (never listened to by a human here)
- [x] verified: Touch pads render on touch devices; key hint on level 1 for keyboards
- [ ] not verified: Rotate hint in portrait on a real phone
- [x] verified: Crisp rendering at 1920x1080 (full-resolution backing store)

## Performance

- [x] verified: Unthrottled 60 fps, ~1 ms JS per frame (headless Chromium)
- [ ] not verified: "No frame over 33 ms at 4x CPU throttling": measured 38–45 fps in headless software rendering; needs a real mid-range phone

## UI and art redesign (`src/art/`, `src/ui/`, `src/game/render.ts`, `src/main.ts`)

- [x] verified: Soft cartoon diorama style: per-world palettes, outlined actors, calm parallax backgrounds (Moon, Mars, Ice moon)
- [x] verified: Bundled fonts (Fredoka, Nunito), SVG icon set (no emoji), hardware panels and physical buttons with press state and sounds
- [x] verified: Loading crate, title diorama, route map with world pages, settings, briefing, garage lift with visible upgrades, pause, delivery complete/failed, battery offer, daily reward, iris transitions
- [x] verified: Rover headlight eyes (look, blink, squint, wide, dizzy), crate rattle, slime googly eyes and splats, UFO pilot and beam, meteor streak, landing pad celebration
- [x] verified: HUD pieces and touch pedals respect safe-area insets; no overlaps at 640x360 and 1280x720
- [ ] not verified: Safe areas on a notched phone; 60 fps at 4x CPU throttle on a real phone

## Known follow-ups

- Move tunable numbers into `src/config.ts` (convention in CLAUDE.md).
- Replace the always-on `window.__game` hook with `window.__GAME__` + `render_game_to_text()` gated to dev/test builds (game-qa contract).
- Add a Playwright test suite (`tests/`) per the game-qa skill.
