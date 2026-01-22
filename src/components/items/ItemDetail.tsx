"use client";

import type { UnifiedItem } from "@/lib/adapters/types";
import { Badge } from "@/components/ui/Badge";
import { Price, PriceRange } from "@/components/ui/Price";
import { ImageGallery } from "./ImageGallery";

interface ItemDetailProps {
  item: UnifiedItem;
}

export function ItemDetail({ item }: ItemDetailProps) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="grid gap-6 md:grid-cols-2">
        <ImageGallery images={item.images} alt={item.title} />

        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {item.title}
          </h2>

          <div className="flex flex-wrap gap-2">
            {item.category.map((cat) => (
              <Badge key={cat} variant="outline">
                {cat}
              </Badge>
            ))}
            {item.lotNumber && <Badge>Lot {item.lotNumber}</Badge>}
          </div>

          <div className="space-y-1">
            <Price
              amount={item.currentPrice}
              currency={item.currency}
              size="lg"
            />
            {item.estimateRange && (
              <PriceRange
                low={item.estimateRange.low}
                high={item.estimateRange.high}
                currency={item.currency}
              />
            )}
            {item.bidCount !== undefined && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {item.bidCount} bid{item.bidCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Description
            </h3>
            <p className="whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
              {item.description}
            </p>
          </div>

          {item.condition && (
            <div>
              <h3 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Condition
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {item.condition}
              </p>
              {item.conditionNotes && (
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
                  {item.conditionNotes}
                </p>
              )}
            </div>
          )}

          {(item.dimensions || item.materials?.length) && (
            <div className="grid gap-4 sm:grid-cols-2">
              {item.dimensions && (
                <div>
                  <h3 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Dimensions
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {item.dimensions}
                  </p>
                </div>
              )}
              {item.materials && item.materials.length > 0 && (
                <div>
                  <h3 className="mb-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Materials
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {item.materials.join(", ")}
                  </p>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-zinc-200 pt-4 dark:border-zinc-700">
            <h3 className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Seller
            </h3>
            <p className="text-sm text-zinc-900 dark:text-zinc-100">
              {item.seller.name}
            </p>
            {item.seller.location && (
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {item.seller.location}
              </p>
            )}
          </div>

          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--accent-hover)]"
          >
            View on {item.platform}
          </a>
        </div>
      </div>
    </div>
  );
}
