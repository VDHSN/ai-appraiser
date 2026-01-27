/**
 * AI agent tool definitions using Vercel AI SDK.
 * Provides auction search, item details, price history, and valuation guidance.
 */

import { z } from "zod";
import { serverAnalytics } from "@/lib/analytics/server";
import { getAdapter, listPlatforms } from "@/lib/adapters/registry";
import type {
  PlatformAdapter,
  SearchResult,
  UnifiedItem,
} from "@/lib/adapters/types";
import type { ToolName } from "@/lib/agent/types";

/**
 * Execute search across multiple adapters in parallel.
 * Returns merged results from all platforms.
 * Tracks performance metrics for each adapter.
 */
async function searchAllAdapters<T>(
  platforms: string[] | undefined,
  searchFn: (adapter: PlatformAdapter) => Promise<T[]>,
  operationType: "search" | "price_history",
): Promise<T[]> {
  const targetPlatforms = platforms?.length ? platforms : listPlatforms();

  const results = await Promise.all(
    targetPlatforms.map(async (platform) => {
      const startTime = performance.now();
      let resultCount = 0;
      let success = true;
      let errorMessage: string | undefined;

      try {
        const adapter = getAdapter(platform);
        const adapterResults = await searchFn(adapter);
        resultCount = adapterResults.length;
        return adapterResults;
      } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : String(error);
        console.warn(`Search failed for ${platform}:`, error);
        return []; // Don't fail entire search if one adapter fails
      } finally {
        const latencyMs = Math.round(performance.now() - startTime);

        serverAnalytics.track("adapter_search", {
          platform,
          operation: operationType,
          result_count: resultCount,
          latency_ms: latencyMs,
          success,
          error: errorMessage,
          source: "agent",
        });
      }
    }),
  );

  return results.flat();
}

/**
 * Valuation assessment result shape.
 */
interface ValuationAssessment {
  itemId: string;
  comparablesCount: number;
  priceRange: { low: number; high: number; median: number } | null;
  confidence: "high" | "medium" | "low";
  factors: string[];
  recommendation: string;
}

/**
 * Mode switch result shape.
 */
interface ModeSwitchResult {
  switched: boolean;
  targetAgent: "curator" | "appraiser";
  reason: string;
}

/**
 * All tools exported for use in the chat endpoint.
 * Using inline tool definitions as per AI SDK v6 patterns.
 */
export const tools = {
  searchItems: {
    description:
      "Search for active auction items. Use this to find items matching user criteria like keywords, category, or price range.",
    inputSchema: z.object({
      keywords: z.string().describe("Search keywords describing the item"),
      category: z
        .string()
        .optional()
        .describe('Category filter (e.g., "Furniture", "Art", "Jewelry")'),
      priceRange: z
        .object({
          min: z.number().optional().describe("Minimum price in USD"),
          max: z.number().optional().describe("Maximum price in USD"),
        })
        .optional()
        .describe("Price range filter"),
      pageSize: z
        .number()
        .min(1)
        .max(50)
        .default(12)
        .describe("Number of results to return"),
      platforms: z
        .array(z.string())
        .optional()
        .describe(
          `Filter to specific platforms. Available: ${listPlatforms().join(", ")}. Omit to search all.`,
        ),
    }),
    execute: async ({
      keywords,
      category,
      priceRange,
      pageSize,
      platforms,
    }: {
      keywords: string;
      category?: string;
      priceRange?: { min?: number; max?: number };
      pageSize: number;
      platforms?: string[];
    }): Promise<SearchResult[]> => {
      return searchAllAdapters(
        platforms,
        (adapter) =>
          adapter.search({
            keywords,
            category,
            priceRange,
            pageSize,
          }),
        "search",
      );
    },
  },

  getItemDetails: {
    description:
      "Get complete details for a specific auction item including description, images, estimates, condition, and seller info. Use this when users want to know more about a specific item.",
    inputSchema: z.object({
      platform: z
        .string()
        .describe(`Platform name. Available: ${listPlatforms().join(", ")}`),
      itemId: z.string().describe("The item ID on the platform"),
    }),
    execute: async ({
      platform,
      itemId,
    }: {
      platform: string;
      itemId: string;
    }): Promise<UnifiedItem> => {
      const startTime = performance.now();
      let success = true;
      let errorMessage: string | undefined;

      try {
        const adapter = getAdapter(platform);
        return await adapter.getItem(itemId);
      } catch (error) {
        success = false;
        errorMessage = error instanceof Error ? error.message : String(error);
        throw error;
      } finally {
        const latencyMs = Math.round(performance.now() - startTime);

        serverAnalytics.track("adapter_get_item", {
          platform,
          item_id: itemId,
          latency_ms: latencyMs,
          success,
          error: errorMessage,
          source: "agent",
        });
      }
    },
  },

  getPriceHistory: {
    description:
      "Search recently sold auction items to find comparable sales. Use this to help users understand market value by finding what similar items have sold for.",
    inputSchema: z.object({
      keywords: z.string().describe("Search keywords for comparable items"),
      category: z
        .string()
        .optional()
        .describe("Category filter to narrow comparables"),
      priceRange: z
        .object({
          min: z.number().optional().describe("Minimum sold price in USD"),
          max: z.number().optional().describe("Maximum sold price in USD"),
        })
        .optional()
        .describe("Price range for comparable sales"),
      pageSize: z
        .number()
        .min(1)
        .max(50)
        .default(12)
        .describe("Number of comparables to return"),
      platforms: z
        .array(z.string())
        .optional()
        .describe(
          `Filter to specific platforms. Available: ${listPlatforms().join(", ")}. Omit to search all.`,
        ),
    }),
    execute: async ({
      keywords,
      category,
      priceRange,
      pageSize,
      platforms,
    }: {
      keywords: string;
      category?: string;
      priceRange?: { min?: number; max?: number };
      pageSize: number;
      platforms?: string[];
    }): Promise<SearchResult[]> => {
      return searchAllAdapters(
        platforms,
        (adapter) =>
          adapter.getPriceHistory({
            keywords,
            category,
            priceRange,
            pageSize,
          }),
        "price_history",
      );
    },
  },

  assessValue: {
    description:
      "Provide valuation guidance for an item based on comparable sales data. Use this after gathering item details and finding comparables to synthesize a value assessment.",
    inputSchema: z.object({
      itemId: z.string().describe("The item ID being assessed"),
      comparables: z
        .array(
          z.object({
            title: z.string(),
            soldPrice: z.number(),
            soldDate: z.string().optional(),
            condition: z.string().optional(),
          }),
        )
        .min(1)
        .describe("Array of comparable sold items with prices"),
    }),
    execute: async ({
      itemId,
      comparables,
    }: {
      itemId: string;
      comparables: Array<{
        title: string;
        soldPrice: number;
        soldDate?: string;
        condition?: string;
      }>;
    }): Promise<ValuationAssessment> => {
      const prices = comparables.map((c) => c.soldPrice).sort((a, b) => a - b);
      const count = prices.length;

      let priceRange: ValuationAssessment["priceRange"] = null;
      let confidence: ValuationAssessment["confidence"] = "low";

      if (count >= 3) {
        const low = prices[0];
        const high = prices[count - 1];
        const median =
          count % 2 === 0
            ? (prices[count / 2 - 1] + prices[count / 2]) / 2
            : prices[Math.floor(count / 2)];

        priceRange = { low, high, median };
        confidence = count >= 10 ? "high" : count >= 5 ? "medium" : "low";
      }

      const factors: string[] = [];
      if (count < 5) factors.push("Limited comparable data available");
      if (priceRange && priceRange.high > priceRange.low * 3) {
        factors.push(
          "Wide price variance suggests condition or attribution differences",
        );
      }
      if (comparables.some((c) => !c.condition)) {
        factors.push("Condition data missing from some comparables");
      }

      let recommendation: string;
      if (confidence === "high" && priceRange) {
        recommendation = `Market value likely between $${priceRange.low.toLocaleString()} - $${priceRange.high.toLocaleString()}, with median at $${priceRange.median.toLocaleString()}`;
      } else if (confidence === "medium" && priceRange) {
        recommendation = `Estimated range $${priceRange.low.toLocaleString()} - $${priceRange.high.toLocaleString()}, but limited data suggests getting additional opinions`;
      } else {
        recommendation =
          "Insufficient comparable data for reliable valuation. Consider professional appraisal.";
      }

      return {
        itemId,
        comparablesCount: count,
        priceRange,
        confidence,
        factors,
        recommendation,
      };
    },
  },

  switchAgentMode: {
    description:
      "Switch to a DIFFERENT agent mode. Only use this to switch to an agent you are NOT currently. After switching, continue helping the user - do not stop.",
    inputSchema: z.object({
      targetAgent: z
        .enum(["curator", "appraiser"])
        .describe("The agent to switch to (must be different from current)"),
      reason: z
        .string()
        .describe("Brief explanation of why switching is appropriate"),
    }),
    execute: async ({
      targetAgent,
      reason,
    }: {
      targetAgent: "curator" | "appraiser";
      reason: string;
    }): Promise<ModeSwitchResult> => {
      return { switched: true, targetAgent, reason };
    },
  },
};

/**
 * Get a subset of tools by their names.
 * Used to provide different tools to different agents.
 */
export function getToolSubset(toolIds: ToolName[]): Partial<typeof tools> {
  return Object.fromEntries(
    Object.entries(tools).filter(([key]) => toolIds.includes(key as ToolName)),
  ) as Partial<typeof tools>;
}

// Export individual tools for direct access in tests
export const {
  searchItems,
  getItemDetails,
  getPriceHistory,
  assessValue,
  switchAgentMode,
} = tools;
