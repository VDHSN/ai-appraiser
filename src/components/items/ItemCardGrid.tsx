"use client";

import type { SearchResult } from "@/lib/adapters/types";
import { ItemCard } from "./ItemCard";
import { ItemCardSkeleton } from "@/components/ui/Skeleton";

interface ItemCardGridProps {
  items: SearchResult[];
  isLoading?: boolean;
  onSelect?: (item: SearchResult) => void;
}

export function ItemCardGrid({
  items,
  isLoading,
  onSelect,
}: ItemCardGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <ItemCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-6 text-center dark:border-zinc-700 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No items found
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <ItemCard key={item.itemId} item={item} onSelect={onSelect} />
      ))}
    </div>
  );
}
