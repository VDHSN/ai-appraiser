import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";

// Mock PostHog - use vi.hoisted to ensure mocks are available during module initialization
const { mockGetFeatureFlag, mockOnFeatureFlags } = vi.hoisted(() => ({
  mockGetFeatureFlag: vi.fn(),
  mockOnFeatureFlags: vi.fn(),
}));

vi.mock("posthog-js", () => ({
  default: {
    getFeatureFlag: (...args: unknown[]) => mockGetFeatureFlag(...args),
    onFeatureFlags: (callback: () => void) => mockOnFeatureFlags(callback),
  },
}));

// Import after mock setup
import { useFeatureFlag, useFeatureFlagValue } from "../useFeatureFlag";

describe("useFeatureFlag", () => {
  it("returns default value when flags are not loaded", () => {
    const { result } = renderHook(() => useFeatureFlag("test-flag", false));

    expect(result.current.value).toBe(false);
    expect(result.current.isLoading).toBe(true);
  });

  it("returns default string value when flags are not loaded", () => {
    const { result } = renderHook(() => useFeatureFlag("test-flag", "default"));

    expect(result.current.value).toBe("default");
    expect(result.current.isLoading).toBe(true);
  });

  it("exports useFeatureFlagValue that returns just the value", () => {
    const { result } = renderHook(() =>
      useFeatureFlagValue("test-flag", false),
    );

    expect(result.current).toBe(false);
  });

  it("exports useFeatureFlagValue with string default", () => {
    const { result } = renderHook(() =>
      useFeatureFlagValue("test-flag", "control"),
    );

    expect(result.current).toBe("control");
  });
});
