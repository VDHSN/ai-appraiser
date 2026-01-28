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
    if (!this.initialized) return;
    posthog.capture(event, properties);
  }

  identify(userId: string, properties?: UserProperties) {
    if (!this.initialized) return;
    posthog.identify(userId, properties);
  }

  reset() {
    if (!this.initialized) return;
    posthog.reset();
  }

  captureException(error: Error, context?: Record<string, unknown>) {
    if (!this.initialized) return;
    posthog.captureException(error, context);
  }

  getSessionId() {
    if (!this.initialized) return undefined;
    return posthog.get_session_id();
  }

  getDistinctId() {
    if (!this.initialized) return undefined;
    return posthog.get_distinct_id();
  }

  pageView(path: string, properties?: Record<string, unknown>) {
    if (!this.initialized) return;
    posthog.capture("$pageview", { $current_url: path, ...properties });
  }
}

export const analytics: ClientAnalytics = new PostHogClientAnalytics();
