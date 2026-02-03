/**
 * 1stDibs platform adapter.
 * Implements search via GraphQL API and item details via JSON-LD fallback.
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

const BASE_URL = "https://www.1stdibs.com";
const GRAPHQL_URL = "https://www.1stdibs.com/soa/graphql/";
const PLATFORM = "1stdibs" as const;

const HTML_HEADERS: HeadersInit = {
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

const GRAPHQL_HEADERS: HeadersInit = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

// Default rate limit: 2 requests per second (be conservative)
const DEFAULT_RATE_LIMIT = 2;

// --- GraphQL Query & Types ---

const SEARCH_QUERY = `
query ItemSearch($uriRef: String!, $first: Int!) {
  viewer {
    itemSearch(uriRef: $uriRef, first: $first) {
      totalResults
      edges {
        node {
          item {
            serviceId
            title
            pdpURL
            firstPhotoWebPath(size: small)
            pricing {
              amount {
                amount
                currency
              }
            }
            seller {
              id
            }
          }
        }
      }
    }
  }
}
`;

const ITEM_DETAIL_QUERY = `
query ItemDetail($id: ID!) {
  node(id: $id) {
    ... on Item {
      serviceId
      title
      pdpURL
      description
      firstPhotoWebPath(size: large)
      photos {
        webPath(size: large)
      }
      pricing {
        amount {
          amount
          currency
        }
      }
      seller {
        id
        displayName
      }
      categories {
        name
      }
    }
  }
}
`;

interface GraphQLItem {
  serviceId: string;
  title: string;
  pdpURL: string;
  firstPhotoWebPath: string | null;
  pricing: {
    amount: {
      amount: number;
      currency: string;
    };
  } | null;
  seller: {
    id: string;
  } | null;
}

interface GraphQLItemDetail {
  serviceId: string;
  title: string;
  pdpURL: string;
  description: string | null;
  firstPhotoWebPath: string | null;
  photos: Array<{ webPath: string }> | null;
  pricing: {
    amount: {
      amount: number;
      currency: string;
    };
  } | null;
  seller: {
    id: string;
    displayName: string | null;
  } | null;
  categories: Array<{ name: string }> | null;
}

interface GraphQLSearchResponse {
  data: {
    viewer: {
      itemSearch: {
        totalResults: number;
        edges: Array<{
          node: {
            item: GraphQLItem;
          };
        }>;
      };
    };
  } | null;
  errors?: Array<{ message: string }>;
}

interface GraphQLItemResponse {
  data: {
    node: GraphQLItemDetail | null;
  } | null;
  errors?: Array<{ message: string }>;
}

// --- JSON-LD Types (for item detail fallback) ---

interface JsonLdOffer {
  "@type": "Offer";
  price: number;
  priceCurrency: string;
  availability?: string;
}

interface JsonLdBrand {
  "@type": "Brand";
  name: string;
}

interface JsonLdImageObject {
  "@type": "ImageObject";
  contentUrl: string;
  thumbnailUrl?: string;
  author?: string;
  caption?: string;
}

interface JsonLdProduct {
  "@type": "Product";
  name: string;
  url: string;
  description?: string;
  image?: string | JsonLdImageObject | JsonLdImageObject[];
  offers?: JsonLdOffer;
  brand?: JsonLdBrand;
}

type JsonLdData = JsonLdProduct | Record<string, unknown>;

// --- Pure Functions for GraphQL ---

/**
 * Build the uriRef parameter for GraphQL search from SearchQuery.
 */
function buildSearchUriRef(query: SearchQuery): string {
  const params = new URLSearchParams();
  params.set("q", query.keywords);

  if (query.priceRange?.min !== undefined) {
    params.set("price_min", String(query.priceRange.min));
  }
  if (query.priceRange?.max !== undefined) {
    params.set("price_max", String(query.priceRange.max));
  }
  if (query.sort && query.sort !== "relevance") {
    params.set("sort", query.sort);
  }
  if (query.category) {
    params.set("category", query.category);
  }
  if (query.location) {
    params.set("seller_location", query.location);
  }

  return `/search/?${params.toString()}`;
}

/**
 * Extract numeric item ID from serviceId.
 * serviceId format: "f_12345" -> returns "12345"
 */
function extractItemIdFromServiceId(serviceId: string): string {
  return serviceId.replace(/^f_/, "");
}

/**
 * Map GraphQL item to SearchResult.
 */
function mapGraphQLItemToSearchResult(item: GraphQLItem): SearchResult {
  const imageUrl = item.firstPhotoWebPath ?? "";

  return {
    platform: PLATFORM,
    itemId: extractItemIdFromServiceId(item.serviceId),
    title: item.title,
    currentPrice: item.pricing?.amount.amount ?? 0,
    currency: item.pricing?.amount.currency ?? "USD",
    imageUrl,
    thumbnailUrl: imageUrl,
    url: `${BASE_URL}${item.pdpURL}`,
    status: "online",
  };
}

/**
 * Map GraphQL item detail to UnifiedItem.
 */
function mapGraphQLItemDetailToUnifiedItem(
  item: GraphQLItemDetail,
): UnifiedItem {
  const itemId = extractItemIdFromServiceId(item.serviceId);
  const images = item.photos?.map((p) => p.webPath) ?? [];
  if (item.firstPhotoWebPath && !images.includes(item.firstPhotoWebPath)) {
    images.unshift(item.firstPhotoWebPath);
  }

  return {
    id: `fd-${itemId}`,
    platformItemId: itemId,
    platform: PLATFORM,
    url: `${BASE_URL}${item.pdpURL}`,

    title: item.title,
    description: item.description ?? "",
    images,
    category: item.categories?.map((c) => c.name) ?? [],

    currentPrice: item.pricing?.amount.amount ?? 0,
    currency: item.pricing?.amount.currency ?? "USD",

    auctionType: "buy-now",

    seller: {
      name: item.seller?.displayName ?? "Unknown",
    },

    facets: {
      categories: item.categories?.map((c) => c.name) ?? [],
      style: [],
      period: [],
      creators: item.seller?.displayName ? [item.seller.displayName] : [],
    },
  };
}

/**
 * Encode item ID to GraphQL global ID.
 */
function encodeItemGlobalId(itemId: string): string {
  return btoa(`Item:f_${itemId}`);
}

// --- Pure Functions for URL Building (legacy, kept for buildItemUrl) ---

/**
 * Build item detail URL from item ID.
 */
function buildItemUrl(itemId: string): string {
  return `${BASE_URL}/item/id-f_${itemId}/`;
}

// --- JSON-LD Extraction (for item detail fallback) ---

/**
 * Extract JSON-LD data from HTML content.
 */
function extractJsonLd(html: string): JsonLdData[] {
  const results: JsonLdData[] = [];
  const regex =
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi;

  let match;
  while ((match = regex.exec(html)) !== null) {
    try {
      const data = JSON.parse(match[1]) as JsonLdData | JsonLdData[];
      if (Array.isArray(data)) {
        results.push(...data);
      } else {
        results.push(data);
      }
    } catch {
      // Skip invalid JSON
    }
  }

  return results;
}

/**
 * Extract item ID from 1stDibs URL.
 */
function extractItemId(url: string): string {
  const match = url.match(/id-f_(\d+)/);
  return match ? match[1] : "";
}

/**
 * Extract image URL from JSON-LD image field.
 */
function extractImageFromJsonLd(
  image: string | JsonLdImageObject | JsonLdImageObject[] | undefined,
): string {
  if (!image) return "";
  if (typeof image === "string") return image;
  if (Array.isArray(image)) {
    return image[0]?.contentUrl ?? "";
  }
  return image.contentUrl ?? "";
}

/**
 * Extract all image URLs from JSON-LD image field.
 */
function extractAllImagesFromJsonLd(
  image: string | JsonLdImageObject | JsonLdImageObject[] | undefined,
): string[] {
  if (!image) return [];
  if (typeof image === "string") return [image];
  if (Array.isArray(image)) {
    return image.map((img) => img.contentUrl).filter(Boolean);
  }
  return image.contentUrl ? [image.contentUrl] : [];
}

/**
 * Extract item detail from JSON-LD Product data.
 */
function extractItemDetail(jsonLdData: JsonLdData[]): JsonLdProduct | null {
  for (const data of jsonLdData) {
    if (
      typeof data === "object" &&
      data !== null &&
      "@type" in data &&
      (data as { "@type": string })["@type"] === "Product"
    ) {
      return data as JsonLdProduct;
    }
  }
  return null;
}

/**
 * Map JSON-LD Product to UnifiedItem.
 */
function mapProductToUnifiedItem(product: JsonLdProduct): UnifiedItem {
  const itemId = extractItemId(product.url);
  const images = extractAllImagesFromJsonLd(product.image);
  const url = product.url.startsWith("http")
    ? product.url
    : `${BASE_URL}${product.url}`;

  return {
    id: `fd-${itemId}`,
    platformItemId: itemId,
    platform: PLATFORM,
    url,

    title: product.name,
    description: product.description ?? "",
    images,
    category: [],

    currentPrice: product.offers?.price ?? 0,
    currency: product.offers?.priceCurrency ?? "USD",

    auctionType: "buy-now",

    seller: {
      name: product.brand?.name ?? "Unknown",
    },

    facets: {
      categories: [],
      style: [],
      period: [],
      creators: product.brand?.name ? [product.brand.name] : [],
    },
  };
}

// --- HTTP Helpers ---

export type FetchFn = typeof fetch;

async function fetchHtml(
  fetchFn: FetchFn,
  url: string,
  errorContext: string,
): Promise<string> {
  const response = await fetchFn(url, {
    method: "GET",
    headers: HTML_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`${errorContext}: HTTP ${response.status}`);
  }

  return response.text();
}

async function fetchGraphQL<T>(
  fetchFn: FetchFn,
  query: string,
  variables: Record<string, unknown>,
  errorContext: string,
): Promise<T> {
  const response = await fetchFn(GRAPHQL_URL, {
    method: "POST",
    headers: GRAPHQL_HEADERS,
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    throw new Error(`${errorContext}: HTTP ${response.status}`);
  }

  const data = (await response.json()) as T & {
    errors?: Array<{ message: string }>;
  };
  if (data.errors && data.errors.length > 0) {
    throw new Error(`${errorContext}: ${data.errors[0].message}`);
  }

  return data;
}

// --- Adapter Class ---

export interface FirstDibsConfig {
  /** Custom fetch function for testing */
  fetchFn?: FetchFn;
  /** Rate limiter instance. If not provided, uses default of 2 req/s */
  rateLimiter?: RateLimiter;
  /** Requests per second (only used if rateLimiter not provided). Default: 2 */
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
    const uriRef = buildSearchUriRef(query);
    const pageSize = query.pageSize ?? 24;

    const response = await fetchGraphQL<GraphQLSearchResponse>(
      this.fetchFn,
      SEARCH_QUERY,
      { uriRef, first: pageSize },
      "1stDibs search failed",
    );

    if (!response.data?.viewer?.itemSearch?.edges) {
      return [];
    }

    return response.data.viewer.itemSearch.edges.map((edge) =>
      mapGraphQLItemToSearchResult(edge.node.item),
    );
  }

  async getItem(itemId: string): Promise<UnifiedItem> {
    // Try GraphQL first
    const globalId = encodeItemGlobalId(itemId);

    try {
      const response = await fetchGraphQL<GraphQLItemResponse>(
        this.fetchFn,
        ITEM_DETAIL_QUERY,
        { id: globalId },
        "1stDibs item fetch failed",
      );

      if (response.data?.node) {
        return mapGraphQLItemDetailToUnifiedItem(response.data.node);
      }
    } catch {
      // Fall through to HTML/JSON-LD fallback
    }

    // Fallback: try HTML with JSON-LD parsing
    const directUrl = buildItemUrl(itemId);
    const html = await fetchHtml(
      this.fetchFn,
      directUrl,
      `1stDibs item not found: ${itemId}`,
    );
    const jsonLdData = extractJsonLd(html);
    const product = extractItemDetail(jsonLdData);

    if (!product) {
      throw new Error(`1stDibs item not found: ${itemId}`);
    }

    return mapProductToUnifiedItem(product);
  }

  /**
   * Get price history for sold items.
   * Note: 1stDibs does not publicly expose sold item data.
   * Returns empty array.
   */
  async getPriceHistory(_query: SearchQuery): Promise<SearchResult[]> {
    return [];
  }
}

// --- Exports for Testing ---

export {
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
  SEARCH_QUERY,
  ITEM_DETAIL_QUERY,
  type GraphQLItem,
  type GraphQLItemDetail,
  type GraphQLSearchResponse,
  type GraphQLItemResponse,
  type JsonLdProduct,
  type JsonLdOffer,
  type JsonLdBrand,
  type JsonLdImageObject,
};
