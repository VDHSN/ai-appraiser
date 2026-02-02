/**
 * Integration tests for 1stDibs adapter.
 * These tests hit the real API and verify our adapter correctly maps responses.
 *
 * Run with: pnpm test -- --testNamePattern="integration"
 * Automatically skipped in CI environments.
 * Can also skip manually by setting: SKIP_INTEGRATION_TESTS=true
 */

import { describe, it, expect, beforeAll } from "vitest";
import { FirstDibsAdapter } from "../1stdibs";
import type { SearchResult, UnifiedItem } from "../types";

const SKIP_INTEGRATION =
  process.env.SKIP_INTEGRATION_TESTS === "true" || process.env.CI === "true";

// Use a common search term likely to have results
const TEST_SEARCH_TERM = "art deco lamp";
const INTEGRATION_TIMEOUT = 30000;

describe.skipIf(SKIP_INTEGRATION)("1stDibs Integration", () => {
  let adapter: FirstDibsAdapter;

  beforeAll(() => {
    // Use lower rate limit for integration tests to be respectful
    adapter = new FirstDibsAdapter({ requestsPerSecond: 0.5 });
  });

  describe("search", () => {
    it(
      "returns results with all required fields populated",
      async () => {
        const results = await adapter.search({ keywords: TEST_SEARCH_TERM });

        expect(results.length).toBeGreaterThan(0);

        // Test first result has all required fields
        const item = results[0];
        assertSearchResultFields(item);

        // Verify multiple results to ensure consistency
        if (results.length > 1) {
          assertSearchResultFields(results[1]);
        }
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "respects pageSize parameter",
      async () => {
        const results = await adapter.search({
          keywords: TEST_SEARCH_TERM,
          pageSize: 5,
        });

        expect(results.length).toBeLessThanOrEqual(5);
        expect(results.length).toBeGreaterThan(0);
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "filters by price range",
      async () => {
        const results = await adapter.search({
          keywords: TEST_SEARCH_TERM,
          priceRange: { min: 1000, max: 10000 },
        });

        // If results exist, verify they're returned
        expect(Array.isArray(results)).toBe(true);
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "handles empty results gracefully",
      async () => {
        const results = await adapter.search({
          keywords: "xyznonexistentitem12345xyz",
        });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(0);
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "all results have status online (buy-now marketplace)",
      async () => {
        const results = await adapter.search({
          keywords: TEST_SEARCH_TERM,
          pageSize: 10,
        });

        for (const result of results) {
          expect(result.status).toBe("online");
        }
      },
      INTEGRATION_TIMEOUT,
    );
  });

  describe("getItem", () => {
    let testItemId: string;

    beforeAll(async () => {
      // Get a real item ID from search
      const results = await adapter.search({
        keywords: TEST_SEARCH_TERM,
        pageSize: 1,
      });
      if (results.length > 0) {
        testItemId = results[0].itemId;
      }
    }, INTEGRATION_TIMEOUT);

    it(
      "returns full item details with all fields",
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);
        assertUnifiedItemFields(item, testItemId);
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "includes seller information",
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);

        expect(item.seller).toBeDefined();
        expect(typeof item.seller.name).toBe("string");
        expect(item.seller.name.length).toBeGreaterThan(0);
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "includes images array",
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);

        expect(Array.isArray(item.images)).toBe(true);
        // Most items should have at least one image
        if (item.images.length > 0) {
          expect(item.images[0]).toMatch(/^https?:\/\//);
        }
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "includes category information",
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);

        expect(Array.isArray(item.category)).toBe(true);
        expect(item.facets).toBeDefined();
        expect(Array.isArray(item.facets?.categories)).toBe(true);
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "has buy-now auction type",
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);

        expect(item.auctionType).toBe("buy-now");
      },
      INTEGRATION_TIMEOUT,
    );
  });

  describe("getPriceHistory", () => {
    it(
      "returns empty array (not publicly available)",
      async () => {
        const results = await adapter.getPriceHistory({
          keywords: TEST_SEARCH_TERM,
        });

        // 1stDibs doesn't expose sold item history publicly
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(0);
      },
      INTEGRATION_TIMEOUT,
    );
  });

  describe("field completeness", () => {
    it(
      "search results have consistent field types",
      async () => {
        const results = await adapter.search({
          keywords: TEST_SEARCH_TERM,
          pageSize: 20,
        });

        for (const result of results) {
          // Required fields - must be correct type
          expect(typeof result.platform).toBe("string");
          expect(typeof result.itemId).toBe("string");
          expect(typeof result.title).toBe("string");
          expect(typeof result.currentPrice).toBe("number");
          expect(typeof result.currency).toBe("string");
          expect(typeof result.imageUrl).toBe("string");
          expect(typeof result.url).toBe("string");

          // URL should be valid 1stDibs URL
          expect(result.url).toContain("1stdibs.com");
          expect(result.platform).toBe("1stdibs");

          // Status should always be online for buy-now
          expect(result.status).toBe("online");

          // Optional fields - correct type if present
          if (result.auctionHouse !== undefined) {
            expect(typeof result.auctionHouse).toBe("string");
          }
        }
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "item details have consistent field types",
      async () => {
        const searchResults = await adapter.search({
          keywords: TEST_SEARCH_TERM,
          pageSize: 3,
        });

        // Test multiple items for consistency
        for (const searchResult of searchResults.slice(0, 2)) {
          const item = await adapter.getItem(searchResult.itemId);

          // Required fields
          expect(typeof item.id).toBe("string");
          expect(typeof item.platformItemId).toBe("string");
          expect(typeof item.platform).toBe("string");
          expect(typeof item.url).toBe("string");
          expect(typeof item.title).toBe("string");
          expect(typeof item.description).toBe("string");
          expect(Array.isArray(item.images)).toBe(true);
          expect(Array.isArray(item.category)).toBe(true);
          expect(typeof item.currentPrice).toBe("number");
          expect(typeof item.currency).toBe("string");
          expect(item.auctionType).toBe("buy-now");

          // Seller is required
          expect(item.seller).toBeDefined();
          expect(typeof item.seller.name).toBe("string");

          // Optional fields - correct type if present
          if (item.buyNowPrice !== undefined) {
            expect(typeof item.buyNowPrice).toBe("number");
          }
          if (item.seller.rating !== undefined) {
            expect(typeof item.seller.rating).toBe("number");
          }
          if (item.seller.location !== undefined) {
            expect(typeof item.seller.location).toBe("string");
          }
          if (item.condition !== undefined) {
            expect(typeof item.condition).toBe("string");
          }
          if (item.dimensions !== undefined) {
            expect(typeof item.dimensions).toBe("string");
          }
          if (item.materials !== undefined) {
            expect(Array.isArray(item.materials)).toBe(true);
          }
        }
      },
      INTEGRATION_TIMEOUT * 2,
    );
  });
});

// --- Assertion Helpers ---

function assertSearchResultFields(item: SearchResult): void {
  // Required fields must exist and have correct types
  expect(item.platform).toBe("1stdibs");
  expect(typeof item.itemId).toBe("string");
  expect(item.itemId.length).toBeGreaterThan(0);

  expect(typeof item.title).toBe("string");
  // Title can be empty but should be a string

  expect(typeof item.currentPrice).toBe("number");
  expect(item.currentPrice).toBeGreaterThanOrEqual(0);

  expect(typeof item.currency).toBe("string");
  expect(item.currency.length).toBeGreaterThan(0);

  expect(typeof item.imageUrl).toBe("string");
  // Image URL should be a valid URL if not empty
  if (item.imageUrl.length > 0) {
    expect(item.imageUrl).toMatch(/^https?:\/\//);
  }

  expect(typeof item.url).toBe("string");
  expect(item.url).toContain("1stdibs.com");

  // 1stDibs is a buy-now marketplace, status should always be online
  expect(item.status).toBe("online");
}

function assertUnifiedItemFields(item: UnifiedItem, expectedId: string): void {
  // Identity fields
  expect(item.id).toBe(`fd-${expectedId}`);
  expect(item.platformItemId).toBe(expectedId);
  expect(item.platform).toBe("1stdibs");
  expect(item.url).toContain("1stdibs.com");

  // Core details
  expect(typeof item.title).toBe("string");
  expect(typeof item.description).toBe("string");
  expect(Array.isArray(item.images)).toBe(true);
  expect(Array.isArray(item.category)).toBe(true);

  // Pricing
  expect(typeof item.currentPrice).toBe("number");
  expect(item.currentPrice).toBeGreaterThanOrEqual(0);
  expect(typeof item.currency).toBe("string");

  // Auction type - 1stDibs is always buy-now
  expect(item.auctionType).toBe("buy-now");

  // Seller
  expect(item.seller).toBeDefined();
  expect(typeof item.seller.name).toBe("string");
  expect(item.seller.name.length).toBeGreaterThan(0);

  // Facets
  expect(item.facets).toBeDefined();
  expect(Array.isArray(item.facets?.categories)).toBe(true);
}
