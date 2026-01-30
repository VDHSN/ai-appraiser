"use client";

/**
 * Displays a list of recent chat sessions on the landing page.
 * Allows users to quickly resume previous conversations.
 * Supports swipe-to-delete on mobile and trash icon on desktop.
 */

import { useSyncExternalStore, useCallback, useState } from "react";
import { analytics } from "@/lib/analytics";
import { useHome } from "@/lib/home";
import {
  getRecentSessionSummaries,
  getSession,
  deleteSession,
  STORAGE_CHANGE_EVENT,
  type ChatSessionSummary,
} from "@/lib/chat-history";
import { SwipeableChatItem } from "./SwipeableChatItem";

/**
 * Format a timestamp as a relative time string.
 * Exported for testing.
 */
export function formatRelativeTime(
  timestamp: number,
  now = Date.now(),
): string {
  const diff = now - timestamp;

  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return new Date(timestamp).toLocaleDateString();
}

/**
 * Get the display name for an agent.
 * Exported for testing.
 */
export function getAgentDisplayName(agentId: string): string {
  switch (agentId) {
    case "curator":
      return "Curator";
    case "appraiser":
      return "Appraiser";
    default:
      return agentId;
  }
}

// Storage key used by the chat history module
const STORAGE_KEY = "ai-appraiser-chat-history";

// Cached sessions to maintain referential stability for useSyncExternalStore
let cachedSessions: ChatSessionSummary[] = [];
let cachedSessionsJson: string = "[]";

/**
 * Reset the cache (useful for testing).
 */
export function resetSessionsCache(): void {
  cachedSessions = [];
  cachedSessionsJson = "[]";
}

// Subscribe to storage changes (both cross-tab and same-tab)
function subscribeToStorage(callback: () => void): () => void {
  // Invalidate cache on mount to pick up same-tab changes (e.g., after saving a chat)
  cachedSessionsJson = "";

  const handleStorageChange = () => {
    cachedSessionsJson = "";
    callback();
  };

  // Cross-tab changes via browser StorageEvent
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      handleStorageChange();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    // Same-tab changes via custom event from storage module
    window.addEventListener(STORAGE_CHANGE_EVENT, handleStorageChange);
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener(STORAGE_CHANGE_EVENT, handleStorageChange);
    }
  };
}

// Get current sessions snapshot with caching for referential stability
function getSessionsSnapshot(): ChatSessionSummary[] {
  if (typeof window === "undefined") {
    return [];
  }

  // Use the storage module which uses the abstracted StorageProvider
  const sessions = getRecentSessionSummaries(5);

  // Simple caching based on JSON comparison to maintain referential stability
  const sessionsJson = JSON.stringify(sessions);
  if (sessionsJson === cachedSessionsJson) {
    return cachedSessions;
  }

  cachedSessionsJson = sessionsJson;
  cachedSessions = sessions;
  return cachedSessions;
}

// Server snapshot returns empty array
function getServerSessionsSnapshot(): ChatSessionSummary[] {
  return [];
}

export function RecentChats() {
  const { resumeChat } = useHome();
  const [activeSwipedId, setActiveSwipedId] = useState<string | null>(null);

  const sessions = useSyncExternalStore(
    subscribeToStorage,
    getSessionsSnapshot,
    getServerSessionsSnapshot,
  );

  const handleResumeChat = useCallback(
    (sessionId: string, preview: string) => {
      const session = getSession(sessionId);
      if (session) {
        analytics.track("chat:restored", {
          chat_title: preview,
          agent_id: session.agentId,
          session_id: session.id,
        });
        resumeChat(session.id, session.agentId, session.messages);
      }
    },
    [resumeChat],
  );

  const handleSwipeOpen = useCallback((id: string) => {
    setActiveSwipedId(id);
  }, []);

  const handleDelete = useCallback((sessionId: string) => {
    const session = getSession(sessionId);
    if (session) {
      analytics.track("chat:deleted", {
        chat_title: session.preview,
        agent_id: session.agentId,
        session_id: session.id,
      });
    }
    deleteSession(sessionId);
    setActiveSwipedId(null);
  }, []);

  if (sessions.length === 0) return null;

  return (
    <div className="mt-8 w-full max-w-2xl px-4">
      <h2 className="mb-3 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Recent Chats
      </h2>
      <div className="space-y-2">
        {sessions.map((session) => (
          <SwipeableChatItem
            key={session.id}
            id={session.id}
            isActive={activeSwipedId === session.id}
            onSwipeOpen={handleSwipeOpen}
            onDelete={handleDelete}
          >
            <button
              onClick={() => handleResumeChat(session.id, session.preview)}
              className="flex w-full items-center gap-3 rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
              data-testid="recent-chat-item"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {session.preview}
                </p>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  {formatRelativeTime(session.updatedAt)}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {getAgentDisplayName(session.agentId)}
              </span>
            </button>
          </SwipeableChatItem>
        ))}
      </div>
    </div>
  );
}
