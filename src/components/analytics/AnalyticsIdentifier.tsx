"use client";

import { useEffect, useRef } from "react";
import { useUser } from "@clerk/nextjs";
import { analytics } from "@/lib/analytics";

/**
 * Component that identifies users in analytics when they sign in.
 * Must be rendered inside ClerkProvider.
 * Renders nothing - purely for side effects.
 *
 * On sign in:
 * - Calls analytics.identify() with user properties (email, first_name, last_name)
 * - Fires user:sign_in event
 *
 * On sign out:
 * - Fires user:sign_out event
 * - Calls analytics.reset() to clear identity
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
      // Extract user properties
      const email = user.emailAddresses[0]?.emailAddress;
      const firstName = user.firstName ?? undefined;
      const lastName = user.lastName ?? undefined;
      const fullName = user.fullName ?? undefined;

      // Identify user in PostHog with full properties
      analytics.identify(currentUserId, {
        email,
        name: fullName,
        first_name: firstName,
        last_name: lastName,
      });

      // Fire sign in event
      analytics.track("user:sign_in", {
        user_id: currentUserId,
        email,
        first_name: firstName,
        last_name: lastName,
      });
    } else if (previousUserId.current !== null) {
      // Fire sign out event before resetting identity
      analytics.track("user:sign_out", {
        user_id: previousUserId.current,
      });

      // User signed out - reset analytics identity
      analytics.reset();
    }

    previousUserId.current = currentUserId;
  }, [isLoaded, isSignedIn, user]);

  return null;
}
