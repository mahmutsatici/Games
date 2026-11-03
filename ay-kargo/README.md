# Ay Kargo / Moon Cargo

Original text-free HTML5 physics driving game (Vite + TypeScript, planck.js, Canvas 2D, WebAudio). No backend, no asset files.

```bash
npm install
npm run dev            # local dev server
npm run typecheck
npm run build:portals  # dist/<portal>/ + dist/ay-kargo-<portal>.zip (crazygames, poki, gd, none)
```

- Portal selected at build time via `VITE_PORTAL` (`crazygames` | `poki` | `gd` | `none`); GameDistribution also needs `VITE_GD_GAME_ID`.
- Game talks only to `src/platform/types.ts`; adapters live in `src/platform/`.
- Save key: `aykargo.save.v1`. Strings: `src/i18n.ts` (en, de, fr, es, pt, tr, ru, ja).
- Store texts and thumbnails: `store/`.
- Controls: Right Arrow / D = gas, Left Arrow / A = brake & reverse (in the air both tilt the rover), Space / W / Up = turbo. Touch devices get semi-transparent pedals (brake bottom-left, gas bottom-right, turbo above gas); tapping anywhere on the left/right half also works.
- `reference/prototype.html` is the approved prototype the physics constants come from; `reference/screens/` holds the prototype-vs-build comparison.
