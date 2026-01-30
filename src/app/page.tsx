"use client";

import { ChatContainer } from "@/components/chat/ChatContainer";
import { NewUIContainer } from "@/components/home";
import { useFeatureFlagValue } from "@/lib/analytics";

export default function Home() {
  const showNewUI = useFeatureFlagValue("new-ui", false);

  if (showNewUI) {
    return <NewUIContainer />;
  }

  return <ChatContainer />;
}
