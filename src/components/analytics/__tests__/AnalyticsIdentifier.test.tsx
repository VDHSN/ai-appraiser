import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, act } from "@testing-library/react";
import { AnalyticsIdentifier } from "../AnalyticsIdentifier";

// Mock analytics
const mockIdentify = vi.fn();
const mockReset = vi.fn();
const mockTrack = vi.fn();

vi.mock("@/lib/analytics", () => ({
  analytics: {
    identify: (...args: unknown[]) => mockIdentify(...args),
    reset: () => mockReset(),
    track: (...args: unknown[]) => mockTrack(...args),
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

  it("calls identify with user details and fires sign_in event when user is signed in", () => {
    const mockUser = {
      id: "user_123",
      firstName: "John",
      lastName: "Doe",
      fullName: "John Doe",
      emailAddresses: [{ emailAddress: "john@example.com" }],
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
      first_name: "John",
      last_name: "Doe",
    });

    expect(mockTrack).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledWith("user:sign_in", {
      user_id: "user_123",
      email: "john@example.com",
      first_name: "John",
      last_name: "Doe",
    });
  });

  it("handles user without email gracefully", () => {
    const mockUser = {
      id: "user_456",
      firstName: "Jane",
      lastName: "Doe",
      fullName: "Jane Doe",
      emailAddresses: [],
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
      first_name: "Jane",
      last_name: "Doe",
    });
  });

  it("handles user without fullName gracefully", () => {
    const mockUser = {
      id: "user_789",
      firstName: null,
      lastName: null,
      fullName: null,
      emailAddresses: [{ emailAddress: "test@example.com" }],
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
      first_name: undefined,
      last_name: undefined,
    });
  });

  it("calls reset and fires sign_out event when user signs out", () => {
    const mockUser = {
      id: "user_123",
      firstName: "John",
      lastName: "Doe",
      fullName: "John Doe",
      emailAddresses: [{ emailAddress: "john@example.com" }],
    };

    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
    });

    const { rerender } = render(<AnalyticsIdentifier />);

    expect(mockIdentify).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledTimes(1);

    // User signs out
    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: false,
      user: null,
    });

    act(() => {
      rerender(<AnalyticsIdentifier />);
    });

    // Should fire sign_out event before reset
    expect(mockTrack).toHaveBeenCalledTimes(2);
    expect(mockTrack).toHaveBeenLastCalledWith("user:sign_out", {
      user_id: "user_123",
    });
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("does not re-identify when user state is unchanged", () => {
    const mockUser = {
      id: "user_123",
      firstName: "John",
      lastName: "Doe",
      fullName: "John Doe",
      emailAddresses: [{ emailAddress: "john@example.com" }],
    };

    mockUseUser.mockReturnValue({
      isLoaded: true,
      isSignedIn: true,
      user: mockUser,
    });

    const { rerender } = render(<AnalyticsIdentifier />);

    expect(mockIdentify).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledTimes(1);

    // Rerender with same user (simulating component re-render)
    act(() => {
      rerender(<AnalyticsIdentifier />);
    });

    // Should not call identify or track again
    expect(mockIdentify).toHaveBeenCalledTimes(1);
    expect(mockTrack).toHaveBeenCalledTimes(1);
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
