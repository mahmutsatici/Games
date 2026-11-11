// The merge grid: hardware deck frame, animated adjacency energy conduits,
// lifted drag physics with lag/tilt/shadow, elastic snap-back, and squash-and-stretch merge feel.
import { CONFIG } from './config';
import {
  MAX_TIER,
  GRID_SIZES,
  MAX_CELLS,
  MAX_COLS,
  buyCost,
  type AdjacencyLink,
  type FamilyId,
} from './economy';
import { formatNumber } from './format';
import { drawBolt, drawTrashIcon } from './icons';
import { drawPart, familyColor, roundRectPath } from './parts';
import type { GameState } from './state';
import {
  FONT_DISPLAY,
  PALETTE,
  chamferRectPath,
  drawCRTScreen,
  drawHardwarePanel,
  easeOutBack,
  easeOutElastic,
} from './theme';

export const CELL = CONFIG.CELL_SIZE;
const AREA_X0 = CONFIG.BOARD_AREA_X0;
const AREA_X1 = CONFIG.BOARD_AREA_X1;
const AREA_Y0 = CONFIG.BOARD_AREA_Y0;
const AREA_Y1 = CONFIG.BOARD_AREA_Y1;
export const SCRAP_BOX = CONFIG.SCRAP_BOX;

interface CellAnim {
  startOx: number;
  startOy: number;
  snapT: number; // 0..1 elastic snap-back / move interpolation
  snapDur: number;
  pop: number; // 1 -> 0 squash & stretch timer
  mergeFromX: number;
  mergeFromY: number;
  mergeT: number; // 1 -> 0 two-part fly-together
}

interface Drag {
  from: number;
  x: number;
  y: number;
  sx: number;
  sy: number;
  vx: number;
  tilt: number;
  lift: number; // 0 -> 1 easeOutBack lift
  moved: boolean;
}

export interface BoardEvents {
  merge(cell: number, newTier: number, family: FamilyId): void;
  move(): void;
  scrap(cell: number, tier: number, family: FamilyId, x: number, y: number): void;
}

export class Board {
  cols = 4;
  rows = 3;
  x0 = 0;
  y0 = 0;
  readonly anim: CellAnim[] = Array.from({ length: MAX_CELLS }, () => ({
    startOx: 0,
    startOy: 0,
    snapT: 1,
    snapDur: 0.35,
    pop: 0,
    mergeFromX: 0,
    mergeFromY: 0,
    mergeT: 0,
  }));
  drag: Drag | null = null;
  enabled = true;

  constructor(
    private state: GameState,
    private events: BoardEvents,
  ) {}

  setState(s: GameState): void {
    this.state = s;
    this.drag = null;
  }

  setGridLevel(level: number): void {
    const [c, r] = GRID_SIZES[Math.max(0, Math.min(GRID_SIZES.length - 1, level))];
    this.cols = c;
    this.rows = r;
    this.x0 = Math.round((AREA_X0 + AREA_X1) / 2 - (c * CELL) / 2);
    this.y0 = Math.round((AREA_Y0 + AREA_Y1) / 2 - (r * CELL) / 2);
  }

  activeCells(): number[] {
    const out: number[] = [];
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        out.push(r * MAX_COLS + c);
      }
    }
    return out;
  }

  emptyCells(): number[] {
    return this.activeCells().filter((i) => this.state.parts[i] === 0);
  }

  isEmpty(i: number): boolean {
    return this.state.parts[i] === 0;
  }

  canScrap(): boolean {
    let count = 0;
    for (const i of this.activeCells()) {
      if (this.state.parts[i] > 0) count++;
    }
    return count > 1;
  }

  isOverScrap(x: number, y: number): boolean {
    return (
      x >= SCRAP_BOX.x - 10 &&
      x <= SCRAP_BOX.x + SCRAP_BOX.w + 10 &&
      y >= SCRAP_BOX.y - 10 &&
      y <= SCRAP_BOX.y + SCRAP_BOX.h + 10
    );
  }

  cellCenter(i: number): { x: number; y: number } {
    const c = i % MAX_COLS;
    const r = Math.floor(i / MAX_COLS);
    return { x: this.x0 + c * CELL + CELL / 2, y: this.y0 + r * CELL + CELL / 2 };
  }

  cellAt(x: number, y: number): number {
    const c = Math.floor((x - this.x0) / CELL);
    const r = Math.floor((y - this.y0) / CELL);
    if (c < 0 || r < 0 || c >= this.cols || r >= this.rows) return -1;
    return r * MAX_COLS + c;
  }

  pop(i: number, fromX = 0, fromY = 0): void {
    const a = this.anim[i];
    a.pop = 1;
    if (fromX !== 0 || fromY !== 0) {
      a.mergeFromX = fromX;
      a.mergeFromY = fromY;
      a.mergeT = 1;
    }
  }

  startSnap(i: number, ox: number, oy: number, elastic = true): void {
    const a = this.anim[i];
    a.startOx = ox;
    a.startOy = oy;
    a.snapT = 0;
    a.snapDur = elastic ? 0.45 : 0.24;
  }

  pointerDown(x: number, y: number): boolean {
    if (!this.enabled) return false;
    const i = this.cellAt(x, y);
    if (i < 0 || this.state.parts[i] === 0) return false;
    const c = this.cellCenter(i);
    this.drag = {
      from: i,
      x,
      y,
      sx: c.x,
      sy: c.y,
      vx: 0,
      tilt: 0,
      lift: 0,
      moved: false,
    };
    return true;
  }

  pointerMove(x: number, y: number): void {
    const d = this.drag;
    if (!d) return;
    if (Math.abs(x - d.x) + Math.abs(y - d.y) > 4) d.moved = true;
    d.x = x;
    d.y = y;
  }

  pointerUp(x: number, y: number): void {
    const d = this.drag;
    if (!d) return;
    this.drag = null;
    const from = d.from;
    const px = d.sx;
    const py = d.sy;
    const to = this.cellAt(x, y);
    const parts = this.state.parts;
    const fams = this.state.families;
    const ft = parts[from];
    const ff = fams[from] ?? 0;
    const fc = this.cellCenter(from);

    // Check if dropped into the Scrap / Recycle Chute (and player has > 1 module on board)
    if (ft > 0 && this.isOverScrap(x, y) && this.canScrap()) {
      parts[from] = 0;
      fams[from] = 0;
      this.events.scrap(from, ft, ff, SCRAP_BOX.x + SCRAP_BOX.w / 2, SCRAP_BOX.y + SCRAP_BOX.h / 2);
      return;
    }

    if (to < 0 || to === from || ft === 0) {
      // Invalid drop: snap back with elastic ease
      this.startSnap(from, px - fc.x, py - fc.y, true);
      return;
    }

    const tc = this.cellCenter(to);
    const tt = parts[to];
    const tf = fams[to] ?? 0;

    if (tt === 0) {
      parts[to] = ft;
      fams[to] = ff;
      parts[from] = 0;
      fams[from] = 0;
      this.startSnap(to, px - tc.x, py - tc.y, false);
      this.events.move();
    } else if (tt === ft && tf === ff && ft < MAX_TIER) {
      // Merge within same family!
      parts[to] = ft + 1;
      fams[to] = ff;
      parts[from] = 0;
      fams[from] = 0;
      this.anim[to].snapT = 1;
      this.pop(to, px - tc.x, py - tc.y);
      this.events.merge(to, ft + 1, ff);
    } else {
      // Swap two modules with elastic settle
      parts[to] = ft;
      fams[to] = ff;
      parts[from] = tt;
      fams[from] = tf;
      this.startSnap(to, px - tc.x, py - tc.y, true);
      this.startSnap(from, tc.x - fc.x, tc.y - fc.y, true);
      this.events.move();
    }
  }

  cancelDrag(): void {
    if (!this.drag) return;
    const d = this.drag;
    const fc = this.cellCenter(d.from);
    this.startSnap(d.from, d.sx - fc.x, d.sy - fc.y, true);
    this.drag = null;
  }

  update(dt: number): void {
    // Update drag follower lag & velocity tilt
    if (this.drag) {
      const d = this.drag;
      d.lift = Math.min(1, d.lift + dt / 0.16);
      const followRate = Math.min(1, dt * 22);
      const nextSx = d.sx + (d.x - d.sx) * followRate;
      const nextSy = d.sy + (d.y - 10 - d.sy) * followRate;
      d.vx = (nextSx - d.sx) / Math.max(0.001, dt);
      d.sx = nextSx;
      d.sy = nextSy;
      const targetTilt = Math.max(-0.28, Math.min(0.28, d.vx * 0.00055));
      d.tilt += (targetTilt - d.tilt) * Math.min(1, dt * 18);
    }

    for (const a of this.anim) {
      if (a.snapT < 1) {
        a.snapT = Math.min(1, a.snapT + dt / a.snapDur);
      }
      if (a.pop > 0) {
        a.pop = Math.max(0, a.pop - dt / 0.42);
      }
      if (a.mergeT > 0) {
        a.mergeT = Math.max(0, a.mergeT - dt / 0.14);
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, time: number, links: readonly AdjacencyLink[] = []): void {
    const parts = this.state.parts;
    const fams = this.state.families;
    const d = this.drag;
    const hover = d ? this.cellAt(d.x, d.y) : -1;
    const dragTier = d ? parts[d.from] : 0;
    const dragFam = d ? (fams[d.from] ?? 0) : 0;

    // 1. Industrial Hardware Deck Frame
    drawHardwarePanel(
      ctx,
      this.x0 - 14,
      this.y0 - 14,
      this.cols * CELL + 28,
      this.rows * CELL + 28,
      { variant: 'steel', chamfer: 12, rivets: true },
    );

    // 2. Recessed Module Bays (Slots)
    for (const i of this.activeCells()) {
      const c = this.cellCenter(i);
      const isValidMergeTarget =
        d &&
        i !== d.from &&
        parts[i] === dragTier &&
        (fams[i] ?? 0) === dragFam &&
        dragTier < MAX_TIER;
      const isHovered = d && i === hover && i !== d.from;

      const pulseScale = isValidMergeTarget ? 1 + 0.035 * Math.sin(time * 10) : 1;
      const sw = (CELL - 12) * pulseScale;
      const sh = (CELL - 12) * pulseScale;

      ctx.save();
      chamferRectPath(ctx, c.x - sw / 2, c.y - sh / 2, sw, sh, 8);
      if (isHovered && isValidMergeTarget) {
        ctx.fillStyle = 'rgba(122, 199, 79, 0.28)';
        ctx.strokeStyle = PALETTE.cellLime;
        ctx.lineWidth = 3;
      } else if (isValidMergeTarget) {
        ctx.fillStyle = 'rgba(244, 162, 54, 0.14)';
        ctx.strokeStyle = PALETTE.phosphorAmber;
        ctx.lineWidth = 2.5;
      } else if (isHovered) {
        ctx.fillStyle = '#25303B';
        ctx.strokeStyle = PALETTE.chassisCream;
        ctx.lineWidth = 2.5;
      } else {
        ctx.fillStyle = PALETTE.panelDark;
        ctx.strokeStyle = '#394654';
        ctx.lineWidth = 2;
      }
      ctx.fill();
      ctx.stroke();

      // Subtle cross-hair bay markings inside empty slot
      if (parts[i] === 0) {
        ctx.strokeStyle = 'rgba(232, 225, 209, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(c.x - 10, c.y);
        ctx.lineTo(c.x + 10, c.y);
        ctx.moveTo(c.x, c.y - 10);
        ctx.lineTo(c.x, c.y + 10);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 3. Animated Adjacency Energy Links between modules
    for (const link of links) {
      if (d && (link.fromCell === d.from || link.toCell === d.from)) continue;
      const p1 = this.cellCenter(link.fromCell);
      const p2 = this.cellCenter(link.toCell);
      const col = familyColor(link.family);

      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.65;
      ctx.setLineDash([6, 6]);
      ctx.lineDashOffset = -time * 28;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Traveling energy packet along the link
      const packetT = (time * 1.6 + link.fromCell * 0.23) % 1;
      const px = p1.x + (p2.x - p1.x) * packetT;
      const py = p1.y + (p2.y - p1.y) * packetT;
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#FFF3B0';
      ctx.beginPath();
      ctx.arc(px, py, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 4. Modules on the Board
    for (const i of this.activeCells()) {
      const t = parts[i];
      if (t === 0 || (d && i === d.from)) continue;
      const fam = fams[i] ?? 0;
      const c = this.cellCenter(i);
      const a = this.anim[i];

      let ox = 0;
      let oy = 0;
      if (a.snapT < 1) {
        const ease = easeOutElastic(a.snapT);
        ox = a.startOx * (1 - ease);
        oy = a.startOy * (1 - ease);
      }

      // Squash and stretch during merge / placement pop
      let sx = 1;
      let sy = 1;
      if (a.pop > 0) {
        const p = 1 - a.pop; // 0 -> 1
        const w = Math.sin(p * Math.PI * 2.5) * (1 - p);
        sx = 1 + 0.32 * w;
        sy = 1 - 0.26 * w;
      }

      // Valid merge targets gently pulse to invite the player
      if (d && i !== d.from && t === dragTier && fam === dragFam && dragTier < MAX_TIER) {
        const targetPulse = 1 + 0.06 * Math.sin(time * 10);
        sx *= targetPulse;
        sy *= targetPulse;
      }

      // Two-part fly-together ghost during first 0.14s of merge
      if (a.mergeT > 0 && t > 1) {
        const mk = a.mergeT;
        drawPart(
          ctx,
          t - 1,
          c.x + a.mergeFromX * mk,
          c.y + a.mergeFromY * mk,
          26,
          time,
          i,
          false,
          fam,
          1.15,
          0.85,
        );
      }

      drawPart(ctx, t, c.x + ox, c.y + oy, 29, time, i * 0.9, true, fam, sx, sy);
    }

    // 4.5. Scrap / Recycle Chute at bottom-right of board
    if (this.canScrap()) {
      const overScrap = Boolean(d && dragTier > 0 && this.isOverScrap(d.x, d.y));
      const dragging = Boolean(d && dragTier > 0);
      drawHardwarePanel(ctx, SCRAP_BOX.x, SCRAP_BOX.y, SCRAP_BOX.w, SCRAP_BOX.h, {
        variant: overScrap ? 'red' : dragging ? 'orange' : 'steel',
        chamfer: 8,
        rivets: false,
        activeBorder: overScrap
          ? PALETTE.phosphorAmber
          : dragging
            ? PALETTE.safetyOrange
            : PALETTE.inkDark,
      });

      drawTrashIcon(
        ctx,
        SCRAP_BOX.x + 28,
        SCRAP_BOX.y + SCRAP_BOX.h / 2 + 2,
        28,
        dragging,
        overScrap ? PALETTE.phosphorAmber : PALETTE.chassisCream,
      );

      drawCRTScreen(ctx, SCRAP_BOX.x + 52, SCRAP_BOX.y + 12, 64, 42);
      ctx.save();
      ctx.font = `700 15px ${FONT_DISPLAY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (dragging && dragTier > 0) {
        const refund = Math.max(4, Math.round(buyCost(dragTier, 0) * 0.75));
        drawBolt(ctx, SCRAP_BOX.x + 66, SCRAP_BOX.y + 33, 15, PALETTE.phosphorAmber);
        ctx.fillStyle = PALETTE.phosphorAmber;
        ctx.fillText(`+${formatNumber(refund)}`, SCRAP_BOX.x + 90, SCRAP_BOX.y + 34);
      } else {
        ctx.fillStyle = PALETTE.chassisShade;
        ctx.fillText('DEL', SCRAP_BOX.x + 84, SCRAP_BOX.y + 34);
      }
      ctx.restore();
    }

    // 5. Dragged Part on top (Scale 1.12 lift, drop shadow, lag & velocity tilt)
    if (d && dragTier > 0) {
      const fc = this.cellCenter(d.from);
      // Ghost silhouette in origin slot
      ctx.save();
      ctx.globalAlpha = 0.25;
      drawPart(ctx, dragTier, fc.x, fc.y, 32, 0, 0, false, dragFam);
      ctx.restore();

      const liftK = easeOutBack(d.lift);
      const scale = 1 + 0.12 * liftK;

      // Cast drop shadow on the board surface
      ctx.save();
      ctx.fillStyle = 'rgba(10, 14, 20, 0.55)';
      ctx.beginPath();
      ctx.ellipse(d.sx, d.sy + 16 * liftK, 28 * scale, 16 * scale, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      ctx.save();
      ctx.translate(d.sx, d.sy);
      ctx.rotate(d.tilt);
      drawPart(ctx, dragTier, 0, 0, 29 * scale, time * 1.6, d.from * 0.9, true, dragFam);
      ctx.restore();
    }
  }
}

export { roundRectPath };
