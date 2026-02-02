/**
 * Server-side PostHog analytics implementation.
 * Import separately to avoid bundling Node.js code in client.
 */

import { PostHog } from "posthog-node";
import type { ServerAnalytics, ServerAnalyticsEvents } from "./types";

/**
 * Known feature flags used in the application.
 * Add new flags here to enable type-safe access.
 */
export type FeatureFlagKey = "adapter-1stdibs";

class PostHogServerAnalytics implements ServerAnalytics {
  private client: PostHog;
  private featureFlagCache: Map<string, Record<string, boolean | string>> =
    new Map();

  constructor(apiKey: string, options?: { host?: string }) {
    this.client = new PostHog(apiKey, {
      host: options?.host,
      flushAt: 1, // Flush immediately for real-time tracking
      flushInterval: 0,
    });
  }

  /**
   * Check if a feature flag is enabled for a user.
   * Results are cached per-request to minimize API calls.
   */
  async isFeatureEnabled(
    flagKey: FeatureFlagKey,
    distinctId: string,
    defaultValue: boolean = false,
  ): Promise<boolean> {
    try {
      const result = await this.client.isFeatureEnabled(flagKey, distinctId);
      return result ?? defaultValue;
    } catch (error) {
      console.warn(`Feature flag check failed for ${flagKey}:`, error);
      return defaultValue;
    }
  }

  /**
   * Get all feature flags for a user.
   * Results are cached to minimize API calls.
   */
  async getAllFeatureFlags(
    distinctId: string,
  ): Promise<Record<string, boolean | string>> {
    // Check cache first
    const cached = this.featureFlagCache.get(distinctId);
    if (cached) {
      return cached;
    }

    try {
      const flags = await this.client.getAllFlags(distinctId);
      const result = flags ?? {};
      this.featureFlagCache.set(distinctId, result);
      return result;
    } catch (error) {
      console.warn(`Failed to fetch feature flags:`, error);
      return {};
    }
  }

  /**
   * Clear the feature flag cache for a user.
   * Call this when you need fresh flag values.
   */
  clearFlagCache(distinctId?: string): void {
    if (distinctId) {
      this.featureFlagCache.delete(distinctId);
    } else {
      this.featureFlagCache.clear();
    }
  }

  track<E extends keyof ServerAnalyticsEvents>(
    event: E,
    properties: ServerAnalyticsEvents[E],
    distinctId?: string,
  ) {
    // Explicit param takes precedence, then auto-extract from user_id, then fallback
    const resolvedDistinctId =
      distinctId ??
      ("user_id" in properties && typeof properties.user_id === "string"
        ? properties.user_id
        : "anonymous-server");

    // Get cached feature flags for this user to include in event
    const featureFlags = this.featureFlagCache.get(resolvedDistinctId) ?? {};

    this.client.capture({
      distinctId: resolvedDistinctId,
      event,
      properties: {
        ...properties,
        $feature_flags: featureFlags,
      },
    });
  }

  captureException(error: Error, context?: Record<string, unknown>) {
    this.client.capture({
      distinctId: "server",
      event: "$exception",
      properties: {
        $exception_message: error.message,
        $exception_stack: error.stack,
        ...context,
      },
    });
  }

  async shutdown() {
    await this.client.shutdown();
  }
}

export const serverAnalytics: ServerAnalytics & {
  isFeatureEnabled: (
    flagKey: FeatureFlagKey,
    distinctId: string,
    defaultValue?: boolean,
  ) => Promise<boolean>;
  getAllFeatureFlags: (
    distinctId: string,
  ) => Promise<Record<string, boolean | string>>;
  clearFlagCache: (distinctId?: string) => void;
} = new PostHogServerAnalytics(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
  host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
});
