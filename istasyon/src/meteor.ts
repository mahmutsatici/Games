// Two-Phase Planetary Wave Defense & Final Boss System:
// Phase 1 (planetProgress < 100%): Zero attacks! The player focuses 100% on building the city.
// Phase 2 (planetProgress >= 100%): Wave 1 -> Wave 2 -> Wave 3 (Final Boss Cruiser) attack the right-side sphere planet!
import { sound } from './audio';
import { CORE_POS, PLANET_POS } from './background';
import { CONFIG } from './config';
import { formatNumber } from './format';
import { t } from './i18n';
import {
  FONT_DISPLAY,
  PALETTE,
  STROKE_W,
  chamferRectPath,
  drawCRTScreen,
  drawHardwarePanel,
  easeOutCubic,
} from './theme';

export interface Threat {
  id: number;
  isBoss: boolean;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  speed: number;
  hp: number;
  maxHp: number;
  hitFlash: number;
}

interface LaserBeam {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  color: string;
  width: number;
  t: number;
  maxT: number;
}

export interface DefenseCallbacks {
  onThreatDestroyed(x: number, y: number, isBoss: boolean): void;
  onPlanetHit(x: number, y: number, isBoss: boolean): void;
  getCollectorPositions(): { x: number; y: number }[];
}

export class MeteorManager {
  threats: Threat[] = [];
  private beams: LaserBeam[] = [];
  /** Seconds until next wave spawns once in Defense Phase */
  waveCooldown = CONFIG.WAVE_PREP_SECONDS;
  /** Current wave index in Phase 2 (0 = not started, 1 = Wave 1, 2 = Wave 2, 3 = Final Boss) */
  waveNumber = 0;
  private turretCooldown = 0;
  private nextId = 1;
  shieldFlash = 0;
  statusBanner: { text: string; color: string; timer: number } | null = null;

  constructor(private cb: DefenseCallbacks) {}

  reset(): void {
    this.threats = [];
    this.beams = [];
    this.waveCooldown = CONFIG.WAVE_PREP_SECONDS;
    this.waveNumber = 0;
    this.shieldFlash = 0;
    this.statusBanner = null;
  }

  hasActiveThreats(): boolean {
    return this.threats.length > 0;
  }

  hasBossActive(): boolean {
    return this.threats.some((th) => th.isBoss);
  }

  showBanner(text: string, color: string, duration = 2.2): void {
    this.statusBanner = { text, color, timer: duration };
  }

  /** Spawns a wave of Planet-bound Asteroids or the Final Invasion Boss Cruiser targeting PLANET_POS */
  spawnWave(dps: number, level = 0, forceBoss = false): void {
    this.waveNumber = Math.min(CONFIG.WAVES_PER_LEVEL, this.waveNumber + 1);
    const isBossWave = forceBoss || this.waveNumber >= CONFIG.WAVES_PER_LEVEL;
    const levelScale = 1 + level * 0.45;

    if (isBossWave) {
      sound.playEvent('flare');
      const bossHp = Math.max(220, Math.round(dps * CONFIG.BOSS_HP_DPS_MULT * levelScale));
      this.threats.push({
        id: this.nextId++,
        isBoss: true,
        x: PLANET_POS.x + 25,
        y: 660,
        targetX: PLANET_POS.x,
        targetY: PLANET_POS.y + PLANET_POS.r * 0.55,
        speed: CONFIG.BOSS_SPEED_BASE + level * 1.5,
        hp: bossHp,
        maxHp: bossHp,
        hitFlash: 0,
      });
      this.showBanner(t('bossAttack'), PALETTE.oxideRed, 3.0);
    } else {
      sound.playEvent('shower');
      const count = CONFIG.ASTEROID_COUNT_BASE + (this.waveNumber - 1) + Math.min(2, level);
      for (let i = 0; i < count; i++) {
        // Spawn from bottom/right deep space corridor heading toward the spherical planet at (908, 268)
        const angle = Math.PI * 0.32 + (i / Math.max(1, count - 1)) * Math.PI * 0.42;
        const dist = 285 + i * 36;
        const sx = Math.min(1015, Math.max(815, PLANET_POS.x + Math.cos(angle) * dist * 0.35));
        const sy = Math.min(690, PLANET_POS.y + PLANET_POS.r + 170 + i * 38);
        const hp = Math.max(
          45,
          Math.round(dps * CONFIG.ASTEROID_HP_DPS_MULT * (0.9 + 0.2 * this.waveNumber) * levelScale),
        );
        this.threats.push({
          id: this.nextId++,
          isBoss: false,
          x: sx,
          y: sy,
          targetX: PLANET_POS.x + (Math.random() - 0.5) * 44,
          targetY: PLANET_POS.y + PLANET_POS.r * 0.65,
          speed: CONFIG.ASTEROID_SPEED_BASE + Math.random() * 7 + level * 2,
          hp,
          maxHp: hp,
          hitFlash: 0,
        });
      }
      this.showBanner(`${t('waveUnderAttack')} ${this.waveNumber}/${CONFIG.WAVES_PER_LEVEL}`, PALETTE.phosphorAmber, 2.4);
    }
  }

  /** Called when the player merges two modules on the board: fires a Super-Plasma Crit Beam! */
  fireMergeShot(fromX: number, fromY: number, damage: number, color: string): void {
    if (this.threats.length === 0) return;
    const target = this.getPriorityTarget();
    if (!target) return;

    this.beams.push({
      fromX,
      fromY,
      toX: target.x,
      toY: target.y,
      color,
      width: 7.5,
      t: 0.3,
      maxT: 0.3,
    });
    this.damageThreat(target, damage);
  }

  private getPriorityTarget(): Threat | null {
    if (this.threats.length === 0) return null;
    let best = this.threats[0];
    let bestDist = Math.hypot(best.x - PLANET_POS.x, best.y - PLANET_POS.y);
    for (const th of this.threats) {
      const d = Math.hypot(th.x - PLANET_POS.x, th.y - PLANET_POS.y);
      if (th.isBoss && !best.isBoss) {
        best = th;
        bestDist = d;
      } else if (th.isBoss === best.isBoss && d < bestDist) {
        best = th;
        bestDist = d;
      }
    }
    return best;
  }

  private damageThreat(th: Threat, dmg: number): void {
    th.hp -= dmg;
    th.hitFlash = 0.14;
    if (th.hp <= 0) {
      const idx = this.threats.indexOf(th);
      if (idx >= 0) this.threats.splice(idx, 1);
      this.cb.onThreatDestroyed(th.x, th.y, th.isBoss);
      if (this.threats.length === 0) {
        this.showBanner(t('waveCleared'), PALETTE.cellLime, 2.0);
      }
    }
  }

  update(
    dt: number,
    defenseDps: number,
    planetProgress: number,
    bossDefeated: boolean,
    level = 0,
  ): void {
    if (this.shieldFlash > 0) {
      this.shieldFlash = Math.max(0, this.shieldFlash - dt * 2.5);
    }
    if (this.statusBanner) {
      this.statusBanner.timer -= dt;
      if (this.statusBanner.timer <= 0) this.statusBanner = null;
    }

    // Update laser beams even during Phase 1
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].t -= dt;
      if (this.beams[i].t <= 0) this.beams.splice(i, 1);
    }

    // STRICT TWO-PHASE RULE:
    // While planetProgress < 100 and no threats are active, NO attacks occur!
    // The player focuses 100% on building the city.
    if (planetProgress < 100 && this.threats.length === 0 && this.waveNumber === 0) {
      return;
    }

    // Once planet reaches 100% (or defense waves have already begun), run Wave 1 -> Wave 2 -> Wave 3 (Final Boss)
    if (!bossDefeated && this.threats.length === 0) {
      this.waveCooldown -= dt;
      if (this.waveCooldown <= 0) {
        this.spawnWave(defenseDps, level, this.waveNumber + 1 >= CONFIG.WAVES_PER_LEVEL);
        this.waveCooldown = CONFIG.WAVE_PREP_SECONDS;
      }
    }

    // Auto-Defense Turret & Collector Beams fire every 0.45s at closest threat
    if (this.threats.length > 0) {
      this.turretCooldown -= dt;
      if (this.turretCooldown <= 0) {
        this.turretCooldown = 0.45;
        const target = this.getPriorityTarget();
        if (target) {
          const shotDmg = defenseDps * 0.42;
          this.beams.push({
            fromX: CORE_POS.x + 24,
            fromY: CORE_POS.y + 4,
            toX: target.x + (Math.random() - 0.5) * 10,
            toY: target.y + (Math.random() - 0.5) * 10,
            color: PALETTE.phosphorAmber,
            width: 3.8,
            t: 0.18,
            maxT: 0.18,
          });

          // Collector modules also fire supporting cyan beams
          const cols = this.cb.getCollectorPositions();
          for (let i = 0; i < Math.min(3, cols.length); i++) {
            this.beams.push({
              fromX: cols[i].x,
              fromY: cols[i].y,
              toX: target.x,
              toY: target.y,
              color: PALETTE.signalCyan,
              width: 2.6,
              t: 0.18,
              maxT: 0.18,
            });
          }

          this.damageThreat(target, shotDmg * (1 + cols.length * 0.15));
        }
      }
    }

    // Move threats toward the spherical planet on the right
    for (let i = this.threats.length - 1; i >= 0; i--) {
      const th = this.threats[i];
      if (th.hitFlash > 0) th.hitFlash = Math.max(0, th.hitFlash - dt);

      const dx = th.targetX - th.x;
      const dy = th.targetY - th.y;
      const dist = Math.hypot(dx, dy);
      if (dist <= th.speed * dt + 14) {
        this.threats.splice(i, 1);
        this.shieldFlash = 1;
        this.showBanner(t('planetHit'), PALETTE.oxideRed, 2.4);
        this.cb.onPlanetHit(th.x, th.y, th.isBoss);
        // If Boss hit the planet without dying, step back wave so Boss re-attacks
        if (th.isBoss) {
          this.waveNumber = Math.max(0, CONFIG.WAVES_PER_LEVEL - 1);
        }
        continue;
      }
      th.x += (dx / dist) * th.speed * dt;
      th.y += (dy / dist) * th.speed * dt;
    }
  }

  /** Clicking/tapping a threat fires a manual point-defense laser burst! */
  checkHit(x: number, y: number, defenseDps = 10): boolean {
    for (let i = this.threats.length - 1; i >= 0; i--) {
      const th = this.threats[i];
      const hitR = th.isBoss ? 58 : 42;
      const dx = x - th.x;
      const dy = y - th.y;
      if (dx * dx + dy * dy <= hitR * hitR) {
        sound.playClick();
        this.beams.push({
          fromX: CORE_POS.x + 24,
          fromY: CORE_POS.y + 4,
          toX: th.x,
          toY: th.y,
          color: PALETTE.cellLime,
          width: 5.5,
          t: 0.22,
          maxT: 0.22,
        });
        this.damageThreat(th, Math.max(15, defenseDps * 1.4));
        return true;
      }
    }
    return false;
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    // 1. Defense Laser Beams
    for (const b of this.beams) {
      const alpha = easeOutCubic(b.t / b.maxT);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = b.color;
      ctx.lineWidth = b.width;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.fromX, b.fromY);
      ctx.lineTo(b.toX, b.toY);
      ctx.stroke();

      ctx.strokeStyle = '#FFF3B0';
      ctx.lineWidth = b.width * 0.4;
      ctx.stroke();
      ctx.restore();
    }

    // 2. Threats approaching the spherical planet on the right
    for (const th of this.threats) {
      ctx.save();
      ctx.translate(th.x, th.y);

      if (th.isBoss) {
        this.drawBossCruiser(ctx, th, time);
      } else {
        this.drawAsteroid(ctx, th, time);
      }

      // Health Bar below threat
      const bw = th.isBoss ? 104 : 52;
      const bh = th.isBoss ? 10 : 7;
      const by = th.isBoss ? 34 : 22;
      ctx.fillStyle = PALETTE.inkDark;
      ctx.fillRect(-bw / 2 - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = '#2D1618';
      ctx.fillRect(-bw / 2, by, bw, bh);
      const hpPct = Math.max(0, Math.min(1, th.hp / th.maxHp));
      ctx.fillStyle = th.isBoss ? PALETTE.oxideRed : PALETTE.safetyOrange;
      ctx.fillRect(-bw / 2, by, bw * hpPct, bh);

      if (th.isBoss) {
        ctx.font = `700 12px ${FONT_DISPLAY}`;
        ctx.fillStyle = PALETTE.chassisCream;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(formatNumber(Math.max(0, th.hp)), 0, by + bh + 3);
      }

      ctx.restore();
    }

    // 3. Wave Status Alert Banner above the planet corridor
    if (this.statusBanner) {
      const b = this.statusBanner;
      const bx = PLANET_POS.x - 110;
      const by = 82;
      drawHardwarePanel(ctx, bx, by, 220, 32, {
        variant: 'steel',
        chamfer: 6,
        rivets: false,
        activeBorder: b.color,
      });
      drawCRTScreen(ctx, bx + 4, by + 4, 212, 24, b.color);
      ctx.save();
      ctx.font = `700 13px ${FONT_DISPLAY}`;
      ctx.fillStyle = b.color;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.text, PLANET_POS.x, by + 16, 200);
      ctx.restore();
    }
  }

  private drawAsteroid(ctx: CanvasRenderingContext2D, th: Threat, time: number): void {
    // Atmospheric plasma trail pointing down-right (away from planet)
    ctx.fillStyle = PALETTE.safetyOrange;
    ctx.strokeStyle = PALETTE.inkDark;
    ctx.lineWidth = STROKE_W;
    ctx.beginPath();
    ctx.moveTo(-11, 6);
    ctx.lineTo(0, 32 + Math.sin(time * 24 + th.id) * 6);
    ctx.lineTo(11, 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Jagged asteroid body
    chamferRectPath(ctx, -16, -16, 32, 32, 9);
    ctx.fillStyle = th.hitFlash > 0 ? '#FFF3B0' : '#5A3828';
    ctx.fill();
    ctx.stroke();

    // Glowing magma core
    ctx.fillStyle = PALETTE.phosphorAmber;
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawBossCruiser(ctx: CanvasRenderingContext2D, th: Threat, time: number): void {
    // Dreadnought wings pointing up toward the planet
    ctx.fillStyle = th.hitFlash > 0 ? '#FFF3B0' : PALETTE.oxideRed;
    ctx.strokeStyle = PALETTE.inkDark;
    ctx.lineWidth = STROKE_W;
    ctx.beginPath();
    ctx.moveTo(0, -32);
    ctx.lineTo(-46, 14);
    ctx.lineTo(-26, 28);
    ctx.lineTo(26, 28);
    ctx.lineTo(46, 14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Armored inner hull
    chamferRectPath(ctx, -22, -18, 44, 36, 8);
    ctx.fillStyle = th.hitFlash > 0 ? '#FFF3B0' : PALETTE.panelSteel;
    ctx.fill();
    ctx.stroke();

    // Pulsing weapon core
    const pulse = 1 + 0.15 * Math.sin(time * 10);
    ctx.fillStyle = PALETTE.phosphorAmber;
    ctx.beginPath();
    ctx.arc(0, -2, 9 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  }
}
