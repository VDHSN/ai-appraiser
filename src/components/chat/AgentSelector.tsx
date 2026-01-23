"use client";

/**
 * Tab-style selector for switching between agent modes.
 */

import { useAgent, listAgents } from "@/lib/agent";

export function AgentSelector() {
  const { agentId, setAgentId } = useAgent();
  const agents = listAgents();

  return (
    <div className="flex rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      {agents.map((agent) => {
        const isActive = agent.id === agentId;
        return (
          <button
            key={agent.id}
            onClick={() => setAgentId(agent.id)}
            className={`flex-1 rounded-md px-3 py-2 text-left transition-all ${
              isActive
                ? "bg-white shadow-sm dark:bg-zinc-900"
                : "hover:bg-zinc-200 dark:hover:bg-zinc-700"
            }`}
          >
            <p
              className={`text-sm font-medium ${
                isActive
                  ? "text-zinc-900 dark:text-zinc-100"
                  : "text-zinc-600 dark:text-zinc-400"
              }`}
            >
              {agent.name}
            </p>
            <p
              className={`text-xs ${
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
