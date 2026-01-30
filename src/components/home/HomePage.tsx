"use client";

/**
 * Landing page component with Google-style search interface.
 * Displays brand logo, search box, and action buttons.
 * Transitions to chat view when user submits a query.
 */

import { UserMenu } from "@/components/auth";
import { BrandLogo } from "./BrandLogo";
import { SearchBox } from "./SearchBox";
import { useHome } from "@/lib/home";
import type { AgentId } from "@/lib/agent/types";

export function HomePage() {
  const { startChat } = useHome();

  const handleSubmit = (message: string, agent: AgentId) => {
    startChat(message, agent);
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
      <main className="flex flex-1 flex-col items-center justify-center px-4 pb-32">
        <div className="flex flex-col items-center gap-10">
          <BrandLogo />

          <p className="max-w-md text-center text-zinc-500 dark:text-zinc-400">
            Discover and appraise rare collectibles with AI-powered insights
          </p>

          <SearchBox onSubmit={handleSubmit} />
        </div>
      </main>
    </div>
  );
}
