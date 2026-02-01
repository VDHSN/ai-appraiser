/**
 * Analytics type definitions for the auction proxy agent.
 * Provides type-safe event tracking with separate client/server interfaces.
 */

// Event source attribution
export type EventSource = "user" | "agent";

// Auth source attribution
export type AuthSource = "header" | "agent_prompt";

// All tracked events with their properties
export interface AnalyticsEvents {
  // Client events (user-initiated, no server context)
  "user:link_clicked": {
    item_id: string;
    platform: string;
    url: string;
    source: "user";
  };
  "user:agent_switched": {
    from_agent: string;
    to_agent: string;
    source: EventSource;
    session_id: string | null;
    is_restored: boolean;
    restored_session_id: string | null;
  };
  "agent:tool_called": {
    tool_name: string;
    tool_params: unknown;
    agent_id: string;
    source: "agent";
    session_id: string | null;
    is_restored: boolean;
    restored_session_id: string | null;
  };
  "chat:restored": {
    chat_title: string;
    agent_id: string;
    session_id: string;
  };
  "chat:deleted": {
    chat_title: string;
    agent_id: string;
    session_id: string;
  };
  "chat:started": {
    agent_id: string;
    session_id: string;
  };
  "chat:session_not_found": {
    session_id: string;
    source: "direct_url" | "error_banner";
  };

  // Auth client events
  "auth:sign_in_clicked": { source: AuthSource };
  "auth:sign_up_clicked": { source: AuthSource };
  "auth:prompt_shown": { agent_id: string; source: "agent" };
  "auth:prompt_dismissed": { source: "agent_prompt" };

  // Server events
  "adapter:search": {
    platform: string;
    operation: "search" | "price_history";
    result_count: number;
    latency_ms: number;
    success: boolean;
    error?: string;
    source: "agent";
  };
  "adapter:get_item": {
    platform: string;
    item_id: string;
    latency_ms: number;
    success: boolean;
    error?: string;
    source: "agent";
  };
  "chat:user_message": {
    agent_id: string;
    content: string;
    message_length: number;
    session_id: string | null;
    is_restored: boolean;
    restored_session_id: string | null;
  };
  "chat:agent_response": {
    agent_id: string;
    content: string;
    response_length: number;
    has_tool_calls: boolean;
    tool_count: number;
    session_id: string | null;
    is_restored: boolean;
    restored_session_id: string | null;
  };
  "chat:ai_error": {
    agent_id: string;
    error_type: string;
    error_message: string;
    session_id: string | null;
    is_restored: boolean;
    restored_session_id: string | null;
  };

  // Auth server events (from Clerk webhooks)
  "auth:sign_up": { user_id: string; method: string; source: string };
  "auth:sign_in": { user_id: string; source?: string };
  "auth:sign_out": { user_id: string };
}

// User properties for identify
export interface UserProperties {
  email?: string;
  name?: string;
  plan?: string;
  [key: string]: unknown;
}

// Client-only events (user-initiated)
export interface ClientAnalyticsEvents {
  "user:link_clicked": AnalyticsEvents["user:link_clicked"];
  "user:agent_switched": AnalyticsEvents["user:agent_switched"];
  "agent:tool_called": AnalyticsEvents["agent:tool_called"];
  "chat:restored": AnalyticsEvents["chat:restored"];
  "chat:deleted": AnalyticsEvents["chat:deleted"];
  "chat:started": AnalyticsEvents["chat:started"];
  "chat:session_not_found": AnalyticsEvents["chat:session_not_found"];
  "auth:sign_in_clicked": AnalyticsEvents["auth:sign_in_clicked"];
  "auth:sign_up_clicked": AnalyticsEvents["auth:sign_up_clicked"];
  "auth:prompt_shown": AnalyticsEvents["auth:prompt_shown"];
  "auth:prompt_dismissed": AnalyticsEvents["auth:prompt_dismissed"];
}

// Server-only events (agent/system-initiated)
export interface ServerAnalyticsEvents {
  "adapter:search": AnalyticsEvents["adapter:search"];
  "adapter:get_item": AnalyticsEvents["adapter:get_item"];
  "chat:user_message": AnalyticsEvents["chat:user_message"];
  "chat:agent_response": AnalyticsEvents["chat:agent_response"];
  "chat:ai_error": AnalyticsEvents["chat:ai_error"];
  "auth:sign_up": AnalyticsEvents["auth:sign_up"];
  "auth:sign_in": AnalyticsEvents["auth:sign_in"];
  "auth:sign_out": AnalyticsEvents["auth:sign_out"];
}

// Client analytics interface (browser only)
export interface ClientAnalytics {
  // Initialize (call once on app load)
  init(apiKey: string, options?: { host?: string }): void;

  // Track client events only
  track<E extends keyof ClientAnalyticsEvents>(
    event: E,
    properties: ClientAnalyticsEvents[E],
  ): void;

  // User identification
  identify(userId: string, properties?: UserProperties): void;
  reset(): void;

  // Error tracking
  captureException(error: Error, context?: Record<string, unknown>): void;

  // Session management
  getSessionId(): string | undefined;
  getDistinctId(): string | undefined;

  // Page tracking
  pageView(path: string, properties?: Record<string, unknown>): void;
}

// Server analytics interface (Node.js only)
export interface ServerAnalytics {
  // Track server events only
  track<E extends keyof ServerAnalyticsEvents>(
    event: E,
    properties: ServerAnalyticsEvents[E],
  ): void;

  // Error tracking
  captureException(error: Error, context?: Record<string, unknown>): void;

  // Graceful shutdown
  shutdown(): Promise<void>;
}
