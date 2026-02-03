import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createEdgeLogger } from "../logger";

// Mock fetch globally
const mockFetch = vi.fn(() =>
  Promise.resolve(new Response("{}", { status: 200 })),
);
vi.stubGlobal("fetch", mockFetch);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyBody = any;

/** Helper to extract parsed body from mock fetch call */
function getLastFetchBody(): AnyBody {
  const calls = mockFetch.mock.calls;
  if (calls.length === 0) return null;
  const lastCall = calls[calls.length - 1] as unknown as [
    unknown,
    RequestInit?,
  ];
  const init = lastCall[1];
  return init?.body ? JSON.parse(init.body as string) : null;
}

describe("EdgeLogger", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    mockFetch.mockClear();
    process.env = { ...originalEnv, NEXT_PUBLIC_POSTHOG_KEY: "test-api-key" };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("createEdgeLogger", () => {
    it("creates a logger with all ILogger methods", () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });

      expect(typeof logger.debug).toBe("function");
      expect(typeof logger.info).toBe("function");
      expect(typeof logger.warn).toBe("function");
      expect(typeof logger.error).toBe("function");
      expect(typeof logger.child).toBe("function");
    });
  });

  describe("log levels", () => {
    it("sends debug log with severity 5", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      logger.debug("debug message");

      // Allow async fetch to be called
      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const logRecord = body.resourceLogs[0].scopeLogs[0].logRecords[0];

      expect(logRecord.severityNumber).toBe(5);
      expect(logRecord.severityText).toBe("DEBUG");
      expect(logRecord.body.stringValue).toBe("debug message");
    });

    it("sends info log with severity 9", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      logger.info("info message");

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const logRecord = body.resourceLogs[0].scopeLogs[0].logRecords[0];

      expect(logRecord.severityNumber).toBe(9);
      expect(logRecord.severityText).toBe("INFO");
    });

    it("sends warn log with severity 13", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      logger.warn("warn message");

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const logRecord = body.resourceLogs[0].scopeLogs[0].logRecords[0];

      expect(logRecord.severityNumber).toBe(13);
      expect(logRecord.severityText).toBe("WARN");
    });

    it("sends error log with severity 17", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      logger.error("error message");

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const logRecord = body.resourceLogs[0].scopeLogs[0].logRecords[0];

      expect(logRecord.severityNumber).toBe(17);
      expect(logRecord.severityText).toBe("ERROR");
    });
  });

  describe("OTLP payload structure", () => {
    it("sends to PostHog OTLP endpoint", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      logger.info("test");

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(mockFetch).toHaveBeenCalledWith(
        "https://us.i.posthog.com/v1/logs",
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: "Bearer test-api-key",
          },
        }),
      );
    });

    it("includes resource attributes", async () => {
      const logger = createEdgeLogger({
        distinctId: "user-123",
        origin: "https://example.com",
      });
      logger.info("test");

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const resourceAttrs = body.resourceLogs[0].resource.attributes;

      const getAttr = (key: string) =>
        resourceAttrs.find((a: { key: string }) => a.key === key)?.value
          .stringValue;

      expect(getAttr("service.name")).toBe("auction-proxy-agent");
      expect(getAttr("service.version")).toBe("0.1.0");
      expect(getAttr("host.name")).toBe("https://example.com");
    });

    it("includes posthog.distinct_id in attributes", async () => {
      const logger = createEdgeLogger({ distinctId: "test-user-456" });
      logger.info("test");

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;

      const distinctIdAttr = attrs.find(
        (a: { key: string }) => a.key === "posthog.distinct_id",
      );
      expect(distinctIdAttr?.value.stringValue).toBe("test-user-456");
    });

    it("includes component in attributes", async () => {
      const logger = createEdgeLogger({
        distinctId: "user-123",
        component: "middleware",
      });
      logger.info("test");

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;

      const componentAttr = attrs.find(
        (a: { key: string }) => a.key === "app.component",
      );
      expect(componentAttr?.value.stringValue).toBe("middleware");
    });

    it("includes user.id when userId provided", async () => {
      const logger = createEdgeLogger({
        distinctId: "user-123",
        userId: "clerk-user-789",
      });
      logger.info("test");

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;

      const userIdAttr = attrs.find(
        (a: { key: string }) => a.key === "user.id",
      );
      expect(userIdAttr?.value.stringValue).toBe("clerk-user-789");
    });

    it("includes timeUnixNano", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      const before = Date.now() * 1_000_000;
      logger.info("test");

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const logRecord = body.resourceLogs[0].scopeLogs[0].logRecords[0];

      const timestamp = Number(logRecord.timeUnixNano);
      expect(timestamp).toBeGreaterThanOrEqual(before);
    });
  });

  describe("properties handling", () => {
    it("includes custom properties as attributes", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      logger.info("request", { method: "GET", path: "/api/test" });

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;

      const methodAttr = attrs.find((a: { key: string }) => a.key === "method");
      const pathAttr = attrs.find((a: { key: string }) => a.key === "path");

      expect(methodAttr?.value.stringValue).toBe("GET");
      expect(pathAttr?.value.stringValue).toBe("/api/test");
    });

    it("converts numbers to intValue", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      logger.info("request", { duration: 150, status: 200 });

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;

      const durationAttr = attrs.find(
        (a: { key: string }) => a.key === "duration",
      );
      expect(durationAttr?.value.intValue).toBe("150");
    });

    it("converts booleans to boolValue", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      logger.info("status", { isAuthenticated: true, hasError: false });

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;

      const authAttr = attrs.find(
        (a: { key: string }) => a.key === "isAuthenticated",
      );
      const errorAttr = attrs.find(
        (a: { key: string }) => a.key === "hasError",
      );

      expect(authAttr?.value.boolValue).toBe(true);
      expect(errorAttr?.value.boolValue).toBe(false);
    });

    it("filters out null and undefined properties", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      logger.info("request", {
        method: "GET",
        query: null,
        referer: undefined,
      });

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;
      const keys = attrs.map((a: { key: string }) => a.key);

      expect(keys).toContain("method");
      expect(keys).not.toContain("query");
      expect(keys).not.toContain("referer");
    });
  });

  describe("child logger", () => {
    it("inherits config from parent", async () => {
      const logger = createEdgeLogger({
        distinctId: "user-123",
        component: "middleware",
      });
      const child = logger.child({ subcomponent: "auth" });
      child.info("child message");

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;

      const distinctIdAttr = attrs.find(
        (a: { key: string }) => a.key === "posthog.distinct_id",
      );
      const componentAttr = attrs.find(
        (a: { key: string }) => a.key === "app.component",
      );

      expect(distinctIdAttr?.value.stringValue).toBe("user-123");
      expect(componentAttr?.value.stringValue).toBe("middleware");
    });

    it("includes default properties from child", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      const child = logger.child({ tool: "search", platform: "1stdibs" });
      child.info("searching");

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;

      const toolAttr = attrs.find((a: { key: string }) => a.key === "tool");
      const platformAttr = attrs.find(
        (a: { key: string }) => a.key === "platform",
      );

      expect(toolAttr?.value.stringValue).toBe("search");
      expect(platformAttr?.value.stringValue).toBe("1stdibs");
    });

    it("merges child defaults with call-time properties", async () => {
      const logger = createEdgeLogger({ distinctId: "user-123" });
      const child = logger.child({ tool: "search" });
      child.info("found", { resultCount: 10 });

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());

      const body = getLastFetchBody();
      const attrs = body.resourceLogs[0].scopeLogs[0].logRecords[0].attributes;

      const toolAttr = attrs.find((a: { key: string }) => a.key === "tool");
      const resultAttr = attrs.find(
        (a: { key: string }) => a.key === "resultCount",
      );

      expect(toolAttr?.value.stringValue).toBe("search");
      expect(resultAttr?.value.intValue).toBe("10");
    });
  });

  describe("API key handling", () => {
    it("does not send when API key is missing", async () => {
      process.env = { ...originalEnv };
      delete process.env.NEXT_PUBLIC_POSTHOG_KEY;

      const logger = createEdgeLogger({ distinctId: "user-123" });
      logger.info("test");

      // Give time for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe("error handling", () => {
    it("silently handles fetch failures", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      const logger = createEdgeLogger({ distinctId: "user-123" });

      // Should not throw
      expect(() => logger.info("test")).not.toThrow();

      await vi.waitFor(() => expect(mockFetch).toHaveBeenCalled());
    });
  });
});
