// Picks the adapter for the current build (VITE_PORTAL).
import type { Platform, PortalId } from './types';
import { createNonePlatform } from './none';
import { createCrazyGamesPlatform } from './crazygames';
import { createPokiPlatform } from './poki';
import { createGDPlatform } from './gd';

export type { Platform, PortalId } from './types';

export function createPlatform(): Platform {
  const portal = (import.meta.env.VITE_PORTAL || 'none').toLowerCase() as PortalId;
  switch (portal) {
    case 'crazygames':
      return createCrazyGamesPlatform();
    case 'poki':
      return createPokiPlatform();
    case 'gd':
      return createGDPlatform();
    case 'none':
    default:
      return createNonePlatform();
  }
}
