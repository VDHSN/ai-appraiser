/**
 * Hook for detecting swipe left gestures on touch devices.
 * Returns swipe state and handlers to attach to the target element.
 */

import { useCallback, useRef, useState } from "react";

export interface SwipeGestureState {
  /** Whether the element is currently swiped open */
  isSwiped: boolean;
  /** Current horizontal offset during drag (negative = left) */
  offsetX: number;
  /** Reset the swipe state to closed */
  reset: () => void;
  /** Touch event handlers to attach to the element */
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: () => void;
  };
}

export interface SwipeGestureOptions {
  /** Minimum distance to trigger swipe (default: 50) */
  threshold?: number;
  /** Maximum offset when swiped open (default: 80) */
  maxOffset?: number;
  /** Called when swipe opens */
  onSwipeOpen?: () => void;
}

/**
 * Determine if a swipe should be considered horizontal (not vertical scroll).
 */
function isHorizontalSwipe(deltaX: number, deltaY: number): boolean {
  return Math.abs(deltaX) > Math.abs(deltaY);
}

/**
 * Calculate the clamped offset value during drag.
 */
function clampOffset(deltaX: number, maxOffset: number): number {
  // Only allow left swipe (negative values)
  if (deltaX > 0) return 0;
  return Math.max(deltaX, -maxOffset);
}

/**
 * Determine if the swipe distance exceeds the threshold.
 */
function exceedsThreshold(deltaX: number, threshold: number): boolean {
  return Math.abs(deltaX) >= threshold;
}

export function useSwipeGesture(
  options: SwipeGestureOptions = {},
): SwipeGestureState {
  const { threshold = 50, maxOffset = 80, onSwipeOpen } = options;

  const [isSwiped, setIsSwiped] = useState(false);
  const [offsetX, setOffsetX] = useState(0);

  // Track touch start position
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  // Track if we've determined this is a horizontal swipe
  const isHorizontalRef = useRef<boolean | null>(null);

  const reset = useCallback(() => {
    setIsSwiped(false);
    setOffsetX(0);
    touchStartRef.current = null;
    isHorizontalRef.current = null;
  }, []);

  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      // If already swiped and user taps, don't start new swipe
      if (isSwiped) return;

      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY };
      isHorizontalRef.current = null;
    },
    [isSwiped],
  );

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current) return;
      if (isSwiped) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      // Determine direction on first significant movement
      if (isHorizontalRef.current === null) {
        const totalMovement = Math.abs(deltaX) + Math.abs(deltaY);
        if (totalMovement > 10) {
          isHorizontalRef.current = isHorizontalSwipe(deltaX, deltaY);
        }
      }

      // Only track horizontal swipes
      if (isHorizontalRef.current) {
        const clampedOffset = clampOffset(deltaX, maxOffset);
        setOffsetX(clampedOffset);
      }
    },
    [isSwiped, maxOffset],
  );

  const onTouchEnd = useCallback(() => {
    if (!touchStartRef.current) return;

    if (isSwiped) {
      // Already open, do nothing on touch end
      touchStartRef.current = null;
      isHorizontalRef.current = null;
      return;
    }

    // Check if swipe exceeded threshold
    if (exceedsThreshold(offsetX, threshold)) {
      setIsSwiped(true);
      setOffsetX(-maxOffset);
      onSwipeOpen?.();
    } else {
      // Snap back
      setOffsetX(0);
    }

    touchStartRef.current = null;
    isHorizontalRef.current = null;
  }, [isSwiped, offsetX, threshold, maxOffset, onSwipeOpen]);

  return {
    isSwiped,
    offsetX: isSwiped ? -maxOffset : offsetX,
    reset,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
