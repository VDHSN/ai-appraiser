/**
 * localStorage service for persisting chat sessions.
 */

import type { UIMessage } from "@ai-sdk/react";
import type { AgentId } from "@/lib/agent/types";
import type { ChatSession, ChatSessionSummary } from "./types";

const STORAGE_KEY = "ai-appraiser-chat-history";
const MAX_SESSIONS = 20; // Keep more than 5 to allow for cleanup

/**
 * Generate a unique session ID.
 */
export function generateSessionId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get all chat sessions from localStorage.
 */
export function getAllSessions(): ChatSession[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data) as ChatSession[];
  } catch {
    return [];
  }
}

/**
 * Get summaries of the most recent chat sessions.
 */
export function getRecentSessionSummaries(limit = 5): ChatSessionSummary[] {
  const sessions = getAllSessions();
  return sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, limit)
    .map(({ id, preview, agentId, updatedAt }) => ({
      id,
      preview,
      agentId,
      updatedAt,
    }));
}

/**
 * Get a specific chat session by ID.
 */
export function getSession(sessionId: string): ChatSession | null {
  const sessions = getAllSessions();
  return sessions.find((s) => s.id === sessionId) ?? null;
}

/**
 * Save or update a chat session.
 */
export function saveSession(
  sessionId: string,
  agentId: AgentId,
  messages: UIMessage[],
  preview: string,
): void {
  if (typeof window === "undefined") return;
  if (messages.length === 0) return;

  const sessions = getAllSessions();
  const existingIndex = sessions.findIndex((s) => s.id === sessionId);
  const now = Date.now();

  const session: ChatSession = {
    id: sessionId,
    preview,
    agentId,
    createdAt: existingIndex >= 0 ? sessions[existingIndex].createdAt : now,
    updatedAt: now,
    messages,
  };

  if (existingIndex >= 0) {
    sessions[existingIndex] = session;
  } else {
    sessions.push(session);
  }

  // Keep only the most recent sessions
  const sortedSessions = sessions
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .slice(0, MAX_SESSIONS);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedSessions));
  } catch {
    // localStorage might be full or unavailable
    console.warn("Failed to save chat session to localStorage");
  }
}

/**
 * Delete a chat session.
 */
export function deleteSession(sessionId: string): void {
  if (typeof window === "undefined") return;

  const sessions = getAllSessions();
  const filtered = sessions.filter((s) => s.id !== sessionId);

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  } catch {
    console.warn("Failed to delete chat session from localStorage");
  }
}

/**
 * Clear all chat sessions.
 */
export function clearAllSessions(): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    console.warn("Failed to clear chat sessions from localStorage");
  }
}
