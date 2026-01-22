"use client";

import { useState } from "react";
import type { SearchResult } from "@/lib/adapters/types";
import { Badge } from "@/components/ui/Badge";
import { Price } from "@/components/ui/Price";
import { getProxiedImageUrl } from "@/lib/image-proxy";

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
  const [imgError, setImgError] = useState(false);
  const timeRemaining = formatTimeRemaining(item.endTime);

  const handleClick = () => {
    if (item.url) {
      window.open(item.url, "_blank", "noopener,noreferrer");
    }
    onSelect?.(item);
  };

  return (
    <div
      className="group relative cursor-pointer rounded-lg border border-zinc-200 bg-white transition-shadow hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900"
      onClick={handleClick}
    >
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-zinc-100 dark:bg-zinc-800">
        {imgError ? (
          <div className="flex h-full w-full items-center justify-center text-zinc-400">
            <svg
              className="h-12 w-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={getProxiedImageUrl(item.thumbnailUrl || item.imageUrl)}
            alt={item.title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={() => setImgError(true)}
            loading="lazy"
          />
        )}
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
