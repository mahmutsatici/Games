# Attribution

This skill is adapted from the `game-qa` skill in **game-creator** by OpusGameLabs (now "playableintelligence"):

- Source: https://github.com/OpusGameLabs/game-creator, folder `skills/game-qa`
- Copied at commit `4e64b83` (2026-11-04)
- License: MIT. The source repository has no LICENSE file; its README ("## License: MIT") and the skill's own frontmatter (`license: MIT`, `author: OpusGameLabs`) state the terms. The notice below reproduces the MIT terms for the copied and modified files.

## Changes made for this repository

- Rewrote all Phaser 3 / Three.js specifics (scenes, `scene.getScenes`, Phaser RNG config) for Canvas 2D + planck.js (ay-kargo) and Canvas/DOM (istasyon).
- Removed everything about Play.fun, its widget and SDK, and any external service; testing is local only.
- Replaced the external `scripts/iterate-client.js` reference with a local `scripts/qa-check.mjs` written for this repo.
- Replaced `claude mcp add ... @playwright/mcp@latest` with the repo's pinned, project-scoped `.mcp.json`.
- Replaced `npx playwright install` with "use the preinstalled Chromium".
- Kept the patterns: test hooks on `window.__GAME__` (dev/test builds only), `render_game_to_text()`, seeded randomness, controllable clock, visual regression screenshots, gameplay invariants, performance checks.
- The rest of game-creator is not installed.

## MIT License

Copyright (c) OpusGameLabs / playableintelligence and game-creator contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
