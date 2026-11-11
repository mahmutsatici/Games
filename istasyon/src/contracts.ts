// Crew Contracts System: 3 active icon-driven objectives with short-term goals & rewards.
import {
  MAX_TIER,
   unlockedFamilies,
  type AdjacencyLink,
  type FamilyId,
} from './economy';
import { formatNumber } from './format';
import { drawBolt, drawCheck, drawStar } from './icons';
import { drawPart } from './parts';
import type { ContractKind, ContractRewardKind, ContractSlot, GameState } from './state';
import { FONT_DISPLAY, PALETTE, drawCRTScreen, drawHardwarePanel } from './theme';

export function findDeliverableCell(
  state: GameState,
  activeCells: readonly number[],
  family: FamilyId,
  minTier: number,
): number {
  // Count total modules on board so we never consume the player's very last module
  let totalModules = 0;
  for (const idx of activeCells) if (state.parts[idx] > 0) totalModules++;
  if (totalModules <= 1) return -1;

  let bestCell = -1;
  let bestTier = 999;
  for (const idx of activeCells) {
    const t = state.parts[idx];
    const f = state.families[idx] ?? 0;
    if (t >= minTier && f === family && t < bestTier) {
      bestTier = t;
      bestCell = idx;
    }
  }
  return bestCell;
}

export function getContractProgress(
  c: ContractSlot,
  state: GameState,
  activeCells: readonly number[],
  currentProd: number,
  links: readonly AdjacencyLink[],
): { progress: number; ready: boolean } {
  if (c.cooldown > 0) return { progress: 0, ready: false };

  if (c.kind === 'deliver') {
    const cell = findDeliverableCell(state, activeCells, c.targetFamily, c.targetTier);
    return { progress: cell >= 0 ? 1 : 0, ready: cell >= 0 };
  }
  if (c.kind === 'prod') {
    const p = Math.min(1, currentProd / Math.max(1, c.targetValue));
    return { progress: p, ready: currentProd >= c.targetValue };
  }
  // 'adjacent'
  const linkCount = links.length;
  const p = Math.min(1, linkCount / Math.max(1, c.targetValue));
  return { progress: p, ready: linkCount >= c.targetValue };
}

export function generateNextContract(
  slotIndex: number,
  state: GameState,
  steadyProd: number,
): ContractSlot {
  const n = state.contractsCompleted + slotIndex + 1;
  const fams = unlockedFamilies(state.highestTierEver);
  const kinds: ContractKind[] = ['prod', 'adjacent', 'deliver'];
  const kind = kinds[n % 3];

  const targetFamily = fams[n % fams.length];
  const targetTier = Math.min(
    MAX_TIER - 1,
    Math.max(2, state.highestTierRun - 1 + (n % 2)),
  );

  let targetValue = 1;
  if (kind === 'prod') {
    targetValue = Math.max(35, Math.round(steadyProd * (1.45 + (n % 3) * 0.3)));
  } else if (kind === 'adjacent') {
    targetValue = Math.min(14, 6 + Math.floor(n / 2));
  }

  const rewardKinds: ContractRewardKind[] = ['energy', 'part', 'star'];
  const rewardKind = rewardKinds[(n + slotIndex) % 3];
  let rewardValue = 1;
  const rewardFamily = fams[(n + 1) % fams.length];

  if (rewardKind === 'energy') {
    rewardValue = Math.max(120, Math.round(steadyProd * 55));
  } else if (rewardKind === 'part') {
    rewardValue = Math.min(MAX_TIER - 1, Math.max(2, state.highestTierRun - 1));
  } else {
    rewardValue = 1 + (state.perks.contract_vip || 0);
  }

  return {
    id: Date.now() + slotIndex,
    kind,
    targetFamily,
    targetTier,
    targetValue,
    rewardKind,
    rewardValue,
    rewardFamily,
    cooldown: 90, // New contract arrives every 1.5 minutes
  };
}

export function drawContractCard(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  c: ContractSlot,
  progress: number,
  ready: boolean,
  time: number,
): void {
  drawHardwarePanel(ctx, x, y, w, h, {
    variant: ready ? 'lime' : 'steel',
    chamfer: 7,
    rivets: false,
    activeBorder: ready ? PALETTE.phosphorAmber : PALETTE.inkDark,
  });

  if (c.cooldown > 0) {
    // Waiting for incoming crew transmission
    drawCRTScreen(ctx, x + 8, y + 8, w - 16, h - 16);
    ctx.save();
    ctx.font = `700 16px ${FONT_DISPLAY}`;
    ctx.fillStyle = PALETTE.signalCyan;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.ceil(c.cooldown)}s`, x + w / 2, y + h / 2);
    ctx.restore();
    return;
  }

  // Left CRT Screen: Objective Icon + Target + Progress Bar
  const crtW = w - 78;
  drawCRTScreen(ctx, x + 7, y + 7, crtW, h - 14);

  ctx.save();
  const cy = y + h / 2 - 5;

  if (c.kind === 'deliver') {
    drawPart(ctx, c.targetTier, x + 29, cy, 15, time, 0, true, c.targetFamily);
    // Arrow icon -> crate
    ctx.strokeStyle = PALETTE.phosphorAmber;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(x + 54, cy);
    ctx.lineTo(x + 72, cy);
    ctx.lineTo(x + 66, cy - 5);
    ctx.moveTo(x + 72, cy);
    ctx.lineTo(x + 66, cy + 5);
    ctx.stroke();

    ctx.font = `700 15px ${FONT_DISPLAY}`;
    ctx.fillStyle = PALETTE.chassisCream;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`T${c.targetTier}`, x + 78, cy);
  } else if (c.kind === 'prod') {
    drawBolt(ctx, x + 25, cy, 20, PALETTE.phosphorAmber);
    ctx.font = `700 15px ${FONT_DISPLAY}`;
    ctx.fillStyle = PALETTE.chassisCream;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${formatNumber(c.targetValue)}/s`, x + 40, cy);
  } else {
    // 'adjacent' links
    ctx.strokeStyle = PALETTE.signalCyan;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(x + 22, cy, 6, 0, Math.PI * 2);
    ctx.arc(x + 32, cy, 6, 0, Math.PI * 2);
    ctx.stroke();

    ctx.font = `700 15px ${FONT_DISPLAY}`;
    ctx.fillStyle = PALETTE.chassisCream;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`x${c.targetValue}`, x + 46, cy);
  }

  // Progress bar at bottom of CRT screen
  const barX = x + 13;
  const barY = y + h - 16;
  const barW = crtW - 12;
  ctx.fillStyle = '#182C29';
  ctx.fillRect(barX, barY, barW, 5);
  ctx.fillStyle = ready ? PALETTE.cellLime : PALETTE.phosphorAmber;
  ctx.fillRect(barX, barY, barW * Math.max(0.06, progress), 5);

  // Right Reward Box
  const rx = x + w - 36;
  const ry = y + h / 2;
  if (c.rewardKind === 'energy') {
    drawBolt(ctx, rx, ry - 9, 18, PALETTE.phosphorAmber);
    ctx.font = `700 12px ${FONT_DISPLAY}`;
    ctx.fillStyle = ready ? PALETTE.inkDark : PALETTE.chassisCream;
    ctx.textAlign = 'center';
    ctx.fillText(formatNumber(c.rewardValue), rx, ry + 12);
  } else if (c.rewardKind === 'star') {
    drawStar(ctx, rx, ry - 8, 19, PALETTE.phosphorAmber);
    ctx.font = `700 13px ${FONT_DISPLAY}`;
    ctx.fillStyle = ready ? PALETTE.inkDark : PALETTE.chassisCream;
    ctx.textAlign = 'center';
    ctx.fillText(`+${c.rewardValue}`, rx, ry + 12);
  } else {
    drawPart(ctx, c.rewardValue, rx, ry - 2, 13, time, 0, true, c.rewardFamily);
  }

  if (ready) {
    drawCheck(ctx, x + crtW - 6, y + 18, 14, PALETTE.cellLime);
  }

  ctx.restore();
}
