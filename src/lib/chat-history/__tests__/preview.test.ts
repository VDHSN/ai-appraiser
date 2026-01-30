import { describe, it, expect, afterEach } from "vitest";
import type { UIMessage } from "@ai-sdk/react";
import {
  extractTextContent,
  formatMessagesForPreview,
  getFallbackPreview,
  generateChatPreview,
  setHttpClient,
  resetHttpClient,
} from "../preview";
import type { HttpClient, ChatPreviewResponse } from "../interfaces";

/**
 * Create a mock HTTP client for testing.
 */
function createMockHttpClient(
  response?: ChatPreviewResponse,
  shouldThrow = false,
): HttpClient {
  return {
    async post<T>(): Promise<T> {
      if (shouldThrow) {
        throw new Error("Network error");
      }
      return (response ?? { preview: "" }) as T;
    },
  };
}

/**
 * Create a UIMessage with text content.
 */
function createTextMessage(
  role: "user" | "assistant",
  text: string,
): UIMessage {
  return {
    id: `msg-${Date.now()}`,
    role,
    parts: [{ type: "text", text }],
  };
}

describe("preview", () => {
  afterEach(() => {
    resetHttpClient();
  });

  describe("extractTextContent", () => {
    it("extracts text from message parts", () => {
      const message = createTextMessage("user", "Hello world");
      expect(extractTextContent(message)).toBe("Hello world");
    });

    it("joins multiple text parts", () => {
      const message: UIMessage = {
        id: "msg-1",
        role: "user",
        parts: [
          { type: "text", text: "Hello" },
          { type: "text", text: " world" },
        ],
      };
      expect(extractTextContent(message)).toBe("Hello world");
    });

    it("returns empty string for message without parts", () => {
      const message: UIMessage = {
        id: "msg-1",
        role: "user",
        parts: undefined as unknown as UIMessage["parts"],
      };
      expect(extractTextContent(message)).toBe("");
    });

    it("ignores non-text parts", () => {
      const message: UIMessage = {
        id: "msg-1",
        role: "assistant",
        parts: [
          { type: "text", text: "Here is the result" },
          {
            type: "tool-invocation" as "text",
            toolCallId: "call-1",
          } as unknown as { type: "text"; text: string },
        ],
      };
      expect(extractTextContent(message)).toBe("Here is the result");
    });
  });

  describe("formatMessagesForPreview", () => {
    it("formats user and assistant messages", () => {
      const messages: UIMessage[] = [
        createTextMessage("user", "Question"),
        createTextMessage("assistant", "Answer"),
      ];

      const formatted = formatMessagesForPreview(messages);
      expect(formatted).toEqual([
        { role: "user", content: "Question" },
        { role: "assistant", content: "Answer" },
      ]);
    });

    it("filters out system messages", () => {
      const messages: UIMessage[] = [
        {
          id: "msg-1",
          role: "system",
          parts: [{ type: "text", text: "System prompt" }],
        },
        createTextMessage("user", "Question"),
      ];

      const formatted = formatMessagesForPreview(messages);
      expect(formatted).toHaveLength(1);
      expect(formatted[0].role).toBe("user");
    });

    it("filters out messages with empty content", () => {
      const messages: UIMessage[] = [
        createTextMessage("user", "Question"),
        { id: "msg-2", role: "assistant", parts: [] },
      ];

      const formatted = formatMessagesForPreview(messages);
      expect(formatted).toHaveLength(1);
    });
  });

  describe("getFallbackPreview", () => {
    it("returns first user message content", () => {
      const messages = [
        { role: "user", content: "Hello there" },
        { role: "assistant", content: "Hi!" },
      ];
      expect(getFallbackPreview(messages)).toBe("Hello there");
    });

    it("truncates long content to 40 characters", () => {
      const longContent =
        "This is a very long message that exceeds forty characters";
      const messages = [{ role: "user", content: longContent }];

      const preview = getFallbackPreview(messages);
      // Slices at 37 chars + "..." = 40 total
      expect(preview).toBe("This is a very long message that exce...");
      expect(preview.length).toBe(40);
    });

    it("returns 'New Chat' when no user message", () => {
      const messages = [{ role: "assistant", content: "Hi!" }];
      expect(getFallbackPreview(messages)).toBe("New Chat");
    });

    it("returns 'New Chat' for empty messages", () => {
      expect(getFallbackPreview([])).toBe("New Chat");
    });
  });

  describe("generateChatPreview", () => {
    it("returns 'New Chat' for empty messages", async () => {
      const preview = await generateChatPreview([]);
      expect(preview).toBe("New Chat");
    });

    it("returns 'New Chat' for messages without text content", async () => {
      const messages: UIMessage[] = [{ id: "msg-1", role: "user", parts: [] }];
      const preview = await generateChatPreview(messages);
      expect(preview).toBe("New Chat");
    });

    it("returns API preview on successful response", async () => {
      setHttpClient(createMockHttpClient({ preview: "AI Generated Title" }));

      const messages: UIMessage[] = [
        createTextMessage("user", "Tell me about vintage watches"),
        createTextMessage("assistant", "Vintage watches are..."),
      ];

      const preview = await generateChatPreview(messages);
      expect(preview).toBe("AI Generated Title");
    });

    it("returns fallback on API error", async () => {
      setHttpClient(createMockHttpClient(undefined, true));

      const messages: UIMessage[] = [
        createTextMessage("user", "Tell me about vintage watches"),
      ];

      const preview = await generateChatPreview(messages);
      expect(preview).toBe("Tell me about vintage watches");
    });

    it("returns fallback when API returns empty preview", async () => {
      setHttpClient(createMockHttpClient({ preview: "" }));

      const messages: UIMessage[] = [
        createTextMessage("user", "Short question"),
      ];

      const preview = await generateChatPreview(messages);
      expect(preview).toBe("Short question");
    });
  });
});
