/**
 * Agent registry with configuration for each available agent.
 */

import type { AgentConfig, AgentId } from "./types";
import { curatorPrompt } from "./prompts/curator";
import { appraiserPrompt } from "./prompts/appraiser";

const agents: Record<AgentId, AgentConfig> = {
  curator: {
    id: "curator",
    name: "Auction Curator",
    description: "Discover collectibles in upcoming auctions",
    systemPrompt: curatorPrompt,
    toolIds: ["searchItems", "getItemDetails", "switchAgentMode"],
    placeholder: {
      text: "Search for auction items",
      example: 'Try: "Find art deco lamps under $500"',
    },
  },
  appraiser: {
    id: "appraiser",
    name: "Appraiser",
    description: "Determine item values using sold items data",
    systemPrompt: appraiserPrompt,
    toolIds: [
      "getPriceHistory",
      "assessValue",
      "getItemDetails",
      "switchAgentMode",
    ],
    placeholder: {
      text: "Ask about item valuations",
      example: 'Try: "What\'s this Tiffany vase worth?"',
    },
  },
};

export function getAgent(id: AgentId): AgentConfig {
  const agent = agents[id];
  if (!agent) {
    throw new Error(`Unknown agent: ${id}`);
  }
  return agent;
}

export function listAgents(): AgentConfig[] {
  return Object.values(agents);
}

export function getDefaultAgentId(): AgentId {
  return "curator";
}
