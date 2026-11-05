import type { Platform } from './types';

// Playgama Bridge SDK. API from memory of the Bridge docs (unverified against the live docs, see DECISIONS.md):
// bridge.initialize() → Promise; bridge.platform.language; bridge.platform.sendMessage('game_ready' | 'gameplay_started' | 'gameplay_stopped');
// bridge.advertisement.showInterstitial() / showRewarded(); state events via bridge.advertisement.on(EVENT_NAME, cb);
// bridge.storage.get(key) / set(key, value) → Promises. Every call is guarded: the game must run without the SDK.
const SDK_URL = 'https://bridge.playgama.com/v1/stable/playgama-bridge.js';
const TIMEOUT_MS = 6000, SAVE_KEY = 'toyfort.save.v1';

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => { const s = document.createElement('script'); s.src = src; s.async = true; s.onload = () => resolve(); s.onerror = () => reject(new Error('load failed')); document.head.appendChild(s); });
}

class PlaygamaPlatform implements Platform {
  readonly id = 'playgama' as const;
  onAdStart: () => void = () => {};
  onAdEnd: () => void = () => {};
  private b: any = null;
  /** Bridge storage is async: load once at init into memory, write through */
  private mem = new Map<string, string>();

  async init(): Promise<void> {
    try {
      await Promise.race([(async () => {
        await loadScript(SDK_URL); const b = (window as any).bridge; if (!b) throw new Error('no sdk');
        await b.initialize(); this.b = b;
        try { const v = await b.storage.get(SAVE_KEY); if (typeof v === 'string') this.mem.set(SAVE_KEY, v); } catch { /* ignore */ }
      })(), new Promise<void>((_, rej) => setTimeout(() => rej(new Error('timeout')), TIMEOUT_MS))]);
    } catch { this.b = null; }
  }
  private msg(m: string) { try { this.b?.platform?.sendMessage(m); } catch { /* ignore */ } }
  loadingFinished(): void { this.msg('game_ready'); }
  gameplayStart(): void { this.msg('gameplay_started'); }
  gameplayStop(): void { this.msg('gameplay_stopped'); }
  happyMoment(): void {}
  /** wait for an ad's terminal state ('closed' / 'failed' / for rewarded also 'rewarded') */
  private adFlow(kind: 'interstitial' | 'rewarded'): Promise<boolean> {
    const b = this.b; if (!b) return Promise.resolve(false);
    return new Promise(resolve => {
      let rewarded = false, done = false;
      const ev = kind === 'rewarded' ? b.EVENT_NAME?.REWARDED_STATE_CHANGED : b.EVENT_NAME?.INTERSTITIAL_STATE_CHANGED;
      const finish = () => { if (done) return; done = true; try { b.advertisement.off?.(ev, on); } catch { /* ignore */ } this.onAdEnd(); resolve(rewarded); };
      const on = (state: string) => { if (state === 'opened') this.onAdStart(); else if (state === 'rewarded') rewarded = true; else if (state === 'closed' || state === 'failed') finish(); };
      try { b.advertisement.on(ev, on); kind === 'rewarded' ? b.advertisement.showRewarded() : b.advertisement.showInterstitial(); } catch { finish(); }
      setTimeout(finish, 60000);
    });
  }
  async commercialBreak(): Promise<void> { await this.adFlow('interstitial'); }
  async rewardedBreak(): Promise<boolean> { return this.adFlow('rewarded'); }
  getItem(key: string): string | null {
    if (this.mem.has(key)) return this.mem.get(key)!;
    try { return localStorage.getItem(key); } catch { return null; }
  }
  setItem(key: string, value: string): void {
    this.mem.set(key, value);
    try { this.b?.storage?.set(key, value); } catch { /* ignore */ }
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
  language(): string { try { return String(this.b?.platform?.language || navigator.language || 'en').slice(0, 2).toLowerCase(); } catch { return 'en'; } }
}
export function create(): Platform { return new PlaygamaPlatform(); }
