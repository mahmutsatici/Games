// Supply drones: fly in with smooth banking & hover bob, drop a module via magnetic tractor beam, and fly out.
import type { Board } from './board';
import type { FamilyId } from './economy';
import { drawDrone } from './icons';
import { drawPart } from './parts';
import { PALETTE, easeInOutCubic, easeOutBack, easeOutCubic } from './theme';
import { W } from './view';

interface Flight {
  cell: number;
  tier: number;
  family: FamilyId;
  t: number;
  phase: 0 | 1 | 2; // 0 in, 1 tractor-beam drop pause, 2 out
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  ex: number;
  ey: number;
}

const IN_TIME = 0.78;
const DROP_TIME = 0.22;
const OUT_TIME = 0.68;

export class Drones {
  timer = 0;
  private flights: Flight[] = [];

  constructor(
    private board: Board,
    private place: (cell: number, tier: number, family: FamilyId) => boolean,
  ) {}

  reset(): void {
    this.timer = 0;
    this.flights = [];
  }

  reserved(): Set<number> {
    return new Set(this.flights.filter((f) => f.phase === 0).map((f) => f.cell));
  }

  /** Progress 0..1 toward the next drop. */
  progress(interval: number): number {
    return Math.min(1, this.timer / interval);
  }

  launch(tier: number, family: FamilyId = 0): boolean {
    const res = this.reserved();
    const free = this.board.emptyCells().filter((i) => !res.has(i));
    if (free.length === 0) return false;
    const cell = free[Math.floor(Math.random() * free.length)];
    const c = this.board.cellCenter(cell);
    const fromLeft = Math.random() < 0.5;
    this.flights.push({
      cell,
      tier,
      family,
      t: 0,
      phase: 0,
      sx: fromLeft ? -60 : W + 60,
      sy: 90 + Math.random() * 90,
      tx: c.x,
      ty: c.y - 58,
      ex: fromLeft ? W + 60 : -60,
      ey: 55 + Math.random() * 70,
    });
    return true;
  }

  update(dt: number, interval: number, rollDrop: () => { tier: number; family: FamilyId }): void {
    this.timer += dt;
    if (this.timer >= interval) {
      const drop = rollDrop();
      if (this.launch(drop.tier, drop.family)) this.timer -= interval;
      else this.timer = interval; // hold until a cell frees up
      if (this.timer > interval) this.timer = 0;
    }
    for (const f of this.flights) {
      f.t += dt;
      if (f.phase === 0 && f.t >= IN_TIME) {
        f.phase = 1;
        f.t = 0;
        let cell = f.cell;
        if (!this.board.isEmpty(cell)) {
          const free = this.board.emptyCells();
          cell = free.length ? free[0] : -1;
        }
        if (cell >= 0 && this.place(cell, f.tier, f.family)) {
          f.tier = 0;
        } else {
          this.timer = interval;
        }
      } else if (f.phase === 1 && f.t >= DROP_TIME) {
        f.phase = 2;
        f.t = 0;
      }
    }
    this.flights = this.flights.filter((f) => !(f.phase === 2 && f.t >= OUT_TIME));
  }

  draw(ctx: CanvasRenderingContext2D, time: number): void {
    for (const f of this.flights) {
      let x: number;
      let y: number;
      let bankAngle = 0;
      const dir = f.tx >= f.sx ? 1 : -1;

      if (f.phase === 0) {
        const raw = Math.min(1, f.t / IN_TIME);
        const k = easeOutCubic(raw);
        x = f.sx + (f.tx - f.sx) * k;
        y = f.sy + (f.ty - f.sy) * k - Math.sin(raw * Math.PI) * 32;
        bankAngle = dir * (1 - k) * 0.22;
      } else if (f.phase === 1) {
        const raw = Math.min(1, f.t / DROP_TIME);
        x = f.tx;
        y = f.ty - Math.sin(raw * Math.PI) * 6;
        // Bright tractor-beam delivery pulse into the target slot
        ctx.save();
        ctx.globalAlpha = (1 - raw) * 0.55;
        ctx.strokeStyle = PALETTE.signalCyan;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.tx, f.ty + 58, 12 + raw * 26, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        const raw = Math.min(1, f.t / OUT_TIME);
        const k = easeInOutCubic(raw);
        x = f.tx + (f.ex - f.tx) * k;
        y = f.ty + (f.ey - f.ty) * k - Math.sin(raw * Math.PI) * 18;
        bankAngle = (f.ex >= f.tx ? 1 : -1) * Math.sin(raw * Math.PI) * 0.24;
      }

      ctx.save();
      ctx.translate(x, y + Math.sin(time * 7) * 2.5);
      ctx.rotate(bankAngle);
      if (f.tier > 0) {
        const scale = f.phase === 0 ? easeOutBack(Math.min(1, f.t / (IN_TIME * 0.6))) : 1;
        drawPart(ctx, f.tier, 0, 26, 16 * scale, time, 0, false, f.family);
      }
      drawDrone(ctx, 0, 0, 66, time);
      ctx.restore();
    }
  }
}
