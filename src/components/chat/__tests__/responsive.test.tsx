import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChatInput } from "../ChatInput";
import { AgentSelector } from "../AgentSelector";
import { ChatMessage } from "../ChatMessage";
import type { UIMessage } from "ai";

// Mock dependencies
vi.mock("@/lib/analytics", () => ({
  analytics: { track: vi.fn() },
}));

vi.mock("@/lib/agent", () => ({
  useAgent: () => ({
    agentId: "search",
    setAgentId: vi.fn(),
  }),
  listAgents: () => [
    { id: "search", name: "Search", description: "Find items" },
    { id: "value", name: "Value", description: "Appraise items" },
  ],
}));

/**
 * Helper to check if an element has a CSS class
 */
function hasClass(element: Element | null, className: string): boolean {
  return element?.classList.contains(className) ?? false;
}

/**
 * Helper to check if an element has all specified CSS classes
 */
function hasClasses(element: Element | null, classNames: string[]): boolean {
  return classNames.every((cn) => hasClass(element, cn));
}

describe("ChatInput responsive design", () => {
  const defaultProps = {
    value: "",
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    isLoading: false,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with safe area bottom padding class", () => {
    const { container } = render(<ChatInput {...defaultProps} />);
    const form = container.querySelector("form");
    expect(hasClass(form, "safe-area-inset-bottom")).toBe(true);
  });

  it("renders with responsive padding classes", () => {
    const { container } = render(<ChatInput {...defaultProps} />);
    const form = container.querySelector("form");
    expect(hasClasses(form, ["pb-4", "pt-3", "sm:pb-5", "sm:pt-4"])).toBe(true);
  });

  it("renders with safe area horizontal inset on inner container", () => {
    const { container } = render(<ChatInput {...defaultProps} />);
    const innerDiv = container.querySelector("form > div");
    expect(hasClass(innerDiv, "safe-area-inset-x")).toBe(true);
  });

  it("renders with responsive gap classes", () => {
    const { container } = render(<ChatInput {...defaultProps} />);
    const innerDiv = container.querySelector("form > div");
    expect(hasClasses(innerDiv, ["gap-2", "sm:gap-3"])).toBe(true);
  });

  it("renders textarea with responsive text size", () => {
    render(<ChatInput {...defaultProps} />);
    const textarea = screen.getByRole("textbox");
    expect(hasClasses(textarea, ["text-base", "sm:text-sm"])).toBe(true);
  });

  it("renders textarea with responsive padding", () => {
    render(<ChatInput {...defaultProps} />);
    const textarea = screen.getByRole("textbox");
    expect(hasClasses(textarea, ["px-3", "py-3", "sm:px-4", "sm:py-3"])).toBe(
      true,
    );
  });
});

describe("AgentSelector responsive design", () => {
  it("renders with flex-1 on mobile and flex-initial on larger screens", () => {
    const { container } = render(<AgentSelector />);
    const outerDiv = container.querySelector("div");
    expect(hasClasses(outerDiv, ["flex-1", "sm:flex-initial"])).toBe(true);
  });

  it("renders with min-w-0 for text truncation", () => {
    const { container } = render(<AgentSelector />);
    const outerDiv = container.querySelector("div");
    expect(hasClass(outerDiv, "min-w-0")).toBe(true);
  });

  it("renders buttons with responsive padding", () => {
    const { container } = render(<AgentSelector />);
    const buttons = container.querySelectorAll("button");
    buttons.forEach((button) => {
      expect(hasClasses(button, ["px-2", "sm:px-3"])).toBe(true);
    });
  });

  it("renders agent names with truncate class", () => {
    const { container } = render(<AgentSelector />);
    const nameElements = container.querySelectorAll("button > p:first-child");
    nameElements.forEach((name) => {
      expect(hasClass(name, "truncate")).toBe(true);
    });
  });

  it("hides descriptions on mobile screens", () => {
    const { container } = render(<AgentSelector />);
    const descElements = container.querySelectorAll("button > p:last-child");
    descElements.forEach((desc) => {
      expect(hasClasses(desc, ["hidden", "sm:block"])).toBe(true);
    });
  });
});

describe("ChatMessage responsive design", () => {
  const createMockMessage = (role: "user" | "assistant"): UIMessage => ({
    id: "test-1",
    role,
    parts: [{ type: "text", text: "Test message" }],
  });

  // Helper to get the inner message content div (skipping the outer flex wrapper)
  const getMessageContentDiv = (container: Element): Element | null => {
    // Structure: <div class="flex..."><div class="max-w-...">...</div></div>
    const outerDiv = container.querySelector("div");
    return outerDiv?.querySelector("div") ?? null;
  };

  it("renders user message with responsive max-width", () => {
    const { container } = render(
      <ChatMessage message={createMockMessage("user")} />,
    );
    const messageDiv = getMessageContentDiv(container);
    // Check that className string contains the responsive max-width classes
    expect(messageDiv?.className).toContain("max-w-[92%]");
    expect(messageDiv?.className).toContain("sm:max-w-[85%]");
  });

  it("renders user message with responsive padding", () => {
    const { container } = render(
      <ChatMessage message={createMockMessage("user")} />,
    );
    const messageDiv = getMessageContentDiv(container);
    // User messages have responsive padding
    expect(messageDiv?.className).toContain("px-3");
    expect(messageDiv?.className).toContain("py-2.5");
    expect(messageDiv?.className).toContain("sm:px-4");
    expect(messageDiv?.className).toContain("sm:py-3");
  });

  it("renders assistant message with responsive max-width", () => {
    const { container } = render(
      <ChatMessage message={createMockMessage("assistant")} />,
    );
    const messageDiv = getMessageContentDiv(container);
    // Check that className string contains the responsive max-width classes
    expect(messageDiv?.className).toContain("max-w-[92%]");
    expect(messageDiv?.className).toContain("sm:max-w-[85%]");
  });
});
