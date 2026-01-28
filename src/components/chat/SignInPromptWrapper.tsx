"use client";

import { useCallback, useSyncExternalStore, useRef, useEffect } from "react";
import { SignInPrompt } from "@/components/auth";
import { analytics } from "@/lib/analytics";
import { useAgent } from "@/lib/agent";

const STORAGE_KEY = "auth_prompt_dismissed";

function getSnapshot(): boolean {
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function getServerSnapshot(): boolean {
  return true; // SSR: assume dismissed to avoid hydration mismatch
}

interface SignInPromptWrapperProps {
  message?: string;
}

export function SignInPromptWrapper({ message }: SignInPromptWrapperProps) {
  const { agentId } = useAgent();
  const hasTrackedRef = useRef(false);

  const subscribe = useCallback((callback: () => void) => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) callback();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  const isDismissed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  // Track prompt shown only once per mount
  useEffect(() => {
    if (!isDismissed && !hasTrackedRef.current) {
      hasTrackedRef.current = true;
      analytics.track("auth:prompt_shown", {
        agent_id: agentId,
        source: "agent",
      });
    }
  }, [isDismissed, agentId]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, "true");
    // Manually trigger re-render since storage event only fires in other tabs
    window.dispatchEvent(
      new StorageEvent("storage", { key: STORAGE_KEY, newValue: "true" }),
    );
  }, []);

  if (isDismissed) {
    return null;
  }

  return <SignInPrompt message={message} onDismiss={handleDismiss} />;
}
