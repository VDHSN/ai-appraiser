/**
 * Core types for the platform adapter layer.
 * Provides a unified interface across auction platforms.
 */

export interface SearchQuery {
  keywords: string;
  category?: string;
  priceRange?: { min?: number; max?: number };
  condition?: string[];
  endingSoon?: boolean;
  location?: string;
  page?: number;
  pageSize?: number;
  sort?: 'relevance' | 'price-asc' | 'price-desc' | 'ending-soon';
}

export interface SearchResult {
  platform: string;
  itemId: string;
  title: string;
  currentPrice: number;
  currency: string;
  imageUrl: string;
  thumbnailUrl?: string;
  endTime?: Date;
  bidCount?: number;
  url: string;
  auctionHouse?: string;
  status?: 'upcoming' | 'live' | 'online' | 'sold' | 'passed' | 'done';
  soldPrice?: number;
  soldDate?: Date;
}

export interface UnifiedItem {
  id: string;
  platformItemId: string;
  platform: string;
  url: string;

  title: string;
  description: string;
  images: string[];
  category: string[];

  currentPrice: number;
  currency: string;
  estimateRange?: { low: number; high: number };
  buyNowPrice?: number;

  auctionType: 'timed' | 'live' | 'buy-now';
  endTime?: Date;
  startTime?: Date;
  bidCount?: number;
  lotNumber?: string;

  seller: {
    id?: string;
    name: string;
    rating?: number;
    location?: string;
  };

  condition?: string;
  conditionNotes?: string;
  provenance?: string;
  dimensions?: string;
  materials?: string[];

  similarItems?: SearchResult[];
  facets?: Record<string, string[]>;
}

export interface WatchResult {
  success: boolean;
  itemId: string;
  watchedAt: Date;
}

export interface BidHistory {
  bidder: string;
  amount: number;
  currency: string;
  timestamp: Date;
}

/**
 * Interface for platform adapters.
 * Each platform (LiveAuctioneers, eBay, etc.) implements this interface.
 */
export interface PlatformAdapter {
  readonly platform: string;

  /** Search for active auction items. */
  search(query: SearchQuery): Promise<SearchResult[]>;

  /** Get full details for a specific item. */
  getItem(itemId: string): Promise<UnifiedItem>;

  /** Search sold/completed items for price history. */
  getPriceHistory(query: SearchQuery): Promise<SearchResult[]>;

  /** Optional: Add item to watch list. */
  watchItem?(itemId: string): Promise<WatchResult>;

  /** Optional: Get bid history for an item. */
  getBidHistory?(itemId: string): Promise<BidHistory[]>;
}
