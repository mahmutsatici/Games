# CLAUDE.md

Monorepo of original, text-free HTML5 web games for web game portals. Read this first in every session.

## Repo layout

| Path | What |
|---|---|
| `ay-kargo/` | Moon Cargo: physics driving game (Vite + TypeScript, Canvas 2D, planck.js). See `ay-kargo/README.md`, `ay-kargo/features.md`. |
| `zip-sucuk/` | Sucuk Hop: one-button soft-body physics game (Vite + TypeScript, Canvas 2D, planck.js). Tunables in `zip-sucuk/src/config.ts`, levels in `src/game/levels.ts`. See `zip-sucuk/features.md`. |
| `istasyon/` | Planned game (Canvas/DOM). Not in the repo yet; follow the same structure when it is added. |
| `ay-kargo/src/platform/` | Platform layer: `types.ts` (the only interface the game uses) + one adapter per portal. |
| `ay-kargo/reference/` | Approved prototype (`prototype.html`): the feel baseline for physics. |
| `ay-kargo/store/` | Store texts and thumbnails. |
| `.claude/skills/` | Project skills (see below). |
| `.mcp.json` | Project MCP server `playwright` (pinned `@playwright/mcp`). |
| `DECISIONS.md` | Decisions already made. Add new ones here. |
| `.github/workflows/pages.yml` | Deploys the `none` builds to GitHub Pages on push to main: ay-kargo at the site root, zip-sucuk at `/zip-sucuk/`. |

## Commands (run inside a game folder, e.g. `cd ay-kargo` or `cd zip-sucuk`)

```bash
npm ci                 # install exact deps
npm run dev            # Vite dev server (http://localhost:5173)
npm run typecheck      # tsc --noEmit
npm run build          # production build into dist/ (VITE_PORTAL selects the portal, default none)
npm run build:portals  # dist/<portal>/ + dist/ay-kargo-<portal>.zip for crazygames, poki, gd, none
```

`VITE_GD_GAME_ID` must be set when building the GameDistribution zip.

## Hard rules

- **No server, no database, no backend calls.** Static files only.
- **No external network calls except the selected portal SDK.** No analytics, no other ad networks, no external links, no CDN fonts or scripts, no Google products.
- **Ads and saves only through the platform layer** (`src/platform/types.ts`): `commercialBreak`, `rewardedBreak`, `getItem/setItem`, gameplay start/stop. Never call a portal SDK or `localStorage` from game code; wrap any storage in try/catch (incognito).
- **Size:** initial download < 8 MB per portal zip (Poki target); first interactive < 10 s.
- **Art is drawn in code** (Canvas 2D / SVG); **sound is synthesized with WebAudio**. No image or audio files in the game, except store thumbnails.
- **Text-free gameplay** (icons and numbers). Menu strings only through `src/i18n.ts` (en, de, fr, es, pt, tr, ru, ja).
- 16:9 logical resolution 1280x720 scaled to fit; works on desktop and mobile; portrait shows a rotate hint.
- Poki rule for rewarded ads: a green, at-least-as-large normal button next to every rewarded button; the rewarded button is not green and shows the clapper icon.

## Working method

1. **Plan first.** Before writing code, list the files you will change and the risks. Ask if something is unclear.
2. **One concern per step.** Say which files may change in the step. No new files unless needed.
3. **Verify in the browser after every step.** Run the game with Playwright (the `game-qa` skill's `scripts/qa-check.mjs` or the `playwright` MCP server), take screenshots, check console errors. Type checks alone are not verification.
4. **Tunable numbers live in each game's `src/config.ts`.** (ay-kargo still has most constants inline in `src/game/*.ts`; move them to `src/config.ts` when you touch them.)
5. **Record decisions** in `DECISIONS.md`; track features in `<game>/features.md` and tick a feature only after it has been verified in the browser.
6. **Use the project skills** in `.claude/skills/` when relevant: `game-qa` for tests and checks, `frontend-design` for menus/UI, `webapp-testing` for general browser checks, `algorithmic-art` for background/effect ideas, `canvas-design` for store art.

## Project skills (`.claude/skills/`)

| Skill | Use for | Notes |
|---|---|---|
| `game-qa` | Game tests, verification after each change, frame-time checks | Adapted for our engines; local only. `scripts/qa-check.mjs` = quick check. |
| `webapp-testing` | General Playwright browser checks | Python examples; Node Playwright is equally fine here. |
| `frontend-design` | Menu/HUD/UI direction | Game art must still be drawn in code. |
| `algorithmic-art` | Exploring generative backgrounds/effects | Its viewer uses p5.js and Google Fonts from CDNs: fine for exploration only. Port the result to plain Canvas 2D; never ship p5, CDN scripts or web fonts in a game. |
| `canvas-design` | Store thumbnails / posters (PNG/PDF) | Output goes to `<game>/store/`, never into the game bundle. |
| `graphify` | Knowledge graph of a folder | Needs the `graphify` Python package, which is not installed by default. |

## Playwright and the MCP server

- A Chromium is preinstalled in cloud sessions at `/opt/pw-browsers/chromium` (`PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`). Use it; **do not run `playwright install` when a browser already exists.** Node scripts can `require('playwright')` (global install).
- `.mcp.json` starts `npx -y @playwright/mcp@0.0.83 --isolated`. In cloud sessions it finds the preinstalled Chromium and runs headless automatically. Approve the project server when Claude Code asks.
- If the server cannot find or launch a browser, pass it explicitly (verified with 0.0.83):
  ```bash
  npx -y @playwright/mcp@0.0.83 --isolated --headless --executable-path /opt/pw-browsers/chromium
  ```
  Put those extra args in a local, uncommitted `.claude/settings.local.json` / your own MCP config rather than changing `.mcp.json`, since the path only exists in cloud sessions. Add `--no-sandbox` only if Chromium refuses to start as root.
- To bump the version: pick one published at least two weeks ago (`npm view @playwright/mcp time`) and update `.mcp.json`, this file and `.claude/skills/game-qa/playwright-mcp.md`.

## General coding guidelines

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
