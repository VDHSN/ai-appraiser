"use client";

import Image from "next/image";
import { useCompareStore, type CompareItem } from "@/stores/compare-store";
import { Button } from "@/components/ui/Button";

function getItemId(item: CompareItem): string {
  return "id" in item ? item.id : item.itemId;
}

function getItemImage(item: CompareItem): string {
  if ("images" in item && item.images.length > 0) {
    return item.images[0];
  }
  if ("thumbnailUrl" in item && item.thumbnailUrl) {
    return item.thumbnailUrl;
  }
  if ("imageUrl" in item) {
    return item.imageUrl;
  }
  return "";
}

export function CompareBar() {
  const { items, removeItem, clearItems, toggleOpen, isOpen } =
    useCompareStore();

  if (items.length === 0) return null;

  return (
    <div className="border-t border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Compare ({items.length}/4)
          </span>
          <div className="flex -space-x-2">
            {items.map((item) => {
              const img = getItemImage(item);
              return (
                <button
                  key={getItemId(item)}
                  onClick={() => removeItem(getItemId(item))}
                  className="relative h-10 w-10 overflow-hidden rounded-full border-2 border-white ring-1 ring-zinc-200 transition-transform hover:scale-110 hover:z-10 dark:border-zinc-900 dark:ring-zinc-700"
                  title="Remove from compare"
                >
                  {img ? (
                    <Image
                      src={img}
                      alt="Compare item"
                      fill
                      className="object-cover"
                      sizes="40px"
                    />
                  ) : (
                    <div className="h-full w-full bg-zinc-200 dark:bg-zinc-700" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={clearItems}>
            Clear
          </Button>
          <Button size="sm" onClick={toggleOpen} disabled={items.length < 2}>
            {isOpen ? "Close" : "Compare"}
          </Button>
        </div>
      </div>
    </div>
  );
}
