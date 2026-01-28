"use client";

import { SignInButton, SignUpButton, useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/Button";
import { analytics } from "@/lib/analytics";

interface SignInPromptProps {
  message?: string;
  onDismiss: () => void;
}

export function SignInPrompt({ message, onDismiss }: SignInPromptProps) {
  const { isSignedIn } = useUser();

  // Don't show if already signed in
  if (isSignedIn) {
    return null;
  }

  const handleDismiss = () => {
    analytics.track("auth:prompt_dismissed", { source: "agent_prompt" });
    onDismiss();
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <p className="mb-3 text-sm text-zinc-600 dark:text-zinc-300">
        {message ||
          "Sign in to save your conversations and get personalized recommendations."}
      </p>
      <div className="flex gap-2">
        <SignInButton mode="modal">
          <Button
            size="sm"
            onClick={() =>
              analytics.track("auth:sign_in_clicked", {
                source: "agent_prompt",
              })
            }
          >
            Sign In
          </Button>
        </SignInButton>
        <SignUpButton mode="modal">
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              analytics.track("auth:sign_up_clicked", {
                source: "agent_prompt",
              })
            }
          >
            Sign Up
          </Button>
        </SignUpButton>
        <Button variant="ghost" size="sm" onClick={handleDismiss}>
          Maybe Later
        </Button>
      </div>
    </div>
  );
}
