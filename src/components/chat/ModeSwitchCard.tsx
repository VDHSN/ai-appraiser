"use client";

/**
 * Visual card displayed when the AI switches agent modes.
 */

import { getAgent } from "@/lib/agent";
import type { AgentId } from "@/lib/agent";

interface ModeSwitchCardProps {
  targetAgent: AgentId;
  reason: string;
}

export function ModeSwitchCard({ targetAgent, reason }: ModeSwitchCardProps) {
  const agent = getAgent(targetAgent);

  return (
    <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
        <svg
          className="h-4 w-4 text-blue-600 dark:text-blue-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-blue-900 dark:text-blue-100">
          Switched to {agent.name}
        </p>
        <p className="mt-0.5 text-sm text-blue-700 dark:text-blue-300">
          {reason}
        </p>
      </div>
    </div>
  );
}
