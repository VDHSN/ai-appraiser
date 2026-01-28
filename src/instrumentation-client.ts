import { analytics } from "@/lib/analytics";

if (!process.env.NEXT_PUBLIC_CI) {
  analytics.init(process.env.NEXT_PUBLIC_POSTHOG_KEY!, {
    host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
  });
}
