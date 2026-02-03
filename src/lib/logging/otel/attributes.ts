/**
 * OTEL resource and attribute mapping utilities.
 * Maps ILogger context to OpenTelemetry semantic conventions.
 */

import {
  SEMRESATTRS_SERVICE_NAME,
  SEMRESATTRS_SERVICE_VERSION,
  SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
  SEMRESATTRS_HOST_NAME,
} from "@opentelemetry/semantic-conventions";
import type { LogProperties, ServerLoggerContext } from "../types";

const SERVICE_NAME = "auction-proxy-agent";
const SERVICE_VERSION = "0.1.0";

/**
 * Build OTEL resource attributes for service identification.
 * Called once at startup.
 */
export function buildResourceAttributes(
  origin?: string,
): Record<string, string> {
  return {
    [SEMRESATTRS_SERVICE_NAME]: SERVICE_NAME,
    [SEMRESATTRS_SERVICE_VERSION]: SERVICE_VERSION,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]:
      process.env.VERCEL_ENV ?? "development",
    [SEMRESATTRS_HOST_NAME]: origin ?? "unknown",
  };
}

/**
 * OTEL attribute keys for app-specific context.
 */
export const ATTR_POSTHOG_DISTINCT_ID = "posthog.distinct_id";
export const ATTR_POSTHOG_SESSION_ID = "posthog.session_id";
export const ATTR_APP_AGENT_ID = "app.agent_id";
export const ATTR_APP_SOURCE = "app.source";
export const ATTR_APP_COMPONENT = "app.component";

/**
 * Map ServerLoggerContext to OTEL log attributes.
 */
export function mapContextToAttributes(
  context: ServerLoggerContext,
): Record<string, string | boolean | number> {
  const attrs: Record<string, string | boolean | number> = {
    [ATTR_POSTHOG_DISTINCT_ID]: context.distinctId,
    [ATTR_APP_SOURCE]: "server",
  };

  if (context.sessionId) {
    attrs[ATTR_POSTHOG_SESSION_ID] = context.sessionId;
  }
  if (context.agentId) {
    attrs[ATTR_APP_AGENT_ID] = context.agentId;
  }
  if (context.component) {
    attrs[ATTR_APP_COMPONENT] = context.component;
  }
  if (context.isRestored !== undefined) {
    attrs["app.is_restored"] = context.isRestored;
  }
  if (context.restoredSessionId) {
    attrs["app.restored_session_id"] = context.restoredSessionId;
  }

  return attrs;
}

/**
 * Flatten LogProperties to OTEL-compatible attributes.
 * Nested objects are serialized as JSON strings.
 */
export function flattenProperties(
  properties: LogProperties,
): Record<string, string | boolean | number> {
  const result: Record<string, string | boolean | number> = {};

  for (const [key, value] of Object.entries(properties)) {
    if (value === null || value === undefined) {
      continue;
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      result[key] = value;
    } else {
      // Serialize complex types as JSON
      result[key] = JSON.stringify(value);
    }
  }

  return result;
}
