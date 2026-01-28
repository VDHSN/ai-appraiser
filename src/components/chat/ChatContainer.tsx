"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, FormEvent, useMemo } from "react";
import { analytics } from "@/lib/analytics";
import { ChatInput } from "./ChatInput";
import { ChatMessage } from "./ChatMessage";
import { AgentSelector } from "./AgentSelector";
import { UserMenu } from "@/components/auth";
import { useAgent } from "@/lib/agent";
import type { AgentId } from "@/lib/agent";

export function ChatContainer() {
  const { agentId, setAgentId, agent, isHydrated } = useAgent();

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

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle agent-initiated mode switches
  useEffect(() => {
    for (const message of messages) {
      if (message.role === "assistant" && message.parts) {
        for (const part of message.parts) {
          // Check for tool invocation with switchAgentMode
          if (
            part.type === "tool-invocation" &&
            "toolName" in part &&
            part.toolName === "switchAgentMode"
          ) {
            // Try both 'result' and 'output' property names for compatibility
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
              return; // Only switch once
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

  return (
    <div className="flex h-screen-dynamic flex-col bg-zinc-50 dark:bg-zinc-950">
      <header className="safe-area-inset-top border-b border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950 sm:px-6">
        <div className="mx-auto max-w-3xl safe-area-inset-x">
          <div className="flex items-center justify-between gap-3">
            <AgentSelector />
            <UserMenu />
          </div>
        </div>
      </header>

      <main className="scrollbar-thin flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-3xl space-y-4 safe-area-inset-x sm:space-y-6">
          {messages.length === 0 && (
            <div className="py-12 text-center">
              <p className="text-zinc-500 dark:text-zinc-400">
                {agent.placeholder.text}
              </p>
              <p className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
                {agent.placeholder.example}
              </p>
            </div>
          )}
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
