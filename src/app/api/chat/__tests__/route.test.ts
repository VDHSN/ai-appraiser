import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing the route
vi.mock("@/lib/analytics/server", () => ({
  serverAnalytics: { track: vi.fn() },
  POSTHOG_DISTINCT_ID_HEADER: "x-posthog-distinct-id",
}));

vi.mock("@/lib/analytics/context", () => ({
  runWithAnalyticsContext: vi.fn((_distinctId, callback) => callback()),
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
  getToolSubset: vi.fn(() => ({})),
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

const mockTrack = vi.mocked(serverAnalytics.track);

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
        undefined, // distinctId from header
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
        undefined, // distinctId from header
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
        undefined, // distinctId from header
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
        undefined, // distinctId from header
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
