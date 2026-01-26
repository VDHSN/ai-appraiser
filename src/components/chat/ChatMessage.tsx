"use client";

import type { UIMessage } from "ai";
import { Streamdown } from "streamdown";
import { ToolInvocation } from "./ToolInvocation";
import { ThinkingIndicator } from "./ThinkingIndicator";

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

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] space-y-3 ${
          isUser
            ? "rounded-2xl rounded-br-md bg-[var(--accent)] px-4 py-3 text-white"
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
