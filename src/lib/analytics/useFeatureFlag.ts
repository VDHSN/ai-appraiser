/**
 * React hook for PostHog feature flags.
 * Provides type-safe access to feature flags with loading state.
 */

"use client";

import { useSyncExternalStore, useMemo } from "react";
import posthog from "posthog-js";

type FeatureFlagValue = boolean | string | undefined;

interface FeatureFlagState {
  value: FeatureFlagValue;
  isLoading: boolean;
}

// Store for tracking PostHog feature flag loading state
let featureFlagsLoaded = false;
const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): boolean {
  return featureFlagsLoaded;
}

function getServerSnapshot(): boolean {
  return false;
}

// Initialize listener for PostHog feature flags ready event
if (typeof window !== "undefined") {
  posthog.onFeatureFlags(() => {
    featureFlagsLoaded = true;
    listeners.forEach((listener) => listener());
  });
}

/**
 * Compute the flag value from PostHog, converting types as needed.
 */
function computeFlagValue<T extends FeatureFlagValue>(
  flagKey: string,
  defaultValue: T,
  isLoaded: boolean,
): T {
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
