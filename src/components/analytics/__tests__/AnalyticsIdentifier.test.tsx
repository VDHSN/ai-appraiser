import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import {
  AnalyticsIdentifier,
  resetIdentifierState,
} from "../AnalyticsIdentifier";

// Mock analytics
const mockIdentify = vi.fn();
const mockReset = vi.fn();
const mockIsInitialized = vi.fn().mockReturnValue(true);

vi.mock("@/lib/analytics", () => ({
  analytics: {
    identify: (...args: unknown[]) => mockIdentify(...args),
    reset: () => mockReset(),
    isInitialized: () => mockIsInitialized(),
  },
}));

// Mock Clerk's useUser hook
const mockUseUser = vi.fn();
vi.mock("@clerk/nextjs", () => ({
  useUser: () => mockUseUser(),
}));

describe("AnalyticsIdentifier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsInitialized.mockReturnValue(true);
    resetIdentifierState();
  });

  it("does not call identify when auth is loading", () => {
    mockUseUser.mockReturnValue({
      isLoaded: false,
      isSignedIn: false,
      user: null,
    });

    render(<AnalyticsIdentifier />);

    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it("does not call identify or reset when user is not signed in initially", () => {
    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    });

    render(<AnalyticsIdentifier />);

    expect(mockIdentify).not.toHaveBeenCalled();
    expect(mockReset).not.toHaveBeenCalled();
  });

  it("calls identify with user primary email when user is signed in", () => {
    const mockUser = {
      id: "user_123",
      fullName: "John Doe",
      primaryEmailAddress: { emailAddress: "john@example.com" },
    };

    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
    });

    render(<AnalyticsIdentifier />);

    expect(mockIdentify).toHaveBeenCalledTimes(1);
    expect(mockIdentify).toHaveBeenCalledWith("user_123", {
      email: "john@example.com",
      name: "John Doe",
    });
  });

  it("handles user without primary email gracefully", () => {
    const mockUser = {
      id: "user_456",
      fullName: "Jane Doe",
      primaryEmailAddress: null,
    };

    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
    });

    render(<AnalyticsIdentifier />);

    expect(mockIdentify).toHaveBeenCalledWith("user_456", {
      email: undefined,
      name: "Jane Doe",
    });
  });

  it("handles user without fullName gracefully", () => {
    const mockUser = {
      id: "user_789",
      fullName: null,
      primaryEmailAddress: { emailAddress: "test@example.com" },
    };

    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
    });

    render(<AnalyticsIdentifier />);

    expect(mockIdentify).toHaveBeenCalledWith("user_789", {
      email: "test@example.com",
      name: undefined,
    });
  });

  it("does not call identify when analytics is not initialized", () => {
    mockIsInitialized.mockReturnValue(false);

    const mockUser = {
      id: "user_123",
      fullName: "John Doe",
      primaryEmailAddress: { emailAddress: "john@example.com" },
    };

    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
    });

    render(<AnalyticsIdentifier />);

    expect(mockIdentify).not.toHaveBeenCalled();
  });

  it("calls reset when user signs out", () => {
    const mockUser = {
      id: "user_123",
      fullName: "John Doe",
      primaryEmailAddress: { emailAddress: "john@example.com" },
    };

    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
    });

    const { rerender } = render(<AnalyticsIdentifier />);

    expect(mockIdentify).toHaveBeenCalledTimes(1);

    // User signs out
    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    });

    act(() => {
      rerender(<AnalyticsIdentifier />);
    });

    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("does not re-identify when user state is unchanged", () => {
    const mockUser = {
      id: "user_123",
      fullName: "John Doe",
      primaryEmailAddress: { emailAddress: "john@example.com" },
    };

    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
    });

    const { rerender } = render(<AnalyticsIdentifier />);

    expect(mockIdentify).toHaveBeenCalledTimes(1);

    // Rerender with same user (simulating component re-render)
    act(() => {
      rerender(<AnalyticsIdentifier />);
    });

    // Should not call identify again
    expect(mockIdentify).toHaveBeenCalledTimes(1);
  });

  it("does not re-identify when component is remounted", () => {
    const mockUser = {
      id: "user_123",
      fullName: "John Doe",
      primaryEmailAddress: { emailAddress: "john@example.com" },
    };

    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
    });

    const { unmount } = render(<AnalyticsIdentifier />);
    expect(mockIdentify).toHaveBeenCalledTimes(1);

    // Unmount and remount (simulating navigation)
    unmount();
    render(<AnalyticsIdentifier />);

    // Should not call identify again due to module-level state
    expect(mockIdentify).toHaveBeenCalledTimes(1);
  });

  it("renders null (no visible output)", () => {
    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    });

    const { container } = render(<AnalyticsIdentifier />);

    expect(container.firstChild).toBeNull();
  });
});
