/**
 * Client-side function to generate chat preview via API.
 */

import type { UIMessage } from "@ai-sdk/react";

/**
 * Extract text content from a UIMessage.
 */
function extractTextContent(message: UIMessage): string {
  if (!message.parts) return "";
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * Generate a preview/title for a chat conversation.
 * Falls back to first user message if API fails.
 */
export async function generateChatPreview(
  messages: UIMessage[],
): Promise<string> {
  // Prepare messages for the API
  const formattedMessages = messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: extractTextContent(m),
    }))
    .filter((m) => m.content.length > 0);

  if (formattedMessages.length === 0) {
    return "New Chat";
  }

  try {
    const response = await fetch("/api/chat-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: formattedMessages }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate preview");
    }

    const data = await response.json();
    return data.preview || getFallbackPreview(formattedMessages);
  } catch {
    return getFallbackPreview(formattedMessages);
  }
}

/**
 * Generate a fallback preview from the first user message.
 */
function getFallbackPreview(
  messages: Array<{ role: string; content: string }>,
): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return "New Chat";

  const content = firstUserMessage.content;
  if (content.length <= 40) return content;
  return content.slice(0, 37) + "...";
}
