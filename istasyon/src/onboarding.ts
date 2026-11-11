// Animated text-free onboarding EVA glove pointer
import type { Board } from './board';
import type { GameState } from './state';
import { easeInOutCubic, PALETTE } from './theme';

export function drawHandPointer(ctx: CanvasRenderingContext2D, x: number, y: number, angle = -Math.PI / 4, scale = 1): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.scale(scale, scale);

  // Drop shadow
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.beginPath();
  ctx.arc(3, 5, 18, 0, Math.PI * 2);
  ctx.fill();

  // 1970s EVA astronaut glove (cream with orange wrist cuff)
  ctx.fillStyle = PALETTE.chassisCream;
  ctx.strokeStyle = PALETTE.inkDark;
  ctx.lineWidth = 2.8;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(0, -32);
  ctx.lineTo(8, -32);
  ctx.lineTo(8, -4);
  ctx.lineTo(16, -2);
  ctx.lineTo(16, 12);
  ctx.lineTo(12, 22);
  ctx.lineTo(-8, 22);
  ctx.lineTo(-14, 10);
  ctx.lineTo(-14, -4);
  ctx.lineTo(-4, -4);
  ctx.lineTo(-4, -32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Orange wrist strap
  ctx.fillStyle = PALETTE.safetyOrange;
  ctx.fillRect(-10, 15, 22, 5);

  ctx.restore();
}

export function drawOnboarding(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  board: Board,
  buyPos: { x: number; y: number },
  time: number,
): void {
  if (state.onboarding >= 2) return;

  if (state.onboarding === 0) {
    const active = board.activeCells();
    let fromCell = -1;
    let toCell = -1;

    for (let i = 0; i < active.length; i++) {
      const c1 = active[i];
      if (state.parts[c1] === 0) continue;
      for (let j = i + 1; j < active.length; j++) {
        const c2 = active[j];
        if (state.parts[c1] === state.parts[c2] && state.families[c1] === state.families[c2]) {
          fromCell = c1;
          toCell = c2;
          break;
        }
      }
      if (fromCell !== -1) break;
    }

    if (fromCell !== -1 && toCell !== -1) {
      const p1 = board.cellCenter(fromCell);
      const p2 = board.cellCenter(toCell);
      const loop = (time * 1.2) % 2.0;

      let hx = p1.x;
      let hy = p1.y;
      let scale = 1;

      if (loop < 0.3) {
        scale = 0.9 + 0.1 * (loop / 0.3);
      } else if (loop < 1.4) {
        const k = (loop - 0.3) / 1.1;
        const ease = easeInOutCubic(k);
        hx = p1.x + (p2.x - p1.x) * ease;
        hy = p1.y + (p2.y - p1.y) * ease;
      } else {
        hx = p2.x;
        hy = p2.y;
        scale = 1 + (loop - 1.4) * 0.5;
        ctx.globalAlpha = Math.max(0, 1 - (loop - 1.4) / 0.6);
      }

      drawHandPointer(ctx, hx, hy, -Math.PI / 6, scale);
      ctx.globalAlpha = 1;
    }
  } else if (state.onboarding === 1) {
    const poke = Math.sin(time * 5) * 12;
    drawHandPointer(ctx, buyPos.x - 30 + poke, buyPos.y, -Math.PI / 2, 1);
  }
}
