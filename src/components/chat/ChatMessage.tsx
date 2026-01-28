"use client";

import type { UIMessage } from "ai";
import { useEffect, useRef } from "react";
import { Streamdown } from "streamdown";
import { analytics } from "@/lib/analytics";
import { ToolInvocation } from "./ToolInvocation";
import { ThinkingIndicator } from "./ThinkingIndicator";
import { useAgent } from "@/lib/agent";

interface ChatMessageProps {
  message: UIMessage;
}

function isToolPart(
  part: UIMessage["parts"][number],
): part is UIMessage["parts"][number] & {
  toolCallId: string;
  state: string;
  input?: unknown;
  output?: unknown;
} {
  return part.type.startsWith("tool-");
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";
  const { agentId } = useAgent();
  const trackedToolCalls = useRef<Set<string>>(new Set());

  // Track tool calls when they complete
  useEffect(() => {
    for (const part of message.parts) {
      if (isToolPart(part) && part.output !== undefined) {
        if (!trackedToolCalls.current.has(part.toolCallId)) {
          trackedToolCalls.current.add(part.toolCallId);
          const toolName = part.type.replace("tool-", "");
          analytics.track("agent:tool_called", {
            tool_name: toolName,
            tool_params: part.input,
            agent_id: agentId,
            source: "agent",
          });
        }
      }
    }
  }, [message.parts, agentId]);

  return (
    <div
      data-testid={`chat-message-${message.role}`}
      className={`flex ${isUser ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`max-w-[92%] space-y-3 sm:max-w-[85%] ${
          isUser
            ? "rounded-2xl rounded-br-md bg-[var(--accent)] px-3 py-2.5 text-white sm:px-4 sm:py-3"
            : ""
        }`}
      >
        {message.parts.map((part, i) => {
          if (part.type === "text") {
            if (isUser) {
              return (
                <p
                  key={i}
                  className="whitespace-pre-wrap text-sm leading-relaxed"
                >
                  {part.text}
                </p>
              );
            }
            return (
              <Streamdown
                key={i}
                className="text-sm text-zinc-800 dark:text-zinc-200"
              >
                {part.text}
              </Streamdown>
            );
          }

          if (part.type === "reasoning") {
            const reasoningPart = part as {
              type: "reasoning";
              text: string;
              state?: string;
            };
            return (
              <ThinkingIndicator
                key={i}
                text={reasoningPart.text}
                isStreaming={reasoningPart.state === "streaming"}
              />
            );
          }

          if (isToolPart(part)) {
            const toolName = part.type.replace("tool-", "");
            return (
              <ToolInvocation
                key={part.toolCallId}
                toolName={toolName}
                toolCallId={part.toolCallId}
                state={part.state}
                result={part.output}
              />
            );
          }

          return null;
        })}
      </div>
    </div>
  );
}
