import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockServerAnalytics } from "@/lib/analytics";

// Mock the server analytics module
vi.mock("@/lib/analytics/server", () => ({
  serverAnalytics: new MockServerAnalytics(),
}));

import {
  searchItems,
  getItemDetails,
  getPriceHistory,
  assessValue,
  tools,
  getToolSubsetWithContext,
} from "../index";

// Mock the adapter registry
vi.mock("@/lib/adapters/registry", () => ({
  getAdapter: vi.fn(),
  listPlatforms: vi.fn(() => ["liveauctioneers"]),
}));

import { getAdapter } from "@/lib/adapters/registry";
import { serverAnalytics } from "@/lib/analytics/server";

const mockLiveAuctioneersAdapter = {
  platform: "liveauctioneers",
  search: vi.fn(),
  getItem: vi.fn(),
  getPriceHistory: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  (serverAnalytics as MockServerAnalytics).clear();
  vi.mocked(getAdapter).mockImplementation((platform: string) => {
    if (platform === "liveauctioneers") return mockLiveAuctioneersAdapter;
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
    mockLiveAuctioneersAdapter.search.mockResolvedValue(laResults);

    const result = await searchItems.execute({
      keywords: "art deco lamp",
      pageSize: 12,
    });

    expect(getAdapter).toHaveBeenCalledWith("liveauctioneers");
    expect(mockLiveAuctioneersAdapter.search).toHaveBeenCalledWith({
      keywords: "art deco lamp",
      category: undefined,
      priceRange: undefined,
      pageSize: 12,
    });
    expect(result).toEqual(laResults);
  });

  it("filters to specific platforms when provided", async () => {
    const laResults = [{ itemId: "la-789", title: "LA Only" }];
    mockLiveAuctioneersAdapter.search.mockResolvedValue(laResults);

    const result = await searchItems.execute({
      keywords: "furniture",
      pageSize: 12,
      platforms: ["liveauctioneers"],
    });

    expect(getAdapter).toHaveBeenCalledWith("liveauctioneers");
    expect(result).toEqual(laResults);
  });

  it("passes optional parameters to adapters", async () => {
    mockLiveAuctioneersAdapter.search.mockResolvedValue([]);

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
  });

  it("tracks adapter_search events", async () => {
    mockLiveAuctioneersAdapter.search.mockResolvedValue([{ itemId: "1" }]);

    await searchItems.execute({
      keywords: "test",
      pageSize: 12,
    });

    const mock = serverAnalytics as MockServerAnalytics;
    expect(mock.hasEvent("adapter:search")).toBe(true);
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

  it("tracks adapter_get_item event", async () => {
    const mockItem = { id: "la-123", title: "Test Item" };
    mockLiveAuctioneersAdapter.getItem.mockResolvedValue(mockItem);

    await getItemDetails.execute({
      platform: "liveauctioneers",
      itemId: "12345",
    });

    const mock = serverAnalytics as MockServerAnalytics;
    expect(mock.hasEvent("adapter:get_item")).toBe(true);
    expect(mock.findEvent("adapter:get_item")?.properties).toMatchObject({
      platform: "liveauctioneers",
      item_id: "12345",
      success: true,
    });
  });
});

// --- getPriceHistory Tool ---

describe("getPriceHistory", () => {
  it("has correct description", () => {
    expect(getPriceHistory.description).toContain("recently sold");
  });

  it("searches all adapters by default", async () => {
    const laResults = [{ itemId: "la-456", soldPrice: 200 }];
    mockLiveAuctioneersAdapter.getPriceHistory.mockResolvedValue(laResults);

    const result = await getPriceHistory.execute({
      keywords: "vintage lamp",
      pageSize: 12,
    });

    expect(getAdapter).toHaveBeenCalledWith("liveauctioneers");
    expect(mockLiveAuctioneersAdapter.getPriceHistory).toHaveBeenCalledWith({
      keywords: "vintage lamp",
      category: undefined,
      priceRange: undefined,
      pageSize: 12,
    });
    expect(result).toEqual(laResults);
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
    expect(result).toEqual(laResults);
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

// --- getToolSubsetWithContext ---

describe("getToolSubsetWithContext", () => {
  it("creates tools with userId for analytics attribution", async () => {
    const toolsWithContext = getToolSubsetWithContext(["searchItems"], {
      userId: "user-123",
    });

    mockLiveAuctioneersAdapter.search.mockResolvedValue([{ itemId: "1" }]);
    mockProxiBidAdapter.search.mockResolvedValue([]);

    await toolsWithContext.searchItems?.execute({
      keywords: "test",
      pageSize: 12,
    });

    const mock = serverAnalytics as MockServerAnalytics;
    const searchEvents = mock.events.filter(
      (e) => e.event === "adapter:search",
    );
    expect(searchEvents).toHaveLength(2);
    expect(searchEvents[0].distinctId).toBe("user-123");
    expect(searchEvents[1].distinctId).toBe("user-123");
  });

  it("passes userId to getItemDetails tracking", async () => {
    const toolsWithContext = getToolSubsetWithContext(["getItemDetails"], {
      userId: "user-456",
    });

    const mockItem = { id: "la-123", title: "Test Item" };
    mockLiveAuctioneersAdapter.getItem.mockResolvedValue(mockItem);

    await toolsWithContext.getItemDetails?.execute({
      platform: "liveauctioneers",
      itemId: "12345",
    });

    const mock = serverAnalytics as MockServerAnalytics;
    const getItemEvent = mock.findEvent("adapter:get_item");
    expect(getItemEvent?.distinctId).toBe("user-456");
  });

  it("uses undefined distinctId when no userId provided", async () => {
    const toolsWithContext = getToolSubsetWithContext(["searchItems"], {});

    mockLiveAuctioneersAdapter.search.mockResolvedValue([{ itemId: "1" }]);
    mockProxiBidAdapter.search.mockResolvedValue([]);

    await toolsWithContext.searchItems?.execute({
      keywords: "test",
      pageSize: 12,
    });

    const mock = serverAnalytics as MockServerAnalytics;
    const searchEvents = mock.events.filter(
      (e) => e.event === "adapter:search",
    );
    expect(searchEvents[0].distinctId).toBeUndefined();
  });

  it("returns only requested tool subset", () => {
    const toolsWithContext = getToolSubsetWithContext(
      ["searchItems", "assessValue"],
      { userId: "user-789" },
    );

    expect(toolsWithContext.searchItems).toBeDefined();
    expect(toolsWithContext.assessValue).toBeDefined();
    expect(toolsWithContext.getItemDetails).toBeUndefined();
    expect(toolsWithContext.getPriceHistory).toBeUndefined();
  });
});
