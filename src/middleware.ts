import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/api/chat",
  "/api/image",
  "/api/webhooks/clerk",
]);

/**
 * Send access log to PostHog using $log event.
 * Uses fetch for edge runtime compatibility.
 */
function logAccess(
  req: Request,
  startTime: number,
  userId: string | null,
): void {
  const url = new URL(req.url);
  const duration = Date.now() - startTime;
  const distinctId = req.headers.get("X-PostHog-DistinctId") ?? "anonymous";

  const properties = {
    level: "info",
    message: `${req.method} ${url.pathname}`,
    timestamp: new Date().toISOString(),
    source: "middleware",
    distinctId,
    // Access log fields
    method: req.method,
    path: url.pathname,
    query: url.search || null,
    userAgent: req.headers.get("user-agent") ?? null,
    referer: req.headers.get("referer") ?? null,
    duration,
    userId,
    ip:
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      null,
  };

  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host =
    process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  if (!apiKey) return;

  // Fire and forget - don't await to avoid blocking the response
  fetch(`${host}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      distinct_id: distinctId,
      event: "$log",
      properties,
    }),
  }).catch(() => {
    // Silently ignore logging failures
  });
}

export default clerkMiddleware(async (auth, req) => {
  const startTime = Date.now();

  // All routes are public for now, but middleware enables auth context
  // Future: use auth.protect() for protected routes
  void isPublicRoute(req);

  const { userId } = await auth();
  const response = NextResponse.next();

  // Log access asynchronously
  logAccess(req, startTime, userId);

  return response;
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
