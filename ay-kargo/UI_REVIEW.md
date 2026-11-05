# Moon Cargo — UI review

Screenshots: `docs/ui-review/before/` (before the redesign) and `docs/ui-review/after/` (same file names).
Viewports: `desktop` 1280x720, `phone-landscape` 844x390, `small-landscape` 640x360 (360 px phones), `phone-portrait` 390x844. Portrait shows the rotate hint by design (CLAUDE.md: landscape game, portrait shows a rotate hint).
Captured with `audit.cjs` (Playwright, Chromium): loading, title, daily reward, map, briefing, garage, 10 s of driving with gas held on level 1 and level 5 (2 s / 5 s / 10 s), pause, delivery complete, crash moment, delivery failed, battery-empty offer.

## 1. Audit: what makes each screen feel non-game-like (before)

| Screen | Problems |
|---|---|
| Loading | None exists. The first frame is the title. On a slow connection the page is black until the bundle runs. |
| Title | The logo is system-font text on a navy rounded rectangle with an orange stroke (a web "card"). The three crate icons under it are tiny. The green PLAY button is a gradient rectangle with a white 1 px-style border and a plain triangle. The only other control is a lone grey sound square. Nothing idles except the demo run. No settings. |
| Daily reward | Seven identical dark rectangles in a row (calendar widget look). System-font numbers. The claim button is the same green gradient as everything else. |
| Map / level select | The world tabs are pill-shaped HTML-style toggles with tiny planet badges. Level nodes are gradient circles with white outlines. The road is a grey stroke with a dashed line. The ground is a gradient strip. The worlds don't look like different places: the same navy sky and a recoloured strip. |
| Briefing (pre-run) | A centred navy card on a 60% dim. Two flat "info chips" (crate count, distance) and a pinkish hazard row that reads as an error banner. The rewarded shield button is orange, so it looks more important than the green PLAY next to it. |
| Garage | A spreadsheet: 8 navy cards in a 2x4 grid, each with a small icon, a system-font label, grey pips and a full-width green price bar. The rover sits on a flat ellipse "pedestal" and nothing about it changes when you buy an upgrade. The stat bars are thin web progress bars. |
| Pause | A navy card with "Paused" in system font and three equal squares in green / orange / blue. No sound toggle. The game behind is only dimmed, and the card simply appears. |
| Delivery complete | The same navy card. Stars are drawn with a counter but have no pop, sound or particles beyond a tone. The coin count jumps up. The rewarded x2 button is orange (close to the brand primary) with a small clapper. Garage and map are tiny squares in the corners. |
| Delivery failed | The same card with grey stars, "0 / 3" in pink and a green retry. No reaction from the rover, and no garage suggestion at the same size. |
| Battery empty | A navy card with a red battery icon. The rewarded recharge is orange, the finish button green. OK on Poki rules, but it looks like a dialog box. |
| Settings | Does not exist (only the sound button). |
| HUD | Five dark translucent "chips" (battery, crates, progress, coins, pause) in system font with no outline. The battery is ten green rectangles, like a phone status bar. The progress bar is a thin blue web slider. The turbo bar sits under the battery and looks unrelated. On touch, the pedals are flat translucent circles. |
| Phone portrait | A plain dark page with a thin white phone outline and system text. |
| General | One system font everywhere. Gradient buttons with white outlines and a generic shadow (web style). Navy panels on navy space: low contrast, no materials. Hard cuts between screens. No pressed state; every button makes the same square-wave click. |

### In-game art (level 1 and level 5, 10 s of driving)

- **Rover:** a white van with gradients and a thin grey outline. It reads as a clip-art delivery truck, not a moon rover. The headlight is a static rectangle with a cone, there's no face or personality, and the springs are thin orange zig-zags.
- **Crates:** flat orange squares with three stencil marks. At gameplay zoom they read as orange boxes with an "x". Glass crates are pale rectangles.
- **Slimes:** gradient jelly with glow antennae. Colour and outline don't follow any shared rule, and they look painted rather than outlined.
- **Meteor:** a gradient rock with a glow. The warning ring is a red dashed ellipse, and the crater is a dark smudge.
- **UFO:** grey ellipses with dots; the pilot is a green circle.
- **Terrain:** a flat grey gradient body with a white rim line. Rocks and craters look like stickers. Everything is the same cold grey.
- **Background:** near-black sky, a glossy gradient Earth (the most detailed object on screen, competing with the rover) and dark navy ridges. There's no depth beyond the colour of the ridges.
- **Finish:** a dome and a checkered gate drawn in UI greys.
- **Particles:** dust is grey circles, and the turbo flame is a gradient triangle.
- **Markers:** distance signs use system-font numbers, which is real text in-game.

## 2. Art direction: soft cartoon space diorama (rules)

1. **Two planes.** Backgrounds are calm, desaturated and low-contrast, and go lighter and bluer with distance. Everything the player interacts with (rover, crates, slimes, coins, meteors, UFO, pickups) is saturated, brighter and outlined.
2. **Outline:** 2–3 px in a darker shade of the object's own colour, never black.
3. **Shading:** flat base, one shadow shape, one glossy highlight streak. No gradients or glow on characters; soft glows only for lights, beams and the sky.
4. **Shapes:** rounded and chunky. Personality comes from small details: rivets, scratches, stitches, dents, nails.
5. **Palette per world** in `src/art/palette.ts`. The Moon uses the brief's colours (sky `#2b3245/#3a4359/#4c5670`, ground `#9a9488/#7d776c` rim `#c9c3b5`, rover cream `#f2e6cf` + orange `#e8743b` outline `#8a3e1c`, crates `#c98a4b/#9a6332` outline `#5e3a1c`, slime `#8fd14f` outline `#3f7a1f`, coins `#f4c542` outline `#b07d12`, danger `#e5484d`). Mars is dusty orange, and the Ice moon is blue-white with the same rules.
6. **UI = rover/station hardware.** Panels are riveted metal plates or cargo-crate wood. Buttons are chunky physical keys with a darker bottom edge, a darker outline and a gloss streak; they press down 3 px with a squash and a click.
7. **Type:** a chunky rounded display font for titles and numbers and a clean rounded font for small text, both bundled locally.
8. **Motion:** easeOutBack for pop-ins, easeOutCubic for slides, an idle micro-animation on the main action, and `prefers-reduced-motion` respected.

## 3. Before / after

Same file names in `docs/ui-review/before/` and `docs/ui-review/after/` for all four viewports. Desktop pairs below.

### Loading

Was nothing: the title just appeared. Now the starfield with a crate that fills up from the bottom as the bundled fonts load.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-00-loading.jpg) | ![after](docs/ui-review/after/desktop-00-loading.jpg) |

### Title

Was a navy card logo and a green gradient square. Now a Fredoka logo (rover-orange with a cream top, darker outline, highlight streak, floating) with crates under it. The rover idles on a little moon hill with crates on the back; its headlight eyes look around and blink, and a slime peeks out from behind a rock. The Earth and stars are behind. Big green PLAY with an idle pulse; settings and sound buttons in the corners.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-01-title.jpg) | ![after](docs/ui-review/after/desktop-01-title.jpg) |

### Daily reward

A cargo-crate panel (planks, metal corner brackets, nails) with seven cream metal day plates; today is green and bobs. The claim button bursts coins.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-02-daily.jpg) | ![after](docs/ui-review/after/desktop-02-daily.jpg) |

### Route map (Moon)

A tire-track route across the moon surface. Delivery stops are round metal pads with a number, 0–3 crate stars and a lock; the current stop is orange and pulses with the rover parked above it. The top bar has hardware buttons: daily, garage, settings, sound.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-03-map.jpg) | ![after](docs/ui-review/after/desktop-03-map.jpg) |

### Route map (Mars, locked)

Each world is a page with its own sky, ground and planet, reached with arrows, swipe or the keyboard. A locked world shows a steel plaque with a lock.

| Before | After |
|---|---|
| *(did not exist)* | ![after](docs/ui-review/after/desktop-03b-map-mars.jpg) |

### Settings

New: a metal panel with a plaque, a sound switch and a close button.

| Before | After |
|---|---|
| *(did not exist)* | ![after](docs/ui-review/after/desktop-04-settings.jpg) |

### Briefing

A riveted metal panel: level plaque, crate count and distance on dark display insets, hazards as icons. The green Drive button is larger than the blue rewarded shield button (film icon + shield).

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-05-pre.jpg) | ![after](docs/ui-review/after/desktop-05-pre.jpg) |

### Garage

The rover stands on a hydraulic lift under a spotlight in the middle, with upgrade cards around it (drawn icon, level pips, coin price). Buying plays a ding and bursts sparkles at the part, and the part changes on the rover (bumper, turbo nozzle, battery cells, exhaust, shield dish, spring thickness, tread, bed posts).

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-06-garage.jpg) | ![after](docs/ui-review/after/desktop-06-garage.jpg) |

### Driving, level 1

Calm grey-blue sky, three parallax layers that flatten with distance, warm grey ground with a lit rim, strata bands, embedded rocks and craters. The HUD is cream hardware: battery gauge, crate icons, distance bar with flag, coins, turbo gauge, pause.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-07-drive-L1-5s.jpg) | ![after](docs/ui-review/after/desktop-07-drive-L1-5s.jpg) |

### Driving, level 5

Hazards in the same style: meteor warning ring, falling streak, crater that stays.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-07-drive-L5-10s.jpg) | ![after](docs/ui-review/after/desktop-07-drive-L5-10s.jpg) |

### Pause

A blurred, dimmed freeze of the game; the panel slides down. Big green Resume, then retry, garage and map, plus the sound switch.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-08-pause.jpg) | ![after](docs/ui-review/after/desktop-08-pause.jpg) |

### Delivery complete

The panel drops in with a bounce. Delivered crates pop in one by one as the stars (sound and particles), and the coin counter rolls up with ticks. Next (green, pulsing) sits beside an equal-size blue "film + x2"; retry, garage and map below.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-09b-result-win-late.jpg) | ![after](docs/ui-review/after/desktop-09b-result-win-late.jpg) |

### Delivery failed

The rover in a dark display tilts with dizzy spiral eyes and smoke, next to the failure reason. Retry is big, green and first; garage is second.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-11-result-fail.jpg) | ![after](docs/ui-review/after/desktop-11-result-fail.jpg) |

### Battery empty

The rover looks down at a blinking dead battery. A green "finish" and a blue "film + battery" recharge, the same size.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-12-recharge.jpg) | ![after](docs/ui-review/after/desktop-12-recharge.jpg) |

### In-game art (Mars and Ice moon, hazards, delivery point)

- **Rover:** assembled from parts on the existing colliders (hull ±1.35 x ±0.18 m drawn at 1.39 x 0.19; cab box drawn within 5%; bed posts exactly on the wall colliders; wheels r 0.42 with tread to 0.47). The headlights are eyes: they look in the driving direction, squint on hard landings, widen when a crate is about to fall, blink, and go dizzy on failure. Visible spring compression, rivets, a dent and scratches.
- **Crates:** planks, frame, diagonal brace, nails and a stencilled icon; glass crates are blue glass with a bottle. They rattle a little when they bounce.
- **Slimes:** lime body with a darker outline, googly eyes that lag and track the rover, wobble, blink and squash; crushed slimes leave a splat on the ground.
- **UFO:** saucer with chasing lights, a flat tractor beam with rising rings, and a little alien pilot in the dome.
- **Backgrounds:** Moon has rounded ridges and the Earth; Mars has a dusty orange sky, dunes and a hazy sun; the Ice moon has blue-white flat-topped cliffs and a ringed planet.
- **Delivery point:** landing pad with chevrons and lights, a station module with windows and a dish, and a waving flag. On arrival the flag waves faster, the lights blink and confetti bursts.
- **Particles:** dust tinted to the ground, layered turbo flame and speed lines, sparks, plank debris.

| Mars | Ice moon |
|---|---|
| ![after](docs/ui-review/after/phone-landscape-03b-map-mars.jpg) | ![after](docs/ui-review/after/desktop-07-drive-L5-2s.jpg) |

## 4. Verification

- `npm run typecheck` and `npm run build:portals` pass. The portal zips are listed in the PR.
- The Playwright audit (`audit.cjs`, all screens at 1280x720, 844x390, 640x360 and 390x844) shows no console errors. There are no layout overlaps at 640x360 (360 px phones) or on desktop; portrait shows the rotate hint.
- Click-through with real pointer input: buying an upgrade in the garage raises its level (bumper 0 → 1) and shows the part on the rover.
- **Performance** (headless Chromium, software rendering, level 8 with gas held):
  - Unthrottled: 60 fps, p95 16.8 ms, about 1.2 ms of JS per frame.
  - 4x CPU throttle at fixed full resolution: about 36 fps (old build in the same run: about 37).
  - 4x throttle with the game's adaptive resolution (as shipped): about 50 fps (old: about 40).
  - 60 fps at 4x throttle is not reached in this software-rendered container, before or after; it needs a check on a real mid-range phone.
- Physics, gameplay, terrain, hazards, economy and tuning are untouched: `git diff --stat` on `src/game/world.ts`, `src/game/levels.ts` and `src/game/save.ts` is empty.
- **Not verified:** sound by ear, safe areas on a notched phone, reduced motion on a real device.
