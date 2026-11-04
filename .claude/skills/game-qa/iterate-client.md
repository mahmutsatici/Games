# Quick Check After Every Change — `scripts/qa-check.mjs`

A small standalone Playwright script for the implement → check loop. It opens a running game, optionally runs setup JS and held-key actions, then writes a screenshot, the state JSON and any console errors. It exits non-zero if the page logged an error.

## Usage

```bash
# 1) start the game (in its folder): npm run dev  (or: npx vite preview --port 4173)
# 2) run the check from the repo root:
node .claude/skills/game-qa/scripts/qa-check.mjs --url http://localhost:5173 --out /tmp/qa

# start a level through the test hook, hold gas 3 s, then 1 s of gas+tilt
node .claude/skills/game-qa/scripts/qa-check.mjs --url http://localhost:5173 --out /tmp/qa \
  --setup "const g = window.__GAME__ || window.__game; g.startRun(g.makeLevel(0, 0))" \
  --actions '[{"keys":["ArrowUp"],"ms":3000},{"keys":["ArrowUp","ArrowLeft"],"ms":1000}]'
```

Options: `--url` (required), `--out` (default `./qa-out`), `--setup <js>`, `--actions <json>`, `--wait <ms>` (default 1500), `--width/--height` (default 1280x720), `--mobile` (Pixel-5 landscape with touch), `--throttle <n>` (CPU throttling for a frame-time sample).

## Output

```
<out>/shot-boot.png      after load
<out>/shot-final.png     after the actions
<out>/state.json         render_game_to_text() if present, else a summary of window.__GAME__/__game
<out>/frames.json        rAF interval stats sampled during the actions
<out>/errors.json        console errors and page errors (only if any)
```

Look at the screenshots, read `state.json`, and fix any error before moving on.
