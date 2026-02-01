/**
 * Streaming chat endpoint for the auction AI agents.
 * Uses Vercel AI SDK with Google Gemini and agent-specific tools.
 */

import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";
import { auth } from "@clerk/nextjs/server";
import { getTracedModel } from "@/lib/analytics/llm";
import { serverAnalytics } from "@/lib/analytics/server";
import { serverLoggerFactory } from "@/lib/logging/server";
import { getToolSubsetWithContext } from "@/lib/tools";
import { getAgent, AgentIdSchema, getDefaultAgentId } from "@/lib/agent";

function extractTextContent(message: UIMessage): string {
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

const RequestSchema = z.object({
  messages: z.array(z.any()),
  agentId: AgentIdSchema.optional(),
  sessionId: z.string().nullable().optional(),
  isRestored: z.boolean().optional(),
  restoredSessionId: z.string().nullable().optional(),
});

export async function POST(req: Request) {
  // Extract distinct ID from header for server-side logging
  const distinctId = req.headers.get("X-PostHog-DistinctId") ?? "anonymous";

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const {
    messages,
    agentId = getDefaultAgentId(),
    sessionId = null,
    isRestored = false,
    restoredSessionId = null,
  } = parsed.data;

  const { userId } = await auth();
  const agent = getAgent(agentId);
  const tools = getToolSubsetWithContext(agent.toolIds, {
    userId: userId ?? undefined,
  });

  // Create request-scoped logger with full context
  const log = serverLoggerFactory.create({
    distinctId,
    sessionId,
    agentId,
    isRestored,
    restoredSessionId,
  });

  // Track user message
  const lastUserMessage = (messages as UIMessage[]).findLast(
    (m) => m.role === "user",
  );
  if (lastUserMessage) {
    const content = extractTextContent(lastUserMessage);
    log.info("User message received", { messageLength: content.length });
    serverAnalytics.track(
      "chat:user_message",
      {
        agent_id: agentId,
        content,
        message_length: content.length,
        session_id: sessionId,
        is_restored: isRestored,
        restored_session_id: restoredSessionId,
      },
      userId ?? undefined,
    );
  }

  try {
    const result = streamText({
      model: getTracedModel(agent.model ?? "gemini-3-pro-preview"),
      system: agent.systemPrompt,
      messages: await convertToModelMessages(messages as UIMessage[]),
      tools,
      stopWhen: stepCountIs(agent.maxSteps ?? 7),
      onFinish: ({ text, toolCalls }) => {
        log.info("Agent response complete", {
          responseLength: text.length,
          hasToolCalls: toolCalls.length > 0,
          toolCount: toolCalls.length,
        });
        serverAnalytics.track(
          "chat:agent_response",
          {
            agent_id: agentId,
            content: text,
            response_length: text.length,
            has_tool_calls: toolCalls.length > 0,
            tool_count: toolCalls.length,
            session_id: sessionId,
            is_restored: isRestored,
            restored_session_id: restoredSessionId,
          },
          userId ?? undefined,
        );
      },
      onError: ({ error }) => {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        log.error("Stream error", { errorMessage });
        serverAnalytics.track(
          "chat:ai_error",
          {
            agent_id: agentId,
            error_type: "stream_error",
            error_message: errorMessage,
            session_id: sessionId,
            is_restored: isRestored,
            restored_session_id: restoredSessionId,
          },
          userId ?? undefined,
        );
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("Request error", { errorMessage });

    serverAnalytics.track(
      "chat:ai_error",
      {
        agent_id: agentId,
        error_type: "request_error",
        error_message: errorMessage,
        session_id: sessionId,
        is_restored: isRestored,
        restored_session_id: restoredSessionId,
      },
      userId ?? undefined,
    );

    return new Response(
      JSON.stringify({ type: "error", errorText: errorMessage }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
