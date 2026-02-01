"use client";

/**
 * Chat view component displaying the full chat interface.
 * Handles message display, input, loading states, and agent switching.
 * Used by session pages for both new and resumed chats.
 */

import { useEffect, useRef, useState, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { analytics } from "@/lib/analytics";
import { useAgent } from "@/lib/agent";
import { saveSession, generateChatPreview } from "@/lib/chat-history";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { UserMenu } from "@/components/auth";
import { BrandLogo } from "./BrandLogo";
import type { AgentId } from "@/lib/agent/types";

/**
 * Result of an agent switch tool invocation.
 */
interface AgentSwitchResult {
  switched: boolean;
  targetAgent: AgentId;
}

/**
 * Searches messages for an agent switch tool invocation result.
 * Returns the target agent if a switch was requested, null otherwise.
 */
function findAgentSwitchInMessages(
  messages: UIMessage[],
  currentAgentId: AgentId,
): AgentId | null {
  for (const message of messages) {
    if (message.role !== "assistant" || !message.parts) continue;

    for (const part of message.parts) {
      if (
        part.type !== "tool-invocation" ||
        !("toolName" in part) ||
        part.toolName !== "switchAgentMode"
      ) {
        continue;
      }

      const partAny = part as Record<string, unknown>;
      const result = (partAny.result ?? partAny.output) as
        | AgentSwitchResult
        | undefined;

      if (result?.switched && result.targetAgent !== currentAgentId) {
        return result.targetAgent;
      }
    }
  }
  return null;
}

export interface ChatViewProps {
  /** Session ID for this chat */
  sessionId: string;
  /** Initial message to send (for new chats) */
  initialMessage?: string;
  /** Messages to restore (for resumed chats) */
  resumeMessages?: UIMessage[];
  /** Agent ID to use for this chat */
  initialAgentId?: AgentId;
}

export function ChatView({
  sessionId,
  initialMessage,
  resumeMessages,
  initialAgentId,
}: ChatViewProps) {
  const router = useRouter();
  const {
    agentId,
    setAgentId,
    agent,
    isHydrated,
    isRestored,
    restoredSessionId,
  } = useAgent();
  const hasInitializedRef = useRef(false);
  const hasSavedRef = useRef(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Track current session data in refs for saving on unmount/transition
  const sessionDataRef = useRef<{
    sessionId: string;
    agentId: AgentId;
    messages: UIMessage[];
  }>({ sessionId, agentId, messages: [] });

  // Set the agent based on the initial agent from props
  useEffect(() => {
    if (
      initialAgentId &&
      initialAgentId !== agentId &&
      !hasInitializedRef.current
    ) {
      setAgentId(initialAgentId);
    }
  }, [initialAgentId, agentId, setAgentId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: {
          "X-PostHog-DistinctId": analytics.getDistinctId() ?? "",
        },
        body: {
          agentId,
          sessionId,
          isRestored,
          restoredSessionId,
        },
      }),
    [agentId, sessionId, isRestored, restoredSessionId],
  );

  // Create composite chat ID that includes agentId to force chat recreation
  // when the agent changes.
  const chatId = useMemo(() => {
    return `${sessionId}-${agentId}`;
  }, [sessionId, agentId]);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: chatId,
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Initialize with resume messages when resuming a chat
  useEffect(() => {
    if (
      resumeMessages &&
      resumeMessages.length > 0 &&
      messages.length === 0 &&
      !hasInitializedRef.current &&
      (!initialAgentId || initialAgentId === agentId)
    ) {
      hasInitializedRef.current = true;
      setMessages(resumeMessages);
    }
  }, [resumeMessages, messages.length, setMessages, initialAgentId, agentId]);

  // Send the initial message when starting a new chat (not resume)
  // Wait for agent to sync if initialAgentId was specified
  useEffect(() => {
    // Don't send if no initial message or if resuming
    if (!initialMessage || resumeMessages) return;
    // Don't send if already initialized
    if (hasInitializedRef.current) return;
    // Don't send if there are already messages
    if (messages.length > 0) return;
    // Wait for agent to sync if initialAgentId was specified
    if (initialAgentId && initialAgentId !== agentId) return;

    hasInitializedRef.current = true;
    sendMessage({ text: initialMessage });
  }, [
    initialMessage,
    resumeMessages,
    messages.length,
    sendMessage,
    initialAgentId,
    agentId,
  ]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle agent-initiated mode switches
  useEffect(() => {
    const targetAgent = findAgentSwitchInMessages(messages, agentId);
    if (targetAgent) {
      analytics.track("chat:agent_switched", {
        from_agent: agentId,
        to_agent: targetAgent,
        source: "agent",
        session_id: sessionId,
        is_restored: isRestored,
        restored_session_id: restoredSessionId,
      });
      setAgentId(targetAgent);
    }
  }, [messages, agentId, setAgentId, sessionId, isRestored, restoredSessionId]);

  // Keep session data ref updated for save on unmount
  useEffect(() => {
    sessionDataRef.current = { sessionId, agentId, messages };
  }, [sessionId, agentId, messages]);

  // Save chat session on component unmount
  useEffect(() => {
    return () => {
      const {
        sessionId: sid,
        agentId: aid,
        messages: msgs,
      } = sessionDataRef.current;
      if (!hasSavedRef.current && sid && msgs.length > 0) {
        hasSavedRef.current = true;
        generateChatPreview(msgs).then((preview) => {
          saveSession(sid, aid, msgs, preview);
        });
      }
    };
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    await sendMessage({ text });
  };

  const handleLogoClick = () => {
    // Save session before navigating away
    const {
      sessionId: sid,
      agentId: aid,
      messages: msgs,
    } = sessionDataRef.current;
    if (!hasSavedRef.current && sid && msgs.length > 0) {
      hasSavedRef.current = true;
      generateChatPreview(msgs).then((preview) => {
        saveSession(sid, aid, msgs, preview);
      });
    }
    router.push("/");
  };

  // Don't render until hydrated to prevent flash
  if (!isHydrated) {
    return null;
  }

  return (
    <div className="flex h-screen-dynamic flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="safe-area-inset-top border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
        <div className="mx-auto max-w-3xl safe-area-inset-x">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleLogoClick}
              className="transition-opacity hover:opacity-80"
              aria-label="Return to home"
            >
              <BrandLogo size="sm" />
            </button>
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-500 dark:text-zinc-400">
                {agent.name}
              </span>
              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      {/* Messages area */}
      <main className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-3xl space-y-4 safe-area-inset-x sm:space-y-6">
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              sessionId={sessionId}
              isRestored={!!resumeMessages}
            />
          ))}
          {status === "submitted" && (
            <div className="flex items-center gap-2 py-2 text-zinc-500 dark:text-zinc-400">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
              <span>Thinking...</span>
            </div>
          )}
          {status === "streaming" && (
            <div className="flex items-center justify-center gap-2 py-2">
              <span className="h-3 w-3 animate-[bounce_0.6s_ease-in-out_infinite] rounded-full bg-zinc-500 dark:bg-zinc-400 [animation-delay:-0.3s]" />
              <span className="h-3 w-3 animate-[bounce_0.6s_ease-in-out_infinite] rounded-full bg-zinc-500 dark:bg-zinc-400 [animation-delay:-0.15s]" />
              <span className="h-3 w-3 animate-[bounce_0.6s_ease-in-out_infinite] rounded-full bg-zinc-500 dark:bg-zinc-400" />
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </main>

      {/* Chat input */}
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        isLoading={isLoading}
        stop={stop}
      />
    </div>
  );
}
