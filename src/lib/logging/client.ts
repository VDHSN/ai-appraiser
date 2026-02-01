/**
 * Browser-side PostHog structured logging implementation.
 * Uses PostHog capture with $log event for unified logging.
 */

import posthog from "posthog-js";
import type {
  ILogger,
  ILoggerWithContext,
  LogLevel,
  LogProperties,
  BaseLogAttributes,
  ContextLogAttributes,
} from "./types";

/** Internal state for client logger */
interface ClientLoggerState {
  distinctId: string;
  context: Partial<ContextLogAttributes>;
}

/** Default state before context is set */
const DEFAULT_STATE: ClientLoggerState = {
  distinctId: "anonymous",
  context: {},
};

/**
 * Builds base attributes for client-side logs.
 * Computes hostname and pageURL from window.location.
 */
function buildBaseAttributes(distinctId: string): BaseLogAttributes {
  return {
    hostname:
      typeof window !== "undefined" ? window.location.hostname : "unknown",
    pageURL: typeof window !== "undefined" ? window.location.href : null,
    distinctId,
    source: "client",
  };
}

/**
 * Sends a log entry to PostHog using the $log event.
 */
function sendLog(
  level: LogLevel,
  message: string,
  state: ClientLoggerState,
  defaultProperties: LogProperties,
  properties: LogProperties = {},
): void {
  const baseAttributes = buildBaseAttributes(state.distinctId);
  const allProperties = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...baseAttributes,
    ...state.context,
    ...defaultProperties,
    ...properties,
  };

  posthog.capture("$log", allProperties);
}

/**
 * Creates a child logger with inherited state and additional default properties.
 */
function createChildLogger(
  state: ClientLoggerState,
  parentDefaults: LogProperties,
  childDefaults: LogProperties,
): ILogger {
  const mergedDefaults = { ...parentDefaults, ...childDefaults };

  return {
    debug: (message, properties) =>
      sendLog("debug", message, state, mergedDefaults, properties),
    info: (message, properties) =>
      sendLog("info", message, state, mergedDefaults, properties),
    warn: (message, properties) =>
      sendLog("warn", message, state, mergedDefaults, properties),
    error: (message, properties) =>
      sendLog("error", message, state, mergedDefaults, properties),
    child: (newDefaults) =>
      createChildLogger(state, mergedDefaults, newDefaults),
  };
}

/**
 * PostHog client logger implementing ILoggerWithContext.
 * Context is set by LoggerProvider to inject session/agent info.
 */
class PostHogClientLogger implements ILoggerWithContext {
  private state: ClientLoggerState = { ...DEFAULT_STATE };
  private defaultProperties: LogProperties = {};

  setContext(
    context: Partial<ContextLogAttributes & { distinctId: string }>,
  ): void {
    const { distinctId, ...contextAttrs } = context;
    if (distinctId !== undefined) {
      this.state.distinctId = distinctId;
    }
    this.state.context = { ...this.state.context, ...contextAttrs };
  }

  debug(message: string, properties?: LogProperties): void {
    sendLog("debug", message, this.state, this.defaultProperties, properties);
  }

  info(message: string, properties?: LogProperties): void {
    sendLog("info", message, this.state, this.defaultProperties, properties);
  }

  warn(message: string, properties?: LogProperties): void {
    sendLog("warn", message, this.state, this.defaultProperties, properties);
  }

  error(message: string, properties?: LogProperties): void {
    sendLog("error", message, this.state, this.defaultProperties, properties);
  }

  child(defaultProperties: LogProperties): ILogger {
    return createChildLogger(
      this.state,
      this.defaultProperties,
      defaultProperties,
    );
  }
}

/** Singleton client logger instance */
export const clientLogger: ILoggerWithContext = new PostHogClientLogger();
