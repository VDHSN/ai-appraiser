import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSwipeGesture } from "../useSwipeGesture";

describe("useSwipeGesture", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create a mock touch event
  function createTouchEvent(
    clientX: number,
    clientY: number,
  ): React.TouchEvent {
    return {
      touches: [{ clientX, clientY }],
    } as unknown as React.TouchEvent;
  }

  describe("initial state", () => {
    it("returns isSwiped as false initially", () => {
      const { result } = renderHook(() => useSwipeGesture());
      expect(result.current.isSwiped).toBe(false);
    });

    it("returns offsetX as 0 initially", () => {
      const { result } = renderHook(() => useSwipeGesture());
      expect(result.current.offsetX).toBe(0);
    });

    it("provides touch event handlers", () => {
      const { result } = renderHook(() => useSwipeGesture());
      expect(result.current.handlers.onTouchStart).toBeInstanceOf(Function);
      expect(result.current.handlers.onTouchMove).toBeInstanceOf(Function);
      expect(result.current.handlers.onTouchEnd).toBeInstanceOf(Function);
    });
  });

  describe("swipe detection", () => {
    it("detects left swipe that exceeds threshold", () => {
      const { result } = renderHook(() =>
        useSwipeGesture({ threshold: 50, maxOffset: 80 }),
      );

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 100));
      });

      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(140, 100));
      });

      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(result.current.isSwiped).toBe(true);
      expect(result.current.offsetX).toBe(-80);
    });

    it("does not trigger swipe for movements below threshold", () => {
      const { result } = renderHook(() =>
        useSwipeGesture({ threshold: 50, maxOffset: 80 }),
      );

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 100));
      });

      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(180, 100));
      });

      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(result.current.isSwiped).toBe(false);
      expect(result.current.offsetX).toBe(0);
    });

    it("ignores right swipe (positive deltaX)", () => {
      const { result } = renderHook(() =>
        useSwipeGesture({ threshold: 50, maxOffset: 80 }),
      );

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(100, 100));
      });

      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(200, 100));
      });

      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(result.current.isSwiped).toBe(false);
      expect(result.current.offsetX).toBe(0);
    });

    it("ignores vertical swipes", () => {
      const { result } = renderHook(() =>
        useSwipeGesture({ threshold: 50, maxOffset: 80 }),
      );

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 100));
      });

      // Move mostly vertically
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(190, 200));
      });

      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(result.current.isSwiped).toBe(false);
    });
  });

  describe("offset clamping", () => {
    it("clamps offset to maxOffset during drag", () => {
      const { result } = renderHook(() =>
        useSwipeGesture({ threshold: 50, maxOffset: 80 }),
      );

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 100));
      });

      // Try to drag more than maxOffset
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(50, 100));
      });

      // During drag, offset should be clamped to -maxOffset
      expect(result.current.offsetX).toBe(-80);
    });
  });

  describe("reset function", () => {
    it("resets isSwiped to false", () => {
      const { result } = renderHook(() =>
        useSwipeGesture({ threshold: 50, maxOffset: 80 }),
      );

      // First swipe
      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 100));
      });
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(100, 100));
      });
      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(result.current.isSwiped).toBe(true);

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.isSwiped).toBe(false);
      expect(result.current.offsetX).toBe(0);
    });
  });

  describe("onSwipeOpen callback", () => {
    it("calls onSwipeOpen when swipe completes", () => {
      const onSwipeOpen = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({ threshold: 50, maxOffset: 80, onSwipeOpen }),
      );

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 100));
      });

      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(100, 100));
      });

      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(onSwipeOpen).toHaveBeenCalledTimes(1);
    });

    it("does not call onSwipeOpen when swipe is below threshold", () => {
      const onSwipeOpen = vi.fn();
      const { result } = renderHook(() =>
        useSwipeGesture({ threshold: 50, maxOffset: 80, onSwipeOpen }),
      );

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 100));
      });

      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(180, 100));
      });

      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(onSwipeOpen).not.toHaveBeenCalled();
    });
  });

  describe("when already swiped", () => {
    it("does not respond to new touch events when swiped open", () => {
      const { result } = renderHook(() =>
        useSwipeGesture({ threshold: 50, maxOffset: 80 }),
      );

      // First swipe to open
      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 100));
      });
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(100, 100));
      });
      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(result.current.isSwiped).toBe(true);

      // Try to start a new swipe
      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 100));
      });
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(100, 100));
      });

      // Should still be in swiped state with same offset
      expect(result.current.isSwiped).toBe(true);
      expect(result.current.offsetX).toBe(-80);
    });
  });

  describe("default options", () => {
    it("uses default threshold of 50", () => {
      const { result } = renderHook(() => useSwipeGesture());

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 100));
      });

      // Move exactly 50px (at threshold)
      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(150, 100));
      });

      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(result.current.isSwiped).toBe(true);
    });

    it("uses default maxOffset of 80", () => {
      const { result } = renderHook(() => useSwipeGesture());

      act(() => {
        result.current.handlers.onTouchStart(createTouchEvent(200, 100));
      });

      act(() => {
        result.current.handlers.onTouchMove(createTouchEvent(50, 100));
      });

      act(() => {
        result.current.handlers.onTouchEnd();
      });

      expect(result.current.offsetX).toBe(-80);
    });
  });
});
