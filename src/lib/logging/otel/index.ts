/**
 * OTEL LoggerProvider singleton.
 * Manages the lifecycle of the OpenTelemetry logging infrastructure.
 */

import {
  LoggerProvider,
  BatchLogRecordProcessor,
} from "@opentelemetry/sdk-logs";
import { resourceFromAttributes } from "@opentelemetry/resources";
import { createPostHogExporter } from "./exporter";
import { buildResourceAttributes } from "./attributes";

let loggerProviderInstance: LoggerProvider | null = null;
let currentOrigin: string | undefined;

/**
 * Create a LoggerProvider with the given origin.
 */
function createProvider(origin?: string): LoggerProvider {
  const resourceAttrs = buildResourceAttributes(origin);
  const resource = resourceFromAttributes(resourceAttrs);
  const exporter = createPostHogExporter();
  const processor = new BatchLogRecordProcessor(exporter, {
    maxExportBatchSize: 512,
    scheduledDelayMillis: 1000,
    exportTimeoutMillis: 30000,
  });

  return new LoggerProvider({
    resource,
    processors: [processor],
  });
}

/**
 * Get or create the singleton LoggerProvider.
 * The origin parameter is used to set host.name attribute.
 */
export function getLoggerProvider(origin?: string): LoggerProvider {
  // If origin changed, rebuild the provider with new resource
  if (loggerProviderInstance && origin && origin !== currentOrigin) {
    // Can't rebuild in-flight, just use existing
    // Resource is set at construction time
  }

  if (!loggerProviderInstance) {
    currentOrigin = origin;
    loggerProviderInstance = createProvider(origin);
  }

  return loggerProviderInstance;
}

/**
 * Shutdown the LoggerProvider and flush pending logs.
 */
export async function shutdownLoggerProvider(): Promise<void> {
  if (loggerProviderInstance) {
    await loggerProviderInstance.shutdown();
    loggerProviderInstance = null;
    currentOrigin = undefined;
  }
}

/**
 * Create a new LoggerProvider with fresh resource for specific origin.
 * Used when origin changes between requests.
 */
export function createLoggerProviderForOrigin(origin: string): LoggerProvider {
  return createProvider(origin);
}
