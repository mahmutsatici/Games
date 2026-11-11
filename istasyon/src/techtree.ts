// 8-Node Star Tech Tree & Orbit Prestige Launch Console with clear visual icons & localized descriptions.
import { PERKS, PERK_IDS, perkCost, prestigeStars, type PerkId } from './economy';
import type { GameState } from './state';
import { formatNumber } from './format';
import { t } from './i18n';
import { Overlays, button, el } from './overlay';
import { SVG_BOLT, SVG_ROCKET, SVG_STAR } from './icons';
import { sound } from './audio';

const PERK_ICONS: Record<PerkId, string> = {
  core_flux: SVG_BOLT,
  amp_link:
    '<svg viewBox="-12 -12 24 24" width="1.3em" height="1.3em"><polygon points="0,-10 10,0 0,10 -10,0" fill="#f2a93b" stroke="#111622" stroke-width="1.8"/><circle cx="0" cy="0" r="3.5" fill="#111622"/></svg>',
  drone_bay:
    '<svg viewBox="-14 -10 28 20" width="1.4em" height="1.3em"><line x1="-11" y1="-2" x2="11" y2="-2" stroke="#64748b" stroke-width="2.5"/><ellipse cx="0" cy="0" rx="7" ry="4.5" fill="#f4efe6" stroke="#111622" stroke-width="1.5"/><circle cx="0" cy="0" r="2" fill="#2ec4b6"/></svg>',
  start_tier:
    '<svg viewBox="-12 -12 24 24" width="1.3em" height="1.3em"><path d="M0-10L8-2H3V10H-3V-2H-8Z" fill="#7ac74f" stroke="#111622" stroke-width="1.6"/></svg>',
  col_beam:
    '<svg viewBox="-12 -12 24 24" width="1.3em" height="1.3em"><polygon points="-6,-9 6,-9 10,0 6,9 -6,9 -10,0" fill="#173f4c" stroke="#2ec4b6" stroke-width="1.8"/><circle cx="0" cy="0" r="3.5" fill="#2ec4b6"/></svg>',
  cap_bank:
    '<svg viewBox="-12 -12 24 24" width="1.3em" height="1.3em"><rect x="-7" y="-9" width="14" height="18" rx="2" fill="#f4efe6" stroke="#111622" stroke-width="1.6"/><rect x="-4" y="-5" width="8" height="3" fill="#7ac74f"/><rect x="-4" y="0" width="8" height="3" fill="#7ac74f"/><rect x="-4" y="5" width="8" height="3" fill="#7ac74f"/></svg>',
  contract_vip:
    '<svg viewBox="-12 -12 24 24" width="1.3em" height="1.3em"><rect x="-8" y="-10" width="16" height="20" rx="2" fill="#f4efe6" stroke="#111622" stroke-width="1.6"/><line x1="-4" y1="-4" x2="4" y2="-4" stroke="#e05a2b" stroke-width="2"/><line x1="-4" y1="1" x2="4" y2="1" stroke="#111622" stroke-width="2"/><line x1="-4" y1="6" x2="2" y2="6" stroke="#111622" stroke-width="2"/></svg>',
  diagonal_bus:
    '<svg viewBox="-12 -12 24 24" width="1.3em" height="1.3em"><line x1="-7" y1="-7" x2="7" y2="7" stroke="#2ec4b6" stroke-width="2.2"/><line x1="7" y1="-7" x2="-7" y2="7" stroke="#2ec4b6" stroke-width="2.2"/><circle cx="-7" cy="-7" r="3" fill="#f2a93b"/><circle cx="7" cy="-7" r="3" fill="#f2a93b"/><circle cx="-7" cy="7" r="3" fill="#f2a93b"/><circle cx="7" cy="7" r="3" fill="#f2a93b"/><circle cx="0" cy="0" r="3.5" fill="#7ac74f"/></svg>',
};

export function showTechTreeOverlay(
  overlays: Overlays,
  state: GameState,
  onLaunch: () => void,
  onClose: () => void,
): void {
  overlays.open((card, close) => {
    card.classList.add('tech-card');

    // Clear Localized Title
    el('div', 'tech-title', t('techTitle'), card);

    // Header row: Planet Level status + Star balance
    const planetKey = `planet${(state.orbit % 4) + 1}`;
    const header = el('div', 'tech-header', '', card);
    el('div', 'tech-orbit-tag', `${SVG_ROCKET}<span>LV.${state.orbit + 1} ${t(planetKey)}</span>`, header);
    const starBank = el('div', 'tech-star-bank', '', header);

    const renderStars = () => {
      starBank.innerHTML = `${SVG_STAR}<span>${formatNumber(state.stars)}</span>`;
    };
    renderStars();

    // 8-node Tech Grid (4 columns x 2 rows)
    const grid = el('div', 'tech-grid', '', card);

    const renderNodes = () => {
      grid.innerHTML = '';
      for (const id of PERK_IDS) {
        const def = PERKS[id];
        const lvl = state.perks[id] ?? 0;
        const maxed = lvl >= def.max;
        const cost = perkCost(id, lvl);
        const canAfford = !maxed && state.stars >= cost;

        const node = el(
          'button',
          `tech-node ${lvl > 0 ? 'unlocked' : ''} ${maxed ? 'maxed' : ''} ${canAfford ? 'affordable' : ''}`,
          '',
          grid,
        );
        node.type = 'button';
        node.disabled = !canAfford;

        el('div', 'tech-node-icon', PERK_ICONS[id], node);
        el('div', 'tech-node-code', t(`p_${id}`), node);
        el('div', 'tech-node-desc', t(`d_${id}`), node);
        el('div', 'tech-node-lvl', `${lvl} / ${def.max}`, node);

        el(
          'div',
          'tech-node-cost',
          maxed ? 'MAX' : `${SVG_STAR} ${cost}`,
          node,
        );

        node.addEventListener('click', (e) => {
          e.stopPropagation();
          if (state.stars < cost || state.perks[id] >= def.max) return;
          state.stars -= cost;
          state.perks[id]++;
          sound.playBuy();
          renderStars();
          renderNodes();
        });
      }
    };
    renderNodes();

    // Prestige / Next Planet Launch explanation bar
    const launchBox = el('div', 'tech-launch-box', '', card);
    const canLaunch = state.planetProgress >= 100 && state.bossDefeated;
    const pendingStars = prestigeStars(state.totalEnergyThisRun);
    const nextPlanet = t(`planet${((state.orbit + 1) % 4) + 1}`);

    if (canLaunch) {
      el(
        'div',
        'tech-launch-info',
        `${SVG_ROCKET}<span>${t('orbitReady')} (${nextPlanet}) &bull; +${formatNumber(pendingStars)} ${SVG_STAR}</span>`,
        launchBox,
      );
    } else {
      const pct = Math.floor(state.planetProgress);
      el(
        'div',
        'tech-launch-locked',
        `${SVG_ROCKET}<span>${t('orbitGoal')} (%${pct} / %100)</span>`,
        launchBox,
      );
    }

    const row = el('div', 'row', '', card);
    if (canLaunch) {
      button('green', `${SVG_ROCKET}<span>${t('launch')} (+${formatNumber(pendingStars)} ★)</span>`, row, () => {
        close();
        onLaunch();
      });
    }
    button('panel', t('back'), row, () => {
      close();
      onClose();
    });
  }, 'tech-dialog');
}
