"use client";

/**
 * React context for managing home page state.
 * With URL-based routing, this is now minimal - mainly provides
 * backwards compatibility during transition and any shared state.
 *
 * Navigation is now handled by Next.js router:
 * - New chat: router.push(`/${sessionId}?initial=...&agent=...`)
 * - Resume chat: Link href={`/${sessionId}`}
 * - Return home: router.push('/') or Link href="/"
 */

import { createContext, useContext, type ReactNode } from "react";

interface HomeContextValue {
  /**
   * @deprecated Use router.push(`/${sessionId}?initial=...`) instead
   */
  startChat?: (message: string, agent: string) => void;
  /**
   * @deprecated Use Link href={`/${sessionId}`} instead
   */
  resumeChat?: (sessionId: string, agent: string, messages: unknown[]) => void;
  /**
   * @deprecated Use router.push('/') instead
   */
  resetToLanding?: () => void;
}

const HomeContext = createContext<HomeContextValue>({});

export function HomeProvider({ children }: { children: ReactNode }) {
  // Context is now minimal - routing handles navigation
  return <HomeContext.Provider value={{}}>{children}</HomeContext.Provider>;
}

export function useHome(): HomeContextValue {
  return useContext(HomeContext);
}
