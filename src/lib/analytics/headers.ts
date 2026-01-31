/**
 * Analytics header utilities for passing identity from client to server.
 * Ensures consistent distinctId across client and server-side events.
 */

import { analytics } from "./client";

/** Header name for passing PostHog distinctId from client to server */
export const POSTHOG_DISTINCT_ID_HEADER = "x-posthog-distinct-id";

/**
 * Get analytics headers to include in API requests.
 * This ensures server-side events are attributed to the same user as client-side.
 * @returns Headers object with distinctId if available
 */
export function getAnalyticsHeaders(): Record<string, string> {
  const distinctId = analytics.getDistinctId();
  if (distinctId) {
    return { [POSTHOG_DISTINCT_ID_HEADER]: distinctId };
  }
  return {};
}

/**
 * Extract distinctId from request headers.
 * For use in server-side API routes.
 * @param headers - Request headers or Headers object
 * @returns distinctId if present, undefined otherwise
 */
export function getDistinctIdFromHeaders(
  headers: Headers | { get: (name: string) => string | null },
): string | undefined {
  const distinctId = headers.get(POSTHOG_DISTINCT_ID_HEADER);
  return distinctId || undefined;
}
