/**
 * Type definitions for chat UI and tool invocation rendering.
 */

import type { SearchResult, UnifiedItem } from "@/lib/adapters/types";

export type ToolName =
  | "searchItems"
  | "getItemDetails"
  | "getPriceHistory"
  | "assessValue";

export interface ValuationAssessment {
  itemId: string;
  comparablesCount: number;
  priceRange: { low: number; high: number; median: number } | null;
  confidence: "high" | "medium" | "low";
  factors: string[];
  recommendation: string;
}

export type ToolResultMap = {
  searchItems: SearchResult[];
  getItemDetails: UnifiedItem;
  getPriceHistory: SearchResult[];
  assessValue: ValuationAssessment;
};

export interface ToolInvocationState {
  toolName: ToolName;
  toolCallId: string;
  state: "partial-call" | "call" | "result";
  args?: Record<string, unknown>;
  result?: ToolResultMap[ToolName];
}
