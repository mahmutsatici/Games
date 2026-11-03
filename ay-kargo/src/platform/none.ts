import type { Platform } from './types';

class NonePlatform implements Platform {
  readonly id = 'none' as const;
  onAdStart: () => void = () => {};
  onAdEnd: () => void = () => {};
  async init(): Promise<void> {}
  loadingFinished(): void {}
  gameplayStart(): void {}
  gameplayStop(): void {}
  async commercialBreak(): Promise<void> {}
  async rewardedBreak(): Promise<boolean> {
    // Testing stand-in for a rewarded video: always grants after a short delay.
    this.onAdStart();
    await new Promise<void>((r) => setTimeout(r, 800));
    this.onAdEnd();
    return true;
  }
  getItem(key: string): string | null {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  setItem(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
  }
  happyMoment(): void {}
  language(): string {
    try { return (navigator.language || 'en').slice(0, 2).toLowerCase(); } catch { return 'en'; }
  }
}

export function create(): Platform { return new NonePlatform(); }
