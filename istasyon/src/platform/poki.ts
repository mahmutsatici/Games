// Poki SDK v2 adapter
import type { Platform } from './types';

declare global {
  interface Window {
    PokiSDK?: {
      init: () => Promise<void>;
      gameLoadingFinished: () => void;
      gameplayStart: () => void;
      gameplayStop: () => void;
      commercialBreak: () => Promise<void>;
      rewardedBreak: () => Promise<boolean>;
      setDebug?: (debug: boolean) => void;
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

export function createPokiPlatform(): Platform {
  let pokiReady = false;

  const p: Platform = {
    id: 'poki',
    init: async () => {
      try {
        await loadScript('https://game-cdn.poki.com/scripts/v2/poki-sdk.js');
        if (window.PokiSDK) {
          await window.PokiSDK.init();
          pokiReady = true;
        }
      } catch {
        /* fallback */
      }
    },
    loadingFinished: () => {
      if (pokiReady && window.PokiSDK) {
        window.PokiSDK.gameLoadingFinished();
      }
    },
    gameplayStart: () => {
      if (pokiReady && window.PokiSDK) {
        window.PokiSDK.gameplayStart();
      }
    },
    gameplayStop: () => {
      if (pokiReady && window.PokiSDK) {
        window.PokiSDK.gameplayStop();
      }
    },
    commercialBreak: async () => {
      if (!pokiReady || !window.PokiSDK) return;
      p.onAdStart();
      try {
        await window.PokiSDK.commercialBreak();
      } finally {
        p.onAdEnd();
      }
    },
    rewardedBreak: async () => {
      if (!pokiReady || !window.PokiSDK) return false;
      p.onAdStart();
      try {
        return await window.PokiSDK.rewardedBreak();
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
        /* storage blocked */
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
