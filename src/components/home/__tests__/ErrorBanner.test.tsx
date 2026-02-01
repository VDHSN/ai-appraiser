import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { ErrorBanner } from "../ErrorBanner";

// Mock analytics
const mockTrack = vi.fn();
vi.mock("@/lib/analytics", () => ({
  analytics: { track: (...args: unknown[]) => mockTrack(...args) },
}));

// Mock next/navigation
const mockReplace = vi.fn();
const mockSearchParamsGet = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mockReplace,
  }),
  useSearchParams: () => ({
    get: mockSearchParamsGet,
  }),
}));

describe("ErrorBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchParamsGet.mockReturnValue(null);
  });

  it("returns null when no error param is present", () => {
    const { container } = render(<ErrorBanner />);
    expect(container.firstChild).toBeNull();
  });

  it("displays error message for session_not_found", async () => {
    mockSearchParamsGet.mockReturnValue("session_not_found");

    render(<ErrorBanner />);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeDefined();
    });

    expect(
      screen.getByText("The chat session you're looking for doesn't exist."),
    ).toBeDefined();
  });

  it("tracks chat:session_not_found analytics event", async () => {
    mockSearchParamsGet.mockReturnValue("session_not_found");

    render(<ErrorBanner />);

    await waitFor(() => {
      expect(mockTrack).toHaveBeenCalledWith("chat:session_not_found", {
        session_id: "unknown",
        source: "error_banner",
      });
    });
  });

  it("clears error param from URL after displaying", async () => {
    mockSearchParamsGet.mockReturnValue("session_not_found");

    render(<ErrorBanner />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith("/", { scroll: false });
    });
  });

  it("has correct test id for targeting", async () => {
    mockSearchParamsGet.mockReturnValue("session_not_found");

    render(<ErrorBanner />);

    await waitFor(() => {
      expect(screen.getByTestId("error-banner")).toBeDefined();
    });
  });

  it("ignores unknown error types", () => {
    mockSearchParamsGet.mockReturnValue("unknown_error_type");

    const { container } = render(<ErrorBanner />);

    // Should not display anything for unknown error types
    expect(container.firstChild).toBeNull();
    expect(mockTrack).not.toHaveBeenCalled();
  });
});
