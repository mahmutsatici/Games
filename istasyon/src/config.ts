// Centralized tunable configuration for istasyon/ (CLAUDE.md convention).
// All layout coordinates, economy rates, two-phase planet terraforming costs,
// wave/boss difficulty scaling, and upgrade curves live here.

export const CONFIG = {
  // Logical canvas dimensions
  WIDTH: 1280,
  HEIGHT: 720,

  // Split-Screen Layout Coordinates:
  // - Left HUD Panel: x=16..216
  // - Modern Command Ship & Merge Deck (shifted left): x=228..812 (center x=520)
  // - Full-Sphere Planet & Attack Corridor on Right: planet center (870, 265), radius R=118
  // - Right Shop & Drone Upgrade Panel: x=1042..1264
  LEFT_PANEL_X: 16,
  LEFT_PANEL_W: 200,
  RIGHT_PANEL_X: 1042,
  RIGHT_PANEL_W: 222,

  BOARD_AREA_X0: 230,
  BOARD_AREA_X1: 810,
  BOARD_AREA_Y0: 118,
  BOARD_AREA_Y1: 618,
  CELL_SIZE: 96,

  SHIP_CORE_POS: { x: 520, y: 92 },
  PLANET_POS: { x: 908, y: 268, r: 106 },
  SCRAP_BOX: { x: 848, y: 632, w: 140, h: 66 },

  // Economy & Tier scaling
  MAX_TIER: 20,
  ECON_CAP: 1e300,
  BASE_PROD_TIER1: 1.5,
  PROD_GROWTH: 2.45,
  BUY_BASE_COST: 5,
  BUY_TIER_GROWTH: 2.45,
  BUY_REPEAT_GROWTH: 1.08,

  // Drone drop & 3 Hardware Upgrades (offline time upgrade removed!)
  DRONE_BASE_INTERVAL: 6.4,
  DRONE_SPEED_STEP: 0.44,
  DRONE_PERK_STEP: 0.35,
  DRONE_MIN_INTERVAL: 1.5,

  // Phase 1: Peaceful City Building & Terraforming (0% -> 100%)
  // Total energy needed to terraform a planet scales by Level (orbit)
  TERRAFORM_BASE_ENERGY: 1600,
  TERRAFORM_LEVEL_GROWTH: 3.4,
  MERGE_TERRAFORM_BOOST_PCT: 0.45, // Small bonus % per merge during Phase 1

  // Phase 2: Wave Defense & Final Boss (Starts ONLY after Planet reaches 100%!)
  WAVES_PER_LEVEL: 3, // Wave 1 (Asteroid Swarm), Wave 2 (Heavy Swarm), Wave 3 (Final Boss Cruiser)
  WAVE_PREP_SECONDS: 4.5,
  ASTEROID_COUNT_BASE: 4,
  ASTEROID_HP_DPS_MULT: 5.8, // Harder asteroids so defense requires good board layout + merges
  ASTEROID_SPEED_BASE: 36,
  BOSS_HP_DPS_MULT: 34, // Challenging Boss Cruiser
  BOSS_SPEED_BASE: 19,
  PLANET_HIT_PENALTY_ASTEROID: 8,
  PLANET_HIT_PENALTY_BOSS: 22,

  // Score rewards
  SCORE_PER_MERGE_MULT: 15,
  SCORE_PER_ASTEROID: 150,
  SCORE_PER_BOSS: 1200,
} as const;
