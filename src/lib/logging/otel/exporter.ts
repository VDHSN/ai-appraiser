/**
 * PostHog OTLP exporter configuration.
 * Exports logs to PostHog's OTLP endpoint.
 */

import { OTLPLogExporter } from "@opentelemetry/exporter-logs-otlp-http";

const POSTHOG_OTLP_ENDPOINT = "https://us.i.posthog.com/v1/logs";

/**
 * Create OTLP HTTP exporter configured for PostHog.
 */
export function createPostHogExporter(): OTLPLogExporter {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";

  return new OTLPLogExporter({
    url: POSTHOG_OTLP_ENDPOINT,
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
}
