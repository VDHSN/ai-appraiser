/**
 * Analytics header utilities for passing identity from client to server.
 * Ensures consistent distinctId across client and server-side events.
 */

// Note: We don't import analytics at module level to avoid SSR issues
// with posthog-js which requires browser environment

/** Header name for passing PostHog distinctId from client to server */
export const POSTHOG_DISTINCT_ID_HEADER = "x-posthog-distinct-id";

/**
 * Get analytics headers to include in API requests.
 * This ensures server-side events are attributed to the same user as client-side.
 * Safe to call during SSR (returns empty object).
 * @returns Headers object with distinctId if available
 */
export function getAnalyticsHeaders(): Record<string, string> {
  // Guard against SSR - window only exists in browser
  if (typeof window === "undefined") {
    return {};
  }

  // Dynamic import to avoid SSR issues with posthog-js
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { analytics } = require("./client") as {
      analytics: { getDistinctId: () => string | undefined };
    };

    const distinctId = analytics.getDistinctId();
    if (distinctId) {
      return { [POSTHOG_DISTINCT_ID_HEADER]: distinctId };
    }
  } catch {
    // PostHog not initialized or error - return empty headers
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
