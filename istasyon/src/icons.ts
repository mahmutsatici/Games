// Small vector icons drawn with Canvas 2D and inline SVG (no image files, no emoji).
import { roundRectPath, starPath } from './parts';
import { PALETTE } from './theme';

export function drawBolt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string = PALETTE.phosphorAmber): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s / 24, s / 24);
  ctx.beginPath();
  ctx.moveTo(3, -12);
  ctx.lineTo(-8, 2);
  ctx.lineTo(-1, 2);
  ctx.lineTo(-4, 12);
  ctx.lineTo(8, -3);
  ctx.lineTo(1, -3);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

export function drawStar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string = PALETTE.phosphorAmber): void {
  ctx.save();
  ctx.translate(x, y);
  starPath(ctx, 5, s / 2, s / 4.4, -Math.PI / 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

export function drawGear(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string = PALETTE.chassisCream): void {
  ctx.save();
  ctx.translate(x, y);
  const ro = s / 2;
  const ri = s * 0.36;
  const n = 8;
  ctx.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a0 = (i / (n * 2)) * Math.PI * 2;
    const a1 = ((i + 1) / (n * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? ro : ri;
    ctx.lineTo(Math.cos(a0) * r, Math.sin(a0) * r);
    ctx.lineTo(Math.cos(a1) * r, Math.sin(a1) * r);
  }
  ctx.closePath();
  ctx.moveTo(s * 0.16, 0);
  ctx.arc(0, 0, s * 0.16, 0, Math.PI * 2, true);
  ctx.fillStyle = color;
  ctx.fill('evenodd');
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = 1.8;
  ctx.stroke();
  ctx.restore();
}

/** Modern Quad-Thruster Orbital Cargo Drone, s = width. */
export function drawDrone(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, rotor = 0): void {
  ctx.save();
  ctx.translate(x, y);
  const k = s / 60;
  ctx.scale(k, k);

  // Magnetic Tractor Beam cone below drone
  const beamAlpha = 0.22 + 0.12 * Math.sin(rotor * 10);
  ctx.fillStyle = `rgba(46, 196, 182, ${beamAlpha})`;
  ctx.beginPath();
  ctx.moveTo(-7, 6);
  ctx.lineTo(7, 6);
  ctx.lineTo(15, 22);
  ctx.lineTo(-15, 22);
  ctx.closePath();
  ctx.fill();

  // Carbon-steel quad-rotor arms
  ctx.strokeStyle = PALETTE.panelSteel;
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-24, -4);
  ctx.lineTo(24, -4);
  ctx.moveTo(-16, -8);
  ctx.lineTo(16, 2);
  ctx.moveTo(-16, 2);
  ctx.lineTo(16, -8);
  ctx.stroke();

  // Twin Ion Thruster Ducts (Left & Right) with spinning plasma rings
  for (const sx of [-23, 23]) {
    // Ion thruster glow beneath duct
    const jetH = 6 + 3 * Math.sin(rotor * 28 + sx);
    ctx.fillStyle = PALETTE.signalCyan;
    ctx.beginPath();
    ctx.moveTo(sx - 4, -1);
    ctx.lineTo(sx + 4, -1);
    ctx.lineTo(sx, -1 + jetH);
    ctx.closePath();
    ctx.fill();

    // Ducted fan ring
    ctx.fillStyle = PALETTE.panelDark;
    ctx.strokeStyle = PALETTE.chassisCream;
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.ellipse(sx, -5, 8, 4.2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Spinning plasma blades
    const bladeX = 5.5 * Math.cos(rotor * 32 + sx);
    ctx.strokeStyle = PALETTE.signalCyan;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(sx - bladeX, -5);
    ctx.lineTo(sx + bladeX, -5);
    ctx.stroke();
  }

  // Sleek Hexagonal Core Chassis
  ctx.fillStyle = PALETTE.chassisCream;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-9, -9);
  ctx.lineTo(9, -9);
  ctx.lineTo(15, 0);
  ctx.lineTo(9, 8);
  ctx.lineTo(-9, 8);
  ctx.lineTo(-15, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Safety orange chevron stripe
  ctx.fillStyle = PALETTE.safetyOrange;
  ctx.fillRect(-9, -2, 18, 3.5);

  // Glowing Cyan AI Visor Core
  ctx.fillStyle = PALETTE.inkDark;
  ctx.beginPath();
  ctx.arc(0, 0, 5.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PALETTE.signalCyan;
  ctx.beginPath();
  ctx.arc(0, 0, 3.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#FFF3B0';
  ctx.beginPath();
  ctx.arc(-1, -1, 1.2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

export function drawSpeedLines(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.strokeStyle = PALETTE.signalCyan;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(x - s * 0.5, y + i * s * 0.22);
    ctx.lineTo(x - s * (0.15 + 0.1 * Math.abs(i)), y + i * s * 0.22);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawUpArrow(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string = PALETTE.cellLime): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -s / 2);
  ctx.lineTo(s / 2, 0);
  ctx.lineTo(s / 5, 0);
  ctx.lineTo(s / 5, s / 2);
  ctx.lineTo(-s / 5, s / 2);
  ctx.lineTo(-s / 5, 0);
  ctx.lineTo(-s / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

export function drawGridIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x - s / 2, y - s / 2);
  const n = 3;
  const g = s / n;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      ctx.fillStyle = r === n - 1 || c === n - 1 ? PALETTE.phosphorAmber : PALETTE.chassisShade;
      ctx.strokeStyle = PALETTE.inkDark;
      ctx.lineWidth = 1.2;
      ctx.fillRect(c * g + 2, r * g + 2, g - 4, g - 4);
      ctx.strokeRect(c * g + 2, r * g + 2, g - 4, g - 4);
    }
  }
  ctx.restore();
}

export function drawMoonClock(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  const r = s * 0.4;
  ctx.fillStyle = PALETTE.phosphorAmber;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(-s * 0.08, -s * 0.05, r, 0, Math.PI * 2);
  ctx.arc(s * 0.1, -s * 0.18, r * 0.85, 0, Math.PI * 2, true);
  ctx.fill('evenodd');
  // clock dial
  const cr = s * 0.25;
  ctx.translate(s * 0.2, s * 0.2);
  ctx.fillStyle = PALETTE.panelDark;
  ctx.strokeStyle = PALETTE.signalCyan;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.arc(0, 0, cr, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -cr * 0.65);
  ctx.moveTo(0, 0);
  ctx.lineTo(cr * 0.5, 0);
  ctx.stroke();
  ctx.restore();
}

export function drawFilm(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x - s / 2, y - s / 2);
  const k = s / 24;
  ctx.scale(k, k);
  ctx.fillStyle = PALETTE.chassisCream;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = 1.4;
  ctx.fillRect(2, 9, 20, 13);
  ctx.strokeRect(2, 9, 20, 13);
  ctx.save();
  ctx.translate(2, 8);
  ctx.rotate(-0.24);
  ctx.fillStyle = PALETTE.safetyOrange;
  ctx.fillRect(0, -5, 20, 5);
  ctx.fillStyle = PALETTE.inkDark;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(2 + i * 5, -5);
    ctx.lineTo(5 + i * 5, -5);
    ctx.lineTo(3 + i * 5, 0);
    ctx.lineTo(0 + i * 5, 0);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = PALETTE.inkDark;
  ctx.beginPath();
  ctx.moveTo(10, 12);
  ctx.lineTo(16, 15.5);
  ctx.lineTo(10, 19);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawCheck(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, color: string = PALETTE.cellLime): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.18;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(x - s * 0.4, y);
  ctx.lineTo(x - s * 0.1, y + s * 0.3);
  ctx.lineTo(x + s * 0.4, y - s * 0.3);
  ctx.stroke();
  ctx.restore();
}

/** Tech Tree / Star Node constellation icon */
export function drawTechIcon(ctx: CanvasRenderingContext2D, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  const r = s * 0.36;
  ctx.strokeStyle = PALETTE.signalCyan;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(-r * 0.85, r * 0.6);
  ctx.lineTo(r * 0.85, r * 0.6);
  ctx.closePath();
  ctx.stroke();
  for (const [nx, ny] of [
    [0, -r],
    [-r * 0.85, r * 0.6],
    [r * 0.85, r * 0.6],
  ]) {
    ctx.fillStyle = PALETTE.phosphorAmber;
    ctx.beginPath();
    ctx.arc(nx, ny, s * 0.13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.inkDark;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }
  ctx.restore();
}

/** Rocket icon for Prestige / Launch */
export function drawRocket(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, fire = false): void {
  ctx.save();
  ctx.translate(x, y);
  const k = s / 32;
  ctx.scale(k, k);

  if (fire) {
    ctx.save();
    ctx.fillStyle = PALETTE.safetyOrange;
    ctx.beginPath();
    ctx.moveTo(-4, 11);
    ctx.lineTo(0, 19 + Math.random() * 4);
    ctx.lineTo(4, 11);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.phosphorAmber;
    ctx.beginPath();
    ctx.moveTo(-2, 11);
    ctx.lineTo(0, 15 + Math.random() * 3);
    ctx.lineTo(2, 11);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  // Fins
  ctx.fillStyle = PALETTE.safetyOrange;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-5, 4);
  ctx.lineTo(-11, 11);
  ctx.lineTo(-5, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(5, 4);
  ctx.lineTo(11, 11);
  ctx.lineTo(5, 10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Fuselage
  ctx.fillStyle = PALETTE.chassisCream;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.bezierCurveTo(7, -6, 7, 6, 5, 11);
  ctx.lineTo(-5, 11);
  ctx.bezierCurveTo(-7, 6, -7, -6, 0, -14);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Nose cone
  ctx.fillStyle = PALETTE.safetyOrange;
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.bezierCurveTo(4, -9, 4, -8, 4, -6);
  ctx.lineTo(-4, -6);
  ctx.bezierCurveTo(-4, -8, -4, -9, 0, -14);
  ctx.closePath();
  ctx.fill();

  // Porthole
  ctx.fillStyle = PALETTE.signalCyan;
  ctx.beginPath();
  ctx.arc(0, -1, 3.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

/** Calendar icon for Daily Supply Log */
export function drawCalendar(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, hasDot = false): void {
  ctx.save();
  ctx.translate(x, y);
  const k = s / 32;
  ctx.scale(k, k);

  ctx.fillStyle = PALETTE.chassisCream;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = 1.8;
  roundRectPath(ctx, -13, -10, 26, 23, 3);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = PALETTE.safetyOrange;
  ctx.fillRect(-12, -9, 24, 6);

  ctx.fillStyle = PALETTE.panelSteel;
  for (const rx of [-7, 0, 7]) {
    ctx.fillRect(rx - 1.5, -13, 3, 5);
  }

  ctx.fillStyle = PALETTE.panelSteel;
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 3; c++) {
      ctx.fillRect(-7 + c * 6, 0 + r * 5, 3, 3);
    }
  }

  if (hasDot) {
    ctx.fillStyle = PALETTE.cellLime;
    ctx.beginPath();
    ctx.arc(11, -9, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.inkDark;
    ctx.lineWidth = 1.4;
    ctx.stroke();
  }

  ctx.restore();
}

/** Trash / Recycle bin icon for scrapping unwanted low-tier modules */
export function drawTrashIcon(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  s: number,
  openLid = false,
  color: string = PALETTE.chassisCream,
): void {
  ctx.save();
  ctx.translate(x, y);
  const k = s / 28;
  ctx.scale(k, k);

  // Bin body
  ctx.fillStyle = PALETTE.panelDark;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.2;
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(8, -4);
  ctx.lineTo(6.5, 11);
  ctx.lineTo(-6.5, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Vertical ribs
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-3, -1);
  ctx.lineTo(-2.5, 8);
  ctx.moveTo(0, -1);
  ctx.lineTo(0, 8);
  ctx.moveTo(3, -1);
  ctx.lineTo(2.5, 8);
  ctx.stroke();

  // Lid (tilts open when dragging a part!)
  ctx.save();
  if (openLid) {
    ctx.translate(-8, -5);
    ctx.rotate(-0.45);
    ctx.translate(8, 5);
  }
  ctx.fillStyle = color;
  ctx.fillRect(-10, -7, 20, 3);
  ctx.strokeRect(-6, -10, 8, 3);
  ctx.restore();

  ctx.restore();
}

/** Inline SVG markup for DOM overlays (zero emoji). */
export const SVG_FILM =
  '<svg viewBox="0 0 24 24" width="1.15em" height="1.15em" style="vertical-align:-0.2em"><rect x="2" y="9" width="20" height="13" fill="#f4efe6" stroke="#111622" stroke-width="1.5"/><g transform="translate(2 8) rotate(-14)"><rect x="0" y="-5" width="20" height="5" fill="#e05a2b"/><path d="M2-5h3l-2 5H0zM7-5h3l-2 5H5zM12-5h3l-2 5h-3zM17-5h3l-2 5h-3z" fill="#111622"/></g><path d="M10 12l6 3.5-6 3.5z" fill="#111622"/></svg>';

export const SVG_BOLT =
  '<svg viewBox="-12 -12 24 24" width="1em" height="1em" style="vertical-align:-0.15em"><path d="M3-12L-8 2h7l-3 10L8-3H1z" fill="#f2a93b" stroke="#111622" stroke-width="1.5"/></svg>';

export const SVG_STAR =
  '<svg viewBox="-12 -12 24 24" width="1.05em" height="1.05em" style="vertical-align:-0.15em"><path d="M0-11L3.2-3.6L11-2.5L5.3 3L6.8 10.8L0 7L-6.8 10.8L-5.3 3L-11-2.5L-3.2-3.6Z" fill="#f2a93b" stroke="#111622" stroke-width="1.4"/></svg>';

export const SVG_ROCKET =
  '<svg viewBox="-14 -16 28 32" width="1.1em" height="1.1em" style="vertical-align:-0.2em"><path d="M-5 4L-11 11L-5 10ZM5 4L11 11L5 10Z" fill="#e05a2b" stroke="#111622" stroke-width="1.4"/><path d="M0-14C7-6 7 6 5 11L-5 11C-7 6-7-6 0-14Z" fill="#f4efe6" stroke="#111622" stroke-width="1.6"/><circle cx="0" cy="-1" r="3" fill="#38b2ac" stroke="#111622" stroke-width="1.2"/></svg>';

export const SVG_SOUND_ON =
  '<svg viewBox="0 0 24 24" width="1.1em" height="1.1em" style="vertical-align:-0.18em"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="#f4efe6"/><path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" fill="#38b2ac"/></svg>';

export const SVG_SOUND_OFF =
  '<svg viewBox="0 0 24 24" width="1.1em" height="1.1em" style="vertical-align:-0.18em"><path d="M3 9v6h4l5 5V4L7 9H3z" fill="#64748b"/><path d="M16 9l5 5m0-5l-5 5" stroke="#e53e3e" stroke-width="2.4" stroke-linecap="round"/></svg>';
