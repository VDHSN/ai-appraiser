import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FirstDibsAdapter,
  buildSearchUriRef,
  buildSearchVariables,
  buildGraphQLRequest,
  mapSearchNode,
  buildUnifiedItem,
  buildItemUrl,
  buildSellerLocation,
  buildDimensionsString,
  extractImageUrl,
  PLATFORM,
  DEFAULT_RATE_LIMIT,
  type FDSearchNode,
  type FDSearchResponse,
  type FDItemDetail,
  type FDItemResponse,
} from "../1stdibs";
import { RateLimiter } from "../rate-limiter";

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

const mockSearchNode: FDSearchNode = {
  serviceId: "id-M-12345",
  title: "Art Deco Bronze Table Lamp",
  browseUrl: "/furniture/lighting/table-lamps/art-deco-bronze-lamp/id-f_12345/",
  localizedPdpUrl:
    "https://www.1stdibs.com/furniture/lighting/table-lamps/art-deco-bronze-lamp/id-f_12345/",
  contemporaryTrackingData: {
    price: 4500,
    priceCurrency: "USD",
  },
  seller: {
    serviceId: "dealer-123",
    sellerProfile: {
      company: "Luxury Antiques Gallery",
    },
    sellerPreferences: {
      sellerLocation: {
        city: "New York",
        region: "NY",
      },
    },
  },
  photos: [
    {
      masterOrZoomPath: "https://a.1stdibscdn.com/art-deco-lamp-full.jpg",
      placeholder: "https://a.1stdibscdn.com/art-deco-lamp-thumb.jpg",
      versions: {
        webp: {
          path: "https://a.1stdibscdn.com/art-deco-lamp.webp",
        },
      },
    },
  ],
  classification: {
    categories: [{ name: "Lighting" }, { name: "Table Lamps" }],
  },
};

const mockSearchNodeMinimal: FDSearchNode = {
  serviceId: "id-M-99999",
};

const mockItemDetail: FDItemDetail = {
  serviceId: "id-M-12345",
  title: "Art Deco Bronze Table Lamp",
  description:
    "Exquisite 1920s Art Deco bronze table lamp with original patina.",
  browseUrl: "/furniture/lighting/table-lamps/art-deco-bronze-lamp/id-f_12345/",
  localizedPdpUrl:
    "https://www.1stdibs.com/furniture/lighting/table-lamps/art-deco-bronze-lamp/id-f_12345/",
  contemporaryTrackingData: {
    price: 4500,
    priceCurrency: "USD",
    netPrice: 4050,
  },
  seller: {
    serviceId: "dealer-123",
    sellerProfile: {
      company: "Luxury Antiques Gallery",
      aboutUs: "Premier antiques dealer since 1985",
    },
    sellerPreferences: {
      sellerLocation: {
        city: "New York",
        region: "NY",
        country: "United States",
      },
    },
    reviewsInfo: {
      averageRating: 4.8,
      reviewCount: 156,
    },
  },
  photos: [
    {
      masterOrZoomPath: "https://a.1stdibscdn.com/lamp-1.jpg",
      versions: { webp: { path: "https://a.1stdibscdn.com/lamp-1.webp" } },
    },
    {
      masterOrZoomPath: "https://a.1stdibscdn.com/lamp-2.jpg",
      versions: { webp: { path: "https://a.1stdibscdn.com/lamp-2.webp" } },
    },
  ],
  classification: {
    categories: [
      { name: "Lighting", urlLabel: "lighting" },
      { name: "Table Lamps", urlLabel: "table-lamps" },
    ],
    creators: [{ name: "Edgar Brandt" }],
  },
  measurement: {
    display: {
      value: "18 in. H x 10 in. W",
      unit: "",
    },
  },
  materials: [{ name: "Bronze" }, { name: "Glass" }],
  condition: {
    displayCondition: "Excellent",
    description: "Minor wear consistent with age, original patina intact",
  },
  provenance: "Private collection, Paris",
  styleDisplay: "Art Deco",
  periodDisplay: "1920s",
};

const mockSearchResponse: FDSearchResponse = {
  data: {
    searchBrowse: {
      edges: [{ node: mockSearchNode }],
      totalResults: 1,
      pageInfo: {
        hasNextPage: false,
        endCursor: "cursor-1",
      },
    },
  },
};

const mockItemResponse: FDItemResponse = {
  data: {
    item: mockItemDetail,
  },
};

// --- Pure Function Tests ---

describe("buildSearchUriRef", () => {
  it("builds URI with minimal query", () => {
    const uriRef = buildSearchUriRef({ keywords: "art deco lamp" });

    expect(uriRef).toContain("/search/");
    expect(uriRef).toContain("q=art%20deco%20lamp");
  });

  it("includes category filter", () => {
    const uriRef = buildSearchUriRef({
      keywords: "lamp",
      category: "lighting",
    });

    expect(uriRef).toContain("category=lighting");
  });

  it("includes price range filters", () => {
    const uriRef = buildSearchUriRef({
      keywords: "lamp",
      priceRange: { min: 100, max: 5000 },
    });

    expect(uriRef).toContain("price_min=100");
    expect(uriRef).toContain("price_max=5000");
  });

  it("handles partial price range", () => {
    const uriRefMinOnly = buildSearchUriRef({
      keywords: "lamp",
      priceRange: { min: 100 },
    });
    expect(uriRefMinOnly).toContain("price_min=100");
    expect(uriRefMinOnly).not.toContain("price_max");

    const uriRefMaxOnly = buildSearchUriRef({
      keywords: "lamp",
      priceRange: { max: 5000 },
    });
    expect(uriRefMaxOnly).toContain("price_max=5000");
    expect(uriRefMaxOnly).not.toContain("price_min");
  });

  it("includes location filter", () => {
    const uriRef = buildSearchUriRef({
      keywords: "lamp",
      location: "new-york",
    });

    expect(uriRef).toContain("seller_location=new-york");
  });

  it("includes sort parameter", () => {
    const uriRefPriceAsc = buildSearchUriRef({
      keywords: "lamp",
      sort: "price-asc",
    });
    expect(uriRefPriceAsc).toContain("sort=price-asc");

    const uriRefPriceDesc = buildSearchUriRef({
      keywords: "lamp",
      sort: "price-desc",
    });
    expect(uriRefPriceDesc).toContain("sort=price-desc");
  });

  it("omits sort for relevance (default)", () => {
    const uriRef = buildSearchUriRef({
      keywords: "lamp",
      sort: "relevance",
    });

    expect(uriRef).not.toContain("sort=");
  });
});

describe("buildSearchVariables", () => {
  it("builds variables with default page size", () => {
    const variables = buildSearchVariables({ keywords: "lamp" });

    expect(variables.first).toBe(24);
    expect(variables.localeFilter).toBe("en-US");
    expect(typeof variables.uriRef).toBe("string");
  });

  it("uses custom page size", () => {
    const variables = buildSearchVariables({
      keywords: "lamp",
      pageSize: 50,
    });

    expect(variables.first).toBe(50);
  });
});

describe("buildGraphQLRequest", () => {
  it("builds valid JSON request body", () => {
    const body = buildGraphQLRequest(
      "query Test { test }",
      { foo: "bar" },
      "TestQuery",
    );

    const parsed = JSON.parse(body);
    expect(parsed.query).toBe("query Test { test }");
    expect(parsed.variables).toEqual({ foo: "bar" });
    expect(parsed.operationName).toBe("TestQuery");
  });
});

describe("extractImageUrl", () => {
  it("prefers webp format", () => {
    const photo = {
      masterOrZoomPath: "https://example.com/image.jpg",
      versions: { webp: { path: "https://example.com/image.webp" } },
    };

    expect(extractImageUrl(photo)).toBe("https://example.com/image.webp");
  });

  it("falls back to masterOrZoomPath", () => {
    const photo = {
      masterOrZoomPath: "https://example.com/image.jpg",
    };

    expect(extractImageUrl(photo)).toBe("https://example.com/image.jpg");
  });

  it("falls back to placeholder", () => {
    const photo = {
      placeholder: "https://example.com/placeholder.jpg",
    };

    expect(extractImageUrl(photo)).toBe("https://example.com/placeholder.jpg");
  });

  it("returns empty string for undefined", () => {
    expect(extractImageUrl(undefined)).toBe("");
  });

  it("returns empty string for empty object", () => {
    expect(extractImageUrl({})).toBe("");
  });
});

describe("buildItemUrl", () => {
  it("returns browseUrl with https prefix if missing", () => {
    const url = buildItemUrl("/furniture/lighting/lamp/id-123/", "id-123");

    expect(url).toBe("https://www.1stdibs.com/furniture/lighting/lamp/id-123/");
  });

  it("returns browseUrl as-is if already absolute", () => {
    const url = buildItemUrl(
      "https://www.1stdibs.com/furniture/lamp/id-123/",
      "id-123",
    );

    expect(url).toBe("https://www.1stdibs.com/furniture/lamp/id-123/");
  });

  it("constructs URL from serviceId if no browseUrl", () => {
    const url = buildItemUrl(undefined, "id-M-12345");

    expect(url).toBe("https://www.1stdibs.com/item/id-M-12345");
  });

  it("handles both undefined", () => {
    const url = buildItemUrl(undefined, undefined);

    expect(url).toBe("https://www.1stdibs.com/item/");
  });
});

describe("buildSellerLocation", () => {
  it("builds full location string", () => {
    const location = buildSellerLocation({
      city: "New York",
      region: "NY",
      country: "United States",
    });

    expect(location).toBe("New York, NY, United States");
  });

  it("handles partial location", () => {
    const location = buildSellerLocation({
      city: "Paris",
      country: "France",
    });

    expect(location).toBe("Paris, France");
  });

  it("returns undefined for undefined input", () => {
    expect(buildSellerLocation(undefined)).toBeUndefined();
  });

  it("returns undefined for empty object", () => {
    expect(buildSellerLocation({})).toBeUndefined();
  });
});

describe("buildDimensionsString", () => {
  it("builds dimensions with unit", () => {
    const dims = buildDimensionsString({
      display: { value: "18", unit: "in" },
    });

    expect(dims).toBe("18 in");
  });

  it("returns value without unit if unit is empty", () => {
    const dims = buildDimensionsString({
      display: { value: "18 x 10 inches", unit: "" },
    });

    expect(dims).toBe("18 x 10 inches");
  });

  it("falls back to convertedDisplay", () => {
    const dims = buildDimensionsString({
      convertedDisplay: { value: "45 cm", unit: "" },
    });

    expect(dims).toBe("45 cm");
  });

  it("returns undefined for undefined input", () => {
    expect(buildDimensionsString(undefined)).toBeUndefined();
  });

  it("returns undefined for empty measurement", () => {
    expect(buildDimensionsString({})).toBeUndefined();
  });
});

describe("mapSearchNode", () => {
  it("maps all fields correctly", () => {
    const result = mapSearchNode(mockSearchNode);

    expect(result.platform).toBe(PLATFORM);
    expect(result.itemId).toBe("id-M-12345");
    expect(result.title).toBe("Art Deco Bronze Table Lamp");
    expect(result.currentPrice).toBe(4500);
    expect(result.currency).toBe("USD");
    expect(result.imageUrl).toBe("https://a.1stdibscdn.com/art-deco-lamp.webp");
    expect(result.thumbnailUrl).toBe(result.imageUrl);
    expect(result.url).toBe(
      "https://www.1stdibs.com/furniture/lighting/table-lamps/art-deco-bronze-lamp/id-f_12345/",
    );
    expect(result.auctionHouse).toBe("Luxury Antiques Gallery");
    expect(result.status).toBe("online");
  });

  it("handles minimal node with defaults", () => {
    const result = mapSearchNode(mockSearchNodeMinimal);

    expect(result.platform).toBe(PLATFORM);
    expect(result.itemId).toBe("id-M-99999");
    expect(result.title).toBe("");
    expect(result.currentPrice).toBe(0);
    expect(result.currency).toBe("USD");
    expect(result.imageUrl).toBe("");
    expect(result.status).toBe("online");
  });

  it("status is always online for buy-now marketplace", () => {
    const result = mapSearchNode(mockSearchNode);
    expect(result.status).toBe("online");
  });
});

describe("buildUnifiedItem", () => {
  it("builds complete unified item", () => {
    const item = buildUnifiedItem("id-M-12345", mockItemDetail);

    expect(item.id).toBe("fd-id-M-12345");
    expect(item.platformItemId).toBe("id-M-12345");
    expect(item.platform).toBe(PLATFORM);
    expect(item.title).toBe("Art Deco Bronze Table Lamp");
    expect(item.description).toContain("1920s Art Deco bronze table lamp");
    expect(item.images).toHaveLength(2);
    expect(item.images[0]).toBe("https://a.1stdibscdn.com/lamp-1.webp");
    expect(item.category).toEqual(["Lighting", "Table Lamps"]);

    expect(item.currentPrice).toBe(4500);
    expect(item.currency).toBe("USD");
    expect(item.buyNowPrice).toBe(4050);
    expect(item.auctionType).toBe("buy-now");

    expect(item.seller.id).toBe("dealer-123");
    expect(item.seller.name).toBe("Luxury Antiques Gallery");
    expect(item.seller.rating).toBe(4.8);
    expect(item.seller.location).toBe("New York, NY, United States");

    expect(item.condition).toBe("Excellent");
    expect(item.conditionNotes).toContain("Minor wear consistent with age");
    expect(item.provenance).toBe("Private collection, Paris");
    expect(item.dimensions).toBe("18 in. H x 10 in. W");
    expect(item.materials).toEqual(["Bronze", "Glass"]);

    expect(item.facets?.style).toEqual(["Art Deco"]);
    expect(item.facets?.period).toEqual(["1920s"]);
    expect(item.facets?.creators).toEqual(["Edgar Brandt"]);
  });

  it("handles empty/missing data gracefully", () => {
    const item = buildUnifiedItem("id-empty", {});

    expect(item.id).toBe("fd-id-empty");
    expect(item.title).toBe("");
    expect(item.description).toBe("");
    expect(item.images).toEqual([]);
    expect(item.category).toEqual([]);
    expect(item.currentPrice).toBe(0);
    expect(item.currency).toBe("USD");
    expect(item.seller.name).toBe("Unknown");
    expect(item.auctionType).toBe("buy-now");
    expect(item.materials).toBeUndefined();
  });

  it("auction type is always buy-now", () => {
    const item = buildUnifiedItem("id-test", mockItemDetail);
    expect(item.auctionType).toBe("buy-now");
  });
});

// --- Constants Tests ---

describe("constants", () => {
  it("has correct platform name", () => {
    expect(PLATFORM).toBe("1stdibs");
  });

  it("has correct default rate limit", () => {
    expect(DEFAULT_RATE_LIMIT).toBe(4);
  });
});

// --- Adapter Integration Tests ---

describe("FirstDibsAdapter", () => {
  describe("constructor", () => {
    it("creates adapter with default config", () => {
      const adapter = new FirstDibsAdapter();
      expect(adapter.platform).toBe("1stdibs");
    });

    it("accepts custom fetch function", () => {
      const customFetch = vi.fn();
      const adapter = new FirstDibsAdapter({ fetchFn: customFetch });
      expect(adapter.platform).toBe("1stdibs");
    });

    it("accepts custom rate limiter", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 1 });
      const adapter = new FirstDibsAdapter({ rateLimiter: limiter });
      expect(adapter.platform).toBe("1stdibs");
    });

    it("accepts custom requests per second", () => {
      const adapter = new FirstDibsAdapter({ requestsPerSecond: 10 });
      expect(adapter.platform).toBe("1stdibs");
    });
  });

  describe("search", () => {
    let mockFetch: ReturnType<typeof createMockFetch>;
    let adapter: FirstDibsAdapter;

    beforeEach(() => {
      mockFetch = createMockFetch([{ ok: true, data: mockSearchResponse }]);
      // Use a high rate limit to avoid delays in tests
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });
    });

    it("returns mapped search results", async () => {
      const results = await adapter.search({ keywords: "art deco lamp" });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Art Deco Bronze Table Lamp");
      expect(results[0].platform).toBe("1stdibs");
      expect(results[0].currentPrice).toBe(4500);
    });

    it("sends correct GraphQL request", async () => {
      await adapter.search({ keywords: "test" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://www.1stdibs.com/soa/graphql/");
      expect(options?.method).toBe("POST");
      expect(options?.headers).toMatchObject({
        "Content-Type": "application/json",
      });

      const body = JSON.parse(options?.body as string);
      expect(body.operationName).toBe("SearchBrowse");
      expect(body.variables.first).toBe(24);
      expect(body.variables.uriRef).toContain("q=test");
    });

    it("handles empty results", async () => {
      mockFetch = createMockFetch([
        {
          ok: true,
          data: { data: { searchBrowse: { edges: [] } } },
        },
      ]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      const results = await adapter.search({ keywords: "nonexistent" });
      expect(results).toEqual([]);
    });

    it("handles missing data gracefully", async () => {
      mockFetch = createMockFetch([{ ok: true, data: {} }]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      const results = await adapter.search({ keywords: "test" });
      expect(results).toEqual([]);
    });

    it("throws on failed request", async () => {
      mockFetch = createMockFetch([{ ok: false, status: 500 }]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      await expect(adapter.search({ keywords: "test" })).rejects.toThrow(
        "1stDibs search failed: HTTP 500",
      );
    });

    it("throws on GraphQL errors", async () => {
      mockFetch = createMockFetch([
        {
          ok: true,
          data: { errors: [{ message: "Invalid query" }] },
        },
      ]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      await expect(adapter.search({ keywords: "test" })).rejects.toThrow(
        "1stDibs search failed: Invalid query",
      );
    });
  });

  describe("getItem", () => {
    let mockFetch: ReturnType<typeof createMockFetch>;
    let adapter: FirstDibsAdapter;

    beforeEach(() => {
      mockFetch = createMockFetch([{ ok: true, data: mockItemResponse }]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });
    });

    it("returns unified item", async () => {
      const item = await adapter.getItem("id-M-12345");

      expect(item.id).toBe("fd-id-M-12345");
      expect(item.title).toBe("Art Deco Bronze Table Lamp");
      expect(item.platform).toBe("1stdibs");
      expect(item.auctionType).toBe("buy-now");
    });

    it("sends correct GraphQL request", async () => {
      await adapter.getItem("id-M-12345");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.operationName).toBe("ItemDetail");
      expect(body.variables.serviceId).toBe("id-M-12345");
    });

    it("throws when item not found", async () => {
      mockFetch = createMockFetch([
        { ok: true, data: { data: { item: null } } },
      ]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      await expect(adapter.getItem("nonexistent")).rejects.toThrow(
        "1stDibs item not found: nonexistent",
      );
    });

    it("throws on failed request", async () => {
      mockFetch = createMockFetch([{ ok: false, status: 404 }]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      await expect(adapter.getItem("test")).rejects.toThrow(
        "1stDibs item fetch failed: HTTP 404",
      );
    });
  });

  describe("getPriceHistory", () => {
    it("returns empty array (not publicly available)", async () => {
      const mockFetch = createMockFetch([]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      const adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      const results = await adapter.getPriceHistory({ keywords: "lamp" });

      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
