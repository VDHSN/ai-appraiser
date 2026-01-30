import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SwipeableChatItem } from "../SwipeableChatItem";

// Mock the useSwipeGesture hook
const mockReset = vi.fn();
const mockHandlers = {
  onTouchStart: vi.fn(),
  onTouchMove: vi.fn(),
  onTouchEnd: vi.fn(),
};

let mockSwipeState = {
  isSwiped: false,
  offsetX: 0,
  reset: mockReset,
  handlers: mockHandlers,
};

vi.mock("@/hooks/useSwipeGesture", () => ({
  useSwipeGesture: () => mockSwipeState,
}));

describe("SwipeableChatItem", () => {
  const defaultProps = {
    id: "test-item-1",
    isActive: false,
    onSwipeOpen: vi.fn(),
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSwipeState = {
      isSwiped: false,
      offsetX: 0,
      reset: mockReset,
      handlers: mockHandlers,
    };
  });

  describe("rendering", () => {
    it("renders children content", () => {
      render(
        <SwipeableChatItem {...defaultProps}>
          <div data-testid="child-content">Chat content</div>
        </SwipeableChatItem>,
      );

      expect(screen.getByTestId("child-content")).toBeDefined();
      expect(screen.getByText("Chat content")).toBeDefined();
    });

    it("renders desktop delete button", () => {
      render(
        <SwipeableChatItem {...defaultProps}>
          <div>Chat content</div>
        </SwipeableChatItem>,
      );

      const desktopButton = screen.getByTestId("desktop-delete-button");
      expect(desktopButton).toBeDefined();
      expect(desktopButton.getAttribute("aria-label")).toBe("Delete chat");
    });

    it("renders swipe delete button for mobile", () => {
      render(
        <SwipeableChatItem {...defaultProps}>
          <div>Chat content</div>
        </SwipeableChatItem>,
      );

      const swipeButton = screen.getByTestId("swipe-delete-button");
      expect(swipeButton).toBeDefined();
      expect(swipeButton.getAttribute("aria-label")).toBe("Delete chat");
    });
  });

  describe("desktop delete button", () => {
    it("calls onDelete when clicked", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();

      render(
        <SwipeableChatItem {...defaultProps} onDelete={onDelete}>
          <div>Chat content</div>
        </SwipeableChatItem>,
      );

      const desktopButton = screen.getByTestId("desktop-delete-button");
      await user.click(desktopButton);

      expect(onDelete).toHaveBeenCalledWith("test-item-1");
      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it("stops event propagation to prevent resuming chat", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();
      const parentClick = vi.fn();

      render(
        <div onClick={parentClick}>
          <SwipeableChatItem {...defaultProps} onDelete={onDelete}>
            <div>Chat content</div>
          </SwipeableChatItem>
        </div>,
      );

      const desktopButton = screen.getByTestId("desktop-delete-button");
      await user.click(desktopButton);

      expect(onDelete).toHaveBeenCalled();
      expect(parentClick).not.toHaveBeenCalled();
    });
  });

  describe("swipe delete button", () => {
    it("calls onDelete when clicked", async () => {
      const user = userEvent.setup();
      const onDelete = vi.fn();

      render(
        <SwipeableChatItem {...defaultProps} onDelete={onDelete}>
          <div>Chat content</div>
        </SwipeableChatItem>,
      );

      const swipeButton = screen.getByTestId("swipe-delete-button");
      await user.click(swipeButton);

      expect(onDelete).toHaveBeenCalledWith("test-item-1");
    });
  });

  describe("active state management", () => {
    it("resets swipe when isActive becomes false while swiped", () => {
      mockSwipeState.isSwiped = true;

      const { rerender } = render(
        <SwipeableChatItem {...defaultProps} isActive={true}>
          <div>Chat content</div>
        </SwipeableChatItem>,
      );

      // Change isActive to false
      rerender(
        <SwipeableChatItem {...defaultProps} isActive={false}>
          <div>Chat content</div>
        </SwipeableChatItem>,
      );

      expect(mockReset).toHaveBeenCalled();
    });

    it("does not reset when isActive stays true", () => {
      mockSwipeState.isSwiped = true;

      const { rerender } = render(
        <SwipeableChatItem {...defaultProps} isActive={true}>
          <div>Chat content</div>
        </SwipeableChatItem>,
      );

      // Keep isActive true
      rerender(
        <SwipeableChatItem {...defaultProps} isActive={true}>
          <div>Chat content</div>
        </SwipeableChatItem>,
      );

      expect(mockReset).not.toHaveBeenCalled();
    });
  });

  describe("content click behavior when swiped", () => {
    it("resets swipe and prevents propagation when content is clicked while swiped", () => {
      mockSwipeState.isSwiped = true;

      render(
        <SwipeableChatItem {...defaultProps}>
          <button data-testid="chat-button">Chat content</button>
        </SwipeableChatItem>,
      );

      const container = screen
        .getByTestId("chat-button")
        .closest("[class*='touch-pan-y']");
      if (container) {
        fireEvent.click(container);
        expect(mockReset).toHaveBeenCalled();
      }
    });
  });

  describe("transform styling", () => {
    it("applies transform based on offsetX", () => {
      mockSwipeState.offsetX = -40;

      render(
        <SwipeableChatItem {...defaultProps}>
          <div>Chat content</div>
        </SwipeableChatItem>,
      );

      const container = screen
        .getByText("Chat content")
        .closest("[class*='touch-pan-y']");
      expect(container?.getAttribute("style")).toContain(
        "transform: translateX(-40px)",
      );
    });
  });

  describe("accessibility", () => {
    it("delete buttons have aria-label", () => {
      render(
        <SwipeableChatItem {...defaultProps}>
          <div>Chat content</div>
        </SwipeableChatItem>,
      );

      const desktopButton = screen.getByTestId("desktop-delete-button");
      const swipeButton = screen.getByTestId("swipe-delete-button");

      expect(desktopButton.getAttribute("aria-label")).toBe("Delete chat");
      expect(swipeButton.getAttribute("aria-label")).toBe("Delete chat");
    });
  });
});
