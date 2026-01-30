import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SearchBox } from "../SearchBox";

describe("SearchBox", () => {
  const mockOnSubmit = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the search input with placeholder text", () => {
    render(<SearchBox onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    expect(input).toBeDefined();
  });

  it("renders Curate and Appraise buttons", () => {
    render(<SearchBox onSubmit={mockOnSubmit} />);

    expect(screen.getByRole("button", { name: /curate/i })).toBeDefined();
    expect(screen.getByRole("button", { name: /appraise/i })).toBeDefined();
  });

  it("disables buttons when input is empty", () => {
    render(<SearchBox onSubmit={mockOnSubmit} />);

    const curateButton = screen.getByRole("button", {
      name: /curate/i,
    }) as HTMLButtonElement;
    const appraiseButton = screen.getByRole("button", {
      name: /appraise/i,
    }) as HTMLButtonElement;

    expect(curateButton.disabled).toBe(true);
    expect(appraiseButton.disabled).toBe(true);
  });

  it("enables buttons when input has text", async () => {
    const user = userEvent.setup();
    render(<SearchBox onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "vintage watch");

    const curateButton = screen.getByRole("button", {
      name: /curate/i,
    }) as HTMLButtonElement;
    const appraiseButton = screen.getByRole("button", {
      name: /appraise/i,
    }) as HTMLButtonElement;

    expect(curateButton.disabled).toBe(false);
    expect(appraiseButton.disabled).toBe(false);
  });

  it("calls onSubmit with curator agent when Curate button is clicked", async () => {
    const user = userEvent.setup();
    render(<SearchBox onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "vintage watch");

    const curateButton = screen.getByRole("button", { name: /curate/i });
    await user.click(curateButton);

    expect(mockOnSubmit).toHaveBeenCalledWith("vintage watch", "curator");
  });

  it("calls onSubmit with appraiser agent when Appraise button is clicked", async () => {
    const user = userEvent.setup();
    render(<SearchBox onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "tiffany lamp");

    const appraiseButton = screen.getByRole("button", { name: /appraise/i });
    await user.click(appraiseButton);

    expect(mockOnSubmit).toHaveBeenCalledWith("tiffany lamp", "appraiser");
  });

  it("calls onSubmit with curator agent when Enter is pressed", async () => {
    const user = userEvent.setup();
    render(<SearchBox onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "art deco vase{Enter}");

    expect(mockOnSubmit).toHaveBeenCalledWith("art deco vase", "curator");
  });

  it("does not call onSubmit when Enter is pressed with empty input", async () => {
    render(<SearchBox onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    fireEvent.keyDown(input, { key: "Enter" });

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("trims whitespace from input before submitting", async () => {
    const user = userEvent.setup();
    render(<SearchBox onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "  vintage watch  ");

    const curateButton = screen.getByRole("button", { name: /curate/i });
    await user.click(curateButton);

    expect(mockOnSubmit).toHaveBeenCalledWith("vintage watch", "curator");
  });

  it("does not submit when only whitespace is entered", async () => {
    const user = userEvent.setup();
    render(<SearchBox onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    await user.type(input, "   ");

    const curateButton = screen.getByRole("button", {
      name: /curate/i,
    }) as HTMLButtonElement;
    expect(curateButton.disabled).toBe(true);
  });

  it("disables input and buttons when disabled prop is true", () => {
    render(<SearchBox onSubmit={mockOnSubmit} disabled />);

    const input = screen.getByPlaceholderText(
      /search for rare collectibles/i,
    ) as HTMLInputElement;
    const curateButton = screen.getByRole("button", {
      name: /curate/i,
    }) as HTMLButtonElement;
    const appraiseButton = screen.getByRole("button", {
      name: /appraise/i,
    }) as HTMLButtonElement;

    expect(input.disabled).toBe(true);
    expect(curateButton.disabled).toBe(true);
    expect(appraiseButton.disabled).toBe(true);
  });

  it("focuses input on mount", () => {
    render(<SearchBox onSubmit={mockOnSubmit} />);

    const input = screen.getByPlaceholderText(/search for rare collectibles/i);
    expect(document.activeElement).toBe(input);
  });
});
