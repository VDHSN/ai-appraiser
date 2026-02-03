/**
 * Simple token bucket rate limiter for API requests.
 * Ensures we don't exceed platform rate limits.
 */

import type { ILogger } from "../logging/types";

export interface RateLimiterConfig {
  /** Maximum requests per second */
  requestsPerSecond: number;
  /** Maximum burst size (bucket capacity) */
  maxBurst?: number;
  /** Optional logger for debugging rate limiting behavior */
  log?: ILogger;
}

export class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private readonly requestsPerSecond: number;
  private readonly maxBurst: number;
  private readonly log?: ILogger;

  constructor(config: RateLimiterConfig) {
    this.requestsPerSecond = config.requestsPerSecond;
    this.maxBurst = config.maxBurst ?? config.requestsPerSecond;
    this.tokens = this.maxBurst;
    this.lastRefill = Date.now();
    this.log = config.log;
  }

  /**
   * Refill tokens based on elapsed time.
   */
  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    const tokensToAdd = elapsed * this.requestsPerSecond;

    this.tokens = Math.min(this.maxBurst, this.tokens + tokensToAdd);
    this.lastRefill = now;
  }

  /**
   * Check if a request can proceed immediately.
   */
  canProceed(): boolean {
    this.refill();
    return this.tokens >= 1;
  }

  /**
   * Calculate wait time in ms until a request can proceed.
   */
  getWaitTime(): number {
    this.refill();
    if (this.tokens >= 1) return 0;

    const tokensNeeded = 1 - this.tokens;
    return Math.ceil((tokensNeeded / this.requestsPerSecond) * 1000);
  }

  /**
   * Consume a token. Returns true if successful, false if rate limited.
   */
  tryConsume(): boolean {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      this.log?.debug("Token consumed", { remainingTokens: this.tokens });
      return true;
    }
    this.log?.debug("Rate limited", { tokens: this.tokens });
    return false;
  }

  /**
   * Wait until a token is available, then consume it.
   */
  async acquire(): Promise<void> {
    const waitTime = this.getWaitTime();
    if (waitTime > 0) {
      this.log?.debug("Waiting for rate limit", {
        waitTimeMs: waitTime,
        tokens: this.tokens,
      });
      await sleep(waitTime);
    }
    this.tryConsume();
  }
}

/**
 * Helper to sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap a fetch function with rate limiting.
 */
export function createRateLimitedFetch(limiter: RateLimiter): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    await limiter.acquire();
    return fetch(input, init);
  };
}
