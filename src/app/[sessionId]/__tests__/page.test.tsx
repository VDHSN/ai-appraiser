import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, act } from "@testing-library/react";
import { Suspense } from "react";
import SessionPage from "../page";

// Mock analytics
const mockTrack = vi.fn();
vi.mock("@/lib/analytics", () => ({
  analytics: { track: (...args: unknown[]) => mockTrack(...args) },
}));

// Mock next/navigation
const mockPush = vi.fn();
const mockReplace = vi.fn();
const mockSearchParamsGet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}));

// Mock chat-history
const mockValidateSession = vi.fn();
vi.mock("@/lib/chat-history", () => ({
  validateSession: (id: string) => mockValidateSession(id),
  generateSessionId: () => "new-session-123",
  getSession: vi.fn(),
  saveSession: vi.fn(),
  generateChatPreview: vi.fn().mockResolvedValue("Test preview"),
}));

// Mock ChatView component
vi.mock("@/components/home", () => ({
  ChatView: ({
    sessionId,
    initialAgentId,
    resumeMessages,
    initialMessage,
  }: {
    sessionId: string;
    initialAgentId?: string;
    resumeMessages?: unknown[];
    initialMessage?: string;
  }) => (
    <div data-testid="chat-view">
      <span data-testid="session-id">{sessionId}</span>
      <span data-testid="agent-id">{initialAgentId ?? "curator"}</span>
      <span data-testid="initial-message">{initialMessage ?? "none"}</span>
      <span data-testid="resume-messages-count">
        {resumeMessages?.length ?? 0}
      </span>
    </div>
  ),
}));

// Wrapper component with Suspense for use() hook
function TestWrapper({ sessionId }: { sessionId: string }) {
  return (
    <Suspense fallback={<div data-testid="suspense-fallback">Loading...</div>}>
      <SessionPage params={Promise.resolve({ sessionId })} />
    </Suspense>
  );
}

describe("SessionPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
    mockValidateSession.mockReturnValue({
      valid: false,
      session: null,
    });
  });

  describe("new chat flow", () => {
    it("renders ChatView with initial message from URL params", async () => {
      mockSearchParamsGet.mockImplementation((key: string) => {
        if (key === "initial") return "test%20message";
        if (key === "agent") return "appraiser";
        return null;
      });

      await act(async () => {
        render(<TestWrapper sessionId="new-session-123" />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("chat-view")).toBeDefined();
      });

      expect(screen.getByTestId("session-id").textContent).toBe(
        "new-session-123",
      );
      expect(screen.getByTestId("agent-id").textContent).toBe("appraiser");
    });

    it("clears initial message from URL after loading", async () => {
      mockSearchParamsGet.mockImplementation((key: string) => {
        if (key === "initial") return "test%20message";
        return null;
      });

      await act(async () => {
        render(<TestWrapper sessionId="new-session-123" />);
      });

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/new-session-123", {
          scroll: false,
        });
      });
    });
  });

  describe("resume chat flow", () => {
    it("validates session and renders ChatView with messages", async () => {
      const mockSession = {
        id: "existing-session",
        agentId: "curator",
        messages: [
          { id: "msg-1", role: "user", parts: [] },
          { id: "msg-2", role: "assistant", parts: [] },
        ],
      };
      mockValidateSession.mockReturnValue({
        valid: true,
        session: mockSession,
      });

      await act(async () => {
        render(<TestWrapper sessionId="existing-session" />);
      });

      await waitFor(() => {
        expect(screen.getByTestId("chat-view")).toBeDefined();
      });

      expect(screen.getByTestId("session-id").textContent).toBe(
        "existing-session",
      );
      expect(screen.getByTestId("resume-messages-count").textContent).toBe("2");
    });
  });

  describe("session not found", () => {
    it("redirects to landing page with error when session not found", async () => {
      mockValidateSession.mockReturnValue({
        valid: false,
        session: null,
      });

      await act(async () => {
        render(<TestWrapper sessionId="invalid-session" />);
      });

      await waitFor(() => {
        expect(mockReplace).toHaveBeenCalledWith("/?error=session_not_found");
      });
    });

    it("tracks chat:session_not_found analytics event", async () => {
      mockValidateSession.mockReturnValue({
        valid: false,
        session: null,
      });

      await act(async () => {
        render(<TestWrapper sessionId="invalid-session" />);
      });

      await waitFor(() => {
        expect(mockTrack).toHaveBeenCalledWith("chat:session_not_found", {
          session_id: "invalid-session",
          source: "direct_url",
        });
      });
    });
  });
});
