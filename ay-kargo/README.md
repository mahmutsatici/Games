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
- Controls: right half / Right Arrow / D = gas; left half / Left Arrow / A = brake & tilt; Space / W / on-screen bolt = turbo.
