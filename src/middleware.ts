import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPublicRoute = createRouteMatcher([
  "/",
  "/api/chat",
  "/api/image",
  "/api/webhooks/clerk",
]);

export default clerkMiddleware(async (auth, req) => {
  // All routes are public for now, but middleware enables auth context
  // Future: use auth.protect() for protected routes
  void isPublicRoute(req);
});

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
