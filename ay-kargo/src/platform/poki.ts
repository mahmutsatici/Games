import type { Platform } from './types';

// NOTE: sdk.poki.com was unreachable when written; API from memory of Poki SDK v2:
// PokiSDK.init().then, setDebug(false), gameLoadingFinished, gameplayStart/Stop,
// commercialBreak(cb) -> Promise, rewardedBreak() -> Promise<boolean>. Unverified against live docs.
const SDK_URL = 'https://game-cdn.poki.com/scripts/v2/poki-sdk.js';
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

class PokiPlatform implements Platform {
  readonly id = 'poki' as const;
  onAdStart: () => void = () => {};
  onAdEnd: () => void = () => {};
  private sdk: any = null;

  async init(): Promise<void> {
    try {
      await Promise.race([
        (async () => {
          await loadScript(SDK_URL);
          const sdk = (window as any).PokiSDK;
          if (!sdk) throw new Error('no sdk');
          // init() rejects when ad-blocked; the game must still run.
          try { await sdk.init(); } catch { /* ads blocked; SDK stubs still work */ }
          try { sdk.setDebug(false); } catch { /* ignore */ }
          this.sdk = sdk;
        })(),
        new Promise<void>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS)),
      ]);
    } catch {
      this.sdk = null;
    }
  }
  loadingFinished(): void { try { this.sdk?.gameLoadingFinished(); } catch { /* ignore */ } }
  gameplayStart(): void { try { this.sdk?.gameplayStart(); } catch { /* ignore */ } }
  gameplayStop(): void { try { this.sdk?.gameplayStop(); } catch { /* ignore */ } }
  happyMoment(): void {}

  async commercialBreak(): Promise<void> {
    if (!this.sdk) return;
    try { await this.sdk.commercialBreak(() => this.onAdStart()); } catch { /* ignore */ }
    this.onAdEnd();
  }
  async rewardedBreak(): Promise<boolean> {
    if (!this.sdk) return false;
    let ok = false;
    try {
      this.onAdStart();
      ok = (await this.sdk.rewardedBreak()) === true;
    } catch { ok = false; }
    this.onAdEnd();
    return ok;
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

export function create(): Platform { return new PokiPlatform(); }
