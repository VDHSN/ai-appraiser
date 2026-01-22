import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { RateLimiter, createRateLimitedFetch } from "../rate-limiter";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("constructor", () => {
    it("initializes with full bucket", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 2 });
      expect(limiter.canProceed()).toBe(true);
    });

    it("uses requestsPerSecond as default maxBurst", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 3 });
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(false);
    });

    it("respects custom maxBurst", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 2, maxBurst: 5 });
      for (let i = 0; i < 5; i++) {
        expect(limiter.tryConsume()).toBe(true);
      }
      expect(limiter.tryConsume()).toBe(false);
    });
  });

  describe("tryConsume", () => {
    it("consumes tokens successfully", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 2 });
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(false);
    });

    it("refills tokens over time", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 2 });
      limiter.tryConsume();
      limiter.tryConsume();
      expect(limiter.tryConsume()).toBe(false);

      vi.advanceTimersByTime(500);
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(false);
    });

    it("caps refill at maxBurst", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 2, maxBurst: 2 });
      limiter.tryConsume();

      // Wait long enough to "earn" more than maxBurst tokens
      vi.advanceTimersByTime(5000);

      // Should still only have maxBurst tokens
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(true);
      expect(limiter.tryConsume()).toBe(false);
    });
  });

  describe("canProceed", () => {
    it("returns true when tokens available", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 1 });
      expect(limiter.canProceed()).toBe(true);
    });

    it("returns false when depleted", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 1 });
      limiter.tryConsume();
      expect(limiter.canProceed()).toBe(false);
    });

    it("does not consume tokens", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 1 });
      limiter.canProceed();
      limiter.canProceed();
      limiter.canProceed();
      // Should still be able to consume since canProceed doesn't consume
      expect(limiter.tryConsume()).toBe(true);
    });
  });

  describe("getWaitTime", () => {
    it("returns 0 when tokens available", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 2 });
      expect(limiter.getWaitTime()).toBe(0);
    });

    it("returns correct wait time when depleted", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 2 });
      limiter.tryConsume();
      limiter.tryConsume();
      // Need 1 token, rate is 2/sec, so 500ms wait
      expect(limiter.getWaitTime()).toBe(500);
    });

    it("returns partial wait time after some refill", () => {
      const limiter = new RateLimiter({ requestsPerSecond: 4 });
      limiter.tryConsume();
      limiter.tryConsume();
      limiter.tryConsume();
      limiter.tryConsume();

      // Wait 200ms (should add 0.8 tokens)
      vi.advanceTimersByTime(200);
      // Need 0.2 more tokens at 4/sec = 50ms
      expect(limiter.getWaitTime()).toBe(50);
    });
  });

  describe("acquire", () => {
    it("proceeds immediately when tokens available", async () => {
      const limiter = new RateLimiter({ requestsPerSecond: 2 });
      const start = Date.now();
      await limiter.acquire();
      expect(Date.now() - start).toBeLessThan(10);
    });

    it("waits when rate limited", async () => {
      const limiter = new RateLimiter({ requestsPerSecond: 2 });
      limiter.tryConsume();
      limiter.tryConsume();

      const acquirePromise = limiter.acquire();
      vi.advanceTimersByTime(500);
      await acquirePromise;

      expect(limiter.canProceed()).toBe(false);
    });

    it("consumes token after waiting", async () => {
      const limiter = new RateLimiter({ requestsPerSecond: 1 });
      limiter.tryConsume();

      const acquirePromise = limiter.acquire();
      vi.advanceTimersByTime(1000);
      await acquirePromise;

      // Token was consumed by acquire
      expect(limiter.canProceed()).toBe(false);
    });
  });
});

describe("createRateLimitedFetch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("wraps fetch with rate limiting", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const limiter = new RateLimiter({ requestsPerSecond: 1 });
    const rateLimitedFetch = createRateLimitedFetch(limiter);

    await rateLimitedFetch("https://example.com");
    expect(mockFetch).toHaveBeenCalledWith("https://example.com", undefined);

    vi.unstubAllGlobals();
  });

  it("passes through request options", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const limiter = new RateLimiter({ requestsPerSecond: 10 });
    const rateLimitedFetch = createRateLimitedFetch(limiter);

    const options: RequestInit = {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ test: true }),
    };
    await rateLimitedFetch("https://example.com/api", options);

    expect(mockFetch).toHaveBeenCalledWith("https://example.com/api", options);

    vi.unstubAllGlobals();
  });

  it("delays requests when rate limited", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const limiter = new RateLimiter({ requestsPerSecond: 1 });
    const rateLimitedFetch = createRateLimitedFetch(limiter);

    // First request - immediate
    await rateLimitedFetch("https://example.com/1");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Second request - should wait
    const secondPromise = rateLimitedFetch("https://example.com/2");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1000);
    await secondPromise;
    expect(mockFetch).toHaveBeenCalledTimes(2);

    vi.unstubAllGlobals();
  });

  it("handles concurrent requests with rate limiting", async () => {
    const mockFetch = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", mockFetch);

    const limiter = new RateLimiter({ requestsPerSecond: 2, maxBurst: 2 });
    const rateLimitedFetch = createRateLimitedFetch(limiter);

    // Launch 4 requests simultaneously
    const promises = [
      rateLimitedFetch("https://example.com/1"),
      rateLimitedFetch("https://example.com/2"),
      rateLimitedFetch("https://example.com/3"),
      rateLimitedFetch("https://example.com/4"),
    ];

    // First 2 should go immediately (burst)
    await Promise.resolve();
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Advance time to allow more
    vi.advanceTimersByTime(500);
    await Promise.resolve();

    vi.advanceTimersByTime(500);
    await Promise.all(promises);

    expect(mockFetch).toHaveBeenCalledTimes(4);

    vi.unstubAllGlobals();
  });
});
