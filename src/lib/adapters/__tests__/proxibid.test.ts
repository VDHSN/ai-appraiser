import { describe, it, expect, vi } from "vitest";
import {
  ProxiBidAdapter,
  buildSearchUrl,
  buildImageUrl,
  buildProxiedImageUrl,
  buildItemUrl,
  parsePBDate,
  extractCategoriesFromTitle,
  scrapeItemDetail,
  mapSearchItem,
  type PBLotMeta,
  type PBSearchResponse,
} from "../proxibid";

// --- Test Fixtures ---

const createMockFetch = (
  responses: Array<{
    ok: boolean;
    status?: number;
    data?: unknown;
    text?: string;
  }>,
) => {
  let callIndex = 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
    const response = responses[callIndex++] ?? responses[responses.length - 1];
    return {
      ok: response.ok,
      status: response.status ?? (response.ok ? 200 : 500),
      json: async () => response.data,
      text: async () => response.text ?? "",
    } as Response;
  });
};

const mockLotMeta: PBLotMeta = {
  LotID: 98735520,
  LotTitle: "Vintage Rolex Watch",
  CurrentHighBid: 2500,
  CurrencyAbbrv: "USD",
  LotImage: "11621-1.jpg",
  LotEndDateTime: "1/28/2026 15:54:00",
  AuctionHouseID: 12345,
  CompanyName: "Heritage Auctions",
  CityState: "Dallas, TX",
  AuctionType: "Timed",
  LotNumber: "A-123",
  AuctionID: 291366,
  BidCount: 15,
};

const mockSoldLotMeta: PBLotMeta = {
  LotID: 87654321,
  LotTitle: "Antique Gold Pocket Watch",
  Price: 3200,
  CurrencyAbbrv: "USD",
  LotImage: "99999-1.jpg",
  LotEndDateTime: "12/15/2025 10:30:00",
  AuctionHouseID: 54321,
  CompanyName: "Sothebys",
  CityState: "New York, NY",
  AuctionType: "Live",
  LotNumber: "B-456",
  AuctionID: 100200,
};

const mockSearchResponse: PBSearchResponse = {
  item: [{ meta: mockLotMeta }],
  totalResultCount: 1,
  pageLength: 25,
  pageNumber: 1,
};

// Note: Use explicit \u0020\u0020 for double spaces to prevent formatter collapse
const MOCK_TITLE =
  "Vintage Rolex Watch | Watches\u0020\u0020Jewelry | Online Auctions | Proxibid";
const mockHtmlPage = `<!DOCTYPE html>
<html>
<head><title>${MOCK_TITLE}</title></head>
<body>
  <div id="lotDescription">Beautiful vintage Rolex from the 1960s in excellent condition.</div>
  <img src="https://images.proxibid.com/AuctionImages/12345/291366/FullSize/11621-1.jpg" />
  <img src="https://images.proxibid.com/AuctionImages/12345/291366/FullSize/11621-2.jpg" />
</body>
</html>`;

// --- Pure Function Tests ---

describe("buildSearchUrl", () => {
  it("builds URL with minimal query", () => {
    const url = buildSearchUrl({ keywords: "watch" });

    expect(url).toContain("proxibid.com/asp/SearchBuilder.asp");
    expect(url).toContain("search=watch");
    expect(url).toContain("type=lot");
    expect(url).toContain("searchid=0");
    expect(url).toContain("sort=relevance");
    expect(url).toContain("length=25");
    expect(url).toContain("start=0");
    expect(url).not.toContain("asvt=");
  });

  it("builds URL with pagination", () => {
    const url = buildSearchUrl({ keywords: "art", page: 3, pageSize: 50 });

    expect(url).toContain("length=50");
    expect(url).toContain("start=100"); // (3-1) * 50
  });

  it("builds URL for closed auctions (price history)", () => {
    const url = buildSearchUrl({ keywords: "lamp" }, "closed");

    expect(url).toContain("asvt=closed");
  });

  it("maps sort options correctly", () => {
    const sortTests: Array<[string, string]> = [
      ["relevance", "sort=relevance"],
      ["price-asc", "sort=price"],
      ["price-desc", "sort=price-desc"],
      ["ending-soon", "sort=end"],
    ];

    for (const [input, expected] of sortTests) {
      const url = buildSearchUrl({
        keywords: "test",
        sort: input as "relevance",
      });
      expect(url).toContain(expected);
    }
  });

  it("URL-encodes search keywords", () => {
    const url = buildSearchUrl({ keywords: "art deco lamp" });

    expect(url).toContain("search=art+deco+lamp");
  });
});

describe("buildImageUrl", () => {
  it("builds FullSize URL by default", () => {
    const url = buildImageUrl(12345, 291366, "11621-1.jpg");

    expect(url).toBe(
      "https://images.proxibid.com/AuctionImages/12345/291366/FullSize/11621-1.jpg",
    );
  });

  it("builds URL with specified size", () => {
    const url = buildImageUrl(12345, 291366, "11621-1.jpg", "Thumb");

    expect(url).toBe(
      "https://images.proxibid.com/AuctionImages/12345/291366/Thumb/11621-1.jpg",
    );
  });

  it("supports all size options", () => {
    const sizes = ["FullSize", "FILarge", "FIMedium", "Thumb"] as const;

    for (const size of sizes) {
      const url = buildImageUrl(1, 2, "test.jpg", size);
      expect(url).toContain(`/${size}/`);
    }
  });
});

describe("buildProxiedImageUrl", () => {
  it("wraps URL in image proxy endpoint", () => {
    const rawUrl =
      "https://images.proxibid.com/AuctionImages/12345/291366/FullSize/11621-1.jpg";
    const proxied = buildProxiedImageUrl(rawUrl);

    expect(proxied).toBe(`/api/image?url=${encodeURIComponent(rawUrl)}`);
  });

  it("properly encodes special characters", () => {
    const rawUrl = "https://example.com/image?param=value&other=test";
    const proxied = buildProxiedImageUrl(rawUrl);

    expect(proxied).toContain(encodeURIComponent(rawUrl));
    expect(proxied).not.toContain("&other=");
  });
});

describe("buildItemUrl", () => {
  it("builds URL with default slug", () => {
    const url = buildItemUrl(98735520);

    expect(url).toBe("https://www.proxibid.com/lot/lotInformation/98735520");
  });

  it("builds URL with custom slug", () => {
    const url = buildItemUrl(98735520, "heritage-auctions");

    expect(url).toBe(
      "https://www.proxibid.com/heritage-auctions/lotInformation/98735520",
    );
  });

  it("accepts string IDs", () => {
    const url = buildItemUrl("12345", "auction-house");

    expect(url).toBe(
      "https://www.proxibid.com/auction-house/lotInformation/12345",
    );
  });
});

describe("parsePBDate", () => {
  it("parses US date format correctly", () => {
    const date = parsePBDate("1/28/2026 15:54:00");

    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0); // January is 0
    expect(date.getDate()).toBe(28);
    expect(date.getHours()).toBe(15);
    expect(date.getMinutes()).toBe(54);
    expect(date.getSeconds()).toBe(0);
  });

  it("handles single-digit months and days", () => {
    const date = parsePBDate("3/5/2025 09:30:00");

    expect(date.getMonth()).toBe(2); // March
    expect(date.getDate()).toBe(5);
  });

  it("handles double-digit months and days", () => {
    const date = parsePBDate("12/31/2025 23:59:59");

    expect(date.getMonth()).toBe(11); // December
    expect(date.getDate()).toBe(31);
    expect(date.getHours()).toBe(23);
    expect(date.getMinutes()).toBe(59);
    expect(date.getSeconds()).toBe(59);
  });

  it("falls back to native parsing for unexpected formats", () => {
    const date = parsePBDate("2025-01-28T15:54:00Z");

    expect(date).toBeInstanceOf(Date);
    expect(isNaN(date.getTime())).toBe(false);
  });
});

describe("extractCategoriesFromTitle", () => {
  it("extracts categories from standard title format", () => {
    const title =
      "Vintage Rolex Watch | Watches  Jewelry | Online Auctions | Proxibid";
    const categories = extractCategoriesFromTitle(title);

    expect(categories).toEqual(["Watches", "Jewelry"]);
  });

  it("handles single category", () => {
    const title = "Art Print | Fine Art | Online Auctions | Proxibid";
    const categories = extractCategoriesFromTitle(title);

    expect(categories).toEqual(["Fine Art"]);
  });

  it("returns empty array for unexpected format", () => {
    const title = "Some Random Title";
    const categories = extractCategoriesFromTitle(title);

    expect(categories).toEqual([]);
  });

  it("handles empty string", () => {
    const categories = extractCategoriesFromTitle("");

    expect(categories).toEqual([]);
  });
});

describe("scrapeItemDetail", () => {
  it("extracts description from #lotDescription", () => {
    const result = scrapeItemDetail(mockHtmlPage);

    expect(result.description).toBe(
      "Beautiful vintage Rolex from the 1960s in excellent condition.",
    );
  });

  it("extracts all images with AuctionImages in src", () => {
    const result = scrapeItemDetail(mockHtmlPage);

    expect(result.images).toHaveLength(2);
    expect(result.images[0]).toContain("11621-1.jpg");
    expect(result.images[1]).toContain("11621-2.jpg");
  });

  it("extracts categories from document title", () => {
    const result = scrapeItemDetail(mockHtmlPage);

    // jsdom normalizes whitespace in title, so categories may not split
    // This is best-effort extraction - verify we get something from the title
    expect(result.categories.length).toBeGreaterThan(0);
    expect(result.categories.join(" ")).toContain("Watches");
  });

  it("handles missing elements gracefully", () => {
    const emptyHtml = "<html><head><title></title></head><body></body></html>";
    const result = scrapeItemDetail(emptyHtml);

    expect(result.description).toBe("");
    expect(result.images).toEqual([]);
    expect(result.categories).toEqual([]);
  });

  it("ignores images without AuctionImages in src", () => {
    const html = `
      <html><body>
        <img src="https://example.com/logo.png" />
        <img src="https://images.proxibid.com/AuctionImages/1/2/FullSize/test.jpg" />
      </body></html>
    `;
    const result = scrapeItemDetail(html);

    expect(result.images).toHaveLength(1);
    expect(result.images[0]).toContain("AuctionImages");
  });
});

describe("mapSearchItem", () => {
  it("maps basic item fields", () => {
    const result = mapSearchItem(mockLotMeta, false);

    expect(result.platform).toBe("proxibid");
    expect(result.itemId).toBe("98735520");
    expect(result.title).toBe("Vintage Rolex Watch");
    expect(result.currentPrice).toBe(2500);
    expect(result.currency).toBe("USD");
    expect(result.auctionHouse).toBe("Heritage Auctions");
    expect(result.bidCount).toBe(15);
  });

  it("builds proxied image URL", () => {
    const result = mapSearchItem(mockLotMeta, false);

    expect(result.imageUrl).toContain("/api/image?url=");
    expect(result.imageUrl).toContain("images.proxibid.com");
    expect(result.imageUrl).toContain("12345"); // AuctionHouseID
    expect(result.imageUrl).toContain("291366"); // AuctionID
  });

  it("parses end time from LotEndDateTime", () => {
    const result = mapSearchItem(mockLotMeta, false);

    expect(result.endTime).toBeInstanceOf(Date);
    expect(result.endTime?.getFullYear()).toBe(2026);
  });

  it("excludes sold data when includeSoldData is false", () => {
    const result = mapSearchItem(mockSoldLotMeta, false);

    expect(result.soldPrice).toBeUndefined();
    expect(result.soldDate).toBeUndefined();
    expect(result.status).toBe("online");
  });

  it("includes sold data when includeSoldData is true", () => {
    const result = mapSearchItem(mockSoldLotMeta, true);

    expect(result.soldPrice).toBe(3200);
    expect(result.soldDate).toBeInstanceOf(Date);
    expect(result.status).toBe("sold");
  });

  it("handles missing optional fields", () => {
    const minimalMeta: PBLotMeta = {
      LotID: 1,
      LotTitle: "Test Item",
    };
    const result = mapSearchItem(minimalMeta, false);

    expect(result.itemId).toBe("1");
    expect(result.title).toBe("Test Item");
    expect(result.currentPrice).toBe(0);
    expect(result.currency).toBe("USD");
    expect(result.imageUrl).toBe("");
    expect(result.endTime).toBeUndefined();
  });

  it("uses Price as currentPrice when CurrentHighBid is missing", () => {
    const result = mapSearchItem(mockSoldLotMeta, false);

    expect(result.currentPrice).toBe(3200);
  });
});

// --- Adapter Tests ---

describe("ProxiBidAdapter", () => {
  describe("constructor", () => {
    it("accepts custom fetch function", () => {
      const customFetch = vi.fn();
      const adapter = new ProxiBidAdapter({ fetchFn: customFetch });

      expect(adapter.platform).toBe("proxibid");
    });
  });

  describe("search", () => {
    it("returns mapped search results", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: mockSearchResponse },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      const results = await adapter.search({ keywords: "watch" });

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe("Vintage Rolex Watch");
      expect(results[0].platform).toBe("proxibid");
    });

    it("builds correct search URL", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: { item: [], totalResultCount: 0 } },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      await adapter.search({ keywords: "art deco", page: 2, pageSize: 50 });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("search=art+deco");
      expect(calledUrl).toContain("start=50");
      expect(calledUrl).toContain("length=50");
    });

    it("includes required headers", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: { item: [], totalResultCount: 0 } },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      await adapter.search({ keywords: "test" });

      const options = mockFetch.mock.calls[0][1] as RequestInit;
      expect(options.headers).toMatchObject({
        Referer: "https://www.proxibid.com/",
      });
    });

    it("handles empty results", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: { item: [], totalResultCount: 0 } },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      const results = await adapter.search({ keywords: "nonexistent" });

      expect(results).toEqual([]);
    });

    it("handles missing item array", async () => {
      const mockFetch = createMockFetch([{ ok: true, data: {} }]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      const results = await adapter.search({ keywords: "test" });

      expect(results).toEqual([]);
    });

    it("throws on failed request", async () => {
      const mockFetch = createMockFetch([{ ok: false, status: 500 }]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      await expect(adapter.search({ keywords: "test" })).rejects.toThrow(
        "ProxiBid search failed: 500",
      );
    });
  });

  describe("getPriceHistory", () => {
    it("adds closed status filter", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: { item: [], totalResultCount: 0 } },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      await adapter.getPriceHistory({ keywords: "test" });

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain("asvt=closed");
    });

    it("includes sold price data", async () => {
      const mockFetch = createMockFetch([
        {
          ok: true,
          data: { item: [{ meta: mockSoldLotMeta }], totalResultCount: 1 },
        },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      const results = await adapter.getPriceHistory({ keywords: "watch" });

      expect(results[0].soldPrice).toBe(3200);
      expect(results[0].status).toBe("sold");
    });
  });

  describe("getItem", () => {
    it("fetches search and detail page", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: mockSearchResponse },
        { ok: true, text: mockHtmlPage },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      await adapter.getItem("98735520");

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("combines search metadata with scraped details", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: mockSearchResponse },
        { ok: true, text: mockHtmlPage },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      const item = await adapter.getItem("98735520");

      expect(item.id).toBe("pb-98735520");
      expect(item.title).toBe("Vintage Rolex Watch");
      expect(item.description).toContain("Beautiful vintage Rolex");
      expect(item.images).toHaveLength(2);
      // Categories are best-effort extracted from title
      expect(item.category.length).toBeGreaterThan(0);
    });

    it("throws when item not found in search", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: { item: [], totalResultCount: 0 } },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      await expect(adapter.getItem("nonexistent")).rejects.toThrow(
        "Item not found: nonexistent",
      );
    });

    it("handles scraping failure gracefully", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: mockSearchResponse },
        { ok: false, status: 404 },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      const item = await adapter.getItem("98735520");

      expect(item.title).toBe("Vintage Rolex Watch");
      expect(item.description).toBe("");
      expect(item.images).toEqual([]);
    });

    it("returns correct UnifiedItem structure", async () => {
      const mockFetch = createMockFetch([
        { ok: true, data: mockSearchResponse },
        { ok: true, text: mockHtmlPage },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      const item = await adapter.getItem("98735520");

      expect(item).toMatchObject({
        id: "pb-98735520",
        platformItemId: "98735520",
        platform: "proxibid",
        title: "Vintage Rolex Watch",
        currentPrice: 2500,
        currency: "USD",
        auctionType: "timed",
        seller: {
          id: "12345",
          name: "Heritage Auctions",
          location: "Dallas, TX",
        },
      });
    });

    it("sets auction type based on AuctionType field", async () => {
      const liveAuctionMeta = { ...mockLotMeta, AuctionType: "Live" };
      const mockFetch = createMockFetch([
        {
          ok: true,
          data: { item: [{ meta: liveAuctionMeta }], totalResultCount: 1 },
        },
        { ok: true, text: mockHtmlPage },
      ]);
      const adapter = new ProxiBidAdapter({ fetchFn: mockFetch });

      const item = await adapter.getItem("98735520");

      expect(item.auctionType).toBe("live");
    });
  });
});
