// GameDistribution SDK adapter
import type { Platform } from './types';

declare global {
  interface Window {
    GD_OPTIONS?: Record<string, unknown>;
    gdsdk?: {
      showAd: (type?: 'rewarded') => Promise<void>;
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
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

export function createGDPlatform(): Platform {
  const p: Platform = {
    id: 'gd',
    init: async () => {
      try {
        window.GD_OPTIONS = {
          gameId: 'istasyon',
          onEvent: (event: { name: string }) => {
            switch (event.name) {
              case 'SDK_GAME_PAUSE':
                p.onAdStart();
                break;
              case 'SDK_GAME_START':
                p.onAdEnd();
                break;
            }
          },
        };
        await loadScript('https://html5.api.gamedistribution.com/main.min.js');
      } catch {
        /* fallback */
      }
    },
    loadingFinished: () => {},
    gameplayStart: () => {},
    gameplayStop: () => {},
    commercialBreak: async () => {
      if (!window.gdsdk?.showAd) return;
      try {
        p.onAdStart();
        await window.gdsdk.showAd();
      } catch {
        /* ignore */
      } finally {
        p.onAdEnd();
      }
    },
    rewardedBreak: async () => {
      if (!window.gdsdk?.showAd) return false;
      try {
        p.onAdStart();
        await window.gdsdk.showAd('rewarded');
        return true;
      } catch {
        return false;
      } finally {
        p.onAdEnd();
      }
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
    happyMoment: () => {},
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
