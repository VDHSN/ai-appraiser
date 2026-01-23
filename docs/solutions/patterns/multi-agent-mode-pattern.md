---
title: Multi-Agent Mode Switching Pattern
category: patterns
tags:
  - multi-agent
  - react-context
  - vercel-ai-sdk
  - localStorage-persistence
  - tool-based-switching
  - useSyncExternalStore
date_solved: 2026-01-23
components:
  - AgentContext
  - AgentSelector
  - ModeSwitchCard
  - Chat API route
  - Tool definitions
technologies:
  - Next.js
  - React 18+
  - TypeScript
  - Vercel AI SDK v6
  - Zod
  - Google Gemini
  - localStorage
related_files:
  - src/lib/agent/AgentContext.tsx
  - src/lib/agent/agents.ts
  - src/lib/agent/types.ts
  - src/lib/tools/index.ts
  - src/components/chat/AgentSelector.tsx
  - src/components/chat/ModeSwitchCard.tsx
  - src/components/chat/ChatContainer.tsx
  - src/app/api/chat/route.ts
---

# Multi-Agent Mode Switching Pattern

A reusable pattern for implementing switchable AI agent modes in Next.js applications using the Vercel AI SDK. Supports both user-initiated (UI) and AI-initiated (tool-based) mode switching with localStorage persistence.

## Problem Statement

Need to support multiple specialized AI agents with:

- Different system prompts per agent
- Different tool subsets per agent
- Seamless switching between agents mid-conversation
- Persistence of user's preferred agent across sessions
- SSR-safe state management

## Architecture Overview

```
src/lib/agent/              # Core agent framework
├── types.ts                # Type definitions
├── agents.ts               # Agent registry/configuration
├── prompts/
│   ├── curator.ts          # Agent 1 system prompt
│   └── appraiser.ts        # Agent 2 system prompt
├── AgentContext.tsx        # React context with localStorage sync
└── index.ts                # Module exports

src/lib/tools/index.ts      # Tool definitions including switchAgentMode

src/components/chat/
├── AgentSelector.tsx       # Manual mode switching UI
├── ModeSwitchCard.tsx      # Visual feedback for AI switches
└── ChatContainer.tsx       # Main chat with switch detection
```

## Implementation

### 1. Type Definitions

```typescript
// src/lib/agent/types.ts
import { z } from "zod";

export const AgentIdSchema = z.enum(["curator", "appraiser"]);
export type AgentId = z.infer<typeof AgentIdSchema>;

export type ToolName =
  | "searchItems"
  | "getItemDetails"
  | "getPriceHistory"
  | "assessValue"
  | "switchAgentMode";

export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  systemPrompt: string;
  toolIds: ToolName[];
  placeholder: { text: string; example: string };
  model?: string;
  maxSteps?: number;
}
```

### 2. Agent Registry

```typescript
// src/lib/agent/agents.ts
const agents: Record<AgentId, AgentConfig> = {
  curator: {
    id: "curator",
    name: "Auction Curator",
    description: "Discover collectibles in upcoming auctions",
    systemPrompt: curatorPrompt,
    toolIds: ["searchItems", "getItemDetails", "switchAgentMode"],
    placeholder: {
      text: "Search for auction items",
      example: 'Try: "Find art deco lamps"',
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
      text: "Ask about valuations",
      example: 'Try: "What\'s this worth?"',
    },
  },
};

export function getAgent(id: AgentId): AgentConfig {
  return agents[id];
}
export function listAgents(): AgentConfig[] {
  return Object.values(agents);
}
export function getDefaultAgentId(): AgentId {
  return "curator";
}
```

### 3. Agent Context with useSyncExternalStore

This is the key pattern for SSR-safe localStorage persistence:

```typescript
// src/lib/agent/AgentContext.tsx
"use client";

import { createContext, useContext, useState, useEffect, useSyncExternalStore, useCallback } from "react";

const STORAGE_KEY = "apprAIser:agentId";

// External store pattern - avoids "Cannot update during render" errors
let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => { listeners = listeners.filter((l) => l !== listener); };
}

function notifyListeners() {
  for (const listener of listeners) listener();
}

function getStoredAgentId(): AgentId {
  if (typeof window === "undefined") return getDefaultAgentId();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = AgentIdSchema.safeParse(stored);
    if (parsed.success) return parsed.data;
  }
  return getDefaultAgentId();
}

function getServerSnapshot(): AgentId {
  return getDefaultAgentId();
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const agentId = useSyncExternalStore(subscribe, getStoredAgentId, getServerSnapshot);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => { setIsHydrated(true); }, []);

  const setAgentId = useCallback((id: AgentId) => {
    localStorage.setItem(STORAGE_KEY, id);
    notifyListeners();
  }, []);

  const agent = getAgent(agentId);

  return (
    <AgentContext.Provider value={{ agentId, setAgentId, agent, isHydrated }}>
      {children}
    </AgentContext.Provider>
  );
}
```

### 4. switchAgentMode Tool

```typescript
// src/lib/tools/index.ts
switchAgentMode: {
  description: "Switch to a DIFFERENT agent mode. Only use to switch to an agent you are NOT currently. After switching, continue helping the user.",
  inputSchema: z.object({
    targetAgent: z.enum(["curator", "appraiser"]).describe("Agent to switch to"),
    reason: z.string().describe("Why switching is appropriate"),
  }),
  execute: async ({ targetAgent, reason }) => ({ switched: true, targetAgent, reason }),
},

// Tool subsetting for per-agent access
export function getToolSubset(toolIds: ToolName[]): Partial<typeof tools> {
  return Object.fromEntries(
    Object.entries(tools).filter(([key]) => toolIds.includes(key as ToolName)),
  );
}
```

### 5. Detecting AI-Initiated Switches

```typescript
// src/components/chat/ChatContainer.tsx
useEffect(() => {
  for (const message of messages) {
    if (message.role === "assistant" && message.parts) {
      for (const part of message.parts) {
        if (
          part.type === "tool-invocation" &&
          "toolName" in part &&
          part.toolName === "switchAgentMode"
        ) {
          // Handle both 'result' and 'output' property names
          const partAny = part as Record<string, unknown>;
          const result = (partAny.result ?? partAny.output) as
            | { switched: boolean; targetAgent: AgentId }
            | undefined;
          if (result?.switched && result.targetAgent !== agentId) {
            setAgentId(result.targetAgent);
            return;
          }
        }
      }
    }
  }
}, [messages, agentId, setAgentId]);
```

### 6. Prompt Self-Switch Prevention

Critical: Each agent's prompt must explicitly prevent self-switching:

```typescript
// In appraiser.ts
export const appraiserPrompt = `You are the **Appraiser** agent...

## When to Switch to Curator

You are already the Appraiser - do NOT switch to appraiser.

Only use switchAgentMode to switch to "curator" if the user wants to find items in auctions.
After switching, continue to help the user with their request.`;
```

## Issues Encountered & Fixes

### 1. React State Update Error

**Problem**: "Cannot update a component while rendering a different component"

**Cause**: Using `useState` + `useEffect` to read localStorage causes state updates during render phase.

**Fix**: Use `useSyncExternalStore` which is designed for external state synchronization.

### 2. Agent Switching to Itself

**Problem**: AI calls `switchAgentMode("appraiser")` when already in appraiser mode.

**Fix**: Add explicit instructions in each prompt:

- State which agent they ARE: "You are the **Appraiser** agent"
- Explicit prohibition: "do NOT switch to appraiser"

### 3. Tab Not Updating on Switch

**Problem**: UI doesn't reflect AI-initiated mode switches.

**Cause**: Tool result property name varies (`result` vs `output`) between SDK versions.

**Fix**: Check both properties with fallback: `partAny.result ?? partAny.output`

## Best Practices

1. **Use `useSyncExternalStore` for external state** - avoids render-phase setState errors
2. **Explicit agent identity in prompts** - prevents self-referential loops
3. **Defensive property access** - handle SDK version differences gracefully
4. **Hydration guards** - prevent flash of default content with `isHydrated` check
5. **Tool subsetting** - each agent only gets relevant tools via `getToolSubset()`
6. **Zod validation** - validate at all boundaries (API, localStorage, tool inputs)

## Testing Recommendations

```typescript
// Test self-switch prevention
it("should not switch to current agent", () => {
  // Verify prompt contains "do NOT switch to [self]"
  expect(appraiserPrompt).toContain("do NOT switch to appraiser");
});

// Test tool subsetting
it("should return correct tools for agent", () => {
  const curatorTools = getToolSubset(agents.curator.toolIds);
  expect(Object.keys(curatorTools)).toContain("searchItems");
  expect(Object.keys(curatorTools)).not.toContain("assessValue");
});

// Test localStorage persistence
it("should persist agent selection", () => {
  const { setAgentId } = renderHook(() => useAgent()).result.current;
  setAgentId("appraiser");
  expect(localStorage.getItem("apprAIser:agentId")).toBe("appraiser");
});
```

## Related Documentation

- [Vercel AI SDK Tool Definitions](https://sdk.vercel.ai/docs/ai-sdk-core/tools-and-tool-calling)
- [React useSyncExternalStore](https://react.dev/reference/react/useSyncExternalStore)
- [System Design](/docs/system-design.md)
