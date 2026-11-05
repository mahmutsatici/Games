import type { Platform } from './types';

// NOTE: Event names (SDK_READY, SDK_GAME_START, SDK_GAME_PAUSE, COMPLETE, SKIPPED, AD_ERROR...) verified on
// the GD-HTML5 README. showAd()/showAd('rewarded') promise semantics and GD_OPTIONS.onEvent shape are from
// memory (wiki not fetched). Reward is granted on a COMPLETE event during a rewarded showAd.
const SDK_URL = 'https://html5.api.gamedistribution.com/main.min.js';
const TIMEOUT_MS = 6000;

class GDPlatform implements Platform {
  readonly id = 'gd' as const;
  onAdStart: () => void = () => {};
  onAdEnd: () => void = () => {};
  private sdk: any = null;
  private adActive = false;
  private completed = false;

  private startAd(): void { if (!this.adActive) { this.adActive = true; this.onAdStart(); } }
  private endAd(): void { if (this.adActive) { this.adActive = false; this.onAdEnd(); } }

  init(): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      const done = () => { if (!settled) { settled = true; resolve(); } };
      try {
        const w = window as any;
        w.GD_OPTIONS = {
          gameId: import.meta.env.VITE_GD_GAME_ID,
          onEvent: (event: any) => {
            try {
              switch (event?.name) {
                case 'SDK_GAME_PAUSE': this.startAd(); break;
                case 'SDK_GAME_START': this.endAd(); break;
                case 'COMPLETE': this.completed = true; break;
                case 'SDK_READY': this.sdk = w.gdsdk ?? null; done(); break;
                case 'SDK_ERROR': done(); break;
              }
            } catch { /* ignore */ }
          },
        };
        const s = document.createElement('script');
        s.id = 'gamedistribution-jssdk';
        s.src = SDK_URL; s.async = true;
        s.onerror = () => done();
        document.head.appendChild(s);
      } catch { done(); return; }
      setTimeout(done, TIMEOUT_MS);
    }).then(() => { if (!this.sdk) this.sdk = (window as any).gdsdk ?? null; });
  }
  loadingFinished(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  happyMoment(): void {}

  async commercialBreak(): Promise<void> {
    if (!this.sdk?.showAd) return;
    try { await this.sdk.showAd(); } catch { /* ignore */ }
    this.endAd();
  }
  async rewardedBreak(): Promise<boolean> {
    if (!this.sdk?.showAd) return false;
    this.completed = false;
    try { await this.sdk.showAd('rewarded'); } catch { this.endAd(); return false; }
    this.endAd();
    return this.completed;
  }

  getItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
  language(): string {
    try { return (navigator.language || 'en').slice(0, 2).toLowerCase(); } catch { return 'en'; }
  }
}

export function create(): Platform { return new GDPlatform(); }
