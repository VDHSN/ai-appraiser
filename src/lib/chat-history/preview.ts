/**
 * Client-side function to generate chat preview via API.
 * Uses HttpClient interface to abstract fetch.
 */

import type { UIMessage } from "@ai-sdk/react";
import {
  type HttpClient,
  type ChatPreviewResponse,
  createFetchHttpClient,
} from "./interfaces";

// Default HTTP client using fetch
let httpClient: HttpClient = createFetchHttpClient();

/**
 * Set a custom HTTP client (useful for testing).
 */
export function setHttpClient(client: HttpClient): void {
  httpClient = client;
}

/**
 * Reset to the default fetch HTTP client.
 */
export function resetHttpClient(): void {
  httpClient = createFetchHttpClient();
}

/**
 * Extract text content from a UIMessage.
 */
export function extractTextContent(message: UIMessage): string {
  if (!message.parts) return "";
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

/**
 * Format messages for the preview API.
 */
export function formatMessagesForPreview(
  messages: UIMessage[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return messages
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: extractTextContent(m),
    }))
    .filter((m) => m.content.length > 0);
}

/**
 * Generate a fallback preview from the first user message.
 */
export function getFallbackPreview(
  messages: Array<{ role: string; content: string }>,
): string {
  const firstUserMessage = messages.find((m) => m.role === "user");
  if (!firstUserMessage) return "New Chat";

  const content = firstUserMessage.content;
  if (content.length <= 40) return content;
  return content.slice(0, 37) + "...";
}

/**
 * Generate a preview/title for a chat conversation.
 * Falls back to first user message if API fails.
 */
export async function generateChatPreview(
  messages: UIMessage[],
): Promise<string> {
  const formattedMessages = formatMessagesForPreview(messages);

  if (formattedMessages.length === 0) {
    return "New Chat";
  }

  try {
    const data = await httpClient.post<ChatPreviewResponse>(
      "/api/chat-preview",
      { messages: formattedMessages },
    );
    return data.preview || getFallbackPreview(formattedMessages);
  } catch {
    return getFallbackPreview(formattedMessages);
  }
}
