import type { Platform } from './types';

// NOTE: docs.crazygames.com was unreachable when written; API shape below is from memory of SDK v3
// (SDK.init() promise, game.*, ad.requestAd(type, {adStarted, adFinished, adError}), data.getItem/setItem
// synchronous, user language via SDK.user.systemInfo.locale). Unverified against live docs.
const SDK_URL = 'https://sdk.crazygames.com/crazygames-sdk-v3.js';
const TIMEOUT_MS = 6000;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('load failed'));
    document.head.appendChild(s);
  });
}

class CrazyGamesPlatform implements Platform {
  readonly id = 'crazygames' as const;
  onAdStart: () => void = () => {};
  onAdEnd: () => void = () => {};
  private sdk: any = null;

  async init(): Promise<void> {
    try {
      await Promise.race([
        (async () => {
          await loadScript(SDK_URL);
          const sdk = (window as any).CrazyGames?.SDK;
          if (!sdk) throw new Error('no sdk');
          await sdk.init();
          this.sdk = sdk;
        })(),
        new Promise<void>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS)),
      ]);
      try { this.sdk?.game.loadingStart(); } catch { /* ignore */ }
    } catch {
      this.sdk = null;
    }
  }
  loadingFinished(): void { try { this.sdk?.game.loadingStop(); } catch { /* ignore */ } }
  gameplayStart(): void { try { this.sdk?.game.gameplayStart(); } catch { /* ignore */ } }
  gameplayStop(): void { try { this.sdk?.game.gameplayStop(); } catch { /* ignore */ } }
  happyMoment(): void { try { this.sdk?.game.happytime(); } catch { /* ignore */ } }

  private ad(type: 'midgame' | 'rewarded'): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.sdk) { resolve(false); return; }
      let done = false;
      let started = false;
      const finish = (ok: boolean) => {
        if (done) return;
        done = true;
        if (started) this.onAdEnd();
        resolve(ok);
      };
      try {
        this.sdk.ad.requestAd(type, {
          adStarted: () => { started = true; this.onAdStart(); },
          adFinished: () => finish(true),
          adError: () => finish(false),
        });
      } catch { finish(false); }
    });
  }
  async commercialBreak(): Promise<void> { await this.ad('midgame'); }
  rewardedBreak(): Promise<boolean> { return this.ad('rewarded'); }

  getItem(key: string): string | null {
    try {
      const v = this.sdk?.data?.getItem(key);
      if (v != null) return String(v);
    } catch { /* fall through */ }
    try { return localStorage.getItem(key); } catch { return null; }
  }
  setItem(key: string, value: string): void {
    try { this.sdk?.data?.setItem(key, value); } catch { /* ignore */ }
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
  language(): string {
    try {
      const l = this.sdk?.user?.systemInfo?.locale || navigator.language || 'en';
      return String(l).slice(0, 2).toLowerCase();
    } catch { return 'en'; }
  }
}

export function create(): Platform { return new CrazyGamesPlatform(); }
