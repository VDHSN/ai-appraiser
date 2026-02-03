/**
 * Edge-compatible logger using OTLP HTTP.
 * Lightweight implementation for Vercel Edge Runtime (middleware).
 * Uses fetch() instead of Node.js-specific OTEL SDK.
 */

import type { ILogger, LogLevel, LogProperties } from "../types";

const POSTHOG_OTLP_ENDPOINT = "https://us.i.posthog.com/v1/logs";

/** OTLP severity numbers */
const SEVERITY_MAP: Record<LogLevel, number> = {
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
};

interface OtlpLogRecord {
  timeUnixNano: string;
  severityNumber: number;
  severityText: string;
  body: { stringValue: string };
  attributes: Array<{
    key: string;
    value: { stringValue?: string; intValue?: string; boolValue?: boolean };
  }>;
}

interface OtlpLogsData {
  resourceLogs: Array<{
    resource: {
      attributes: Array<{
        key: string;
        value: { stringValue: string };
      }>;
    };
    scopeLogs: Array<{
      scope: { name: string };
      logRecords: OtlpLogRecord[];
    }>;
  }>;
}

/**
 * Configuration for edge logger.
 */
export interface EdgeLoggerConfig {
  distinctId: string;
  origin?: string;
  component?: string;
  userId?: string | null;
}

/**
 * Convert properties to OTLP attribute format.
 */
function toOtlpAttributes(
  props: Record<string, unknown>,
): OtlpLogRecord["attributes"] {
  return Object.entries(props)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([key, value]) => {
      if (typeof value === "boolean") {
        return { key, value: { boolValue: value } };
      }
      if (typeof value === "number") {
        return { key, value: { intValue: String(value) } };
      }
      return { key, value: { stringValue: String(value) } };
    });
}

/**
 * Send log record to PostHog OTLP endpoint.
 * Fire-and-forget pattern - doesn't block request.
 */
function sendLog(
  level: LogLevel,
  message: string,
  config: EdgeLoggerConfig,
  defaultProperties: LogProperties,
  properties: LogProperties = {},
): void {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!apiKey) return;

  const allProperties: Record<string, unknown> = {
    "posthog.distinct_id": config.distinctId,
    "app.source": "server",
    "app.component": config.component ?? "middleware",
    ...defaultProperties,
    ...properties,
  };

  if (config.userId) {
    allProperties["user.id"] = config.userId;
  }

  const timeUnixNano = String(Date.now() * 1_000_000);

  const logRecord: OtlpLogRecord = {
    timeUnixNano,
    severityNumber: SEVERITY_MAP[level],
    severityText: level.toUpperCase(),
    body: { stringValue: message },
    attributes: toOtlpAttributes(allProperties),
  };

  const payload: OtlpLogsData = {
    resourceLogs: [
      {
        resource: {
          attributes: [
            {
              key: "service.name",
              value: { stringValue: "auction-proxy-agent" },
            },
            { key: "service.version", value: { stringValue: "0.1.0" } },
            {
              key: "deployment.environment.name",
              value: { stringValue: process.env.VERCEL_ENV ?? "development" },
            },
            {
              key: "host.name",
              value: { stringValue: config.origin ?? "unknown" },
            },
          ],
        },
        scopeLogs: [
          {
            scope: { name: "edge-logger" },
            logRecords: [logRecord],
          },
        ],
      },
    ],
  };

  // Fire and forget
  fetch(POSTHOG_OTLP_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently ignore logging failures in edge
  });
}

/**
 * Edge-compatible logger implementing ILogger interface.
 */
class EdgeLogger implements ILogger {
  constructor(
    private readonly config: EdgeLoggerConfig,
    private readonly defaultProperties: LogProperties = {},
  ) {}

  debug(message: string, properties?: LogProperties): void {
    sendLog("debug", message, this.config, this.defaultProperties, properties);
  }

  info(message: string, properties?: LogProperties): void {
    sendLog("info", message, this.config, this.defaultProperties, properties);
  }

  warn(message: string, properties?: LogProperties): void {
    sendLog("warn", message, this.config, this.defaultProperties, properties);
  }

  error(message: string, properties?: LogProperties): void {
    sendLog("error", message, this.config, this.defaultProperties, properties);
  }

  child(defaultProperties: LogProperties): ILogger {
    return new EdgeLogger(this.config, {
      ...this.defaultProperties,
      ...defaultProperties,
    });
  }
}

/**
 * Create an edge-compatible logger for middleware use.
 */
export function createEdgeLogger(config: EdgeLoggerConfig): ILogger {
  return new EdgeLogger(config);
}
