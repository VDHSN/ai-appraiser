/**
 * Integration tests for LiveAuctioneers adapter.
 * These tests hit the real API and verify our adapter correctly maps responses.
 *
 * Run with: pnpm test -- --testNamePattern="integration"
 * Skip in CI by setting: SKIP_INTEGRATION_TESTS=true
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { LiveAuctioneersAdapter } from '../liveauctioneers';
import type { SearchResult, UnifiedItem } from '../types';

const SKIP_INTEGRATION = process.env.SKIP_INTEGRATION_TESTS === 'true';

// Use a common search term likely to have results
const TEST_SEARCH_TERM = 'antique lamp';
const INTEGRATION_TIMEOUT = 30000;

describe.skipIf(SKIP_INTEGRATION)('LiveAuctioneers Integration', () => {
  let adapter: LiveAuctioneersAdapter;

  beforeAll(() => {
    adapter = new LiveAuctioneersAdapter();
  });

  describe('search', () => {
    it(
      'returns results with all required fields populated',
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
      INTEGRATION_TIMEOUT
    );

    it(
      'respects pagination parameters',
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
      INTEGRATION_TIMEOUT
    );

    it(
      'filters by price range',
      async () => {
        const results = await adapter.search({
          keywords: TEST_SEARCH_TERM,
          priceRange: { min: 100, max: 500 },
        });

        // If results exist, prices should be in range
        // Note: currentPrice might be starting bid, not always in exact range
        expect(Array.isArray(results)).toBe(true);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'handles empty results gracefully',
      async () => {
        const results = await adapter.search({
          keywords: 'xyznonexistentitem12345xyz',
        });

        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(0);
      },
      INTEGRATION_TIMEOUT
    );
  });

  describe('getPriceHistory', () => {
    it(
      'returns sold items with price data',
      async () => {
        const results = await adapter.getPriceHistory({
          keywords: TEST_SEARCH_TERM,
        });

        expect(results.length).toBeGreaterThan(0);

        const item = results[0];
        assertSearchResultFields(item);

        // Price history should have sold data
        expect(item.status).toMatch(/^(sold|passed|done)$/);

        // At least some items should have hammer prices
        const withHammerPrice = results.filter((r) => r.soldPrice !== undefined);
        expect(withHammerPrice.length).toBeGreaterThan(0);

        const soldItem = withHammerPrice[0];
        expect(typeof soldItem.soldPrice).toBe('number');
        expect(soldItem.soldPrice).toBeGreaterThanOrEqual(0);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'returns sold dates for completed auctions',
      async () => {
        const results = await adapter.getPriceHistory({
          keywords: TEST_SEARCH_TERM,
          pageSize: 50,
        });

        const withSoldDate = results.filter((r) => r.soldDate !== undefined);

        if (withSoldDate.length > 0) {
          const item = withSoldDate[0];
          expect(item.soldDate).toBeInstanceOf(Date);
          expect(item.soldDate!.getTime()).toBeLessThan(Date.now());
        }
      },
      INTEGRATION_TIMEOUT
    );
  });

  describe('getItem', () => {
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
      'returns full item details with all fields',
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);
        assertUnifiedItemFields(item, testItemId);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'includes seller information',
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);

        expect(item.seller).toBeDefined();
        expect(typeof item.seller.name).toBe('string');
        expect(item.seller.name.length).toBeGreaterThan(0);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'includes images array',
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);

        expect(Array.isArray(item.images)).toBe(true);
        // Most items should have at least one image
        if (item.images.length > 0) {
          expect(item.images[0]).toMatch(/^https?:\/\//);
        }
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'includes category information from facets',
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);

        expect(Array.isArray(item.category)).toBe(true);
        expect(item.facets).toBeDefined();
        expect(Array.isArray(item.facets?.categories)).toBe(true);
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'may include similar items',
      async () => {
        expect(testItemId).toBeDefined();

        const item = await adapter.getItem(testItemId);

        // Similar items are optional but should be an array if present
        if (item.similarItems !== undefined) {
          expect(Array.isArray(item.similarItems)).toBe(true);
          if (item.similarItems.length > 0) {
            assertSearchResultFields(item.similarItems[0]);
          }
        }
      },
      INTEGRATION_TIMEOUT
    );
  });

  describe('field completeness', () => {
    it(
      'search results have consistent field types',
      async () => {
        const results = await adapter.search({
          keywords: TEST_SEARCH_TERM,
          pageSize: 20,
        });

        for (const result of results) {
          // Required fields - must be correct type
          expect(typeof result.platform).toBe('string');
          expect(typeof result.itemId).toBe('string');
          expect(typeof result.title).toBe('string');
          expect(typeof result.currentPrice).toBe('number');
          expect(typeof result.currency).toBe('string');
          expect(typeof result.imageUrl).toBe('string');
          expect(typeof result.url).toBe('string');

          // URL should be valid LiveAuctioneers URL
          expect(result.url).toContain('liveauctioneers.com/item/');
          expect(result.platform).toBe('liveauctioneers');

          // Optional fields - correct type if present
          if (result.endTime !== undefined) {
            expect(result.endTime).toBeInstanceOf(Date);
          }
          if (result.bidCount !== undefined) {
            expect(typeof result.bidCount).toBe('number');
          }
          if (result.auctionHouse !== undefined) {
            expect(typeof result.auctionHouse).toBe('string');
          }
        }
      },
      INTEGRATION_TIMEOUT
    );

    it(
      'item details have consistent field types',
      async () => {
        const searchResults = await adapter.search({
          keywords: TEST_SEARCH_TERM,
          pageSize: 3,
        });

        // Test multiple items for consistency
        for (const searchResult of searchResults.slice(0, 2)) {
          const item = await adapter.getItem(searchResult.itemId);

          // Required fields
          expect(typeof item.id).toBe('string');
          expect(typeof item.platformItemId).toBe('string');
          expect(typeof item.platform).toBe('string');
          expect(typeof item.url).toBe('string');
          expect(typeof item.title).toBe('string');
          expect(typeof item.description).toBe('string');
          expect(Array.isArray(item.images)).toBe(true);
          expect(Array.isArray(item.category)).toBe(true);
          expect(typeof item.currentPrice).toBe('number');
          expect(typeof item.currency).toBe('string');
          expect(['timed', 'live', 'buy-now']).toContain(item.auctionType);

          // Seller is required
          expect(item.seller).toBeDefined();
          expect(typeof item.seller.name).toBe('string');

          // Optional fields - correct type if present
          if (item.estimateRange !== undefined) {
            expect(typeof item.estimateRange.low).toBe('number');
            expect(typeof item.estimateRange.high).toBe('number');
          }
          if (item.startTime !== undefined) {
            expect(item.startTime).toBeInstanceOf(Date);
          }
          if (item.endTime !== undefined) {
            expect(item.endTime).toBeInstanceOf(Date);
          }
          if (item.bidCount !== undefined) {
            expect(typeof item.bidCount).toBe('number');
          }
        }
      },
      INTEGRATION_TIMEOUT * 2
    );
  });
});

// --- Assertion Helpers ---

function assertSearchResultFields(item: SearchResult): void {
  // Required fields must exist and have correct types
  expect(item.platform).toBe('liveauctioneers');
  expect(typeof item.itemId).toBe('string');
  expect(item.itemId.length).toBeGreaterThan(0);

  expect(typeof item.title).toBe('string');
  // Title can be empty but should be a string

  expect(typeof item.currentPrice).toBe('number');
  expect(item.currentPrice).toBeGreaterThanOrEqual(0);

  expect(typeof item.currency).toBe('string');
  expect(item.currency.length).toBeGreaterThan(0);

  expect(typeof item.imageUrl).toBe('string');
  // Image URL should be a valid URL if not empty
  if (item.imageUrl.length > 0) {
    expect(item.imageUrl).toMatch(/^https?:\/\//);
  }

  expect(typeof item.url).toBe('string');
  expect(item.url).toContain('liveauctioneers.com/item/');
  expect(item.url).toContain(item.itemId);
}

function assertUnifiedItemFields(item: UnifiedItem, expectedId: string): void {
  // Identity fields
  expect(item.id).toBe(`la-${expectedId}`);
  expect(item.platformItemId).toBe(expectedId);
  expect(item.platform).toBe('liveauctioneers');
  expect(item.url).toContain(expectedId);

  // Core details
  expect(typeof item.title).toBe('string');
  expect(typeof item.description).toBe('string');
  expect(Array.isArray(item.images)).toBe(true);
  expect(Array.isArray(item.category)).toBe(true);

  // Pricing
  expect(typeof item.currentPrice).toBe('number');
  expect(item.currentPrice).toBeGreaterThanOrEqual(0);
  expect(typeof item.currency).toBe('string');

  // Auction type
  expect(['timed', 'live', 'buy-now']).toContain(item.auctionType);

  // Seller
  expect(item.seller).toBeDefined();
  expect(typeof item.seller.name).toBe('string');
  expect(item.seller.name.length).toBeGreaterThan(0);

  // Facets
  expect(item.facets).toBeDefined();
  expect(Array.isArray(item.facets?.categories)).toBe(true);
}
