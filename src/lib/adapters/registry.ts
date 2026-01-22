/**
 * Adapter registry for platform lookup.
 * Provides centralized access to platform adapters.
 */

import { PlatformAdapter } from "./types";
import { LiveAuctioneersAdapter } from "./liveauctioneers";

const adapters: Record<string, PlatformAdapter> = {
  liveauctioneers: new LiveAuctioneersAdapter(),
};

/**
 * Get adapter by platform name.
 * @throws Error if platform not found
 */
export function getAdapter(platform: string): PlatformAdapter {
  const adapter = adapters[platform.toLowerCase()];
  if (!adapter) {
    const available = Object.keys(adapters).join(", ");
    throw new Error(`Unknown platform: ${platform}. Available: ${available}`);
  }
  return adapter;
}

/**
 * List all available platform names.
 */
export function listPlatforms(): string[] {
  return Object.keys(adapters);
}
