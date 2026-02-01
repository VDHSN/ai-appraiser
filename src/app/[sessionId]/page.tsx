"use client";

/**
 * Dynamic session page for loading existing chat sessions.
 * Validates session ID, redirects to landing with error if not found.
 * Renders ChatView with resumed messages if session exists.
 */

import { useEffect, useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { validateSession, generateSessionId } from "@/lib/chat-history";
import { ChatView } from "@/components/home";
import type { UIMessage } from "@ai-sdk/react";
import type { AgentId } from "@/lib/agent/types";

interface SessionPageProps {
  params: Promise<{ sessionId: string }>;
}

interface SessionData {
  sessionId: string;
  agentId: AgentId;
  messages: UIMessage[];
  initialMessage?: string;
}

export default function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for initial message in URL (new chat flow)
    const initialMessage = searchParams.get("initial");
    const agentParam = searchParams.get("agent") as AgentId | null;

    // If this is a new chat with initial message, don't validate session
    if (initialMessage) {
      setSessionData({
        sessionId,
        agentId: agentParam || "curator",
        messages: [],
        initialMessage: decodeURIComponent(initialMessage),
      });
      setIsLoading(false);
      // Clear the initial message from URL to prevent re-send on refresh
      router.replace(`/${sessionId}`, { scroll: false });
      return;
    }

    // Validate existing session
    const result = validateSession(sessionId);

    if (!result.valid || !result.session) {
      // Fire analytics event for session not found
      analytics.track("chat:session_not_found", {
        session_id: sessionId,
        source: "direct_url",
      });
      // Redirect to landing with error
      router.replace("/?error=session_not_found");
      return;
    }

    // Session found - set up data for ChatView
    setSessionData({
      sessionId: result.session.id,
      agentId: result.session.agentId,
      messages: result.session.messages,
    });
    setIsLoading(false);
  }, [sessionId, searchParams, router]);

  if (isLoading || !sessionData) {
    return (
      <div className="flex h-screen-dynamic items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
      </div>
    );
  }

  return (
    <ChatView
      sessionId={sessionData.sessionId}
      initialAgentId={sessionData.agentId}
      resumeMessages={
        sessionData.messages.length > 0 ? sessionData.messages : undefined
      }
      initialMessage={sessionData.initialMessage}
    />
  );
}
