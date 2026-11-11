// Fallback adapter: no SDK, no ads. Used for itch.io / self-hosting and local dev.
import type { Platform } from './types';

const memory = new Map<string, string>();

function browserLanguage(): string {
  try {
    const l = (navigator.language || 'en').slice(0, 2).toLowerCase();
    return l || 'en';
  } catch {
    return 'en';
  }
}

export function createNonePlatform(): Platform {
  const p: Platform = {
    id: 'none',
    init: () => Promise.resolve(),
    loadingFinished: () => {},
    gameplayStart: () => {},
    gameplayStop: () => {},
    commercialBreak: () => Promise.resolve(),
    rewardedBreak: () =>
      new Promise<boolean>((resolve) => {
        p.onAdStart();
        setTimeout(() => {
          p.onAdEnd();
          resolve(true);
        }, 1000);
      }),
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
        /* storage blocked or full: in-memory fallback keeps the session working */
      }
    },
    onAdStart: () => {},
    onAdEnd: () => {},
    happyMoment: () => {},
    language: browserLanguage,
  };
  return p;
}
