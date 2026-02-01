"use client";

/**
 * Landing page component with Google-style search interface.
 * Displays brand logo, search box, and action buttons.
 * Navigates to session page when user submits a query.
 */

import { Suspense } from "react";
import { useRouter } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { generateSessionId } from "@/lib/chat-history";
import { UserMenu } from "@/components/auth";
import { BrandLogo } from "./BrandLogo";
import { SearchBox } from "./SearchBox";
import { RecentChats } from "./RecentChats";
import { ErrorBanner } from "./ErrorBanner";
import type { AgentId } from "@/lib/agent/types";

const DEFAULT_AGENT: AgentId = "curator";

export function HomePage() {
  const router = useRouter();

  const handleSubmit = (message: string, agent: AgentId) => {
    const sessionId = generateSessionId();

    // Track chat started
    analytics.track("chat:started", {
      agent_id: agent,
      session_id: sessionId,
    });

    // Track agent selection if different from default
    if (agent !== DEFAULT_AGENT) {
      analytics.track("user:agent_switched", {
        from_agent: DEFAULT_AGENT,
        to_agent: agent,
        source: "user",
        session_id: sessionId,
        is_restored: false,
        restored_session_id: null,
      });
    }

    // Navigate to session page with initial message
    router.push(
      `/${sessionId}?initial=${encodeURIComponent(message)}&agent=${agent}`,
    );
  };

  return (
    <div className="flex h-screen-dynamic flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header with auth */}
      <header className="safe-area-inset-top flex justify-end px-4 py-3 sm:px-6">
        <div className="safe-area-inset-x">
          <UserMenu />
        </div>
      </header>

      {/* Main content - centered vertically */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-16">
        <div className="flex flex-col items-center gap-10">
          {/* Error banner wrapped in Suspense for useSearchParams */}
          <Suspense fallback={null}>
            <ErrorBanner />
          </Suspense>

          <BrandLogo />

          <p className="max-w-md text-center text-zinc-500 dark:text-zinc-400">
            Discover and appraise rare collectibles with AI-powered insights
          </p>

          <SearchBox onSubmit={handleSubmit} />

          <RecentChats />
        </div>
      </main>
    </div>
  );
}
