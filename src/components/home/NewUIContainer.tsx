"use client";

/**
 * Container for the new UI experience.
 * Manages transitions between landing page and chat views with animation.
 */

import { useEffect, useRef, useState, FormEvent, useMemo } from "react";
import { useChat, type UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { analytics } from "@/lib/analytics";
import { useHome } from "@/lib/home";
import { useAgent } from "@/lib/agent";
import { saveSession, generateChatPreview } from "@/lib/chat-history";
import { HomePage } from "./HomePage";
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

export function NewUIContainer() {
  const {
    view,
    initialMessage,
    selectedAgent,
    sessionId,
    resumeMessages,
    resetToLanding,
  } = useHome();
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
    sessionId: string | null;
    agentId: AgentId;
    messages: UIMessage[];
  }>({ sessionId: null, agentId, messages: [] });

  // Track the previous sessionId to detect session changes
  const prevSessionIdRef = useRef<string | null>(null);

  // Reset initialization state when returning to landing page
  useEffect(() => {
    if (view === "landing") {
      hasInitializedRef.current = false;
      hasSavedRef.current = false;
    }
  }, [view]);

  // Set the agent based on the selected agent from landing page
  useEffect(() => {
    if (
      view === "chat" &&
      selectedAgent &&
      selectedAgent !== agentId &&
      !hasInitializedRef.current
    ) {
      setAgentId(selectedAgent);
    }
  }, [view, selectedAgent, agentId, setAgentId]);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
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
  // when the agent changes. The useChat hook only recreates its internal Chat
  // instance when `id` changes, so we must include all transport-relevant
  // state in the ID to keep the Chat and transport synchronized.
  // Use a stable "idle" ID when no session exists to prevent undefined behavior
  // in useChat when transitioning between landing and chat views.
  const chatId = useMemo(() => {
    if (!sessionId) return `idle-${agentId}`;
    return `${sessionId}-${agentId}`;
  }, [sessionId, agentId]);

  const { messages, sendMessage, status, stop, setMessages } = useChat({
    id: chatId,
    transport,
  });

  // Stop any active streaming when leaving chat view
  // This prevents responses from a previous chat bleeding into new sessions
  useEffect(() => {
    if (view === "landing") {
      stop();
    }
  }, [view, stop]);

  // Clear messages when starting a fresh new chat (not resuming)
  // Also handles when sessionId changes (defense in depth with id option)
  useEffect(() => {
    const isNewSession = sessionId !== prevSessionIdRef.current;

    // Reset hasInitializedRef when starting a new session
    // This ensures the send effect can run even if the landing reset effect
    // didn't execute (e.g., due to timing issues or fast navigation)
    if (isNewSession && view === "chat" && sessionId && !resumeMessages) {
      hasInitializedRef.current = false;
    }

    const shouldClearMessages =
      view === "chat" &&
      sessionId &&
      !resumeMessages &&
      !hasInitializedRef.current &&
      (messages.length > 0 || isNewSession);

    if (shouldClearMessages && messages.length > 0) {
      stop(); // Stop any lingering stream from previous session
      setMessages([]);
    }

    // Update the ref after processing
    if (sessionId !== prevSessionIdRef.current) {
      prevSessionIdRef.current = sessionId;
    }
  }, [view, sessionId, resumeMessages, messages.length, setMessages, stop]);

  // Initialize with resume messages when resuming a chat
  useEffect(() => {
    if (
      view === "chat" &&
      resumeMessages &&
      resumeMessages.length > 0 &&
      messages.length === 0 &&
      !hasInitializedRef.current
    ) {
      hasInitializedRef.current = true;
      setMessages(resumeMessages);
    }
  }, [view, resumeMessages, messages.length, setMessages]);

  const isLoading = status === "submitted" || status === "streaming";

  // Send the initial message when transitioning to chat (new chat, not resume)
  useEffect(() => {
    if (
      view === "chat" &&
      initialMessage &&
      !resumeMessages && // Don't send if resuming
      !hasInitializedRef.current &&
      messages.length === 0
    ) {
      hasInitializedRef.current = true;
      sendMessage({ text: initialMessage });
    }
  }, [view, initialMessage, resumeMessages, messages.length, sendMessage]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle agent-initiated mode switches
  useEffect(() => {
    const targetAgent = findAgentSwitchInMessages(messages, agentId);
    if (targetAgent) {
      analytics.track("user:agent_switched", {
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

  // Keep session data ref updated for save on transition
  useEffect(() => {
    sessionDataRef.current = { sessionId, agentId, messages };
  }, [sessionId, agentId, messages]);

  // Save chat session when transitioning from chat to landing
  // Uses cleanup effect to capture data before state is cleared
  useEffect(() => {
    if (view !== "chat") return;

    // Return cleanup function that saves when leaving chat view
    return () => {
      const {
        sessionId: sid,
        agentId: aid,
        messages: msgs,
      } = sessionDataRef.current;
      if (!hasSavedRef.current && sid && msgs.length > 0) {
        hasSavedRef.current = true;
        // Generate preview and save asynchronously
        generateChatPreview(msgs).then((preview) => {
          saveSession(sid, aid, msgs, preview);
        });
      }
    };
  }, [view]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    const text = input;
    setInput("");
    await sendMessage({ text });
  };

  // Don't render until hydrated to prevent flash
  if (!isHydrated) {
    return null;
  }

  // Show landing page
  if (view === "landing") {
    return <HomePage />;
  }

  // Show chat view with animation
  return (
    <div className="flex h-screen-dynamic flex-col bg-zinc-50 dark:bg-zinc-950">
      {/* Header */}
      <header className="safe-area-inset-top border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
        <div className="mx-auto max-w-3xl safe-area-inset-x">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={resetToLanding}
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
            <ChatMessage key={message.id} message={message} />
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
