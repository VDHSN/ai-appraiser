/**
 * Server-side PostHog analytics implementation.
 * Import separately to avoid bundling Node.js code in client.
 */

import { PostHog } from "posthog-node";
import type { ServerAnalytics, ServerAnalyticsEvents } from "./types";

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
  ) {
    // Extract user_id if present for proper user attribution
    const distinctId =
      "user_id" in properties && typeof properties.user_id === "string"
        ? properties.user_id
        : "server";

    this.client.capture({
      distinctId,
      event,
      properties,
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

export const serverAnalytics: ServerAnalytics = new PostHogServerAnalytics(
  process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "",
  { host: process.env.NEXT_PUBLIC_POSTHOG_HOST },
);
