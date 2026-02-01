import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { createElement } from "react";

// Mock PostHog - use vi.hoisted to ensure mocks are available during module initialization
const { mockCapture, mockGetDistinctId } = vi.hoisted(() => ({
  mockCapture: vi.fn(),
  mockGetDistinctId: vi.fn(() => "test-distinct-id"),
}));

vi.mock("posthog-js", () => ({
  default: {
    capture: (...args: unknown[]) => mockCapture(...args),
    get_distinct_id: () => mockGetDistinctId(),
  },
}));

// Mock analytics module
vi.mock("@/lib/analytics", () => ({
  analytics: {
    getDistinctId: () => mockGetDistinctId(),
  },
}));

// Mock useAgent hook
const mockAgentContext = {
  sessionId: "test-session-123",
  agentId: "curator",
  isRestored: false,
  restoredSessionId: null,
};

vi.mock("@/lib/agent", () => ({
  useAgent: () => mockAgentContext,
}));

// Import after mock setup
import { MockLogger, MockClientLogger, MockServerLoggerFactory } from "../mock";
import { clientLogger } from "../client";
import { LoggerProvider, useLogger } from "../LoggerProvider";

describe("MockLogger", () => {
  let logger: MockLogger;

  beforeEach(() => {
    logger = new MockLogger();
  });

  it("captures log entries with correct level", () => {
    logger.debug("debug message");
    logger.info("info message");
    logger.warn("warn message");
    logger.error("error message");

    expect(logger.logs).toHaveLength(4);
    expect(logger.logs[0].level).toBe("debug");
    expect(logger.logs[1].level).toBe("info");
    expect(logger.logs[2].level).toBe("warn");
    expect(logger.logs[3].level).toBe("error");
  });

  it("captures log messages", () => {
    logger.info("test message");

    expect(logger.logs[0].message).toBe("test message");
  });

  it("captures properties", () => {
    logger.info("test", { key: "value", count: 42 });

    expect(logger.logs[0].properties).toEqual({ key: "value", count: 42 });
  });

  it("records timestamp", () => {
    const before = new Date();
    logger.info("test");
    const after = new Date();

    const timestamp = logger.logs[0].timestamp;
    expect(timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  describe("child logger", () => {
    it("inherits default properties", () => {
      const childLogger = logger.child({ tool: "search" });
      childLogger.info("child message");

      expect(logger.logs[0].properties).toEqual({ tool: "search" });
    });

    it("merges properties with defaults", () => {
      const childLogger = logger.child({ tool: "search" });
      childLogger.info("child message", { itemId: "123" });

      expect(logger.logs[0].properties).toEqual({
        tool: "search",
        itemId: "123",
      });
    });

    it("shares logs array with parent", () => {
      const childLogger = logger.child({ tool: "search" });
      logger.info("parent message");
      childLogger.info("child message");

      expect(logger.logs).toHaveLength(2);
    });
  });

  describe("test helpers", () => {
    it("findLogs returns logs by level", () => {
      logger.info("info 1");
      logger.warn("warn 1");
      logger.info("info 2");

      const infoLogs = logger.findLogs("info");
      expect(infoLogs).toHaveLength(2);
      expect(infoLogs[0].message).toBe("info 1");
      expect(infoLogs[1].message).toBe("info 2");
    });

    it("hasLog checks for message with string", () => {
      logger.info("exact message");

      expect(logger.hasLog("info", "exact message")).toBe(true);
      expect(logger.hasLog("info", "wrong message")).toBe(false);
      expect(logger.hasLog("warn", "exact message")).toBe(false);
    });

    it("hasLog checks for message with regex", () => {
      logger.error("Error: connection timeout after 5000ms");

      expect(logger.hasLog("error", /connection timeout/)).toBe(true);
      expect(logger.hasLog("error", /timeout after \d+ms/)).toBe(true);
      expect(logger.hasLog("error", /invalid/)).toBe(false);
    });

    it("getLastLog returns most recent entry", () => {
      logger.info("first");
      logger.warn("second");
      logger.error("third");

      const last = logger.getLastLog();
      expect(last?.level).toBe("error");
      expect(last?.message).toBe("third");
    });

    it("clear removes all logs", () => {
      logger.info("test");
      expect(logger.logs).toHaveLength(1);

      logger.clear();
      expect(logger.logs).toHaveLength(0);
    });
  });
});

describe("MockClientLogger", () => {
  let logger: MockClientLogger;

  beforeEach(() => {
    logger = new MockClientLogger();
  });

  it("supports setContext", () => {
    logger.setContext({ distinctId: "user-123", sessionId: "session-456" });

    expect(logger.context.distinctId).toBe("user-123");
    expect(logger.context.sessionId).toBe("session-456");
  });

  it("merges context on subsequent calls", () => {
    logger.setContext({ distinctId: "user-123" });
    logger.setContext({ sessionId: "session-456" });

    expect(logger.context.distinctId).toBe("user-123");
    expect(logger.context.sessionId).toBe("session-456");
  });

  it("clear resets context", () => {
    logger.setContext({ distinctId: "user-123" });
    logger.clear();

    expect(logger.context).toEqual({});
  });
});

describe("MockServerLoggerFactory", () => {
  let factory: MockServerLoggerFactory;

  beforeEach(() => {
    factory = new MockServerLoggerFactory();
  });

  it("creates loggers with context", () => {
    const context = {
      hostname: "server-1",
      pageURL: null,
      distinctId: "user-123",
      source: "server" as const,
      sessionId: "session-456",
    };

    factory.create(context);

    expect(factory.lastContext).toEqual(context);
  });

  it("tracks all created loggers", () => {
    const context1 = {
      hostname: "server-1",
      pageURL: null,
      distinctId: "user-1",
      source: "server" as const,
    };
    const context2 = {
      hostname: "server-1",
      pageURL: null,
      distinctId: "user-2",
      source: "server" as const,
    };

    const logger1 = factory.create(context1);
    const logger2 = factory.create(context2);

    logger1.info("from user 1");
    logger2.info("from user 2");

    const allLogs = factory.getAllLogs();
    expect(allLogs).toHaveLength(2);
  });

  it("tracks shutdown call", async () => {
    expect(factory.wasShutdownCalled()).toBe(false);

    await factory.shutdown();

    expect(factory.wasShutdownCalled()).toBe(true);
  });
});

describe("PostHogClientLogger", () => {
  beforeEach(() => {
    mockCapture.mockClear();
  });

  it("sends logs to PostHog with $log event", () => {
    clientLogger.info("test message");

    expect(mockCapture).toHaveBeenCalledWith(
      "$log",
      expect.objectContaining({
        level: "info",
        message: "test message",
      }),
    );
  });

  it("includes base attributes", () => {
    clientLogger.info("test");

    expect(mockCapture).toHaveBeenCalledWith(
      "$log",
      expect.objectContaining({
        source: "client",
        hostname: expect.any(String),
      }),
    );
  });

  it("includes timestamp", () => {
    clientLogger.info("test");

    expect(mockCapture).toHaveBeenCalledWith(
      "$log",
      expect.objectContaining({
        timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it("includes custom properties", () => {
    clientLogger.warn("search failed", { query: "test", errorCode: 500 });

    expect(mockCapture).toHaveBeenCalledWith(
      "$log",
      expect.objectContaining({
        level: "warn",
        message: "search failed",
        query: "test",
        errorCode: 500,
      }),
    );
  });
});

describe("useLogger hook", () => {
  function createWrapper() {
    return function Wrapper({ children }: { children: ReactNode }) {
      return createElement(LoggerProvider, null, children);
    };
  }

  beforeEach(() => {
    mockCapture.mockClear();
  });

  it("returns logger from context", () => {
    const { result } = renderHook(() => useLogger(), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeDefined();
    expect(typeof result.current.info).toBe("function");
    expect(typeof result.current.error).toBe("function");
    expect(typeof result.current.child).toBe("function");
  });

  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useLogger());
    }).toThrow("useLogger must be used within a LoggerProvider");
  });
});

describe("base attributes verification", () => {
  beforeEach(() => {
    mockCapture.mockClear();
  });

  afterEach(() => {
    mockCapture.mockClear();
  });

  it("client logger always includes required base attributes", () => {
    // Set context first
    clientLogger.setContext({
      distinctId: "test-user",
      sessionId: "test-session",
      agentId: "curator",
      isRestored: false,
      restoredSessionId: null,
    });

    clientLogger.info("test message");

    const captureCall = mockCapture.mock.calls[0];
    expect(captureCall[0]).toBe("$log");

    const properties = captureCall[1];
    // Base attributes
    expect(properties).toHaveProperty("hostname");
    expect(properties).toHaveProperty("pageURL");
    expect(properties).toHaveProperty("distinctId", "test-user");
    expect(properties).toHaveProperty("source", "client");

    // Context attributes
    expect(properties).toHaveProperty("sessionId", "test-session");
    expect(properties).toHaveProperty("agentId", "curator");
    expect(properties).toHaveProperty("isRestored", false);
    expect(properties).toHaveProperty("restoredSessionId", null);

    // Log metadata
    expect(properties).toHaveProperty("level", "info");
    expect(properties).toHaveProperty("message", "test message");
    expect(properties).toHaveProperty("timestamp");
  });

  it("child logger inherits base attributes", () => {
    clientLogger.setContext({
      distinctId: "parent-user",
      sessionId: "parent-session",
    });

    const childLogger = clientLogger.child({ tool: "search" });
    childLogger.warn("child message");

    const captureCall = mockCapture.mock.calls[0];
    const properties = captureCall[1];

    // Should have base attributes from parent
    expect(properties).toHaveProperty("distinctId", "parent-user");
    expect(properties).toHaveProperty("sessionId", "parent-session");
    expect(properties).toHaveProperty("source", "client");

    // Should have child's default properties
    expect(properties).toHaveProperty("tool", "search");
  });
});
