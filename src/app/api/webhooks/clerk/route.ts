import { Webhook } from "svix";
import { headers } from "next/headers";
import type { WebhookEvent } from "@clerk/nextjs/server";
import { serverAnalytics } from "@/lib/analytics/server";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
  if (!WEBHOOK_SECRET) {
    throw new Error("Missing CLERK_WEBHOOK_SECRET environment variable");
  }

  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Missing svix headers", { status: 400 });
  }

  const body = await req.text();
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return new Response("Webhook verification failed", { status: 400 });
  }

  switch (evt.type) {
    case "user.created":
      // Use user_id as distinctId to link with client-side identity
      serverAnalytics.track(
        "auth:sign_up",
        {
          user_id: evt.data.id,
          method: evt.data.external_accounts?.[0]?.provider ?? "email",
          source: "webhook",
        },
        evt.data.id,
      );
      break;

    case "session.created":
      // Use user_id as distinctId to link with client-side identity
      serverAnalytics.track(
        "auth:sign_in",
        {
          user_id: evt.data.user_id,
        },
        evt.data.user_id,
      );
      break;

    case "session.ended":
      // Use user_id as distinctId to link with client-side identity
      serverAnalytics.track(
        "auth:sign_out",
        {
          user_id: evt.data.user_id,
        },
        evt.data.user_id,
      );
      break;
  }

  return new Response("OK", { status: 200 });
}
