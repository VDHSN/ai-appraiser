/**
 * Streaming chat endpoint for the auction AI agents.
 * Uses Vercel AI SDK with Google Gemini and agent-specific tools.
 */

import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { z } from "zod";
import { getTracedModel } from "@/lib/analytics/llm";
import { serverAnalytics } from "@/lib/analytics/server";
import { POSTHOG_DISTINCT_ID_HEADER } from "@/lib/analytics/server";
import { runWithAnalyticsContext } from "@/lib/analytics/context";
import { getToolSubset } from "@/lib/tools";
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
  // Extract PostHog distinctId from header to link server events with client identity
  const distinctId = req.headers.get(POSTHOG_DISTINCT_ID_HEADER) || undefined;

  // Run the entire request handler within analytics context so tools can access distinctId
  return runWithAnalyticsContext(distinctId, async () => {
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
    const agent = getAgent(agentId);
    const tools = getToolSubset(agent.toolIds);

    // Track user message with distinctId for user attribution
    const lastUserMessage = (messages as UIMessage[]).findLast(
      (m) => m.role === "user",
    );
    if (lastUserMessage) {
      const content = extractTextContent(lastUserMessage);
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
        distinctId,
      );
    }

    const result = streamText({
      model: getTracedModel(agent.model ?? "gemini-3-pro-preview"),
      system: agent.systemPrompt,
      messages: await convertToModelMessages(messages as UIMessage[]),
      tools,
      stopWhen: stepCountIs(agent.maxSteps ?? 7),
      onFinish: ({ text, toolCalls }) => {
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
          distinctId,
        );
      },
    });

    return result.toUIMessageStreamResponse();
  });
}
