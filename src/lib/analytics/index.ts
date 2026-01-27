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

// Mocks for testing
export {
  MockClientAnalytics,
  MockServerAnalytics,
  mockClientAnalytics,
  mockServerAnalytics,
} from "./mock";
