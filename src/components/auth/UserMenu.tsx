"use client";

import { SignInButton, SignUpButton, UserButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/Button";
import { analytics } from "@/lib/analytics";

export function UserMenu() {
  const { isSignedIn, isLoaded } = useUser();

  if (!isLoaded) {
    return <div className="h-8 w-8 animate-pulse rounded-full bg-zinc-200" />;
  }

  if (isSignedIn) {
    return <UserButton afterSignOutUrl="/" />;
  }

  return (
    <div className="flex gap-2">
      <SignInButton mode="modal">
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            analytics.track("auth:sign_in_clicked", { source: "header" })
          }
        >
          Sign In
        </Button>
      </SignInButton>
      <SignUpButton mode="modal">
        <Button
          size="sm"
          onClick={() =>
            analytics.track("auth:sign_up_clicked", { source: "header" })
          }
        >
          Sign Up
        </Button>
      </SignUpButton>
    </div>
  );
}
