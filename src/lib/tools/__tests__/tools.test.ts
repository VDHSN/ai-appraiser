import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchItems, getItemDetails, getPriceHistory, assessValue, tools } from '../index';

// Mock the adapter registry
vi.mock('@/lib/adapters/registry', () => ({
  getAdapter: vi.fn(),
  listPlatforms: vi.fn(() => ['liveauctioneers']),
}));

import { getAdapter, listPlatforms } from '@/lib/adapters/registry';

const mockAdapter = {
  platform: 'liveauctioneers',
  search: vi.fn(),
  getItem: vi.fn(),
  getPriceHistory: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getAdapter).mockReturnValue(mockAdapter);
});

// --- Tool Definition Tests ---

describe('tools export', () => {
  it('exports all four tools', () => {
    expect(tools).toHaveProperty('searchItems');
    expect(tools).toHaveProperty('getItemDetails');
    expect(tools).toHaveProperty('getPriceHistory');
    expect(tools).toHaveProperty('assessValue');
  });
});

// --- searchItems Tool ---

describe('searchItems', () => {
  it('has correct description', () => {
    expect(searchItems.description).toContain('Search for active auction items');
  });

  it('calls adapter.search with query parameters', async () => {
    const mockResults = [{ itemId: '123', title: 'Test Item' }];
    mockAdapter.search.mockResolvedValue(mockResults);

    const result = await searchItems.execute({
      keywords: 'art deco lamp',
      pageSize: 12,
    });

    expect(getAdapter).toHaveBeenCalledWith('liveauctioneers');
    expect(mockAdapter.search).toHaveBeenCalledWith({
      keywords: 'art deco lamp',
      category: undefined,
      priceRange: undefined,
      pageSize: 12,
    });
    expect(result).toEqual(mockResults);
  });

  it('passes optional parameters to adapter', async () => {
    mockAdapter.search.mockResolvedValue([]);

    await searchItems.execute({
      keywords: 'furniture',
      category: 'Chairs',
      priceRange: { min: 100, max: 500 },
      pageSize: 24,
    });

    expect(mockAdapter.search).toHaveBeenCalledWith({
      keywords: 'furniture',
      category: 'Chairs',
      priceRange: { min: 100, max: 500 },
      pageSize: 24,
    });
  });
});

// --- getItemDetails Tool ---

describe('getItemDetails', () => {
  it('has correct description', () => {
    expect(getItemDetails.description).toContain('Get complete details');
  });

  it('calls adapter.getItem with platform and itemId', async () => {
    const mockItem = { id: 'la-123', title: 'Test Item' };
    mockAdapter.getItem.mockResolvedValue(mockItem);

    const result = await getItemDetails.execute({
      platform: 'liveauctioneers',
      itemId: '12345',
    });

    expect(getAdapter).toHaveBeenCalledWith('liveauctioneers');
    expect(mockAdapter.getItem).toHaveBeenCalledWith('12345');
    expect(result).toEqual(mockItem);
  });
});

// --- getPriceHistory Tool ---

describe('getPriceHistory', () => {
  it('has correct description', () => {
    expect(getPriceHistory.description).toContain('recently sold');
  });

  it('calls adapter.getPriceHistory with query', async () => {
    const mockResults = [{ itemId: '456', soldPrice: 200 }];
    mockAdapter.getPriceHistory.mockResolvedValue(mockResults);

    const result = await getPriceHistory.execute({
      keywords: 'vintage lamp',
      pageSize: 12,
    });

    expect(getAdapter).toHaveBeenCalledWith('liveauctioneers');
    expect(mockAdapter.getPriceHistory).toHaveBeenCalledWith({
      keywords: 'vintage lamp',
      category: undefined,
      priceRange: undefined,
      pageSize: 12,
    });
    expect(result).toEqual(mockResults);
  });
});

// --- assessValue Tool ---

describe('assessValue', () => {
  it('has correct description', () => {
    expect(assessValue.description).toContain('valuation guidance');
  });

  it('calculates price range from comparables', async () => {
    const result = await assessValue.execute({
      itemId: '123',
      comparables: [
        { title: 'Comp 1', soldPrice: 100 },
        { title: 'Comp 2', soldPrice: 200 },
        { title: 'Comp 3', soldPrice: 300 },
      ],
    });

    expect(result.itemId).toBe('123');
    expect(result.comparablesCount).toBe(3);
    expect(result.priceRange).toEqual({ low: 100, high: 300, median: 200 });
    expect(result.confidence).toBe('low');
  });

  it('returns medium confidence with 5+ comparables', async () => {
    const comparables = Array.from({ length: 5 }, (_, i) => ({
      title: `Comp ${i}`,
      soldPrice: 100 + i * 50,
    }));

    const result = await assessValue.execute({ itemId: '123', comparables });

    expect(result.confidence).toBe('medium');
  });

  it('returns high confidence with 10+ comparables', async () => {
    const comparables = Array.from({ length: 10 }, (_, i) => ({
      title: `Comp ${i}`,
      soldPrice: 100 + i * 20,
    }));

    const result = await assessValue.execute({ itemId: '123', comparables });

    expect(result.confidence).toBe('high');
  });

  it('returns null priceRange with fewer than 3 comparables', async () => {
    const result = await assessValue.execute({
      itemId: '123',
      comparables: [
        { title: 'Comp 1', soldPrice: 100 },
        { title: 'Comp 2', soldPrice: 200 },
      ],
    });

    expect(result.priceRange).toBeNull();
    expect(result.confidence).toBe('low');
  });

  it('adds factor for wide price variance', async () => {
    const result = await assessValue.execute({
      itemId: '123',
      comparables: [
        { title: 'Comp 1', soldPrice: 100 },
        { title: 'Comp 2', soldPrice: 150 },
        { title: 'Comp 3', soldPrice: 500 }, // 5x the low price
      ],
    });

    expect(result.factors).toContain(
      'Wide price variance suggests condition or attribution differences'
    );
  });

  it('adds factor for missing condition data', async () => {
    const result = await assessValue.execute({
      itemId: '123',
      comparables: [
        { title: 'Comp 1', soldPrice: 100, condition: 'Good' },
        { title: 'Comp 2', soldPrice: 200 }, // no condition
        { title: 'Comp 3', soldPrice: 300, condition: 'Fair' },
      ],
    });

    expect(result.factors).toContain('Condition data missing from some comparables');
  });

  it('calculates correct median for even number of items', async () => {
    const result = await assessValue.execute({
      itemId: '123',
      comparables: [
        { title: 'Comp 1', soldPrice: 100 },
        { title: 'Comp 2', soldPrice: 200 },
        { title: 'Comp 3', soldPrice: 300 },
        { title: 'Comp 4', soldPrice: 400 },
      ],
    });

    expect(result.priceRange?.median).toBe(250); // (200 + 300) / 2
  });

  it('provides recommendation for high confidence', async () => {
    const comparables = Array.from({ length: 10 }, (_, i) => ({
      title: `Comp ${i}`,
      soldPrice: 100 + i * 10,
    }));

    const result = await assessValue.execute({ itemId: '123', comparables });

    expect(result.recommendation).toContain('Market value likely between');
    expect(result.recommendation).toContain('median');
  });

  it('provides cautious recommendation for medium confidence', async () => {
    const comparables = Array.from({ length: 5 }, (_, i) => ({
      title: `Comp ${i}`,
      soldPrice: 100 + i * 50,
    }));

    const result = await assessValue.execute({ itemId: '123', comparables });

    expect(result.recommendation).toContain('limited data');
    expect(result.recommendation).toContain('additional opinions');
  });

  it('recommends professional appraisal for low confidence', async () => {
    const result = await assessValue.execute({
      itemId: '123',
      comparables: [
        { title: 'Comp 1', soldPrice: 100 },
        { title: 'Comp 2', soldPrice: 200 },
      ],
    });

    expect(result.recommendation).toContain('professional appraisal');
  });
});
