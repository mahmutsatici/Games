// "KIBO-7" Maintenance Robot Mascot.
// Reacts to merges, points at claimable contracts/events, and celebrates milestones (100% text-free poses).
import { PALETTE, STROKE_W, chamferRectPath, easeOutBack } from './theme';

export type MascotPose = 'idle' | 'happy' | 'point' | 'celebrate';

export class Mascot {
  pose: MascotPose = 'idle';
  poseTimer = 0;
  private time = 0;

  trigger(pose: MascotPose, duration = 1.4): void {
    // Celebrate overrides lesser poses
    if (this.pose === 'celebrate' && this.poseTimer > 0 && pose !== 'celebrate') return;
    this.pose = pose;
    this.poseTimer = duration;
  }

  update(dt: number, hasReadyContract: boolean): void {
    this.time += dt;
    if (this.poseTimer > 0) {
      this.poseTimer -= dt;
      if (this.poseTimer <= 0) {
        this.pose = 'idle';
      }
    }
    if (this.pose === 'idle' && hasReadyContract) {
      this.pose = 'point';
    } else if (this.pose === 'point' && !hasReadyContract && this.poseTimer <= 0) {
      this.pose = 'idle';
    }
  }

  draw(ctx: CanvasRenderingContext2D, x = 235, y = 650): void {
    const t = this.time;
    const p = this.pose;

    let bobY = Math.sin(t * 3.2) * 4;
    let tilt = Math.sin(t * 1.6) * 0.05;
    let scaleX = 1;
    let scaleY = 1;

    if (p === 'happy') {
      const k = easeOutBack(Math.min(1, (1.4 - this.poseTimer) * 3));
      bobY = -12 * Math.sin(k * Math.PI);
      scaleX = 1.08;
      scaleY = 0.94;
      tilt = Math.sin(t * 14) * 0.14;
    } else if (p === 'point') {
      bobY = Math.sin(t * 5) * 3;
      tilt = -0.22; // Leaning toward the left contract panel
    } else if (p === 'celebrate') {
      bobY = -18 * Math.abs(Math.sin(t * 8));
      tilt = Math.sin(t * 12) * 0.25;
      scaleX = 1.1;
      scaleY = 1.1;
    }

    ctx.save();
    ctx.translate(x, y + bobY);

    // Small thruster hover puff underneath
    ctx.fillStyle = p === 'celebrate' ? PALETTE.phosphorAmber : PALETTE.signalCyan;
    ctx.beginPath();
    ctx.ellipse(0, 26, 10 + Math.sin(t * 18) * 3, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.rotate(tilt);
    ctx.scale(scaleX, scaleY);

    ctx.lineWidth = STROKE_W;
    ctx.strokeStyle = PALETTE.inkDark;

    // Top telemetry antenna
    ctx.beginPath();
    ctx.moveTo(0, -22);
    ctx.lineTo(0, -34);
    ctx.stroke();
    ctx.fillStyle =
      p === 'point' || p === 'celebrate' ? PALETTE.safetyOrange : PALETTE.phosphorAmber;
    ctx.beginPath();
    ctx.arc(0, -36, 4.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Left Arm (points at contracts when in 'point' pose, raised in 'celebrate')
    ctx.save();
    if (p === 'point') {
      const poke = Math.sin(t * 9) * 5;
      ctx.translate(-22 + poke, -4);
      ctx.rotate(-0.2);
      ctx.fillStyle = PALETTE.safetyOrange;
      chamferRectPath(ctx, -18, -5, 20, 10, 3);
      ctx.fill();
      ctx.stroke();
    } else if (p === 'celebrate' || p === 'happy') {
      ctx.translate(-22, -14);
      ctx.rotate(-0.8);
      ctx.fillStyle = PALETTE.chassisCream;
      chamferRectPath(ctx, -14, -4, 16, 8, 3);
      ctx.fill();
      ctx.stroke();
    } else {
      ctx.translate(-22, 2);
      ctx.fillStyle = PALETTE.panelSteel;
      chamferRectPath(ctx, -8, -4, 10, 12, 3);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();

    // Right Wrench Arm
    ctx.save();
    if (p === 'celebrate' || p === 'happy') {
      ctx.translate(22, -14);
      ctx.rotate(0.8 + Math.sin(t * 16) * 0.3);
    } else {
      ctx.translate(22, 2);
    }
    ctx.fillStyle = PALETTE.chassisCream;
    chamferRectPath(ctx, -2, -4, 14, 8, 3);
    ctx.fill();
    ctx.stroke();
    // Wrench C-claw
    ctx.beginPath();
    ctx.arc(14, 0, 5, 0.6, Math.PI * 2 - 0.6);
    ctx.stroke();
    ctx.restore();

    // Main Spherical-Chamfered Chassis Body
    chamferRectPath(ctx, -22, -22, 44, 42, 12);
    ctx.fillStyle = PALETTE.chassisCream;
    ctx.fill();
    ctx.stroke();

    // Orange industrial belly stripe
    ctx.fillStyle = PALETTE.safetyOrange;
    ctx.fillRect(-20, 10, 40, 6);

    // Recessed Dark CRT Visor Screen
    chamferRectPath(ctx, -16, -15, 32, 21, 5);
    ctx.fillStyle = PALETTE.crtDark;
    ctx.fill();
    ctx.stroke();

    // Expressive Optic Eyes inside Visor
    ctx.strokeStyle = p === 'celebrate' ? PALETTE.phosphorAmber : PALETTE.signalCyan;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';

    if (p === 'happy' || p === 'celebrate') {
      // Happy ^ ^ arcs
      for (const ex of [-7, 7]) {
        ctx.beginPath();
        ctx.arc(ex, -3, 4.5, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      }
    } else if (p === 'point') {
      // Focused eyes looking left toward contracts
      for (const ex of [-9, 5]) {
        ctx.beginPath();
        ctx.arc(ex, -5, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else {
      // Idle blink every ~3.5 seconds
      const blink = Math.sin(t * 1.8) > 0.96;
      for (const ex of [-7, 7]) {
        if (blink) {
          ctx.beginPath();
          ctx.moveTo(ex - 4, -5);
          ctx.lineTo(ex + 4, -5);
          ctx.stroke();
        } else {
          ctx.beginPath();
          ctx.arc(ex, -5, 3.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    ctx.restore();
  }
}
