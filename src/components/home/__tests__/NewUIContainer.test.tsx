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

// Mock useChat hook
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

vi.mock("@ai-sdk/react", () => ({
  useChat: () => mockChatState,
  UIMessage: {},
}));

vi.mock("ai", () => ({
  DefaultChatTransport: vi.fn(),
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
});
