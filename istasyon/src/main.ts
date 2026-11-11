import { createPlatform } from './platform';
import { View } from './view';
import { Background } from './background';
import { Game } from './game';
import { loadState, saveState } from './save';
import { Overlays, button, el } from './overlay';
import { setLang, t } from './i18n';
import { formatNumber } from './format';
import { OFFLINE_RATE, offlineCapSeconds } from './economy';
import { SVG_BOLT, SVG_FILM, SVG_ROCKET, SVG_STAR } from './icons';
import { showDailyOverlay } from './daily';
import { showSettingsOverlay } from './settings';
import { showTechTreeOverlay } from './techtree';
import { sound } from './audio';
import { newState } from './state';

const platform = createPlatform();
const stage = document.getElementById('stage') as HTMLElement;
const canvas = document.getElementById('game') as HTMLCanvasElement;
const uiRoot = document.getElementById('ui') as HTMLElement;
const view = new View(stage, canvas);
const bg = new Background();
const game = new Game();
const overlays = new Overlays(uiRoot);

let last = performance.now();
let timeScale = 1;
let ready = false;
let adActive = false;
let playing = false;

// Expose debug & QA hooks on window in DEV for automated playtest & game-qa verification
if (import.meta.env.DEV) {
  const w = window as unknown as Record<string, unknown>;
  w.__game = game;
  w.__GAME__ = game;
  w.__GAME_STATE__ = game.state;
  w.__setTimeScale = (s: number) => {
    timeScale = s;
  };
  w.advanceTime = (ms: number) => {
    const steps = Math.max(1, Math.round(ms / (1000 / 60)));
    const dt = ms / 1000 / steps;
    for (let i = 0; i < steps; i++) {
      bg.update(dt);
      game.update(dt);
    }
  };
  w.render_game_to_text = () =>
    JSON.stringify({
      coords: 'origin:top-left x:right y:down (1280x720 logical)',
      mode: game.paused ? 'paused' : 'playing',
      level: game.state.orbit + 1,
      score: Math.round(game.state.score),
      energy: Math.round(game.state.energy),
      productionPerSec: Math.round(game.productionPerSecond() * 10) / 10,
      planetProgress: Math.round(game.state.planetProgress * 10) / 10,
      phase:
        game.state.planetProgress >= 100 || game.meteor.waveNumber > 0
          ? 'defend'
          : 'build',
      wave: game.meteor.waveNumber,
      activeThreats: game.meteor.threats.length,
      bossDefeated: game.state.bossDefeated,
    });
}

// ---------- Gameplay start / stop ----------
function refreshGameplay(): void {
  const shouldPlay = ready && !overlays.anyOpen && !adActive && !document.hidden;
  game.inputEnabled = !overlays.anyOpen && !adActive;
  if (!game.inputEnabled) game.pointerCancel();
  if (shouldPlay === playing) return;
  playing = shouldPlay;
  if (playing) platform.gameplayStart();
  else platform.gameplayStop();
}
overlays.onChange = refreshGameplay;

platform.onAdStart = () => {
  adActive = true;
  game.paused = true;
  sound.setEnabled(false);
  refreshGameplay();
};
platform.onAdEnd = () => {
  adActive = false;
  game.paused = false;
  sound.setEnabled(game.state.sound);
  last = performance.now();
  refreshGameplay();
};

// ---------- Saving ----------
function save(): void {
  saveState(platform, game.state);
  game.dirty = false;
}
setInterval(save, 5000);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) save();
  last = performance.now();
  refreshGameplay();
});
window.addEventListener('pagehide', save);

// ---------- Loop ----------
function frame(now: number): void {
  const dt = Math.min(0.25, Math.max(0, (now - last) / 1000));
  last = now;
  const scaledDt = dt * timeScale;
  bg.update(scaledDt);
  game.update(scaledDt);
  if (game.dirty) save();
  const ctx = view.begin();
  bg.draw(
    ctx,
    game.state.orbit,
    game.state.highestTierEver,
    Math.floor(game.state.planetProgress),
    game.activeModuleCount(),
    game.boardYOffset,
    game.meteor.shieldFlash,
  );
  game.draw(ctx);
  requestAnimationFrame(frame);
}

// ---------- Input (mouse + touch through pointer events) ----------
let activePointer: number | null = null;
canvas.addEventListener('pointerdown', (e) => {
  if (activePointer !== null) return;
  activePointer = e.pointerId;
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {
    /* ignore */
  }
  const p = view.toLogical(e.clientX, e.clientY);
  game.pointerDown(p.x, p.y);
  e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== activePointer) return;
  const p = view.toLogical(e.clientX, e.clientY);
  game.pointerMove(p.x, p.y);
});
canvas.addEventListener('pointerup', (e) => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  const p = view.toLogical(e.clientX, e.clientY);
  game.pointerUp(p.x, p.y);
});
canvas.addEventListener('pointercancel', (e) => {
  if (e.pointerId !== activePointer) return;
  activePointer = null;
  game.pointerCancel();
});
canvas.addEventListener('contextmenu', (e) => e.preventDefault());

// ---------- Hidden debug: press ] three times to toggle x20 time (dev builds only) ----------
if (import.meta.env.DEV) {
  let presses: number[] = [];
  window.addEventListener('keydown', (e) => {
    if (e.key !== ']') return;
    const now = performance.now();
    presses = presses.filter((p) => now - p < 1500);
    presses.push(now);
    if (presses.length >= 3) {
      presses = [];
      timeScale = timeScale === 1 ? 20 : 1;
      console.info('[debug] time scale', timeScale);
    }
  });
}

// ---------- Game Event Handlers ----------
game.onHappyMoment = () => {
  platform.happyMoment();
};

game.onBoost = async () => {
  const ok = await platform.rewardedBreak();
  if (ok) {
    game.extendBoost();
    save();
  }
};

game.onFreePart = async () => {
  const ok = await platform.rewardedBreak();
  if (ok) {
    game.applyFreePart();
    save();
  }
};

game.onDaily = () => {
  showDailyOverlay(
    overlays,
    game.state,
    game.steadyProduction(),
    (_day, energyReward, bonusPartTier) => {
      game.addEnergy(energyReward);
      if (bonusPartTier > 0) {
        game.placePart(game.randomEmptyCell(), bonusPartTier, true, 0);
      }
      save();
    },
    () => {
      void platform.commercialBreak();
    },
  );
};

game.onPrestige = () => {
  showTechTreeOverlay(
    overlays,
    game.state,
    () => {
      game.startLaunch();
    },
    () => {
      game.refreshSim();
      save();
      void platform.commercialBreak();
    },
  );
};

game.onLaunchComplete = () => {
  overlays.open((card, close) => {
    el(
      'div',
      'prestige-stars-text',
      `${SVG_ROCKET}<span>ORB-0${(game.state.orbit % 4) + 1}</span>`,
      card,
    );
    el(
      'div',
      'prestige-desc',
      `${SVG_STAR} ${formatNumber(game.state.stars)}`,
      card,
    );
    const row = el('div', 'row', '', card);
    button('green', t('collect'), row, () => {
      close();
      save();
      void platform.commercialBreak();
    });
  });
};

game.onSettings = () => {
  showSettingsOverlay(
    overlays,
    game.state,
    () => {
      const fresh = newState();
      fresh.lang = game.state.lang;
      fresh.sound = game.state.sound;
      fresh.volume = game.state.volume;
      game.setState(fresh);
      save();
    },
    () => {
      save();
      void platform.commercialBreak();
    },
  );
};

// ---------- Offline earnings ----------
function showOffline(amount: number): void {
  overlays.open((card, close) => {
    el('div', 'big', `${SVG_BOLT}<span>${formatNumber(amount)}</span>`, card);
    const row = el('div', 'row', '', card);
    button('green', t('collect'), row, () => {
      game.addEnergy(amount);
      save();
      close();
    });
    const x2 = button('violet', `${SVG_FILM}<span>x2</span>`, row, async () => {
      x2.disabled = true;
      const ok = await platform.rewardedBreak();
      if (ok) {
        game.addEnergy(amount * 2);
        save();
        close();
      }
    });
  });
}

function checkOffline(): void {
  const s = game.state;
  const elapsed = Math.max(0, (Date.now() - s.lastSeen) / 1000);
  if (elapsed < 10) return;
  const cap = offlineCapSeconds(game.batteryCount(), s.perks.cap_bank || 0);
  const amount = Math.min(elapsed, cap) * game.steadyProduction() * OFFLINE_RATE;
  if (amount > 0) showOffline(amount);
}

// ---------- Boot ----------
async function boot(): Promise<void> {
  await platform.init();
  const loaded = loadState(platform);
  if (loaded) game.setState(loaded);
  setLang(game.state.lang || platform.language());
  sound.setEnabled(game.state.sound);
  sound.setVolume(game.state.volume ?? 0.8);
  if (loaded) checkOffline();
  save();
  requestAnimationFrame((now) => {
    last = now;
    frame(now);
    platform.loadingFinished();
    ready = true;
    refreshGameplay();
  });
}

void boot();
