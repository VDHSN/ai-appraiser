import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { NewUIContainer } from "../NewUIContainer";

// Mock HomePage to avoid deep dependency tree
vi.mock("../HomePage", () => ({
  HomePage: () => <div data-testid="home-page">Home Page</div>,
}));

describe("NewUIContainer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders HomePage component", () => {
    render(<NewUIContainer />);
    expect(screen.getByTestId("home-page")).toBeDefined();
  });

  it("is deprecated in favor of URL-based routing", () => {
    // This test documents that NewUIContainer is deprecated
    // and should be replaced with direct HomePage usage or URL routing
    render(<NewUIContainer />);
    expect(screen.getByTestId("home-page")).toBeDefined();
  });
});
