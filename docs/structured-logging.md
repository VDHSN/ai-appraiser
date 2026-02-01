# Structured Logging Guide

This guide covers the structured logging system that sends logs to PostHog using the `$log` event.

## Overview

The logging system provides a unified `ILogger` interface for both client (browser) and server (Node.js) environments. All logs are sent to PostHog with consistent attributes for correlation and analysis.

## Log Levels

| Level   | Use Case                                    |
| ------- | ------------------------------------------- |
| `debug` | Development-only details, verbose tracing   |
| `info`  | Normal operational events, user actions     |
| `warn`  | Recoverable issues, degraded functionality  |
| `error` | Failures requiring attention, caught errors |

## Attributes

Every log entry includes these base attributes:

| Attribute    | Type                 | Description                                   |
| ------------ | -------------------- | --------------------------------------------- |
| `hostname`   | string               | Server hostname or `window.location.hostname` |
| `pageURL`    | string \| null       | Current URL (null on server)                  |
| `distinctId` | string               | PostHog user ID                               |
| `source`     | 'client' \| 'server' | Origin of log                                 |

Context attributes are included when available:

| Attribute           | Type           | Description           |
| ------------------- | -------------- | --------------------- |
| `sessionId`         | string \| null | Chat session ID       |
| `agentId`           | string \| null | Current agent         |
| `isRestored`        | boolean        | Chat restoration flag |
| `restoredSessionId` | string \| null | Original session ID   |

## Client Usage

### Basic Logging in Components

```typescript
import { useLogger } from "@/lib/logging";

function SearchForm() {
  const log = useLogger();

  const handleSearch = async (query: string) => {
    log.info("Search initiated", { query });
    try {
      const results = await searchItems(query);
      log.info("Search complete", { resultCount: results.length });
    } catch (error) {
      log.error("Search failed", { query, error: String(error) });
    }
  };
}
```

### Child Loggers for Subsystems

Create child loggers to add default properties for a specific subsystem:

```typescript
function ItemDetails({ itemId }: { itemId: string }) {
  const log = useLogger();
  const itemLog = log.child({ itemId, component: "ItemDetails" });

  const handleFavorite = () => {
    itemLog.info("Item favorited"); // Includes itemId automatically
  };

  const handleShare = () => {
    itemLog.info("Item shared", { platform: "twitter" });
  };
}
```

## Server Usage

### API Routes

Server logging uses a factory pattern for request-scoped loggers:

```typescript
import { serverLoggerFactory } from "@/lib/logging/server";

export async function POST(req: Request) {
  const distinctId = req.headers.get("X-PostHog-DistinctId") ?? "anonymous";
  const { sessionId, agentId } = await req.json();

  const log = serverLoggerFactory.create({
    distinctId,
    sessionId,
    agentId,
  });

  log.info("Processing chat request");

  try {
    const result = await processChat(messages);
    log.info("Chat processed", { responseLength: result.length });
    return Response.json(result);
  } catch (error) {
    log.error("Chat processing failed", { error: String(error) });
    throw error;
  }
}
```

### Child Loggers in Adapters

```typescript
const adapterLog = log.child({ adapter: "liveauctioneers" });

adapterLog.debug("Fetching item", { itemId });
const item = await fetchItem(itemId);
adapterLog.info("Item fetched", { title: item.title, price: item.price });
```

## Sending distinctId Header

Include the PostHog distinct ID in fetch requests for server-side log correlation:

```typescript
import { analytics } from "@/lib/analytics";

fetch("/api/chat", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-PostHog-DistinctId": analytics.getDistinctId() ?? "",
  },
  body: JSON.stringify({ sessionId, agentId, messages }),
});
```

This is already configured in `NewUIContainer.tsx` for the chat transport.

## Testing

### Using MockLogger

```typescript
import { MockLogger } from "@/lib/logging";

describe("SearchService", () => {
  let logger: MockLogger;

  beforeEach(() => {
    logger = new MockLogger();
  });

  it("logs search results", async () => {
    const service = new SearchService(logger);
    await service.search("vintage watch");

    expect(logger.hasLog("info", "Search complete")).toBe(true);

    const log = logger.getLastLog();
    expect(log?.properties.resultCount).toBeGreaterThan(0);
  });

  it("logs errors on failure", async () => {
    const service = new SearchService(logger);
    await service.search(""); // empty query triggers error

    expect(logger.hasLog("error", /Search failed/)).toBe(true);
  });
});
```

### Mock Test Helpers

```typescript
// Clear logs between tests
logger.clear();

// Find logs by level
const errorLogs = logger.findLogs("error");

// Check for log with regex pattern
logger.hasLog("warn", /timeout after \d+ms/);

// Get all log messages for debugging
console.log(logger.getLogMessages());
// ["[INFO] Search initiated", "[INFO] Search complete"]
```

### Testing with MockServerLoggerFactory

```typescript
import { MockServerLoggerFactory } from "@/lib/logging";

describe("ChatRoute", () => {
  let factory: MockServerLoggerFactory;

  beforeEach(() => {
    factory = new MockServerLoggerFactory();
  });

  it("creates logger with request context", async () => {
    const log = factory.create({
      hostname: "test",
      pageURL: null,
      distinctId: "user-123",
      source: "server",
      sessionId: "session-456",
    });

    log.info("test");

    expect(factory.lastContext?.distinctId).toBe("user-123");
    expect(factory.lastContext?.sessionId).toBe("session-456");
  });
});
```

## Viewing Logs in PostHog

1. Go to PostHog Events
2. Filter by event name: `$log`
3. Use property filters:
   - `source` = "client" or "server"
   - `level` = "error" for errors only
   - `sessionId` to trace a specific chat
   - `distinctId` for user-specific logs

## Architecture

```
src/lib/logging/
  types.ts              # ILogger interface, log levels, attribute types
  client.ts             # Browser PostHog implementation
  server.ts             # Node.js PostHog implementation + factory
  mock.ts               # MockLogger for testing
  index.ts              # Public exports
  LoggerProvider.tsx    # React context for auto-injecting context
  __tests__/
    logger.test.ts      # Unit tests
```
