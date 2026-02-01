/**
 * Structured logging type definitions.
 * Provides unified logging interface for client and server.
 */

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogSource = "client" | "server";

/** Base attributes required on EVERY log entry */
export interface BaseLogAttributes {
  hostname: string;
  pageURL: string | null;
  distinctId: string;
  source: LogSource;
}

/** Contextual attributes (when available) */
export interface ContextLogAttributes {
  sessionId: string | null;
  agentId: string | null;
  isRestored: boolean;
  restoredSessionId: string | null;
}

/** Additional properties that can be passed to log methods */
export type LogProperties = Record<string, unknown>;

/** Unified logger interface - same API for client and server */
export interface ILogger {
  debug(message: string, properties?: LogProperties): void;
  info(message: string, properties?: LogProperties): void;
  warn(message: string, properties?: LogProperties): void;
  error(message: string, properties?: LogProperties): void;

  /**
   * Creates a child logger with default properties.
   * All logs from the child include the parent's properties plus the child's defaults.
   */
  child(defaultProperties: LogProperties): ILogger;
}

/** Context setter (client-side only, called by LoggerProvider) */
export interface ILoggerWithContext extends ILogger {
  setContext(
    context: Partial<ContextLogAttributes & { distinctId: string }>,
  ): void;
}

/** Context for creating server loggers (minimal required fields) */
export interface ServerLoggerContext {
  distinctId: string;
  sessionId?: string | null;
  agentId?: string | null;
  isRestored?: boolean;
  restoredSessionId?: string | null;
}

/** Factory for request-scoped loggers (server-side) */
export interface ILoggerFactory {
  create(context: ServerLoggerContext): ILogger;
  shutdown(): Promise<void>;
}

/** Full set of attributes sent with each log entry */
export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  attributes: BaseLogAttributes & Partial<ContextLogAttributes>;
  properties: LogProperties;
}
