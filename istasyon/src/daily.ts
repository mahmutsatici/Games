// 7-day daily reward streak logic and overlay (zero emoji, hardware console theme)
import { getTodayDateString, isNextDay, isSameDay } from './economy';
import type { GameState } from './state';
import { formatNumber } from './format';
import { t } from './i18n';
import { Overlays, button, el } from './overlay';
import { SVG_BOLT, SVG_STAR } from './icons';

export function isDailyClaimable(state: GameState): boolean {
  const today = getTodayDateString();
  return !isSameDay(state.lastClaimDay, today);
}

export function getEffectiveStreak(state: GameState): number {
  const today = getTodayDateString();
  if (!state.lastClaimDay) return 0;
  if (isSameDay(state.lastClaimDay, today)) {
    return state.dailyStreak;
  }
  if (isNextDay(state.lastClaimDay, today)) {
    return state.dailyStreak % 7;
  }
  return 0;
}

export function showDailyOverlay(
  overlays: Overlays,
  state: GameState,
  steadyProduction: number,
  onClaim: (day: number, energy: number, bonusPartTier: number) => void,
  onClose: () => void,
): void {
  const today = getTodayDateString();
  const claimable = isDailyClaimable(state);
  const currentStreak = getEffectiveStreak(state);
  const claimDay = claimable ? (currentStreak % 7) + 1 : currentStreak;

  overlays.open((card, close) => {
    card.classList.add('daily-card');
    el('div', 'daily-title', `${SVG_STAR}<span>7D LOG</span>${SVG_STAR}`, card);

    const grid = el('div', 'daily-grid', '', card);

    for (let d = 1; d <= 7; d++) {
      const isClaimed = d <= currentStreak;
      const isToday = claimable && d === claimDay;
      const dayEl = el('div', `daily-cell ${isClaimed ? 'claimed' : ''} ${isToday ? 'active' : ''}`, '', grid);

      el('div', 'daily-day-label', `D${d}`, dayEl);

      const energyReward = d * 600 * Math.max(1, steadyProduction);
      el('div', 'daily-reward-text', `${SVG_BOLT} ${formatNumber(energyReward)}`, dayEl);

      if (d === 7) {
        const bonusTier = Math.max(1, state.highestTierEver - 2);
        el('div', 'daily-bonus-tag', `+T${bonusTier}`, dayEl);
      }

      if (isClaimed) {
        el('div', 'daily-badge', 'OK', dayEl);
      }
    }

    const row = el('div', 'row', '', card);

    if (claimable) {
      button('green', t('claim'), row, () => {
        const energyReward = claimDay * 600 * Math.max(1, steadyProduction);
        const bonusPart = claimDay === 7 ? Math.max(1, state.highestTierEver - 2) : 0;
        state.dailyStreak = claimDay;
        state.lastClaimDay = today;
        onClaim(claimDay, energyReward, bonusPart);
        close();
        onClose();
      });
    } else {
      button('panel', t('back'), row, () => {
        close();
        onClose();
      });
    }
  }, 'daily-dialog');
}
