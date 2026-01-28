"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { analytics } from "@/lib/analytics";

/**
 * Component that identifies users in analytics when they sign in.
 * Must be rendered inside ClerkProvider.
 * Renders nothing - purely for side effects.
 */
export function AnalyticsIdentifier() {
  const { user, isSignedIn, isLoaded } = useUser();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    const currentUserId = isSignedIn && user ? user.id : null;

    // Only identify/reset when user state actually changes
    if (currentUserId === previousUserId.current) return;

    if (currentUserId && user) {
      const email = user.emailAddresses[0]?.emailAddress;
      analytics.identify(currentUserId, {
        email,
        name: user.fullName ?? undefined,
      });
    } else if (previousUserId.current !== null) {
      // User signed out - reset analytics identity
      analytics.reset();
    }

    previousUserId.current = currentUserId;
  }, [isLoaded, isSignedIn, user]);

  return null;
}
