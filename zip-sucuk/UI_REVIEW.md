# Zıp Sucuk — UI review

Screens captured with Playwright at 1280x720 (desktop), 390x844 (phone portrait), 844x390 (phone landscape) and 640x360 (small landscape). Before images: `docs/ui-review/before/`, after images: `docs/ui-review/after/` (same file names).

## 1. Audit: what makes each screen feel non-game-like (before)

| Screen | Problems |
|---|---|
| Loading | There is none: a dark brown page until the first frame; nothing tells the player the game is starting. |
| Title | The logo is system-font text on a red rectangle (looks like a web banner). The "play" button is a generic green rounded rectangle with a grey triangle. The demo sausage sits behind the button, half covered. No idle animation except a slow tilt; no settings. |
| Level select | A 3x2 grid of identical navy "cards" on a dim tile wall: reads as a dashboard. Navy panels clash with the warm kitchen. Level numbers are system font. Locked levels are grey boxes. No worlds, no sense of progress or place. |
| Settings | Does not exist (only a lone sound button). |
| Skins | Five tall navy cards in a row, price buttons in three unrelated colours (blue/orange/grey). The preview sausages are flat strokes, not the in-game sausage. |
| HUD | Three dark translucent pills with system-font numbers. The level number and a chequered flag sit in one pill, which is unclear. The coin icon is a generic gold coin with an "I". Two square buttons top-right in different colours (orange retry, grey pause). |
| Pause | Navy card centred on a flat 60% dim. Three equal-size buttons in green/orange/blue that share nothing with the game art. No sound toggle, no motion: it just appears. |
| Level complete | The same navy card. Stars, numbers and buttons all appear at once with no reward moment. The jump/fall stats use arrow and retry icons that read like UI controls. |
| Level failed / falls | No feedback: the sausage teleports back to the flag after a sizzle. |
| Phone portrait | A plain dark page with a thin white phone outline and system text. |
| General | One system font everywhere. Flat gradient buttons with white outlines (web style). Hard cuts between screens. Panels are navy (from Moon Cargo) instead of kitchen materials. No pressed state, no button sounds except one click. |

In-game (L1 counter, L2 shelves, L4 stove, L6 fridge):

- The background is the same flat tile wall plus big translucent rounded rectangles that look like placeholders. Every level looks alike except the tile tint.
- Counters are plain brown boxes with vertical lines. Shelves are white bars with two triangle spikes. The cabinet is a flat teal column.
- The flag is a stick with a triangle, and the coin has an "I" mark that reads as a pause icon.
- The sausage has no ground shadow and no landing squash. The eyes always face the same side.
- Dust particles are beige circles on every surface. There is no vignette or light direction.

## 2. Gameplay style rules (extracted from the in-game art, applied everywhere)

1. **Palette**
   - Warm kitchen base: cream `#f6ead2`, wood `#c98a4f`, dark wood `#7a4521`.
   - Hero sausage red `#a3321e` with highlight `#d4603f` and outline `#5a150a`.
   - Mustard `#f2b52c`, chili red `#e2412b`, leaf green `#4caf50`.
   - Cold accents only for ice: `#bfe6f6` and `#5aa6c8`.
2. **Outline rule:** every shape gets a 2.5–4 px outline in a darker shade of its own colour, never black.
3. **Shading:** flat base colour, one shadow band (bottom/right, ~25% darker), one glossy highlight (top/left, white at 40–60% alpha). No soft gradients except glows and glass.
4. **Shapes:** chunky and rounded. Corner radius ≥ 25% of the short side for UI, rounded ends on everything that can be rounded, thick strokes.
5. **Depth:** the background is desaturated, low-contrast and slightly blurred-looking. The foreground (sausage, platforms, coins, UI) is saturated and outlined. Contact shadows under objects. One warm light from the upper left plus a soft vignette.
6. **Type:** Erica One for titles and big numbers (with the outline rule and a drop shadow), Outfit for small text.
7. **Motion:** easeOutBack for anything that appears, easeOutCubic for slides. Idle micro-motion (bob, blink, pulse) on the main thing on every screen. Respect `prefers-reduced-motion`.

## 3. Before / after

Screenshots: `docs/ui-review/before/` and `docs/ui-review/after/`, same file names. Viewports: `desktop` 1280x720, `phone-landscape` 844x390, `small-landscape` 640x360 (360 px phones), `phone-portrait` 390x844 (shows the rotate hint by design).

### Loading

Was a dark empty page. Now a cream kitchen-tile screen with the sausage icon and a sausage-shaped bar that fills as the bundled fonts load.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-0-loading.jpg) | ![after](docs/ui-review/after/desktop-0-loading.jpg) |

### Title

Was a red banner with system text. Now an Erica One logo (dark-red outline, mustard top half, gloss line) that bounces; the hero sausage idles on a board (wobbles, blinks, flips every few seconds); the demo level plays blurred and dimmed behind it; big orange Play button that pulses; settings and sound buttons in the corners.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-1-title.jpg) | ![after](docs/ui-review/after/desktop-1-title.jpg) |

### Level select

Was a navy grid. Now one page per world (Kitchen, Hot Stove, Freezer) with its own blurred backdrop, plates on a cutting board joined by a dotted path, a number, 0–3 chili stars and a lock per plate; the sausage waits at the current level. Arrows, swipe and page dots.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-2-levels.jpg) | ![after](docs/ui-review/after/desktop-2-levels.jpg) |

### Settings

Did not exist. Board panel with ribbon title, sound and music toggles, close button.

| Before | After |
|---|---|
| *(screen did not exist)* | ![after](docs/ui-review/after/desktop-3-settings.jpg) |

### Skins

Was navy cards. Now wooden frames with tiled insets and the real in-game sausage (same drawing code) as the preview; equipped = green check, buyable = orange price, too expensive = grey.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-4-skins.jpg) | ![after](docs/ui-review/after/desktop-4-skins.jpg) |

### HUD + world (L1 counter)

Cream outlined chips for flag/level, jumps vs par (green if within par) and coins (pops when a coin is taken); retry and pause candy buttons top-right inside the safe area. New kitchen backdrop with parallax props, vignette and warm light; counters are cabinets with a worktop slab.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-5-play-L1.jpg) | ![after](docs/ui-review/after/desktop-5-play-L1.jpg) |

### Charging

Charge meter is a sausage that fills up.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-6-play-charging.jpg) | ![after](docs/ui-review/after/desktop-6-play-charging.jpg) |

### Pause

World blurred and dimmed; board panel slides in from the top; big green Resume, retry, home, sound toggle (rewarded skip appears after 5 falls, purple with clapper).

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-7-pause.jpg) | ![after](docs/ui-review/after/desktop-7-pause.jpg) |

### Fall reaction

Was nothing. Now a mustard comic burst with a dizzy sausage and a splash icon.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-8-fall.jpg) | ![after](docs/ui-review/after/desktop-8-fall.jpg) |

### World: pantry (L2)

Pantry wall with jars, onion strings and sacks; wooden shelves.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-9-play-L2-shelves.jpg) | ![after](docs/ui-review/after/desktop-9-play-L2-shelves.jpg) |

### World: hot stove (L4)

Dark tiles, range hood with lamps, pans, heat haze; steel counters, grill bars glow with warning stripes.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-9-play-L4-stove.jpg) | ![after](docs/ui-review/after/desktop-9-play-L4-stove.jpg) |

### World: freezer (L6)

Icy ribbed walls, frosted glass shelves with icicles, frozen counters, mist and sparkles.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-9-play-L6-fridge.jpg) | ![after](docs/ui-review/after/desktop-9-play-L6-fridge.jpg) |

### Level complete

Panel drops in with easeOutBack, chili stars pop one by one with sound and particles, coins roll up with ticks; big green Next (pulses) and an equal-size purple x2 rewarded button with clapper; small retry and home.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/desktop-b-result.jpg) | ![after](docs/ui-review/after/desktop-b-result.jpg) |

### Portrait phones

Before: dark page with a thin white phone outline. After: cream kitchen tiles, a phone holding the sausage that rotates, Erica One text.

| Before | After |
|---|---|
| ![before](docs/ui-review/before/phone-portrait-1-title.jpg) | ![after](docs/ui-review/after/phone-portrait-1-title.jpg) |

## 4. Verification

- Typecheck clean; `npm run test:levels` solves all 6 levels with the same results as before the redesign (physics untouched).
- Click-through with real pointer input in Chromium: title → Play → plate 1 → pause → resume → finish → result → Next starts level 2. No console errors on any screen at all four viewports.
- Frame time while playing L1: median 16.7 ms, p95 16.8 ms (headless Chromium, 60 Hz cap).
- Portal zips 159 KB each (fonts included). No external requests except the selected portal SDK.
- Platform art is drawn from the collider `w x h`; the only overhang is the counter worktop (+6 px, <2%).
- Not verified: real phone touch / safe areas on a notched device; sound by ear.
