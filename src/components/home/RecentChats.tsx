"use client";

/**
 * Displays a list of recent chat sessions on the landing page.
 * Allows users to quickly resume previous conversations.
 */

import { useSyncExternalStore, useCallback } from "react";
import { useHome } from "@/lib/home";
import {
  getRecentSessionSummaries,
  getSession,
  type ChatSessionSummary,
} from "@/lib/chat-history";

/**
 * Format a timestamp as a relative time string.
 */
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
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
 */
function getAgentDisplayName(agentId: string): string {
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

// Cached sessions to maintain referential stability
let cachedSessions: ChatSessionSummary[] = [];
let cachedRaw: string | null = null;

// Subscribe to storage changes
function subscribeToStorage(callback: () => void): () => void {
  // Listen to storage events from other tabs
  const handleStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      // Invalidate cache when storage changes
      cachedRaw = null;
      callback();
    }
  };

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

// Get current sessions snapshot with caching for referential stability
function getSessionsSnapshot(): ChatSessionSummary[] {
  if (typeof window === "undefined") {
    return [];
  }

  const raw = localStorage.getItem(STORAGE_KEY);

  // Return cached value if storage hasn't changed
  if (raw === cachedRaw) {
    return cachedSessions;
  }

  // Update cache and return new sessions
  cachedRaw = raw;
  cachedSessions = getRecentSessionSummaries(5);
  return cachedSessions;
}

// Server snapshot returns empty array
function getServerSessionsSnapshot(): ChatSessionSummary[] {
  return [];
}

export function RecentChats() {
  const { resumeChat } = useHome();

  const sessions = useSyncExternalStore(
    subscribeToStorage,
    getSessionsSnapshot,
    getServerSessionsSnapshot,
  );

  const handleResumeChat = useCallback(
    (sessionId: string) => {
      const session = getSession(sessionId);
      if (session) {
        resumeChat(session.id, session.agentId, session.messages);
      }
    },
    [resumeChat],
  );

  // Don't render if there are no recent sessions
  if (sessions.length === 0) return null;

  return (
    <div className="mt-8 w-full max-w-2xl px-4">
      <h2 className="mb-3 text-center text-sm font-medium text-zinc-500 dark:text-zinc-400">
        Recent Chats
      </h2>
      <div className="space-y-2">
        {sessions.map((session) => (
          <button
            key={session.id}
            onClick={() => handleResumeChat(session.id)}
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
        ))}
      </div>
    </div>
  );
}
