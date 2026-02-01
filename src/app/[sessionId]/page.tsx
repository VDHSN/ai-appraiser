"use client";

/**
 * Dynamic session page for loading existing chat sessions.
 * Validates session ID, redirects to landing with error if not found.
 * Renders ChatView with resumed messages if session exists.
 */

import { useEffect, useMemo, useRef, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { analytics } from "@/lib/analytics";
import { validateSession } from "@/lib/chat-history";
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

type SessionResult =
  | { type: "new_chat"; data: SessionData }
  | { type: "existing_session"; data: SessionData }
  | { type: "not_found" };

/**
 * Computes session data synchronously from URL params.
 * Returns session data or indicates session not found.
 */
function computeSessionResult(
  sessionId: string,
  searchParams: URLSearchParams,
): SessionResult {
  // Check for initial message in URL (new chat flow)
  const initialMessage = searchParams.get("initial");
  const agentParam = searchParams.get("agent") as AgentId | null;

  if (initialMessage) {
    return {
      type: "new_chat",
      data: {
        sessionId,
        agentId: agentParam || "curator",
        messages: [],
        initialMessage: decodeURIComponent(initialMessage),
      },
    };
  }

  // Validate existing session
  const result = validateSession(sessionId);

  if (!result.valid || !result.session) {
    return { type: "not_found" };
  }

  return {
    type: "existing_session",
    data: {
      sessionId: result.session.id,
      agentId: result.session.agentId,
      messages: result.session.messages,
    },
  };
}

export default function SessionPage({ params }: SessionPageProps) {
  const { sessionId } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const hasHandledRef = useRef(false);

  // Compute session data synchronously
  const sessionResult = useMemo(
    () => computeSessionResult(sessionId, searchParams),
    [sessionId, searchParams],
  );

  // Handle side effects (analytics, URL cleanup, redirects)
  useEffect(() => {
    if (hasHandledRef.current) return;

    if (sessionResult.type === "new_chat") {
      hasHandledRef.current = true;
      // Clear the initial message from URL to prevent re-send on refresh
      router.replace(`/${sessionId}`, { scroll: false });
    } else if (sessionResult.type === "not_found") {
      hasHandledRef.current = true;
      // Fire analytics event for session not found
      analytics.track("chat:session_not_found", {
        session_id: sessionId,
        source: "direct_url",
      });
      // Redirect to landing with error
      router.replace("/?error=session_not_found");
    }
  }, [sessionResult, sessionId, router]);

  if (sessionResult.type === "not_found") {
    return (
      <div className="flex h-screen-dynamic items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600 dark:border-zinc-600 dark:border-t-zinc-300" />
      </div>
    );
  }

  return (
    <ChatView
      sessionId={sessionResult.data.sessionId}
      initialAgentId={sessionResult.data.agentId}
      resumeMessages={
        sessionResult.data.messages.length > 0
          ? sessionResult.data.messages
          : undefined
      }
      initialMessage={sessionResult.data.initialMessage}
    />
  );
}
