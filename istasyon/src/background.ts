// Space backdrop, Full-Sphere 3D-Shaded Terraforming Planet on the Right,
// and Sleek Modern Orbital Command Ship on the Left/Center.
import { CONFIG } from './config';
import { PALETTE, STROKE_W, chamferRectPath, drawRivet, easeOutBack } from './theme';
import { W, H } from './view';

interface Star {
  x: number;
  y: number;
  r: number;
  a: number;
  tw: number;
}

const LAYERS = [
  { count: 80, speed: 3, size: 0.9 },
  { count: 40, speed: 7, size: 1.4 },
  { count: 16, speed: 14, size: 2.0 },
];

export const CORE_POS = CONFIG.SHIP_CORE_POS;
export const PLANET_POS = CONFIG.PLANET_POS;

export class Background {
  private layers: Star[][];
  private time = 0;
  private stageProgress = 1;

  constructor() {
    this.layers = LAYERS.map((l) =>
      Array.from({ length: l.count }, () => ({
        x: Math.random() * W,
        y: Math.random() * H,
        r: l.size * (0.6 + Math.random() * 0.6),
        a: 0.35 + Math.random() * 0.6,
        tw: Math.random() * Math.PI * 2,
      })),
    );
  }

  update(dt: number): void {
    this.time += dt;
    this.layers.forEach((stars, i) => {
      const sp = LAYERS[i].speed;
      for (const s of stars) {
        s.x -= sp * dt;
        if (s.x < -2) {
          s.x = W + 2;
          s.y = Math.random() * H;
        }
      }
    });
  }

  draw(
    ctx: CanvasRenderingContext2D,
    orbit = 0,
    highestTierEver = 1,
    planetProgress = 0,
    activeModuleCount = 4,
    boardYOffset = 0,
    shieldFlash = 0,
  ): void {
    const orbitIdx = orbit % 4;

    // 1. Deep Space Sector Backdrop
    const g = ctx.createLinearGradient(0, 0, W, H);
    if (orbitIdx === 0) {
      g.addColorStop(0, PALETTE.voidNavy);
      g.addColorStop(0.6, '#0E1F2F');
      g.addColorStop(1, '#122E3C');
    } else if (orbitIdx === 1) {
      g.addColorStop(0, '#0C1018');
      g.addColorStop(0.6, '#1F1816');
      g.addColorStop(1, '#3D2417');
    } else if (orbitIdx === 2) {
      g.addColorStop(0, '#08121C');
      g.addColorStop(0.6, '#102736');
      g.addColorStop(1, '#1A4254');
    } else {
      g.addColorStop(0, '#100D1A');
      g.addColorStop(0.55, '#241A2E');
      g.addColorStop(1, '#3E2B17');
    }
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 2. Parallax Starfield
    ctx.fillStyle = PALETTE.chassisCream;
    for (const stars of this.layers) {
      for (const s of stars) {
        ctx.globalAlpha = s.a * (0.7 + 0.3 * Math.sin(this.time * 1.8 + s.tw));
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // 3. Full-Sphere 3D-Shaded Terraforming Planet on the Right
    this.drawFullSpherePlanet(ctx, orbitIdx, planetProgress, shieldFlash);

    // 4. Sleek Modern Orbital Command Ship (Left/Center) + Active Terraforming Beam
    const targetStage =
      1 +
      (highestTierEver >= 3 ? 1 : 0) +
      (highestTierEver >= 5 || planetProgress >= 25 ? 1 : 0) +
      (highestTierEver >= 7 || planetProgress >= 50 ? 1 : 0) +
      (highestTierEver >= 9 || planetProgress >= 75 ? 1 : 0);
    this.stageProgress += (targetStage - this.stageProgress) * 0.08;

    ctx.save();
    if (boardYOffset !== 0) ctx.translate(0, boardYOffset);
    this.drawModernCommandShip(ctx, this.stageProgress, activeModuleCount, planetProgress);
    ctx.restore();
  }

  /** Draws a prominent, full 360-degree spherical planet on the right side of the screen. */
  private drawFullSpherePlanet(
    ctx: CanvasRenderingContext2D,
    orbitIdx: number,
    progress: number,
    shieldFlash: number,
  ): void {
    const cx = PLANET_POS.x;
    const cy = PLANET_POS.y;
    const R = PLANET_POS.r;

    ctx.save();

    // Outer Orbital Telemetry Ring around the planet
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.22);
    ctx.strokeStyle =
      progress >= 100 ? 'rgba(122, 199, 79, 0.38)' : 'rgba(46, 196, 182, 0.25)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.lineDashOffset = -this.time * 18;
    ctx.beginPath();
    ctx.ellipse(0, 0, R + 28, (R + 28) * 0.32, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Stage 1+ (20%+): Multi-layered Atmosphere Glow Halo around full sphere
    const atmoAlpha = Math.max(0.12, Math.min(0.65, (progress + 15) / 110));
    const haloGrad = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R + 34);
    const haloCol =
      orbitIdx === 1
        ? 'rgba(244, 162, 54,'
        : orbitIdx === 3
          ? 'rgba(122, 199, 79,'
          : 'rgba(46, 196, 182,';
    haloGrad.addColorStop(0, `${haloCol}${atmoAlpha})`);
    haloGrad.addColorStop(1, `${haloCol}0)`);
    ctx.fillStyle = haloGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 34, 0, Math.PI * 2);
    ctx.fill();

    // Clip to Full Sphere
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();

    // Base Planet Surface (Stage 0 Barren Rock -> Stage 2 Deep Oceans)
    const oceanMix = Math.max(0, Math.min(1, (progress - 25) / 35));
    const baseRock =
      orbitIdx === 1 ? '#4E2A1B' : orbitIdx === 2 ? '#2D3D4E' : orbitIdx === 3 ? '#3F3526' : '#333A45';
    const oceanCol =
      orbitIdx === 1 ? '#1B5864' : orbitIdx === 2 ? '#165D72' : orbitIdx === 3 ? '#1A6B54' : '#125375';

    ctx.fillStyle = baseRock;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    if (oceanMix > 0) {
      ctx.globalAlpha = oceanMix;
      ctx.fillStyle = oceanCol;
      ctx.fillRect(cx - R, cy - R, R * 2, R * 2);
      ctx.globalAlpha = 1;
    }

    // Stage 0..2: Cratered / Rocky Terrain Details (slowly rotating across the sphere)
    const rotOffset = ((this.time * 6) % 160) - 80;
    if (progress < 75) {
      ctx.globalAlpha = Math.max(0.18, (1 - progress / 85) * 0.65);
      ctx.fillStyle = '#1D222B';
      ctx.strokeStyle = '#525C6B';
      ctx.lineWidth = 2;
      for (const [ox, oy, rx, ry] of [
        [-42, -38, 22, 16],
        [28, -22, 18, 14],
        [-18, 26, 26, 18],
        [44, 34, 16, 12],
        [-58, 12, 15, 12],
      ]) {
        ctx.beginPath();
        ctx.ellipse(cx + ox + rotOffset * 0.25, cy + oy, rx, ry, 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Stage 3 (55%+): Lush Continents & Forests on the Sphere
    if (progress >= 45) {
      const landAlpha = Math.min(1, (progress - 45) / 30);
      ctx.globalAlpha = landAlpha;
      ctx.fillStyle = orbitIdx === 1 ? '#68B64C' : orbitIdx === 2 ? '#5EEAD4' : PALETTE.cellLime;
      for (const [lx, ly, rw, rh, ang] of [
        [-36, -34, 42, 24, -0.3],
        [32, -16, 38, 26, 0.25],
        [-12, 32, 46, 24, 0.12],
        [38, 42, 28, 18, -0.2],
      ]) {
        ctx.beginPath();
        ctx.ellipse(cx + lx + rotOffset * 0.2, cy + ly, rw, rh, ang, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Stage 4 (75%+ -> 100%): Glowing Golden City Networks & Orbital Biodomes!
    if (progress >= 70) {
      const cityAlpha = Math.min(1, (progress - 70) / 28);
      ctx.globalAlpha = cityAlpha;
      const nodes: [number, number][] = [
        [-42, -32],
        [-18, -24],
        [16, -18],
        [38, -8],
        [-26, 24],
        [4, 32],
        [32, 38],
        [-4, 2],
      ];
      // Golden highway energy grid connecting cities
      ctx.strokeStyle = 'rgba(244, 162, 54, 0.65)';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(cx + nodes[0][0], cy + nodes[0][1]);
      ctx.lineTo(cx + nodes[1][0], cy + nodes[1][1]);
      ctx.lineTo(cx + nodes[7][0], cy + nodes[7][1]);
      ctx.lineTo(cx + nodes[2][0], cy + nodes[2][1]);
      ctx.lineTo(cx + nodes[3][0], cy + nodes[3][1]);
      ctx.moveTo(cx + nodes[7][0], cy + nodes[7][1]);
      ctx.lineTo(cx + nodes[4][0], cy + nodes[4][1]);
      ctx.lineTo(cx + nodes[5][0], cy + nodes[5][1]);
      ctx.lineTo(cx + nodes[6][0], cy + nodes[6][1]);
      ctx.stroke();

      for (let i = 0; i < nodes.length; i++) {
        const [nx, ny] = nodes[i];
        const pulse = 0.75 + 0.25 * Math.sin(this.time * 5 + i);
        ctx.fillStyle = PALETTE.phosphorAmber;
        ctx.beginPath();
        ctx.arc(cx + nx, cy + ny, 4.2 * pulse, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#FFF3B0';
        ctx.beginPath();
        ctx.arc(cx + nx, cy + ny, 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Stage 1+ (20%+): Swirling Atmospheric Cloud Bands across the Sphere
    if (progress >= 20) {
      const cloudAlpha = Math.min(0.48, ((progress - 20) / 55) * 0.48);
      ctx.globalAlpha = cloudAlpha;
      ctx.fillStyle = PALETTE.chassisCream;
      for (let c = 0; c < 4; c++) {
        const drift = ((this.time * 14 + c * 62) % (R * 2.2)) - R * 1.1;
        const cyOff = -R * 0.55 + c * (R * 0.36);
        ctx.beginPath();
        ctx.ellipse(cx + drift, cy + cyOff, 38 + (c % 2) * 16, 7, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // 3D Spherical Day/Night Terminator & Specular Highlight so it looks unmistakably like a 3D Sphere
    const shadeGrad = ctx.createRadialGradient(
      cx - R * 0.35,
      cy - R * 0.35,
      R * 0.1,
      cx,
      cy,
      R * 1.05,
    );
    shadeGrad.addColorStop(0, 'rgba(255, 248, 225, 0.22)');
    shadeGrad.addColorStop(0.55, 'rgba(10, 18, 28, 0)');
    shadeGrad.addColorStop(1, 'rgba(5, 9, 16, 0.72)');
    ctx.fillStyle = shadeGrad;
    ctx.fillRect(cx - R, cy - R, R * 2, R * 2);

    ctx.restore(); // End Sphere Clip

    // Crisp Planetary Shield Rim (Flashes Red on impact, Glowing Lime when City Complete at 100%, Cyan while building)
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.lineWidth = shieldFlash > 0 ? 6.5 : progress >= 100 ? 4.5 : 3.5;
    ctx.strokeStyle =
      shieldFlash > 0
        ? PALETTE.oxideRed
        : progress >= 100
          ? PALETTE.cellLime
          : progress >= 20
            ? PALETTE.signalCyan
            : PALETTE.chassisCream;
    ctx.stroke();

    // Planetary Defense Shield Hex-Ring when at 100%
    if (progress >= 100 || shieldFlash > 0) {
      ctx.save();
      ctx.globalAlpha = shieldFlash > 0 ? 0.65 : 0.28 + 0.1 * Math.sin(this.time * 4);
      ctx.strokeStyle = shieldFlash > 0 ? PALETTE.oxideRed : PALETTE.cellLime;
      ctx.lineWidth = 2;
      ctx.setLineDash([10, 6]);
      ctx.lineDashOffset = this.time * 20;
      ctx.beginPath();
      ctx.arc(cx, cy, R + 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  /** Draws the sleek modern orbital command ship around the left/center merge deck and beams terraforming energy into the planet. */
  private drawModernCommandShip(
    ctx: CanvasRenderingContext2D,
    stage: number,
    activeModules: number,
    planetProgress: number,
  ): void {
    const cx = CORE_POS.x;
    const cy = 368;

    ctx.save();
    ctx.strokeStyle = PALETTE.inkDark;
    ctx.lineWidth = STROKE_W;

    // --- 1. Active Terraforming Energy Beam (Ship Emitter -> Right-Side Full-Sphere Planet) ---
    // Fires continuously during Phase 1 (City Building 0% -> 100%) with animated plasma pulses!
    if (planetProgress < 100 && activeModules > 0) {
      const emitterX = cx + 275;
      const emitterY = cy - 40;
      const tx = PLANET_POS.x - PLANET_POS.r * 0.55;
      const ty = PLANET_POS.y + 10;

      ctx.save();
      // Outer energy cone
      const beamAlpha = 0.28 + 0.14 * Math.sin(this.time * 9);
      const beamGrad = ctx.createLinearGradient(emitterX, emitterY, tx, ty);
      beamGrad.addColorStop(0, `rgba(46, 196, 182, ${beamAlpha + 0.2})`);
      beamGrad.addColorStop(1, `rgba(122, 199, 79, ${beamAlpha})`);
      ctx.strokeStyle = beamGrad;
      ctx.lineWidth = 14 + 4 * Math.sin(this.time * 7);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(emitterX, emitterY);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Inner bright core beam
      ctx.strokeStyle = '#FFF3B0';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(emitterX, emitterY);
      ctx.lineTo(tx, ty);
      ctx.stroke();

      // Animated terraforming energy rings traveling along the beam into the planet
      for (let i = 0; i < 4; i++) {
        const k = (this.time * 1.4 + i * 0.25) % 1;
        const px = emitterX + (tx - emitterX) * k;
        const py = emitterY + (ty - emitterY) * k;
        ctx.fillStyle = k > 0.5 ? PALETTE.cellLime : PALETTE.signalCyan;
        ctx.beginPath();
        ctx.arc(px, py, 5 + k * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Impact glow on planet surface where city is being built
      const hitPulse = 14 + 6 * Math.sin(this.time * 12);
      ctx.fillStyle = 'rgba(122, 199, 79, 0.55)';
      ctx.beginPath();
      ctx.arc(tx, ty, hitPulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // --- 2. Sleek Swept-Forward Solar & Radiator Wings ---
    const wingK = easeOutBack(Math.min(1, 0.45 + (stage - 1) * 0.2));
    for (const dir of [-1, 1]) {
      ctx.save();
      ctx.translate(cx + dir * 245, cy - 35);
      // Angled carbon-teal solar blade
      ctx.fillStyle = PALETTE.orbitTeal;
      ctx.beginPath();
      ctx.moveTo(0, -70 * wingK);
      ctx.lineTo(dir * 52 * wingK, -48 * wingK);
      ctx.lineTo(dir * 52 * wingK, 52 * wingK);
      ctx.lineTo(0, 70 * wingK);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Gold photovoltaic grid lines
      ctx.strokeStyle = PALETTE.phosphorAmber;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(dir * 26 * wingK, -58 * wingK);
      ctx.lineTo(dir * 26 * wingK, 58 * wingK);
      ctx.stroke();
      ctx.restore();
    }

    // --- 3. Modern Command Bridge Nose Cone & Twin Plasma Turrets (Top of Ship) ---
    ctx.fillStyle = PALETTE.chassisCream;
    ctx.beginPath();
    ctx.moveTo(cx - 125, 114);
    ctx.lineTo(cx - 68, 72);
    ctx.lineTo(cx + 68, 72);
    ctx.lineTo(cx + 125, 114);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Command Bridge Cyan Cockpit Visor
    chamferRectPath(ctx, cx - 54, 78, 108, 18, 5);
    ctx.fillStyle = PALETTE.signalCyan;
    ctx.fill();
    ctx.stroke();

    drawRivet(ctx, cx - 82, 98, 2.5);
    drawRivet(ctx, cx + 82, 98, 2.5);

    // Central Defense Turret & Reactor Core
    const corePulse = 1 + 0.08 * Math.sin(this.time * 6);
    ctx.beginPath();
    ctx.arc(CORE_POS.x, CORE_POS.y + 8, 17 * corePulse, 0, Math.PI * 2);
    ctx.fillStyle = PALETTE.phosphorAmber;
    ctx.fill();
    ctx.lineWidth = STROKE_W;
    ctx.strokeStyle = PALETTE.inkDark;
    ctx.stroke();

    // Twin laser barrels pointing toward the planet sector
    ctx.strokeStyle = PALETTE.chassisCream;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(CORE_POS.x + 8, CORE_POS.y + 4);
    ctx.lineTo(CORE_POS.x + 24, CORE_POS.y - 2);
    ctx.moveTo(CORE_POS.x + 8, CORE_POS.y + 12);
    ctx.lineTo(CORE_POS.x + 24, CORE_POS.y + 6);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(CORE_POS.x, CORE_POS.y + 8, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF3B0';
    ctx.fill();

    // --- 4. Right-Side Terraforming Dish Emitter ---
    ctx.save();
    ctx.translate(cx + 268, cy - 40);
    ctx.fillStyle = PALETTE.panelSteel;
    ctx.strokeStyle = PALETTE.inkDark;
    ctx.lineWidth = 2.2;
    chamferRectPath(ctx, -10, -24, 22, 48, 5);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = planetProgress < 100 ? PALETTE.signalCyan : PALETTE.cellLime;
    ctx.beginPath();
    ctx.arc(10, 0, 8, -Math.PI / 2, Math.PI / 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // --- 5. Modern Twin Ion Engine Nozzles & Glowing Cyan Afterburners (Bottom of Ship) ---
    for (const ox of [-115, 0, 115]) {
      const nx = cx + ox;
      const ny = 612;
      ctx.fillStyle = PALETTE.panelSteel;
      ctx.strokeStyle = PALETTE.inkDark;
      ctx.lineWidth = STROKE_W;
      ctx.beginPath();
      ctx.moveTo(nx - 20, ny);
      ctx.lineTo(nx + 20, ny);
      ctx.lineTo(nx + 15, ny + 20);
      ctx.lineTo(nx - 15, ny + 20);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ion plume
      const plumeLen = 12 + 6 * Math.sin(this.time * 16 + ox);
      ctx.fillStyle = ox === 0 ? PALETTE.signalCyan : PALETTE.safetyOrange;
      ctx.beginPath();
      ctx.moveTo(nx - 11, ny + 20);
      ctx.lineTo(nx + 11, ny + 20);
      ctx.lineTo(nx, ny + 20 + plumeLen);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = '#FFF3B0';
      ctx.beginPath();
      ctx.moveTo(nx - 5, ny + 20);
      ctx.lineTo(nx + 5, ny + 20);
      ctx.lineTo(nx, ny + 20 + plumeLen * 0.55);
      ctx.closePath();
      ctx.fill();
    }

    ctx.restore();
  }
}
