// 1970s Skylab / Cassette-Futurist Space Program Visual Identity & Easing Library.
// Strict 8-color core palette + local bundled fonts + hardware panel primitives.

export const PALETTE = {
  voidNavy: '#0B131E',
  orbitTeal: '#173F4C',
  signalCyan: '#2EC4B6',
  chassisCream: '#E8E1D1',
  chassisShade: '#C9BFA8',
  panelSteel: '#2B343E',
  panelDark: '#1C232B',
  crtDark: '#0D1B1A',
  inkDark: '#12171D',
  safetyOrange: '#E85D2A',
  phosphorAmber: '#F4A236',
  oxideRed: '#D13B34',
  cellLime: '#7AC74F',
} as const;

export const FONT_DISPLAY = '"Chakra Petch", "Courier New", monospace';
export const FONT_UI = '"Space Grotesk", sans-serif';

export const STROKE_W = 2.5;
export const SHADOW_OFFSET = 4;

// ---------- Easing Functions (No linear tweens) ----------
export function clamp01(t: number): number {
  return t < 0 ? 0 : t > 1 ? 1 : t;
}

export function easeOutCubic(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 3);
}

export function easeOutQuart(t: number): number {
  const x = clamp01(t);
  return 1 - Math.pow(1 - x, 4);
}

export function easeInCubic(t: number): number {
  const x = clamp01(t);
  return x * x * x;
}

export function easeInOutCubic(t: number): number {
  const x = clamp01(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

export function easeOutBack(t: number, s = 1.70158): number {
  const x = clamp01(t) - 1;
  return 1 + x * x * ((s + 1) * x + s);
}

export function easeOutElastic(t: number): number {
  const x = clamp01(t);
  if (x === 0 || x === 1) return x;
  return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
}

// ---------- Industrial Hardware Shapes ----------
export function chamferRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c = 8,
): void {
  const k = Math.min(c, w / 3, h / 3);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.lineTo(x + w - k, y);
  ctx.lineTo(x + w, y + k);
  ctx.lineTo(x + w, y + h - k);
  ctx.lineTo(x + w - k, y + h);
  ctx.lineTo(x + k, y + h);
  ctx.lineTo(x, y + h - k);
  ctx.lineTo(x, y + k);
  ctx.closePath();
}

export function drawRivet(ctx: CanvasRenderingContext2D, x: number, y: number, r = 2.5): void {
  ctx.fillStyle = PALETTE.panelSteel;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.45, 0, Math.PI * 2);
  ctx.fill();
}

export interface HardwarePanelOpts {
  variant?: 'cream' | 'steel' | 'orange' | 'teal' | 'amber' | 'red' | 'lime';
  chamfer?: number;
  rivets?: boolean;
  shadow?: boolean;
  activeBorder?: string;
}

const VARIANT_COLORS: Record<
  NonNullable<HardwarePanelOpts['variant']>,
  { body: string; lip: string; shade: string }
> = {
  cream: { body: PALETTE.chassisCream, lip: '#F7F3E9', shade: PALETTE.chassisShade },
  steel: { body: PALETTE.panelSteel, lip: '#3D4956', shade: PALETTE.panelDark },
  orange: { body: PALETTE.safetyOrange, lip: '#F47C4E', shade: '#B54016' },
  teal: { body: PALETTE.orbitTeal, lip: '#245B6D', shade: '#102C36' },
  amber: { body: PALETTE.phosphorAmber, lip: '#F9BC64', shade: '#C47A1B' },
  red: { body: PALETTE.oxideRed, lip: '#E45B54', shade: '#992620' },
  lime: { body: PALETTE.cellLime, lip: '#98DA72', shade: '#54962E' },
};

export function drawHardwarePanel(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: HardwarePanelOpts = {},
): void {
  const v = VARIANT_COLORS[opts.variant ?? 'cream'];
  const c = opts.chamfer ?? 8;
  const hasShadow = opts.shadow ?? true;

  ctx.save();
  // Hard cel-shaded drop shadow
  if (hasShadow) {
    chamferRectPath(ctx, x, y + SHADOW_OFFSET, w, h, c);
    ctx.fillStyle = PALETTE.inkDark;
    ctx.fill();
  }

  // Main chassis body
  chamferRectPath(ctx, x, y, w, h, c);
  ctx.fillStyle = v.body;
  ctx.fill();

  // Bottom inner bevel shade
  ctx.save();
  ctx.clip();
  ctx.fillStyle = v.shade;
  ctx.fillRect(x, y + h - 6, w, 6);
  ctx.fillStyle = v.lip;
  ctx.fillRect(x, y, w, 4);
  ctx.restore();

  // Crisp industrial outline
  chamferRectPath(ctx, x, y, w, h, c);
  ctx.lineWidth = STROKE_W;
  ctx.strokeStyle = opts.activeBorder ?? PALETTE.inkDark;
  ctx.stroke();

  // Corner rivets
  if (opts.rivets !== false && w >= 60 && h >= 44) {
    const pad = c + 4;
    drawRivet(ctx, x + pad, y + pad, 2.2);
    drawRivet(ctx, x + w - pad, y + pad, 2.2);
    drawRivet(ctx, x + pad, y + h - pad, 2.2);
    drawRivet(ctx, x + w - pad, y + h - pad, 2.2);
  }
  ctx.restore();
}

export function drawCRTScreen(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  borderColor: string = PALETTE.inkDark,
): void {
  ctx.save();
  chamferRectPath(ctx, x, y, w, h, 5);
  ctx.fillStyle = PALETTE.crtDark;
  ctx.fill();

  // Subtle horizontal scanlines
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(46, 196, 182, 0.05)';
  for (let sy = y; sy < y + h; sy += 4) {
    ctx.fillRect(x, sy, w, 1.5);
  }
  // Top inner shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(x, y, w, 4);
  ctx.restore();

  chamferRectPath(ctx, x, y, w, h, 5);
  ctx.lineWidth = 2;
  ctx.strokeStyle = borderColor;
  ctx.stroke();
  ctx.restore();
}
