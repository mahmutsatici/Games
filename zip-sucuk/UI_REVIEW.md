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

Filled in after the redesign (see section 4).
