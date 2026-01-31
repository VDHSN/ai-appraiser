/**
 * Request-scoped analytics context using AsyncLocalStorage.
 * Allows passing distinctId through the async call chain without
 * threading it through every function parameter.
 */

import { AsyncLocalStorage } from "async_hooks";

interface AnalyticsContext {
  distinctId?: string;
}

/**
 * AsyncLocalStorage instance for request-scoped analytics context.
 * This allows tools and other async code to access the distinctId
 * without it being passed explicitly through the call chain.
 */
export const analyticsContext = new AsyncLocalStorage<AnalyticsContext>();

/**
 * Run a callback within an analytics context.
 * @param distinctId - The PostHog distinctId for the request
 * @param callback - The async function to run within the context
 */
export function runWithAnalyticsContext<T>(
  distinctId: string | undefined,
  callback: () => T,
): T {
  return analyticsContext.run({ distinctId }, callback);
}

/**
 * Get the distinctId from the current analytics context.
 * Returns undefined if not in a context or no distinctId is set.
 */
export function getContextDistinctId(): string | undefined {
  return analyticsContext.getStore()?.distinctId;
}
