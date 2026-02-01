import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the route
vi.mock("@/lib/analytics/server", () => ({
  serverAnalytics: { track: vi.fn() },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: vi.fn(() => Promise.resolve({ userId: "test-user-123" })),
}));

vi.mock("@/lib/analytics/llm", () => ({
  getTracedModel: vi.fn(() => ({})),
}));

vi.mock("ai", () => ({
  streamText: vi.fn(() => ({
    toUIMessageStreamResponse: () => new Response("stream"),
  })),
  convertToModelMessages: vi.fn(() => []),
  stepCountIs: vi.fn(() => () => false),
}));

vi.mock("@/lib/tools", () => ({
  getToolSubsetWithContext: vi.fn(() => ({})),
}));

vi.mock("@/lib/agent", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/agent")>();
  return {
    ...actual,
    getAgent: vi.fn(() => ({
      systemPrompt: "test prompt",
      toolIds: [],
      model: "test-model",
      maxSteps: 5,
    })),
  };
});

import { POST } from "../route";
import { serverAnalytics } from "@/lib/analytics/server";
import { auth } from "@clerk/nextjs/server";
import { getToolSubsetWithContext } from "@/lib/tools";

const mockTrack = vi.mocked(serverAnalytics.track);
const mockAuth = vi.mocked(auth);
const mockGetToolSubsetWithContext = vi.mocked(getToolSubsetWithContext);

describe("Chat API Route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("session field handling", () => {
    it("extracts session fields from request body", async () => {
      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            { id: "1", role: "user", parts: [{ type: "text", text: "hello" }] },
          ],
          agentId: "curator",
          sessionId: "test-session-123",
          isRestored: true,
          restoredSessionId: "test-session-123",
        }),
      });

      await POST(request);

      expect(mockTrack).toHaveBeenCalledWith(
        "chat:user_message",
        expect.objectContaining({
          session_id: "test-session-123",
          is_restored: true,
          restored_session_id: "test-session-123",
        }),
        expect.anything(),
      );
    });

    it("defaults isRestored to false when not provided", async () => {
      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            { id: "1", role: "user", parts: [{ type: "text", text: "hello" }] },
          ],
          agentId: "curator",
          sessionId: "new-session",
        }),
      });

      await POST(request);

      expect(mockTrack).toHaveBeenCalledWith(
        "chat:user_message",
        expect.objectContaining({
          session_id: "new-session",
          is_restored: false,
          restored_session_id: null,
        }),
        expect.anything(),
      );
    });

    it("handles null sessionId", async () => {
      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            { id: "1", role: "user", parts: [{ type: "text", text: "hello" }] },
          ],
          agentId: "curator",
          sessionId: null,
        }),
      });

      await POST(request);

      expect(mockTrack).toHaveBeenCalledWith(
        "chat:user_message",
        expect.objectContaining({
          session_id: null,
          is_restored: false,
          restored_session_id: null,
        }),
        expect.anything(),
      );
    });

    it("includes session fields in user message analytics", async () => {
      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            {
              id: "1",
              role: "user",
              parts: [{ type: "text", text: "test message" }],
            },
          ],
          agentId: "appraiser",
          sessionId: "session-abc",
          isRestored: false,
          restoredSessionId: null,
        }),
      });

      await POST(request);

      expect(mockTrack).toHaveBeenCalledWith(
        "chat:user_message",
        {
          agent_id: "appraiser",
          content: "test message",
          message_length: 12,
          session_id: "session-abc",
          is_restored: false,
          restored_session_id: null,
        },
        "test-user-123",
      );
    });
  });

  describe("user attribution", () => {
    it("passes userId as distinctId to analytics track", async () => {
      mockAuth.mockResolvedValueOnce({ userId: "user-abc-123" } as never);

      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            { id: "1", role: "user", parts: [{ type: "text", text: "hello" }] },
          ],
          agentId: "curator",
        }),
      });

      await POST(request);

      expect(mockTrack).toHaveBeenCalledWith(
        "chat:user_message",
        expect.any(Object),
        "user-abc-123",
      );
    });

    it("passes undefined distinctId when user is not authenticated", async () => {
      mockAuth.mockResolvedValueOnce({ userId: null } as never);

      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [
            { id: "1", role: "user", parts: [{ type: "text", text: "hello" }] },
          ],
          agentId: "curator",
        }),
      });

      await POST(request);

      expect(mockTrack).toHaveBeenCalledWith(
        "chat:user_message",
        expect.any(Object),
        undefined,
      );
    });

    it("passes userId context to tools", async () => {
      mockAuth.mockResolvedValueOnce({ userId: "tool-user-456" } as never);

      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [],
          agentId: "curator",
        }),
      });

      await POST(request);

      expect(mockGetToolSubsetWithContext).toHaveBeenCalledWith(
        expect.any(Array),
        { userId: "tool-user-456" },
      );
    });
  });

  describe("request validation", () => {
    it("returns 400 for invalid request body", async () => {
      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({ invalid: "data" }),
      });

      const response = await POST(request);

      expect(response.status).toBe(400);
    });

    it("accepts valid request with minimal fields", async () => {
      const request = new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: [],
        }),
      });

      const response = await POST(request);

      expect(response.status).not.toBe(400);
    });
  });
});
