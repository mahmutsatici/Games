// Canvas-drawn 1970s hardware buttons with chamfered frames, press feedback, and LED indicators.
import { drawHardwarePanel, PALETTE, type HardwarePanelOpts } from './theme';

export interface CanvasButton {
  x: number;
  y: number;
  w: number;
  h: number;
  visible(): boolean;
  enabled(): boolean;
  onClick(): void;
  /** Draws contents; background is drawn by drawButtons. */
  draw(ctx: CanvasRenderingContext2D, b: CanvasButton, enabled: boolean): void;
  /** Base hardware switch style. */
  style?: 'panel' | 'green' | 'violet' | 'gold' | 'orange' | 'teal';
  /** Pulsing highlight (e.g. affordable / ready). */
  glow?(): boolean;
}

export function hitButton(list: CanvasButton[], x: number, y: number): CanvasButton | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const b = list[i];
    if (!b.visible()) continue;
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

export function drawButtons(ctx: CanvasRenderingContext2D, list: CanvasButton[], pressed: CanvasButton | null, time: number): void {
  for (const b of list) {
    if (!b.visible()) continue;
    const en = b.enabled();
    const isPressed = pressed === b && en;
    ctx.save();
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    const s = isPressed ? 0.96 : 1;
    ctx.translate(cx, cy + (isPressed ? 2 : 0));
    ctx.scale(s, s);
    ctx.translate(-cx, -cy);

    let variant: NonNullable<HardwarePanelOpts['variant']> = 'steel';
    if (en) {
      if (b.style === 'green') variant = 'lime';
      else if (b.style === 'violet' || b.style === 'orange') variant = 'orange';
      else if (b.style === 'gold') variant = 'amber';
      else if (b.style === 'teal') variant = 'teal';
      else variant = 'steel';
    }

    const glowing = en && b.glow?.();
    const activeBorder = glowing
      ? b.style === 'gold'
        ? PALETTE.phosphorAmber
        : b.style === 'violet'
          ? PALETTE.safetyOrange
          : PALETTE.cellLime
      : PALETTE.inkDark;

    drawHardwarePanel(ctx, b.x, b.y, b.w, b.h, {
      variant,
      chamfer: 8,
      rivets: b.h >= 60,
      shadow: en && !isPressed,
      activeBorder,
    });

    // Small status LED in top-left corner of hardware switch
    if (b.h >= 60) {
      const ledColor = glowing
        ? Math.sin(time * 6) > -0.2
          ? PALETTE.cellLime
          : PALETTE.panelDark
        : en
          ? PALETTE.signalCyan
          : PALETTE.panelDark;
      ctx.fillStyle = ledColor;
      ctx.fillRect(b.x + 12, b.y + 7, 6, 4);
    }

    if (!en) ctx.globalAlpha = 0.56;
    b.draw(ctx, b, en);
    ctx.restore();
  }
}
