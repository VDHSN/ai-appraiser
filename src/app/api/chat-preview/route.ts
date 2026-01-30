/**
 * API endpoint to generate a short preview/title for a chat conversation.
 * Uses Gemini Flash for fast, cost-effective summarization.
 */

import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const RequestSchema = z.object({
  messages: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
    }),
  ),
});

const SYSTEM_PROMPT = `You are a helpful assistant that generates very short, descriptive titles for chat conversations.

Given a conversation between a user and an assistant about collectibles, antiques, or appraisals, generate a concise title (3-6 words) that captures the main topic.

Rules:
- Keep it under 6 words
- Focus on the main item or topic being discussed
- Use title case
- Don't include quotes or punctuation at the end
- Be specific about the item type when possible

Examples:
- "Vintage Rolex Submariner Value"
- "Tiffany Lamp Authentication"
- "Victorian Era Jewelry Collection"
- "1960s Baseball Card Pricing"`;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = RequestSchema.safeParse(body);

    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid request" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { messages } = parsed.data;

    // Format messages for the prompt
    const conversationText = messages
      .slice(0, 10) // Only use first 10 messages to keep context small
      .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
      .join("\n");

    const result = await generateText({
      model: google("gemini-2.0-flash"),
      system: SYSTEM_PROMPT,
      prompt: `Generate a short title for this conversation:\n\n${conversationText}`,
    });

    const preview = result.text.trim().replace(/["']/g, "");

    return new Response(JSON.stringify({ preview }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Failed to generate chat preview:", error);

    // Return a fallback preview
    return new Response(
      JSON.stringify({
        preview: "Chat Conversation",
        error: "Generation failed",
      }),
      {
        status: 200, // Still return 200 so the client can use fallback
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
