/**
 * Server-side PostHog analytics implementation.
 * Import separately to avoid bundling Node.js code in client.
 */

import { PostHog } from "posthog-node";
import type { ServerAnalytics, ServerAnalyticsEvents } from "./types";
import { getContextDistinctId } from "./context";

// Re-export context utilities for convenience
export { runWithAnalyticsContext, getContextDistinctId } from "./context";

/** Header name for passing PostHog distinctId from client to server */
export const POSTHOG_DISTINCT_ID_HEADER = "x-posthog-distinct-id";

/** Default distinctId when no user identity is available */
const ANONYMOUS_DISTINCT_ID = "anonymous";

class PostHogServerAnalytics implements ServerAnalytics {
  private client: PostHog;

  constructor(apiKey: string, options?: { host?: string }) {
    this.client = new PostHog(apiKey, {
      host: options?.host,
      flushAt: 1, // Flush immediately for real-time tracking
      flushInterval: 0,
    });
  }

  track<E extends keyof ServerAnalyticsEvents>(
    event: E,
    properties: ServerAnalyticsEvents[E],
    distinctId?: string,
  ) {
    // Use provided distinctId, fall back to context, then to anonymous
    const effectiveDistinctId =
      distinctId || getContextDistinctId() || ANONYMOUS_DISTINCT_ID;
    this.client.capture({
      distinctId: effectiveDistinctId,
      event,
      properties,
    });
  }

  captureException(
    error: Error,
    context?: Record<string, unknown>,
    distinctId?: string,
  ) {
    // Use provided distinctId, fall back to context, then to anonymous
    const effectiveDistinctId =
      distinctId || getContextDistinctId() || ANONYMOUS_DISTINCT_ID;
    this.client.capture({
      distinctId: effectiveDistinctId,
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

export const serverAnalytics: ServerAnalytics = new PostHogServerAnalytics(
  process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
  { host: process.env.NEXT_PUBLIC_POSTHOG_HOST },
);
