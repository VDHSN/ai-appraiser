/**
 * Streaming chat endpoint for the auction AI agents.
 * Uses Vercel AI SDK with Google Gemini and agent-specific tools.
 */

import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { getToolSubset } from "@/lib/tools";
import { getAgent, AgentIdSchema, getDefaultAgentId } from "@/lib/agent";

const RequestSchema = z.object({
  messages: z.array(z.any()),
  agentId: AgentIdSchema.optional(),
});

export async function POST(req: Request) {
  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { messages, agentId = getDefaultAgentId() } = parsed.data;
  const agent = getAgent(agentId);
  const tools = getToolSubset(agent.toolIds);

  const result = streamText({
    model: google(agent.model ?? "gemini-3-pro-preview"),
    system: agent.systemPrompt,
    messages: await convertToModelMessages(messages as UIMessage[]),
    tools,
    stopWhen: stepCountIs(agent.maxSteps ?? 7),
  });

  return result.toUIMessageStreamResponse();
}
