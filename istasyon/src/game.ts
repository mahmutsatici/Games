// Game orchestration: owns state, board, adjacency simulation, two-phase planet terraforming + wave defense, score/level, mascot, and HUD drawing.
import { sound } from './audio';
import { PLANET_POS } from './background';
import { Board, CELL } from './board';
import { drawButtons, hitButton, type CanvasButton } from './buttons';
import { CONFIG } from './config';
import { isDailyClaimable } from './daily';
import { Drones } from './drone';
import {
  BOOST_DURATION_MS,
  BOOST_MAX_MS,
  FAMILY_IDS,
  FREE_PART_COOLDOWN_MS,
  GRID_SIZES,
  PERK_IDS,
  UPGRADES,
  buyCost,
  clampEcon,
  dropInterval,
  evaluateBoard,
  perkCost,
  prestigeStars,
  prod,
  rollDropTier,
  shopTier,
  unlockedFamilies,
  upgradeCost,
  type BoardSimResult,
  type FamilyId,
  type UpgradeId,
} from './economy';
import { formatNumber, formatTime } from './format';
import { FX } from './fx';
import { t } from './i18n';
import {
  drawBolt,
  drawCalendar,
  drawCheck,
  drawDrone,
  drawFilm,
  drawGear,
  drawGridIcon,
  drawRocket,
  drawSpeedLines,
  drawStar,
  drawTechIcon,
  drawUpArrow,
} from './icons';
import { Mascot } from './mascot';
import { MeteorManager } from './meteor';
import { drawOnboarding } from './onboarding';
import { drawPart, familyColor, tierColor } from './parts';
import { emptyFamilies, emptyParts, newState, type GameState } from './state';
import {
  FONT_DISPLAY,
  FONT_UI,
  PALETTE,
  chamferRectPath,
  drawCRTScreen,
  drawHardwarePanel,
} from './theme';
import { H, W } from './view';

const PANEL_X = CONFIG.RIGHT_PANEL_X;
const PANEL_W = CONFIG.RIGHT_PANEL_W;
const LEFT_X = CONFIG.LEFT_PANEL_X;
const LEFT_W = CONFIG.LEFT_PANEL_W;
const PLANET_PANEL_Y = 340;
const PLANET_PANEL_H = 232;

export class Game {
  state: GameState;
  board: Board;
  drones: Drones;
  meteor: MeteorManager;
  mascot: Mascot;
  fx: FX;
  sim: BoardSimResult;
  time = 0;
  /** Simulation paused (ads / overlays). */
  paused = false;
  /** Set when something important changed; the app saves and clears it. */
  dirty = false;

  /** Combo merge state (merges within 1.5s raise pitch and grant bonus energy + score) */
  comboCount = 0;
  comboTimer = 0;
  private orbSpawnTimer = 0;

  /** Callbacks for UI overlays / platform calls */
  onSettings: () => void = () => {};
  onBoost: () => void = () => {};
  onDaily: () => void = () => {};
  onPrestige: () => void = () => {};
  onFreePart: () => void = () => {};
  onHappyMoment: () => void = () => {};

  // Launch / Next Level animation
  launching = false;
  launchT = 0;
  boardYOffset = 0;
  onLaunchComplete: () => void = () => {};

  private shownEnergy = 0;
  private shownScore = 0;
  private buttons: CanvasButton[] = [];
  private pressed: CanvasButton | null = null;
  private gearHit = { x: 1208, y: 10, w: 54, h: 54 };

  constructor() {
    this.state = newState();
    this.fx = new FX();
    this.mascot = new Mascot();
    this.board = new Board(this.state, {
      merge: (cell, tier, family) => this.onMerge(cell, tier, family),
      move: () => {
        sound.playClick();
        this.refreshSim();
        this.dirty = true;
      },
      scrap: (_cell, tier, family, x, y) => this.onScrap(tier, family, x, y),
    });
    this.drones = new Drones(this.board, (cell, tier, family) =>
      this.placePart(cell, tier, true, family),
    );
    this.meteor = new MeteorManager({
      onThreatDestroyed: (x, y, isBoss) => this.handleThreatDestroyed(x, y, isBoss),
      onPlanetHit: (x, y, isBoss) => this.handlePlanetHit(x, y, isBoss),
      getCollectorPositions: () => this.getCollectorPositions(),
    });
    this.board.setGridLevel(0);
    this.sim = this.computeSim();
    this.buildButtons();

    if (import.meta.env.DEV && location.search.includes('showcase')) {
      this.board.setGridLevel(3);
      for (let i = 0; i < 20; i++) {
        this.state.parts[i] = i + 1;
        this.state.families[i] = (i % 4) as FamilyId;
      }
      this.refreshSim();
    }
    this.shownEnergy = this.state.energy;
    this.shownScore = this.state.score;
  }

  setState(s: GameState): void {
    this.state = s;
    this.board.setState(s);
    this.board.setGridLevel(s.upgrades.grid);
    this.drones.reset();
    this.meteor.reset();
    this.shownEnergy = s.energy;
    this.shownScore = s.score;
    sound.setEnabled(s.sound);
    sound.setVolume(s.volume ?? 0.8);
    this.refreshSim();
  }

  private computeSim(): BoardSimResult {
    return evaluateBoard(
      this.state.parts,
      this.state.families,
      this.board.cols,
      this.board.rows,
      this.state.perks,
      this.state.orbit,
      -1,
    );
  }

  refreshSim(): void {
    this.sim = this.computeSim();
    const stage = Math.min(
      5,
      1 +
        Math.floor(this.state.highestTierEver / 3) +
        Math.min(2, Math.floor(this.state.planetProgress / 40)),
    );
    sound.setStationStage(stage);
  }

  activeModuleCount(): number {
    let n = 0;
    for (const idx of this.board.activeCells()) {
      if (this.state.parts[idx] > 0) n++;
    }
    return n;
  }

  batteryCount(): number {
    let n = 0;
    for (const idx of this.board.activeCells()) {
      if (this.state.parts[idx] > 0 && this.state.families[idx] === 3) n++;
    }
    return n;
  }

  private getCollectorPositions(): { x: number; y: number }[] {
    const out: { x: number; y: number }[] = [];
    for (const idx of this.board.activeCells()) {
      if (this.state.parts[idx] > 0 && this.state.families[idx] === 2) {
        out.push(this.board.cellCenter(idx));
      }
    }
    return out;
  }

  /** Total station defense laser DPS (base production + Collector modules bonus + perks). */
  defenseDps(): number {
    const colBonus = 1 + (this.state.perks.col_beam || 0) * 0.35;
    const collectorCount = this.getCollectorPositions().length;
    return this.productionPerSecond() * (1 + collectorCount * 0.25) * colBonus;
  }

  /** Energy required to complete 100% city building on the current Planet Level. */
  planetTargetEnergy(): number {
    return CONFIG.TERRAFORM_BASE_ENERGY * Math.pow(CONFIG.TERRAFORM_LEVEL_GROWTH, this.state.orbit);
  }

  private handleThreatDestroyed(x: number, y: number, isBoss: boolean): void {
    sound.playCoin();
    const vipMult = 1 + (this.state.perks.contract_vip || 0) * 0.4;
    const reward = Math.max(
      30,
      Math.round(this.steadyProduction() * (isBoss ? 55 : 14) * vipMult),
    );
    this.addEnergy(reward);

    const scoreGain = Math.round(
      (isBoss ? CONFIG.SCORE_PER_BOSS : CONFIG.SCORE_PER_ASTEROID) * (1 + this.state.orbit * 0.5),
    );
    this.state.score = clampEcon(this.state.score + scoreGain);

    // If a hit had knocked planetProgress below 100%, defeating threats restores it back toward 100%
    if (this.state.planetProgress < 100) {
      this.state.planetProgress = Math.min(100, this.state.planetProgress + (isBoss ? 25 : 4));
    }

    if (isBoss) {
      this.state.planetProgress = 100;
      this.state.bossDefeated = true;
      this.onHappyMoment();
    }

    this.fx.burst(x, y, isBoss ? PALETTE.phosphorAmber : PALETTE.signalCyan, isBoss ? 30 : 18);
    this.fx.ringBurst(
      x,
      y,
      isBoss ? PALETTE.phosphorAmber : PALETTE.signalCyan,
      isBoss ? 88 : 54,
    );

    if (isBoss) {
      const starGain = 1 + (this.state.perks.contract_vip ? 1 : 0);
      this.state.stars += starGain;
      this.fx.numberPop(
        x,
        y,
        `+${formatNumber(reward)}`,
        PALETTE.phosphorAmber,
        `+${starGain} ★`,
      );
      this.fx.triggerShake(10, 0.4);
      const freeCell = this.randomEmptyCell();
      if (freeCell >= 0) {
        const fams = unlockedFamilies(this.state.highestTierEver);
        const fam = fams[Math.floor(Math.random() * fams.length)] ?? 0;
        const dropT = Math.max(2, this.currentShopTier() + 1);
        this.placePart(freeCell, dropT, true, fam);
      }
      this.mascot.trigger('celebrate', 2.4);
    } else {
      this.fx.numberPop(
        x,
        y,
        `+${formatNumber(reward)}`,
        PALETTE.signalCyan,
        `+${scoreGain} PT`,
      );
      if (Math.random() < 0.3) {
        const freeCell = this.randomEmptyCell();
        if (freeCell >= 0) {
          const fams = unlockedFamilies(this.state.highestTierEver);
          const fam = fams[Math.floor(Math.random() * fams.length)] ?? 0;
          this.placePart(freeCell, Math.max(1, this.currentShopTier()), true, fam);
        }
      }
      this.mascot.trigger('happy', 1.2);
    }
    this.dirty = true;
  }

  private handlePlanetHit(x: number, y: number, isBoss: boolean): void {
    const loss = isBoss ? CONFIG.PLANET_HIT_PENALTY_BOSS : CONFIG.PLANET_HIT_PENALTY_ASTEROID;
    this.state.planetProgress = Math.max(25, this.state.planetProgress - loss);
    this.fx.burst(x, y, PALETTE.oxideRed, 24);
    this.fx.ringBurst(x, y, PALETTE.oxideRed, 74);
    this.fx.numberPop(x, y - 16, `-%${loss}`, PALETTE.oxideRed);
    this.fx.triggerShake(isBoss ? 12 : 7, 0.4);
    this.dirty = true;
  }

  // ---------- Economy ----------
  isBoostActive(): boolean {
    return Date.now() < this.state.boostEnd;
  }

  multiplier(): number {
    const orbitMult = 1 + 0.35 * this.state.orbit;
    const starMult = 1 + 0.08 * this.state.stars;
    const boostMult = this.isBoostActive() ? 2 : 1;
    return orbitMult * starMult * boostMult;
  }

  baseProduction(): number {
    return this.sim.totalBase;
  }

  /** Production without temporary boosts (used for offline / rewards). */
  steadyProduction(): number {
    const orbitMult = 1 + 0.35 * this.state.orbit;
    const starMult = 1 + 0.08 * this.state.stars;
    return clampEcon(Math.max(1.5, this.baseProduction() * orbitMult * starMult));
  }

  productionPerSecond(): number {
    return clampEcon(this.baseProduction() * this.multiplier());
  }

  addEnergy(n: number): void {
    const s = this.state;
    s.energy = clampEcon(s.energy + n);
    s.totalEnergyThisRun = clampEcon(s.totalEnergyThisRun + n);
  }

  spend(n: number): boolean {
    if (this.state.energy < n) return false;
    this.state.energy = clampEcon(this.state.energy - n);
    return true;
  }

  private noteTier(tier: number, family: FamilyId = 0): void {
    const s = this.state;
    if (tier > s.highestTierRun) s.highestTierRun = tier;
    if (tier > s.highestTierEver) {
      s.highestTierEver = tier;
      this.fx.showNewTier(tier, family);
      this.mascot.trigger('celebrate', 2.0);
      this.onHappyMoment();
    }
  }

  private onMerge(cell: number, tier: number, family: FamilyId): void {
    if (this.comboTimer > 0) {
      this.comboCount++;
    } else {
      this.comboCount = 1;
    }
    this.comboTimer = 1.5;

    sound.playMerge(tier, family, this.comboCount - 1);
    this.refreshSim();

    const center = this.board.cellCenter(cell);
    const col = familyColor(family);
    this.fx.burst(center.x, center.y, col, 22);
    this.fx.ringBurst(center.x, center.y, col, 68);

    const cellOut = (this.sim.cellOutputs[cell] || prod(tier)) * this.multiplier();
    const comboBonus =
      this.comboCount > 1 ? Math.round(this.steadyProduction() * 1.4 * this.comboCount) : 0;
    if (comboBonus > 0) {
      this.addEnergy(comboBonus);
    }

    // Award score on every merge
    const mergeScore = Math.round(tier * CONFIG.SCORE_PER_MERGE_MULT * this.comboCount);
    this.state.score = clampEcon(this.state.score + mergeScore);

    this.fx.numberPop(
      center.x,
      center.y,
      `+${formatNumber(cellOut)}/s`,
      col,
      this.comboCount > 1 ? `x${this.comboCount}!` : `+${mergeScore} PT`,
    );

    if (tier >= 8 || this.comboCount >= 3) {
      this.fx.triggerShake(6, 0.25);
    }

    if (this.state.onboarding === 0) {
      this.state.onboarding = 1;
    }

    // In Phase 2 (Defense), merges fire a Super-Plasma Critical Beam at incoming threats!
    // In Phase 1 (City Building), merges launch visible terraforming orbs into the right-side Planet!
    if (this.meteor.hasActiveThreats()) {
      this.meteor.fireMergeShot(
        center.x,
        center.y,
        this.defenseDps() * (2.2 + this.comboCount * 0.7),
        col,
      );
    } else if (this.state.planetProgress < 100) {
      this.state.planetProgress = Math.min(
        100,
        this.state.planetProgress + CONFIG.MERGE_TERRAFORM_BOOST_PCT,
      );
      for (let k = 0; k < 2; k++) {
        this.fx.spawnPlanetOrb(center.x, center.y, PLANET_POS.x, PLANET_POS.y, col);
      }
    }

    this.mascot.trigger(this.comboCount >= 3 ? 'celebrate' : 'happy', 1.3);
    this.noteTier(tier, family);
    this.dirty = true;
  }

  private onScrap(tier: number, family: FamilyId, x: number, y: number): void {
    const refund = Math.max(4, Math.round(buyCost(tier, 0) * 0.75));
    this.addEnergy(refund);
    sound.playCoin();
    this.fx.burst(x, y, familyColor(family), 16);
    this.fx.ringBurst(x, y, PALETTE.safetyOrange, 48);
    this.fx.numberPop(x, y - 10, `+${formatNumber(refund)}`, PALETTE.phosphorAmber);
    this.refreshSim();
    this.dirty = true;
  }

  /** Finds the lowest orphaned low-tier module (< shopTier) that has no identical partner on the board. */
  private findOrphanLowTierModule(): { tier: number; family: FamilyId } | null {
    const shopT = this.currentShopTier();
    const counts = new Map<string, { tier: number; family: FamilyId; count: number }>();
    for (const idx of this.board.activeCells()) {
      const t = this.state.parts[idx];
      if (t <= 0 || t >= shopT) continue;
      const f = this.state.families[idx] ?? 0;
      const key = `${t}:${f}`;
      const cur = counts.get(key);
      if (cur) cur.count++;
      else counts.set(key, { tier: t, family: f, count: 1 });
    }
    let lowest: { tier: number; family: FamilyId } | null = null;
    for (const item of counts.values()) {
      if (item.count % 2 === 1) {
        if (!lowest || item.tier < lowest.tier) {
          lowest = { tier: item.tier, family: item.family };
        }
      }
    }
    return lowest;
  }

  /** Puts a module into an empty cell. fall = drop-in animation. */
  placePart(cell: number, tier: number, fall: boolean, family?: FamilyId): boolean {
    if (cell < 0 || !this.board.isEmpty(cell)) return false;
    const fam = family ?? this.state.selectedShopFamily ?? 0;
    this.state.parts[cell] = tier;
    this.state.families[cell] = fam;
    if (fall) {
      this.board.startSnap(cell, 0, -54, true);
    }
    this.board.pop(cell);
    this.noteTier(tier, fam);
    this.refreshSim();
    return true;
  }

  randomEmptyCell(): number {
    const res = this.drones.reserved();
    let free = this.board.emptyCells().filter((i) => !res.has(i));
    if (free.length === 0) free = this.board.emptyCells();
    return free.length ? free[Math.floor(Math.random() * free.length)] : -1;
  }

  currentShopTier(): number {
    return shopTier(this.state.highestTierRun, this.state.perks.start_tier || 0);
  }

  currentBuyCost(): number {
    const t = this.currentShopTier();
    return buyCost(t, this.state.bought[t]);
  }

  canBuy(): boolean {
    return this.board.emptyCells().length > 0 && this.state.energy >= this.currentBuyCost();
  }

  buy(): void {
    if (!this.canBuy()) return;
    const t = this.currentShopTier();
    if (!this.spend(this.currentBuyCost())) return;
    sound.playBuy();
    this.state.bought[t]++;
    const unlocked = unlockedFamilies(this.state.highestTierEver);
    const fam = unlocked.includes(this.state.selectedShopFamily)
      ? this.state.selectedShopFamily
      : 0;
    this.placePart(this.randomEmptyCell(), t, true, fam);

    if (this.state.onboarding === 1) {
      this.state.onboarding = 2;
    }

    this.dirty = true;
  }

  canFreePart(): boolean {
    return (
      !this.canBuy() &&
      this.board.emptyCells().length > 0 &&
      Date.now() - this.state.freePartAt >= FREE_PART_COOLDOWN_MS
    );
  }

  applyFreePart(): void {
    const t = this.currentShopTier();
    this.state.freePartAt = Date.now();
    this.placePart(this.randomEmptyCell(), t, true, this.state.selectedShopFamily);
    sound.playBuy();
    this.dirty = true;
  }

  extendBoost(): void {
    const now = Date.now();
    const currentRemaining = Math.max(0, this.state.boostEnd - now);
    const newRemaining = Math.min(BOOST_MAX_MS, currentRemaining + BOOST_DURATION_MS);
    this.state.boostEnd = now + newRemaining;
    this.dirty = true;
  }

  upgradeLevel(id: UpgradeId): number {
    return this.state.upgrades[id];
  }

  upgradeMaxed(id: UpgradeId): boolean {
    return this.state.upgrades[id] >= UPGRADES[id].max;
  }

  canUpgrade(id: UpgradeId): boolean {
    return (
      !this.upgradeMaxed(id) &&
      this.state.energy >= upgradeCost(id, this.state.upgrades[id])
    );
  }

  upgrade(id: UpgradeId): void {
    if (!this.canUpgrade(id)) return;
    if (!this.spend(upgradeCost(id, this.state.upgrades[id]))) return;
    sound.playBuy();
    this.state.upgrades[id]++;
    if (id === 'grid') this.board.setGridLevel(this.state.upgrades.grid);
    this.refreshSim();
    this.dirty = true;
  }

  // ---------- Launch / Next Planet Level & Tech Tree ----------
  canLaunch(): boolean {
    return this.state.planetProgress >= 100 && this.state.bossDefeated;
  }

  canAffordAnyPerk(): boolean {
    if (this.state.stars <= 0) return false;
    for (const id of PERK_IDS) {
      const lvl = this.state.perks[id] ?? 0;
      if (lvl < PERK_IDS.length && this.state.stars >= perkCost(id, lvl)) return true;
    }
    return false;
  }

  startLaunch(): void {
    if (this.launching) return;
    this.launching = true;
    this.launchT = 0;
    sound.playLaunch();
    this.fx.triggerShake(12, 1.8);
  }

  private performPrestigeReset(): void {
    const gained = prestigeStars(this.state.totalEnergyThisRun);
    this.state.stars += gained;
    this.state.score = clampEcon(this.state.score + 2500 * (this.state.orbit + 1));
    this.state.orbit = this.state.orbit + 1;
    this.state.planetProgress = 0;
    this.state.bossDefeated = false;
    this.state.energy = 25;
    this.state.totalEnergyThisRun = 0;
    const startT = 1 + (this.state.perks.start_tier || 0);
    this.state.highestTierRun = startT;
    this.state.bought.fill(0);
    this.state.upgrades.speed = 0;
    this.state.upgrades.quality = 0;
    this.state.upgrades.grid = 0;
    this.state.parts = emptyParts();
    this.state.families = emptyFamilies();
    this.state.parts[1] = startT;
    this.state.families[1] = 0;
    this.state.parts[2] = startT;
    this.state.families[2] = 0;
    this.state.parts[7] = startT;
    this.state.families[7] = 1;
    this.state.parts[8] = startT;
    this.state.families[8] = 0;
    this.board.setState(this.state);
    this.board.setGridLevel(0);
    this.drones.reset();
    this.meteor.reset();
    this.shownEnergy = 25;
    this.refreshSim();
    this.dirty = true;
  }

  // ---------- Loop ----------
  update(dt: number): void {
    if (this.paused) return;
    this.time += dt;

    if (this.comboTimer > 0) {
      this.comboTimer = Math.max(0, this.comboTimer - dt);
      if (this.comboTimer === 0) this.comboCount = 0;
    }

    // Handle Launch sequence
    if (this.launching) {
      this.launchT += dt;
      if (this.launchT < 1.6) {
        const p = this.launchT / 1.6;
        this.boardYOffset = -Math.pow(p, 2.5) * 800;
      } else if (this.launchT < 1.8) {
        if (this.boardYOffset !== 800) {
          this.performPrestigeReset();
          this.boardYOffset = 800;
        }
      } else if (this.launchT < 2.4) {
        const p = (this.launchT - 1.8) / 0.6;
        this.boardYOffset = 800 * (1 - Math.sin(p * Math.PI * 0.5));
      } else {
        this.launching = false;
        this.boardYOffset = 0;
        this.onLaunchComplete();
      }
    }

    this.refreshSim();
    this.fx.update(dt);
    const prodStep = this.productionPerSecond() * dt;
    this.addEnergy(prodStep);
    this.board.update(dt);

    const s = this.state;
    // Phase 1: Peaceful City Building (0% -> 100%)
    // Energy produced by the ship beams into the planet and advances planetProgress proportionally to planetTargetEnergy()!
    if (this.activeModuleCount() > 0 && !this.meteor.hasActiveThreats() && s.planetProgress < 100) {
      const pctGain = (prodStep / this.planetTargetEnergy()) * 100;
      s.planetProgress = Math.min(100, s.planetProgress + pctGain);
    }

    const fams = unlockedFamilies(s.highestTierEver);
    this.meteor.update(dt, this.defenseDps(), s.planetProgress, s.bossDefeated, s.orbit);
    this.mascot.update(dt, this.canLaunch() || this.meteor.hasActiveThreats());

    // Periodic visible energy particles flowing from active modules -> Ship Core -> Counter (and to Planet during Phase 1)
    this.orbSpawnTimer += dt;
    if (this.orbSpawnTimer >= 0.36) {
      this.orbSpawnTimer = 0;
      const active = this.board
        .activeCells()
        .filter((idx) => s.parts[idx] > 0);
      if (active.length > 0) {
        const pick = active[Math.floor(Math.random() * active.length)];
        const pos = this.board.cellCenter(pick);
        const col = familyColor(s.families[pick] ?? 0);
        this.fx.spawnEnergyOrb(pos.x, pos.y + this.boardYOffset, col);
        if (s.planetProgress < 100 && Math.random() < 0.55) {
          this.fx.spawnPlanetOrb(pos.x, pos.y + this.boardYOffset, PLANET_POS.x, PLANET_POS.y, col);
        }
      }
    }

    const interval = dropInterval(s.upgrades.speed, s.perks.drone_bay || 0);
    this.drones.update(dt, interval, () => {
      // Smart Orphan Matching: prevents leftover tier 1/2/3 deadlocks
      const orphan = this.findOrphanLowTierModule();
      if (orphan && Math.random() < 0.65) {
        return orphan;
      }

      const tier = rollDropTier(
        s.upgrades.quality,
        s.highestTierRun,
        s.perks.start_tier || 0,
      );
      const family =
        Math.random() < 0.55
          ? s.selectedShopFamily
          : (fams[Math.floor(Math.random() * fams.length)] ?? 0);
      return { tier, family };
    });

    // Smooth counter roll-up
    const e = s.energy;
    this.shownEnergy += (e - this.shownEnergy) * Math.min(1, dt * 11);
    if (Math.abs(e - this.shownEnergy) < 0.005 * Math.max(1, e)) this.shownEnergy = e;

    const sc = s.score;
    this.shownScore += (sc - this.shownScore) * Math.min(1, dt * 11);
    if (Math.abs(sc - this.shownScore) < 1) this.shownScore = sc;
  }

  // ---------- Input ----------
  inputEnabled = true;

  pointerDown(x: number, y: number): void {
    if (!this.inputEnabled || this.paused || this.launching) return;

    sound.unlock();

    // 1. Tap incoming Asteroid or Boss Cruiser to fire manual defense burst
    if (this.meteor.checkHit(x, y, this.defenseDps() * 1.4)) {
      return;
    }

    // 2. Check Canvas Hardware Buttons
    const b = hitButton(this.buttons, x, y);
    if (b) {
      this.pressed = b;
      return;
    }

    // 3. Board Drag
    this.board.pointerDown(x, y - this.boardYOffset);
  }

  pointerMove(x: number, y: number): void {
    if (this.launching) return;
    this.board.pointerMove(x, y - this.boardYOffset);
  }

  pointerUp(x: number, y: number): void {
    if (this.launching) return;
    const p = this.pressed;
    this.pressed = null;
    if (p) {
      if (hitButton(this.buttons, x, y) === p && p.enabled()) {
        sound.playClick();
        p.onClick();
      }
      return;
    }
    const g = this.gearHit;
    if (
      !this.board.drag &&
      x >= g.x &&
      x <= g.x + g.w &&
      y >= g.y &&
      y <= g.y + g.h
    ) {
      sound.playClick();
      this.onSettings();
      return;
    }
    this.board.pointerUp(x, y - this.boardYOffset);
  }

  pointerCancel(): void {
    this.pressed = null;
    this.board.cancelDrag();
  }

  // ---------- Hardware Console Buttons ----------
  private buildButtons(): void {
    // --- Right Panel: 4 Module Family Selector Tabs above BUY ---
    FAMILY_IDS.forEach((fam, idx) => {
      const tabW = 51;
      const tabGap = 6;
      this.buttons.push({
        x: PANEL_X + idx * (tabW + tabGap),
        y: 84,
        w: tabW,
        h: 40,
        style: 'panel',
        visible: () => true,
        enabled: () => unlockedFamilies(this.state.highestTierEver).includes(fam),
        glow: () => this.state.selectedShopFamily === fam,
        onClick: () => {
          this.state.selectedShopFamily = fam;
          this.dirty = true;
        },
        draw: (ctx, b, en) => {
          if (en) {
            drawPart(ctx, 1, b.x + b.w / 2, b.y + b.h / 2, 13, this.time, 0, false, fam);
          } else {
            ctx.save();
            ctx.font = `700 13px ${FONT_DISPLAY}`;
            ctx.fillStyle = PALETTE.chassisShade;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            const reqTier = fam === 1 ? 2 : fam === 2 ? 4 : 6;
            ctx.fillText(`T${reqTier}`, b.x + b.w / 2, b.y + b.h / 2);
            ctx.restore();
          }
        },
      });
    });

    // --- Right Panel: BUY Console ---
    const buyBtn: CanvasButton = {
      x: PANEL_X,
      y: 132,
      w: PANEL_W,
      h: 124,
      style: 'panel',
      visible: () => true,
      enabled: () => this.canBuy(),
      glow: () => this.canBuy(),
      onClick: () => this.buy(),
      draw: (ctx, b, en) => {
        const tier = this.currentShopTier();
        const fam = this.state.selectedShopFamily;
        drawPart(ctx, tier, b.x + b.w / 2, b.y + 46, 26, this.time, 0, true, fam);

        // Plus indicator badge
        ctx.save();
        ctx.fillStyle = en ? PALETTE.cellLime : PALETTE.panelDark;
        ctx.strokeStyle = PALETTE.inkDark;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(b.x + 28, b.y + 28, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = PALETTE.inkDark;
        ctx.fillRect(b.x + 21, b.y + 26, 14, 4);
        ctx.fillRect(b.x + 26, b.y + 21, 4, 14);
        ctx.restore();

        this.drawCost(ctx, this.currentBuyCost(), b.x + b.w / 2, b.y + 101, 23);
      },
    };
    this.buttons.push(buyBtn);

    // --- Right Panel: Rewarded Free Module below Scrap Box ---
    const freePartBtn: CanvasButton = {
      x: 974,
      y: 132,
      w: 62,
      h: 124,
      style: 'violet',
      visible: () => this.canFreePart(),
      enabled: () => this.canFreePart(),
      glow: () => true,
      onClick: () => this.onFreePart(),
      draw: (ctx, b) => {
        drawFilm(ctx, b.x + b.w / 2, b.y + 34, 26);
        const tier = this.currentShopTier();
        drawPart(
          ctx,
          tier,
          b.x + b.w / 2,
          b.y + 76,
          15,
          this.time,
          0,
          false,
          this.state.selectedShopFamily,
        );
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `700 14px ${FONT_DISPLAY}`;
        ctx.fillStyle = PALETTE.chassisCream;
        ctx.fillText('+1', b.x + b.w / 2, b.y + 106);
        ctx.restore();
      },
    };
    this.buttons.push(freePartBtn);

    // --- Right Panel: 3 Streamlined Hardware Upgrades (Offline duration upgrade removed!) ---
    const ups: {
      id: UpgradeId;
      labelKey: string;
      statText: () => string;
      icon: (ctx: CanvasRenderingContext2D, x: number, y: number) => void;
    }[] = [
      {
        id: 'speed',
        labelKey: 'up_speed',
        statText: () => {
          const s = dropInterval(this.state.upgrades.speed, this.state.perks.drone_bay || 0);
          return `${s.toFixed(1)}s`;
        },
        icon: (ctx, x, y) => {
          drawSpeedLines(ctx, x - 6, y, 36);
          drawDrone(ctx, x + 8, y, 42, this.time);
        },
      },
      {
        id: 'quality',
        labelKey: 'up_quality',
        statText: () => {
          const lvl = this.state.upgrades.quality;
          return `+%${lvl * 6}`;
        },
        icon: (ctx, x, y) => {
          drawDrone(ctx, x - 4, y + 4, 42, this.time);
          drawUpArrow(ctx, x + 18, y - 12, 16);
        },
      },
      {
        id: 'grid',
        labelKey: 'up_grid',
        statText: () => {
          const [c, r] = GRID_SIZES[Math.min(GRID_SIZES.length - 1, this.state.upgrades.grid)];
          return `${c}x${r}`;
        },
        icon: (ctx, x, y) => drawGridIcon(ctx, x, y, 40),
      },
    ];

    ups.forEach((u, i) => {
      this.buttons.push({
        x: PANEL_X,
        y: 274 + i * 142,
        w: PANEL_W,
        h: 128,
        style: 'panel',
        visible: () => true,
        enabled: () => this.canUpgrade(u.id),
        glow: () => this.canUpgrade(u.id),
        onClick: () => this.upgrade(u.id),
        draw: (ctx, b) => {
          const lvl = this.upgradeLevel(u.id);
          const max = UPGRADES[u.id].max;

          // Top header label + current stat badge
          ctx.save();
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.font = `700 13px ${FONT_DISPLAY}`;
          ctx.fillStyle = PALETTE.phosphorAmber;
          ctx.fillText(t(u.labelKey), b.x + 14, b.y + 20, 128);

          ctx.textAlign = 'right';
          ctx.font = `700 13px ${FONT_DISPLAY}`;
          ctx.fillStyle = PALETTE.signalCyan;
          ctx.fillText(`${u.statText()} (${lvl}/${max})`, b.x + b.w - 14, b.y + 20);

          // LED progress segments
          for (let k = 0; k < max; k++) {
            ctx.fillStyle = k < lvl ? PALETTE.cellLime : PALETTE.panelDark;
            const pw = Math.min(14, Math.floor((b.w - 104) / max) - 3);
            ctx.fillRect(b.x + 84 + k * (pw + 3), b.y + 42, pw, 8);
          }
          ctx.restore();

          u.icon(ctx, b.x + 44, b.y + 72);

          if (lvl >= max) {
            drawCheck(ctx, b.x + b.w - 38, b.y + 88, 26);
          } else {
            this.drawCost(
              ctx,
              upgradeCost(u.id, lvl),
              b.x + b.w - 14,
              b.y + 88,
              21,
              'right',
            );
          }
        },
      });
    });

    // --- Left Panel: OVERDRIVE BOOST (Rewarded Ad) ---
    const boostBtn: CanvasButton = {
      x: LEFT_X,
      y: 84,
      w: LEFT_W,
      h: 76,
      style: 'violet',
      visible: () => true,
      enabled: () => true,
      glow: () => this.isBoostActive(),
      onClick: () => this.onBoost(),
      draw: (ctx, b) => {
        drawFilm(ctx, b.x + 34, b.y + b.h / 2, 30);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `700 22px ${FONT_DISPLAY}`;
        ctx.fillStyle = PALETTE.chassisCream;
        ctx.fillText('x2', b.x + 64, b.y + 28);

        ctx.font = `700 16px ${FONT_DISPLAY}`;
        if (this.isBoostActive()) {
          const rem = (this.state.boostEnd - Date.now()) / 1000;
          ctx.fillStyle = PALETTE.phosphorAmber;
          ctx.fillText(formatTime(rem), b.x + 64, b.y + 52);
        } else {
          ctx.fillStyle = PALETTE.chassisCream;
          ctx.fillText('+4m', b.x + 64, b.y + 52);
        }
        ctx.restore();
      },
    };
    this.buttons.push(boostBtn);

    // --- Left Panel: DAILY SUPPLY LOG ---
    const dailyBtn: CanvasButton = {
      x: LEFT_X,
      y: 168,
      w: LEFT_W,
      h: 74,
      style: 'panel',
      visible: () => true,
      enabled: () => true,
      glow: () => isDailyClaimable(this.state),
      onClick: () => this.onDaily(),
      draw: (ctx, b) => {
        const claimable = isDailyClaimable(this.state);
        drawCalendar(ctx, b.x + 34, b.y + b.h / 2, 32, claimable);
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `700 19px ${FONT_DISPLAY}`;
        ctx.fillStyle = PALETTE.chassisCream;
        ctx.fillText(`D${Math.min(7, this.state.dailyStreak + 1)} / 7`, b.x + 64, b.y + 28);

        for (let d = 0; d < 7; d++) {
          ctx.fillStyle =
            d < this.state.dailyStreak
              ? PALETTE.cellLime
              : d === this.state.dailyStreak && claimable
                ? PALETTE.phosphorAmber
                : PALETTE.panelDark;
          ctx.fillRect(b.x + 64 + d * 17, b.y + 46, 13, 8);
        }
        ctx.restore();
      },
    };
    this.buttons.push(dailyBtn);

    // --- Left Panel: TECH & NEXT LEVEL LAUNCH (Short, clean title!) ---
    const techLaunchBtn: CanvasButton = {
      x: LEFT_X,
      y: 250,
      w: LEFT_W,
      h: 78,
      style: 'gold',
      visible: () => true,
      enabled: () => true,
      glow: () => this.canLaunch() || this.canAffordAnyPerk(),
      onClick: () => this.onPrestige(),
      draw: (ctx, b) => {
        const launchReady = this.canLaunch();
        if (launchReady) {
          drawRocket(ctx, b.x + 34, b.y + b.h / 2, 32, true);
        } else {
          drawTechIcon(ctx, b.x + 34, b.y + b.h / 2, 32);
        }
        ctx.save();
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.font = `700 17px ${FONT_DISPLAY}`;
        ctx.fillStyle = PALETTE.inkDark;
        ctx.fillText(
          launchReady ? t('launch') : t('techTitle'),
          b.x + 62,
          b.y + 27,
          b.w - 70,
        );

        ctx.font = `700 14px ${FONT_DISPLAY}`;
        ctx.fillStyle = PALETTE.inkDark;
        if (launchReady) {
          const stars = prestigeStars(this.state.totalEnergyThisRun);
          ctx.fillText(`+${formatNumber(stars)} ★`, b.x + 62, b.y + 52);
        } else {
          ctx.fillText(`Lv.${this.state.orbit + 1} • %${Math.floor(this.state.planetProgress)}`, b.x + 62, b.y + 52);
        }
        ctx.restore();
      },
    };
    this.buttons.push(techLaunchBtn);
  }

  /** Bolt icon + formatted number inside a recessed CRT readout pill. */
  private drawCost(
    ctx: CanvasRenderingContext2D,
    cost: number,
    x: number,
    y: number,
    size: number,
    align: 'center' | 'right' = 'center',
  ): void {
    const txt = formatNumber(cost);
    ctx.save();
    ctx.font = `700 ${size}px ${FONT_DISPLAY}`;
    const tw = ctx.measureText(txt).width;
    const iw = size * 0.88;
    const total = iw + 5 + tw;
    const left = align === 'center' ? x - total / 2 : x - total;
    drawCRTScreen(ctx, left - 8, y - size * 0.65, total + 16, size * 1.3);
    drawBolt(ctx, left + iw / 2, y, iw);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle =
      this.state.energy >= cost ? PALETTE.phosphorAmber : PALETTE.oxideRed;
    ctx.fillText(txt, left + iw + 5, y + 1);
    ctx.restore();
  }

  // ---------- Drawing ----------
  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (this.fx.shakeX !== 0 || this.fx.shakeY !== 0) {
      ctx.translate(this.fx.shakeX, this.fx.shakeY);
    }

    ctx.save();
    if (this.boardYOffset !== 0) {
      ctx.translate(0, this.boardYOffset);
    }

    if (this.launching && this.launchT < 1.6) {
      this.drawLaunchFlames(ctx);
    }

    this.board.draw(ctx, this.time, this.sim.links);
    this.drawDropBar(ctx);
    this.drones.draw(ctx, this.time);
    ctx.restore();

    // Right-Side Planet HUD Badge directly below the Full-Sphere Planet
    this.drawPlanetRightHud(ctx);

    // Left-Side Mission & Defense Radar Console
    this.drawPlanetDefensePanel(ctx);

    // KIBO-7 Maintenance Robot Mascot in bottom-left bay
    this.mascot.draw(ctx, LEFT_X + LEFT_W / 2, 650);

    // Incoming Asteroids, Boss Cruisers & Defense Lasers
    this.meteor.draw(ctx, this.time);
    this.fx.draw(ctx);

    // Onboarding EVA glove pointer
    drawOnboarding(
      ctx,
      this.state,
      this.board,
      { x: PANEL_X + PANEL_W / 2, y: 132 + 62 },
      this.time,
    );

    drawButtons(ctx, this.buttons, this.pressed, this.time);
    this.drawTopBar(ctx);

    if (this.fx.newTierShowcase) {
      this.drawNewTierBanner(
        ctx,
        this.fx.newTierShowcase.tier,
        this.fx.newTierShowcase.family,
      );
    }

    ctx.restore();
  }

  /** Draws a clean telemetry badge directly beneath the right-side Full-Sphere Planet. */
  private drawPlanetRightHud(ctx: CanvasRenderingContext2D): void {
    const cx = PLANET_POS.x;
    const y = PLANET_POS.y + PLANET_POS.r + 18;
    const w = 196;
    const h = 66;
    const x = cx - w / 2;
    const pct = Math.min(100, Math.floor(this.state.planetProgress));
    const underAttack = this.meteor.hasActiveThreats();
    const isBoss = this.meteor.hasBossActive();
    const stageIdx =
      pct >= 100 ? 4 : pct >= 75 ? 3 : pct >= 50 ? 2 : pct >= 25 ? 1 : 0;
    const planetKey = `planet${(this.state.orbit % 4) + 1}`;

    drawHardwarePanel(ctx, x, y, w, h, {
      variant: 'steel',
      chamfer: 8,
      rivets: false,
      activeBorder: underAttack
        ? PALETTE.oxideRed
        : pct >= 100
          ? PALETTE.cellLime
          : PALETTE.signalCyan,
    });
    drawCRTScreen(ctx, x + 6, y + 6, w - 12, h - 12);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 13px ${FONT_DISPLAY}`;
    ctx.fillStyle = PALETTE.phosphorAmber;
    ctx.fillText(
      `LV.${this.state.orbit + 1} ${t(planetKey)} • %${pct}`,
      cx,
      y + 22,
      w - 20,
    );

    ctx.font = `700 12px ${FONT_UI}`;
    ctx.fillStyle = underAttack ? PALETTE.oxideRed : pct >= 100 ? PALETTE.cellLime : PALETTE.signalCyan;
    const subLabel = underAttack
      ? isBoss
        ? t('bossAttack')
        : `${t('waveUnderAttack')} ${this.meteor.waveNumber}/${CONFIG.WAVES_PER_LEVEL}`
      : t(`stage${stageIdx}`);
    ctx.fillText(subLabel, cx, y + 44, w - 20);
    ctx.restore();
  }

  private drawPlanetDefensePanel(ctx: CanvasRenderingContext2D): void {
    const x = LEFT_X;
    const y = PLANET_PANEL_Y;
    const w = LEFT_W;
    const h = PLANET_PANEL_H;
    const pct = Math.min(100, Math.floor(this.state.planetProgress));
    const inDefensePhase = pct >= 100 || this.meteor.waveNumber > 0;
    const underAttack = this.meteor.hasActiveThreats();
    const isBoss = this.meteor.hasBossActive();

    drawHardwarePanel(ctx, x, y, w, h, {
      variant: 'steel',
      chamfer: 9,
      rivets: true,
      shadow: true,
      activeBorder: underAttack
        ? PALETTE.oxideRed
        : this.canLaunch()
          ? PALETTE.cellLime
          : PALETTE.signalCyan,
    });

    // Phase Header (BUILD CITY vs DEFEND!)
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 15px ${FONT_DISPLAY}`;
    ctx.fillStyle = underAttack ? PALETTE.oxideRed : inDefensePhase ? PALETTE.cellLime : PALETTE.phosphorAmber;
    ctx.fillText(
      inDefensePhase ? t('phaseDefend') : t('phaseBuild'),
      x + w / 2,
      y + 22,
      w - 20,
    );

    // Terraforming / City Building Screen
    drawCRTScreen(ctx, x + 10, y + 36, w - 20, 96);

    const stageIdx =
      pct >= 100 ? 4 : pct >= 75 ? 3 : pct >= 50 ? 2 : pct >= 25 ? 1 : 0;
    ctx.font = `700 13px ${FONT_UI}`;
    ctx.fillStyle = PALETTE.chassisCream;
    ctx.fillText(t(`stage${stageIdx}`), x + w / 2, y + 54, w - 28);

    // Big % Readout
    ctx.font = `700 28px ${FONT_DISPLAY}`;
    ctx.fillStyle = pct >= 100 ? PALETTE.cellLime : PALETTE.signalCyan;
    ctx.fillText(`%${pct}`, x + w / 2, y + 84);

    // Progress Bar inside CRT
    const bx = x + 18;
    const by = y + 108;
    const bw = w - 36;
    const bh = 12;
    chamferRectPath(ctx, bx, by, bw, bh, 3);
    ctx.fillStyle = '#070c14';
    ctx.fill();
    if (pct > 0) {
      chamferRectPath(ctx, bx + 2, by + 2, Math.max(6, ((bw - 4) * pct) / 100), bh - 4, 2);
      ctx.fillStyle = pct >= 100 ? PALETTE.cellLime : PALETTE.signalCyan;
      ctx.fill();
    }

    // Station Defense Laser Readout
    drawCRTScreen(ctx, x + 10, y + 140, w - 20, 36);
    ctx.font = `700 12px ${FONT_DISPLAY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.chassisCream;
    ctx.fillText(t('defensePower'), x + 18, y + 159);
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.cellLime;
    ctx.fillText(`${formatNumber(this.defenseDps())}/s`, x + w - 18, y + 159);

    // Phase Status Bar
    drawCRTScreen(
      ctx,
      x + 10,
      y + 184,
      w - 20,
      36,
      underAttack ? PALETTE.oxideRed : PALETTE.signalCyan,
    );
    ctx.textAlign = 'center';
    ctx.font = `700 12px ${FONT_DISPLAY}`;
    if (this.canLaunch()) {
      ctx.fillStyle = PALETTE.cellLime;
      ctx.fillText(t('launch'), x + w / 2, y + 203, w - 28);
    } else if (underAttack) {
      const blink = 0.65 + 0.35 * Math.sin(this.time * 10);
      ctx.fillStyle = `rgba(224, 90, 43, ${blink})`;
      ctx.fillText(
        isBoss
          ? t('bossAttack')
          : `${t('waveUnderAttack')} ${this.meteor.waveNumber}/${CONFIG.WAVES_PER_LEVEL}`,
        x + w / 2,
        y + 203,
        w - 28,
      );
    } else if (inDefensePhase) {
      ctx.fillStyle = PALETTE.phosphorAmber;
      const secs = Math.ceil(this.meteor.waveCooldown);
      ctx.fillText(
        `${t('waveIncoming')} ${this.meteor.waveNumber + 1}/${CONFIG.WAVES_PER_LEVEL}: ${secs}s`,
        x + w / 2,
        y + 203,
        w - 28,
      );
    } else {
      ctx.fillStyle = PALETTE.signalCyan;
      ctx.fillText(`${t('phaseBuild')} %${pct}/100`, x + w / 2, y + 203, w - 28);
    }
    ctx.restore();
  }

  private drawNewTierBanner(
    ctx: CanvasRenderingContext2D,
    tier: number,
    family: FamilyId,
  ): void {
    ctx.save();
    ctx.fillStyle = 'rgba(11, 19, 30, 0.72)';
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2;
    const cy = H / 2;

    drawHardwarePanel(ctx, cx - 115, cy - 115, 230, 230, {
      variant: 'cream',
      chamfer: 14,
      rivets: true,
      activeBorder: tierColor(tier, family),
    });

    drawCRTScreen(ctx, cx - 92, cy - 92, 184, 184, tierColor(tier, family));
    drawPart(ctx, tier, cx, cy, 62, this.time * 2, 0, true, family);

    ctx.restore();
  }

  private drawLaunchFlames(ctx: CanvasRenderingContext2D): void {
    const b = this.board;
    const bx = b.x0 + (b.cols * CELL) / 2;
    const by = b.y0 + b.rows * CELL + 20;

    for (const offset of [-115, 0, 115]) {
      const x = bx + offset;
      const len = 70 + Math.random() * 50;
      const g = ctx.createLinearGradient(x, by, x, by + len);
      g.addColorStop(0, PALETTE.phosphorAmber);
      g.addColorStop(0.4, PALETTE.safetyOrange);
      g.addColorStop(1, 'rgba(209, 59, 52, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x - 22, by);
      ctx.lineTo(x + 22, by);
      ctx.lineTo(x, by + len);
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawDropBar(ctx: CanvasRenderingContext2D): void {
    const b = this.board;
    const w = b.cols * CELL;
    const y = b.y0 + b.rows * CELL + 22;
    const x = b.x0 + 36;
    const bw = w - 36;
    const interval = dropInterval(
      this.state.upgrades.speed,
      this.state.perks.drone_bay || 0,
    );
    const k = this.drones.progress(interval);
    drawDrone(ctx, b.x0 + 12, y + 4, 34, this.time);

    chamferRectPath(ctx, x, y, bw, 10, 3);
    ctx.fillStyle = PALETTE.crtDark;
    ctx.fill();
    ctx.strokeStyle = PALETTE.inkDark;
    ctx.lineWidth = 2;
    ctx.stroke();

    if (k > 0) {
      chamferRectPath(ctx, x + 2, y + 2, Math.max(6, (bw - 4) * k), 6, 2);
      ctx.fillStyle = PALETTE.signalCyan;
      ctx.fill();
    }
  }

  private drawTopBar(ctx: CanvasRenderingContext2D): void {
    // Top Industrial Telemetry Header Bar
    drawHardwarePanel(ctx, 16, 6, W - 32, 64, {
      variant: 'cream',
      chamfer: 10,
      rivets: true,
      shadow: true,
    });

    // Left Telemetry Readout: Planet Level & Score
    drawCRTScreen(ctx, 32, 14, 290, 48);
    drawRocket(ctx, 52, 38, 22, false);
    ctx.save();
    ctx.font = `700 16px ${FONT_DISPLAY}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.signalCyan;
    const planetKey = `planet${(this.state.orbit % 4) + 1}`;
    ctx.fillText(`LV.${this.state.orbit + 1} ${t(planetKey)}`, 68, 39);

    // Score Readout on right half of left CRT
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.phosphorAmber;
    ctx.fillText(`${t('score')}: ${formatNumber(Math.round(this.shownScore))}`, 310, 39);
    ctx.restore();

    // Center Main CRT Energy Readout
    drawCRTScreen(ctx, 344, 12, 460, 52);
    ctx.save();
    ctx.textBaseline = 'middle';
    const txt = formatNumber(this.shownEnergy);
    ctx.font = `700 30px ${FONT_DISPLAY}`;
    const tw = ctx.measureText(txt).width;
    const cx = 520;
    drawBolt(ctx, cx - tw / 2 - 20, 38, 26, PALETTE.phosphorAmber);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.phosphorAmber;
    ctx.fillText(txt, cx - tw / 2 + 2, 39);

    // Rate per second on right side of center CRT
    ctx.font = `700 17px ${FONT_DISPLAY}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = PALETTE.signalCyan;
    ctx.fillText(`+${formatNumber(this.productionPerSecond())}/s`, 790, 39);
    ctx.restore();

    // Synergy Links Readout CRT
    drawCRTScreen(ctx, 820, 15, 196, 46);
    ctx.save();
    ctx.font = `700 16px ${FONT_DISPLAY}`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillStyle = this.sim.links.length > 0 ? PALETTE.cellLime : PALETTE.chassisShade;
    ctx.fillText(`LINK x${this.sim.links.length}`, 918, 39);
    ctx.restore();

    // Right Stars Counter CRT
    drawCRTScreen(ctx, 1030, 15, 166, 46);
    ctx.save();
    ctx.font = `700 22px ${FONT_DISPLAY}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.phosphorAmber;
    const st = formatNumber(this.state.stars);
    ctx.fillText(st, 1182, 39);
    drawStar(ctx, 1054, 38, 24, PALETTE.phosphorAmber);
    ctx.restore();

    // Far Right Settings Gear Switch
    drawHardwarePanel(ctx, 1208, 13, 50, 50, {
      variant: 'steel',
      chamfer: 6,
      rivets: false,
      shadow: false,
    });
    drawGear(ctx, 1233, 38, 28, PALETTE.chassisCream);
  }
}
