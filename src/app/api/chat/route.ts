/**
 * Streaming chat endpoint for the auction curator AI agent.
 * Uses Vercel AI SDK with Google Gemini and custom auction tools.
 */

import { streamText, UIMessage, convertToModelMessages, stepCountIs } from "ai";
import { google } from "@ai-sdk/google";
import { tools } from "@/lib/tools";
import { systemPrompt } from "@/lib/agent/system-prompt";

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: google("gemini-2.0-flash"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(5),
  });

  return result.toUIMessageStreamResponse();
}
