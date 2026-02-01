"use client";

/**
 * React context for managing the active agent mode.
 * Persists selection to localStorage.
 * Also exposes chat session state for analytics.
 */

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useSyncExternalStore,
  useCallback,
  type ReactNode,
} from "react";
import type { AgentId } from "./types";
import { AgentIdSchema } from "./types";
import { getAgent, getDefaultAgentId } from "./agents";
import type { AgentConfig } from "./types";

const STORAGE_KEY = "apprAIser:agentId";

interface AgentContextValue {
  agentId: AgentId;
  setAgentId: (id: AgentId) => void;
  agent: AgentConfig;
  isHydrated: boolean;
  /**
   * Whether the current chat was restored from history.
   * Note: With URL-based routing, this is now managed by ChatView.
   * Kept for backwards compatibility.
   */
  isRestored: boolean;
  /**
   * Session ID of the restored chat.
   * Note: With URL-based routing, this is now managed by ChatView.
   * Kept for backwards compatibility.
   */
  restoredSessionId: string | null;
}

const AgentContext = createContext<AgentContextValue | null>(null);

function getStoredAgentId(): AgentId {
  if (typeof window === "undefined") {
    return getDefaultAgentId();
  }
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) {
    const parsed = AgentIdSchema.safeParse(stored);
    if (parsed.success) {
      return parsed.data;
    }
  }
  return getDefaultAgentId();
}

// For SSR, always return default
function getServerSnapshot(): AgentId {
  return getDefaultAgentId();
}

// Track subscriptions for storage changes
let listeners: Array<() => void> = [];

function subscribe(listener: () => void) {
  listeners = [...listeners, listener];
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

function notifyListeners() {
  for (const listener of listeners) {
    listener();
  }
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const agentId = useSyncExternalStore(
    subscribe,
    getStoredAgentId,
    getServerSnapshot,
  );

  const [isHydrated, setIsHydrated] = useState(false);

  // Track hydration - this is intentional post-mount state update
  useEffect(() => {
    setIsHydrated(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  const setAgentId = useCallback((id: AgentId) => {
    localStorage.setItem(STORAGE_KEY, id);
    notifyListeners();
  }, []);

  const agent = getAgent(agentId);

  // Session tracking is now managed by ChatView component
  // These values are kept for backwards compatibility but are always false/null
  // Analytics tracking happens in ChatView where session state is known
  return (
    <AgentContext.Provider
      value={{
        agentId,
        setAgentId,
        agent,
        isHydrated,
        isRestored: false,
        restoredSessionId: null,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent(): AgentContextValue {
  const context = useContext(AgentContext);
  if (!context) {
    throw new Error("useAgent must be used within an AgentProvider");
  }
  return context;
}
