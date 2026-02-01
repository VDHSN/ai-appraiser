import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewUIContainer } from "../NewUIContainer";

// Mock analytics
vi.mock("@/lib/analytics", () => ({
  analytics: { track: vi.fn() },
}));

// Mock next/navigation for HomePage which uses useRouter
const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn().mockReturnValue(null),
  }),
}));

// Mock agent context
vi.mock("@/lib/agent", () => ({
  useAgent: () => ({
    agentId: "curator",
    setAgentId: vi.fn(),
    agent: { name: "Curator", description: "Find items" },
    isHydrated: true,
    isRestored: false,
    restoredSessionId: null,
  }),
}));

// Mock storage - RecentChats needs this
vi.mock("@/lib/chat-history", () => ({
  getRecentSessionSummaries: () => [],
  generateSessionId: () => "test-session-123",
  STORAGE_CHANGE_EVENT: "test-storage-change",
}));

// Mock Clerk - UserMenu uses it
vi.mock("@clerk/nextjs", () => ({
  useUser: () => ({ isSignedIn: false, isLoaded: true }),
  SignInButton: ({ children }: { children: React.ReactNode }) => children,
  SignUpButton: ({ children }: { children: React.ReactNode }) => children,
  UserButton: () => null,
}));

describe("NewUIContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders HomePage (deprecated wrapper component)", () => {
    render(<NewUIContainer />);

    // NewUIContainer is now just a wrapper for HomePage
    // It should render the landing page content
    expect(
      screen.getByText(
        "Discover and appraise rare collectibles with AI-powered insights",
      ),
    ).toBeDefined();
  });

  it("is deprecated in favor of URL-based routing", () => {
    // This test documents the deprecation
    // NewUIContainer should be removed in a future version
    // Use:
    // - / route for landing page (HomePage)
    // - /{sessionId} route for chat sessions (ChatView)
    render(<NewUIContainer />);

    // Should still render the landing page
    expect(screen.getByTestId("search-input")).toBeDefined();
  });
});
