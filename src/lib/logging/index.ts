/**
 * Structured logging abstraction layer.
 * Re-exports client logging and types for browser usage.
 * For server logging, import from "@/lib/logging/server" directly.
 */

// Types
export type {
  LogLevel,
  LogSource,
  BaseLogAttributes,
  ContextLogAttributes,
  ServerLoggerContext,
  LogProperties,
  ILogger,
  ILoggerWithContext,
  ILoggerFactory,
  LogEntry,
} from "./types";

// Client logger (browser only)
export { clientLogger } from "./client";

// React context and hook
export { LoggerProvider, useLogger } from "./LoggerProvider";

// Mocks for testing
export {
  MockLogger,
  MockClientLogger,
  MockServerLoggerFactory,
  mockClientLogger,
  mockServerLoggerFactory,
  type LogEntry as MockLogEntry,
} from "./mock";
