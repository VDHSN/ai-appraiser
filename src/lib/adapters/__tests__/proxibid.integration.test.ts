/**
 * Integration tests for ProxiBid adapter.
 * These tests hit the real API and verify our adapter correctly maps responses.
 *
 * Run with: pnpm test -- --testNamePattern="integration"
 * Skip in CI by setting: SKIP_INTEGRATION_TESTS=true
 */

import { describe, it, expect, beforeAll } from "vitest";
import { ProxiBidAdapter } from "../proxibid";
import type { SearchResult, UnifiedItem } from "../types";

const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION_TESTS === "true";

// Use a common search term likely to have results
const TEST_SEARCH_TERM = "equipment";
const INTEGRATION_TIMEOUT = 30000;

describe.skipIf(SKIP_INTEGRATION)("ProxiBid Integration", () => {
  let adapter: ProxiBidAdapter;

  beforeAll(() => {
    adapter = new ProxiBidAdapter();
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
      "respects pagination parameters",
      async () => {
        const page1 = await adapter.search({
          keywords: TEST_SEARCH_TERM,
          page: 1,
          pageSize: 5,
        });

        const page2 = await adapter.search({
          keywords: TEST_SEARCH_TERM,
          page: 2,
          pageSize: 5,
        });

        expect(page1.length).toBeLessThanOrEqual(5);
        expect(page2.length).toBeLessThanOrEqual(5);

        // Results should be different between pages
        if (page1.length > 0 && page2.length > 0) {
          expect(page1[0].itemId).not.toBe(page2[0].itemId);
        }
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
      "returns proxied image URLs",
      async () => {
        const results = await adapter.search({
          keywords: TEST_SEARCH_TERM,
          pageSize: 5,
        });

        const withImages = results.filter((r) => r.imageUrl.length > 0);
        if (withImages.length > 0) {
          expect(withImages[0].imageUrl).toContain("/api/image?url=");
          expect(withImages[0].imageUrl).toContain("proxibid.com");
        }
      },
      INTEGRATION_TIMEOUT,
    );
  });

  describe("getPriceHistory", () => {
    it(
      "returns sold items",
      async () => {
        const results = await adapter.getPriceHistory({
          keywords: TEST_SEARCH_TERM,
        });

        expect(results.length).toBeGreaterThan(0);

        const item = results[0];
        assertSearchResultFields(item);

        // Price history should have sold status
        expect(item.status).toBe("sold");
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "includes sold prices",
      async () => {
        const results = await adapter.getPriceHistory({
          keywords: TEST_SEARCH_TERM,
          pageSize: 25,
        });

        // At least some items should have sold prices
        const withSoldPrice = results.filter(
          (r) => r.soldPrice !== undefined && r.soldPrice > 0,
        );
        expect(withSoldPrice.length).toBeGreaterThan(0);

        const soldItem = withSoldPrice[0];
        expect(typeof soldItem.soldPrice).toBe("number");
        expect(soldItem.soldPrice).toBeGreaterThan(0);
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
      "returns full item details",
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
      "includes images array (may be empty if scraping fails)",
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);

        expect(Array.isArray(item.images)).toBe(true);
        // Images might be empty if detail page scraping fails
        // but the array must exist
      },
      INTEGRATION_TIMEOUT,
    );

    it(
      "has correct platform identifier",
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);

        expect(item.platform).toBe("proxibid");
        expect(item.id).toMatch(/^pb-\d+$/);
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

          // URL should be valid ProxiBid URL
          expect(result.url).toContain("proxibid.com");
          expect(result.platform).toBe("proxibid");

          // Optional fields - correct type if present
          if (result.endTime !== undefined) {
            expect(result.endTime).toBeInstanceOf(Date);
          }
          if (result.bidCount !== undefined) {
            expect(typeof result.bidCount).toBe("number");
          }
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

        // Test first item for consistency
        if (searchResults.length > 0) {
          const item = await adapter.getItem(searchResults[0].itemId);

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
          expect(["timed", "live", "buy-now"]).toContain(item.auctionType);

          // Seller is required
          expect(item.seller).toBeDefined();
          expect(typeof item.seller.name).toBe("string");

          // Optional fields - correct type if present
          if (item.estimateRange !== undefined) {
            expect(typeof item.estimateRange.low).toBe("number");
            expect(typeof item.estimateRange.high).toBe("number");
          }
          if (item.endTime !== undefined) {
            expect(item.endTime).toBeInstanceOf(Date);
          }
          if (item.bidCount !== undefined) {
            expect(typeof item.bidCount).toBe("number");
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
  expect(item.platform).toBe("proxibid");
  expect(typeof item.itemId).toBe("string");
  expect(item.itemId.length).toBeGreaterThan(0);

  expect(typeof item.title).toBe("string");
  // Title can be empty but should be a string

  expect(typeof item.currentPrice).toBe("number");
  expect(item.currentPrice).toBeGreaterThanOrEqual(0);

  expect(typeof item.currency).toBe("string");
  expect(item.currency.length).toBeGreaterThan(0);

  expect(typeof item.imageUrl).toBe("string");
  // Image URL should be proxied if not empty
  if (item.imageUrl.length > 0) {
    expect(item.imageUrl).toContain("/api/image?url=");
  }

  expect(typeof item.url).toBe("string");
  expect(item.url).toContain("proxibid.com");
}

function assertUnifiedItemFields(item: UnifiedItem, expectedId: string): void {
  // Identity fields
  expect(item.id).toBe(`pb-${expectedId}`);
  expect(item.platformItemId).toBe(expectedId);
  expect(item.platform).toBe("proxibid");
  expect(item.url).toContain("proxibid.com");

  // Core details
  expect(typeof item.title).toBe("string");
  expect(typeof item.description).toBe("string");
  expect(Array.isArray(item.images)).toBe(true);
  expect(Array.isArray(item.category)).toBe(true);

  // Pricing
  expect(typeof item.currentPrice).toBe("number");
  expect(item.currentPrice).toBeGreaterThanOrEqual(0);
  expect(typeof item.currency).toBe("string");

  // Auction type
  expect(["timed", "live", "buy-now"]).toContain(item.auctionType);

  // Seller
  expect(item.seller).toBeDefined();
  expect(typeof item.seller.name).toBe("string");
  expect(item.seller.name.length).toBeGreaterThan(0);

  // Facets
  expect(item.facets).toBeDefined();
  expect(Array.isArray(item.facets?.categories)).toBe(true);
}
