/**
 * Analytics abstraction layer.
 * Re-exports client analytics and types for browser usage.
 * For server analytics, import from "@/lib/analytics/server" directly.
 */

// Types
export type {
  AnalyticsEvents,
  ClientAnalyticsEvents,
  ServerAnalyticsEvents,
  ClientAnalytics,
  ServerAnalytics,
  UserProperties,
  EventSource,
} from "./types";

// Client analytics (browser only)
export { analytics } from "./client";

// Analytics headers for API requests (browser only)
export {
  getAnalyticsHeaders,
  getDistinctIdFromHeaders,
  POSTHOG_DISTINCT_ID_HEADER,
} from "./headers";

// Feature flags (browser only)
export { useFeatureFlag, useFeatureFlagValue } from "./useFeatureFlag";

// Mocks for testing
export {
  MockClientAnalytics,
  MockServerAnalytics,
  mockClientAnalytics,
  mockServerAnalytics,
} from "./mock";
