/**
 * Adapter registry for platform lookup.
 * Provides centralized access to platform adapters.
 */

import { PlatformAdapter } from "./types";
import { LiveAuctioneersAdapter } from "./liveauctioneers";
import { FirstDibsAdapter } from "./1stdibs";
import { serverLoggerFactory } from "@/lib/logging/server";

const adapters: Record<string, PlatformAdapter> = {
  liveauctioneers: new LiveAuctioneersAdapter(),
  "1stdibs": new FirstDibsAdapter(),
};

const registryLog = serverLoggerFactory.create({
  distinctId: "system",
  component: "adapter:registry",
});

/**
 * Get adapter by platform name.
 * @throws Error if platform not found
 */
export function getAdapter(platform: string): PlatformAdapter {
  const normalizedPlatform = platform.toLowerCase();
  const adapter = adapters[normalizedPlatform];

  if (!adapter) {
    const available = Object.keys(adapters).join(", ");
    registryLog.warn("Unknown platform requested", { platform, available });
    throw new Error(`Unknown platform: ${platform}. Available: ${available}`);
  }

  registryLog.debug("Adapter resolved", { platform: normalizedPlatform });
  return adapter;
}

/**
 * List all available platform names.
 */
export function listPlatforms(): string[] {
  const platforms = Object.keys(adapters);
  registryLog.debug("Listed platforms", { count: platforms.length });
  return platforms;
}
