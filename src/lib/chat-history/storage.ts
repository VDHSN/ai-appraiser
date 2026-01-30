/**
 * localStorage service for persisting chat sessions.
 * Uses StorageProvider interface to abstract localStorage access.
 */

import type { UIMessage } from "@ai-sdk/react";
import type { AgentId } from "@/lib/agent/types";
import type { ChatSession, ChatSessionSummary } from "./types";
import { type StorageProvider, createLocalStorageProvider } from "./interfaces";

const STORAGE_KEY = "ai-appraiser-chat-history";
const MAX_SESSIONS = 20;

/** Custom event name for same-tab storage notifications */
export const STORAGE_CHANGE_EVENT = "ai-appraiser-chat-history-change";

/**
 * Notify same-tab subscribers of storage changes.
 * Browser's StorageEvent only fires for cross-tab changes.
 */
function notifySameTabSubscribers(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(STORAGE_CHANGE_EVENT));
  }
}

// Default storage provider using localStorage
let storageProvider: StorageProvider = createLocalStorageProvider();

/**
 * Set a custom storage provider (useful for testing).
 */
export function setStorageProvider(provider: StorageProvider): void {
  storageProvider = provider;
}

/**
 * Reset to the default localStorage provider.
 */
export function resetStorageProvider(): void {
  storageProvider = createLocalStorageProvider();
}

/**
 * Generate a unique session ID.
 */
export function generateSessionId(): string {
  return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get all chat sessions from storage.
 */
export function getAllSessions(): ChatSession[] {
  const data = storageProvider.getItem(STORAGE_KEY);
  if (!data) return [];

  try {
    return JSON.parse(data) as ChatSession[];
  } catch {
    return [];
  }
}

/**
 * Get summaries of the most recent chat sessions.
 */
export function getRecentSessionSummaries(limit = 5): ChatSessionSummary[] {
  return sortSessionsByRecent(getAllSessions())
    .slice(0, limit)
    .map(toSessionSummary);
}

/**
 * Get a specific chat session by ID.
 */
export function getSession(sessionId: string): ChatSession | null {
  return getAllSessions().find((s) => s.id === sessionId) ?? null;
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

  const updatedSessions = upsertSession(sessions, session, existingIndex);
  const trimmedSessions = sortSessionsByRecent(updatedSessions).slice(
    0,
    MAX_SESSIONS,
  );

  storageProvider.setItem(STORAGE_KEY, JSON.stringify(trimmedSessions));
  notifySameTabSubscribers();
}

/**
 * Delete a chat session.
 */
export function deleteSession(sessionId: string): void {
  const sessions = getAllSessions();
  const filtered = sessions.filter((s) => s.id !== sessionId);
  storageProvider.setItem(STORAGE_KEY, JSON.stringify(filtered));
  notifySameTabSubscribers();
}

/**
 * Clear all chat sessions.
 */
export function clearAllSessions(): void {
  storageProvider.removeItem(STORAGE_KEY);
  notifySameTabSubscribers();
}

// Pure helper functions

function sortSessionsByRecent(sessions: ChatSession[]): ChatSession[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt);
}

function toSessionSummary(session: ChatSession): ChatSessionSummary {
  return {
    id: session.id,
    preview: session.preview,
    agentId: session.agentId,
    updatedAt: session.updatedAt,
  };
}

function upsertSession(
  sessions: ChatSession[],
  session: ChatSession,
  existingIndex: number,
): ChatSession[] {
  const result = [...sessions];
  if (existingIndex >= 0) {
    result[existingIndex] = session;
  } else {
    result.push(session);
  }
  return result;
}
