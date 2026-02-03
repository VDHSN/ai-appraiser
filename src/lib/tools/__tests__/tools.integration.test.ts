/**
 * Integration tests for auction tools.
 * These tests hit real APIs and verify tool calls return results from multiple adapters.
 *
 * Run with: pnpm test -- --testNamePattern="integration"
 * Automatically skipped in CI environments.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockServerAnalytics } from "@/lib/analytics";

// Mock only analytics, use real adapters
vi.mock("@/lib/analytics/server", () => ({
  serverAnalytics: new MockServerAnalytics(),
}));

import { searchItems } from "../index";
import { serverAnalytics } from "@/lib/analytics/server";

const SKIP_INTEGRATION =
  process.env.SKIP_INTEGRATION_TESTS === "true" || process.env.CI === "true";

const TEST_SEARCH_TERM = "antique lamp";
const INTEGRATION_TIMEOUT = 60000;

describe.skipIf(SKIP_INTEGRATION)("Tools Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const mockAnalytics = serverAnalytics as MockServerAnalytics;
    mockAnalytics.clear();
    // Enable both adapter feature flags
    mockAnalytics.setFeatureFlag("anonymous", "adapter-liveauctioneers", true);
    mockAnalytics.setFeatureFlag("anonymous", "adapter-1stdibs", true);
  });

  describe("searchItems", () => {
    it(
      "returns results from both 1stDibs and LiveAuctioneers",
      async () => {
        const results = await searchItems.execute({
          keywords: TEST_SEARCH_TERM,
          pageSize: 10,
        });

        expect(results.length).toBeGreaterThan(0);

        // Count results by platform
        const platforms = results.map((r) => r.platform);
        const has1stDibs = platforms.includes("1stdibs");
        const hasLiveAuctioneers = platforms.includes("liveauctioneers");

        expect(has1stDibs).toBe(true);
        expect(hasLiveAuctioneers).toBe(true);

        // Verify we got results from each platform
        const firstDibsCount = platforms.filter((p) => p === "1stdibs").length;
        const liveAuctioneersCount = platforms.filter(
          (p) => p === "liveauctioneers",
        ).length;

        expect(firstDibsCount).toBeGreaterThan(0);
        expect(liveAuctioneersCount).toBeGreaterThan(0);

        // Verify all results have required fields
        for (const item of results) {
          expect(item.itemId).toBeDefined();
          expect(item.title).toBeDefined();
          expect(item.platform).toMatch(/^(1stdibs|liveauctioneers)$/);
        }
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "respects pageSize parameter",
      async () => {
        const results = await searchItems.execute({
          keywords: TEST_SEARCH_TERM,
          pageSize: 5,
        });

        // Each adapter should return at most pageSize results
        const firstDibsResults = results.filter(
          (r) => r.platform === "1stdibs",
        );
        const liveAuctioneersResults = results.filter(
          (r) => r.platform === "liveauctioneers",
        );

        expect(firstDibsResults.length).toBeLessThanOrEqual(5);
        expect(liveAuctioneersResults.length).toBeLessThanOrEqual(5);
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "can filter to single platform",
      async () => {
        const results = await searchItems.execute({
          keywords: TEST_SEARCH_TERM,
          pageSize: 10,
          platforms: ["1stdibs"],
        });

        expect(results.length).toBeGreaterThan(0);
        expect(results.every((r) => r.platform === "1stdibs")).toBe(true);
      },
      INTEGRATION_TIMEOUT,
    );
  });
});
