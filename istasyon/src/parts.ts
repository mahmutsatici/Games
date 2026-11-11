// Procedural 1970s Cassette-Futurist Module Renderer.
// 4 distinct families with unique silhouettes, idle animations, and progressive tier hardware details.
import type { FamilyId } from './economy';
import { FONT_DISPLAY, PALETTE, STROKE_W, chamferRectPath } from './theme';

export function familyColor(family: FamilyId): string {
  switch (family) {
    case 0:
      return PALETTE.safetyOrange;
    case 1:
      return PALETTE.phosphorAmber;
    case 2:
      return PALETTE.signalCyan;
    case 3:
      return PALETTE.cellLime;
  }
}

export function tierColor(tier: number, family: FamilyId = 0): string {
  if (tier >= 16) return PALETTE.phosphorAmber;
  return familyColor(family);
}

export function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function starPath(
  ctx: CanvasRenderingContext2D,
  points: number,
  ro: number,
  ri: number,
  rot: number,
): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? ro : ri;
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function shade(hex: string, k: number, a = 1): string {
  const v = parseInt(hex.slice(1), 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  const t = k > 0 ? 255 : 0;
  const f = Math.abs(k);
  return `rgba(${(r + (t - r) * f) | 0},${(g + (t - g) * f) | 0},${(b + (t - b) * f) | 0},${a})`;
}

// ---------- Family 0: GENERATOR (Round Turbine with Spinning Rotor) ----------
function drawGenerator(
  ctx: CanvasRenderingContext2D,
  tier: number,
  r: number,
  time: number,
  phase: number,
  band: number,
): void {
  // Side coolant manifolds at tier 5+
  if (band >= 1) {
    const count = band >= 2 ? 4 : 2;
    ctx.fillStyle = PALETTE.panelSteel;
    ctx.strokeStyle = PALETTE.inkDark;
    ctx.lineWidth = STROKE_W;
    for (let i = 0; i < count; i++) {
      ctx.save();
      ctx.rotate((i * Math.PI) / (count / 2) + Math.PI / 4);
      roundRectPath(ctx, r * 0.72, -r * 0.22, r * 0.36, r * 0.44, 3);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  // Outer bolted cream chassis ring
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.96, 0, Math.PI * 2);
  ctx.fillStyle = band >= 3 ? PALETTE.phosphorAmber : PALETTE.chassisCream;
  ctx.fill();
  ctx.lineWidth = STROKE_W;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.stroke();

  // Cel-shaded inner rim
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.78, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.safetyOrange;
  ctx.fill();
  ctx.stroke();

  // Recessed turbine stator well
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.58, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.inkDark;
  ctx.fill();

  // Spinning rotor blades (idle animation: continuous rotation)
  const blades = 3 + Math.min(5, Math.floor((tier - 1) / 3));
  const speed = 1.8 + tier * 0.15;
  ctx.save();
  ctx.rotate(time * speed + phase);
  ctx.fillStyle = band >= 2 ? PALETTE.phosphorAmber : PALETTE.chassisCream;
  for (let i = 0; i < blades; i++) {
    ctx.rotate((Math.PI * 2) / blades);
    ctx.beginPath();
    ctx.moveTo(0, -r * 0.1);
    ctx.lineTo(r * 0.52, -r * 0.16);
    ctx.lineTo(r * 0.48, r * 0.12);
    ctx.lineTo(0, r * 0.1);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Flange rivets on outer ring
  const rivets = 4 + band * 2;
  for (let i = 0; i < rivets; i++) {
    const a = (i / rivets) * Math.PI * 2;
    ctx.fillStyle = PALETTE.panelSteel;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * r * 0.87, Math.sin(a) * r * 0.87, r * 0.055, 0, Math.PI * 2);
    ctx.fill();
  }

  // Center dynamo cap
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.22, 0, Math.PI * 2);
  ctx.fillStyle = tier >= 10 ? '#FFF3B0' : PALETTE.phosphorAmber;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.stroke();
}

// ---------- Family 1: AMPLIFIER (Angular Relay Pylon with Antennas & Pulse) ----------
function drawAmplifier(
  ctx: CanvasRenderingContext2D,
  _tier: number,
  r: number,
  time: number,
  phase: number,
  band: number,
): void {
  const pulse = 0.5 + 0.5 * Math.sin(time * 4.5 + phase);

  // Protruding antenna rods (top & sides based on tier)
  const antCount = band === 0 ? 1 : band === 1 ? 2 : 4;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = STROKE_W;
  for (let i = 0; i < antCount; i++) {
    ctx.save();
    const angle = antCount === 1 ? -Math.PI / 2 : -Math.PI / 2 + (i - (antCount - 1) / 2) * (Math.PI / 2);
    ctx.rotate(angle);
    // Antenna mast
    ctx.beginPath();
    ctx.moveTo(r * 0.65, 0);
    ctx.lineTo(r * 1.12, 0);
    ctx.stroke();
    // Crossbars
    ctx.beginPath();
    ctx.moveTo(r * 0.92, -r * 0.18);
    ctx.lineTo(r * 0.92, r * 0.18);
    ctx.stroke();
    // Pulsing emitter tip
    ctx.beginPath();
    ctx.arc(r * 1.14, 0, r * (0.1 + 0.04 * pulse), 0, Math.PI * 2);
    ctx.fillStyle = pulse > 0.6 ? '#FFF3B0' : PALETTE.phosphorAmber;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Expanding signal wave ring
  const wavePhase = (time * 1.4 + phase) % 1;
  ctx.save();
  ctx.strokeStyle = `rgba(244, 162, 54, ${(1 - wavePhase) * 0.65})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, r * (0.7 + wavePhase * 0.55), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  // Angular octagonal/diamond chassis
  ctx.save();
  const s = r * 0.78;
  chamferRectPath(ctx, -s, -s, s * 2, s * 2, r * 0.38);
  ctx.fillStyle = PALETTE.panelSteel;
  ctx.fill();
  ctx.lineWidth = STROKE_W;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.stroke();

  // Amber inner faceplate
  const s2 = r * 0.56;
  chamferRectPath(ctx, -s2, -s2, s2 * 2, s2 * 2, r * 0.22);
  ctx.fillStyle = PALETTE.phosphorAmber;
  ctx.fill();
  ctx.stroke();

  // Center CRT oscilloscope diamond
  ctx.rotate(Math.PI / 4);
  const s3 = r * 0.28;
  ctx.fillStyle = PALETTE.crtDark;
  ctx.fillRect(-s3, -s3, s3 * 2, s3 * 2);
  ctx.strokeRect(-s3, -s3, s3 * 2, s3 * 2);

  // Core harmonic dot
  ctx.beginPath();
  ctx.arc(0, 0, r * (0.11 + 0.05 * pulse), 0, Math.PI * 2);
  ctx.fillStyle = '#FFF3B0';
  ctx.fill();
  ctx.restore();
}

// ---------- Family 2: COLLECTOR (Mechanical Grapple Arms & Radar Dish) ----------
function drawCollector(
  ctx: CanvasRenderingContext2D,
  tier: number,
  r: number,
  time: number,
  phase: number,
  band: number,
): void {
  const pinch = Math.sin(time * 2.8 + phase) * 0.18;

  // Articulated grapple arms on left and right
  for (const dir of [-1, 1]) {
    ctx.save();
    ctx.scale(dir, 1);
    ctx.rotate(pinch);
    ctx.fillStyle = PALETTE.chassisCream;
    ctx.strokeStyle = PALETTE.inkDark;
    ctx.lineWidth = STROKE_W;

    // Upper & lower claw pincer
    ctx.beginPath();
    ctx.moveTo(r * 0.45, -r * 0.35);
    ctx.lineTo(r * 0.96, -r * 0.65);
    ctx.lineTo(r * 0.78, -r * 0.88);
    ctx.lineTo(r * 0.56, -r * 0.68);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    if (band >= 1) {
      // Lower stabilizer arm
      ctx.beginPath();
      ctx.moveTo(r * 0.45, r * 0.25);
      ctx.lineTo(r * 0.95, r * 0.55);
      ctx.lineTo(r * 0.72, r * 0.76);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  // Trapezoidal / chamfered collector bay body
  const w = r * 0.82;
  const h = r * 0.74;
  chamferRectPath(ctx, -w, -h, w * 2, h * 2, r * 0.25);
  ctx.fillStyle = PALETTE.orbitTeal;
  ctx.fill();
  ctx.lineWidth = STROKE_W;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.stroke();

  // Dish Dish Bowl
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.54, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.crtDark;
  ctx.fill();
  ctx.stroke();

  // Orbiting radar sweep cone (idle animation: orbit sweep)
  const sweepAngle = time * (2.2 + tier * 0.08) + phase;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.arc(0, 0, r * 0.5, sweepAngle, sweepAngle + 0.9);
  ctx.closePath();
  ctx.fillStyle = 'rgba(46, 196, 182, 0.45)';
  ctx.fill();
  ctx.restore();

  // Center cyan tractor lens
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = PALETTE.signalCyan;
  ctx.fill();
  ctx.stroke();
}

// ---------- Family 3: BATTERY (Tall Capacitor Cylinder with Level Indicators) ----------
function drawBattery(
  ctx: CanvasRenderingContext2D,
  _tier: number,
  r: number,
  time: number,
  phase: number,
  band: number,
): void {
  // Top high-voltage terminal posts
  ctx.fillStyle = PALETTE.phosphorAmber;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = STROKE_W;
  for (const tx of [-r * 0.36, r * 0.36]) {
    roundRectPath(ctx, tx - r * 0.14, -r * 1.02, r * 0.28, r * 0.26, 2);
    ctx.fill();
    ctx.stroke();
  }

  // Side cooling fins for higher tiers
  if (band >= 1) {
    ctx.fillStyle = PALETTE.panelSteel;
    for (const sx of [-1, 1]) {
      for (let i = -1; i <= 1; i++) {
        roundRectPath(ctx, sx * r * 0.68 - (sx < 0 ? r * 0.22 : 0), i * r * 0.36 - r * 0.1, r * 0.22, r * 0.2, 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // Tall industrial cylinder chassis
  const w = r * 0.72;
  const h = r * 0.88;
  chamferRectPath(ctx, -w, -h, w * 2, h * 2, r * 0.2);
  ctx.fillStyle = PALETTE.chassisCream;
  ctx.fill();
  ctx.stroke();

  // Top & bottom orange hazard stripes
  ctx.fillStyle = PALETTE.safetyOrange;
  ctx.fillRect(-w + 3, -h + 5, w * 2 - 6, r * 0.14);
  ctx.fillRect(-w + 3, h - 5 - r * 0.14, w * 2 - 6, r * 0.14);

  // Recessed dark glass charge window
  const gw = r * 0.42;
  const gh = r * 0.54;
  roundRectPath(ctx, -gw, -gh, gw * 2, gh * 2, 4);
  ctx.fillStyle = PALETTE.crtDark;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();

  // Animated level indicator bars (idle animation: flicker / charge cycling)
  const bars = 3 + Math.min(4, band);
  const chargeCycle = 0.55 + 0.45 * Math.sin(time * 3.2 + phase);
  const litBars = Math.max(1, Math.ceil(bars * chargeCycle));
  const barH = (gh * 2 - 8) / bars;
  for (let i = 0; i < bars; i++) {
    const lit = i < litBars;
    const by = gh - 4 - (i + 1) * barH + 1;
    ctx.fillStyle = lit ? (i === bars - 1 && band >= 2 ? PALETTE.phosphorAmber : PALETTE.cellLime) : '#182B24';
    ctx.fillRect(-gw + 5, by, gw * 2 - 10, barH - 2.5);
  }
}

/**
 * Draws a module part centred at (x, y).
 * Supports optional family (defaults to 0 = Generator) and squash/stretch scale.
 */
export function drawPart(
  ctx: CanvasRenderingContext2D,
  tier: number,
  x: number,
  y: number,
  r: number,
  time: number,
  phase = 0,
  showNumber = true,
  family: FamilyId = 0,
  scaleX = 1,
  scaleY = 1,
): void {
  const band = Math.min(3, Math.floor((tier - 1) / 5));

  ctx.save();
  ctx.translate(x, y);
  if (scaleX !== 1 || scaleY !== 1) {
    ctx.scale(scaleX, scaleY);
  }

  // Hard industrial drop shadow underneath part
  ctx.save();
  ctx.translate(0, 4);
  ctx.fillStyle = 'rgba(18, 23, 29, 0.55)';
  ctx.beginPath();
  ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // High-tier outer containment ring (tier >= 11)
  if (band >= 2) {
    ctx.save();
    ctx.rotate((family % 2 === 0 ? 1 : -1) * time * 0.5 + phase);
    ctx.strokeStyle = familyColor(family);
    ctx.lineWidth = 2;
    ctx.setLineDash([r * 0.28, r * 0.16]);
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  switch (family) {
    case 0:
      drawGenerator(ctx, tier, r, time, phase, band);
      break;
    case 1:
      drawAmplifier(ctx, tier, r, time, phase, band);
      break;
    case 2:
      drawCollector(ctx, tier, r, time, phase, band);
      break;
    case 3:
      drawBattery(ctx, tier, r, time, phase, band);
      break;
  }

  ctx.restore();

  // Industrial stamped tier tag in bottom-right corner
  if (showNumber) {
    ctx.save();
    const tagW = Math.max(r * 0.62, tier >= 10 ? r * 0.78 : r * 0.62);
    const tagH = r * 0.46;
    const tx = x + r * 0.98 - tagW;
    const ty = y + r * 1.02 - tagH;

    roundRectPath(ctx, tx, ty, tagW, tagH, 4);
    ctx.fillStyle = PALETTE.inkDark;
    ctx.fill();
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = familyColor(family);
    ctx.stroke();

    ctx.font = `700 ${Math.max(11, Math.round(r * 0.36))}px ${FONT_DISPLAY}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = PALETTE.chassisCream;
    ctx.fillText(String(tier), tx + tagW / 2, ty + tagH / 2 + 0.5);
    ctx.restore();
  }
}
