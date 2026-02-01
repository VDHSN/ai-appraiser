import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomePage } from "../HomePage";

// Mock dependencies
const mockTrack = vi.fn();
vi.mock("@/lib/analytics", () => ({
  analytics: { track: (...args: unknown[]) => mockTrack(...args) },
}));

// Mock next/navigation
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

// Mock generateSessionId to return predictable values
vi.mock("@/lib/chat-history", () => ({
  generateSessionId: () => "test-session-123",
  getRecentSessionSummaries: () => [],
  STORAGE_CHANGE_EVENT: "test-storage-change",
}));

// Mock UserMenu to avoid Clerk dependency
vi.mock("@/components/auth", () => ({
  UserMenu: () => <div data-testid="user-menu">User Menu</div>,
}));

describe("HomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the brand logo", () => {
    render(<HomePage />);
    expect(screen.getByRole("heading")).toBeDefined();
  });

  it("renders the search box", () => {
    render(<HomePage />);
    expect(
      screen.getByPlaceholderText(/search for rare collectibles/i),
    ).toBeDefined();
  });

  it("navigates to session page when submitting with curator", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "vintage watch");

    const curateButton = screen.getByRole("button", { name: /curate/i });
    await user.click(curateButton);

    expect(mockPush).toHaveBeenCalledWith(
      "/test-session-123?initial=vintage%20watch&agent=curator",
    );
  });

  it("tracks chat:started when submitting", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "vintage watch");

    const curateButton = screen.getByRole("button", { name: /curate/i });
    await user.click(curateButton);

    expect(mockTrack).toHaveBeenCalledWith("chat:started", {
      agent_id: "curator",
      session_id: "test-session-123",
    });
  });

  it("does not track agent_switched when selecting default curator agent", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "vintage watch");

    const curateButton = screen.getByRole("button", { name: /curate/i });
    await user.click(curateButton);

    // Should only have chat:started, not user:agent_switched
    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("chat:started", expect.any(Object));
    expect(mockTrack).not.toHaveBeenCalledWith(
      "user:agent_switched",
      expect.any(Object),
    );
  });

  it("tracks user:agent_switched when selecting appraiser agent", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "antique vase");

    const appraiseButton = screen.getByRole("button", { name: /appraise/i });
    await user.click(appraiseButton);

    expect(mockTrack).toHaveBeenCalledWith("user:agent_switched", {
      from_agent: "curator",
      to_agent: "appraiser",
      source: "user",
      session_id: "test-session-123",
      is_restored: false,
      restored_session_id: null,
    });
  });

  it("navigates to session page with appraiser agent", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "antique vase");

    const appraiseButton = screen.getByRole("button", { name: /appraise/i });
    await user.click(appraiseButton);

    expect(mockPush).toHaveBeenCalledWith(
      "/test-session-123?initial=antique%20vase&agent=appraiser",
    );
  });
});
