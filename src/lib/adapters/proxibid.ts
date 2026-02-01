/**
 * ProxiBid platform adapter.
 * Implements search, item details (via HTML scraping), and price history.
 *
 * ## WAF Behavior (Incapsula/Imperva)
 *
 * Proxibid uses Incapsula WAF which requires JavaScript challenge completion
 * before allowing API access. Direct fetch/curl calls will be blocked (403)
 * unless the client has completed the JS challenge in a browser session.
 *
 * When blocked, the adapter returns empty results rather than throwing errors,
 * allowing the application to gracefully degrade.
 *
 * For reliable access, consider:
 * 1. A background worker with headless browser to pre-fetch and cache results
 * 2. Using the Proxibid website directly for real-time searches
 */

import { JSDOM } from "jsdom";

// --- Custom Error Types ---

export class ProxibidBlockedError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
  ) {
    super(message);
    this.name = "ProxibidBlockedError";
  }
}

export class ProxibidParseError extends Error {
  constructor(
    message: string,
    public readonly rawContent?: string,
  ) {
    super(message);
    this.name = "ProxibidParseError";
  }
}

export class ProxibidServerError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ProxibidServerError";
  }
}
import {
  PlatformAdapter,
  SearchQuery,
  SearchResult,
  UnifiedItem,
} from "./types";

// API endpoints
const SEARCH_URL = "https://www.proxibid.com/asp/SearchBuilder.asp";
const BASE_URL = "https://www.proxibid.com";
const IMAGE_BASE_URL = "https://images.proxibid.com/AuctionImages";

// Minimal headers - Proxibid works with bare requests
const REQUIRED_HEADERS: HeadersInit = {};

const PLATFORM = "proxibid" as const;

// --- API Response Types ---

interface PBSearchResponse {
  item: PBSearchItem[];
  totalResultCount: number;
  pageLength?: number;
  pageNumber?: number;
}

interface PBSearchItem {
  meta: PBLotMeta;
}

interface PBLotMeta {
  LotID: number;
  LotTitle: string;
  CurrentHighBid?: number;
  Price?: number;
  CurrencyAbbrv?: string;
  LotImage?: string;
  LotEndDateTime?: string;
  AuctionHouseID?: number;
  CompanyName?: string;
  CityState?: string;
  AuctionType?: string;
  LotNumber?: string;
  AuctionID?: number;
  BidCount?: number;
  LowEstimate?: number;
  HighEstimate?: number;
  Description?: string;
  Slug?: string;
}

// HTML scraping result
interface ScrapedItemDetail {
  description: string;
  images: string[];
  categories: string[];
}

// --- Sort Mapping ---

const SORT_MAP: Record<string, string> = {
  relevance: "relevance",
  "price-asc": "price",
  "price-desc": "price-desc",
  "ending-soon": "end",
};

// --- Pure Functions ---

export function buildSearchUrl(query: SearchQuery, status?: "closed"): string {
  const params = new URLSearchParams({
    searchid: "0",
    type: "lot",
    search: query.keywords,
    sort: SORT_MAP[query.sort ?? "relevance"],
    length: String(query.pageSize ?? 25),
    start: String(((query.page ?? 1) - 1) * (query.pageSize ?? 25)),
  });

  if (status === "closed") {
    params.set("asvt", "closed");
  }

  return `${SEARCH_URL}?${params.toString()}`;
}

export function buildImageUrl(
  auctionHouseId: number,
  auctionId: number,
  filename: string,
  size: "FullSize" | "FILarge" | "FIMedium" | "Thumb" = "FullSize",
): string {
  return `${IMAGE_BASE_URL}/${auctionHouseId}/${auctionId}/${size}/${filename}`;
}

export function buildProxiedImageUrl(rawUrl: string): string {
  return `/api/image?url=${encodeURIComponent(rawUrl)}`;
}

export function buildItemUrl(lotId: number | string, slug?: string): string {
  const pathSlug = slug || "lot";
  return `${BASE_URL}/${pathSlug}/lotInformation/${lotId}`;
}

export function parsePBDate(dateStr: string): Date {
  // US format: "1/28/2026 15:54:00"
  const [datePart, timePart] = dateStr.split(" ");
  if (!datePart || !timePart) {
    return new Date(dateStr); // Fallback to native parsing
  }
  const [month, day, year] = datePart.split("/").map(Number);
  const [hours, minutes, seconds] = timePart.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, seconds);
}

export function extractCategoriesFromTitle(title: string): string[] {
  // Title format: "Lot Title | Category1  Category2 | Online Auctions | Proxibid"
  const parts = title.split("|").map((p) => p.trim());
  if (parts.length >= 3) {
    // Categories are in the second segment, space-separated
    const categoryPart = parts[1];
    return categoryPart.split(/\s{2,}/).filter(Boolean);
  }
  return [];
}

export function scrapeItemDetail(html: string): ScrapedItemDetail {
  const dom = new JSDOM(html);
  const doc = dom.window.document;

  // Get description
  const descEl = doc.querySelector("#lotDescription");
  const description = descEl?.textContent?.trim() ?? "";

  // Get all images
  const images = Array.from(
    doc.querySelectorAll<HTMLImageElement>("img[src*=AuctionImages]"),
  )
    .map((img) => img.getAttribute("src"))
    .filter((src): src is string => Boolean(src));

  // Get categories from title
  const categories = extractCategoriesFromTitle(doc.title || "");

  return { description, images, categories };
}

export function mapSearchItem(
  meta: PBLotMeta,
  includeSoldData: boolean,
): SearchResult {
  // Build image URL if we have the required data
  let imageUrl = "";
  if (meta.LotImage && meta.AuctionHouseID && meta.AuctionID) {
    const rawUrl = buildImageUrl(
      meta.AuctionHouseID,
      meta.AuctionID,
      meta.LotImage,
      "FILarge",
    );
    imageUrl = buildProxiedImageUrl(rawUrl);
  }

  const result: SearchResult = {
    platform: PLATFORM,
    itemId: String(meta.LotID),
    title: meta.LotTitle ?? "",
    currentPrice: meta.CurrentHighBid ?? meta.Price ?? 0,
    currency: meta.CurrencyAbbrv ?? "USD",
    imageUrl,
    thumbnailUrl: imageUrl,
    url: buildItemUrl(meta.LotID, meta.Slug),
    auctionHouse: meta.CompanyName,
    bidCount: meta.BidCount,
    status: includeSoldData ? "sold" : "online",
  };

  if (meta.LotEndDateTime) {
    result.endTime = parsePBDate(meta.LotEndDateTime);
  }

  if (includeSoldData && meta.Price !== undefined && meta.Price > 0) {
    result.soldPrice = meta.Price;
    if (meta.LotEndDateTime) {
      result.soldDate = parsePBDate(meta.LotEndDateTime);
    }
  }

  return result;
}

function inferAuctionType(auctionType?: string): UnifiedItem["auctionType"] {
  if (auctionType?.toLowerCase() === "live") return "live";
  return "timed";
}

function buildUnifiedItem(
  meta: PBLotMeta,
  scraped: ScrapedItemDetail,
): UnifiedItem {
  // Proxy all images
  const images = scraped.images.map((url) =>
    url.startsWith("http") ? buildProxiedImageUrl(url) : url,
  );

  // Build seller location
  const sellerLocation = meta.CityState ?? undefined;

  return {
    id: `pb-${meta.LotID}`,
    platformItemId: String(meta.LotID),
    platform: PLATFORM,
    url: buildItemUrl(meta.LotID, meta.Slug),

    title: meta.LotTitle ?? "",
    description: scraped.description || meta.Description || "",
    images,
    category: scraped.categories,

    currentPrice: meta.CurrentHighBid ?? meta.Price ?? 0,
    currency: meta.CurrencyAbbrv ?? "USD",
    estimateRange:
      meta.LowEstimate !== undefined && meta.HighEstimate !== undefined
        ? { low: meta.LowEstimate, high: meta.HighEstimate }
        : undefined,

    auctionType: inferAuctionType(meta.AuctionType),
    endTime: meta.LotEndDateTime ? parsePBDate(meta.LotEndDateTime) : undefined,
    bidCount: meta.BidCount,
    lotNumber: meta.LotNumber,

    seller: {
      id: meta.AuctionHouseID?.toString(),
      name: meta.CompanyName ?? "Unknown",
      location: sellerLocation,
    },

    facets: {
      categories: scraped.categories,
    },
  };
}

// --- HTTP Helper ---

export type FetchFn = typeof fetch;

function isHtmlContent(text: string): boolean {
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed.startsWith("<!doctype") ||
    trimmed.startsWith("<html") ||
    trimmed.includes("<head>") ||
    trimmed.includes("incapsula")
  );
}

function isBlockedResponse(status: number, text?: string): boolean {
  if (status === 403 || status === 429) return true;
  if (text && isHtmlContent(text)) return true;
  return false;
}

function isServerError(status: number): boolean {
  return status >= 500 && status < 600;
}

async function fetchJson<T>(
  fetchFn: FetchFn,
  url: string,
  errorContext: string,
): Promise<T> {
  const response = await fetchFn(url, {
    method: "GET",
    headers: REQUIRED_HEADERS,
  });

  const text = await response.text();

  if (!response.ok) {
    if (isBlockedResponse(response.status, text)) {
      throw new ProxibidBlockedError(
        `${errorContext}: blocked by WAF (${response.status})`,
        response.status,
      );
    }
    if (isServerError(response.status)) {
      throw new ProxibidServerError(
        `${errorContext}: server error (${response.status})`,
        response.status,
      );
    }
    throw new Error(`${errorContext}: ${response.status}`);
  }

  // Check for HTML response even on 200 (WAF can return 200 with block page)
  if (isHtmlContent(text)) {
    throw new ProxibidBlockedError(
      `${errorContext}: received HTML instead of JSON (likely blocked)`,
      response.status,
    );
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProxibidParseError(
      `${errorContext}: invalid JSON response`,
      text.slice(0, 500),
    );
  }
}

async function fetchHtml(
  fetchFn: FetchFn,
  url: string,
  errorContext: string,
): Promise<string> {
  const response = await fetchFn(url, {
    method: "GET",
    headers: REQUIRED_HEADERS,
  });

  if (!response.ok) {
    throw new Error(`${errorContext}: ${response.status}`);
  }

  return response.text();
}

// --- Response Validation ---

function validateSearchResponse(data: unknown): PBSearchResponse {
  if (data === null || typeof data !== "object") {
    return { item: [], totalResultCount: 0 };
  }

  const obj = data as Record<string, unknown>;

  // Validate item array exists and has expected structure
  if (!Array.isArray(obj.item)) {
    return { item: [], totalResultCount: 0 };
  }

  // Filter to only valid items with meta property
  const validItems = obj.item.filter(
    (item): item is PBSearchItem =>
      item !== null &&
      typeof item === "object" &&
      "meta" in item &&
      item.meta !== null &&
      typeof item.meta === "object" &&
      "LotID" in item.meta,
  );

  return {
    item: validItems,
    totalResultCount:
      typeof obj.totalResultCount === "number" ? obj.totalResultCount : 0,
    pageLength: typeof obj.pageLength === "number" ? obj.pageLength : undefined,
    pageNumber: typeof obj.pageNumber === "number" ? obj.pageNumber : undefined,
  };
}

// --- Adapter Class ---

export interface ProxiBidConfig {
  fetchFn?: FetchFn;
  logger?: (message: string) => void;
}

export class ProxiBidAdapter implements PlatformAdapter {
  readonly platform = PLATFORM;
  private readonly fetchFn: FetchFn;
  private readonly logger: (message: string) => void;

  constructor(config: ProxiBidConfig = {}) {
    this.fetchFn = config.fetchFn ?? fetch;
    this.logger = config.logger ?? console.warn;
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    const url = buildSearchUrl(query);

    try {
      const rawResponse = await fetchJson<unknown>(
        this.fetchFn,
        url,
        "ProxiBid search failed",
      );
      const response = validateSearchResponse(rawResponse);
      return response.item.map((item) => mapSearchItem(item.meta, false));
    } catch (error) {
      if (error instanceof ProxibidBlockedError) {
        this.logger(`ProxiBid search blocked: ${error.message}`);
        return [];
      }
      if (error instanceof ProxibidParseError) {
        this.logger(`ProxiBid search parse error: ${error.message}`);
        return [];
      }
      if (error instanceof ProxibidServerError) {
        this.logger(`ProxiBid search server error: ${error.message}`);
        return [];
      }
      throw error;
    }
  }

  async getPriceHistory(query: SearchQuery): Promise<SearchResult[]> {
    const url = buildSearchUrl(query, "closed");

    try {
      const rawResponse = await fetchJson<unknown>(
        this.fetchFn,
        url,
        "ProxiBid price history failed",
      );
      const response = validateSearchResponse(rawResponse);
      return response.item.map((item) => mapSearchItem(item.meta, true));
    } catch (error) {
      if (error instanceof ProxibidBlockedError) {
        this.logger(`ProxiBid price history blocked: ${error.message}`);
        return [];
      }
      if (error instanceof ProxibidParseError) {
        this.logger(`ProxiBid price history parse error: ${error.message}`);
        return [];
      }
      if (error instanceof ProxibidServerError) {
        this.logger(`ProxiBid price history server error: ${error.message}`);
        return [];
      }
      throw error;
    }
  }

  async getItem(itemId: string): Promise<UnifiedItem> {
    // First, search for the item to get metadata
    const searchUrl = buildSearchUrl({ keywords: itemId, pageSize: 1 });
    const rawResponse = await fetchJson<unknown>(
      this.fetchFn,
      searchUrl,
      "ProxiBid item search failed",
    );
    const searchResponse = validateSearchResponse(rawResponse);

    const item = searchResponse.item.find(
      (i) => String(i.meta.LotID) === itemId,
    );

    if (!item) {
      throw new Error(`Item not found: ${itemId}`);
    }

    const meta = item.meta;

    // Fetch the detail page for scraping
    const detailUrl = buildItemUrl(meta.LotID, meta.Slug);
    let scraped: ScrapedItemDetail;

    try {
      const html = await fetchHtml(
        this.fetchFn,
        detailUrl,
        "Failed to fetch item detail page",
      );
      scraped = scrapeItemDetail(html);
    } catch {
      // If scraping fails, use empty defaults
      scraped = { description: "", images: [], categories: [] };
    }

    return buildUnifiedItem(meta, scraped);
  }
}

// --- Exports for Testing ---

export {
  type PBSearchResponse,
  type PBSearchItem,
  type PBLotMeta,
  type ScrapedItemDetail,
  isHtmlContent,
  isBlockedResponse,
  isServerError,
  validateSearchResponse,
};
