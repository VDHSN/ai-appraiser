"use client";

/**
 * @deprecated This component is deprecated. Use URL-based routing instead:
 * - Landing page: / (renders HomePage)
 * - Chat session: /{sessionId} (renders ChatView)
 *
 * This file is kept for backwards compatibility but will be removed in a future version.
 */

import { HomePage } from "./HomePage";

/**
 * @deprecated Use HomePage component directly or URL-based routing
 */
export function NewUIContainer() {
  // With URL-based routing, this component just renders the landing page
  // The session page at /[sessionId] handles the chat view
  return <HomePage />;
}
