import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  generateSessionId,
  getAllSessions,
  getRecentSessionSummaries,
  getSession,
  saveSession,
  deleteSession,
  clearAllSessions,
} from "../storage";
import type { ChatSession } from "../types";

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(window, "localStorage", { value: localStorageMock });

describe("chat history storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear();
  });

  afterEach(() => {
    localStorageMock.clear();
  });

  describe("generateSessionId", () => {
    it("generates unique session IDs", () => {
      const id1 = generateSessionId();
      const id2 = generateSessionId();
      expect(id1).not.toBe(id2);
    });

    it("generates IDs starting with 'chat-'", () => {
      const id = generateSessionId();
      expect(id.startsWith("chat-")).toBe(true);
    });
  });

  describe("getAllSessions", () => {
    it("returns empty array when no sessions exist", () => {
      expect(getAllSessions()).toEqual([]);
    });

    it("returns sessions from localStorage", () => {
      const sessions: ChatSession[] = [
        {
          id: "test-1",
          preview: "Test Chat",
          agentId: "curator",
          createdAt: 1000,
          updatedAt: 2000,
          messages: [],
        },
      ];
      localStorageMock.setItem(
        "ai-appraiser-chat-history",
        JSON.stringify(sessions),
      );

      expect(getAllSessions()).toEqual(sessions);
    });

    it("returns empty array on parse error", () => {
      localStorageMock.setItem("ai-appraiser-chat-history", "invalid json");
      expect(getAllSessions()).toEqual([]);
    });
  });

  describe("saveSession", () => {
    it("saves a new session", () => {
      saveSession(
        "test-1",
        "curator",
        [{ id: "msg-1", role: "user", parts: [] }],
        "Test Chat",
      );

      const sessions = getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBe("test-1");
      expect(sessions[0].preview).toBe("Test Chat");
      expect(sessions[0].agentId).toBe("curator");
    });

    it("updates an existing session", () => {
      saveSession(
        "test-1",
        "curator",
        [{ id: "msg-1", role: "user", parts: [] }],
        "First",
      );
      saveSession(
        "test-1",
        "appraiser",
        [{ id: "msg-2", role: "user", parts: [] }],
        "Updated",
      );

      const sessions = getAllSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].preview).toBe("Updated");
      expect(sessions[0].agentId).toBe("appraiser");
    });

    it("does not save empty messages", () => {
      saveSession("test-1", "curator", [], "Test");
      expect(getAllSessions()).toHaveLength(0);
    });
  });

  describe("getSession", () => {
    it("returns null for non-existent session", () => {
      expect(getSession("non-existent")).toBeNull();
    });

    it("returns the session by ID", () => {
      saveSession(
        "test-1",
        "curator",
        [{ id: "msg-1", role: "user", parts: [] }],
        "Test",
      );

      const session = getSession("test-1");
      expect(session).not.toBeNull();
      expect(session?.id).toBe("test-1");
    });
  });

  describe("getRecentSessionSummaries", () => {
    it("returns sessions sorted by updatedAt descending", () => {
      saveSession(
        "old",
        "curator",
        [{ id: "msg-1", role: "user", parts: [] }],
        "Old Chat",
      );

      // Advance time
      vi.spyOn(Date, "now").mockReturnValue(Date.now() + 1000);
      saveSession(
        "new",
        "appraiser",
        [{ id: "msg-2", role: "user", parts: [] }],
        "New Chat",
      );

      const summaries = getRecentSessionSummaries(5);
      expect(summaries[0].id).toBe("new");
      expect(summaries[1].id).toBe("old");

      vi.restoreAllMocks();
    });

    it("limits results to specified count", () => {
      for (let i = 0; i < 10; i++) {
        saveSession(
          `session-${i}`,
          "curator",
          [{ id: `msg-${i}`, role: "user", parts: [] }],
          `Chat ${i}`,
        );
      }

      const summaries = getRecentSessionSummaries(5);
      expect(summaries).toHaveLength(5);
    });

    it("returns only summary fields", () => {
      saveSession(
        "test-1",
        "curator",
        [{ id: "msg-1", role: "user", parts: [] }],
        "Test",
      );

      const summaries = getRecentSessionSummaries(5);
      expect(summaries[0]).toEqual({
        id: "test-1",
        preview: "Test",
        agentId: "curator",
        updatedAt: expect.any(Number),
      });
    });
  });

  describe("deleteSession", () => {
    it("removes a session by ID", () => {
      saveSession(
        "test-1",
        "curator",
        [{ id: "msg-1", role: "user", parts: [] }],
        "Test",
      );
      expect(getAllSessions()).toHaveLength(1);

      deleteSession("test-1");
      expect(getAllSessions()).toHaveLength(0);
    });

    it("does nothing for non-existent session", () => {
      saveSession(
        "test-1",
        "curator",
        [{ id: "msg-1", role: "user", parts: [] }],
        "Test",
      );
      deleteSession("non-existent");
      expect(getAllSessions()).toHaveLength(1);
    });
  });

  describe("clearAllSessions", () => {
    it("removes all sessions", () => {
      saveSession(
        "test-1",
        "curator",
        [{ id: "msg-1", role: "user", parts: [] }],
        "Test 1",
      );
      saveSession(
        "test-2",
        "curator",
        [{ id: "msg-2", role: "user", parts: [] }],
        "Test 2",
      );
      expect(getAllSessions()).toHaveLength(2);

      clearAllSessions();
      expect(getAllSessions()).toHaveLength(0);
    });
  });
});
