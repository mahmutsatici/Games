# Decisions

Decisions already made for this repo. Add new ones at the end with a date and a one-line reason; change an old one only by adding a new entry that supersedes it.

## Foundations

1. **Monorepo.** All games live in one repository, one folder per game (`ay-kargo/`, later `istasyon/`), each a self-contained Vite + TypeScript project with its own `package.json`.
2. **Zero server and database cost.** Games are static files. No backend, no database, no server-side saves or leaderboards. Hosting is the portals plus GitHub Pages for the `none` build.
3. **Portals:** CrazyGames, Poki, GameDistribution, Playgama, itch.io. itch.io and GitHub Pages use the `none` build (no ads).
4. **One platform layer with per-portal adapters.** Games talk only to `src/platform/types.ts` (`Platform`: init, loadingFinished, gameplayStart/Stop, commercialBreak, rewardedBreak, getItem/setItem, onAdStart/onAdEnd, happyMoment, language). Adapters: `none`, `crazygames`, `poki`, `gd`; the portal is chosen at build time with `VITE_PORTAL`. Adapters never throw and fall back to no-ads if the SDK fails to load within ~6 s.
5. **Only portal SDK ads.** No other ad network, no analytics, no external links, no Google products.
6. **Text-free gameplay** (icons and numbers). Menus are translated in 8 languages via `src/i18n.ts`: en, de, fr, es, pt, tr, ru, ja.
7. **Art in code, sound synthesized.** Canvas 2D / SVG drawing and WebAudio; no image/audio asset files except store thumbnails. Keeps the initial download far below the 8 MB Poki target.
8. **Ay Kargo feel baseline:** the approved prototype in `ay-kargo/reference/prototype.html`. Physics constants (rover, crates, motor, turbo, meteor, UFO) come from it; changes to the feel are compared against it.

## Ay Kargo (made during development, 2026-11-03)

9. **Gravity:** Moon 6.2 (prototype value), Mars 7.4, ice moon 6.6, instead of the design table's 4.0 / 6.5 / 5.0, because the prototype's 6.2 was the approved feel.
10. **Upgrades 0–8** (bumper 0–5, shield 0–3, turbo 0–5), cost ≈ 50 × 1.6^level; the prototype's 0–5 ranges are spread over these levels.
11. **Controls:** Up/W gas, Down/S brake & reverse, Left/Right (A/D) rotate the rover, Space/Shift turbo. Touch: tilt pads bottom-left, brake/gas/turbo bottom-right.
12. **A crate is lost only when it leaves the bed and touches the ground**, and it shatters at that moment (no debris on the road; caught crates are safe).
13. **Slimes do not block the rover physically.** Contact is detected by proximity: fast hits squash (coins), slow hits latch on (slower, more battery drain), two or more on one wheel tear it off, turbo shakes them off.
14. **Rendering for low-end devices:** sky as CSS background, detailed objects sprite-cached at run start, HUD cached, render resolution may step down once (never below 0.7) if frames are slow; full device resolution up to 2560 px wide otherwise.

## Tooling (2026-11-04)

15. **Project-level Claude Code setup committed to the repo:** skills in `.claude/skills/` (webapp-testing, frontend-design, algorithmic-art, canvas-design from anthropics/skills; game-qa adapted from game-creator; graphify), Playwright MCP in `.mcp.json` pinned to `@playwright/mcp@0.0.83` (published 2026-09-28, at least two weeks old when pinned). No reliance on user-level config.
16. **Testing is local only.** No test service, telemetry or uploads; test hooks belong in dev/test builds only (`window.__GAME__`, `render_game_to_text()`).

## Zip Sucuk / Sucuk Hop (2026-11-04)

17. **Second game: `zip-sucuk/`**, a web game inspired by "a weird game about sausage" (Madman's Cheese, Steam, 2026): one-button physics with an elastic sausage. Original name, art, levels and mechanics details; nothing copied.
18. **Mechanic:** the sucuk stands on one end and sways; hold to charge (sway slows), release to hop along its current lean; whichever END lands on a sticky surface sticks; a sucuk lying still stands up by itself (no softlock). Butter = slippery, jelly = bouncy (both never stick on landing), grill/knife = back to the last flag, falling into the soup = back to the last flag.
19. **Soft body:** 7 circle segments joined by soft weld joints; standing is held by springs that pull each segment onto the lean line (stable but jiggly) instead of a single PD torque (that toppled).
20. **Every level must be proven solvable** by the headless beam-search bot before shipping; par is set a little above the bot's jump count.
21. **Ad points:** commercialBreak when starting a level from menus/next; rewarded x2 coins on the result screen; rewarded "skip level" in the pause menu after 5 falls. Skins are bought with coins only.
22. **ay-kargo is frozen** until the owner says otherwise; shared code is copied into the new game, not refactored out of ay-kargo.

### Sucuk Hop UI redesign (2026-11-05)

23. **Fonts:** Erica One (titles) and Outfit (small text and all numbers, since Erica One digits blur at small sizes), both OFL, bundled under `zip-sucuk/src/ui/fonts/`; no web-font CDN.
24. **One style system** in `zip-sucuk/src/ui/theme.ts` (colour triples, radii, easing, reduced motion) and `widgets.ts` (candy buttons, board panels, ribbons, chips, toggles, iris, UI particles). Outline = darker shade of the object's own colour, never black. Rewarded buttons are purple with a clapper icon; continue/next is green and at least as large.
25. **No fail screen:** the game has no fail state, so a fall shows a short comic reaction instead of a "level failed" panel.
26. **Redesign is render-only:** `world.ts`, `levels.ts` and `config.ts` are unchanged; level solver results are identical before and after.

### Sucuk Hop: 20 levels (2026-11-05)

27. **20 levels in 4 worlds of 5**, grouped by place: Kitchen (counter), Pantry (shelves), Hot Stove, Freezer. `LEVELS` is built from `ORDER` (ids in play order); ids never change, so saved stars stay with their level. Menus show the position (1–20), not the id.
28. **Unlocking follows play order:** a level is open if the level before it in `ORDER` has stars, or it has stars itself (keeps old saves working after the reorder).
29. **The solver bot sets par:** par = the bot's jump count + 1–2. Tall sticky walls next to a jump target trap the sausage, so climbs reuse proven spacings (about 2.8 m up, 1–2 m sideways).
