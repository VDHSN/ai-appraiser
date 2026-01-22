"use client";

import Image from "next/image";
import { useCompareStore, type CompareItem } from "@/stores/compare-store";
import { Price, PriceRange } from "@/components/ui/Price";
import { Button } from "@/components/ui/Button";

function getItemId(item: CompareItem): string {
  return "id" in item ? item.id : item.itemId;
}

function getItemTitle(item: CompareItem): string {
  return item.title;
}

function getItemImage(item: CompareItem): string {
  if ("images" in item && item.images.length > 0) return item.images[0];
  if ("thumbnailUrl" in item && item.thumbnailUrl) return item.thumbnailUrl;
  if ("imageUrl" in item) return item.imageUrl;
  return "";
}

function getItemPrice(item: CompareItem): number {
  return item.currentPrice;
}

function getItemCurrency(item: CompareItem): string {
  return item.currency;
}

function getEstimate(
  item: CompareItem,
): { low: number; high: number } | undefined {
  if ("estimateRange" in item) return item.estimateRange;
  return undefined;
}

function getCondition(item: CompareItem): string | undefined {
  if ("condition" in item) return item.condition;
  return undefined;
}

function getBidCount(item: CompareItem): number | undefined {
  return item.bidCount;
}

function getSeller(item: CompareItem): string {
  if ("seller" in item) return item.seller.name;
  if ("auctionHouse" in item && item.auctionHouse) return item.auctionHouse;
  return "Unknown";
}

export function CompareView() {
  const { items, isOpen, setOpen, removeItem } = useCompareStore();

  if (!isOpen || items.length < 2) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-zinc-950">
      <header className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          Compare Items
        </h2>
        <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
          Close
        </Button>
      </header>

      <div className="flex-1 overflow-x-auto p-4">
        <div
          className="grid gap-4"
          style={{
            gridTemplateColumns: `repeat(${items.length}, minmax(200px, 1fr))`,
          }}
        >
          {items.map((item) => {
            const img = getItemImage(item);
            const estimate = getEstimate(item);
            return (
              <div
                key={getItemId(item)}
                className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-900"
              >
                <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-zinc-100 dark:bg-zinc-800">
                  {img ? (
                    <Image
                      src={img}
                      alt={getItemTitle(item)}
                      fill
                      className="object-contain"
                      sizes="25vw"
                    />
                  ) : (
                    <div className="h-full w-full" />
                  )}
                  <button
                    onClick={() => removeItem(getItemId(item))}
                    className="absolute right-2 top-2 rounded-full bg-zinc-900/70 p-1 text-white hover:bg-zinc-900"
                  >
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>

                <h3 className="mb-3 line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  {getItemTitle(item)}
                </h3>

                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Price</dt>
                    <dd>
                      <Price
                        amount={getItemPrice(item)}
                        currency={getItemCurrency(item)}
                      />
                    </dd>
                  </div>

                  {estimate && (
                    <div className="flex justify-between">
                      <dt className="text-zinc-500 dark:text-zinc-400">
                        Estimate
                      </dt>
                      <dd>
                        <PriceRange
                          low={estimate.low}
                          high={estimate.high}
                          currency={getItemCurrency(item)}
                        />
                      </dd>
                    </div>
                  )}

                  {getBidCount(item) !== undefined && (
                    <div className="flex justify-between">
                      <dt className="text-zinc-500 dark:text-zinc-400">Bids</dt>
                      <dd className="text-zinc-900 dark:text-zinc-100">
                        {getBidCount(item)}
                      </dd>
                    </div>
                  )}

                  {getCondition(item) && (
                    <div className="flex justify-between">
                      <dt className="text-zinc-500 dark:text-zinc-400">
                        Condition
                      </dt>
                      <dd className="text-right text-zinc-900 dark:text-zinc-100">
                        {getCondition(item)}
                      </dd>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <dt className="text-zinc-500 dark:text-zinc-400">Seller</dt>
                    <dd className="truncate text-right text-zinc-900 dark:text-zinc-100">
                      {getSeller(item)}
                    </dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
