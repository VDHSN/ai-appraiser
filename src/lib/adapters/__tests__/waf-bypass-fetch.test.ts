/**
 * Unit tests for WAF bypass fetch wrapper
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  createCookieJar,
  createWafBypassFetch,
  createSessionFetch,
} from "../waf-bypass-fetch";

describe("Cookie Jar", () => {
  it("stores and retrieves cookies", () => {
    const jar = createCookieJar();

    jar.set("session", "abc123");
    jar.set("user", "john");

    expect(jar.get("session")).toBe("abc123");
    expect(jar.get("user")).toBe("john");
    expect(jar.get("nonexistent")).toBeUndefined();
  });

  it("generates cookie header string", () => {
    const jar = createCookieJar();

    jar.set("a", "1");
    jar.set("b", "2");

    const header = jar.toCookieHeader();
    expect(header).toContain("a=1");
    expect(header).toContain("b=2");
    expect(header).toContain("; ");
  });

  it("parses Set-Cookie headers", () => {
    const jar = createCookieJar();

    jar.parseSetCookie([
      "session=xyz789; Path=/; HttpOnly",
      "theme=dark; Max-Age=3600",
      "lang=en-US; Secure; SameSite=Lax",
    ]);

    expect(jar.get("session")).toBe("xyz789");
    expect(jar.get("theme")).toBe("dark");
    expect(jar.get("lang")).toBe("en-US");
  });

  it("handles malformed Set-Cookie headers gracefully", () => {
    const jar = createCookieJar();

    jar.parseSetCookie(["", "invalid", "=noname", "valid=value"]);

    expect(jar.get("valid")).toBe("value");
    expect(jar.cookies.size).toBe(1);
  });

  it("clears all cookies", () => {
    const jar = createCookieJar();

    jar.set("a", "1");
    jar.set("b", "2");
    expect(jar.cookies.size).toBe(2);

    jar.clear();
    expect(jar.cookies.size).toBe(0);
  });

  it("returns all cookies as object", () => {
    const jar = createCookieJar();

    jar.set("x", "10");
    jar.set("y", "20");

    expect(jar.getAll()).toEqual({ x: "10", y: "20" });
  });
});

describe("WAF Bypass Fetch", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("creates fetch wrapper with domain config", () => {
    const waf = createWafBypassFetch({
      domain: "example.com",
    });

    expect(waf.fetch).toBeTypeOf("function");
    expect(waf.getCookieJar).toBeTypeOf("function");
    expect(waf.initSession).toBeTypeOf("function");
    expect(waf.isSessionInitialized).toBeTypeOf("function");
  });

  it("adds browser headers to requests", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{"data": "test"}', {
        status: 200,
        headers: new Headers(),
      }),
    );

    const waf = createWafBypassFetch({ domain: "proxibid.com" });
    await waf.fetch("https://www.proxibid.com/api/test");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, options] = mockFetch.mock.calls[0];

    expect(options.headers["User-Agent"]).toContain("Chrome");
    expect(options.headers["Accept-Language"]).toBe("en-US,en;q=0.9");
    expect(options.headers["sec-ch-ua"]).toContain("Chromium");
    expect(options.headers["Sec-Fetch-Mode"]).toBeDefined();
    expect(options.headers["Referer"]).toContain("proxibid.com");
  });

  it("adds Sec-Fetch headers for API requests", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response('{"ok": true}', { status: 200 }),
    );

    const waf = createWafBypassFetch({ domain: "proxibid.com" });
    await waf.fetch("https://www.proxibid.com/asp/SearchBuilder.asp");

    const [, options] = mockFetch.mock.calls[0];
    expect(options.headers["Sec-Fetch-Dest"]).toBe("empty");
    expect(options.headers["Sec-Fetch-Mode"]).toBe("cors");
    expect(options.headers["Sec-Fetch-Site"]).toBe("same-origin");
  });

  it("collects cookies from response", async () => {
    const headers = new Headers();
    headers.append("Set-Cookie", "sid=abc123; Path=/");
    headers.append("Set-Cookie", "token=xyz; HttpOnly");

    // Mock getSetCookie method
    const mockResponse = new Response('{"ok": true}', {
      status: 200,
      headers,
    });
    Object.defineProperty(mockResponse.headers, "getSetCookie", {
      value: () => ["sid=abc123; Path=/", "token=xyz; HttpOnly"],
    });

    mockFetch.mockResolvedValueOnce(mockResponse);

    const waf = createWafBypassFetch({ domain: "example.com" });
    await waf.fetch("https://www.example.com/test");

    const cookies = waf.getCookieJar().getAll();
    expect(cookies.sid).toBe("abc123");
    expect(cookies.token).toBe("xyz");
  });

  it("sends cookies with subsequent requests", async () => {
    // First request sets cookies
    const firstResponse = new Response('{"ok": true}', { status: 200 });
    Object.defineProperty(firstResponse.headers, "getSetCookie", {
      value: () => ["session=first123"],
    });
    mockFetch.mockResolvedValueOnce(firstResponse);

    // Second request should include cookies
    mockFetch.mockResolvedValueOnce(
      new Response('{"ok": true}', { status: 200 }),
    );

    const waf = createWafBypassFetch({ domain: "example.com" });
    await waf.fetch("https://www.example.com/login");
    await waf.fetch("https://www.example.com/data");

    const [, secondOptions] = mockFetch.mock.calls[1];
    expect(secondOptions.headers["Cookie"]).toBe("session=first123");
  });

  it("retries on server error (500)", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("Error", { status: 500 }))
      .mockResolvedValueOnce(new Response("Error", { status: 500 }))
      .mockResolvedValueOnce(new Response('{"ok": true}', { status: 200 }));

    const waf = createWafBypassFetch({
      domain: "example.com",
      maxRetries: 3,
      baseDelayMs: 10, // Fast for tests
    });

    const response = await waf.fetch("https://www.example.com/test");
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries on rate limit (429)", async () => {
    mockFetch
      .mockResolvedValueOnce(new Response("Rate limited", { status: 429 }))
      .mockResolvedValueOnce(new Response('{"ok": true}', { status: 200 }));

    const waf = createWafBypassFetch({
      domain: "example.com",
      maxRetries: 2,
      baseDelayMs: 10,
    });

    const response = await waf.fetch("https://www.example.com/test");
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("does not retry on WAF block (403)", async () => {
    mockFetch.mockResolvedValueOnce(new Response("Forbidden", { status: 403 }));

    const waf = createWafBypassFetch({
      domain: "example.com",
      maxRetries: 3,
      baseDelayMs: 10,
    });

    const response = await waf.fetch("https://www.example.com/test");
    expect(response.status).toBe(403);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries on network errors", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce(new Response('{"ok": true}', { status: 200 }));

    const waf = createWafBypassFetch({
      domain: "example.com",
      maxRetries: 2,
      baseDelayMs: 10,
    });

    const response = await waf.fetch("https://www.example.com/test");
    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws after exhausting retries on persistent error", async () => {
    mockFetch.mockRejectedValue(new Error("fetch failed"));

    const waf = createWafBypassFetch({
      domain: "example.com",
      maxRetries: 2,
      baseDelayMs: 10,
    });

    await expect(waf.fetch("https://www.example.com/test")).rejects.toThrow(
      "fetch failed",
    );
    expect(mockFetch).toHaveBeenCalledTimes(3); // Initial + 2 retries
  });

  it("initializes session by visiting base URL", async () => {
    const sessionResponse = new Response("<html>Home</html>", { status: 200 });
    Object.defineProperty(sessionResponse.headers, "getSetCookie", {
      value: () => ["PHPSESSID=session123"],
    });
    mockFetch.mockResolvedValueOnce(sessionResponse);

    const waf = createWafBypassFetch({
      domain: "proxibid.com",
      sessionInitUrl: "https://www.proxibid.com/",
    });

    expect(waf.isSessionInitialized()).toBe(false);
    await waf.initSession();
    expect(waf.isSessionInitialized()).toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      "https://www.proxibid.com/",
      expect.objectContaining({
        method: "GET",
        headers: expect.objectContaining({
          "User-Agent": expect.stringContaining("Chrome"),
        }),
      }),
    );

    // Check cookies were collected
    expect(waf.getCookieJar().get("PHPSESSID")).toBe("session123");
  });

  it("uses custom logger", async () => {
    const logger = vi.fn();
    mockFetch
      .mockResolvedValueOnce(new Response("Error", { status: 500 }))
      .mockResolvedValueOnce(new Response("OK", { status: 200 }));

    const waf = createWafBypassFetch({
      domain: "example.com",
      maxRetries: 1,
      baseDelayMs: 10,
      logger,
    });

    await waf.fetch("https://www.example.com/test");

    expect(logger).toHaveBeenCalledWith(expect.stringContaining("Retry"));
  });
});

describe("createSessionFetch", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("auto-initializes session on first request", async () => {
    // Session init response
    const sessionResponse = new Response("<html>Home</html>", { status: 200 });
    Object.defineProperty(sessionResponse.headers, "getSetCookie", {
      value: () => ["session=auto123"],
    });

    // API response
    const apiResponse = new Response('{"data": "test"}', { status: 200 });
    Object.defineProperty(apiResponse.headers, "getSetCookie", {
      value: () => [],
    });

    mockFetch
      .mockResolvedValueOnce(sessionResponse)
      .mockResolvedValueOnce(apiResponse);

    const fetch = createSessionFetch({
      domain: "example.com",
      sessionInitUrl: "https://www.example.com/",
      autoInitSession: true,
    });

    await fetch("https://www.example.com/api/data");

    // Should have made 2 requests: session init + API
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe("https://www.example.com/");
    expect(mockFetch.mock.calls[1][0]).toBe("https://www.example.com/api/data");

    // Second API call includes session cookie
    const [, secondOptions] = mockFetch.mock.calls[1];
    expect(secondOptions.headers["Cookie"]).toBe("session=auto123");
  });

  it("only initializes session once across multiple requests", async () => {
    const sessionResponse = new Response("<html>", { status: 200 });
    Object.defineProperty(sessionResponse.headers, "getSetCookie", {
      value: () => [],
    });

    const apiResponse = new Response('{"ok": true}', { status: 200 });
    Object.defineProperty(apiResponse.headers, "getSetCookie", {
      value: () => [],
    });

    mockFetch
      .mockResolvedValueOnce(sessionResponse)
      .mockResolvedValueOnce(apiResponse)
      .mockResolvedValueOnce(apiResponse)
      .mockResolvedValueOnce(apiResponse);

    const fetch = createSessionFetch({
      domain: "example.com",
      sessionInitUrl: "https://www.example.com/",
      autoInitSession: true,
    });

    // Make 3 API calls
    await fetch("https://www.example.com/api/1");
    await fetch("https://www.example.com/api/2");
    await fetch("https://www.example.com/api/3");

    // Session should only be initialized once
    expect(mockFetch).toHaveBeenCalledTimes(4); // 1 session + 3 API
    expect(mockFetch.mock.calls[0][0]).toBe("https://www.example.com/");
  });

  it("skips auto-init when disabled", async () => {
    const apiResponse = new Response('{"ok": true}', { status: 200 });
    Object.defineProperty(apiResponse.headers, "getSetCookie", {
      value: () => [],
    });

    mockFetch.mockResolvedValueOnce(apiResponse);

    const fetch = createSessionFetch({
      domain: "example.com",
      autoInitSession: false,
    });

    await fetch("https://www.example.com/api/data");

    // Only API call, no session init
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe("https://www.example.com/api/data");
  });
});
