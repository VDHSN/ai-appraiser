/**
 * Server-side PostHog structured logging implementation.
 * Uses PostHog capture with $log event for unified logging.
 */

import os from "os";
import { PostHog } from "posthog-node";
import type {
  ILogger,
  ILoggerFactory,
  LogLevel,
  LogProperties,
  BaseLogAttributes,
  ContextLogAttributes,
  ServerLoggerContext,
} from "./types";

/** Cached hostname to avoid repeated system calls */
const serverHostname = os.hostname();

/**
 * Sends a log entry to PostHog using the $log event.
 */
function sendLog(
  client: PostHog,
  level: LogLevel,
  message: string,
  attributes: BaseLogAttributes & Partial<ContextLogAttributes>,
  defaultProperties: LogProperties,
  properties: LogProperties = {},
): void {
  const allProperties = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...attributes,
    ...defaultProperties,
    ...properties,
  };

  client.capture({
    distinctId: attributes.distinctId,
    event: "$log",
    properties: allProperties,
  });
}

/**
 * Creates a child logger with inherited attributes and additional default properties.
 */
function createChildLogger(
  client: PostHog,
  attributes: BaseLogAttributes & Partial<ContextLogAttributes>,
  parentDefaults: LogProperties,
  childDefaults: LogProperties,
): ILogger {
  const mergedDefaults = { ...parentDefaults, ...childDefaults };

  return {
    debug: (message, properties) =>
      sendLog(client, "debug", message, attributes, mergedDefaults, properties),
    info: (message, properties) =>
      sendLog(client, "info", message, attributes, mergedDefaults, properties),
    warn: (message, properties) =>
      sendLog(client, "warn", message, attributes, mergedDefaults, properties),
    error: (message, properties) =>
      sendLog(client, "error", message, attributes, mergedDefaults, properties),
    child: (newDefaults) =>
      createChildLogger(client, attributes, mergedDefaults, newDefaults),
  };
}

/**
 * PostHog server logger for request-scoped logging.
 * Created via factory with fixed context for the request lifetime.
 */
class PostHogServerLogger implements ILogger {
  constructor(
    private client: PostHog,
    private attributes: BaseLogAttributes & Partial<ContextLogAttributes>,
    private defaultProperties: LogProperties = {},
  ) {}

  debug(message: string, properties?: LogProperties): void {
    sendLog(
      this.client,
      "debug",
      message,
      this.attributes,
      this.defaultProperties,
      properties,
    );
  }

  info(message: string, properties?: LogProperties): void {
    sendLog(
      this.client,
      "info",
      message,
      this.attributes,
      this.defaultProperties,
      properties,
    );
  }

  warn(message: string, properties?: LogProperties): void {
    sendLog(
      this.client,
      "warn",
      message,
      this.attributes,
      this.defaultProperties,
      properties,
    );
  }

  error(message: string, properties?: LogProperties): void {
    sendLog(
      this.client,
      "error",
      message,
      this.attributes,
      this.defaultProperties,
      properties,
    );
  }

  child(defaultProperties: LogProperties): ILogger {
    return createChildLogger(
      this.client,
      this.attributes,
      this.defaultProperties,
      defaultProperties,
    );
  }
}

// ServerLoggerContext is defined in types.ts

/**
 * Factory for creating request-scoped server loggers.
 * Maintains a single PostHog client instance for efficiency.
 */
class PostHogServerLoggerFactory implements ILoggerFactory {
  private client: PostHog;

  constructor(apiKey: string, options?: { host?: string }) {
    this.client = new PostHog(apiKey, {
      host: options?.host,
      flushAt: 1,
      flushInterval: 0,
    });
  }

  /**
   * Creates a request-scoped logger with the given context.
   * Server-side logs always have pageURL as null.
   */
  create(context: ServerLoggerContext): ILogger {
    const attributes: BaseLogAttributes & Partial<ContextLogAttributes> = {
      hostname: serverHostname,
      pageURL: null,
      distinctId: context.distinctId,
      source: "server",
      sessionId: context.sessionId ?? null,
      agentId: context.agentId ?? null,
      isRestored: context.isRestored ?? false,
      restoredSessionId: context.restoredSessionId ?? null,
    };

    return new PostHogServerLogger(this.client, attributes);
  }

  async shutdown(): Promise<void> {
    await this.client.shutdown();
  }
}

/** Singleton server logger factory instance */
export const serverLoggerFactory: ILoggerFactory =
  new PostHogServerLoggerFactory(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
