"use client";

import type { SearchResult, UnifiedItem } from "@/lib/adapters/types";
import type { ValuationAssessment } from "@/types/chat";
import { ItemCardGrid } from "@/components/items/ItemCardGrid";
import { ItemDetail } from "@/components/items/ItemDetail";
import { Badge } from "@/components/ui/Badge";
import { Skeleton } from "@/components/ui/Skeleton";

interface ToolInvocationProps {
  toolName: string;
  toolCallId: string;
  state: string;
  result?: unknown;
}

export function ToolInvocation({
  toolName,
  state,
  result,
}: ToolInvocationProps) {
  const isLoading =
    state === "input-streaming" ||
    state === "input-available" ||
    state === "output-streaming";

  if (isLoading) {
    return <ToolLoading toolName={toolName} />;
  }

  switch (toolName) {
    case "searchItems":
    case "getPriceHistory":
      return (
        <SearchResults items={result as SearchResult[]} toolName={toolName} />
      );
    case "getItemDetails":
      return <ItemDetail item={result as UnifiedItem} />;
    case "assessValue":
      return <ValuationResult assessment={result as ValuationAssessment} />;
    default:
      return (
        <div className="rounded-lg bg-zinc-100 p-3 text-sm dark:bg-zinc-800">
          <p className="text-zinc-500 dark:text-zinc-400">
            Unknown tool: {toolName}
          </p>
        </div>
      );
  }
}

function ToolLoading({ toolName }: { toolName: string }) {
  const labels: Record<string, string> = {
    searchItems: "Searching auctions...",
    getItemDetails: "Loading item details...",
    getPriceHistory: "Finding comparable sales...",
    assessValue: "Calculating valuation...",
  };

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        {labels[toolName] || "Loading..."}
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rectangular" className="h-32" />
        ))}
      </div>
    </div>
  );
}

function SearchResults({
  items,
  toolName,
}: {
  items: SearchResult[];
  toolName: string;
}) {
  const title =
    toolName === "getPriceHistory" ? "Comparable Sales" : "Search Results";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {title}
        </p>
        <Badge variant="outline">{items.length} items</Badge>
      </div>
      <ItemCardGrid items={items} />
    </div>
  );
}

function ValuationResult({ assessment }: { assessment: ValuationAssessment }) {
  const confidenceVariant =
    assessment.confidence === "high"
      ? "success"
      : assessment.confidence === "medium"
        ? "warning"
        : "error";

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
          Valuation Assessment
        </h3>
        <Badge variant={confidenceVariant}>
          {assessment.confidence} confidence
        </Badge>
      </div>

      {assessment.priceRange && (
        <div className="mb-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Estimated Value Range
          </p>
          <p className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            ${assessment.priceRange.low.toLocaleString()} - $
            {assessment.priceRange.high.toLocaleString()}
          </p>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Median: ${assessment.priceRange.median.toLocaleString()}
          </p>
        </div>
      )}

      <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
        {assessment.recommendation}
      </p>

      {assessment.factors.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Factors
          </p>
          <ul className="space-y-1">
            {assessment.factors.map((factor, i) => (
              <li key={i} className="text-xs text-zinc-600 dark:text-zinc-400">
                {factor}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-3 text-xs text-zinc-400 dark:text-zinc-500">
        Based on {assessment.comparablesCount} comparable sale
        {assessment.comparablesCount !== 1 ? "s" : ""}
      </p>
    </div>
  );
}
