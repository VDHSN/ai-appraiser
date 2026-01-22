"use client";

import { useCompareStore, type CompareItem } from "@/stores/compare-store";

interface CompareToggleProps {
  item: CompareItem;
}

function getItemId(item: CompareItem): string {
  return "id" in item ? item.id : item.itemId;
}

export function CompareToggle({ item }: CompareToggleProps) {
  const { addItem, removeItem, hasItem, items } = useCompareStore();
  const itemId = getItemId(item);
  const isSelected = hasItem(itemId);
  const isFull = items.length >= 4;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) {
      removeItem(itemId);
    } else if (!isFull) {
      addItem(item);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={!isSelected && isFull}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${
        isSelected
          ? "bg-[var(--accent)] text-white"
          : "bg-white/90 text-zinc-600 hover:bg-zinc-100 dark:bg-zinc-800/90 dark:text-zinc-300 dark:hover:bg-zinc-700"
      } ${!isSelected && isFull ? "cursor-not-allowed opacity-50" : ""}`}
      title={
        isSelected
          ? "Remove from compare"
          : isFull
            ? "Compare full (max 4)"
            : "Add to compare"
      }
    >
      {isSelected ? (
        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
      ) : (
        <svg
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
      )}
    </button>
  );
}
