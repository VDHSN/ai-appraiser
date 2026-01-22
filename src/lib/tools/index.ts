/**
 * AI agent tool definitions using Vercel AI SDK.
 * Provides auction search, item details, price history, and valuation guidance.
 */

import { z } from "zod";
import { getAdapter, listPlatforms } from "@/lib/adapters/registry";
import type { SearchResult, UnifiedItem } from "@/lib/adapters/types";

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
    }),
    execute: async ({
      keywords,
      category,
      priceRange,
      pageSize,
    }: {
      keywords: string;
      category?: string;
      priceRange?: { min?: number; max?: number };
      pageSize: number;
    }): Promise<SearchResult[]> => {
      const adapter = getAdapter("liveauctioneers");
      return adapter.search({
        keywords,
        category,
        priceRange,
        pageSize,
      });
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
      const adapter = getAdapter(platform);
      return adapter.getItem(itemId);
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
    }),
    execute: async ({
      keywords,
      category,
      priceRange,
      pageSize,
    }: {
      keywords: string;
      category?: string;
      priceRange?: { min?: number; max?: number };
      pageSize: number;
    }): Promise<SearchResult[]> => {
      const adapter = getAdapter("liveauctioneers");
      return adapter.getPriceHistory({
        keywords,
        category,
        priceRange,
        pageSize,
      });
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
};

// Export individual tools for direct access in tests
export const { searchItems, getItemDetails, getPriceHistory, assessValue } =
  tools;
