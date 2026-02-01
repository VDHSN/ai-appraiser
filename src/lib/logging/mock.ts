/**
 * Mock logger implementations for testing.
 */

import type {
  ILogger,
  ILoggerWithContext,
  ILoggerFactory,
  LogLevel,
  LogProperties,
  ContextLogAttributes,
  ServerLoggerContext,
} from "./types";

/** Captured log entry for test assertions */
export interface LogEntry {
  level: LogLevel;
  message: string;
  properties: LogProperties;
  timestamp: Date;
}

/**
 * Mock logger for testing.
 * Captures all log entries for assertions.
 */
export class MockLogger implements ILogger {
  public logs: LogEntry[] = [];

  constructor(private defaultProperties: LogProperties = {}) {}

  private log(
    level: LogLevel,
    message: string,
    properties: LogProperties = {},
  ): void {
    this.logs.push({
      level,
      message,
      properties: { ...this.defaultProperties, ...properties },
      timestamp: new Date(),
    });
  }

  debug(message: string, properties?: LogProperties): void {
    this.log("debug", message, properties);
  }

  info(message: string, properties?: LogProperties): void {
    this.log("info", message, properties);
  }

  warn(message: string, properties?: LogProperties): void {
    this.log("warn", message, properties);
  }

  error(message: string, properties?: LogProperties): void {
    this.log("error", message, properties);
  }

  child(defaultProperties: LogProperties): ILogger {
    const childLogger = new MockLogger({
      ...this.defaultProperties,
      ...defaultProperties,
    });
    // Share logs array with parent
    childLogger.logs = this.logs;
    return childLogger;
  }

  // Test helpers

  /** Clears all captured logs */
  clear(): void {
    this.logs = [];
  }

  /** Finds logs by level */
  findLogs(level: LogLevel): LogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  /** Checks if a log with the given level and message exists */
  hasLog(level: LogLevel, message: string | RegExp): boolean {
    return this.logs.some((log) => {
      if (log.level !== level) return false;
      if (typeof message === "string") return log.message === message;
      return message.test(log.message);
    });
  }

  /** Returns the last logged entry */
  getLastLog(): LogEntry | undefined {
    return this.logs[this.logs.length - 1];
  }

  /** Returns all log messages as strings for debugging */
  getLogMessages(): string[] {
    return this.logs.map(
      (log) => `[${log.level.toUpperCase()}] ${log.message}`,
    );
  }
}

/**
 * Mock client logger with context support for testing.
 */
export class MockClientLogger extends MockLogger implements ILoggerWithContext {
  public context: Partial<ContextLogAttributes & { distinctId: string }> = {};

  setContext(
    context: Partial<ContextLogAttributes & { distinctId: string }>,
  ): void {
    this.context = { ...this.context, ...context };
  }

  /** Clears context and logs */
  override clear(): void {
    super.clear();
    this.context = {};
  }
}

/**
 * Mock server logger factory for testing.
 */
export class MockServerLoggerFactory implements ILoggerFactory {
  public loggers: MockLogger[] = [];
  public lastContext: ServerLoggerContext | null = null;
  private shutdownCalled = false;

  create(context: ServerLoggerContext): ILogger {
    this.lastContext = context;
    const logger = new MockLogger({ ...context });
    this.loggers.push(logger);
    return logger;
  }

  async shutdown(): Promise<void> {
    this.shutdownCalled = true;
  }

  /** Gets all logs from all created loggers */
  getAllLogs(): LogEntry[] {
    return this.loggers.flatMap((logger) => logger.logs);
  }

  /** Checks if shutdown was called */
  wasShutdownCalled(): boolean {
    return this.shutdownCalled;
  }

  /** Clears all state for test isolation */
  clear(): void {
    this.loggers = [];
    this.lastContext = null;
    this.shutdownCalled = false;
  }
}

/** Singleton mock instances for convenience */
export const mockClientLogger = new MockClientLogger();
export const mockServerLoggerFactory = new MockServerLoggerFactory();
