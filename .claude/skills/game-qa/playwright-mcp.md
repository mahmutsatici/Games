# Playwright MCP — Interactive Visual QA

The repo's `.mcp.json` defines a project-scoped MCP server named `playwright` (pinned `@playwright/mcp`). Claude Code offers it in every session opened in this repo; approve it once when asked. No `claude mcp add` is needed, and nothing is sent anywhere: it drives a local browser.

Tools you get: `browser_navigate`, `browser_take_screenshot`, `browser_snapshot`, `browser_evaluate`, `browser_press_key`, `browser_click`, `browser_wait_for`, `browser_console_messages`.

If the server cannot find a browser, see "Playwright MCP" in the root `CLAUDE.md` for the `--executable-path` / `--headless` flags to use with the preinstalled Chromium.

## MCP vs scripted tests

| Question | Use |
|---|---|
| Does it look right / feel right? | MCP: screenshot, judge visually |
| Did a refactor break boot or scoring? | Scripted test |
| Are icons centred, HUD readable at phone size? | MCP with a small viewport |
| Active gameplay snapshot | MCP (unstable for baselines) |
| CI-style pass/fail | Scripted test |

## Inspection flow

1. Start the game's dev server (`npm run dev` in the game folder) and note the port.
2. `browser_navigate` to it, `browser_wait_for` ~2 s.
3. `browser_take_screenshot` of the title, then start a level via `browser_evaluate` (`__GAME__.startRun(...)`) or by clicking.
4. Hold input with `browser_press_key`, screenshot mid-drive, check `browser_console_messages` for errors.
5. Provoke a fail and a win; screenshot the result screen; check that buttons are readable and the rewarded button sits next to an equally large green normal button (Poki rule).
6. Report concrete observations (what is wrong, where, which file likely owns it).
