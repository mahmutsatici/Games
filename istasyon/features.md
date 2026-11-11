# `istasyon/` — Features & Verification Status

## Core Architecture & Platform
- [x] **Unified Platform Layer (`src/platform/`)**: CrazyGames, Poki, GameDistribution, and `none` (itch.io / Playgama) adapters (`verified`)
- [x] **Safe Storage & Save Migration (`src/save.ts`)**: Versioned JSON save with legacy v1 migration and validation (`verified`)
- [x] **Centralized Configuration (`src/config.ts`)**: All tunable economy, pacing, wave/boss difficulty, and layout constants (`verified`)
- [x] **QA & Automation Hooks (`src/main.ts`)**: `window.__GAME__`, `window.render_game_to_text()`, `window.advanceTime(ms)` exposed in dev builds (`verified`)
- [x] **8-Language Concise Localization (`src/i18n.ts`)**: Short, punchy labels (`en, de, fr, es, pt, tr, ru, ja`) that never overflow buttons (`verified`)

## Visual Layout & Art Direction
- [x] **Split Command Layout**: Sleek Modern Orbital Command Ship + Merge Grid shifted left/center, with a **Full-Sphere 3D-Shaded Planet** clearly visible on the right (`verified`)
- [x] **Modern Orbital Command Ship (`src/background.ts`)**: Twin ion thrusters, glowing reactor spine, solar wing arrays, and animated plasma turret (`verified`)
- [x] **Full-Sphere Planet Terraforming (`0% -> 100%`)**: 5 distinct visual stages (Barren Cratered Sphere -> Atmosphere Halo & Clouds -> Deep Oceans -> Lush Continents -> Glowing City Networks & Planetary Shield) (`verified`)
- [x] **Redesigned Quad-Rotor Supply Drone (`src/drone.ts`, `src/icons.ts`)**: Sleek sci-fi quad-thruster cargo drone with magnetic tractor beam (`verified`)

## Gameplay & Progression
- [x] **4 Module Families & Adjacency Links (`src/economy.ts`, `src/board.ts`)**: Generators, Amplifiers, Collectors, and Capacitors with animated synergy links (`verified`)
- [x] **Anti-Deadlock Board Mechanics**: Drag-to-scrap Recycle Bin (`75%` refund) + Smart Orphan-Matching drone drops (`verified`)
- [x] **Phase 1 — Peaceful City Building (`0% -> 100%`)**: Zero attacks while terraforming; station beams continuous terraforming energy pulses into the planet until cities are established at `100%` (`verified`)
- [x] **Phase 2 — Wave Defense & Final Boss**: Once terraforming hits `100%`, multi-wave asteroid swarms and a high-HP Invasion Boss Cruiser attack the planet (`verified`)
- [x] **Level & Score System**: Each planet is a distinct Level (`Lv.1 Terra`, `Lv.2 Mars`, `Lv.3 Europa`, `Lv.4 Gaia`) with scaling difficulty and live Score (`SKOR`) tracking (`verified`)
- [x] **Streamlined 3 Hardware Upgrades**: Drone Speed, Drone Tier Quality, and Grid Expansion (unnecessary offline-duration upgrade removed) (`verified`)
- [x] **8-Node Tech Tree (`TEKNOLOJİ`)**: Short, clean title and localized permanent Star (`★`) upgrades (`verified`)
