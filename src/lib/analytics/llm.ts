/**
 * LLM tracing for PostHog analytics.
 * Wraps AI SDK models to capture $ai_generation events.
 */

import { google } from "@ai-sdk/google";
import { withTracing } from "@posthog/ai";
import { PostHog } from "posthog-node";

let posthog: PostHog | null = null;

function getPostHogClient(): PostHog {
  if (!posthog) {
    posthog = new PostHog(process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "", {
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      flushAt: 1,
      flushInterval: 0,
    });
  }
  return posthog;
}

/**
 * Get a traced Google Gemini model for LLM analytics.
 * Automatically captures $ai_generation events to PostHog.
 */
export function getTracedModel(modelId: string) {
  const model = google(modelId);
  return withTracing(model, getPostHogClient(), {});
}

/**
 * Get an untraced model for testing.
 */
export function getMockTracedModel(modelId: string) {
  return google(modelId);
}
