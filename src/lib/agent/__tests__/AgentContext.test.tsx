import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentProvider, useAgent } from "../AgentContext";

// Mock useHome to control session state
const mockUseHome = vi.fn();
vi.mock("@/lib/home", () => ({
  useHome: () => mockUseHome(),
}));

// Test component that displays agent context values
function TestComponent() {
  const { agentId, sessionId, isRestored, restoredSessionId, isHydrated } =
    useAgent();

  return (
    <div>
      <span data-testid="agent-id">{agentId}</span>
      <span data-testid="session-id">{sessionId ?? "null"}</span>
      <span data-testid="is-restored">{String(isRestored)}</span>
      <span data-testid="restored-session-id">
        {restoredSessionId ?? "null"}
      </span>
      <span data-testid="is-hydrated">{String(isHydrated)}</span>
    </div>
  );
}

describe("AgentContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe("session state from HomeContext", () => {
    it("exposes sessionId from HomeContext", () => {
      mockUseHome.mockReturnValue({
        sessionId: "test-session-123",
        resumeMessages: null,
      });

      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>,
      );

      expect(screen.getByTestId("session-id").textContent).toBe(
        "test-session-123",
      );
    });

    it("sets isRestored to false when resumeMessages is null (new chat)", () => {
      mockUseHome.mockReturnValue({
        sessionId: "new-session",
        resumeMessages: null,
      });

      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>,
      );

      expect(screen.getByTestId("is-restored").textContent).toBe("false");
      expect(screen.getByTestId("restored-session-id").textContent).toBe(
        "null",
      );
    });

    it("sets isRestored to true when resumeMessages is present (restored chat)", () => {
      mockUseHome.mockReturnValue({
        sessionId: "restored-session-456",
        resumeMessages: [{ id: "msg-1", role: "user", parts: [] }],
      });

      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>,
      );

      expect(screen.getByTestId("is-restored").textContent).toBe("true");
      expect(screen.getByTestId("restored-session-id").textContent).toBe(
        "restored-session-456",
      );
    });

    it("sets restoredSessionId to sessionId when restored", () => {
      mockUseHome.mockReturnValue({
        sessionId: "my-session",
        resumeMessages: [{ id: "msg-1", role: "user", parts: [] }],
      });

      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>,
      );

      expect(screen.getByTestId("session-id").textContent).toBe("my-session");
      expect(screen.getByTestId("restored-session-id").textContent).toBe(
        "my-session",
      );
    });

    it("sets restoredSessionId to null when not restored", () => {
      mockUseHome.mockReturnValue({
        sessionId: "new-session",
        resumeMessages: null,
      });

      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>,
      );

      expect(screen.getByTestId("session-id").textContent).toBe("new-session");
      expect(screen.getByTestId("restored-session-id").textContent).toBe(
        "null",
      );
    });

    it("handles null sessionId (landing page)", () => {
      mockUseHome.mockReturnValue({
        sessionId: null,
        resumeMessages: null,
      });

      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>,
      );

      expect(screen.getByTestId("session-id").textContent).toBe("null");
      expect(screen.getByTestId("is-restored").textContent).toBe("false");
      expect(screen.getByTestId("restored-session-id").textContent).toBe(
        "null",
      );
    });
  });

  describe("agent selection", () => {
    it("defaults to curator agent", () => {
      mockUseHome.mockReturnValue({
        sessionId: null,
        resumeMessages: null,
      });

      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>,
      );

      expect(screen.getByTestId("agent-id").textContent).toBe("curator");
    });
  });

  describe("hydration", () => {
    it("becomes hydrated after mount", async () => {
      mockUseHome.mockReturnValue({
        sessionId: null,
        resumeMessages: null,
      });

      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>,
      );

      // After render, should be hydrated
      expect(screen.getByTestId("is-hydrated").textContent).toBe("true");
    });
  });
});
