import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { createEdgeLogger } from "@/lib/logging/edge/logger";

const isPublicRoute = createRouteMatcher([
  "/",
  "/api/chat",
  "/api/image",
  "/api/webhooks/clerk",
]);

export default clerkMiddleware(async (auth, req) => {
  const startTime = Date.now();

  // All routes are public for now, but middleware enables auth context
  // Future: use auth.protect() for protected routes
  void isPublicRoute(req);

  const { userId } = await auth();
  const response = NextResponse.next();

  // Log access using edge-compatible OTLP logger
  const url = new URL(req.url);
  const distinctId = req.headers.get("X-PostHog-DistinctId") ?? "anonymous";
  const origin = req.headers.get("origin") ?? url.origin;

  const log = createEdgeLogger({
    distinctId,
    origin,
    component: "middleware",
    userId,
  });

  const duration = Date.now() - startTime;
  log.info(`${req.method} ${url.pathname}`, {
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
  });

  return response;
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
