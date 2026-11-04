import type { Platform } from './types';

export async function createPlatform(): Promise<Platform> {
  try {
    switch (import.meta.env.VITE_PORTAL) {
      case 'crazygames': return (await import('./crazygames')).create();
      case 'poki': return (await import('./poki')).create();
      case 'gd': return (await import('./gd')).create();
    }
  } catch { /* fall through to none */ }
  return (await import('./none')).create();
}
