/**
 * Server-side OTEL structured logging implementation.
 * Uses OpenTelemetry SDK to export logs to PostHog's OTLP endpoint.
 */

import type { ILogger, ILoggerFactory, ServerLoggerContext } from "./types";
import { getLoggerProvider } from "./otel";
import { OtelLogger } from "./otel/logger";
import { mapContextToAttributes } from "./otel/attributes";

/**
 * Factory for creating request-scoped OTEL loggers.
 */
class OtelServerLoggerFactory implements ILoggerFactory {
  /**
   * Creates a request-scoped logger with the given context.
   */
  create(context: ServerLoggerContext): ILogger {
    const provider = getLoggerProvider(context.origin);
    const logger = provider.getLogger("auction-proxy-agent");
    const attributes = mapContextToAttributes(context);

    return new OtelLogger(logger, attributes);
  }

  async shutdown(): Promise<void> {
    const { shutdownLoggerProvider } = await import("./otel");
    await shutdownLoggerProvider();
  }
}

/** Singleton server logger factory instance */
export const serverLoggerFactory: ILoggerFactory =
  new OtelServerLoggerFactory();
