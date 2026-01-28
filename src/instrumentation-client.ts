import { analytics } from "@/lib/analytics";

// Skip PostHog initialization in CI or when no key is configured
const posthogKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
if (posthogKey && process.env.NODE_ENV !== "test") {
  analytics.init(posthogKey, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}
