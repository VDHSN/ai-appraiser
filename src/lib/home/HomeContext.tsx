"use client";

/**
 * React context for managing the home page state.
 * Tracks transition from landing page to chat view.
 * Supports both new chats and resuming previous sessions.
 */

import {
  createContext,
  useContext,
  useCallback,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { UIMessage } from "@ai-sdk/react";
import type { AgentId } from "@/lib/agent/types";
import { generateSessionId } from "@/lib/chat-history";

export type HomeView = "landing" | "chat";

interface HomeState {
  view: HomeView;
  /** Initial message for new chats */
  initialMessage: string | null;
  /** Selected agent for the chat */
  selectedAgent: AgentId | null;
  /** Current session ID for persistence */
  sessionId: string | null;
  /** Messages to restore when resuming a chat */
  resumeMessages: UIMessage[] | null;
}

interface HomeContextValue {
  view: HomeView;
  initialMessage: string | null;
  selectedAgent: AgentId | null;
  sessionId: string | null;
  resumeMessages: UIMessage[] | null;
  /** Start a new chat with an initial message */
  startChat: (message: string, agent: AgentId) => void;
  /** Resume a previous chat session */
  resumeChat: (
    sessionId: string,
    agent: AgentId,
    messages: UIMessage[],
  ) => void;
  /** Return to landing page */
  resetToLanding: () => void;
}

const HomeContext = createContext<HomeContextValue | null>(null);

// Store state
let state: HomeState = {
  view: "landing",
  initialMessage: null,
  selectedAgent: null,
  sessionId: null,
  resumeMessages: null,
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
    sessionId: null,
    resumeMessages: null,
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
      sessionId: generateSessionId(),
      resumeMessages: null,
    });
  }, []);

  const resumeChat = useCallback(
    (sessionId: string, agent: AgentId, messages: UIMessage[]) => {
      setState({
        view: "chat",
        initialMessage: null,
        selectedAgent: agent,
        sessionId,
        resumeMessages: messages,
      });
    },
    [],
  );

  const resetToLanding = useCallback(() => {
    setState({
      view: "landing",
      initialMessage: null,
      selectedAgent: null,
      sessionId: null,
      resumeMessages: null,
    });
  }, []);

  return (
    <HomeContext.Provider
      value={{
        view: currentState.view,
        initialMessage: currentState.initialMessage,
        selectedAgent: currentState.selectedAgent,
        sessionId: currentState.sessionId,
        resumeMessages: currentState.resumeMessages,
        startChat,
        resumeChat,
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
