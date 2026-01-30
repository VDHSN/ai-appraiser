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
    <div
      className="flex items-start gap-3 rounded-lg border p-4"
      style={{
        borderColor: "var(--accent-muted)",
        backgroundColor: "var(--accent-subtle)",
      }}
    >
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full"
        style={{ backgroundColor: "var(--accent-muted)" }}
      >
        <svg
          className="h-4 w-4"
          style={{ color: "var(--accent)" }}
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
        <p
          className="text-sm font-medium"
          style={{ color: "var(--accent-foreground)" }}
        >
          Switched to {agent.name}
        </p>
        <p
          className="mt-0.5 text-sm"
          style={{ color: "var(--accent-foreground-muted)" }}
        >
          {reason}
        </p>
      </div>
    </div>
  );
}
