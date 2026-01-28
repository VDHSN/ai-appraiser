"use client";

/**
 * Tab-style selector for switching between agent modes.
 */

import { analytics } from "@/lib/analytics";
import { useAgent, listAgents } from "@/lib/agent";

export function AgentSelector() {
  const { agentId, setAgentId } = useAgent();
  const agents = listAgents();

  return (
    <div className="flex min-w-0 flex-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800 sm:flex-initial">
      {agents.map((agent) => {
        const isActive = agent.id === agentId;
        return (
          <button
            key={agent.id}
            onClick={() => {
              if (agent.id !== agentId) {
                analytics.track("user:agent_switched", {
                  from_agent: agentId,
                  to_agent: agent.id,
                  source: "user",
                });
              }
              setAgentId(agent.id);
            }}
            className={`min-w-0 flex-1 rounded-md px-2 py-2 text-left transition-all sm:px-3 ${
              isActive
                ? "bg-white shadow-sm dark:bg-zinc-900"
                : "hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            <p
              className={`truncate text-sm font-medium ${
                isActive
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {agent.name}
            </p>
            <p
              className={`hidden truncate text-xs sm:block ${
                isActive
                  ? "text-zinc-500 dark:text-zinc-400"
                  : "text-zinc-400 dark:text-zinc-500"
              }`}
            >
              {agent.description}
            </p>
          </button>
        );
      })}
    </div>
  );
}
