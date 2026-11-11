// Game Feel & Visual Effects:
// - Ring bursts & flash on merge
// - Floating output number pops & combo badges (easeOutBack)
// - Two-stage Energy Flow particles: Module -> Station Reactor Core -> Top Counter
// - Screen shake & particle bursts
import { CORE_POS } from './background';
import type { FamilyId } from './economy';
import { FONT_DISPLAY, PALETTE, easeInOutCubic, easeOutBack, easeOutCubic } from './theme';
import { W } from './view';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface RingBurst {
  x: number;
  y: number;
  maxR: number;
  color: string;
  t: number;
  duration: number;
}

interface FloatingPop {
  x: number;
  y: number;
  text: string;
  subText?: string;
  color: string;
  t: number;
  duration: number;
}

interface EnergyOrb {
  sx: number;
  sy: number;
  cx: number;
  cy: number;
  tx: number;
  ty: number;
  t: number;
  duration: number;
  phase: 0 | 1; // 0: module -> core, 1: core -> top counter
  color: string;
  size: number;
}

export class FX {
  private particles: Particle[] = [];
  private rings: RingBurst[] = [];
  private pops: FloatingPop[] = [];
  private orbs: EnergyOrb[] = [];
  private shakeTimer = 0;
  private shakeIntensity = 0;
  shakeX = 0;
  shakeY = 0;

  newTierShowcase: { tier: number; family: FamilyId; timer: number } | null = null;

  triggerShake(intensity = 6, duration = 0.25): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTimer = Math.max(this.shakeTimer, duration);
  }

  burst(x: number, y: number, color: string, count = 20): void {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.3;
      const speed = 60 + Math.random() * 170;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.45 + Math.random() * 0.25,
        maxLife: 0.7,
        color,
        size: 3.5 + Math.random() * 4,
      });
    }
  }

  ringBurst(x: number, y: number, color: string, maxR = 72): void {
    this.rings.push({ x, y, maxR, color, t: 0, duration: 0.42 });
  }

  numberPop(x: number, y: number, text: string, color: string = PALETTE.chassisCream, subText?: string): void {
    this.pops.push({ x, y, text, subText, color, t: 0, duration: 1.05 });
  }

  /** Spawns a visible energy particle flowing from a board module -> Station Core -> Top Counter. */
  spawnEnergyOrb(x: number, y: number, color: string): void {
    if (this.orbs.length > 48) return;
    const spread = (Math.random() - 0.5) * 90;
    this.orbs.push({
      sx: x,
      sy: y,
      cx: (x + CORE_POS.x) * 0.5 + spread,
      cy: Math.min(y, CORE_POS.y) - 30,
      tx: CORE_POS.x,
      ty: CORE_POS.y + 8,
      t: 0,
      duration: 0.65 + Math.random() * 0.2,
      phase: 0,
      color,
      size: 3.8,
    });
  }

  /** Spawns a terraforming energy pulse flowing from a merged module directly into the right-side Planet! */
  spawnPlanetOrb(x: number, y: number, targetX: number, targetY: number, color: string): void {
    if (this.orbs.length > 56) return;
    this.orbs.push({
      sx: x,
      sy: y,
      cx: (x + targetX) * 0.5,
      cy: Math.min(y, targetY) - 65,
      tx: targetX + (Math.random() - 0.5) * 36,
      ty: targetY + (Math.random() - 0.5) * 36,
      t: 0,
      duration: 0.58 + Math.random() * 0.15,
      phase: 1, // single-stage arc straight to planet
      color,
      size: 4.8,
    });
  }

  showNewTier(tier: number, family: FamilyId = 0): void {
    this.newTierShowcase = { tier, family, timer: 1.5 };
  }

  update(dt: number): void {
    // Shake with cubic decay
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      const k = easeOutCubic(Math.max(0, this.shakeTimer / 0.3));
      this.shakeX = (Math.random() - 0.5) * this.shakeIntensity * k;
      this.shakeY = (Math.random() - 0.5) * this.shakeIntensity * k;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
      this.shakeIntensity = 0;
    }

    if (this.newTierShowcase) {
      this.newTierShowcase.timer -= dt;
      if (this.newTierShowcase.timer <= 0) {
        this.newTierShowcase = null;
      }
    }

    // Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.exp(-dt * 3);
      p.vy *= Math.exp(-dt * 3);
    }

    // Rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t >= r.duration) this.rings.splice(i, 1);
    }

    // Floating Pops
    for (let i = this.pops.length - 1; i >= 0; i--) {
      const pop = this.pops[i];
      pop.t += dt;
      if (pop.t >= pop.duration) this.pops.splice(i, 1);
    }

    // Energy Flow Orbs (Module -> Station Core -> Counter)
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i];
      o.t += dt;
      if (o.t >= o.duration) {
        if (o.phase === 0) {
          // Transition to Phase 1: Station Core -> Top Energy Readout
          o.phase = 1;
          o.sx = CORE_POS.x;
          o.sy = CORE_POS.y + 8;
          o.cx = W / 2;
          o.cy = 58;
          o.tx = W / 2;
          o.ty = 32;
          o.t = 0;
          o.duration = 0.28;
          o.size = 4.6;
        } else {
          this.orbs.splice(i, 1);
        }
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // 1. Energy Flow Orbs
    for (const o of this.orbs) {
      const k = easeInOutCubic(o.t / o.duration);
      const inv = 1 - k;
      const x = inv * inv * o.sx + 2 * inv * k * o.cx + k * k * o.tx;
      const y = inv * inv * o.sy + 2 * inv * k * o.cy + k * k * o.ty;

      ctx.save();
      ctx.fillStyle = o.color;
      ctx.beginPath();
      ctx.arc(x, y, o.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#FFF3B0';
      ctx.beginPath();
      ctx.arc(x, y, o.size * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 2. Ring Bursts & Merge Flash
    for (const r of this.rings) {
      const k = easeOutCubic(r.t / r.duration);
      const alpha = 1 - k;
      ctx.save();
      if (r.t < 0.1) {
        // Initial white-amber impact flash
        ctx.globalAlpha = (1 - r.t / 0.1) * 0.65;
        ctx.fillStyle = '#FFF3B0';
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.maxR * 0.65, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 5 * (1 - k * 0.6);
      ctx.beginPath();
      ctx.arc(r.x, r.y, 14 + (r.maxR - 14) * k, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 3. Burst Particles
    for (const p of this.particles) {
      const alpha = easeOutCubic(Math.max(0, p.life / p.maxLife));
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.strokeStyle = PALETTE.inkDark;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }

    // 4. Floating Output Number Pops
    for (const pop of this.pops) {
      const p = pop.t / pop.duration;
      const scale = p < 0.22 ? easeOutBack(p / 0.22) : 1;
      const lift = easeOutCubic(p) * 44;
      const alpha = p > 0.7 ? 1 - (p - 0.7) / 0.3 : 1;

      ctx.save();
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.translate(pop.x, pop.y - 24 - lift);
      ctx.scale(scale, scale);

      ctx.font = `700 20px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.lineWidth = 4;
      ctx.strokeStyle = PALETTE.inkDark;
      ctx.strokeText(pop.text, 0, 0);
      ctx.fillStyle = pop.color;
      ctx.fillText(pop.text, 0, 0);

      if (pop.subText) {
        ctx.font = `700 14px ${FONT_DISPLAY}`;
        ctx.strokeText(pop.subText, 0, -20);
        ctx.fillStyle = PALETTE.phosphorAmber;
        ctx.fillText(pop.subText, 0, -20);
      }
      ctx.restore();
    }
  }
}
