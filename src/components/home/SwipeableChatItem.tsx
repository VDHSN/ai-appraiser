"use client";

/**
 * A chat item wrapper that supports swipe-to-delete on mobile
 * and shows a trash icon on desktop.
 */

import { useEffect, type ReactNode } from "react";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

/** Trash icon SVG - matches codebase pattern of inline SVGs */
function TrashIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export interface SwipeableChatItemProps {
  /** Unique identifier for this item */
  id: string;
  /** Whether this item is the currently active (swiped) one */
  isActive: boolean;
  /** Called when this item is swiped open */
  onSwipeOpen: (id: string) => void;
  /** Called when delete is confirmed */
  onDelete: (id: string) => void;
  /** The chat item content to render */
  children: ReactNode;
}

const DELETE_BUTTON_WIDTH = 80;

export function SwipeableChatItem({
  id,
  isActive,
  onSwipeOpen,
  onDelete,
  children,
}: SwipeableChatItemProps) {
  const { isSwiped, offsetX, reset, handlers } = useSwipeGesture({
    maxOffset: DELETE_BUTTON_WIDTH,
    onSwipeOpen: () => onSwipeOpen(id),
  });

  // Reset swipe state when this item is no longer active
  useEffect(() => {
    if (!isActive && isSwiped) {
      reset();
    }
  }, [isActive, isSwiped, reset]);

  const handleDelete = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    onDelete(id);
  };

  // Handle click on content area when swiped open - should close
  const handleContentClick = (e: React.MouseEvent) => {
    if (isSwiped) {
      e.preventDefault();
      e.stopPropagation();
      reset();
    }
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete button - revealed on swipe (mobile) */}
      <button
        onClick={handleDelete}
        className="absolute right-0 top-0 flex h-full items-center justify-center bg-red-500 text-white transition-opacity hover:bg-red-600 active:bg-red-700 md:hidden"
        style={{ width: DELETE_BUTTON_WIDTH }}
        aria-label="Delete chat"
        data-testid="swipe-delete-button"
      >
        <TrashIcon className="h-6 w-6" />
      </button>

      {/* Swipeable content container */}
      <div
        className="relative touch-pan-y bg-white transition-transform duration-200 ease-out dark:bg-zinc-900 md:transform-none"
        style={{
          transform: `translateX(${offsetX}px)`,
        }}
        {...handlers}
        onClick={handleContentClick}
      >
        {/* Main content with desktop delete button */}
        <div className="flex items-center">
          <div className="min-w-0 flex-1">{children}</div>

          {/* Desktop trash icon - always visible */}
          <button
            onClick={handleDelete}
            className="mr-2 hidden shrink-0 rounded p-2 text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-red-500 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-red-400 md:block"
            aria-label="Delete chat"
            data-testid="desktop-delete-button"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
