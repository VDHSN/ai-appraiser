import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgentProvider, useAgent } from "../AgentContext";

// Test component that displays agent context values
function TestComponent() {
  const { agentId, isRestored, restoredSessionId, isHydrated } = useAgent();

  return (
    <div>
      <span data-testid="agent-id">{agentId}</span>
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

  describe("session state (now managed by ChatView)", () => {
    it("isRestored is always false (session state moved to ChatView)", () => {
      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>,
      );

      // With URL-based routing, session state is managed by ChatView
      // AgentContext no longer tracks session state
      expect(screen.getByTestId("is-restored").textContent).toBe("false");
    });

    it("restoredSessionId is always null (session state moved to ChatView)", () => {
      render(
        <AgentProvider>
          <TestComponent />
        </AgentProvider>,
      );

      expect(screen.getByTestId("restored-session-id").textContent).toBe(
        "null",
      );
    });
  });

  describe("agent selection", () => {
    it("defaults to curator agent", () => {
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
