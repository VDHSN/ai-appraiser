import type { NextConfig } from "next";
import { withPostHogConfig } from "@posthog/nextjs-config";

const nextConfig: NextConfig = {
  typedRoutes: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.liveauctioneers.com",
      },
    ],
  },
};

const isCI = Boolean(process.env.CI || process.env.VERCEL_ENV);
const hasSourceMapConfig =
  process.env.POSTHOG_PERSONAL_API_KEY && process.env.POSTHOG_ENV_ID;

export default hasSourceMapConfig
  ? withPostHogConfig(nextConfig, {
      personalApiKey: process.env.POSTHOG_PERSONAL_API_KEY!,
      envId: process.env.POSTHOG_ENV_ID!,
      host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      sourcemaps: {
        enabled: isCI,
        deleteAfterUpload: true,
      },
    })
  : nextConfig;
