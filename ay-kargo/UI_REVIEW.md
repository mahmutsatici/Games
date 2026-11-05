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

Filled in after the redesign.
