# Toy Fort (Oyuncak Kalesi)

Original toy-diorama tower defense for web portals (Vite + TypeScript, Canvas 2D, no engine). At night the toys defend the star sticker in the toy box from the Junk Gang.

```bash
npm ci
npm run dev            # http://localhost:5173  (art-preview.html, thumbs.html are dev-only pages)
npm run typecheck      # game + scripts (the sim is also checked without the DOM lib)
npm run build:portals  # dist/<portal>/ + dist/kule-<portal>.zip for crazygames, poki, gd, playgama, none (itch.io)
npm run gen            # rebuild src/sim/levels/data.ts from maps.ts + LEVEL_GEN
npm run calibrate      # per-level economy so the smart bot lands in its lives band
npm run balance        # bots × levels × seeds × perks → BALANCE.md
npm run trace -- 12 smart   # one game, wave by wave
```

- `src/sim/`: deterministic simulation (30 ticks/s, seeded RNG, no DOM). All numbers live in `src/sim/config.ts`.
- `src/render/`, `src/ui/`: read the sim only. Art is SVG built in code (`src/art/`), rasterised once at load.
- `src/platform/`: portal adapters (copied from ay-kargo, plus Playgama). Ads and saves go only through `types.ts`.
- `scripts/`: level generator, balance harness and bots, calibrator, trace.
- `store/`: store texts and text-free thumbnails.
