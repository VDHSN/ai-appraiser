/**
 * LiveAuctioneers platform adapter.
 * Implements search, item details, and price history via their undocumented API.
 */

import {
  PlatformAdapter,
  SearchQuery,
  SearchResult,
  UnifiedItem,
} from "./types";

// API endpoints
const SEARCH_URL =
  "https://search-party-prod.liveauctioneers.com/search/v4/web";
const ITEM_DETAIL_URL =
  "https://item-api-prod.liveauctioneers.com/spa/small/item-detail";
const ITEM_FACETS_URL =
  "https://item-api-prod.liveauctioneers.com/spa/small/item-facets";
const CONTENT_ITEMS_URL = "https://www.liveauctioneers.com/content/items";

const REQUIRED_HEADERS: HeadersInit = {
  Origin: "https://www.liveauctioneers.com",
  Referer: "https://www.liveauctioneers.com/",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
  Accept: "*/*",
};

/** Cache key used by LiveAuctioneers API - appears to be a static version identifier */
const CACHE_KEY = "20170802";

const PLATFORM = "liveauctioneers" as const;

// --- API Response Types (match external API shape) ---

interface LASearchParameters {
  searchTerm: string;
  page: number;
  pageSize: number;
  categories: string[];
  options: {
    status: string[];
    auctionHouse: Array<{ exclude: string[]; include: string[] }>;
  };
  ranges: Record<string, { min?: number; max?: number }>;
  buyNow: boolean;
  sort: string;
  distance: Record<string, unknown>;
  citySlug: string;
  region: string;
  saleDate: Record<string, unknown>;
  publishDate: Record<string, unknown>;
  analyticsTags: string[];
  seoSearch: boolean;
}

/** Search result item from the actual LiveAuctioneers API */
interface LASearchItem {
  itemId: number;
  title: string;
  shortDescription?: string;
  leadingBid: number;
  startPrice: number;
  currency: string;
  photos: number[];
  imageVersion?: number;
  saleStartTs: number;
  saleEndEstimatedTs?: number;
  lotEndTimeEstimatedTs?: number;
  bidCount?: number;
  sellerName: string;
  sellerId: number;
  catalogId: number;
  catalogStatus: string;
  catalogTitle?: string;
  salePrice?: number;
  lowBidEstimate?: number;
  highBidEstimate?: number;
  lotNumber?: string;
  isSold?: boolean;
  isPassed?: boolean;
  isLiveAuction?: boolean;
  isTimedAuction?: boolean;
  houseRating?: number;
  sellerCity?: string;
  sellerStateCode?: string;
  sellerCountryCode?: string;
  slug?: string;
}

/** Wrapper response from search API */
interface LASearchApiResponse {
  error: boolean;
  payload: {
    items: LASearchItem[];
    totalFound: number;
    totalPages: number;
    pageCount: number;
  };
}

interface LAItemDetail {
  lotId?: number;
  title?: string;
  description?: string;
  images?: Array<{ url: string }>;
  currentBid?: number;
  currency?: string;
  estimateLow?: number;
  estimateHigh?: number;
  buyNowPrice?: number;
  saleStart?: string;
  saleEnd?: string;
  bidCount?: number;
  lotNumber?: string;
  auctionHouse?: {
    id?: number;
    name?: string;
    rating?: number;
    location?: string;
  };
  condition?: string;
  conditionReport?: string;
  provenance?: string;
  dimensions?: string;
  materials?: string[];
  status?: string;
}

/** Response from spa/small/item-detail API */
interface LAItemDetailResponse {
  data: {
    itemDetails: LAItemDetail[];
  };
}

interface LAItemFacets {
  categories?: Array<{ id: string; name: string }>;
  materials?: string[];
  periods?: string[];
}

/** Response from content/items API - contains main item data and similar items */
interface LAContentResponse {
  error: boolean;
  payload: {
    items: LAContentItem[];
  };
}

/** Item data from content API - has most fields we need */
interface LAContentItem {
  itemId: number;
  catalogId: number;
  sellerId: number;
  sellerName: string;
  sellerCity?: string;
  sellerStateCode?: string;
  sellerCountryCode?: string;
  catalogTitle?: string;
  lotNumber?: string;
  currency: string;
  leadingBid: number;
  bidCount?: number;
  lowBidEstimate?: number;
  highBidEstimate?: number;
  photos: number[];
  imageVersion?: number;
  catalogStatus?: string;
  saleStartTs?: number;
  saleEndEstimatedTs?: number;
  title?: string;
  description?: string;
  condition?: string;
  similarItems?: LASearchItem[];
}

// --- Pure Functions for Mapping ---

const SORT_MAP: Record<string, string> = {
  relevance: "-relevance",
  "price-asc": "price",
  "price-desc": "-price",
  "ending-soon": "saleEnd",
};

function buildSearchParams(
  query: SearchQuery,
  status: string[],
): LASearchParameters {
  return {
    searchTerm: query.keywords,
    page: query.page ?? 1,
    pageSize: query.pageSize ?? 24,
    categories: query.category ? [query.category] : [],
    options: {
      status,
      auctionHouse: [{ exclude: [], include: [] }],
    },
    ranges: query.priceRange
      ? { price: { min: query.priceRange.min, max: query.priceRange.max } }
      : {},
    buyNow: false,
    sort: SORT_MAP[query.sort ?? "relevance"],
    distance: {},
    citySlug: query.location ?? "",
    region: "",
    saleDate: {},
    publishDate: {},
    analyticsTags: ["web"],
    seoSearch: false,
  };
}

function buildSearchUrl(params: LASearchParameters): string {
  const encodedParams = encodeURIComponent(JSON.stringify(params));
  return `${SEARCH_URL}?parameters=${encodedParams}&useATGSearch=true`;
}

function buildItemDetailUrl(itemId: string): string {
  return `${ITEM_DETAIL_URL}?itemIds=${itemId}&c=${CACHE_KEY}`;
}

function buildItemFacetsUrl(itemId: string): string {
  return `${ITEM_FACETS_URL}?ids=${itemId}&c=${CACHE_KEY}`;
}

function buildContentItemsUrl(itemId: string): string {
  return `${CONTENT_ITEMS_URL}?lotIds=${itemId}&identifier=item-page-main&similarItems=true&liveStateFetch=false&c=${CACHE_KEY}`;
}

function buildItemUrl(itemId: string | number): string {
  return `https://www.liveauctioneers.com/item/${itemId}`;
}

function buildImageUrl(
  sellerId: number,
  catalogId: number,
  itemId: number,
  photoIndex: number,
  imageVersion?: number,
): string {
  const version = imageVersion ?? Date.now();
  return `https://p1.liveauctioneers.com/${sellerId}/${catalogId}/${itemId}_${photoIndex}_x.jpg?version=${version}`;
}

function mapSearchStatus(item: LASearchItem): SearchResult["status"] {
  if (item.isSold) return "sold";
  if (item.isPassed) return "passed";
  if (item.catalogStatus === "live") return "live";
  if (item.catalogStatus === "online") return "online";
  if (item.catalogStatus === "upcoming") return "upcoming";
  return "online";
}

function mapSearchItem(
  item: LASearchItem,
  includeSoldData: boolean,
): SearchResult {
  const imageUrl =
    item.photos?.length > 0
      ? buildImageUrl(
          item.sellerId,
          item.catalogId,
          item.itemId,
          item.photos[0],
          item.imageVersion,
        )
      : "";

  const result: SearchResult = {
    platform: PLATFORM,
    itemId: String(item.itemId),
    title: item.title ?? "",
    currentPrice: item.leadingBid ?? item.startPrice ?? 0,
    currency: item.currency ?? "USD",
    imageUrl,
    thumbnailUrl: imageUrl,
    url: buildItemUrl(item.itemId),
    auctionHouse: item.sellerName,
    bidCount: item.bidCount,
    status: mapSearchStatus(item),
  };

  // Convert Unix timestamp to Date
  if (item.saleStartTs) {
    result.endTime = new Date(item.saleStartTs * 1000);
  } else if (item.lotEndTimeEstimatedTs) {
    result.endTime = new Date(item.lotEndTimeEstimatedTs * 1000);
  }

  if (includeSoldData && item.salePrice !== undefined && item.salePrice > 0) {
    result.soldPrice = item.salePrice;
    if (item.saleEndEstimatedTs) {
      result.soldDate = new Date(item.saleEndEstimatedTs * 1000);
    }
  }

  return result;
}

function inferAuctionType(item: LASearchItem): UnifiedItem["auctionType"] {
  if (item.isLiveAuction) return "live";
  return "timed";
}

function inferAuctionTypeFromStatus(
  status?: string,
): UnifiedItem["auctionType"] {
  if (status === "live") return "live";
  return "timed";
}

function buildUnifiedItem(
  itemId: string,
  detail: LAItemDetail,
  facets: LAItemFacets,
  content?: LAContentItem,
): UnifiedItem {
  const categoryNames = facets.categories?.map((c) => c.name) ?? [];

  // Build image URLs from content API data (more reliable than detail API)
  const images: string[] =
    detail.images?.map((img) => img.url) ??
    content?.photos?.map((photoIndex) =>
      buildImageUrl(
        content.sellerId,
        content.catalogId,
        content.itemId,
        photoIndex,
        content.imageVersion,
      ),
    ) ??
    [];

  // Build seller location from content data
  const sellerLocation = content
    ? [content.sellerCity, content.sellerStateCode, content.sellerCountryCode]
        .filter(Boolean)
        .join(", ")
    : detail.auctionHouse?.location;

  return {
    id: `la-${itemId}`,
    platformItemId: itemId,
    platform: PLATFORM,
    url: buildItemUrl(itemId),

    title: detail.title ?? content?.title ?? content?.catalogTitle ?? "",
    description: detail.description ?? content?.description ?? "",
    images,
    category: categoryNames,

    currentPrice: detail.currentBid ?? content?.leadingBid ?? 0,
    currency: detail.currency ?? content?.currency ?? "USD",
    estimateRange:
      detail.estimateLow !== undefined && detail.estimateHigh !== undefined
        ? { low: detail.estimateLow, high: detail.estimateHigh }
        : content?.lowBidEstimate !== undefined &&
            content?.highBidEstimate !== undefined
          ? { low: content.lowBidEstimate, high: content.highBidEstimate }
          : undefined,
    buyNowPrice: detail.buyNowPrice,

    auctionType: inferAuctionTypeFromStatus(
      detail.status ?? content?.catalogStatus,
    ),
    startTime: detail.saleStart
      ? new Date(detail.saleStart)
      : content?.saleStartTs
        ? new Date(content.saleStartTs * 1000)
        : undefined,
    endTime: detail.saleEnd
      ? new Date(detail.saleEnd)
      : content?.saleEndEstimatedTs
        ? new Date(content.saleEndEstimatedTs * 1000)
        : undefined,
    bidCount: detail.bidCount ?? content?.bidCount,
    lotNumber: detail.lotNumber ?? content?.lotNumber,

    seller: {
      id: detail.auctionHouse?.id?.toString() ?? content?.sellerId?.toString(),
      name: detail.auctionHouse?.name ?? content?.sellerName ?? "Unknown",
      rating: detail.auctionHouse?.rating,
      location: sellerLocation,
    },

    condition: detail.condition ?? content?.condition,
    conditionNotes: detail.conditionReport,
    provenance: detail.provenance,
    dimensions: detail.dimensions,
    materials: detail.materials ?? facets.materials,

    similarItems: content?.similarItems?.map((item) =>
      mapSearchItem(item, false),
    ),
    facets: {
      categories: categoryNames,
      periods: facets.periods ?? [],
    },
  };
}

// --- HTTP Helper ---

export type FetchFn = typeof fetch;

async function fetchJson<T>(
  fetchFn: FetchFn,
  url: string,
  errorContext: string,
): Promise<T> {
  const response = await fetchFn(url, {
    method: "GET",
    headers: REQUIRED_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`${errorContext}: ${response.status}`);
  }

  return response.json();
}

function extractItemData<T>(
  data: Record<string, T> | T | { data: { itemDetails: T[] } },
  itemId: string,
): T {
  // New format: { data: { itemDetails: [...] } }
  if (data && typeof data === "object" && "data" in data) {
    const wrapped = data as { data: { itemDetails: T[] } };
    const item = wrapped.data?.itemDetails?.find(
      (i) => String((i as { itemId?: number }).itemId) === itemId,
    );
    if (item) return item;
  }
  // Legacy format: { "itemId": {...} }
  if (data && typeof data === "object" && itemId in data) {
    return (data as Record<string, T>)[itemId];
  }
  return data as T;
}

// --- Status Filters ---

const ACTIVE_AUCTION_STATUS = ["upcoming", "live", "online"] as const;
const SOLD_ITEM_STATUS = ["sold", "passed", "done"] as const;

// --- Adapter Class ---

export interface LiveAuctioneersConfig {
  fetchFn?: FetchFn;
}

export class LiveAuctioneersAdapter implements PlatformAdapter {
  readonly platform = PLATFORM;
  private readonly fetchFn: FetchFn;

  constructor(config: LiveAuctioneersConfig = {}) {
    this.fetchFn = config.fetchFn ?? fetch;
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const params = buildSearchParams(query, [...ACTIVE_AUCTION_STATUS]);
    const url = buildSearchUrl(params);
    const response = await fetchJson<LASearchApiResponse>(
      this.fetchFn,
      url,
      "LiveAuctioneers search failed",
    );
    const items = response.payload?.items ?? [];
    return items.map((item) => mapSearchItem(item, false));
  }

  async getPriceHistory(query: SearchQuery): Promise<SearchResult[]> {
    const params = buildSearchParams(query, [...SOLD_ITEM_STATUS]);
    const url = buildSearchUrl(params);
    const response = await fetchJson<LASearchApiResponse>(
      this.fetchFn,
      url,
      "LiveAuctioneers price history failed",
    );
    const items = response.payload?.items ?? [];
    return items.map((item) => mapSearchItem(item, true));
  }

  async getItem(itemId: string): Promise<UnifiedItem> {
    const [detailRaw, facetsRaw, contentResponse] = await Promise.all([
      fetchJson<Record<string, LAItemDetail> | LAItemDetail>(
        this.fetchFn,
        buildItemDetailUrl(itemId),
        "Failed to fetch item detail",
      ),
      fetchJson<Record<string, LAItemFacets> | LAItemFacets>(
        this.fetchFn,
        buildItemFacetsUrl(itemId),
        "Failed to fetch item facets",
      ),
      fetchJson<LAContentResponse>(
        this.fetchFn,
        buildContentItemsUrl(itemId),
        "Failed to fetch content items",
      ),
    ]);

    const detail = extractItemData(detailRaw, itemId);
    const facets = extractItemData(facetsRaw, itemId);
    const contentItem = contentResponse.payload?.items?.[0];

    return buildUnifiedItem(itemId, detail, facets, contentItem);
  }
}

// --- Exports for Testing ---

export {
  buildSearchParams,
  buildSearchUrl,
  mapSearchItem,
  buildUnifiedItem,
  inferAuctionTypeFromStatus as inferAuctionType,
  ACTIVE_AUCTION_STATUS,
  SOLD_ITEM_STATUS,
  type LASearchItem,
};
