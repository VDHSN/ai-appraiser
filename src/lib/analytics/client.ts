/**
 * Browser-side PostHog analytics implementation.
 */

import posthog from "posthog-js";
import type {
  ClientAnalytics,
  ClientAnalyticsEvents,
  UserProperties,
} from "./types";

class PostHogClientAnalytics implements ClientAnalytics {
  private initialized = false;

  init(apiKey: string, options?: { host?: string }) {
    if (this.initialized) return;
    posthog.init(apiKey, {
      api_host: options?.host,
      persistence: "localStorage+cookie",
      capture_pageview: true,
      capture_pageleave: true,
    });
    this.initialized = true;
  }

  track<E extends keyof ClientAnalyticsEvents>(
    event: E,
    properties: ClientAnalyticsEvents[E],
  ) {
    posthog.capture(event, properties);
  }

  identify(userId: string, properties?: UserProperties) {
    posthog.identify(userId, properties);
  }

  reset() {
    posthog.reset();
  }

  captureException(error: Error, context?: Record<string, unknown>) {
    posthog.captureException(error, context);
  }

  getSessionId() {
    return posthog.get_session_id();
  }

  getDistinctId() {
    return posthog.get_distinct_id();
  }

  pageView(path: string, properties?: Record<string, unknown>) {
    posthog.capture("$pageview", { $current_url: path, ...properties });
  }
}

export const analytics: ClientAnalytics = new PostHogClientAnalytics();
