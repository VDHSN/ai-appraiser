/**
 * React hook for PostHog feature flags.
 * Provides type-safe access to feature flags with loading state.
 */

"use client";

import { useSyncExternalStore, useMemo, useEffect } from "react";
import posthog from "posthog-js";

type FeatureFlagValue = boolean | string | undefined;

interface FeatureFlagState {
  value: FeatureFlagValue;
  isLoading: boolean;
}

// Store for tracking PostHog feature flag loading state
let featureFlagsLoaded = false;
let listenerInitialized = false;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function initializeListener(): void {
  if (listenerInitialized || typeof window === "undefined") return;
  listenerInitialized = true;

  // Check if flags are already loaded (PostHog was initialized before this module)
  try {
    // PostHog stores feature flags in its internal state
    // If getFeatureFlag returns a non-undefined value for a known flag,
    // or if we can detect PostHog is ready, flags are loaded
    const flags = posthog.featureFlags?.getFlagVariants?.();
    if (flags && Object.keys(flags).length > 0) {
      featureFlagsLoaded = true;
    }
  } catch {
    // PostHog not ready yet, will wait for callback
  }

  // Set up listener for future flag loads
  posthog.onFeatureFlags(() => {
    featureFlagsLoaded = true;
    notifyListeners();
  });
}

function subscribe(callback: () => void): () => void {
  // Initialize listener on first subscription
  initializeListener();

  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): boolean {
  return featureFlagsLoaded;
}

function getServerSnapshot(): boolean {
  return false;
}

/**
 * Check for URL parameter override (for development/testing).
 * Supports: ?flag_<flagKey>=true|false|<value>
 */
function getUrlOverride<T extends FeatureFlagValue>(
  flagKey: string,
  defaultValue: T,
): T | null {
  if (typeof window === "undefined") return null;

  const params = new URLSearchParams(window.location.search);
  const paramKey = `flag_${flagKey.replace(/-/g, "_")}`;
  const override = params.get(paramKey);

  if (override === null) return null;

  if (typeof defaultValue === "boolean") {
    return (override === "true" || override === "1") as T;
  }

  return override as T;
}

/**
 * Compute the flag value from PostHog, converting types as needed.
 * Also checks for URL parameter overrides for development/testing.
 */
function computeFlagValue<T extends FeatureFlagValue>(
  flagKey: string,
  defaultValue: T,
  isLoaded: boolean,
): T {
  // Check URL override first (for development/testing)
  const urlOverride = getUrlOverride(flagKey, defaultValue);
  if (urlOverride !== null) {
    return urlOverride;
  }

  if (!isLoaded) {
    return defaultValue;
  }

  const value = posthog.getFeatureFlag(flagKey);

  if (value === undefined) {
    return defaultValue;
  }

  if (typeof defaultValue === "boolean") {
    return (value === true || value === "true") as T;
  }

  return value as T;
}

/**
 * Hook to access a PostHog feature flag with loading state.
 *
 * @param flagKey - The feature flag key to check
 * @param defaultValue - Default value while loading or if flag is undefined
 * @returns Object with value and isLoading state
 */
export function useFeatureFlag<T extends FeatureFlagValue>(
  flagKey: string,
  defaultValue: T,
): FeatureFlagState & { value: T } {
  const isLoaded = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Re-check if flags became available (handles race conditions)
  useEffect(() => {
    if (!featureFlagsLoaded) {
      const checkFlags = (): void => {
        try {
          const flags = posthog.featureFlags?.getFlagVariants?.();
          if (flags && Object.keys(flags).length > 0) {
            featureFlagsLoaded = true;
            notifyListeners();
          }
        } catch {
          // PostHog not ready
        }
      };

      // Check immediately and after a short delay
      checkFlags();
      const timeout = setTimeout(checkFlags, 100);
      return () => clearTimeout(timeout);
    }
  }, []);

  // Compute value during render instead of in an effect
  const flagValue = useMemo(
    () => computeFlagValue(flagKey, defaultValue, isLoaded),
    [flagKey, defaultValue, isLoaded],
  );

  return {
    value: flagValue,
    isLoading: !isLoaded,
  };
}

/**
 * Simple hook that returns just the feature flag value.
 * Use this when you don't need loading state.
 *
 * @param flagKey - The feature flag key to check
 * @param defaultValue - Default value while loading or if flag is undefined
 * @returns The feature flag value
 */
export function useFeatureFlagValue<T extends FeatureFlagValue>(
  flagKey: string,
  defaultValue: T,
): T {
  const { value } = useFeatureFlag(flagKey, defaultValue);
  return value;
}
