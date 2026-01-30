import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { HomePage } from "../HomePage";

// Mock dependencies
const mockTrack = vi.fn();
vi.mock("@/lib/analytics", () => ({
  analytics: { track: (...args: unknown[]) => mockTrack(...args) },
}));

const mockStartChat = vi.fn();
vi.mock("@/lib/home", () => ({
  useHome: () => ({
    startChat: mockStartChat,
  }),
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

  it("calls startChat when submitting with curator", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "vintage watch");

    const curateButton = screen.getByRole("button", { name: /curate/i });
    await user.click(curateButton);

    expect(mockStartChat).toHaveBeenCalledWith("vintage watch", "curator");
  });

  it("does not track analytics when selecting default curator agent", async () => {
    const user = userEvent.setup();
    render(<HomePage />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "vintage watch");

    const curateButton = screen.getByRole("button", { name: /curate/i });
    await user.click(curateButton);

    expect(mockTrack).not.toHaveBeenCalled();
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
    });
    expect(mockStartChat).toHaveBeenCalledWith("antique vase", "appraiser");
  });
});
