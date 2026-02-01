"use client";

/**
 * Error banner displayed at the top of the landing page.
 * Reads error param from URL and displays appropriate message.
 * Clears error param after display and fires analytics event.
 */

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { analytics } from "@/lib/analytics";

const ERROR_MESSAGES: Record<string, string> = {
  session_not_found: "The chat session you're looking for doesn't exist.",
};

export function ErrorBanner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");
    if (error && ERROR_MESSAGES[error]) {
      setErrorMessage(ERROR_MESSAGES[error]);

      // Fire analytics event
      if (error === "session_not_found") {
        analytics.track("chat:session_not_found", {
          session_id: "unknown",
          source: "error_banner",
        });
      }

      // Clear error param from URL after display
      router.replace("/", { scroll: false });
    }
  }, [searchParams, router]);

  if (!errorMessage) return null;

  return (
    <div
      role="alert"
      className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-950/50 dark:text-red-400"
      data-testid="error-banner"
    >
      {errorMessage}
    </div>
  );
}
