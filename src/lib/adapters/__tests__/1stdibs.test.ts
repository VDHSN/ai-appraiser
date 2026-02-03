import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  FirstDibsAdapter,
  buildSearchUriRef,
  buildItemUrl,
  extractJsonLd,
  extractItemId,
  extractItemIdFromServiceId,
  extractImageFromJsonLd,
  extractAllImagesFromJsonLd,
  mapGraphQLItemToSearchResult,
  mapGraphQLItemDetailToUnifiedItem,
  mapProductToUnifiedItem,
  extractItemDetail,
  encodeItemGlobalId,
  PLATFORM,
  DEFAULT_RATE_LIMIT,
  GRAPHQL_URL,
  type GraphQLItem,
  type GraphQLItemDetail,
  type GraphQLSearchResponse,
  type GraphQLItemResponse,
  type JsonLdProduct,
  type JsonLdImageObject,
} from "../1stdibs";
import { RateLimiter } from "../rate-limiter";

// --- Test Fixtures ---

const createMockFetch = (
  responses: Array<{
    ok: boolean;
    status?: number;
    text?: string;
    json?: unknown;
  }>,
) => {
  let callIndex = 0;
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const response = responses[callIndex++] ?? responses[responses.length - 1];
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      text: async () => response.text ?? "",
      json: async () => response.json ?? {},
    } as Response;
  });
};

const mockGraphQLItem: GraphQLItem = {
  serviceId: "f_12345",
  title: "Art Deco Bronze Table Lamp",
  pdpURL: "/furniture/lighting/table-lamps/art-deco-bronze-lamp/id-f_12345/",
  firstPhotoWebPath: "https://a.1stdibscdn.com/lamp-small.jpg",
  pricing: {
    amount: {
      amount: 4500,
      currency: "USD",
    },
  },
  seller: {
    id: "U2VsbGVyOjEyMzQ1",
  },
};

const mockGraphQLItemDetail: GraphQLItemDetail = {
  serviceId: "f_12345",
  title: "Art Deco Bronze Table Lamp",
  pdpURL: "/furniture/lighting/table-lamps/art-deco-bronze-lamp/id-f_12345/",
  description:
    "Exquisite 1920s Art Deco bronze table lamp with original patina.",
  firstPhotoWebPath: "https://a.1stdibscdn.com/lamp-large.jpg",
  photos: [
    { webPath: "https://a.1stdibscdn.com/lamp-1.jpg" },
    { webPath: "https://a.1stdibscdn.com/lamp-2.jpg" },
  ],
  pricing: {
    amount: {
      amount: 4500,
      currency: "USD",
    },
  },
  seller: {
    id: "U2VsbGVyOjEyMzQ1",
    displayName: "Luxury Antiques Gallery",
  },
  categories: [{ name: "Lighting" }, { name: "Table Lamps" }],
};

const mockGraphQLSearchResponse: GraphQLSearchResponse = {
  data: {
    viewer: {
      itemSearch: {
        totalResults: 1,
        edges: [
          {
            node: {
              item: mockGraphQLItem,
            },
          },
        ],
      },
    },
  },
};

const mockGraphQLItemResponse: GraphQLItemResponse = {
  data: {
    node: mockGraphQLItemDetail,
  },
};

const mockJsonLdProduct: JsonLdProduct = {
  "@type": "Product",
  name: "Art Deco Bronze Table Lamp",
  url: "https://www.1stdibs.com/furniture/lighting/table-lamps/art-deco-bronze-lamp/id-f_12345/",
  description:
    "Exquisite 1920s Art Deco bronze table lamp with original patina.",
  image: [
    {
      "@type": "ImageObject",
      contentUrl: "https://a.1stdibscdn.com/lamp-1.jpg",
      thumbnailUrl: "https://a.1stdibscdn.com/lamp-1-thumb.jpg",
    },
    {
      "@type": "ImageObject",
      contentUrl: "https://a.1stdibscdn.com/lamp-2.jpg",
    },
  ],
  offers: {
    "@type": "Offer",
    price: 4500,
    priceCurrency: "USD",
    availability: "http://schema.org/InStock",
  },
  brand: {
    "@type": "Brand",
    name: "Luxury Antiques Gallery",
  },
};

const mockItemHtml = `
<!DOCTYPE html>
<html>
<head>
  <script type="application/ld+json">${JSON.stringify(mockJsonLdProduct)}</script>
</head>
<body></body>
</html>
`;

// --- Pure Function Tests ---

describe("buildSearchUriRef", () => {
  it("builds uriRef with minimal query", () => {
    const uriRef = buildSearchUriRef({ keywords: "art deco lamp" });

    expect(uriRef).toBe("/search/?q=art+deco+lamp");
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

describe("buildItemUrl", () => {
  it("builds correct item URL from ID", () => {
    const url = buildItemUrl("12345");

    expect(url).toBe("https://www.1stdibs.com/item/id-f_12345/");
  });
});

describe("extractItemIdFromServiceId", () => {
  it("extracts ID from serviceId with f_ prefix", () => {
    expect(extractItemIdFromServiceId("f_12345")).toBe("12345");
  });

  it("returns original if no prefix", () => {
    expect(extractItemIdFromServiceId("12345")).toBe("12345");
  });
});

describe("encodeItemGlobalId", () => {
  it("encodes item ID to base64 global ID", () => {
    const globalId = encodeItemGlobalId("12345");
    expect(globalId).toBe(btoa("Item:f_12345"));
  });
});

describe("mapGraphQLItemToSearchResult", () => {
  it("maps all fields correctly", () => {
    const result = mapGraphQLItemToSearchResult(mockGraphQLItem);

    expect(result.platform).toBe(PLATFORM);
    expect(result.itemId).toBe("12345");
    expect(result.title).toBe("Art Deco Bronze Table Lamp");
    expect(result.currentPrice).toBe(4500);
    expect(result.currency).toBe("USD");
    expect(result.imageUrl).toBe("https://a.1stdibscdn.com/lamp-small.jpg");
    expect(result.thumbnailUrl).toBe(result.imageUrl);
    expect(result.url).toBe(
      "https://www.1stdibs.com/furniture/lighting/table-lamps/art-deco-bronze-lamp/id-f_12345/",
    );
    expect(result.status).toBe("online");
  });

  it("handles missing optional fields", () => {
    const minimalItem: GraphQLItem = {
      serviceId: "f_99999",
      title: "Test Item",
      pdpURL: "/item/id-f_99999/",
      firstPhotoWebPath: null,
      pricing: null,
      seller: null,
    };

    const result = mapGraphQLItemToSearchResult(minimalItem);

    expect(result.platform).toBe(PLATFORM);
    expect(result.itemId).toBe("99999");
    expect(result.title).toBe("Test Item");
    expect(result.currentPrice).toBe(0);
    expect(result.currency).toBe("USD");
    expect(result.imageUrl).toBe("");
    expect(result.status).toBe("online");
  });
});

describe("mapGraphQLItemDetailToUnifiedItem", () => {
  it("builds complete unified item", () => {
    const item = mapGraphQLItemDetailToUnifiedItem(mockGraphQLItemDetail);

    expect(item.id).toBe("fd-12345");
    expect(item.platformItemId).toBe("12345");
    expect(item.platform).toBe(PLATFORM);
    expect(item.title).toBe("Art Deco Bronze Table Lamp");
    expect(item.description).toContain("1920s Art Deco bronze table lamp");
    expect(item.images).toContain("https://a.1stdibscdn.com/lamp-large.jpg");
    expect(item.images).toContain("https://a.1stdibscdn.com/lamp-1.jpg");

    expect(item.currentPrice).toBe(4500);
    expect(item.currency).toBe("USD");
    expect(item.auctionType).toBe("buy-now");

    expect(item.seller.name).toBe("Luxury Antiques Gallery");
    expect(item.category).toEqual(["Lighting", "Table Lamps"]);
    expect(item.facets?.categories).toEqual(["Lighting", "Table Lamps"]);
  });

  it("handles missing optional fields", () => {
    const minimalItem: GraphQLItemDetail = {
      serviceId: "f_99999",
      title: "Test",
      pdpURL: "/item/id-f_99999/",
      description: null,
      firstPhotoWebPath: null,
      photos: null,
      pricing: null,
      seller: null,
      categories: null,
    };

    const item = mapGraphQLItemDetailToUnifiedItem(minimalItem);

    expect(item.id).toBe("fd-99999");
    expect(item.title).toBe("Test");
    expect(item.description).toBe("");
    expect(item.images).toEqual([]);
    expect(item.currentPrice).toBe(0);
    expect(item.currency).toBe("USD");
    expect(item.seller.name).toBe("Unknown");
    expect(item.auctionType).toBe("buy-now");
  });
});

// --- JSON-LD Tests (for fallback functionality) ---

describe("extractJsonLd", () => {
  it("extracts JSON-LD from script tag", () => {
    const html = `
      <html>
        <script type="application/ld+json">{"@type":"Product","name":"Test"}</script>
      </html>
    `;

    const result = extractJsonLd(html);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ "@type": "Product", name: "Test" });
  });

  it("extracts multiple JSON-LD blocks", () => {
    const html = `
      <html>
        <script type="application/ld+json">{"@type":"Product","name":"Test1"}</script>
        <script type="application/ld+json">{"@type":"Product","name":"Test2"}</script>
      </html>
    `;

    const result = extractJsonLd(html);

    expect(result).toHaveLength(2);
  });

  it("flattens arrays in JSON-LD", () => {
    const html = `
      <html>
        <script type="application/ld+json">[{"@type":"Product"},{"@type":"WebPage"}]</script>
      </html>
    `;

    const result = extractJsonLd(html);

    expect(result).toHaveLength(2);
  });

  it("skips invalid JSON", () => {
    const html = `
      <html>
        <script type="application/ld+json">{invalid json}</script>
        <script type="application/ld+json">{"@type":"Product"}</script>
      </html>
    `;

    const result = extractJsonLd(html);

    expect(result).toHaveLength(1);
  });

  it("returns empty array for no JSON-LD", () => {
    const html = "<html><body>No JSON-LD here</body></html>";

    const result = extractJsonLd(html);

    expect(result).toEqual([]);
  });
});

describe("extractItemId", () => {
  it("extracts ID from URL with id-f_ format", () => {
    const url = "https://www.1stdibs.com/furniture/lighting/lamp/id-f_12345/";

    expect(extractItemId(url)).toBe("12345");
  });

  it("returns empty string for URL without ID", () => {
    const url = "https://www.1stdibs.com/furniture/lighting/";

    expect(extractItemId(url)).toBe("");
  });

  it("handles relative URLs", () => {
    const url = "/furniture/lighting/lamp/id-f_67890/";

    expect(extractItemId(url)).toBe("67890");
  });
});

describe("extractImageFromJsonLd", () => {
  it("returns string image as-is", () => {
    const image = "https://example.com/image.jpg";

    expect(extractImageFromJsonLd(image)).toBe(image);
  });

  it("extracts contentUrl from ImageObject", () => {
    const image: JsonLdImageObject = {
      "@type": "ImageObject",
      contentUrl: "https://example.com/image.jpg",
    };

    expect(extractImageFromJsonLd(image)).toBe("https://example.com/image.jpg");
  });

  it("extracts first image from array", () => {
    const images: JsonLdImageObject[] = [
      { "@type": "ImageObject", contentUrl: "https://example.com/first.jpg" },
      { "@type": "ImageObject", contentUrl: "https://example.com/second.jpg" },
    ];

    expect(extractImageFromJsonLd(images)).toBe(
      "https://example.com/first.jpg",
    );
  });

  it("returns empty string for undefined", () => {
    expect(extractImageFromJsonLd(undefined)).toBe("");
  });
});

describe("extractAllImagesFromJsonLd", () => {
  it("returns array with single string image", () => {
    const image = "https://example.com/image.jpg";

    expect(extractAllImagesFromJsonLd(image)).toEqual([image]);
  });

  it("extracts all contentUrls from array", () => {
    const images: JsonLdImageObject[] = [
      { "@type": "ImageObject", contentUrl: "https://example.com/first.jpg" },
      { "@type": "ImageObject", contentUrl: "https://example.com/second.jpg" },
    ];

    expect(extractAllImagesFromJsonLd(images)).toEqual([
      "https://example.com/first.jpg",
      "https://example.com/second.jpg",
    ]);
  });

  it("returns empty array for undefined", () => {
    expect(extractAllImagesFromJsonLd(undefined)).toEqual([]);
  });

  it("extracts single ImageObject", () => {
    const image: JsonLdImageObject = {
      "@type": "ImageObject",
      contentUrl: "https://example.com/image.jpg",
    };

    expect(extractAllImagesFromJsonLd(image)).toEqual([
      "https://example.com/image.jpg",
    ]);
  });
});

describe("mapProductToUnifiedItem", () => {
  it("builds complete unified item from JSON-LD", () => {
    const item = mapProductToUnifiedItem(mockJsonLdProduct);

    expect(item.id).toBe("fd-12345");
    expect(item.platformItemId).toBe("12345");
    expect(item.platform).toBe(PLATFORM);
    expect(item.title).toBe("Art Deco Bronze Table Lamp");
    expect(item.description).toContain("1920s Art Deco bronze table lamp");
    expect(item.images).toHaveLength(2);

    expect(item.currentPrice).toBe(4500);
    expect(item.currency).toBe("USD");
    expect(item.auctionType).toBe("buy-now");

    expect(item.seller.name).toBe("Luxury Antiques Gallery");
  });

  it("handles minimal product with defaults", () => {
    const minimalProduct: JsonLdProduct = {
      "@type": "Product",
      name: "Test",
      url: "/item/id-f_99999/",
    };

    const item = mapProductToUnifiedItem(minimalProduct);

    expect(item.id).toBe("fd-99999");
    expect(item.title).toBe("Test");
    expect(item.description).toBe("");
    expect(item.images).toEqual([]);
    expect(item.currentPrice).toBe(0);
    expect(item.currency).toBe("USD");
    expect(item.seller.name).toBe("Unknown");
    expect(item.auctionType).toBe("buy-now");
  });
});

describe("extractItemDetail", () => {
  it("extracts Product from JSON-LD", () => {
    const result = extractItemDetail([mockJsonLdProduct]);

    expect(result).not.toBeNull();
    expect(result?.name).toBe("Art Deco Bronze Table Lamp");
  });

  it("returns null for non-Product data", () => {
    const result = extractItemDetail([
      { "@type": "WebPage" } as unknown as JsonLdProduct,
    ]);

    expect(result).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(extractItemDetail([])).toBeNull();
  });
});

// --- Constants Tests ---

describe("constants", () => {
  it("has correct platform name", () => {
    expect(PLATFORM).toBe("1stdibs");
  });

  it("has correct default rate limit", () => {
    expect(DEFAULT_RATE_LIMIT).toBe(2);
  });

  it("has correct GraphQL URL", () => {
    expect(GRAPHQL_URL).toBe("https://www.1stdibs.com/soa/graphql/");
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
      mockFetch = createMockFetch([
        { ok: true, json: mockGraphQLSearchResponse },
      ]);
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

    it("sends GraphQL request to correct endpoint", async () => {
      await adapter.search({ keywords: "test" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe(GRAPHQL_URL);
      expect(options?.method).toBe("POST");
      expect(options?.headers).toMatchObject({
        "Content-Type": "application/json",
      });
    });

    it("sends correct GraphQL variables", async () => {
      await adapter.search({ keywords: "lamp", pageSize: 10 });

      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.variables.uriRef).toContain("q=lamp");
      expect(body.variables.first).toBe(10);
    });

    it("handles empty results", async () => {
      const emptyResponse: GraphQLSearchResponse = {
        data: {
          viewer: {
            itemSearch: {
              totalResults: 0,
              edges: [],
            },
          },
        },
      };
      mockFetch = createMockFetch([{ ok: true, json: emptyResponse }]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      const results = await adapter.search({ keywords: "nonexistent" });
      expect(results).toEqual([]);
    });

    it("handles null data gracefully", async () => {
      mockFetch = createMockFetch([{ ok: true, json: { data: null } }]);
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

    it("throws on GraphQL error", async () => {
      mockFetch = createMockFetch([
        {
          ok: true,
          json: {
            data: null,
            errors: [{ message: "Query validation failed" }],
          },
        },
      ]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      await expect(adapter.search({ keywords: "test" })).rejects.toThrow(
        "1stDibs search failed: Query validation failed",
      );
    });
  });

  describe("getItem", () => {
    let mockFetch: ReturnType<typeof createMockFetch>;
    let adapter: FirstDibsAdapter;

    beforeEach(() => {
      mockFetch = createMockFetch([
        { ok: true, json: mockGraphQLItemResponse },
      ]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });
    });

    it("returns unified item via GraphQL", async () => {
      const item = await adapter.getItem("12345");

      expect(item.id).toBe("fd-12345");
      expect(item.title).toBe("Art Deco Bronze Table Lamp");
      expect(item.platform).toBe("1stdibs");
      expect(item.auctionType).toBe("buy-now");
    });

    it("sends GraphQL request with encoded ID", async () => {
      await adapter.getItem("12345");

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const body = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);
      expect(body.variables.id).toBe(btoa("Item:f_12345"));
    });

    it("falls back to HTML/JSON-LD when GraphQL returns null", async () => {
      mockFetch = createMockFetch([
        { ok: true, json: { data: { node: null } } },
        { ok: true, text: mockItemHtml },
      ]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      const item = await adapter.getItem("12345");

      expect(item.id).toBe("fd-12345");
      expect(item.title).toBe("Art Deco Bronze Table Lamp");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("falls back to HTML/JSON-LD on GraphQL error", async () => {
      mockFetch = createMockFetch([
        {
          ok: true,
          json: { data: null, errors: [{ message: "Not found" }] },
        },
        { ok: true, text: mockItemHtml },
      ]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      const item = await adapter.getItem("12345");

      expect(item.id).toBe("fd-12345");
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws when item not found via both methods", async () => {
      mockFetch = createMockFetch([
        { ok: true, json: { data: { node: null } } },
        { ok: true, text: "<html><body>Not found</body></html>" },
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

    it("throws on HTTP error during fallback", async () => {
      mockFetch = createMockFetch([
        { ok: true, json: { data: { node: null } } },
        { ok: false, status: 404 },
      ]);
      const limiter = new RateLimiter({ requestsPerSecond: 1000 });
      adapter = new FirstDibsAdapter({
        fetchFn: mockFetch,
        rateLimiter: limiter,
      });

      await expect(adapter.getItem("test")).rejects.toThrow(
        "1stDibs item not found: test: HTTP 404",
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
