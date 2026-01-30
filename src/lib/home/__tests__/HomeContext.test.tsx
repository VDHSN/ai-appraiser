import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { HomeProvider, useHome } from "../HomeContext";
import type { ReactNode } from "react";

function createWrapper() {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <HomeProvider>{children}</HomeProvider>;
  };
}

describe("HomeContext", () => {
  beforeEach(() => {
    // Reset state between tests by rendering a fresh provider
  });

  it("starts with landing view", () => {
    const { result } = renderHook(() => useHome(), {
      wrapper: createWrapper(),
    });

    expect(result.current.view).toBe("landing");
  });

  it("has null initialMessage on landing view", () => {
    const { result } = renderHook(() => useHome(), {
      wrapper: createWrapper(),
    });

    expect(result.current.initialMessage).toBeNull();
  });

  it("has null selectedAgent on landing view", () => {
    const { result } = renderHook(() => useHome(), {
      wrapper: createWrapper(),
    });

    expect(result.current.selectedAgent).toBeNull();
  });

  it("transitions to chat view when startChat is called", () => {
    const { result } = renderHook(() => useHome(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.startChat("find vintage watches", "curator");
    });

    expect(result.current.view).toBe("chat");
  });

  it("sets initialMessage when startChat is called", () => {
    const { result } = renderHook(() => useHome(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.startChat("find vintage watches", "curator");
    });

    expect(result.current.initialMessage).toBe("find vintage watches");
  });

  it("sets selectedAgent when startChat is called", () => {
    const { result } = renderHook(() => useHome(), {
      wrapper: createWrapper(),
    });

    act(() => {
      result.current.startChat("what is this worth?", "appraiser");
    });

    expect(result.current.selectedAgent).toBe("appraiser");
  });

  it("resets to landing view when resetToLanding is called", () => {
    const { result } = renderHook(() => useHome(), {
      wrapper: createWrapper(),
    });

    // First transition to chat
    act(() => {
      result.current.startChat("find vintage watches", "curator");
    });

    expect(result.current.view).toBe("chat");

    // Then reset to landing
    act(() => {
      result.current.resetToLanding();
    });

    expect(result.current.view).toBe("landing");
    expect(result.current.initialMessage).toBeNull();
    expect(result.current.selectedAgent).toBeNull();
  });

  it("throws error when useHome is used outside of HomeProvider", () => {
    expect(() => {
      renderHook(() => useHome());
    }).toThrow("useHome must be used within a HomeProvider");
  });
});
