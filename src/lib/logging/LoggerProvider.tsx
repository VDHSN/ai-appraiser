"use client";

/**
 * React context provider for structured logging.
 * Auto-injects context from useAgent and analytics.
 *
 * Note: With URL-based routing, sessionId is page-specific and should be
 * passed as a property in individual log calls from components that have it.
 */

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { analytics } from "@/lib/analytics";
import { useAgent } from "@/lib/agent";
import { clientLogger } from "./client";
import type { ILogger } from "./types";

const LoggerContext = createContext<ILogger | null>(null);

interface LoggerProviderProps {
  children: ReactNode;
}

/**
 * Provides logger context to the component tree.
 * Automatically syncs context from useAgent and analytics.
 *
 * Session-specific context (sessionId) should be passed via log properties
 * in components that have access to it (e.g., ChatView).
 */
export function LoggerProvider({ children }: LoggerProviderProps) {
  const { agentId, isRestored, restoredSessionId } = useAgent();

  // Sync context whenever values change
  useEffect(() => {
    const distinctId = analytics.getDistinctId() ?? "anonymous";

    clientLogger.setContext({
      distinctId,
      agentId,
      isRestored,
      restoredSessionId,
    });
  }, [agentId, isRestored, restoredSessionId]);

  // Memoize the logger to maintain stable reference
  const logger = useMemo<ILogger>(() => clientLogger, []);

  return (
    <LoggerContext.Provider value={logger}>{children}</LoggerContext.Provider>
  );
}

/**
 * Hook to access the logger from context.
 * Must be used within a LoggerProvider.
 */
export function useLogger(): ILogger {
  const logger = useContext(LoggerContext);
  if (!logger) {
    throw new Error("useLogger must be used within a LoggerProvider");
  }
  return logger;
}
