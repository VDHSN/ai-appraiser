"use client";

/**
 * Container for the new UI experience.
 * Manages transitions between landing page and chat views with animation.
 */

import { useEffect, useRef, useState, FormEvent, useMemo } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { analytics } from "@/lib/analytics";
import { useHome } from "@/lib/home";
import { useAgent } from "@/lib/agent";
import { HomePage } from "./HomePage";
import { ChatMessage } from "@/components/chat/ChatMessage";
import { ChatInput } from "@/components/chat/ChatInput";
import { UserMenu } from "@/components/auth";
import { BrandLogo } from "./BrandLogo";
import type { AgentId } from "@/lib/agent/types";

export function NewUIContainer() {
  const { view, initialMessage, selectedAgent, resetToLanding } = useHome();
  const { agentId, setAgentId, agent, isHydrated } = useAgent();
  const hasInitializedRef = useRef(false);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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
        body: { agentId },
      }),
    [agentId],
  );

  const { messages, sendMessage, status, stop } = useChat({
    transport,
  });

  const isLoading = status === "submitted" || status === "streaming";

  // Send the initial message when transitioning to chat
  useEffect(() => {
    if (
      view === "chat" &&
      initialMessage &&
      !hasInitializedRef.current &&
      messages.length === 0
    ) {
      hasInitializedRef.current = true;
      sendMessage({ text: initialMessage });
    }
  }, [view, initialMessage, messages.length, sendMessage]);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle agent-initiated mode switches
  useEffect(() => {
    for (const message of messages) {
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          if (
            part.type === "tool-invocation" &&
            "toolName" in part &&
            part.toolName === "switchAgentMode"
          ) {
            const partAny = part as Record<string, unknown>;
            const result = (partAny.result ?? partAny.output) as
              | { switched: boolean; targetAgent: AgentId }
              | undefined;
            if (result?.switched && result.targetAgent !== agentId) {
              analytics.track("user:agent_switched", {
                from_agent: agentId,
                to_agent: result.targetAgent,
                source: "agent",
              });
              setAgentId(result.targetAgent);
              return;
            }
          }
        }
      }
    }
  }, [messages, agentId, setAgentId]);

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
