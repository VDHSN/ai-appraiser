/**
 * 1stDibs platform adapter.
 * Implements search and item details via their GraphQL API.
 * Note: Price history is not publicly available, returns empty results.
 */

import {
  PlatformAdapter,
  SearchQuery,
  SearchResult,
  UnifiedItem,
} from "./types";
import { RateLimiter } from "./rate-limiter";

// --- API Configuration ---

const GRAPHQL_URL = "https://www.1stdibs.com/soa/graphql/";
const PLATFORM = "1stdibs" as const;

const REQUIRED_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  Origin: "https://www.1stdibs.com",
  Referer: "https://www.1stdibs.com/",
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// Default rate limit: 4 requests per second
const DEFAULT_RATE_LIMIT = 4;

// --- GraphQL Query Definitions ---

const SEARCH_QUERY = `
query SearchBrowse($first: Int!, $uriRef: String!, $localeFilter: String) {
  searchBrowse(first: $first, uriRef: $uriRef, localeFilter: $localeFilter) {
    edges {
      node {
        serviceId
        title
        browseUrl
        localizedPdpUrl
        contemporaryTrackingData {
          price
          priceCurrency
        }
        seller {
          serviceId
          sellerProfile {
            company
          }
          sellerPreferences {
            sellerLocation {
              city
              region
            }
          }
        }
        photos(limit: 1) {
          masterOrZoomPath
          placeholder
        }
        classification {
          categories {
            name
          }
        }
      }
    }
    totalResults
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

const ITEM_DETAIL_QUERY = `
query ItemDetail($serviceId: String!) {
  item(serviceId: $serviceId) {
    serviceId
    title
    description
    browseUrl
    localizedPdpUrl
    contemporaryTrackingData {
      price
      priceCurrency
      netPrice
    }
    seller {
      serviceId
      sellerProfile {
        company
        aboutUs
      }
      sellerPreferences {
        sellerLocation {
          city
          region
          country
        }
      }
      reviewsInfo {
        averageRating
        reviewCount
      }
    }
    photos {
      masterOrZoomPath
      placeholder
      versions {
        webp {
          path
        }
      }
    }
    classification {
      categories {
        name
        urlLabel
      }
      creators {
        name
      }
    }
    measurement {
      display {
        value
        unit
      }
      convertedDisplay {
        value
        unit
      }
    }
    materials {
      name
    }
    condition {
      displayCondition
      description
    }
    provenance
    styleDisplay
    periodDisplay
  }
}
`;

// --- API Response Types (match external GraphQL shape) ---

interface FDPhoto {
  masterOrZoomPath?: string;
  placeholder?: string;
  versions?: {
    webp?: {
      path?: string;
    };
  };
}

interface FDSeller {
  serviceId?: string;
  sellerProfile?: {
    company?: string;
    aboutUs?: string;
  };
  sellerPreferences?: {
    sellerLocation?: {
      city?: string;
      region?: string;
      country?: string;
    };
  };
  reviewsInfo?: {
    averageRating?: number;
    reviewCount?: number;
  };
}

interface FDCategory {
  name?: string;
  urlLabel?: string;
}

interface FDSearchNode {
  serviceId: string;
  title?: string;
  browseUrl?: string;
  localizedPdpUrl?: string;
  contemporaryTrackingData?: {
    price?: number;
    priceCurrency?: string;
  };
  seller?: FDSeller;
  photos?: FDPhoto[];
  classification?: {
    categories?: FDCategory[];
  };
}

interface FDSearchEdge {
  node: FDSearchNode;
}

interface FDSearchResponse {
  data?: {
    searchBrowse?: {
      edges?: FDSearchEdge[];
      totalResults?: number;
      pageInfo?: {
        hasNextPage?: boolean;
        endCursor?: string;
      };
    };
  };
  errors?: Array<{ message: string }>;
}

interface FDMeasurement {
  display?: {
    value?: string;
    unit?: string;
  };
  convertedDisplay?: {
    value?: string;
    unit?: string;
  };
}

interface FDItemDetail {
  serviceId?: string;
  title?: string;
  description?: string;
  browseUrl?: string;
  localizedPdpUrl?: string;
  contemporaryTrackingData?: {
    price?: number;
    priceCurrency?: string;
    netPrice?: number;
  };
  seller?: FDSeller;
  photos?: FDPhoto[];
  classification?: {
    categories?: FDCategory[];
    creators?: Array<{ name?: string }>;
  };
  measurement?: FDMeasurement;
  materials?: Array<{ name?: string }>;
  condition?: {
    displayCondition?: string;
    description?: string;
  };
  provenance?: string;
  styleDisplay?: string;
  periodDisplay?: string;
}

interface FDItemResponse {
  data?: {
    item?: FDItemDetail;
  };
  errors?: Array<{ message: string }>;
}

// --- Pure Functions for Mapping ---

const SORT_MAP: Record<string, string> = {
  relevance: "",
  "price-asc": "&sort=price-asc",
  "price-desc": "&sort=price-desc",
  "ending-soon": "", // Not applicable for buy-now marketplace
};

/**
 * Build GraphQL search URI reference from SearchQuery.
 * 1stDibs uses URL-encoded search parameters in the uriRef variable.
 */
function buildSearchUriRef(query: SearchQuery): string {
  const parts: string[] = [];

  // Base search path
  parts.push(`/search/?q=${encodeURIComponent(query.keywords)}`);

  // Category filter
  if (query.category) {
    parts.push(`&category=${encodeURIComponent(query.category)}`);
  }

  // Price range
  if (query.priceRange) {
    if (query.priceRange.min !== undefined) {
      parts.push(`&price_min=${query.priceRange.min}`);
    }
    if (query.priceRange.max !== undefined) {
      parts.push(`&price_max=${query.priceRange.max}`);
    }
  }

  // Location filter
  if (query.location) {
    parts.push(`&seller_location=${encodeURIComponent(query.location)}`);
  }

  // Sort order
  const sortParam = SORT_MAP[query.sort ?? "relevance"];
  if (sortParam) {
    parts.push(sortParam);
  }

  return parts.join("");
}

/**
 * Build GraphQL variables for search query.
 */
function buildSearchVariables(
  query: SearchQuery,
): Record<string, string | number> {
  const pageSize = query.pageSize ?? 24;
  const uriRef = buildSearchUriRef(query);

  return {
    first: pageSize,
    uriRef,
    localeFilter: "en-US",
  };
}

/**
 * Build GraphQL request body.
 */
function buildGraphQLRequest(
  query: string,
  variables: Record<string, unknown>,
  operationName: string,
): string {
  return JSON.stringify({
    query,
    variables,
    operationName,
  });
}

/**
 * Extract image URL from photo object, preferring webp format.
 */
function extractImageUrl(photo?: FDPhoto): string {
  if (!photo) return "";
  return (
    photo.versions?.webp?.path ??
    photo.masterOrZoomPath ??
    photo.placeholder ??
    ""
  );
}

/**
 * Build full item URL from browse URL or service ID.
 */
function buildItemUrl(browseUrl?: string, serviceId?: string): string {
  if (browseUrl) {
    return browseUrl.startsWith("http")
      ? browseUrl
      : `https://www.1stdibs.com${browseUrl}`;
  }
  return `https://www.1stdibs.com/item/${serviceId ?? ""}`;
}

/**
 * Build seller location string from location parts.
 */
function buildSellerLocation(location?: {
  city?: string;
  region?: string;
  country?: string;
}): string | undefined {
  if (!location) return undefined;
  return (
    [location.city, location.region, location.country]
      .filter(Boolean)
      .join(", ") || undefined
  );
}

/**
 * Map 1stDibs search node to SearchResult.
 */
function mapSearchNode(node: FDSearchNode): SearchResult {
  const imageUrl = extractImageUrl(node.photos?.[0]);
  const price = node.contemporaryTrackingData?.price ?? 0;
  const currency = node.contemporaryTrackingData?.priceCurrency ?? "USD";

  return {
    platform: PLATFORM,
    itemId: node.serviceId,
    title: node.title ?? "",
    currentPrice: price,
    currency,
    imageUrl,
    thumbnailUrl: imageUrl,
    url: buildItemUrl(node.localizedPdpUrl ?? node.browseUrl, node.serviceId),
    auctionHouse: node.seller?.sellerProfile?.company,
    status: "online", // 1stDibs items are buy-now, always "online"
  };
}

/**
 * Build dimensions string from measurement data.
 */
function buildDimensionsString(
  measurement?: FDMeasurement,
): string | undefined {
  if (!measurement) return undefined;

  const display = measurement.display ?? measurement.convertedDisplay;
  if (!display?.value) return undefined;

  return display.unit ? `${display.value} ${display.unit}` : display.value;
}

/**
 * Build UnifiedItem from item detail response.
 */
function buildUnifiedItem(itemId: string, detail: FDItemDetail): UnifiedItem {
  const categoryNames =
    (detail.classification?.categories
      ?.map((c) => c.name)
      .filter(Boolean) as string[]) ?? [];

  const images =
    (detail.photos?.map(extractImageUrl).filter(Boolean) as string[]) ?? [];

  const materials =
    (detail.materials?.map((m) => m.name).filter(Boolean) as string[]) ?? [];

  const sellerLocation = buildSellerLocation(
    detail.seller?.sellerPreferences?.sellerLocation,
  );

  return {
    id: `fd-${itemId}`,
    platformItemId: itemId,
    platform: PLATFORM,
    url: buildItemUrl(detail.localizedPdpUrl ?? detail.browseUrl, itemId),

    title: detail.title ?? "",
    description: detail.description ?? "",
    images,
    category: categoryNames,

    currentPrice: detail.contemporaryTrackingData?.price ?? 0,
    currency: detail.contemporaryTrackingData?.priceCurrency ?? "USD",
    buyNowPrice: detail.contemporaryTrackingData?.netPrice,

    auctionType: "buy-now", // 1stDibs is a buy-now marketplace
    // No endTime or startTime for buy-now items

    seller: {
      id: detail.seller?.serviceId,
      name: detail.seller?.sellerProfile?.company ?? "Unknown",
      rating: detail.seller?.reviewsInfo?.averageRating,
      location: sellerLocation,
    },

    condition: detail.condition?.displayCondition,
    conditionNotes: detail.condition?.description,
    provenance: detail.provenance,
    dimensions: buildDimensionsString(detail.measurement),
    materials: materials.length > 0 ? materials : undefined,

    facets: {
      categories: categoryNames,
      style: detail.styleDisplay ? [detail.styleDisplay] : [],
      period: detail.periodDisplay ? [detail.periodDisplay] : [],
      creators:
        (detail.classification?.creators
          ?.map((c) => c.name)
          .filter(Boolean) as string[]) ?? [],
    },
  };
}

// --- HTTP Helper ---

export type FetchFn = typeof fetch;

async function executeGraphQL<T>(
  fetchFn: FetchFn,
  query: string,
  variables: Record<string, unknown>,
  operationName: string,
  errorContext: string,
): Promise<T> {
  const body = buildGraphQLRequest(query, variables, operationName);

  const response = await fetchFn(GRAPHQL_URL, {
    method: "POST",
    headers: REQUIRED_HEADERS,
    body,
  });

  if (!response.ok) {
    throw new Error(`${errorContext}: HTTP ${response.status}`);
  }

  const result = (await response.json()) as T & {
    errors?: Array<{ message: string }>;
  };

  if (result.errors && result.errors.length > 0) {
    throw new Error(`${errorContext}: ${result.errors[0].message}`);
  }

  return result;
}

// --- Adapter Class ---

export interface FirstDibsConfig {
  /** Custom fetch function for testing */
  fetchFn?: FetchFn;
  /** Rate limiter instance. If not provided, uses default of 4 req/s */
  rateLimiter?: RateLimiter;
  /** Requests per second (only used if rateLimiter not provided). Default: 4 */
  requestsPerSecond?: number;
}

export class FirstDibsAdapter implements PlatformAdapter {
  readonly platform = PLATFORM;
  private readonly fetchFn: FetchFn;

  constructor(config: FirstDibsConfig = {}) {
    const baseFetch = config.fetchFn ?? fetch;

    // Create rate limiter (use provided or create default)
    const limiter =
      config.rateLimiter ??
      new RateLimiter({
        requestsPerSecond: config.requestsPerSecond ?? DEFAULT_RATE_LIMIT,
      });

    // Wrap fetch with rate limiting
    this.fetchFn = async (input: RequestInfo | URL, init?: RequestInit) => {
      await limiter.acquire();
      return baseFetch(input, init);
    };
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const variables = buildSearchVariables(query);

    const response = await executeGraphQL<FDSearchResponse>(
      this.fetchFn,
      SEARCH_QUERY,
      variables,
      "SearchBrowse",
      "1stDibs search failed",
    );

    const edges = response.data?.searchBrowse?.edges ?? [];
    return edges.map((edge) => mapSearchNode(edge.node));
  }

  async getItem(itemId: string): Promise<UnifiedItem> {
    const response = await executeGraphQL<FDItemResponse>(
      this.fetchFn,
      ITEM_DETAIL_QUERY,
      { serviceId: itemId },
      "ItemDetail",
      "1stDibs item fetch failed",
    );

    const item = response.data?.item;
    if (!item) {
      throw new Error(`1stDibs item not found: ${itemId}`);
    }

    return buildUnifiedItem(itemId, item);
  }

  /**
   * Get price history for sold items.
   * Note: 1stDibs does not publicly expose sold item data.
   * Returns empty array.
   */
  async getPriceHistory(_query: SearchQuery): Promise<SearchResult[]> {
    // 1stDibs doesn't expose sold item history publicly
    return [];
  }
}

// --- Exports for Testing ---

export {
  buildSearchUriRef,
  buildSearchVariables,
  buildGraphQLRequest,
  mapSearchNode,
  buildUnifiedItem,
  buildItemUrl,
  buildSellerLocation,
  buildDimensionsString,
  extractImageUrl,
  SEARCH_QUERY,
  ITEM_DETAIL_QUERY,
  PLATFORM,
  DEFAULT_RATE_LIMIT,
  type FDSearchNode,
  type FDSearchResponse,
  type FDItemDetail,
  type FDItemResponse,
};
