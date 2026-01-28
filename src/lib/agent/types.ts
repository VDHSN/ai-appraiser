/**
 * Type definitions for the multi-agent framework.
 */

import { z } from "zod";

export const AgentIdSchema = z.enum(["curator", "appraiser"]);
export type AgentId = z.infer<typeof AgentIdSchema>;

export type ToolName =
  | "searchItems"
  | "getItemDetails"
  | "getPriceHistory"
  | "assessValue"
  | "switchAgentMode"
  | "promptSignIn";

export interface AgentPlaceholder {
  text: string;
  example: string;
}

export interface AgentConfig {
  id: AgentId;
  name: string;
  description: string;
  systemPrompt: string;
  toolIds: ToolName[];
  placeholder: AgentPlaceholder;
  model?: string;
  maxSteps?: number;
}
