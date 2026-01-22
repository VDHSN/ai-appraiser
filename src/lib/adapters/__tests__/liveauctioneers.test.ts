import { describe, it, expect, vi } from "vitest";
import {
  LiveAuctioneersAdapter,
  buildSearchParams,
  buildSearchUrl,
  mapSearchItem,
  buildUnifiedItem,
  inferAuctionType,
  ACTIVE_AUCTION_STATUS,
  SOLD_ITEM_STATUS,
  LASearchItem,
} from "../liveauctioneers";

// --- Test Fixtures ---

const createMockFetch = (
  responses: Array<{ ok: boolean; status?: number; data?: unknown }>,
) => {
  let callIndex = 0;
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const response = responses[callIndex++] ?? responses[responses.length - 1];
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.data,
    } as Response;
  });
};

const mockSearchItem: LASearchItem = {
  itemId: 12345,
  title: "Art Deco Table Lamp",
  leadingBid: 150,
  startPrice: 100,
  currency: "USD",
  photos: [1, 2, 3],
  imageVersion: 1234567890,
  saleStartTs: 1738400400, // 2025-02-01T10:00:00Z
  bidCount: 5,
  sellerName: "Heritage Auctions",
  sellerId: 123,
  catalogId: 456789,
  catalogStatus: "online",
};

const mockSoldItem: LASearchItem = {
  itemId: 99999,
  title: "Vintage Art Deco Lamp",
  leadingBid: 200,
  startPrice: 100,
  currency: "USD",
  photos: [1],
  saleStartTs: 1718452800,
  saleEndEstimatedTs: 1718456400, // 2024-06-15T14:00:00Z
  salePrice: 225,
  sellerName: "Sothebys",
  sellerId: 456,
  catalogId: 789012,
  catalogStatus: "done",
  isSold: true,
};

const mockItemDetail = {
  lotId: 12345,
  title: "Art Deco Table Lamp",
  description: "Beautiful 1920s Art Deco lamp with chrome base",
  images: [{ url: "https://example.com/lamp-full.jpg" }],
  currentBid: 150,
  currency: "USD",
  estimateLow: 100,
  estimateHigh: 300,
  saleStart: "2025-02-01T10:00:00Z",
  saleEnd: "2025-02-01T12:00:00Z",
  bidCount: 5,
  lotNumber: "A-123",
  auctionHouse: {
    id: 1001,
    name: "Heritage Auctions",
    rating: 4.8,
    location: "Dallas, TX",
  },
  condition: "Good",
  conditionReport: "Minor wear consistent with age",
  provenance: "Estate of John Smith",
  dimensions: '18" H x 10" W',
  materials: ["Chrome", "Glass"],
  status: "online",
};

const mockItemFacets = {
  categories: [
    { id: "101", name: "Lighting" },
    { id: "102", name: "Art Deco" },
  ],
  periods: ["1920-1930"],
};

const mockContentItems = {
  error: false,
  payload: {
    items: [
      {
        itemId: 12345,
        catalogId: 456789,
        sellerId: 123,
        sellerName: "Heritage Auctions",
        sellerCity: "Dallas",
        sellerStateCode: "TX",
        currency: "USD",
        leadingBid: 150,
        bidCount: 5,
        lowBidEstimate: 100,
        highBidEstimate: 300,
        photos: [1, 2, 3],
        imageVersion: 1234567890,
        catalogStatus: "online",
        lotNumber: "A-123",
        similarItems: [
          {
            itemId: 54321,
            title: "Similar Art Deco Lamp",
            leadingBid: 175,
            startPrice: 100,
            currency: "USD",
            photos: [1],
            sellerName: "Test Auction",
            sellerId: 789,
            catalogId: 111222,
            catalogStatus: "online",
            saleStartTs: 1738400400,
          } as LASearchItem,
        ],
      },
    ],
  },
};

// --- Pure Function Tests ---

describe("buildSearchParams", () => {
  it("builds params with minimal query", () => {
    const params = buildSearchParams({ keywords: "lamp" }, ["upcoming"]);

    expect(params.searchTerm).toBe("lamp");
    expect(params.page).toBe(1);
    expect(params.pageSize).toBe(24);
    expect(params.options.status).toEqual(["upcoming"]);
    expect(params.categories).toEqual([]);
    expect(params.ranges).toEqual({});
  });

  it("builds params with all query options", () => {
    const params = buildSearchParams(
      {
        keywords: "art deco",
        page: 3,
        pageSize: 50,
        category: "furniture",
        priceRange: { min: 100, max: 500 },
        location: "new-york",
        sort: "price-desc",
      },
      ["sold", "passed"],
    );

    expect(params.searchTerm).toBe("art deco");
    expect(params.page).toBe(3);
    expect(params.pageSize).toBe(50);
    expect(params.categories).toEqual(["furniture"]);
    expect(params.ranges).toEqual({ price: { min: 100, max: 500 } });
    expect(params.citySlug).toBe("new-york");
    expect(params.sort).toBe("-price");
    expect(params.options.status).toEqual(["sold", "passed"]);
  });

  it("handles partial price range", () => {
    const params = buildSearchParams(
      { keywords: "test", priceRange: { min: 50 } },
      [],
    );
    expect(params.ranges).toEqual({ price: { min: 50, max: undefined } });
  });

  it("maps all sort options correctly", () => {
    const sortTests: Array<[string, string]> = [
      ["relevance", "-relevance"],
      ["price-asc", "price"],
      ["price-desc", "-price"],
      ["ending-soon", "saleEnd"],
    ];

    for (const [input, expected] of sortTests) {
      const params = buildSearchParams(
        { keywords: "test", sort: input as "relevance" },
        [],
      );
      expect(params.sort).toBe(expected);
    }
  });
});

describe("buildSearchUrl", () => {
  it("encodes parameters as JSON in URL", () => {
    const params = buildSearchParams({ keywords: "test lamp" }, ["upcoming"]);
    const url = buildSearchUrl(params);

    expect(url).toContain("search-party-prod.liveauctioneers.com");
    expect(url).toContain("useATGSearch=true");
    expect(url).toContain("parameters=");

    const match = url.match(/parameters=([^&]+)/);
    const decoded = JSON.parse(decodeURIComponent(match![1]));
    expect(decoded.searchTerm).toBe("test lamp");
  });
});

describe("mapSearchItem", () => {
  it("maps basic item fields", () => {
    const result = mapSearchItem(mockSearchItem, false);

    expect(result.platform).toBe("liveauctioneers");
    expect(result.itemId).toBe("12345");
    expect(result.title).toBe("Art Deco Table Lamp");
    expect(result.currentPrice).toBe(150);
    expect(result.currency).toBe("USD");
    expect(result.url).toBe("https://www.liveauctioneers.com/item/12345");
    expect(result.auctionHouse).toBe("Heritage Auctions");
  });

  it("builds image URL from photos array", () => {
    const result = mapSearchItem(mockSearchItem, false);

    expect(result.imageUrl).toContain("liveauctioneers.com");
    expect(result.imageUrl).toContain("/123/"); // sellerId
    expect(result.imageUrl).toContain("/456789/"); // catalogId
    expect(result.imageUrl).toContain("12345_1_x.jpg"); // itemId_photoIndex_x.jpg
  });

  it("excludes sold data when includeSoldData is false", () => {
    const result = mapSearchItem(mockSoldItem, false);

    expect(result.soldPrice).toBeUndefined();
    expect(result.soldDate).toBeUndefined();
  });

  it("includes sold data when includeSoldData is true", () => {
    const result = mapSearchItem(mockSoldItem, true);

    expect(result.soldPrice).toBe(225);
    expect(result.soldDate).toBeInstanceOf(Date);
  });

  it("handles missing optional fields with defaults", () => {
    const minimalItem: LASearchItem = {
      itemId: 1,
      title: "",
      leadingBid: 0,
      startPrice: 0,
      currency: "USD",
      photos: [],
      saleStartTs: 0,
      sellerName: "",
      sellerId: 0,
      catalogId: 0,
      catalogStatus: "online",
    };
    const result = mapSearchItem(minimalItem, false);

    expect(result.title).toBe("");
    expect(result.currentPrice).toBe(0);
    expect(result.currency).toBe("USD");
    expect(result.imageUrl).toBe("");
  });

  it("maps status correctly", () => {
    expect(
      mapSearchItem({ ...mockSearchItem, catalogStatus: "live" }, false).status,
    ).toBe("live");
    expect(
      mapSearchItem({ ...mockSearchItem, catalogStatus: "online" }, false)
        .status,
    ).toBe("online");
    expect(
      mapSearchItem({ ...mockSearchItem, catalogStatus: "upcoming" }, false)
        .status,
    ).toBe("upcoming");
    expect(
      mapSearchItem({ ...mockSearchItem, isSold: true }, false).status,
    ).toBe("sold");
    expect(
      mapSearchItem({ ...mockSearchItem, isPassed: true }, false).status,
    ).toBe("passed");
  });
});

describe("inferAuctionType", () => {
  it("returns live for live status", () => {
    expect(inferAuctionType("live")).toBe("live");
  });

  it("returns timed for other statuses", () => {
    expect(inferAuctionType("upcoming")).toBe("timed");
    expect(inferAuctionType("online")).toBe("timed");
    expect(inferAuctionType("sold")).toBe("timed");
    expect(inferAuctionType(undefined)).toBe("timed");
  });
});

describe("buildUnifiedItem", () => {
  it("combines data from all three sources", () => {
    const item = buildUnifiedItem(
      "12345",
      mockItemDetail,
      mockItemFacets,
      mockContentItems.payload.items[0],
    );

    expect(item.id).toBe("la-12345");
    expect(item.platformItemId).toBe("12345");
    expect(item.title).toBe("Art Deco Table Lamp");
    expect(item.category).toEqual(["Lighting", "Art Deco"]);
    expect(item.estimateRange).toEqual({ low: 100, high: 300 });
    expect(item.seller.name).toBe("Heritage Auctions");
    expect(item.similarItems).toHaveLength(1);
    expect(item.facets?.periods).toEqual(["1920-1930"]);
  });

  it("handles empty/missing data gracefully", () => {
    const item = buildUnifiedItem("999", {}, {}, undefined);

    expect(item.id).toBe("la-999");
    expect(item.title).toBe("");
    expect(item.description).toBe("");
    expect(item.images).toEqual([]);
    expect(item.category).toEqual([]);
    expect(item.currentPrice).toBe(0);
    expect(item.seller.name).toBe("Unknown");
    expect(item.estimateRange).toBeUndefined();
    expect(item.similarItems).toBeUndefined();
  });

  it("requires both estimate values for estimateRange", () => {
    const itemLowOnly = buildUnifiedItem(
      "1",
      { estimateLow: 100 },
      {},
      undefined,
    );
    expect(itemLowOnly.estimateRange).toBeUndefined();

    const itemHighOnly = buildUnifiedItem(
      "2",
      { estimateHigh: 500 },
      {},
      undefined,
    );
    expect(itemHighOnly.estimateRange).toBeUndefined();

    const itemBoth = buildUnifiedItem(
      "3",
      { estimateLow: 100, estimateHigh: 500 },
      {},
      undefined,
    );
    expect(itemBoth.estimateRange).toEqual({ low: 100, high: 500 });
  });

  it("prefers detail materials over facet materials", () => {
    const item = buildUnifiedItem(
      "1",
      { materials: ["Gold"] },
      { materials: ["Silver"] },
      undefined,
    );
    expect(item.materials).toEqual(["Gold"]);
  });

  it("falls back to facet materials when detail has none", () => {
    const item = buildUnifiedItem(
      "1",
      {},
      { materials: ["Silver"] },
      undefined,
    );
    expect(item.materials).toEqual(["Silver"]);
  });
});

// --- Adapter Integration Tests ---

describe("LiveAuctioneersAdapter", () => {
  describe("constructor", () => {
    it("accepts custom fetch function", () => {
      const customFetch = vi.fn();
      const adapter = new LiveAuctioneersAdapter({ fetchFn: customFetch });
      expect(adapter.platform).toBe("liveauctioneers");
    });
  });

  describe("search", () => {
    it("returns mapped search results", async () => {
      const mockFetch = createMockFetch([
        {
          ok: true,
          data: { error: false, payload: { items: [mockSearchItem] } },
        },
      ]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      const results = await adapter.search({ keywords: "art deco lamp" });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Art Deco Table Lamp");
      expect(results[0].platform).toBe("liveauctioneers");
    });

    it("uses active auction status filters", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: { error: false, payload: { items: [] } } },
      ]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      await adapter.search({ keywords: "test" });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      const params = JSON.parse(
        decodeURIComponent(calledUrl.match(/parameters=([^&]+)/)![1]),
      );
      expect(params.options.status).toEqual([...ACTIVE_AUCTION_STATUS]);
    });

    it("includes required headers", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: { error: false, payload: { items: [] } } },
      ]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      await adapter.search({ keywords: "test" });

      const options = mockFetch.mock.calls[0][1] as RequestInit;
      expect(options.headers).toMatchObject({
        Origin: "https://www.liveauctioneers.com",
        Referer: "https://www.liveauctioneers.com/",
      });
    });

    it("handles empty items array", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: { error: false, payload: { items: [] } } },
      ]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      const results = await adapter.search({ keywords: "nonexistent" });
      expect(results).toEqual([]);
    });

    it("handles missing payload", async () => {
      const mockFetch = createMockFetch([{ ok: true, data: { error: false } }]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      const results = await adapter.search({ keywords: "test" });
      expect(results).toEqual([]);
    });

    it("throws on failed request", async () => {
      const mockFetch = createMockFetch([{ ok: false, status: 500 }]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      await expect(adapter.search({ keywords: "test" })).rejects.toThrow(
        "LiveAuctioneers search failed: 500",
      );
    });
  });

  describe("getPriceHistory", () => {
    it("uses sold status filters", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: { error: false, payload: { items: [] } } },
      ]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      await adapter.getPriceHistory({ keywords: "test" });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      const params = JSON.parse(
        decodeURIComponent(calledUrl.match(/parameters=([^&]+)/)![1]),
      );
      expect(params.options.status).toEqual([...SOLD_ITEM_STATUS]);
    });

    it("includes sold price data", async () => {
      const mockFetch = createMockFetch([
        {
          ok: true,
          data: { error: false, payload: { items: [mockSoldItem] } },
        },
      ]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      const results = await adapter.getPriceHistory({ keywords: "lamp" });

      expect(results[0].soldPrice).toBe(225);
      expect(results[0].soldDate).toBeInstanceOf(Date);
    });
  });

  describe("getItem", () => {
    it("fetches from all three endpoints", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: { "12345": mockItemDetail } },
        { ok: true, data: { "12345": mockItemFacets } },
        { ok: true, data: mockContentItems },
      ]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      await adapter.getItem("12345");

      expect(mockFetch).toHaveBeenCalledTimes(3);
      const urls = mockFetch.mock.calls.map((c) => c[0] as string);
      expect(urls.some((u) => u.includes("item-detail"))).toBe(true);
      expect(urls.some((u) => u.includes("item-facets"))).toBe(true);
      expect(urls.some((u) => u.includes("content/items"))).toBe(true);
    });

    it("combines data into unified item", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: { "12345": mockItemDetail } },
        { ok: true, data: { "12345": mockItemFacets } },
        { ok: true, data: mockContentItems },
      ]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      const item = await adapter.getItem("12345");

      expect(item.id).toBe("la-12345");
      expect(item.title).toBe("Art Deco Table Lamp");
      expect(item.category).toEqual(["Lighting", "Art Deco"]);
      expect(item.similarItems).toHaveLength(1);
    });

    it("handles non-keyed response format", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: mockItemDetail },
        { ok: true, data: mockItemFacets },
        { ok: true, data: mockContentItems },
      ]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      const item = await adapter.getItem("12345");
      expect(item.title).toBe("Art Deco Table Lamp");
    });

    it("throws on failed detail request", async () => {
      const mockFetch = createMockFetch([
        { ok: false, status: 404 },
        { ok: true, data: {} },
        { ok: true, data: {} },
      ]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      await expect(adapter.getItem("99999")).rejects.toThrow(
        "Failed to fetch item detail: 404",
      );
    });

    it("throws on failed facets request", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: {} },
        { ok: false, status: 500 },
        { ok: true, data: {} },
      ]);
      const adapter = new LiveAuctioneersAdapter({ fetchFn: mockFetch });

      await expect(adapter.getItem("12345")).rejects.toThrow(
        "Failed to fetch item facets: 500",
      );
    });
  });
});

// --- Constants Tests ---

describe("status constants", () => {
  it("defines active auction statuses", () => {
    expect(ACTIVE_AUCTION_STATUS).toEqual(["upcoming", "live", "online"]);
  });

  it("defines sold item statuses", () => {
    expect(SOLD_ITEM_STATUS).toEqual(["sold", "passed", "done"]);
  });
});
