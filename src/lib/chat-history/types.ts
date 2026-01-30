/**
 * Types for chat history persistence.
 */

import type { UIMessage } from "@ai-sdk/react";
import type { AgentId } from "@/lib/agent/types";

/**
 * A persisted chat session.
 */
export interface ChatSession {
  /** Unique identifier for the session */
  id: string;
  /** Generated preview/title for the chat */
  preview: string;
  /** The agent used for this chat */
  agentId: AgentId;
  /** When the chat was created */
  createdAt: number;
  /** When the chat was last updated */
  updatedAt: number;
  /** The full message history */
  messages: UIMessage[];
}

/**
 * Summary of a chat session for display in the recent chats list.
 */
export interface ChatSessionSummary {
  id: string;
  preview: string;
  agentId: AgentId;
  updatedAt: number;
}
