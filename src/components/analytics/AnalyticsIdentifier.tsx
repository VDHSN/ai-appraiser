"use client";

import { useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { analytics } from "@/lib/analytics";

// Module-level state persists across component re-mounts
let lastIdentifiedUserId: string | null = null;

/**
 * Component that identifies users in analytics when they sign in.
 * Must be rendered inside ClerkProvider.
 * Renders nothing - purely for side effects.
 */
export function AnalyticsIdentifier() {
  const { user, isSignedIn, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !analytics.isInitialized()) return;

    const currentUserId = isSignedIn && user ? user.id : null;

    // Only identify/reset when user state actually changes
    if (currentUserId === lastIdentifiedUserId) return;

    if (currentUserId && user) {
      const email = user.primaryEmailAddress?.emailAddress;
      analytics.identify(currentUserId, {
        email,
        name: user.fullName ?? undefined,
      });
    } else if (lastIdentifiedUserId !== null) {
      // User signed out - reset analytics identity
      analytics.reset();
    }

    lastIdentifiedUserId = currentUserId;
  }, [isLoaded, isSignedIn, user]);

  return null;
}

/**
 * Reset the module-level tracking state.
 * Exported for testing purposes only.
 */
export function resetIdentifierState() {
  lastIdentifiedUserId = null;
}
