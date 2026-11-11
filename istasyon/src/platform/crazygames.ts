// CrazyGames SDK v2 adapter
import type { Platform } from './types';

declare global {
  interface Window {
    CrazyGames?: {
      SDK?: {
        init: () => Promise<void>;
        ad: {
          requestAd: (
            type: 'midgame' | 'rewarded',
            callbacks?: {
              adStarted?: () => void;
              adFinished?: () => void;
              adError?: (error: unknown) => void;
            },
          ) => Promise<void>;
        };
        game: {
          loadingStart: () => void;
          loadingStop: () => void;
          gameplayStart: () => void;
          gameplayStop: () => void;
          happytime: () => void;
        };
        user?: {
          systemInfo?: {
            countryCode?: string;
          };
        };
      };
    };
  }
}

const memory = new Map<string, string>();

function loadScript(src: string): Promise<void> {
  return new Promise((resolve) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => resolve(); // never reject
    document.head.appendChild(script);
  });
}

export function createCrazyGamesPlatform(): Platform {
  const p: Platform = {
    id: 'crazygames',
    init: async () => {
      try {
        await loadScript('https://sdk.crazygames.com/crazygames-sdk-v2.js');
        if (window.CrazyGames?.SDK) {
          await window.CrazyGames.SDK.init();
        }
      } catch {
        /* fall back to no-ads */
      }
    },
    loadingFinished: () => {
      try {
        window.CrazyGames?.SDK?.game.loadingStop();
      } catch {
        /* ignore */
      }
    },
    gameplayStart: () => {
      try {
        window.CrazyGames?.SDK?.game.gameplayStart();
      } catch {
        /* ignore */
      }
    },
    gameplayStop: () => {
      try {
        window.CrazyGames?.SDK?.game.gameplayStop();
      } catch {
        /* ignore */
      }
    },
    commercialBreak: () => {
      return new Promise<void>((resolve) => {
        if (!window.CrazyGames?.SDK?.ad) {
          resolve();
          return;
        }
        p.onAdStart();
        window.CrazyGames.SDK.ad.requestAd('midgame', {
          adStarted: () => {},
          adFinished: () => {
            p.onAdEnd();
            resolve();
          },
          adError: () => {
            p.onAdEnd();
            resolve();
          },
        });
      });
    },
    rewardedBreak: () => {
      return new Promise<boolean>((resolve) => {
        if (!window.CrazyGames?.SDK?.ad) {
          resolve(false);
          return;
        }
        p.onAdStart();
        window.CrazyGames.SDK.ad.requestAd('rewarded', {
          adStarted: () => {},
          adFinished: () => {
            p.onAdEnd();
            resolve(true);
          },
          adError: () => {
            p.onAdEnd();
            resolve(false);
          },
        });
      });
    },
    getItem(key: string): string | null {
      try {
        const v = window.localStorage.getItem(key);
        if (v !== null) return v;
      } catch {
        /* ignore */
      }
      return memory.has(key) ? (memory.get(key) as string) : null;
    },
    setItem(key: string, value: string): void {
      memory.set(key, value);
      try {
        window.localStorage.setItem(key, value);
      } catch {
        /* ignore */
      }
    },
    onAdStart: () => {},
    onAdEnd: () => {},
    happyMoment: () => {
      try {
        window.CrazyGames?.SDK?.game.happytime();
      } catch {
        /* ignore */
      }
    },
    language: () => {
      try {
        const l = (navigator.language || 'en').slice(0, 2).toLowerCase();
        return l || 'en';
      } catch {
        return 'en';
      }
    },
  };
  return p;
}
