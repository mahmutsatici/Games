// Platform abstraction shared by the game and every portal adapter.
// The game ONLY talks to this interface. Adapters live in src/platform/*.ts.

export type PortalId = 'crazygames' | 'poki' | 'gd' | 'none';

export interface Platform {
  readonly id: PortalId;
  /** Load SDK, resolve when ready (never reject: fall back to no-ads mode). */
  init(): Promise<void>;
  /** Call once when first frame is interactive (loading finished). */
  loadingFinished(): void;
  /** Player is actively playing (driving). */
  gameplayStart(): void;
  /** Player stopped playing (menu, pause, result screen). */
  gameplayStop(): void;
  /**
   * Interstitial opportunity. Call ONLY when going from a menu/result screen back into gameplay.
   * Portal decides frequency. Resolves when ad finished or skipped. Game must be muted meanwhile:
   * adapter calls onAdStart/onAdEnd hooks.
   */
  commercialBreak(): Promise<void>;
  /** Rewarded video. Resolves true only if reward should be granted. */
  rewardedBreak(): Promise<boolean>;
  /** Persistent key/value storage (string values). Must never throw. */
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  /** Hooks set by the game to mute audio / pause input during ads. */
  onAdStart: () => void;
  onAdEnd: () => void;
  /** Optional 'happy moment' (CrazyGames happytime, Poki no-op). */
  happyMoment(): void;
  /** Two-letter language code preferred by portal or browser (e.g. 'en','tr'). */
  language(): string;
}
