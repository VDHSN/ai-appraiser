"use client";

import Image from "next/image";
import type { SearchResult } from "@/lib/adapters/types";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import { CompareToggle } from "@/components/compare/CompareToggle";

interface ItemCardProps {
  item: SearchResult;
  onSelect?: (item: SearchResult) => void;
}

function formatTimeRemaining(endTime?: Date): string | null {
  if (!endTime) return null;
  const now = new Date();
  const end = new Date(endTime);
  const diff = end.getTime() - now.getTime();
  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function ItemCard({ item, onSelect }: ItemCardProps) {
  const timeRemaining = formatTimeRemaining(item.endTime);

  return (
    <div
      className="group relative cursor-pointer rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
      onClick={() => onSelect?.(item)}
    >
      <div className="absolute right-2 top-2 z-10">
        <CompareToggle item={item} />
      </div>

      <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-zinc-100 dark:bg-zinc-800">
        <Image
          src={item.thumbnailUrl || item.imageUrl}
          alt={item.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        {item.status && item.status !== "live" && (
          <Badge
            variant={item.status === "sold" ? "success" : "default"}
            className="absolute bottom-2 left-2"
          >
            {item.status}
          </Badge>
        )}
      </div>

      <div className="p-3">
        <h3 className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
          {item.title}
        </h3>

        <div className="mt-2 flex items-center justify-between">
          <Price
            amount={item.currentPrice}
            currency={item.currency}
            size="lg"
          />
          {item.bidCount !== undefined && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {item.bidCount} bid{item.bidCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="mt-2 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
          {item.auctionHouse && (
            <span className="truncate">{item.auctionHouse}</span>
          )}
          {timeRemaining && (
            <Badge
              variant={timeRemaining.includes("m") ? "warning" : "outline"}
            >
              {timeRemaining}
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
