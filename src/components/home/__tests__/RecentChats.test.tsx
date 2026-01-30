import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RecentChats,
  formatRelativeTime,
  getAgentDisplayName,
  resetSessionsCache,
} from "../RecentChats";
import {
  setStorageProvider,
  resetStorageProvider,
  createMemoryStorageProvider,
} from "@/lib/chat-history";

// Mock dependencies
const mockResumeChat = vi.fn();
vi.mock("@/lib/home", () => ({
  useHome: () => ({
    resumeChat: mockResumeChat,
  }),
}));

describe("RecentChats", () => {
  let memoryStorage: ReturnType<typeof createMemoryStorageProvider>;

  beforeEach(() => {
    vi.clearAllMocks();
    memoryStorage = createMemoryStorageProvider();
    setStorageProvider(memoryStorage);
    resetSessionsCache();
  });

  afterEach(() => {
    resetStorageProvider();
    resetSessionsCache();
  });

  describe("formatRelativeTime", () => {
    const NOW = 1706600000000; // Fixed timestamp for testing

    it("returns 'Just now' for timestamps less than 1 minute ago", () => {
      expect(formatRelativeTime(NOW - 30000, NOW)).toBe("Just now");
    });

    it("returns minutes for timestamps less than 1 hour ago", () => {
      expect(formatRelativeTime(NOW - 5 * 60000, NOW)).toBe("5m ago");
      expect(formatRelativeTime(NOW - 45 * 60000, NOW)).toBe("45m ago");
    });

    it("returns hours for timestamps less than 24 hours ago", () => {
      expect(formatRelativeTime(NOW - 2 * 3600000, NOW)).toBe("2h ago");
      expect(formatRelativeTime(NOW - 23 * 3600000, NOW)).toBe("23h ago");
    });

    it("returns days for timestamps less than 7 days ago", () => {
      expect(formatRelativeTime(NOW - 1 * 86400000, NOW)).toBe("1d ago");
      expect(formatRelativeTime(NOW - 6 * 86400000, NOW)).toBe("6d ago");
    });

    it("returns formatted date for timestamps 7+ days ago", () => {
      const oldTimestamp = NOW - 10 * 86400000;
      const result = formatRelativeTime(oldTimestamp, NOW);
      // Should be a date string (locale dependent)
      expect(result).toMatch(/\d/);
      expect(result).not.toContain("ago");
    });
  });

  describe("getAgentDisplayName", () => {
    it("returns 'Curator' for curator agent", () => {
      expect(getAgentDisplayName("curator")).toBe("Curator");
    });

    it("returns 'Appraiser' for appraiser agent", () => {
      expect(getAgentDisplayName("appraiser")).toBe("Appraiser");
    });

    it("returns the agentId for unknown agents", () => {
      expect(getAgentDisplayName("unknown-agent")).toBe("unknown-agent");
    });
  });

  describe("RecentChats component", () => {
    it("returns null when no sessions exist", () => {
      const { container } = render(<RecentChats />);
      expect(container.firstChild).toBeNull();
    });

    it("renders recent chats when sessions exist", () => {
      const sessions = [
        {
          id: "session-1",
          preview: "Discussion about watches",
          agentId: "curator",
          createdAt: Date.now() - 60000,
          updatedAt: Date.now() - 60000,
          messages: [{ id: "m1", role: "user", parts: [] }],
        },
      ];
      memoryStorage.setItem(
        "ai-appraiser-chat-history",
        JSON.stringify(sessions),
      );

      render(<RecentChats />);

      expect(screen.getByText("Recent Chats")).toBeDefined();
      expect(screen.getByText("Discussion about watches")).toBeDefined();
      expect(screen.getByText("Curator")).toBeDefined();
    });

    it("renders multiple sessions", () => {
      const sessions = [
        {
          id: "session-1",
          preview: "First chat",
          agentId: "curator",
          createdAt: Date.now() - 120000,
          updatedAt: Date.now() - 120000,
          messages: [{ id: "m1", role: "user", parts: [] }],
        },
        {
          id: "session-2",
          preview: "Second chat",
          agentId: "appraiser",
          createdAt: Date.now() - 60000,
          updatedAt: Date.now() - 60000,
          messages: [{ id: "m2", role: "user", parts: [] }],
        },
      ];
      memoryStorage.setItem(
        "ai-appraiser-chat-history",
        JSON.stringify(sessions),
      );

      render(<RecentChats />);

      expect(screen.getByText("First chat")).toBeDefined();
      expect(screen.getByText("Second chat")).toBeDefined();
      expect(screen.getByText("Curator")).toBeDefined();
      expect(screen.getByText("Appraiser")).toBeDefined();
    });

    it("calls resumeChat when clicking a session", async () => {
      const user = userEvent.setup();
      const messages = [{ id: "m1", role: "user", parts: [] }];
      const sessions = [
        {
          id: "session-1",
          preview: "Clickable chat",
          agentId: "curator",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages,
        },
      ];
      memoryStorage.setItem(
        "ai-appraiser-chat-history",
        JSON.stringify(sessions),
      );

      render(<RecentChats />);

      const chatButton = screen.getByTestId("recent-chat-item");
      await user.click(chatButton);

      expect(mockResumeChat).toHaveBeenCalledWith(
        "session-1",
        "curator",
        messages,
      );
    });

    it("displays relative time for each session", () => {
      const sessions = [
        {
          id: "session-1",
          preview: "Recent chat",
          agentId: "curator",
          createdAt: Date.now() - 5 * 60000,
          updatedAt: Date.now() - 5 * 60000,
          messages: [{ id: "m1", role: "user", parts: [] }],
        },
      ];
      memoryStorage.setItem(
        "ai-appraiser-chat-history",
        JSON.stringify(sessions),
      );

      render(<RecentChats />);

      expect(screen.getByText("5m ago")).toBeDefined();
    });

    it("shows correct agent badges", () => {
      const sessions = [
        {
          id: "session-1",
          preview: "First chat preview",
          agentId: "curator",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [{ id: "m1", role: "user", parts: [] }],
        },
        {
          id: "session-2",
          preview: "Second chat preview",
          agentId: "appraiser",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          messages: [{ id: "m2", role: "user", parts: [] }],
        },
      ];
      memoryStorage.setItem(
        "ai-appraiser-chat-history",
        JSON.stringify(sessions),
      );

      render(<RecentChats />);

      // Check for the exact badge elements (span with agent names)
      const curatorBadge = screen.getByText("Curator");
      const appraiserBadge = screen.getByText("Appraiser");
      expect(curatorBadge).toBeDefined();
      expect(appraiserBadge).toBeDefined();
    });
  });
});
