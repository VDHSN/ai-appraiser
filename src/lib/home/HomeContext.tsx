"use client";

/**
 * React context for managing the home page state.
 * Tracks transition from landing page to chat view.
 */

import {
  createContext,
  useContext,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AgentId } from "@/lib/agent/types";

export type HomeView = "landing" | "chat";

interface HomeState {
  view: HomeView;
  initialMessage: string | null;
  selectedAgent: AgentId | null;
}

interface HomeContextValue {
  view: HomeView;
  initialMessage: string | null;
  selectedAgent: AgentId | null;
  startChat: (message: string, agent: AgentId) => void;
  resetToLanding: () => void;
}

const HomeContext = createContext<HomeContextValue | null>(null);

// Store state
let state: HomeState = {
  view: "landing",
  initialMessage: null,
  selectedAgent: null,
};

const listeners = new Set<() => void>();

function subscribe(callback: () => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function getSnapshot(): HomeState {
  return state;
}

function getServerSnapshot(): HomeState {
  return {
    view: "landing",
    initialMessage: null,
    selectedAgent: null,
  };
}

function setState(newState: HomeState): void {
  state = newState;
  listeners.forEach((listener) => listener());
}

export function HomeProvider({ children }: { children: ReactNode }) {
  const currentState = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const startChat = useCallback((message: string, agent: AgentId) => {
    setState({
      view: "chat",
      initialMessage: message,
      selectedAgent: agent,
    });
  }, []);

  const resetToLanding = useCallback(() => {
    setState({
      view: "landing",
      initialMessage: null,
      selectedAgent: null,
    });
  }, []);

  return (
    <HomeContext.Provider
      value={{
        view: currentState.view,
        initialMessage: currentState.initialMessage,
        selectedAgent: currentState.selectedAgent,
        startChat,
        resetToLanding,
      }}
    >
      {children}
    </HomeContext.Provider>
  );
}

export function useHome(): HomeContextValue {
  const context = useContext(HomeContext);
  if (!context) {
    throw new Error("useHome must be used within a HomeProvider");
  }
  return context;
}
