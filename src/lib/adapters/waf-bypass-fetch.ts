/**
 * WAF Bypass Fetch Wrapper
 *
 * Provides enhanced fetch capabilities to bypass Web Application Firewalls (WAFs)
 * like Incapsula/Imperva used by auction sites.
 *
 * Key features:
 * 1. Complete browser-like headers (User-Agent, Client Hints, Sec-Fetch-*)
 * 2. Cookie jar management for session persistence
 * 3. Retry logic with exponential backoff
 * 4. Session initialization support
 */

// --- Types ---

export interface WafBypassConfig {
  /** Base domain for cookie scoping (e.g., "proxibid.com") */
  domain: string;
  /** Maximum retry attempts for failed requests */
  maxRetries?: number;
  /** Base delay in ms for exponential backoff */
  baseDelayMs?: number;
  /** Optional session initialization URL to visit first */
  sessionInitUrl?: string;
  /** Custom logger function */
  logger?: (message: string) => void;
}

export interface CookieJar {
  cookies: Map<string, string>;
  set(name: string, value: string): void;
  get(name: string): string | undefined;
  getAll(): Record<string, string>;
  toCookieHeader(): string;
  parseSetCookie(setCookieHeaders: string[]): void;
  clear(): void;
}

// --- Constants ---

/**
 * Chrome browser headers that mimic a real browser session.
 * These headers are critical for bypassing WAF fingerprinting.
 */
const BROWSER_HEADERS: HeadersInit = {
  // Standard browser identification
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",

  // Accept headers
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",

  // Client Hints (Chrome's browser fingerprint)
  "sec-ch-ua":
    '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',

  // Sec-Fetch headers (browser security context)
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",

  // Connection
  "Upgrade-Insecure-Requests": "1",
  Connection: "keep-alive",
  "Cache-Control": "max-age=0",
};

/**
 * Headers for API/JSON requests (after initial session is established)
 */
const API_HEADERS: HeadersInit = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  "sec-ch-ua":
    '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
  "Sec-Fetch-Dest": "empty",
  "Sec-Fetch-Mode": "cors",
  "Sec-Fetch-Site": "same-origin",
  Connection: "keep-alive",
};

// --- Cookie Jar Implementation ---

export function createCookieJar(): CookieJar {
  const cookies = new Map<string, string>();

  return {
    cookies,

    set(name: string, value: string): void {
      cookies.set(name, value);
    },

    get(name: string): string | undefined {
      return cookies.get(name);
    },

    getAll(): Record<string, string> {
      const result: Record<string, string> = {};
      for (const [key, value] of cookies) {
        result[key] = value;
      }
      return result;
    },

    toCookieHeader(): string {
      const parts: string[] = [];
      for (const [name, value] of cookies) {
        parts.push(`${name}=${value}`);
      }
      return parts.join("; ");
    },

    parseSetCookie(setCookieHeaders: string[]): void {
      for (const header of setCookieHeaders) {
        // Parse "name=value; Path=/; ..." format
        const parts = header.split(";");
        if (parts.length > 0) {
          const [nameValue] = parts;
          const eqIndex = nameValue.indexOf("=");
          if (eqIndex > 0) {
            const name = nameValue.slice(0, eqIndex).trim();
            const value = nameValue.slice(eqIndex + 1).trim();
            cookies.set(name, value);
          }
        }
      }
    },

    clear(): void {
      cookies.clear();
    },
  };
}

// --- Helper Functions ---

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function calculateBackoff(attempt: number, baseDelayMs: number): number {
  // Exponential backoff: baseDelay * 2^attempt with jitter
  const exponentialDelay = baseDelayMs * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay; // 0-30% jitter
  return Math.min(exponentialDelay + jitter, 30000); // Cap at 30 seconds
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    // Retry on network errors, timeouts, DNS issues
    return (
      message.includes("fetch failed") ||
      message.includes("network") ||
      message.includes("timeout") ||
      message.includes("econnreset") ||
      message.includes("enotfound") ||
      message.includes("eai_again")
    );
  }
  return false;
}

function isRetryableStatus(status: number): boolean {
  // Retry on rate limits (429) and server errors (5xx)
  // But NOT on WAF blocks (403) - those need different headers, not retries
  return status === 429 || (status >= 500 && status < 600);
}

function isWafBlocked(status: number, text?: string): boolean {
  if (status === 403) return true;

  if (text) {
    const lower = text.toLowerCase();
    return (
      lower.includes("incapsula") ||
      lower.includes("access denied") ||
      lower.includes("blocked") ||
      (lower.includes("<!doctype") && lower.includes("error"))
    );
  }

  return false;
}

// --- WAF Bypass Fetch Factory ---

export interface WafBypassFetch {
  /** Make a request with WAF bypass headers and cookie management */
  fetch: typeof fetch;
  /** Get the cookie jar for inspection */
  getCookieJar(): CookieJar;
  /** Initialize a session by visiting the base URL */
  initSession(): Promise<void>;
  /** Check if session is initialized */
  isSessionInitialized(): boolean;
}

export function createWafBypassFetch(config: WafBypassConfig): WafBypassFetch {
  const cookieJar = createCookieJar();
  let sessionInitialized = false;

  const maxRetries = config.maxRetries ?? 3;
  const baseDelayMs = config.baseDelayMs ?? 1000;
  const logger = config.logger ?? console.warn;

  /**
   * Initialize session by visiting the main page to collect cookies
   */
  async function initSession(): Promise<void> {
    const initUrl = config.sessionInitUrl ?? `https://www.${config.domain}/`;

    logger(`[WAF] Initializing session with ${initUrl}`);

    try {
      const response = await fetch(initUrl, {
        method: "GET",
        headers: {
          ...BROWSER_HEADERS,
          Referer: `https://www.${config.domain}/`,
        },
        redirect: "follow",
      });

      // Extract cookies from response
      const setCookies = response.headers.getSetCookie?.() ?? [];
      if (setCookies.length > 0) {
        cookieJar.parseSetCookie(setCookies);
        logger(`[WAF] Session cookies collected: ${setCookies.length}`);
      }

      sessionInitialized = true;
    } catch (error) {
      logger(
        `[WAF] Session init failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      // Don't throw - we'll try requests anyway
    }
  }

  /**
   * Enhanced fetch with WAF bypass capabilities
   */
  async function wafFetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> {
    const url = typeof input === "string" ? input : input.toString();

    // Build headers
    const isApiRequest =
      url.includes("/asp/") || url.includes("/api/") || url.includes(".asp");
    const baseHeaders = isApiRequest ? API_HEADERS : BROWSER_HEADERS;

    const headers: HeadersInit = {
      ...baseHeaders,
      Referer: `https://www.${config.domain}/`,
      Origin: `https://www.${config.domain}`,
      ...init?.headers,
    };

    // Add cookies if we have any
    const cookieHeader = cookieJar.toCookieHeader();
    if (cookieHeader) {
      (headers as Record<string, string>)["Cookie"] = cookieHeader;
    }

    // Retry loop with exponential backoff
    let lastError: Error | undefined;
    let lastResponse: Response | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const delay = calculateBackoff(attempt - 1, baseDelayMs);
          logger(
            `[WAF] Retry attempt ${attempt}/${maxRetries} after ${delay}ms`,
          );
          await sleep(delay);
        }

        const response = await fetch(input, {
          ...init,
          headers,
          redirect: "follow",
        });

        // Collect any new cookies
        const setCookies = response.headers.getSetCookie?.() ?? [];
        if (setCookies.length > 0) {
          cookieJar.parseSetCookie(setCookies);
        }

        // Check if we should retry
        if (isRetryableStatus(response.status) && attempt < maxRetries) {
          lastResponse = response;
          logger(`[WAF] Retryable status ${response.status}, will retry`);
          continue;
        }

        // Check for WAF block
        if (isWafBlocked(response.status)) {
          const text = await response.text();
          if (isWafBlocked(response.status, text)) {
            logger(`[WAF] Blocked by WAF (status ${response.status})`);
            // Return a new response with the text we already read
            return new Response(text, {
              status: response.status,
              statusText: response.statusText,
              headers: response.headers,
            });
          }
          // If not actually blocked, return a new response with the text
          return new Response(text, {
            status: response.status,
            statusText: response.statusText,
            headers: response.headers,
          });
        }

        return response;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (!isRetryableError(error) || attempt >= maxRetries) {
          throw lastError;
        }

        logger(`[WAF] Request failed: ${lastError.message}`);
      }
    }

    // If we exhausted retries, throw or return last response
    if (lastResponse) {
      return lastResponse;
    }
    throw lastError ?? new Error("Request failed after retries");
  }

  return {
    fetch: wafFetch,
    getCookieJar: () => cookieJar,
    initSession,
    isSessionInitialized: () => sessionInitialized,
  };
}

// --- Convenience: Create a fetch function with session init ---

export interface CreateSessionFetchOptions extends WafBypassConfig {
  /** Whether to auto-initialize session on first request */
  autoInitSession?: boolean;
}

export function createSessionFetch(
  options: CreateSessionFetchOptions,
): typeof fetch {
  const wafBypass = createWafBypassFetch(options);
  let initPromise: Promise<void> | null = null;

  return async (
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response> => {
    // Auto-init session if configured and not yet done
    if (options.autoInitSession && !wafBypass.isSessionInitialized()) {
      if (!initPromise) {
        initPromise = wafBypass.initSession();
      }
      await initPromise;
    }

    return wafBypass.fetch(input, init);
  };
}
