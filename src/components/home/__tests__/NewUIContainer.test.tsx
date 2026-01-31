import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewUIContainer } from "../NewUIContainer";

// Mock scrollIntoView which isn't available in jsdom
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock analytics
const mockTrack = vi.fn();
vi.mock("@/lib/analytics", () => ({
  analytics: { track: (...args: unknown[]) => mockTrack(...args) },
  getAnalyticsHeaders: () => ({ "x-posthog-distinct-id": "test-distinct-id" }),
}));

// Mock home context
const mockResetToLanding = vi.fn();
const mockHomeState = {
  view: "landing" as "landing" | "chat",
  initialMessage: null as string | null,
  selectedAgent: null as string | null,
  sessionId: null as string | null,
  resumeMessages: null as Array<{ id: string; role: string }> | null,
  startChat: vi.fn(),
  resetToLanding: mockResetToLanding,
};

vi.mock("@/lib/home", () => ({
  useHome: () => mockHomeState,
}));

// Mock agent context
const mockSetAgentId = vi.fn();
const mockAgentState = {
  agentId: "curator" as string,
  setAgentId: mockSetAgentId,
  agent: { name: "Curator", description: "Find items" },
  isHydrated: true,
};

vi.mock("@/lib/agent", () => ({
  useAgent: () => mockAgentState,
}));

// Mock useChat hook with argument capture
const mockSendMessage = vi.fn();
const mockStop = vi.fn();
const mockSetMessages = vi.fn();
const mockChatState = {
  messages: [] as Array<{ id: string; role: string; parts?: unknown[] }>,
  sendMessage: mockSendMessage,
  status: "ready" as string,
  stop: mockStop,
  setMessages: mockSetMessages,
};

// Capture useChat arguments for verification
const useChatCalls: Array<{ id: string | undefined; transport: unknown }> = [];
vi.mock("@ai-sdk/react", () => ({
  useChat: (options: { id?: string; transport?: unknown }) => {
    useChatCalls.push({ id: options?.id, transport: options?.transport });
    return mockChatState;
  },
  UIMessage: {},
}));

// Capture DefaultChatTransport constructor arguments
const transportConstructorCalls: Array<{ api: string; body: unknown }> = [];
vi.mock("ai", () => ({
  DefaultChatTransport: vi.fn().mockImplementation((options) => {
    transportConstructorCalls.push(options);
    return { _options: options };
  }),
}));

// Mock child components to avoid Clerk dependency
vi.mock("@/components/auth", () => ({
  UserMenu: () => <div data-testid="user-menu">User Menu</div>,
}));

vi.mock("@/components/chat/ChatMessage", () => ({
  ChatMessage: ({ message }: { message: { id: string } }) => (
    <div data-testid={`chat-message-${message.id}`}>Message</div>
  ),
}));

vi.mock("@/components/chat/ChatInput", () => ({
  ChatInput: ({
    onSubmit,
    value,
    onChange,
  }: {
    onSubmit: (e: React.FormEvent) => void;
    value: string;
    onChange: (v: string) => void;
  }) => (
    <form data-testid="chat-input" onSubmit={onSubmit}>
      <input
        data-testid="chat-input-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <button type="submit">Send</button>
    </form>
  ),
}));

describe("NewUIContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Clear argument capture arrays
    useChatCalls.length = 0;
    transportConstructorCalls.length = 0;
    // Reset to default state
    mockHomeState.view = "landing";
    mockHomeState.initialMessage = null;
    mockHomeState.selectedAgent = null;
    mockHomeState.sessionId = null;
    mockHomeState.resumeMessages = null;
    mockAgentState.agentId = "curator";
    mockAgentState.isHydrated = true;
    mockChatState.messages = [];
    mockChatState.status = "ready";
  });

  describe("landing view", () => {
    it("renders HomePage when view is landing", () => {
      mockHomeState.view = "landing";
      render(<NewUIContainer />);

      // HomePage contains the brand logo heading
      expect(screen.getByRole("heading")).toBeDefined();
    });

    it("returns null when not hydrated", () => {
      mockAgentState.isHydrated = false;
      const { container } = render(<NewUIContainer />);

      expect(container.firstChild).toBeNull();
    });
  });

  describe("chat view", () => {
    beforeEach(() => {
      mockHomeState.view = "chat";
    });

    it("renders chat interface when view is chat", () => {
      render(<NewUIContainer />);

      expect(screen.getByTestId("chat-input")).toBeDefined();
      expect(screen.getByTestId("user-menu")).toBeDefined();
    });

    it("displays agent name in header", () => {
      render(<NewUIContainer />);

      expect(screen.getByText("Curator")).toBeDefined();
    });

    it("renders messages from chat state", () => {
      mockChatState.messages = [
        { id: "msg-1", role: "user" },
        { id: "msg-2", role: "assistant" },
      ];

      render(<NewUIContainer />);

      expect(screen.getByTestId("chat-message-msg-1")).toBeDefined();
      expect(screen.getByTestId("chat-message-msg-2")).toBeDefined();
    });

    it("shows thinking indicator when status is submitted", () => {
      mockChatState.status = "submitted";
      render(<NewUIContainer />);

      expect(screen.getByText("Thinking...")).toBeDefined();
    });

    it("calls resetToLanding when brand logo is clicked", async () => {
      const user = userEvent.setup();
      render(<NewUIContainer />);

      const logoButton = screen.getByRole("button", {
        name: /return to home/i,
      });
      await user.click(logoButton);

      expect(mockResetToLanding).toHaveBeenCalled();
    });
  });

  describe("initial message sending", () => {
    it("sends initial message when transitioning to chat", () => {
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "Hello, world!";
      mockHomeState.sessionId = "session-123";
      mockChatState.messages = [];

      render(<NewUIContainer />);

      expect(mockSendMessage).toHaveBeenCalledWith({ text: "Hello, world!" });
    });

    it("does not send initial message if messages already exist", () => {
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "Hello, world!";
      mockHomeState.sessionId = "session-123";
      mockChatState.messages = [{ id: "existing", role: "user" }];

      render(<NewUIContainer />);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });

    it("does not send initial message if no initial message provided", () => {
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = null;
      mockHomeState.sessionId = "session-123";
      mockChatState.messages = [];

      render(<NewUIContainer />);

      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("fresh chat session", () => {
    it("clears existing messages when starting a fresh new chat", () => {
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "New message";
      mockHomeState.sessionId = "new-session-456";
      mockHomeState.resumeMessages = null; // Not resuming
      mockChatState.messages = [{ id: "old-msg", role: "user" }]; // Old messages exist

      render(<NewUIContainer />);

      expect(mockSetMessages).toHaveBeenCalledWith([]);
    });

    it("does not clear messages when resuming a chat", () => {
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = null;
      mockHomeState.sessionId = "existing-session";
      mockHomeState.resumeMessages = [{ id: "restored-msg", role: "user" }];
      mockChatState.messages = [];

      render(<NewUIContainer />);

      // setMessages should be called with resume messages, not empty array
      expect(mockSetMessages).not.toHaveBeenCalledWith([]);
    });

    it("does not clear messages when messages array is already empty", () => {
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "New message";
      mockHomeState.sessionId = "new-session-789";
      mockHomeState.resumeMessages = null;
      mockChatState.messages = []; // Already empty

      render(<NewUIContainer />);

      // Should not call setMessages since there's nothing to clear
      expect(mockSetMessages).not.toHaveBeenCalledWith([]);
    });

    it("clears messages with multiple old messages from previous session", () => {
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "Fresh start";
      mockHomeState.sessionId = "brand-new-session";
      mockHomeState.resumeMessages = null;
      mockChatState.messages = [
        { id: "old-1", role: "user" },
        { id: "old-2", role: "assistant" },
        { id: "old-3", role: "user" },
        { id: "old-4", role: "assistant" },
      ]; // Multiple old messages

      render(<NewUIContainer />);

      expect(mockSetMessages).toHaveBeenCalledWith([]);
    });

    it("does not clear messages when sessionId is null", () => {
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "New message";
      mockHomeState.sessionId = null; // No session ID
      mockHomeState.resumeMessages = null;
      mockChatState.messages = [{ id: "old-msg", role: "user" }];

      render(<NewUIContainer />);

      // Should not clear without a valid sessionId
      expect(mockSetMessages).not.toHaveBeenCalledWith([]);
    });

    it("clears messages regardless of agent type", () => {
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "Appraise this item";
      mockHomeState.sessionId = "appraiser-session";
      mockHomeState.selectedAgent = "appraiser";
      mockHomeState.resumeMessages = null;
      mockChatState.messages = [{ id: "curator-old-msg", role: "user" }];

      render(<NewUIContainer />);

      expect(mockSetMessages).toHaveBeenCalledWith([]);
    });

    it("stops streaming when clearing messages for new session", () => {
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "New message";
      mockHomeState.sessionId = "new-session-456";
      mockHomeState.resumeMessages = null;
      mockChatState.messages = [{ id: "old-msg", role: "user" }];

      render(<NewUIContainer />);

      // stop() should be called to abort any lingering stream
      expect(mockStop).toHaveBeenCalled();
      expect(mockSetMessages).toHaveBeenCalledWith([]);
    });
  });

  describe("streaming cleanup", () => {
    it("stops streaming when navigating to landing page", () => {
      mockHomeState.view = "landing";

      render(<NewUIContainer />);

      // stop() should be called when view is landing
      expect(mockStop).toHaveBeenCalled();
    });

    it("stops any active stream before clearing messages", () => {
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "Fresh start";
      mockHomeState.sessionId = "new-session";
      mockHomeState.resumeMessages = null;
      mockChatState.messages = [{ id: "streaming-msg", role: "assistant" }];
      mockChatState.status = "streaming"; // Actively streaming

      render(<NewUIContainer />);

      // stop() should be called before setMessages
      expect(mockStop).toHaveBeenCalled();
      expect(mockSetMessages).toHaveBeenCalledWith([]);
    });
  });

  describe("agent selection from landing", () => {
    it("sets agent when selected agent differs from current", () => {
      mockHomeState.view = "chat";
      mockHomeState.selectedAgent = "appraiser";
      mockAgentState.agentId = "curator";

      render(<NewUIContainer />);

      expect(mockSetAgentId).toHaveBeenCalledWith("appraiser");
    });

    it("does not set agent when selected matches current", () => {
      mockHomeState.view = "chat";
      mockHomeState.selectedAgent = "curator";
      mockAgentState.agentId = "curator";

      render(<NewUIContainer />);

      expect(mockSetAgentId).not.toHaveBeenCalled();
    });
  });

  describe("agent-initiated mode switches", () => {
    it("switches agent when tool invocation result indicates switch", () => {
      mockHomeState.view = "chat";
      mockChatState.messages = [
        {
          id: "msg-1",
          role: "assistant",
          parts: [
            {
              type: "tool-invocation",
              toolName: "switchAgentMode",
              result: { switched: true, targetAgent: "appraiser" },
            },
          ],
        },
      ];

      render(<NewUIContainer />);

      expect(mockSetAgentId).toHaveBeenCalledWith("appraiser");
      expect(mockTrack).toHaveBeenCalledWith("user:agent_switched", {
        from_agent: "curator",
        to_agent: "appraiser",
        source: "agent",
        session_id: null,
        is_restored: undefined,
        restored_session_id: undefined,
      });
    });

    it("does not switch if target agent is current agent", () => {
      mockHomeState.view = "chat";
      mockChatState.messages = [
        {
          id: "msg-1",
          role: "assistant",
          parts: [
            {
              type: "tool-invocation",
              toolName: "switchAgentMode",
              result: { switched: true, targetAgent: "curator" },
            },
          ],
        },
      ];

      render(<NewUIContainer />);

      expect(mockSetAgentId).not.toHaveBeenCalled();
      expect(mockTrack).not.toHaveBeenCalled();
    });

    it("does not switch if switched is false", () => {
      mockHomeState.view = "chat";
      mockChatState.messages = [
        {
          id: "msg-1",
          role: "assistant",
          parts: [
            {
              type: "tool-invocation",
              toolName: "switchAgentMode",
              result: { switched: false, targetAgent: "appraiser" },
            },
          ],
        },
      ];

      render(<NewUIContainer />);

      expect(mockSetAgentId).not.toHaveBeenCalled();
    });

    it("handles output property for backwards compatibility", () => {
      mockHomeState.view = "chat";
      mockChatState.messages = [
        {
          id: "msg-1",
          role: "assistant",
          parts: [
            {
              type: "tool-invocation",
              toolName: "switchAgentMode",
              output: { switched: true, targetAgent: "appraiser" },
            },
          ],
        },
      ];

      render(<NewUIContainer />);

      expect(mockSetAgentId).toHaveBeenCalledWith("appraiser");
    });
  });

  /**
   * Transport/Chat ID Synchronization Tests
   *
   * These tests verify that the chat instance stays synchronized with the transport.
   * The useChat hook only recreates its internal Chat when `id` changes, so we must
   * include all transport-relevant state (like agentId) in the chat ID.
   *
   * Without these tests, a bug where agentId changes but chat ID doesn't would go
   * undetected, causing the chat to use a stale transport with the wrong agentId.
   */
  describe("transport and chat ID synchronization", () => {
    it("creates transport with current agentId in body", () => {
      mockHomeState.view = "chat";
      mockHomeState.sessionId = "session-123";
      mockAgentState.agentId = "curator";

      render(<NewUIContainer />);

      // Verify transport was created with correct agentId
      expect(transportConstructorCalls.length).toBeGreaterThan(0);
      const lastTransport =
        transportConstructorCalls[transportConstructorCalls.length - 1];
      expect(lastTransport.body).toMatchObject({
        agentId: "curator",
        sessionId: "session-123",
      });
    });

    it("creates chat ID that includes both sessionId and agentId", () => {
      mockHomeState.view = "chat";
      mockHomeState.sessionId = "session-456";
      mockAgentState.agentId = "appraiser";

      render(<NewUIContainer />);

      // Verify useChat was called with composite ID
      expect(useChatCalls.length).toBeGreaterThan(0);
      const lastCall = useChatCalls[useChatCalls.length - 1];
      expect(lastCall.id).toBe("session-456-appraiser");
    });

    it("chat ID uses idle prefix when sessionId is null", () => {
      mockHomeState.view = "chat";
      mockHomeState.sessionId = null;
      mockAgentState.agentId = "curator";

      render(<NewUIContainer />);

      const lastCall = useChatCalls[useChatCalls.length - 1];
      expect(lastCall.id).toBe("idle-curator");
    });

    it("different agentIds produce different chat IDs for same session", () => {
      mockHomeState.view = "chat";
      mockHomeState.sessionId = "session-789";

      // First render with curator
      mockAgentState.agentId = "curator";
      const { rerender } = render(<NewUIContainer />);
      const curatorCallIndex = useChatCalls.length - 1;
      const curatorChatId = useChatCalls[curatorCallIndex].id;

      // Simulate agent change and rerender
      mockAgentState.agentId = "appraiser";
      rerender(<NewUIContainer />);
      const appraiserCallIndex = useChatCalls.length - 1;
      const appraiserChatId = useChatCalls[appraiserCallIndex].id;

      // Critical: chat IDs must be different when agentId changes
      expect(curatorChatId).toBe("session-789-curator");
      expect(appraiserChatId).toBe("session-789-appraiser");
      expect(curatorChatId).not.toBe(appraiserChatId);
    });

    it("transport body updates when agentId changes", () => {
      mockHomeState.view = "chat";
      mockHomeState.sessionId = "session-abc";

      // First render with curator
      mockAgentState.agentId = "curator";
      const { rerender } = render(<NewUIContainer />);

      // Simulate agent change
      mockAgentState.agentId = "appraiser";
      rerender(<NewUIContainer />);

      // Get the most recent transport
      const lastTransport =
        transportConstructorCalls[transportConstructorCalls.length - 1];
      expect(lastTransport.body).toMatchObject({
        agentId: "appraiser",
        sessionId: "session-abc",
      });
    });

    it("chat ID and transport agentId stay synchronized after agent switch", () => {
      mockHomeState.view = "chat";
      mockHomeState.sessionId = "session-sync-test";
      mockAgentState.agentId = "curator";

      const { rerender } = render(<NewUIContainer />);

      // Simulate agent switch
      mockAgentState.agentId = "appraiser";
      rerender(<NewUIContainer />);

      // Get the latest calls
      const lastUseChatCall = useChatCalls[useChatCalls.length - 1];
      const lastTransport =
        transportConstructorCalls[transportConstructorCalls.length - 1];

      // Extract agentId from chat ID (format: sessionId-agentId)
      const chatIdParts = lastUseChatCall.id?.split("-");
      const agentIdFromChatId = chatIdParts?.[chatIdParts.length - 1];

      // Extract agentId from transport body
      const agentIdFromTransport = (lastTransport.body as { agentId: string })
        .agentId;

      // Critical: both must have the same agentId
      expect(agentIdFromChatId).toBe("appraiser");
      expect(agentIdFromTransport).toBe("appraiser");
      expect(agentIdFromChatId).toBe(agentIdFromTransport);
    });

    /**
     * This test would have FAILED with the old code where chat ID was just sessionId.
     * It verifies the fix is working correctly.
     */
    it("REGRESSION: chat ID must change when agentId changes (caught transport desync bug)", () => {
      mockHomeState.view = "chat";
      mockHomeState.sessionId = "regression-test-session";
      mockAgentState.agentId = "curator";

      const { rerender } = render(<NewUIContainer />);
      const initialChatId = useChatCalls[useChatCalls.length - 1].id;

      // Agent changes (e.g., from switchAgentMode tool call)
      mockAgentState.agentId = "appraiser";
      rerender(<NewUIContainer />);
      const newChatId = useChatCalls[useChatCalls.length - 1].id;

      // THE BUG: If chat ID doesn't change, useChat won't recreate its internal
      // Chat instance, and it will continue using the old transport with the
      // wrong agentId. This causes:
      // - Streaming to stop after agent switch
      // - Messages sent with wrong agentId
      // - Server using wrong agent to respond
      expect(newChatId).not.toBe(initialChatId);
      expect(initialChatId).toContain("curator");
      expect(newChatId).toContain("appraiser");
    });
  });

  /**
   * Tests for the chat → landing → chat flow bug.
   * This bug occurs when:
   * 1. Start a new chat thread
   * 2. Navigate back to home page (click appraiser logo)
   * 3. Start a new chat
   * 4. User's chat message doesn't appear in the thread
   */
  describe("chat to landing to chat flow", () => {
    it("REGRESSION: sends initial message when starting second chat after returning from landing", () => {
      // Step 1: Start in chat view (first chat)
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "First message";
      mockHomeState.sessionId = "session-first";
      mockHomeState.resumeMessages = null;
      mockChatState.messages = [];

      const { rerender } = render(<NewUIContainer />);

      // Verify first message was sent
      expect(mockSendMessage).toHaveBeenCalledWith({ text: "First message" });
      mockSendMessage.mockClear();

      // Simulate message arriving (user's message appears)
      mockChatState.messages = [{ id: "msg-1", role: "user" }];
      rerender(<NewUIContainer />);

      // Step 2: Go back to landing page
      mockHomeState.view = "landing";
      mockHomeState.initialMessage = null;
      mockHomeState.sessionId = null;
      rerender(<NewUIContainer />);

      // Step 3: Start a new chat (second session)
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "Second message";
      mockHomeState.sessionId = "session-second";
      mockHomeState.resumeMessages = null;
      // Simulate what useChat should return for a NEW chatId - empty messages
      mockChatState.messages = [];
      rerender(<NewUIContainer />);

      // Step 4: Verify second message was sent
      expect(mockSendMessage).toHaveBeenCalledWith({ text: "Second message" });
    });

    it("REGRESSION: clears messages properly when starting second chat with stale messages", () => {
      // Step 1: First chat with messages
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "First message";
      mockHomeState.sessionId = "session-first";
      mockChatState.messages = [];

      const { rerender } = render(<NewUIContainer />);
      mockSendMessage.mockClear();

      // Simulate messages from first chat
      mockChatState.messages = [
        { id: "msg-1", role: "user" },
        { id: "msg-2", role: "assistant" },
      ];
      rerender(<NewUIContainer />);

      // Step 2: Go to landing
      mockHomeState.view = "landing";
      mockHomeState.initialMessage = null;
      mockHomeState.sessionId = null;
      rerender(<NewUIContainer />);

      // Step 3: Start second chat - but messages array still has old messages
      // This simulates a race condition or stale state in useChat
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "Second message";
      mockHomeState.sessionId = "session-second";
      mockHomeState.resumeMessages = null;
      // Keep old messages to simulate the bug scenario
      // mockChatState.messages stays as [msg-1, msg-2]
      rerender(<NewUIContainer />);

      // Should clear the stale messages
      expect(mockSetMessages).toHaveBeenCalledWith([]);
    });

    it("sends user-typed messages after navigating back from landing", async () => {
      const user = userEvent.setup();

      // Step 1: Start first chat
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "First message";
      mockHomeState.sessionId = "session-first";
      mockChatState.messages = [];

      const { rerender } = render(<NewUIContainer />);
      mockSendMessage.mockClear();

      // Step 2: Go to landing
      mockHomeState.view = "landing";
      mockHomeState.sessionId = null;
      rerender(<NewUIContainer />);

      // Step 3: Start second chat (no initial message, user will type)
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = null;
      mockHomeState.sessionId = "session-second";
      mockChatState.messages = [];
      rerender(<NewUIContainer />);

      // User types and submits a message
      const input = screen.getByTestId("chat-input-field");
      await user.type(input, "Manual message");
      const form = screen.getByTestId("chat-input");
      await user.click(form.querySelector("button")!);

      // Message should be sent
      expect(mockSendMessage).toHaveBeenCalledWith({ text: "Manual message" });
    });

    it("handles multiple round trips between chat and landing", () => {
      // First chat
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "Message 1";
      mockHomeState.sessionId = "session-1";
      mockChatState.messages = [];

      const { rerender } = render(<NewUIContainer />);
      expect(mockSendMessage).toHaveBeenCalledWith({ text: "Message 1" });
      mockSendMessage.mockClear();

      // Back to landing
      mockHomeState.view = "landing";
      mockHomeState.sessionId = null;
      mockHomeState.initialMessage = null;
      rerender(<NewUIContainer />);

      // Second chat
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "Message 2";
      mockHomeState.sessionId = "session-2";
      mockChatState.messages = [];
      rerender(<NewUIContainer />);
      expect(mockSendMessage).toHaveBeenCalledWith({ text: "Message 2" });
      mockSendMessage.mockClear();

      // Back to landing again
      mockHomeState.view = "landing";
      mockHomeState.sessionId = null;
      mockHomeState.initialMessage = null;
      rerender(<NewUIContainer />);

      // Third chat
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "Message 3";
      mockHomeState.sessionId = "session-3";
      mockChatState.messages = [];
      rerender(<NewUIContainer />);
      expect(mockSendMessage).toHaveBeenCalledWith({ text: "Message 3" });
    });

    it("REGRESSION: resets initialization ref even when landing effect is skipped", () => {
      // This test simulates a scenario where the landing effect might not run
      // but a new session is detected - the clear effect should reset the ref

      // Start with first chat complete (simulate hasInitializedRef = true)
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "First message";
      mockHomeState.sessionId = "session-first";
      mockChatState.messages = [];

      const { rerender } = render(<NewUIContainer />);
      expect(mockSendMessage).toHaveBeenCalledWith({ text: "First message" });
      mockSendMessage.mockClear();

      // Simulate messages from first chat
      mockChatState.messages = [{ id: "msg-1", role: "user" }];
      rerender(<NewUIContainer />);

      // Skip to second chat without explicit landing transition
      // This could happen in edge cases where state batching occurs
      mockHomeState.view = "chat";
      mockHomeState.initialMessage = "Second message";
      mockHomeState.sessionId = "session-second";
      mockHomeState.resumeMessages = null;
      mockChatState.messages = []; // New session should have empty messages
      rerender(<NewUIContainer />);

      // Should still send the message because clear effect resets hasInitializedRef
      // when a new session is detected
      expect(mockSendMessage).toHaveBeenCalledWith({ text: "Second message" });
    });

    it("uses stable idle chatId when on landing page", () => {
      // First chat
      mockHomeState.view = "chat";
      mockHomeState.sessionId = "session-1";
      mockAgentState.agentId = "curator";

      const { rerender } = render(<NewUIContainer />);
      const chatChatId = useChatCalls[useChatCalls.length - 1].id;
      expect(chatChatId).toBe("session-1-curator");

      // Go to landing - should use idle ID, not undefined
      mockHomeState.view = "landing";
      mockHomeState.sessionId = null;
      rerender(<NewUIContainer />);
      const landingChatId = useChatCalls[useChatCalls.length - 1].id;
      expect(landingChatId).toBe("idle-curator");

      // New chat - should use new session ID
      mockHomeState.view = "chat";
      mockHomeState.sessionId = "session-2";
      rerender(<NewUIContainer />);
      const newChatChatId = useChatCalls[useChatCalls.length - 1].id;
      expect(newChatChatId).toBe("session-2-curator");
    });
  });
});
