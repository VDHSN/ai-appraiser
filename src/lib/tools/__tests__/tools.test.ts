import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock PostHog before importing tools
vi.mock("posthog-node", () => ({
  PostHog: vi.fn().mockImplementation(() => ({
    capture: vi.fn(),
    shutdown: vi.fn(),
  })),
}));

import {
  searchItems,
  getItemDetails,
  getPriceHistory,
  assessValue,
  tools,
} from "../index";

// Mock the adapter registry
vi.mock("@/lib/adapters/registry", () => ({
  getAdapter: vi.fn(),
  listPlatforms: vi.fn(() => ["liveauctioneers", "proxibid"]),
}));

import { getAdapter } from "@/lib/adapters/registry";

const mockLiveAuctioneersAdapter = {
  platform: "liveauctioneers",
  search: vi.fn(),
  getItem: vi.fn(),
  getPriceHistory: vi.fn(),
};

const mockProxiBidAdapter = {
  platform: "proxibid",
  search: vi.fn(),
  getItem: vi.fn(),
  getPriceHistory: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdapter).mockImplementation((platform: string) => {
    if (platform === "liveauctioneers") return mockLiveAuctioneersAdapter;
    if (platform === "proxibid") return mockProxiBidAdapter;
    throw new Error(`Unknown platform: ${platform}`);
  });
});

// --- Tool Definition Tests ---

describe("tools export", () => {
  it("exports all four tools", () => {
    expect(tools).toHaveProperty("searchItems");
    expect(tools).toHaveProperty("getItemDetails");
    expect(tools).toHaveProperty("getPriceHistory");
    expect(tools).toHaveProperty("assessValue");
  });
});

// --- searchItems Tool ---

describe("searchItems", () => {
  it("has correct description", () => {
    expect(searchItems.description).toContain(
      "Search for active auction items",
    );
  });

  it("searches all adapters by default", async () => {
    const laResults = [{ itemId: "la-123", title: "LA Item" }];
    const pbResults = [{ itemId: "pb-456", title: "PB Item" }];
    mockLiveAuctioneersAdapter.search.mockResolvedValue(laResults);
    mockProxiBidAdapter.search.mockResolvedValue(pbResults);

    const result = await searchItems.execute({
      keywords: "art deco lamp",
      pageSize: 12,
    });

    expect(getAdapter).toHaveBeenCalledWith("liveauctioneers");
    expect(getAdapter).toHaveBeenCalledWith("proxibid");
    expect(mockLiveAuctioneersAdapter.search).toHaveBeenCalledWith({
      keywords: "art deco lamp",
      category: undefined,
      priceRange: undefined,
      pageSize: 12,
    });
    expect(mockProxiBidAdapter.search).toHaveBeenCalledWith({
      keywords: "art deco lamp",
      category: undefined,
      priceRange: undefined,
      pageSize: 12,
    });
    expect(result).toEqual([...laResults, ...pbResults]);
  });

  it("filters to specific platforms when provided", async () => {
    const pbResults = [{ itemId: "pb-789", title: "ProxiBid Only" }];
    mockProxiBidAdapter.search.mockResolvedValue(pbResults);

    const result = await searchItems.execute({
      keywords: "furniture",
      pageSize: 12,
      platforms: ["proxibid"],
    });

    expect(getAdapter).toHaveBeenCalledWith("proxibid");
    expect(getAdapter).not.toHaveBeenCalledWith("liveauctioneers");
    expect(result).toEqual(pbResults);
  });

  it("continues search when one adapter fails", async () => {
    const laResults = [{ itemId: "la-123", title: "Success Item" }];
    mockLiveAuctioneersAdapter.search.mockResolvedValue(laResults);
    mockProxiBidAdapter.search.mockRejectedValue(new Error("Network error"));

    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const result = await searchItems.execute({
      keywords: "test",
      pageSize: 12,
    });

    expect(result).toEqual(laResults);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Search failed for proxibid:",
      expect.any(Error),
    );

    consoleWarnSpy.mockRestore();
  });

  it("passes optional parameters to adapters", async () => {
    mockLiveAuctioneersAdapter.search.mockResolvedValue([]);
    mockProxiBidAdapter.search.mockResolvedValue([]);

    await searchItems.execute({
      keywords: "furniture",
      category: "Chairs",
      priceRange: { min: 100, max: 500 },
      pageSize: 24,
    });

    const expectedQuery = {
      keywords: "furniture",
      category: "Chairs",
      priceRange: { min: 100, max: 500 },
      pageSize: 24,
    };
    expect(mockLiveAuctioneersAdapter.search).toHaveBeenCalledWith(
      expectedQuery,
    );
    expect(mockProxiBidAdapter.search).toHaveBeenCalledWith(expectedQuery);
  });
});

// --- getItemDetails Tool ---

describe("getItemDetails", () => {
  it("has correct description", () => {
    expect(getItemDetails.description).toContain("Get complete details");
  });

  it("calls adapter.getItem with platform and itemId", async () => {
    const mockItem = { id: "la-123", title: "Test Item" };
    mockLiveAuctioneersAdapter.getItem.mockResolvedValue(mockItem);

    const result = await getItemDetails.execute({
      platform: "liveauctioneers",
      itemId: "12345",
    });

    expect(getAdapter).toHaveBeenCalledWith("liveauctioneers");
    expect(mockLiveAuctioneersAdapter.getItem).toHaveBeenCalledWith("12345");
    expect(result).toEqual(mockItem);
  });
});

// --- getPriceHistory Tool ---

describe("getPriceHistory", () => {
  it("has correct description", () => {
    expect(getPriceHistory.description).toContain("recently sold");
  });

  it("searches all adapters by default", async () => {
    const laResults = [{ itemId: "la-456", soldPrice: 200 }];
    const pbResults = [{ itemId: "pb-789", soldPrice: 150 }];
    mockLiveAuctioneersAdapter.getPriceHistory.mockResolvedValue(laResults);
    mockProxiBidAdapter.getPriceHistory.mockResolvedValue(pbResults);

    const result = await getPriceHistory.execute({
      keywords: "vintage lamp",
      pageSize: 12,
    });

    expect(getAdapter).toHaveBeenCalledWith("liveauctioneers");
    expect(getAdapter).toHaveBeenCalledWith("proxibid");
    expect(mockLiveAuctioneersAdapter.getPriceHistory).toHaveBeenCalledWith({
      keywords: "vintage lamp",
      category: undefined,
      priceRange: undefined,
      pageSize: 12,
    });
    expect(mockProxiBidAdapter.getPriceHistory).toHaveBeenCalledWith({
      keywords: "vintage lamp",
      category: undefined,
      priceRange: undefined,
      pageSize: 12,
    });
    expect(result).toEqual([...laResults, ...pbResults]);
  });

  it("filters to specific platforms when provided", async () => {
    const laResults = [{ itemId: "la-123", soldPrice: 300 }];
    mockLiveAuctioneersAdapter.getPriceHistory.mockResolvedValue(laResults);

    const result = await getPriceHistory.execute({
      keywords: "vintage",
      pageSize: 12,
      platforms: ["liveauctioneers"],
    });

    expect(getAdapter).toHaveBeenCalledWith("liveauctioneers");
    expect(getAdapter).not.toHaveBeenCalledWith("proxibid");
    expect(result).toEqual(laResults);
  });

  it("continues search when one adapter fails", async () => {
    const pbResults = [{ itemId: "pb-999", soldPrice: 400 }];
    mockLiveAuctioneersAdapter.getPriceHistory.mockRejectedValue(
      new Error("API unavailable"),
    );
    mockProxiBidAdapter.getPriceHistory.mockResolvedValue(pbResults);

    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    const result = await getPriceHistory.execute({
      keywords: "test",
      pageSize: 12,
    });

    expect(result).toEqual(pbResults);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "Search failed for liveauctioneers:",
      expect.any(Error),
    );

    consoleWarnSpy.mockRestore();
  });
});

// --- assessValue Tool ---

describe("assessValue", () => {
  it("has correct description", () => {
    expect(assessValue.description).toContain("valuation guidance");
  });

  it("calculates price range from comparables", async () => {
    const result = await assessValue.execute({
      itemId: "123",
      comparables: [
        { title: "Comp 1", soldPrice: 100 },
        { title: "Comp 2", soldPrice: 200 },
        { title: "Comp 3", soldPrice: 300 },
      ],
    });

    expect(result.itemId).toBe("123");
    expect(result.comparablesCount).toBe(3);
    expect(result.priceRange).toEqual({ low: 100, high: 300, median: 200 });
    expect(result.confidence).toBe("low");
  });

  it("returns medium confidence with 5+ comparables", async () => {
    const comparables = Array.from({ length: 5 }, (_, i) => ({
      title: `Comp ${i}`,
      soldPrice: 100 + i * 50,
    }));

    const result = await assessValue.execute({ itemId: "123", comparables });

    expect(result.confidence).toBe("medium");
  });

  it("returns high confidence with 10+ comparables", async () => {
    const comparables = Array.from({ length: 10 }, (_, i) => ({
      title: `Comp ${i}`,
      soldPrice: 100 + i * 20,
    }));

    const result = await assessValue.execute({ itemId: "123", comparables });

    expect(result.confidence).toBe("high");
  });

  it("returns null priceRange with fewer than 3 comparables", async () => {
    const result = await assessValue.execute({
      itemId: "123",
      comparables: [
        { title: "Comp 1", soldPrice: 100 },
        { title: "Comp 2", soldPrice: 200 },
      ],
    });

    expect(result.priceRange).toBeNull();
    expect(result.confidence).toBe("low");
  });

  it("adds factor for wide price variance", async () => {
    const result = await assessValue.execute({
      itemId: "123",
      comparables: [
        { title: "Comp 1", soldPrice: 100 },
        { title: "Comp 2", soldPrice: 150 },
        { title: "Comp 3", soldPrice: 500 }, // 5x the low price
      ],
    });

    expect(result.factors).toContain(
      "Wide price variance suggests condition or attribution differences",
    );
  });

  it("adds factor for missing condition data", async () => {
    const result = await assessValue.execute({
      itemId: "123",
      comparables: [
        { title: "Comp 1", soldPrice: 100, condition: "Good" },
        { title: "Comp 2", soldPrice: 200 }, // no condition
        { title: "Comp 3", soldPrice: 300, condition: "Fair" },
      ],
    });

    expect(result.factors).toContain(
      "Condition data missing from some comparables",
    );
  });

  it("calculates correct median for even number of items", async () => {
    const result = await assessValue.execute({
      itemId: "123",
      comparables: [
        { title: "Comp 1", soldPrice: 100 },
        { title: "Comp 2", soldPrice: 200 },
        { title: "Comp 3", soldPrice: 300 },
        { title: "Comp 4", soldPrice: 400 },
      ],
    });

    expect(result.priceRange?.median).toBe(250); // (200 + 300) / 2
  });

  it("provides recommendation for high confidence", async () => {
    const comparables = Array.from({ length: 10 }, (_, i) => ({
      title: `Comp ${i}`,
      soldPrice: 100 + i * 10,
    }));

    const result = await assessValue.execute({ itemId: "123", comparables });

    expect(result.recommendation).toContain("Market value likely between");
    expect(result.recommendation).toContain("median");
  });

  it("provides cautious recommendation for medium confidence", async () => {
    const comparables = Array.from({ length: 5 }, (_, i) => ({
      title: `Comp ${i}`,
      soldPrice: 100 + i * 50,
    }));

    const result = await assessValue.execute({ itemId: "123", comparables });

    expect(result.recommendation).toContain("limited data");
    expect(result.recommendation).toContain("additional opinions");
  });

  it("recommends professional appraisal for low confidence", async () => {
    const result = await assessValue.execute({
      itemId: "123",
      comparables: [
        { title: "Comp 1", soldPrice: 100 },
        { title: "Comp 2", soldPrice: 200 },
      ],
    });

    expect(result.recommendation).toContain("professional appraisal");
  });
});
