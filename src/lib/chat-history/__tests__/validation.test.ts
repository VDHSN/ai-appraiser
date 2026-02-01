import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { validateSession } from "../validation";
import {
  setStorageProvider,
  resetStorageProvider,
  saveSession,
} from "../storage";
import { createMemoryStorageProvider } from "../interfaces";
import type { UIMessage } from "@ai-sdk/react";

describe("validation", () => {
  let memoryStorage: ReturnType<typeof createMemoryStorageProvider>;

  beforeEach(() => {
    memoryStorage = createMemoryStorageProvider();
    setStorageProvider(memoryStorage);
  });

  afterEach(() => {
    resetStorageProvider();
  });

  describe("validateSession", () => {
    it("returns valid: true with session when session exists", () => {
      // Create a test session
      const messages: UIMessage[] = [
        { id: "msg-1", role: "user", parts: [{ type: "text", text: "Hello" }] },
      ];
      saveSession("test-session-123", "curator", messages, "Test chat");

      const result = validateSession("test-session-123");

      expect(result.valid).toBe(true);
      expect(result.session).not.toBeNull();
      expect(result.session?.id).toBe("test-session-123");
      expect(result.session?.agentId).toBe("curator");
      expect(result.session?.messages).toHaveLength(1);
    });

    it("returns valid: false with null session when session does not exist", () => {
      const result = validateSession("nonexistent-session");

      expect(result.valid).toBe(false);
      expect(result.session).toBeNull();
    });

    it("returns valid: false for empty string session ID", () => {
      const result = validateSession("");

      expect(result.valid).toBe(false);
      expect(result.session).toBeNull();
    });

    it("preserves all session fields when valid", () => {
      const messages: UIMessage[] = [
        {
          id: "msg-1",
          role: "user",
          parts: [{ type: "text", text: "Find vintage watches" }],
        },
        {
          id: "msg-2",
          role: "assistant",
          parts: [{ type: "text", text: "Here are some watches..." }],
        },
      ];
      saveSession(
        "full-session",
        "appraiser",
        messages,
        "Vintage watch discussion",
      );

      const result = validateSession("full-session");

      expect(result.valid).toBe(true);
      expect(result.session?.preview).toBe("Vintage watch discussion");
      expect(result.session?.agentId).toBe("appraiser");
      expect(result.session?.messages).toHaveLength(2);
    });
  });
});
